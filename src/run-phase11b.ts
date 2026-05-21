import * as fs from "fs";
import * as path from "path";

type EnrichedPersona = {
  persona_id: string;
  display_name?: string;
  name?: string;
  buyer_role?: string;
  product_interest_categories?: string[];
  opening_messages?: string[];
  behavior_rules?: string[];
  closing_conditions?: string[];
  difficulty?: string;
  name_is_synthetic?: boolean;
  runtime_contexts?: string[];
  likely_questions?: string[];
  role_prompt?: string;
  [k: string]: unknown;
};

type PersonaApiItem = {
  persona_id: string;
  display_name?: string;
  buyer_role?: string;
};

interface CliArgs {
  month: string;
}

function parseArgs(argv: string[]): CliArgs {
  let month = process.env.npm_config_month?.trim() ?? "";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--month=")) {
      month = arg.slice("--month=".length).trim();
      continue;
    }
    if (arg === "--month") {
      month = (argv[i + 1] ?? "").trim();
      i += 1;
    }
  }
  if (!month) throw new Error("Missing --month=YYYY-MM");
  return { month };
}

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function maskText(v: string): string {
  if (!v) return "";
  const t = v.replace(/\s+/g, " ").trim();
  return t.length <= 48 ? t : `${t.slice(0, 45)}...`;
}

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function countMissing(personas: EnrichedPersona[], fn: (p: EnrichedPersona) => boolean): number {
  return personas.filter(fn).length;
}

function normalize(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

async function tryEndpoint<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const resp = await fetch(url, init);
    if (!resp.ok) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

function scoreFromIssueCount(base: number, issues: number, weight: number): number {
  return Math.max(0, Math.min(100, Math.round(base - issues * weight)));
}

async function main(): Promise<void> {
  const { month } = parseArgs(process.argv.slice(2));
  const inFile = path.join(
    "sale-testlab-data",
    "10d_training_personas_enriched",
    month,
    "training_personas_enriched.jsonl"
  );
  const summaryFile = path.join(
    "sale-testlab-data",
    "10d_training_personas_enriched",
    month,
    "training_persona_identity_summary.json"
  );
  const outDir = path.join("sale-testlab-data", "11b_playground_qa", month);
  const outReport = path.join(outDir, "playground_qa_report.json");
  const outSummary = path.join(outDir, "playground_qa_summary.json");

  const personas = readJsonl<EnrichedPersona>(inFile);
  const personaCount = personas.length;

  let recommendedIds: string[] = [];
  if (fs.existsSync(summaryFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(summaryFile, "utf8")) as { recommended_playground_personas?: string[] };
      recommendedIds = parsed.recommended_playground_personas ?? [];
    } catch {
      recommendedIds = [];
    }
  }

  const missingDisplayName = countMissing(personas, (p) => !p.display_name || !String(p.display_name).trim());
  const missingBuyerRole = countMissing(personas, (p) => !p.buyer_role || !String(p.buyer_role).trim());
  const missingProducts = countMissing(personas, (p) => safeArray<string>(p.product_interest_categories).length === 0);
  const missingOpenings = countMissing(personas, (p) => safeArray<string>(p.opening_messages).length === 0);
  const missingBehaviorRules = countMissing(personas, (p) => safeArray<string>(p.behavior_rules).length === 0);
  const missingClosing = countMissing(personas, (p) => safeArray<string>(p.closing_conditions).length === 0);
  const nonSyntheticCount = countMissing(personas, (p) => p.name_is_synthetic !== true);

  const genericNamePatterns = /(persona|buyer|customer|test|sample|default|technical|runtime|profile)/i;
  const genericOrTechnicalNameCount = countMissing(
    personas,
    (p) => genericNamePatterns.test(String(p.name ?? "")) || genericNamePatterns.test(String(p.display_name ?? ""))
  );

  const emotionalLabelPattern =
    /(hướng nội|hướng ngoại|cảm xúc|nhạy cảm|nóng tính|tâm lý|introvert|extrovert|emotional|personality)/i;
  const emotionalLabelViolations = personas.filter((p) => {
    const text = [
      ...safeArray<string>(p.behavior_rules),
      ...safeArray<string>(p.likely_questions),
      String(p.role_prompt ?? "")
    ].join(" | ");
    return emotionalLabelPattern.test(text);
  }).length;

  const rawLeakPattern = /(090|093|094|097|098|09\d{8}|Conversation\s*\d+|source_file|raw_real_)/i;
  const potentialRawLeakPersonas = personas.filter((p) => {
    const text = JSON.stringify({
      display_name: p.display_name,
      behavior_rules: p.behavior_rules,
      opening_messages: p.opening_messages,
      role_prompt: p.role_prompt
    });
    return rawLeakPattern.test(text);
  }).length;

  const nameCount = new Map<string, number>();
  const displayIdentityCount = new Map<string, number>();
  const difficultyDist: Record<string, number> = {};
  for (const p of personas) {
    const n = normalize(String(p.name ?? ""));
    const d = normalize(String(p.display_name ?? ""));
    const b = normalize(String(p.buyer_role ?? ""));
    if (n) nameCount.set(n, (nameCount.get(n) ?? 0) + 1);
    if (d || b) displayIdentityCount.set(`${d}|${b}`, (displayIdentityCount.get(`${d}|${b}`) ?? 0) + 1);
    const diff = String(p.difficulty ?? "unknown");
    difficultyDist[diff] = (difficultyDist[diff] ?? 0) + 1;
  }
  const duplicatePersonaNames = [...nameCount.entries()].filter(([, c]) => c > 1).length;
  const duplicateDisplayIdentities = [...displayIdentityCount.entries()].filter(([, c]) => c > 1).length;

  const apiPersonas = await tryEndpoint<{
    count: number;
    personas: PersonaApiItem[];
    recommended_ids?: string[];
  }>("http://localhost:3009/api/personas");

  const version = await tryEndpoint<Record<string, unknown>>("http://localhost:3009/api/version");
  const endpointAvailable = !!apiPersonas;
  const recommendedShownFirst = !!(
    apiPersonas &&
    apiPersonas.recommended_ids &&
    apiPersonas.recommended_ids.length > 0 &&
    apiPersonas.personas.length > 0 &&
    apiPersonas.recommended_ids.includes(apiPersonas.personas[0].persona_id)
  );

  const runtimeIdVisibleDefault = !!(
    apiPersonas &&
    apiPersonas.personas.slice(0, 5).some((p) => /rp_conversation_/i.test(p.persona_id))
  );

  const sampleMessages = [
    "Bên em đang có giá tốt nhất rồi anh.",
    "Giao trong hôm nay được anh nhé.",
    "Anh chuyển khoản giúp em nhé.",
    "Anh đang cần dùng văn phòng hay gaming ạ?"
  ];

  const endpointTests: Array<Record<string, unknown>> = [];
  let customerReplyQuality = 0;
  if (apiPersonas && apiPersonas.personas.length > 0) {
    const personaId = apiPersonas.personas[0].persona_id;
    const start = await tryEndpoint<Record<string, unknown>>("http://localhost:3009/api/customer-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personaId })
    });

    let sessionId = String(start?.sessionId ?? "");
    if (start) {
      endpointTests.push({
        test: "customer_start",
        persona: personaId,
        customer_reply: maskText(String(start.reply ?? "")),
        inferred_state: start.runtime_state ?? null,
        reply_source: start.reply_source ?? null,
        latency_ms: start.latency_ms ?? null,
        assistant_style_detected: start.assistant_style_detected ?? null,
        vietnamese_accent_warning: start.vietnamese_accent_warning ?? null
      });
    }

    let good = 0;
    let total = 0;
    for (const msg of sampleMessages) {
      const row = await tryEndpoint<Record<string, unknown>>("http://localhost:3009/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId || undefined, personaId, message: msg })
      });
      if (!row) continue;
      sessionId = String(row.sessionId ?? sessionId);
      total += 1;
      const assistantDetected = !!row.assistant_style_detected;
      const accentWarn = !!row.vietnamese_accent_warning;
      const reply = String(row.reply ?? "");
      const looksCustomer = !/(tôi hỗ trợ|vui lòng cung cấp|xin cung cấp)/i.test(reply);
      if (looksCustomer && !assistantDetected) good += 1;
      endpointTests.push({
        test: "chat",
        sale_message: maskText(msg),
        persona: personaId,
        customer_reply: maskText(reply),
        inferred_state: row.runtime_state ?? null,
        reply_source: row.reply_source ?? null,
        latency_ms: row.latency_ms ?? null,
        assistant_style_detected: assistantDetected,
        vietnamese_accent_warning: accentWarn,
        reply_matches_persona_basic: looksCustomer
      });
    }
    customerReplyQuality = total > 0 ? Math.round((good / total) * 100) : 0;
  }

  const sourceUses10D = !!version && String(version.playground_version ?? "").includes("phase11-training-personas");

  const issueSum =
    missingDisplayName +
    missingBuyerRole +
    missingProducts +
    missingOpenings +
    missingBehaviorRules +
    missingClosing +
    genericOrTechnicalNameCount +
    nonSyntheticCount +
    emotionalLabelViolations +
    potentialRawLeakPersonas +
    duplicatePersonaNames +
    duplicateDisplayIdentities;

  const personaSourceCorrectness = sourceUses10D ? 100 : 35;
  const personaDataQuality = scoreFromIssueCount(100, issueSum, 2.5);
  const playgroundIntegrationQuality = scoreFromIssueCount(
    95,
    Number(!sourceUses10D) + Number(!endpointAvailable) + Number(!recommendedShownFirst),
    20
  );
  const readinessBase = Math.round(
    personaSourceCorrectness * 0.35 +
      personaDataQuality * 0.25 +
      playgroundIntegrationQuality * 0.25 +
      customerReplyQuality * 0.15
  );

  const report = {
    month,
    checks: {
      expected_final_persona_source: inFile,
      fallback_runtime_source: path.join(
        "sale-testlab-data",
        "07_runtime_personas",
        month,
        "runtime_personas.jsonl"
      ),
      current_playground_persona_source_detected: sourceUses10D
        ? "10d_training_personas_enriched"
        : "runtime_or_unknown",
      final_training_personas_used: sourceUses10D,
      recommended_personas_shown_first: recommendedShownFirst,
      runtime_persona_ids_hidden_by_default: !runtimeIdVisibleDefault,
      customer_start_uses_training_opening_messages: sourceUses10D,
      chat_injects_training_persona_fields_to_prompt: sourceUses10D
    },
    data_quality: {
      total_enriched_personas: personaCount,
      recommended_personas_count: recommendedIds.length,
      missing_display_name: missingDisplayName,
      missing_buyer_role: missingBuyerRole,
      missing_product_interest_categories: missingProducts,
      missing_opening_messages: missingOpenings,
      missing_behavior_rules: missingBehaviorRules,
      missing_closing_conditions: missingClosing,
      generic_or_technical_name_count: genericOrTechnicalNameCount,
      name_is_synthetic_not_true_count: nonSyntheticCount,
      potential_raw_leak_personas: potentialRawLeakPersonas,
      emotional_or_personality_label_violations: emotionalLabelViolations,
      duplicate_persona_names: duplicatePersonaNames,
      duplicate_display_identities: duplicateDisplayIdentities,
      difficulty_distribution: difficultyDist
    },
    endpoint_tests: {
      endpoint_available: endpointAvailable,
      tested_url: "http://localhost:3009",
      records: endpointTests
    },
    scores: {
      persona_source_correctness: personaSourceCorrectness,
      persona_data_quality: personaDataQuality,
      playground_integration_quality: playgroundIntegrationQuality,
      customer_reply_quality: customerReplyQuality,
      playground_readiness: readinessBase
    }
  };

  const issues: string[] = [];
  if (!sourceUses10D) issues.push("playground_not_using_10d_enriched_as_primary_source");
  if (!recommendedShownFirst) issues.push("recommended_personas_not_prioritized_in_api_order");
  if (missingDisplayName > 0) issues.push("some_personas_missing_display_name");
  if (missingBuyerRole > 0) issues.push("some_personas_missing_buyer_role");
  if (missingOpenings > 0) issues.push("some_personas_missing_opening_messages");
  if (potentialRawLeakPersonas > 0) issues.push("potential_raw_like_pattern_detected_in_persona_fields");
  if (emotionalLabelViolations > 0) issues.push("emotional_or_personality_labels_detected");

  const summary = {
    month,
    phase11b_added: true,
    total_enriched_personas: personaCount,
    recommended_personas_count: recommendedIds.length,
    final_training_personas_used: sourceUses10D,
    endpoint_available: endpointAvailable,
    scores: report.scores,
    detected_issues: issues,
    recommended_next_fixes: [
      "If any source mismatch appears, force /api/personas to read only 10d enriched source.",
      "Keep runtime personas as compatibility fallback only for state routing.",
      "Add stronger state-aware response checks in phase8c when mismatch remains high."
    ]
  };

  writeJson(outReport, report);
  writeJson(outSummary, summary);

  console.log(`Phase11B month=${month}`);
  console.log(`enriched_personas=${personaCount}`);
  console.log(`final_source_used=${sourceUses10D}`);
  console.log(`endpoint_available=${endpointAvailable}`);
  console.log(`scores=${JSON.stringify(report.scores)}`);
  console.log(`outputs: ${outReport}, ${outSummary}`);
}

main();
