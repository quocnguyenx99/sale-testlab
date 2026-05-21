import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs";

type LiveResponse = {
  sessionId: string;
  persona_id: string;
  reply: string;
  reply_source: string;
  final_reply?: string;
  raw_model_reply?: string;
  candidate_reply_before_guards?: string;
  next_unresolved_topic?: string | null;
  completion_ready?: boolean;
  completion_reason?: string;
  missing_topics?: string[];
  resolved_topics?: string[];
  completion_forced_reply?: boolean;
  completion_override_reason?: string | null;
  fallback_variant_id?: string | null;
  fallback_topic_used?: string | null;
  progress_before?: unknown;
  progress_after?: unknown;
  identity_profile?: {
    customer_self_pronoun?: string;
    customer_target_pronoun?: string;
    sale_expected_self_pronoun?: string;
    sale_expected_target_pronoun?: string;
  };
  identity_source?: string;
  persona_salutation_style?: string;
  identity_drift_detected?: boolean;
  role_inversion_detected?: boolean;
  repeated_freeform_loop?: boolean;
  repeated_blocked_topics?: string[];
  reopened_topic_detected?: boolean;
  reopened_answered_topics?: string[];
  final_reopen_guard_triggered?: boolean;
  guard_triggered?: boolean;
  guard_trigger_reasons?: string[];
};

type ScenarioRow = {
  scenario_name: string;
  result: "PASS" | "FAIL" | "PARTIAL";
  failure_reason: string;
  final_reply: string;
  reply_source: string;
  next_unresolved_topic: string | null | undefined;
  completion_ready: boolean | undefined;
  completion_reason: string | undefined;
  missing_topics: string;
  resolved_topics: string;
  identity_profile: string;
  identity_drift_detected: boolean | undefined;
  role_inversion_detected: boolean | undefined;
  repeated_freeform_loop: boolean | undefined;
  repeated_blocked_topics: string;
  fallback_variant_id: string | null | undefined;
  fallback_topic_used: string | null | undefined;
  reopened_topic_detected?: boolean | undefined;
  reopened_answered_topics?: string;
  final_reopen_guard_triggered?: boolean | undefined;
  guard_triggered?: boolean | undefined;
  guard_trigger_reasons?: string;
  identity_source?: string;
  persona_salutation_style?: string;
  completion_forced_reply?: boolean | undefined;
  completion_override_reason?: string | null | undefined;
};

type ScenarioDef = {
  name: string;
  personaSelector: (personas: Array<{ persona_id: string; display_name: string }>) => string;
  turns: string[];
  pass: (finalResponse: LiveResponse, history: LiveResponse[]) => boolean;
  failReason: (finalResponse: LiveResponse, history: LiveResponse[]) => string;
  partial?: (finalResponse: LiveResponse, history: LiveResponse[]) => boolean;
};

const PORT = 3011;
const MONTH = "2026-03";

function normalize(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const resp = await fetch(`http://127.0.0.1:${PORT}/api/version`);
      if (resp.ok) return;
    } catch {}
    await sleep(2000);
  }
  throw new Error("Playground live server not ready");
}

async function startServer(): Promise<ChildProcessWithoutNullStreams> {
  const child =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/c", `set PLAYGROUND_PORT=${PORT}&& set npm_config_month=${MONTH}&& npm run playground -- --month=${MONTH}`], {
          cwd: process.cwd(),
          stdio: ["ignore", "pipe", "pipe"]
        })
      : spawn("npm", ["run", "playground", "--", `--month=${MONTH}`], {
          cwd: process.cwd(),
          env: {
            ...process.env,
            PLAYGROUND_PORT: String(PORT),
            npm_config_month: MONTH
          },
          stdio: ["ignore", "pipe", "pipe"]
        });

  child.stdout.on("data", (chunk) => process.stdout.write(chunk.toString()));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk.toString()));
  return child;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`http://127.0.0.1:${PORT}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} for ${path}`);
  }
  return (await resp.json()) as T;
}

async function customerStart(personaId: string): Promise<LiveResponse> {
  return apiJson<LiveResponse>("/api/customer-start", {
    method: "POST",
    body: JSON.stringify({ personaId })
  });
}

async function chat(sessionId: string, personaId: string, message: string): Promise<LiveResponse> {
  return apiJson<LiveResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ sessionId, personaId, message })
  });
}

function row(
  scenario_name: string,
  response: LiveResponse,
  result: "PASS" | "FAIL" | "PARTIAL",
  failure_reason: string,
  partial = false
): ScenarioRow {
  return {
    scenario_name,
    result: partial ? "PARTIAL" : result,
    failure_reason,
    final_reply: response.final_reply || response.reply || "",
    reply_source: response.reply_source || "",
    next_unresolved_topic: response.next_unresolved_topic,
    completion_ready: response.completion_ready,
    completion_reason: response.completion_reason,
    missing_topics: (response.missing_topics || []).join(", "),
    resolved_topics: (response.resolved_topics || []).join(", "),
    identity_profile: JSON.stringify(response.identity_profile || {}),
    identity_drift_detected: response.identity_drift_detected,
    role_inversion_detected: response.role_inversion_detected,
    repeated_freeform_loop: response.repeated_freeform_loop,
    repeated_blocked_topics: (response.repeated_blocked_topics || []).join(", "),
    fallback_variant_id: response.fallback_variant_id,
    fallback_topic_used: response.fallback_topic_used,
    reopened_topic_detected: response.reopened_topic_detected,
    reopened_answered_topics: (response.reopened_answered_topics || []).join(", "),
    final_reopen_guard_triggered: response.final_reopen_guard_triggered,
    guard_triggered: response.guard_triggered,
    guard_trigger_reasons: (response.guard_trigger_reasons || []).join(", "),
    identity_source: response.identity_source,
    persona_salutation_style: response.persona_salutation_style,
    completion_forced_reply: response.completion_forced_reply,
    completion_override_reason: response.completion_override_reason
  };
}

function hasReopen(text: string): boolean {
  const t = normalize(text);
  return /\b(gia sao|còn hàng|con hang|giao khi nao|giao duoc|thanh toan|hóa đơn|bao hanh|bao nhieu|stk|so tai khoan)\b/.test(t);
}

function makeScenarios(personas: Array<{ persona_id: string; display_name: string }>): ScenarioDef[] {
  const male = personas.find((p) => /^anh\b/i.test(p.display_name))?.persona_id || personas[0]?.persona_id || "";
  const female = personas.find((p) => /^chị\b/i.test(p.display_name))?.persona_id || personas[personas.length - 1]?.persona_id || male;

  return [
    {
      name: "F1 - Long normal buying flow",
      personaSelector: () => male,
      turns: [
        "Hiện còn mẫu này anh.",
        "25 triệu anh.",
        "Mai giao trong ngày được anh.",
        "Chuyển khoản hoặc tiền mặt đều được anh.",
        "Xuất hóa đơn đầy đủ anh nhé."
      ],
      pass: (finalResponse) =>
        !hasReopen(finalResponse.final_reply || finalResponse.reply) &&
        Boolean(finalResponse.completion_ready) &&
        Boolean(finalResponse.completion_forced_reply),
      failReason: () => "did_not_close_or_reopened"
    },
    {
      name: "F2 - Proactive sale info",
      personaSelector: () => male,
      turns: [
        "Mẫu này i5 RAM 16GB, giá 25 triệu, còn 12 máy, giao hôm nay được, bảo hành 12 tháng, có xuất hóa đơn công ty và thanh toán chuyển khoản được anh."
      ],
      pass: (finalResponse) =>
        Boolean(finalResponse.completion_ready) &&
        Boolean(finalResponse.completion_forced_reply) &&
        !hasReopen(finalResponse.final_reply || finalResponse.reply),
      failReason: () => "proactive_sale_info_not_respected"
    },
    {
      name: "F3 - Short answer stress",
      personaSelector: () => male,
      turns: [
        "còn anh",
        "30 anh",
        "mai giao được",
        "12 tháng",
        "có hóa đơn",
        "chuyển khoản được"
      ],
      pass: (finalResponse) =>
        Boolean(finalResponse.completion_ready) &&
        !hasReopen(finalResponse.final_reply || finalResponse.reply),
      failReason: () => "short_answers_not_closed"
    },
    {
      name: "F4 - Female persona identity stress",
      personaSelector: () => female,
      turns: [
        "Mình đang tìm laptop cho văn phòng.",
        "Dòng i5 còn hàng chị.",
        "Giá sao em?",
        "24 triệu chị.",
        "Giao được khi nào em?",
        "Mai giao được chị.",
        "Thanh toán sao em?",
        "Chuyển khoản hoặc tiền mặt đều được chị.",
        "Xuất hóa đơn công ty được không em?",
        "Xuất đầy đủ chị."
      ],
      pass: (finalResponse) =>
        finalResponse.identity_profile?.customer_self_pronoun === "chị" &&
        finalResponse.identity_profile?.customer_target_pronoun === "em" &&
        !Boolean(finalResponse.identity_drift_detected) &&
        !Boolean(finalResponse.role_inversion_detected) &&
        !/anh cần|anh muốn|anh sẽ/i.test(finalResponse.final_reply || finalResponse.reply),
      failReason: () => "identity_drift_or_role_inversion"
    },
    {
      name: "F5 - Reopen / loop attack",
      personaSelector: () => male,
      turns: [
        "Còn hàng, giá 26 triệu, mai giao, chuyển khoản được, có hóa đơn anh.",
        "Giá sao em?",
        "Giao khi nào em?",
        "Còn hàng không em?"
      ],
      pass: (finalResponse) =>
        !Boolean(finalResponse.reopened_topic_detected) ||
        Boolean(finalResponse.final_reopen_guard_triggered) ||
        Boolean(finalResponse.completion_forced_reply),
      failReason: () => "reopen_guard_not_triggered"
    },
    {
      name: "F6 - Not enough info should NOT close",
      personaSelector: () => male,
      turns: [
        "Mẫu này còn hàng, cấu hình i5 RAM 16GB SSD 512GB anh."
      ],
      pass: (finalResponse) =>
        !Boolean(finalResponse.completion_ready) &&
        !Boolean(finalResponse.completion_forced_reply),
      failReason: () => "closed_too_early",
      partial: undefined
    },
    {
      name: "F7 - Long messy real-world flow",
      personaSelector: () => male,
      turns: [
        "Mẫu A còn hàng anh.",
        "Giá 29 triệu anh.",
        "Xuất VAT đầy đủ.",
        "Công nợ chưa hỗ trợ, chuyển khoản hoặc tiền mặt.",
        "Nếu đổi mẫu B thì giá 31 triệu.",
        "Mẫu B còn 2 máy.",
        "Mẫu B giao hai địa điểm được, phát sinh phí nhẹ.",
        "Mẫu A vẫn còn 5 máy.",
        "Mẫu A giao mai được.",
        "Bảo hành 12 tháng.",
        "Có thể giữ hàng 24h."
      ],
      pass: (finalResponse, history) =>
        !Boolean(finalResponse.identity_drift_detected) &&
        !Boolean(finalResponse.role_inversion_detected) &&
        !Boolean(finalResponse.repeated_freeform_loop) &&
        history.length > 0,
      failReason: () => "critical_drift_or_loop",
      partial: undefined
    }
  ];
}

function printTable(rows: ScenarioRow[]): void {
  console.log("+----+-------------------------------+---------+");
  console.log("| ID | Scenario                      | Result  |");
  console.log("+----+-------------------------------+---------+");
  rows.forEach((row, idx) => {
    console.log(
      `| ${String(idx + 1).padEnd(2)} | ${row.scenario_name.slice(0, 29).padEnd(29)} | ${row.result.padEnd(7)} |`
    );
  });
  console.log("+----+-------------------------------+---------+");
}

async function runScenario(def: ScenarioDef, personas: Array<{ persona_id: string; display_name: string }>): Promise<ScenarioRow> {
  const personaId = def.personaSelector(personas);
  const start = await customerStart(personaId);
  let sessionId = start.sessionId;
  const history: LiveResponse[] = [start];
  let last = start;

  for (const turn of def.turns) {
    last = await chat(sessionId, personaId, turn);
    sessionId = last.sessionId;
    history.push(last);
  }

  const ok = def.pass(last, history);
  const result = ok ? "PASS" : (def.partial ? "PARTIAL" : "FAIL");
  const partial = def.partial ? def.partial(last, history) : false;
  return row(def.name, last, result, ok ? "" : def.failReason(last, history), partial && !ok);
}

async function main(): Promise<void> {
  const server = await startServer();
  try {
    await waitForServer();
    const personaPayload = await apiJson<{ personas: Array<{ persona_id: string; display_name: string }> }>("/api/personas");
    const scenarios = makeScenarios(personaPayload.personas);
    const rows: ScenarioRow[] = [];
    for (const scenario of scenarios) {
      rows.push(await runScenario(scenario, personaPayload.personas));
    }
    printTable(rows);
    for (const rowData of rows) {
      console.log(`\n[${rowData.result}] ${rowData.scenario_name}`);
      console.log(`failure_reason: ${rowData.failure_reason || "-"}`);
      console.log(`final_reply: ${rowData.final_reply}`);
      console.log(`reply_source: ${rowData.reply_source}`);
      console.log(`next_unresolved_topic: ${rowData.next_unresolved_topic ?? "-"}`);
      console.log(`completion_ready: ${String(rowData.completion_ready)}`);
      console.log(`completion_reason: ${rowData.completion_reason ?? "-"}`);
      console.log(`missing_topics: ${rowData.missing_topics || "-"}`);
      console.log(`resolved_topics: ${rowData.resolved_topics || "-"}`);
      console.log(`identity_profile: ${rowData.identity_profile}`);
      console.log(`identity_source: ${rowData.identity_source || "-"}`);
      console.log(`persona_salutation_style: ${rowData.persona_salutation_style || "-"}`);
      console.log(`identity_drift_detected: ${String(rowData.identity_drift_detected)}`);
      console.log(`role_inversion_detected: ${String(rowData.role_inversion_detected)}`);
      console.log(`repeated_freeform_loop: ${String(rowData.repeated_freeform_loop)}`);
      console.log(`repeated_blocked_topics: ${rowData.repeated_blocked_topics || "-"}`);
      console.log(`reopened_topic_detected: ${String(rowData.reopened_topic_detected)}`);
      console.log(`reopened_answered_topics: ${rowData.reopened_answered_topics || "-"}`);
      console.log(`final_reopen_guard_triggered: ${String(rowData.final_reopen_guard_triggered)}`);
      console.log(`guard_triggered: ${String(rowData.guard_triggered)}`);
      console.log(`guard_trigger_reasons: ${rowData.guard_trigger_reasons || "-"}`);
      console.log(`fallback_variant_id: ${rowData.fallback_variant_id || "-"}`);
      console.log(`fallback_topic_used: ${rowData.fallback_topic_used || "-"}`);
      console.log(`completion_forced_reply: ${String(rowData.completion_forced_reply)}`);
      console.log(`completion_override_reason: ${rowData.completion_override_reason || "-"}`);
    }
  } finally {
    if (!server.killed) {
      server.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
