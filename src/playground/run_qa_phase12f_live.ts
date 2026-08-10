import { ChildProcessByStdio, spawn } from "node:child_process";
import { Readable } from "node:stream";

type ManagedServerProcess = ChildProcessByStdio<null, Readable, Readable>;

type ApiResp = {
  sessionId: string;
  persona_id: string;
  reply: string;
  final_reply?: string;
  reply_source?: string;
  next_unresolved_topic?: string | null;
  completion_ready?: boolean;
  completion_forced_reply?: boolean;
  reopened_topic_detected?: boolean;
  reopened_answered_topics?: string[];
  identity_profile?: Record<string, string>;
  missing_topics?: string[];
};

type CaseId = "L1" | "L2" | "L3" | "L4";

type CaseResult = {
  case_id: CaseId;
  name: string;
  result: "PASS" | "PARTIAL" | "FAIL" | "TIMEOUT";
  duration_ms: number;
  final_reply: string;
  metadata: string;
  notes: string;
};

type RunnerOptions = {
  caseId: CaseId | null;
  attach: boolean;
  port: number | null;
  help: boolean;
};

type CaseSpec = {
  name: string;
  personaId: string;
  turns: string[];
  evaluator: (last: ApiResp) => { result: CaseResult["result"]; notes: string };
};

const MONTH = "2026-03";
const REQ_TIMEOUT = 30_000;
const CASE_TIMEOUT = 90_000;
const GLOBAL_TIMEOUT = 6 * 60_000;
const DEFAULT_PORTS = [3009, 3011, 3012];

function normalizeText(input: string): string {
  return (input || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]): RunnerOptions {
  let caseId: CaseId | null = null;
  let attach = false;
  let port: number | null = null;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg.startsWith("--case=")) {
      const v = arg.slice("--case=".length).trim();
      if (v === "L1" || v === "L2" || v === "L3" || v === "L4") caseId = v;
      continue;
    }
    if (arg === "--case" && argv[i + 1]) {
      const v = argv[++i].trim();
      if (v === "L1" || v === "L2" || v === "L3" || v === "L4") caseId = v;
      continue;
    }
    if (arg.startsWith("--attach=")) {
      attach = /^(true|1|yes)$/i.test(arg.slice("--attach=".length).trim());
      continue;
    }
    if (arg === "--attach") {
      attach = true;
      continue;
    }
    if (arg.startsWith("--port=")) {
      const v = Number(arg.slice("--port=".length).trim());
      if (Number.isInteger(v) && v > 0) port = v;
      continue;
    }
    if (arg === "--port" && argv[i + 1]) {
      const v = Number(argv[++i].trim());
      if (Number.isInteger(v) && v > 0) port = v;
      continue;
    }
  }

  return { caseId, attach, port, help };
}

function printUsage(): void {
  console.log([
    "Usage:",
    "  npx tsx src/playground/run_qa_phase12f_live.ts --case=L1",
    "  npx tsx src/playground/run_qa_phase12f_live.ts --case=L3 --attach=true --port=3009",
    "",
    "Cases:",
    "  L1  normal buying flow",
    "  L2  proactive sale info",
    "  L3  female persona identity",
    "  L4  missing price should not close",
  ].join("\n"));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`TIMEOUT:${label}:${ms}`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function maskHost(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "invalid_url";
  }
}

async function fetchJson<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit
): Promise<{ status: number; data: T; rawText: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQ_TIMEOUT);
  try {
    const resp = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      signal: controller.signal
    });
    const rawText = await resp.text();
    let data: T;
    try {
      data = rawText ? (JSON.parse(rawText) as T) : ({} as T);
    } catch {
      data = rawText as T;
    }
    return { status: resp.status, data, rawText };
  } finally {
    clearTimeout(timer);
  }
}

async function killStalePlaygroundOnPort(port: number): Promise<void> {
  if (process.platform !== "win32") return;
  const script = `
    $lines = netstat -ano | findstr :${port}
    if ($lines) {
      $ids = @($lines | ForEach-Object { ($_ -split '\\s+')[-1] } | Sort-Object -Unique)
      foreach ($id in $ids) {
        try {
          $p = Get-CimInstance Win32_Process -Filter "ProcessId=$id"
          if ($p.Name -eq 'node.exe' -and ($p.CommandLine -match 'playground|server.ts|tsx')) {
            Stop-Process -Id $id -Force
            Write-Output "Killed PID $id on ${port}"
          }
        } catch {}
      }
    }
  `;
  await new Promise<void>((resolve) => {
    const p = spawn("powershell.exe", ["-NoProfile", "-Command", script], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    p.on("close", () => resolve());
  });
}

function startServer(port: number): ManagedServerProcess {
  const envCmd = `set PLAYGROUND_PORT=${port}&& set npm_config_month=${MONTH}&& npm run playground`;
  return spawn("cmd.exe", ["/c", envCmd], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function waitServer(baseUrl: string, child: ManagedServerProcess, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("playground_exited_before_ready");
    }
    try {
      const r = await fetchJson<{ ok?: boolean }>(baseUrl, "/api/version");
      if (r.status < 400) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error("server_not_ready");
}

function pickPersona(
  personas: Array<{ persona_id: string; display_name: string }>,
  mode: "male" | "female"
): { persona_id: string; display_name: string } {
  if (mode === "female") {
    return (
      personas.find((p) => /chi lan/.test(normalizeText(p.display_name))) ||
      personas.find((p) => /^chi\b/.test(normalizeText(p.display_name))) ||
      personas[0]
    );
  }
  return personas.find((p) => /^anh\b/.test(normalizeText(p.display_name))) || personas[0];
}

async function startManagedServer(preferredPort: number | null): Promise<{ port: number; child: ManagedServerProcess }> {
  const ports = preferredPort ? [preferredPort] : DEFAULT_PORTS;
  for (const port of ports) {
    await killStalePlaygroundOnPort(port);
    const baseUrl = `http://127.0.0.1:${port}`;
    const child = startServer(port);
    child.stdout.on("data", (chunk) => process.stdout.write(`[playground:${port}] ${chunk.toString()}`));
    child.stderr.on("data", (chunk) => process.stderr.write(`[playground:${port}] ${chunk.toString()}`));
    try {
      await waitServer(baseUrl, child);
      return { port, child };
    } catch (error) {
      if (!child.killed) child.kill("SIGTERM");
      if (preferredPort) throw error;
      console.log(`Port ${port} not ready, trying next port`);
    }
  }
  throw new Error("no_available_playground_port");
}

async function runCase(
  baseUrl: string,
  caseId: CaseId,
  name: string,
  personaId: string,
  turns: string[],
  evaluator: (last: ApiResp) => { result: CaseResult["result"]; notes: string }
): Promise<CaseResult> {
  const t0 = Date.now();
  console.log(`[CASE_START] ${caseId} ${name}`);

  const run = async (): Promise<CaseResult> => {
    const statusTrail: string[] = [];
    const start = await fetchJson<ApiResp>(baseUrl, "/api/customer-start", {
      method: "POST",
      body: JSON.stringify({ personaId })
    });
    statusTrail.push(`start=${start.status}`);
    console.log(`[HTTP] ${caseId} /api/customer-start ${start.status}`);
    if (start.status >= 400) {
      throw new Error(`HTTP ${start.status} /api/customer-start ${start.rawText.slice(0, 220)}`);
    }

    let sid = start.data.sessionId;
    let last = start.data;
    for (const message of turns) {
      const r = await fetchJson<ApiResp>(baseUrl, "/api/chat", {
        method: "POST",
        body: JSON.stringify({ sessionId: sid, personaId, message })
      });
      statusTrail.push(`chat=${r.status}`);
      console.log(`[HTTP] ${caseId} /api/chat ${r.status}`);
      if (r.status >= 400) {
        throw new Error(`HTTP ${r.status} /api/chat ${r.rawText.slice(0, 220)}`);
      }
      sid = r.data.sessionId;
      last = r.data;
    }

    const evaled = evaluator(last);
    return {
      case_id: caseId,
      name,
      result: evaled.result,
      duration_ms: Date.now() - t0,
      final_reply: (last.final_reply || last.reply || "").slice(0, 220),
      metadata: `http=${statusTrail.join(",")}|src=${last.reply_source || "-"}|next=${last.next_unresolved_topic || "-"}|ready=${String(last.completion_ready)}|forced=${String(last.completion_forced_reply)}|reopen=${String(last.reopened_topic_detected)}`,
      notes: `${evaled.notes}; reopened=${(last.reopened_answered_topics || []).join(",") || "-"}; id=${JSON.stringify(last.identity_profile || {})}`
    };
  };

  try {
    const out = await withTimeout(run(), CASE_TIMEOUT, `case_${caseId}`);
    console.log(`[CASE_END] ${caseId} ${out.result} ${out.duration_ms}ms`);
    return out;
  } catch (error) {
    const note = error instanceof Error ? error.message : String(error);
    console.log(`[CASE_END] ${caseId} TIMEOUT/ERROR ${Date.now() - t0}ms ${note}`);
    return {
      case_id: caseId,
      name,
      result: note.includes("TIMEOUT") ? "TIMEOUT" : "FAIL",
      duration_ms: Date.now() - t0,
      final_reply: "-",
      metadata: "-",
      notes: note
    };
  }
}

function buildCaseSpec(
  caseId: CaseId,
  personas: Array<{ persona_id: string; display_name: string }>
): CaseSpec {
  const male = pickPersona(personas, "male");
  const female = pickPersona(personas, "female");

  switch (caseId) {
    case "L1":
      return {
        name: "normal buying flow",
        personaId: male.persona_id,
        turns: [
          "Dạ bên em có mẫu laptop i5 RAM 16GB cho văn phòng anh.",
          "Dạ giá 25 triệu anh.",
          "Dạ còn sẵn 12 máy anh.",
          "Dạ giao nội thành hôm nay được, bảo hành 12 tháng anh.",
          "Dạ có xuất hóa đơn công ty và thanh toán chuyển khoản được anh."
        ],
        evaluator: (last) => {
          const txt = (last.final_reply || last.reply || "").toLowerCase();
          const bad = /(gia sao|con hang khong|giao khi nao|bao hanh sao|hoa don sao)/i.test(txt);
          if (bad) return { result: "FAIL", notes: "reopen_obvious_topic" };
          if (last.completion_ready || last.completion_forced_reply) return { result: "PASS", notes: "completion_or_forced_ok" };
          return { result: "PARTIAL", notes: "not_closed_yet" };
        }
      };
    case "L2":
      return {
        name: "proactive sale info",
        personaId: male.persona_id,
        turns: [
          "Dạ mẫu này i5 RAM 16GB, giá 25 triệu, còn 12 máy, giao hôm nay được, bảo hành 12 tháng, có xuất hóa đơn công ty và thanh toán chuyển khoản được anh."
        ],
        evaluator: (last) => {
          const txt = (last.final_reply || last.reply || "").toLowerCase();
          if (/(gia sao em|con hang khong em|giao khi nao em)/i.test(txt)) return { result: "FAIL", notes: "reopen_not_blocked" };
          if (last.reopened_topic_detected || last.completion_forced_reply || last.completion_ready) return { result: "PASS", notes: "guard_or_completion_active" };
          return { result: "PARTIAL", notes: "no_reopen_but_no_clear_guard" };
        }
      };
    case "L3":
      return {
        name: "female persona identity",
        personaId: female.persona_id,
        turns: ["Dạ bên em còn hàng chị.", "Dạ giá 25 triệu chị."],
        evaluator: (last) => {
          const txt = (last.final_reply || last.reply || "").toLowerCase();
          const self = last.identity_profile?.customer_self_pronoun || "";
          const target = last.identity_profile?.customer_target_pronoun || "";
          if (self === "chị" && target === "em" && !/anh cần|anh muốn|anh sẽ/.test(txt)) {
            return { result: "PASS", notes: "identity_lock_ok" };
          }
          return { result: "FAIL", notes: `identity_drift self=${self} target=${target}` };
        }
      };
    case "L4":
      return {
        name: "missing price should not close",
        personaId: male.persona_id,
        turns: ["Dạ bên em có mẫu i5 RAM 16GB, còn hàng và giao hôm nay được anh."],
        evaluator: (last) => {
          const missing = last.missing_topics || [];
          if (last.completion_ready) return { result: "FAIL", notes: "closed_too_early" };
          if (missing.includes("price")) return { result: "PASS", notes: "missing_price_kept_open" };
          return { result: "PARTIAL", notes: "not_closed_but_missing_not_reported" };
        }
      };
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.caseId) {
    printUsage();
    process.exitCode = options.help ? 0 : 1;
    return;
  }

  const baseRaw = process.env.OPENAI_BASE_URL || "";
  const model = process.env.OPENAI_MODEL || "";
  console.log(`OPENAI_BASE_URL detected: ${baseRaw ? "yes" : "no"}`);
  if (baseRaw) console.log(`OPENAI_BASE_URL masked: ${maskHost(baseRaw)}`);
  console.log(`OPENAI_MODEL detected: ${model ? "yes" : "no"}`);

  let server: ManagedServerProcess | null = null;
  let port = options.port;

  try {
    if (options.attach) {
      port = port ?? 3009;
      console.log(`Attach mode enabled on port: ${port}`);
    } else {
      const managed = await startManagedServer(port);
      port = managed.port;
      server = managed.child;
      console.log(`Using playground port: ${port}`);
    }

    const baseUrl = `http://127.0.0.1:${port}`;
    const personasResp = await fetchJson<{ personas: Array<{ persona_id: string; display_name: string }> }>(
      baseUrl,
      "/api/personas"
    );
    if (personasResp.status >= 400) {
      throw new Error(`HTTP ${personasResp.status} /api/personas ${personasResp.rawText.slice(0, 220)}`);
    }

    const personas = personasResp.data.personas || [];
    if (personas.length === 0) throw new Error("no_persona_found");

    const spec = buildCaseSpec(options.caseId, personas);
    const result = await runCase(baseUrl, options.caseId, spec.name, spec.personaId, spec.turns, spec.evaluator);

    console.log("");
    console.log("+------+-----------------------------+---------+----------+");
    console.log("| Case | Name                        | Result  | Duration |");
    console.log("+------+-----------------------------+---------+----------+");
    console.log(`| ${result.case_id.padEnd(4)} | ${result.name.slice(0, 27).padEnd(27)} | ${result.result.padEnd(7)} | ${String(result.duration_ms).padEnd(8)} |`);
    console.log("+------+-----------------------------+---------+----------+");
    console.log(`[${result.case_id}] final_reply=${result.final_reply}`);
    console.log(`[${result.case_id}] metadata=${result.metadata}`);
    console.log(`[${result.case_id}] notes=${result.notes}`);

    process.exitCode = result.result === "PASS" ? 0 : 1;
  } finally {
    if (server && !server.killed) server.kill("SIGTERM");
  }
}

withTimeout(main(), GLOBAL_TIMEOUT, "global_live_runner").catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
