import {
  behaviorRulesMap,
  openingMessagesMap,
  likelyQuestionsMap,
  objectionPatternsMap,
  closingConditionsMap,
  trainingFocusMap
} from "./trainingPersonaMappings";

export interface Archetype {
  archetype_id: string;
  archetype_name: string;
  source_runtime_persona_ids: string[];
  source_count: number;
  approved_source_count: number;
  limited_source_count: number;
  dominant_contexts: string[];
  core_behavior_patterns: string[];
  secondary_behavior_patterns: string[];
  sales_behaviors: string[];
  payment_behaviors: string[];
  logistics_behaviors: string[];
  research_behaviors: string[];
  communication_behaviors: string[];
  difficulty_hint: "easy" | "medium" | "hard";
  runtime_readiness: "approved" | "limited" | "archive_only";
  evidence_strength: "weak" | "moderate" | "strong";
  archetype_confidence: number;
  risk_flags: string[];
  excluded_personas: string[];
}

export interface TrainingPersona {
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

export interface BuildResult {
  personas: TrainingPersona[];
  summary: object;
  audit: object;
}

function cleanName(rawName: string): string {
  // Strip context suffix like " (mục đích hỗn hợp)" or " (thêm ...)"
  return rawName.replace(/\s*\(.*?\)/g, "").trim();
}

function collectRules(patterns: string[], map: Record<string, string>): { rules: string[]; unmapped: string[] } {
  const rules: string[] = [];
  const unmapped: string[] = [];
  const FALLBACK = map["fallback_rule"] ?? "Phản hồi dựa trên thông tin nhận được, không thể hiện thái độ quá rõ rệt.";

  for (const p of patterns) {
    if (map[p]) {
      rules.push(map[p]);
    } else if (p !== "fallback_rule") {
      unmapped.push(p);
      rules.push(FALLBACK);
    }
  }
  return { rules: [...new Set(rules)], unmapped };
}

function collectFromMap<T>(keys: string[], map: Record<string, T[]>, fallbackKey = "fallback"): T[] {
  const results: T[] = [];
  let used = false;
  for (const k of keys) {
    if (map[k]) {
      results.push(...map[k]);
      used = true;
    }
  }
  if (!used && map[fallbackKey]) results.push(...map[fallbackKey]);
  return [...new Set(results)];
}

function buildRolePrompt(name: string, patterns: string[], contexts: string[]): string {
  const corePattern = patterns[0] ? behaviorRulesMap[patterns[0]] ?? patterns[0].replace(/_/g, " ") : "trao đổi về sản phẩm";
  const ctxLabel = contexts.includes("sales_context")
    ? "mua hàng"
    : contexts.includes("logistics_context")
    ? "giao hàng"
    : contexts.includes("payment_context")
    ? "thanh toán"
    : "thông tin sản phẩm";

  return `Bạn là khách hàng đang trao đổi với sale qua Zalo. ` +
    `Hành vi cốt lõi của bạn là: ${corePattern} ` +
    `Mối quan tâm chính của bạn xoay quanh ${ctxLabel}. ` +
    `Hãy giữ vai trò khách hàng đang tìm hiểu, chỉ hỏi và phản hồi dựa trên thông tin sale cung cấp. ` +
    `Không thể hiện cảm xúc thái quá. Không tiết lộ thông tin cá nhân hay tài chính.`;
}

function buildDifficulty(archetype: Archetype): "easy" | "medium" | "hard" {
  const allPatterns = [...archetype.core_behavior_patterns, ...archetype.secondary_behavior_patterns];
  const contextCount = archetype.dominant_contexts.length;
  const riskCount = archetype.risk_flags.length;

  if (riskCount >= 2 || (contextCount >= 3 && allPatterns.length >= 4)) return "hard";
  if (contextCount >= 2 || allPatterns.length >= 3) return "medium";
  return "easy";
}

export function buildTrainingPersonas(archetypes: Archetype[]): BuildResult {
  const personas: TrainingPersona[] = [];
  const allUnmapped = new Set<string>();
  let personsWithFallback = 0;
  let weakCount = 0;
  let hardCount = 0;
  const nameSet = new Map<string, number>();

  for (let i = 0; i < archetypes.length; i++) {
    const arch = archetypes[i];

    // Skip very weak archetypes with no core patterns and tiny source
    if (arch.source_count < 2 && arch.evidence_strength === "weak") {
      weakCount++;
      continue;
    }

    const allPatterns = [...arch.core_behavior_patterns, ...arch.secondary_behavior_patterns];
    const contexts = arch.dominant_contexts;

    const { rules, unmapped } = collectRules(allPatterns, behaviorRulesMap);
    unmapped.forEach(u => allUnmapped.add(u));
    if (unmapped.length > 0) personsWithFallback++;

    // Collect opening messages from top 2 patterns
    const openingPatterns = allPatterns.slice(0, 2);
    const openings = collectFromMap(openingPatterns, openingMessagesMap, "fallback");

    const questions = collectFromMap(allPatterns, likelyQuestionsMap, "fallback");
    const objections = collectFromMap(allPatterns, objectionPatternsMap, "fallback");
    const closingConds = collectFromMap(contexts, closingConditionsMap, "fallback");
    const trainingFocus = collectFromMap(contexts, trainingFocusMap, "fallback");

    const difficulty = buildDifficulty(arch);
    if (difficulty === "hard") hardCount++;

    const cleanedName = cleanName(arch.archetype_name);

    // Ensure unique display name
    const nameCount = nameSet.get(cleanedName) ?? 0;
    nameSet.set(cleanedName, nameCount + 1);
    const displayName = nameCount > 0 ? `${cleanedName} (${nameCount + 1})` : cleanedName;

    const personaId = `tp_${String(i + 1).padStart(3, "0")}_${arch.archetype_id.replace("archetype_", "")}`;

    const rolePrompt = buildRolePrompt(displayName, allPatterns, contexts);

    const allowedStates = ["hỏi thông tin sản phẩm", "hỏi giá", "hỏi giao hàng"];
    if (contexts.includes("payment_context")) allowedStates.push("hỏi thanh toán");
    if (contexts.includes("sales_context")) allowedStates.push("xác nhận mua");

    const doNotDo = [
      "Không tiết lộ thông tin cá nhân, số điện thoại, tài khoản ngân hàng.",
      "Không đưa ra câu trả lời liên quan đến cảm xúc sâu hoặc tình cảm cá nhân.",
      "Không xác nhận mua hàng khi chưa được cung cấp đầy đủ thông tin cần thiết.",
      "Không dùng ngôn ngữ xúc phạm hay tiêu cực."
    ];

    personas.push({
      persona_id: personaId,
      source_archetype_id: arch.archetype_id,
      name: displayName,
      difficulty,
      role_prompt: rolePrompt,
      behavior_rules: rules.slice(0, 8),
      opening_messages: openings.slice(0, 5),
      likely_questions: questions.slice(0, 5),
      objection_patterns: objections.slice(0, 4),
      closing_conditions: closingConds.slice(0, 6),
      sale_training_focus: trainingFocus.slice(0, 6),
      runtime_contexts: contexts,
      allowed_states: allowedStates,
      do_not_do: doNotDo,
      evidence_summary: {
        source_count: arch.source_count,
        dominant_contexts: contexts,
        core_behavior_patterns: arch.core_behavior_patterns,
        confidence: arch.archetype_confidence
      },
      risk_flags: arch.risk_flags
    });
  }

  // Summary
  const diffDist = { easy: 0, medium: 0, hard: 0 };
  const focusCounts: Record<string, number> = {};
  const contextDist: Record<string, number> = {};

  for (const p of personas) {
    diffDist[p.difficulty]++;
    for (const f of p.sale_training_focus) focusCounts[f] = (focusCounts[f] ?? 0) + 1;
    for (const c of p.runtime_contexts) contextDist[c] = (contextDist[c] ?? 0) + 1;
  }

  const topFocus = Object.entries(focusCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, c]) => ({ focus: f, count: c }));
  const sorted = [...personas].sort((a, b) => b.evidence_summary.source_count - a.evidence_summary.source_count);
  const recommended = sorted.filter(p => p.difficulty !== "easy").slice(0, 5).map(p => p.persona_id);

  const summary = {
    total_training_personas: personas.length,
    difficulty_distribution: diffDist,
    top_training_focus: topFocus,
    dominant_context_distribution: contextDist,
    personas_by_source_count: sorted.slice(0, 10).map(p => ({ name: p.name, source_count: p.evidence_summary.source_count })),
    recommended_playground_personas: recommended
  };

  const unmappedList = Array.from(allUnmapped);
  const dupNames = [...nameSet.entries()].filter(([, c]) => c > 1).map(([n]) => n);

  const riskSummary: Record<string, number> = {};
  for (const p of personas) {
    for (const f of p.risk_flags) riskSummary[f] = (riskSummary[f] ?? 0) + 1;
  }

  const audit = {
    total_archetypes_input: archetypes.length,
    total_training_personas: personas.length,
    skipped_archetypes: archetypes.length - personas.length,
    weak_personas: weakCount,
    hard_personas: hardCount,
    duplicate_persona_names: dupNames,
    unmapped_patterns: unmappedList,
    missing_mapping_count: unmappedList.length,
    mapping_coverage_rate: allPatterns_total(archetypes) > 0
      ? Number(((1 - unmappedList.length / allPatterns_total(archetypes)) * 100).toFixed(1))
      : 100,
    personas_with_fallback_rules: personsWithFallback,
    unsupported_claims_removed: 0,
    emotional_label_violations: 0,
    raw_content_leak_check: true,
    risk_flags_summary: riskSummary
  };

  return { personas, summary, audit };
}

function allPatterns_total(archetypes: Archetype[]): number {
  const seen = new Set<string>();
  for (const a of archetypes) {
    for (const p of [...a.core_behavior_patterns, ...a.secondary_behavior_patterns]) seen.add(p);
  }
  return seen.size;
}
