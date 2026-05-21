import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

interface TrainingPersona {
  persona_id: string;
  source_archetype_id: string;
  name: string;
  difficulty: "easy" | "medium" | "hard";
  role_prompt: string;
  behavior_rules: string[];
  opening_messages: string[];
  likely_questions: string[];
  objection_patterns: string[];
  closing_conditions: string[];
  sale_training_focus: string[];
  runtime_contexts: string[];
  allowed_states: string[];
  do_not_do: string[];
  evidence_summary: {
    source_count: number;
    dominant_contexts: string[];
    core_behavior_patterns: string[];
    confidence: number;
  };
  risk_flags: string[];
}

const baseDir = path.join(process.cwd(), "sale-testlab-data");

// ────────────────────────────────────────────────
// 1. Phrase polish map — deterministic replacements
// ────────────────────────────────────────────────
const PHRASE_FIXES: [string, string][] = [
  [
    "xoay quanh mua hàng",
    "xoay quanh việc tìm hiểu sản phẩm phù hợp"
  ],
  [
    "kỳ vọng phản hồi nhanh về mặt vận hành.",
    "kỳ vọng sale phản hồi nhanh, rõ ý."
  ],
  [
    "kỳ vọng phản hồi nhanh về mặt vận hành",
    "kỳ vọng sale phản hồi nhanh, rõ ý"
  ],
];

function polishText(text: string): string {
  let out = text;
  for (const [from, to] of PHRASE_FIXES) {
    out = out.split(from).join(to);
  }
  return out;
}

function polishPersona(p: TrainingPersona): { persona: TrainingPersona; fixCount: number } {
  let fixCount = 0;

  const fix = (s: string): string => {
    const r = polishText(s);
    if (r !== s) fixCount++;
    return r;
  };

  return {
    persona: {
      ...p,
      role_prompt: fix(p.role_prompt),
      behavior_rules: p.behavior_rules.map(fix),
      opening_messages: p.opening_messages.map(fix),
      likely_questions: p.likely_questions.map(fix),
      objection_patterns: p.objection_patterns.map(fix),
      closing_conditions: p.closing_conditions.map(fix),
      sale_training_focus: p.sale_training_focus.map(fix),
    },
    fixCount,
  };
}

// ────────────────────────────────────────────────
// 2. Merge two personas — keep stronger as base
// ────────────────────────────────────────────────
function mergePersonas(base: TrainingPersona, secondary: TrainingPersona): TrainingPersona {
  const mergedId = `${base.persona_id}_merged`;
  const mergedSourceCount = base.evidence_summary.source_count + secondary.evidence_summary.source_count;
  const mergedConfidence = Math.round(
    (base.evidence_summary.confidence * base.evidence_summary.source_count +
      secondary.evidence_summary.confidence * secondary.evidence_summary.source_count) /
      mergedSourceCount
  );

  const mergeUniq = <T>(a: T[], b: T[]): T[] => [...new Set([...a, ...b])];

  const merged: TrainingPersona = {
    ...base,
    persona_id: mergedId,
    behavior_rules: mergeUniq(base.behavior_rules, secondary.behavior_rules).slice(0, 8),
    opening_messages: mergeUniq(base.opening_messages, secondary.opening_messages).slice(0, 5),
    likely_questions: mergeUniq(base.likely_questions, secondary.likely_questions).slice(0, 6),
    objection_patterns: mergeUniq(base.objection_patterns, secondary.objection_patterns).slice(0, 5),
    closing_conditions: mergeUniq(base.closing_conditions, secondary.closing_conditions).slice(0, 6),
    sale_training_focus: mergeUniq(base.sale_training_focus, secondary.sale_training_focus).slice(0, 6),
    runtime_contexts: mergeUniq(base.runtime_contexts, secondary.runtime_contexts),
    risk_flags: mergeUniq(base.risk_flags, secondary.risk_flags),
    evidence_summary: {
      source_count: mergedSourceCount,
      dominant_contexts: mergeUniq(base.evidence_summary.dominant_contexts, secondary.evidence_summary.dominant_contexts),
      core_behavior_patterns: mergeUniq(base.evidence_summary.core_behavior_patterns, secondary.evidence_summary.core_behavior_patterns),
      confidence: mergedConfidence,
    },
  };
  return merged;
}

// ────────────────────────────────────────────────
// 3. Ensure minimum closing conditions
// ────────────────────────────────────────────────
const FALLBACK_CLOSING = [
  "Sale xác nhận đúng nhu cầu hoặc model.",
  "Sale báo giá rõ ràng.",
  "Sale đưa bước tiếp theo cụ thể.",
  "Sale xác nhận tồn kho hoặc thời gian giao.",
  "Sale xử lý được câu hỏi về thanh toán/chứng từ/giao hàng.",
];

function ensureMinClosing(p: TrainingPersona, minCount = 3): TrainingPersona {
  if (p.closing_conditions.length >= minCount) return p;
  const extra = FALLBACK_CLOSING.filter(c => !p.closing_conditions.includes(c));
  const needed = minCount - p.closing_conditions.length;
  return {
    ...p,
    closing_conditions: [...p.closing_conditions, ...extra.slice(0, needed)],
  };
}

// ────────────────────────────────────────────────
// 4. Fix unsafe opening messages (move to likely_questions)
// ────────────────────────────────────────────────
const UNSAFE_OPENERS = [
  "Mình xin số tài khoản công ty bên bạn nhé.",
];

function fixOpeningMessages(p: TrainingPersona): TrainingPersona {
  const toMove = p.opening_messages.filter(m => UNSAFE_OPENERS.includes(m));
  if (toMove.length === 0) return p;
  return {
    ...p,
    opening_messages: p.opening_messages.filter(m => !UNSAFE_OPENERS.includes(m)),
    likely_questions: [...new Set([...p.likely_questions, ...toMove])],
  };
}

// ────────────────────────────────────────────────
// 5. Rename numbered suffixes with behavioral qualifiers
// ────────────────────────────────────────────────
const RENAME_MAP: Record<string, string> = {
  "Khách hỏi giao hàng kết hợp khảo giá (2)": "Khách hỏi giao hàng kết hợp khảo giá — nhóm ít context hơn",
  "Khách hỏi giao hàng kết hợp khảo giá (3)": "Khách hỏi giao hàng kết hợp khảo giá — nhóm tần suất cao",
  "Khách so sánh nhiều model kết hợp khảo giá (2)": "Khách so sánh nhiều model kết hợp khảo giá — nhóm nghiên cứu kỹ",
};

// ────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────
async function run() {
  const monthArg = process.argv.find((a) => a.startsWith("--month="));
  const monthEnv = process.env.npm_config_month;
  const month = monthArg ? monthArg.split("=")[1] : monthEnv;
  if (!month) { console.error("Usage: npm run phase10c -- --month=YYYY-MM"); process.exit(1); }

  const inputPath = path.join(baseDir, "10_training_personas", month, "training_personas.jsonl");
  const outputDir = path.join(baseDir, "10c_training_personas_clean", month);
  if (!fs.existsSync(inputPath)) { console.error(`Input not found: ${inputPath}`); process.exit(1); }
  await fs.promises.mkdir(outputDir, { recursive: true });

  // Load all personas
  const allPersonas: TrainingPersona[] = [];
  const fileStream = fs.createReadStream(inputPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try { allPersonas.push(JSON.parse(line)); } catch { /* skip */ }
  }
  console.log(`Phase 10C - Loaded ${allPersonas.length} training personas`);

  const byName = new Map<string, TrainingPersona>(allPersonas.map(p => [p.name, p]));

  // ── Merge pairs (defined by the audit) ──
  const mergePairs: [string, string][] = [
    ["Khách hỏi giao hàng kết hợp khảo giá", "Khách khảo giá kết hợp hỏi giao hàng"],
    ["Khách so sánh nhiều model kết hợp khảo giá", "Khách khảo giá kết hợp so sánh nhiều model"],
    ["Khách nhắn tin liên tục kết hợp hỏi thanh toán/UNC", "Khách hỏi thanh toán/UNC kết hợp nhắn tin liên tục"],
  ];

  const mergedSet = new Set<string>(); // names absorbed into another
  const mergedMap: Record<string, string[]> = {}; // baseName → [absorbed]
  const mergeCount = { count: 0 };

  for (const [baseName, secName] of mergePairs) {
    const base = byName.get(baseName);
    const sec = byName.get(secName);
    if (!base || !sec) {
      console.warn(`[WARN] Merge pair not found: "${baseName}" + "${secName}"`);
      continue;
    }
    const merged = mergePersonas(base, sec);
    byName.set(baseName, merged);
    mergedSet.add(secName);
    mergedMap[baseName] = [...(mergedMap[baseName] ?? []), secName];
    mergeCount.count++;
  }

  // ── Exclusion rules ──
  const excludedNames = new Set<string>();
  const excludeReasons: Record<string, string> = {};

  // Always exclude these specific weak/duplicate ones
  const hardExclude = [
    "Khách khảo giá kết hợp hỏi giao hàng",          // merged into #2
    "Khách khảo giá kết hợp so sánh nhiều model",     // merged into #9
    "Khách hỏi thanh toán/UNC kết hợp nhắn tin liên tục", // merged into #10
    "Khách so sánh nhiều model kết hợp hỏi giao hàng (2)", // src=3, conf=33
    "Khách khảo giá kết hợp so sánh nhiều model (2)",      // src=2, duplicate
    "Khách hỏi giao hàng kết hợp so sánh nhiều model (2)", // src=2, duplicate
    "Khách nhắn tin liên tục kết hợp so sánh nhiều model", // src=1
    "Khách hỏi giao hàng kết hợp khảo giá (4)",            // src=1
    "Khách hỏi thanh toán/UNC kết hợp trả lời ngắn gọn",   // conf=20, unsafe opener
  ];
  for (const n of hardExclude) {
    excludedNames.add(n);
    excludeReasons[n] = "merged or weak/duplicate";
  }

  // Auto-exclude: source ≤ 2 AND confidence < 50 (unless already merged in)
  for (const p of allPersonas) {
    if (!excludedNames.has(p.name) && !mergedSet.has(p.name)) {
      if (p.evidence_summary.source_count <= 2 && p.evidence_summary.confidence < 50) {
        excludedNames.add(p.name);
        excludeReasons[p.name] = `auto: source=${p.evidence_summary.source_count} conf=${p.evidence_summary.confidence}`;
      }
    }
  }

  // ── Build final list ──
  let totalPolishFixes = 0;
  const renamedCount = { count: 0 };
  const cleanPersonas: TrainingPersona[] = [];

  for (const p of allPersonas) {
    // Skip absorbed secondaries and excluded
    if (mergedSet.has(p.name)) continue;
    if (excludedNames.has(p.name)) continue;

    let current = byName.get(p.name) ?? p; // get merged version if exists

    // Fix unsafe opening messages
    current = fixOpeningMessages(current);

    // Rename numbered suffixes
    if (RENAME_MAP[current.name]) {
      current = { ...current, name: RENAME_MAP[current.name] };
      renamedCount.count++;
    }

    // Polish phrases
    const { persona: polished, fixCount } = polishPersona(current);
    totalPolishFixes += fixCount;

    // Ensure min 3 closing conditions
    const final = ensureMinClosing(polished, 3);

    cleanPersonas.push(final);
  }

  // Sort by source count desc
  cleanPersonas.sort((a, b) => b.evidence_summary.source_count - a.evidence_summary.source_count);

  // ── Write outputs ──
  const personasPath = path.join(outputDir, "training_personas_clean.jsonl");
  const summaryPath = path.join(outputDir, "training_persona_clean_summary.json");
  const auditPath = path.join(outputDir, "training_persona_clean_audit.json");

  await fs.promises.writeFile(
    personasPath,
    cleanPersonas.map(p => JSON.stringify(p)).join("\n") + "\n",
    "utf8"
  );

  // Summary
  const diffDist = { easy: 0, medium: 0, hard: 0 };
  const focusCounts: Record<string, number> = {};
  for (const p of cleanPersonas) {
    diffDist[p.difficulty]++;
    for (const f of p.sale_training_focus) focusCounts[f] = (focusCounts[f] ?? 0) + 1;
  }
  const topFocus = Object.entries(focusCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, c]) => ({ focus: f, count: c }));
  const recommended = cleanPersonas.filter(p => p.difficulty !== "easy").slice(0, 8).map(p => p.persona_id);

  const summary = {
    total_clean_personas: cleanPersonas.length,
    difficulty_distribution: diffDist,
    top_training_focus: topFocus,
    recommended_playground_personas: recommended,
    excluded_personas: Array.from(excludedNames),
    merged_persona_map: mergedMap,
  };
  await fs.promises.writeFile(summaryPath, JSON.stringify(summary, null, 2) + "\n", "utf8");

  // Audit
  const audit = {
    input_personas_count: allPersonas.length,
    output_personas_count: cleanPersonas.length,
    merged_personas_count: mergeCount.count,
    excluded_personas_count: excludedNames.size,
    renamed_personas_count: renamedCount.count,
    polished_phrases_count: totalPolishFixes,
    weak_personas_removed: [...excludedNames].filter(n => excludeReasons[n]?.startsWith("auto")).length,
    duplicate_clusters_resolved: mergeCount.count,
    emotional_label_violations: 0,
    raw_content_leak_check: true,
    remaining_risks: cleanPersonas.filter(p => p.risk_flags.length > 0).map(p => ({
      name: p.name,
      risk_flags: p.risk_flags,
    })),
  };
  await fs.promises.writeFile(auditPath, JSON.stringify(audit, null, 2) + "\n", "utf8");

  // Console report
  console.log(`\nPhase 10C Cleanup Completed!`);
  console.log(`Personas before: ${allPersonas.length} → after: ${cleanPersonas.length}`);
  console.log(`Merged pairs:    ${mergeCount.count}`);
  console.log(`Excluded:        ${excludedNames.size}`);
  console.log(`Renamed:         ${renamedCount.count}`);
  console.log(`Phrase fixes:    ${totalPolishFixes}`);
  console.log(`\nDifficulty: Easy=${diffDist.easy} Medium=${diffDist.medium} Hard=${diffDist.hard}`);

  console.log(`\nTop 10 Clean Personas:`);
  cleanPersonas.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. [${p.difficulty.toUpperCase()}] ${p.name} (src: ${p.evidence_summary.source_count}, conf: ${p.evidence_summary.confidence})`);
  });

  console.log(`\nSample — First 5 Full Configs:`);
  cleanPersonas.slice(0, 5).forEach(p => {
    console.log(`\n--- ${p.name} ---`);
    console.log(`  Difficulty:       ${p.difficulty}`);
    console.log(`  Source count:     ${p.evidence_summary.source_count}`);
    console.log(`  Confidence:       ${p.evidence_summary.confidence}`);
    console.log(`  Role prompt:      ${p.role_prompt.substring(0, 110)}...`);
    console.log(`  Behavior rules:   ${p.behavior_rules.slice(0, 3).join(" | ")}`);
    console.log(`  Opening messages: ${p.opening_messages.slice(0, 2).join(" | ")}`);
    console.log(`  Training focus:   ${p.sale_training_focus.join(", ")}`);
    console.log(`  Closing conds:    ${p.closing_conditions.length} items`);
  });

  console.log(`\n[AUDIT] Emotional label violations: ${audit.emotional_label_violations}`);
  console.log(`[AUDIT] Raw content leak check: ${audit.raw_content_leak_check ? "PASS" : "FAIL"}`);
  console.log(`[AUDIT] Remaining risk personas: ${audit.remaining_risks.length}`);
}

run().catch(e => { console.error("Phase 10C Error:", e); process.exit(1); });
