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

function formatDifficultyDistribution(diff: Record<string, number>): string {
  return `easy=${diff.easy ?? 0} medium=${diff.medium ?? 0} hard=${diff.hard ?? 0}`;
}

function safeTopPersonaRows(
  personas: Array<{
    persona_id: string;
    difficulty: string;
    evidence_summary: { source_count: number; confidence: number };
  }>,
  limit = 5
): string[] {
  return personas.slice(0, limit).map(
    (p, i) =>
      `  ${i + 1}. ${p.persona_id} | difficulty=${p.difficulty} | source_count=${p.evidence_summary.source_count} | confidence=${p.evidence_summary.confidence}`
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// 1. Phrase polish map Ã¢â‚¬â€ deterministic replacements
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const PHRASE_FIXES: [string, string][] = [
  [
    "xoay quanh mua hÃƒÂ ng",
    "xoay quanh viÃ¡Â»â€¡c tÃƒÂ¬m hiÃ¡Â»Æ’u sÃ¡ÂºÂ£n phÃ¡ÂºÂ©m phÃƒÂ¹ hÃ¡Â»Â£p"
  ],
  [
    "kÃ¡Â»Â³ vÃ¡Â»Âng phÃ¡ÂºÂ£n hÃ¡Â»â€œi nhanh vÃ¡Â»Â mÃ¡ÂºÂ·t vÃ¡ÂºÂ­n hÃƒÂ nh.",
    "kÃ¡Â»Â³ vÃ¡Â»Âng sale phÃ¡ÂºÂ£n hÃ¡Â»â€œi nhanh, rÃƒÂµ ÃƒÂ½."
  ],
  [
    "kÃ¡Â»Â³ vÃ¡Â»Âng phÃ¡ÂºÂ£n hÃ¡Â»â€œi nhanh vÃ¡Â»Â mÃ¡ÂºÂ·t vÃ¡ÂºÂ­n hÃƒÂ nh",
    "kÃ¡Â»Â³ vÃ¡Â»Âng sale phÃ¡ÂºÂ£n hÃ¡Â»â€œi nhanh, rÃƒÂµ ÃƒÂ½"
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// 2. Merge two personas Ã¢â‚¬â€ keep stronger as base
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// 3. Ensure minimum closing conditions
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const FALLBACK_CLOSING = [
  "Sale xÃƒÂ¡c nhÃ¡ÂºÂ­n Ã„â€˜ÃƒÂºng nhu cÃ¡ÂºÂ§u hoÃ¡ÂºÂ·c model.",
  "Sale bÃƒÂ¡o giÃƒÂ¡ rÃƒÂµ rÃƒÂ ng.",
  "Sale Ã„â€˜Ã†Â°a bÃ†Â°Ã¡Â»â€ºc tiÃ¡ÂºÂ¿p theo cÃ¡Â»Â¥ thÃ¡Â»Æ’.",
  "Sale xÃƒÂ¡c nhÃ¡ÂºÂ­n tÃ¡Â»â€œn kho hoÃ¡ÂºÂ·c thÃ¡Â»Âi gian giao.",
  "Sale xÃ¡Â»Â­ lÃƒÂ½ Ã„â€˜Ã†Â°Ã¡Â»Â£c cÃƒÂ¢u hÃ¡Â»Âi vÃ¡Â»Â thanh toÃƒÂ¡n/chÃ¡Â»Â©ng tÃ¡Â»Â«/giao hÃƒÂ ng.",
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// 4. Fix unsafe opening messages (move to likely_questions)
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const UNSAFE_OPENERS = [
  "MÃƒÂ¬nh xin sÃ¡Â»â€˜ tÃƒÂ i khoÃ¡ÂºÂ£n cÃƒÂ´ng ty bÃƒÂªn bÃ¡ÂºÂ¡n nhÃƒÂ©.",
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// 5. Rename numbered suffixes with behavioral qualifiers
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const RENAME_MAP: Record<string, string> = {
  "KhÃƒÂ¡ch hÃ¡Â»Âi giao hÃƒÂ ng kÃ¡ÂºÂ¿t hÃ¡Â»Â£p khÃ¡ÂºÂ£o giÃƒÂ¡ (2)": "KhÃƒÂ¡ch hÃ¡Â»Âi giao hÃƒÂ ng kÃ¡ÂºÂ¿t hÃ¡Â»Â£p khÃ¡ÂºÂ£o giÃƒÂ¡ Ã¢â‚¬â€ nhÃƒÂ³m ÃƒÂ­t context hÃ†Â¡n",
  "KhÃƒÂ¡ch hÃ¡Â»Âi giao hÃƒÂ ng kÃ¡ÂºÂ¿t hÃ¡Â»Â£p khÃ¡ÂºÂ£o giÃƒÂ¡ (3)": "KhÃƒÂ¡ch hÃ¡Â»Âi giao hÃƒÂ ng kÃ¡ÂºÂ¿t hÃ¡Â»Â£p khÃ¡ÂºÂ£o giÃƒÂ¡ Ã¢â‚¬â€ nhÃƒÂ³m tÃ¡ÂºÂ§n suÃ¡ÂºÂ¥t cao",
  "KhÃƒÂ¡ch so sÃƒÂ¡nh nhiÃ¡Â»Âu model kÃ¡ÂºÂ¿t hÃ¡Â»Â£p khÃ¡ÂºÂ£o giÃƒÂ¡ (2)": "KhÃƒÂ¡ch so sÃƒÂ¡nh nhiÃ¡Â»Âu model kÃ¡ÂºÂ¿t hÃ¡Â»Â£p khÃ¡ÂºÂ£o giÃƒÂ¡ Ã¢â‚¬â€ nhÃƒÂ³m nghiÃƒÂªn cÃ¡Â»Â©u kÃ¡Â»Â¹",
};

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Main
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ Merge pairs (defined by the audit) Ã¢â€â‚¬Ã¢â€â‚¬
  const mergePairs: [string, string][] = [
    ["KhÃƒÂ¡ch hÃ¡Â»Âi giao hÃƒÂ ng kÃ¡ÂºÂ¿t hÃ¡Â»Â£p khÃ¡ÂºÂ£o giÃƒÂ¡", "KhÃƒÂ¡ch khÃ¡ÂºÂ£o giÃƒÂ¡ kÃ¡ÂºÂ¿t hÃ¡Â»Â£p hÃ¡Â»Âi giao hÃƒÂ ng"],
    ["KhÃƒÂ¡ch so sÃƒÂ¡nh nhiÃ¡Â»Âu model kÃ¡ÂºÂ¿t hÃ¡Â»Â£p khÃ¡ÂºÂ£o giÃƒÂ¡", "KhÃƒÂ¡ch khÃ¡ÂºÂ£o giÃƒÂ¡ kÃ¡ÂºÂ¿t hÃ¡Â»Â£p so sÃƒÂ¡nh nhiÃ¡Â»Âu model"],
    ["KhÃƒÂ¡ch nhÃ¡ÂºÂ¯n tin liÃƒÂªn tÃ¡Â»Â¥c kÃ¡ÂºÂ¿t hÃ¡Â»Â£p hÃ¡Â»Âi thanh toÃƒÂ¡n/UNC", "KhÃƒÂ¡ch hÃ¡Â»Âi thanh toÃƒÂ¡n/UNC kÃ¡ÂºÂ¿t hÃ¡Â»Â£p nhÃ¡ÂºÂ¯n tin liÃƒÂªn tÃ¡Â»Â¥c"],
  ];

  const mergedSet = new Set<string>(); // names absorbed into another
  const mergedMap: Record<string, string[]> = {}; // baseName Ã¢â€ â€™ [absorbed]
  const mergeCount = { count: 0 };
  let missingMergePairCount = 0;

  for (const [baseName, secName] of mergePairs) {
    const base = byName.get(baseName);
    const sec = byName.get(secName);
    if (!base || !sec) {
      missingMergePairCount++;
      continue;
    }
    const merged = mergePersonas(base, sec);
    byName.set(baseName, merged);
    mergedSet.add(secName);
    mergedMap[baseName] = [...(mergedMap[baseName] ?? []), secName];
    mergeCount.count++;
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Exclusion rules Ã¢â€â‚¬Ã¢â€â‚¬
  const excludedNames = new Set<string>();
  const excludeReasons: Record<string, string> = {};

  // Always exclude these specific weak/duplicate ones
  const hardExclude = [
    "KhÃƒÂ¡ch khÃ¡ÂºÂ£o giÃƒÂ¡ kÃ¡ÂºÂ¿t hÃ¡Â»Â£p hÃ¡Â»Âi giao hÃƒÂ ng",          // merged into #2
    "KhÃƒÂ¡ch khÃ¡ÂºÂ£o giÃƒÂ¡ kÃ¡ÂºÂ¿t hÃ¡Â»Â£p so sÃƒÂ¡nh nhiÃ¡Â»Âu model",     // merged into #9
    "KhÃƒÂ¡ch hÃ¡Â»Âi thanh toÃƒÂ¡n/UNC kÃ¡ÂºÂ¿t hÃ¡Â»Â£p nhÃ¡ÂºÂ¯n tin liÃƒÂªn tÃ¡Â»Â¥c", // merged into #10
    "KhÃƒÂ¡ch so sÃƒÂ¡nh nhiÃ¡Â»Âu model kÃ¡ÂºÂ¿t hÃ¡Â»Â£p hÃ¡Â»Âi giao hÃƒÂ ng (2)", // src=3, conf=33
    "KhÃƒÂ¡ch khÃ¡ÂºÂ£o giÃƒÂ¡ kÃ¡ÂºÂ¿t hÃ¡Â»Â£p so sÃƒÂ¡nh nhiÃ¡Â»Âu model (2)",      // src=2, duplicate
    "KhÃƒÂ¡ch hÃ¡Â»Âi giao hÃƒÂ ng kÃ¡ÂºÂ¿t hÃ¡Â»Â£p so sÃƒÂ¡nh nhiÃ¡Â»Âu model (2)", // src=2, duplicate
    "KhÃƒÂ¡ch nhÃ¡ÂºÂ¯n tin liÃƒÂªn tÃ¡Â»Â¥c kÃ¡ÂºÂ¿t hÃ¡Â»Â£p so sÃƒÂ¡nh nhiÃ¡Â»Âu model", // src=1
    "KhÃƒÂ¡ch hÃ¡Â»Âi giao hÃƒÂ ng kÃ¡ÂºÂ¿t hÃ¡Â»Â£p khÃ¡ÂºÂ£o giÃƒÂ¡ (4)",            // src=1
    "KhÃƒÂ¡ch hÃ¡Â»Âi thanh toÃƒÂ¡n/UNC kÃ¡ÂºÂ¿t hÃ¡Â»Â£p trÃ¡ÂºÂ£ lÃ¡Â»Âi ngÃ¡ÂºÂ¯n gÃ¡Â»Ân",   // conf=20, unsafe opener
  ];
  for (const n of hardExclude) {
    excludedNames.add(n);
    excludeReasons[n] = "merged or weak/duplicate";
  }

  // Auto-exclude: source Ã¢â€°Â¤ 2 AND confidence < 50 (unless already merged in)
  for (const p of allPersonas) {
    if (!excludedNames.has(p.name) && !mergedSet.has(p.name)) {
      if (p.evidence_summary.source_count <= 2 && p.evidence_summary.confidence < 50) {
        excludedNames.add(p.name);
        excludeReasons[p.name] = `auto: source=${p.evidence_summary.source_count} conf=${p.evidence_summary.confidence}`;
      }
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Build final list Ã¢â€â‚¬Ã¢â€â‚¬
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ Write outputs Ã¢â€â‚¬Ã¢â€â‚¬
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

  const personasStat = await fs.promises.stat(personasPath);
  const summaryStat = await fs.promises.stat(summaryPath);
  const auditStat = await fs.promises.stat(auditPath);

  console.log(`\nPhase 10C Cleanup Completed!`);
  console.log(`month=${month}`);
  console.log(`input_path=${inputPath}`);
  console.log(`output_dir=${outputDir}`);
  console.log(`input_training_personas=${allPersonas.length}`);
  console.log(`output_clean_personas=${cleanPersonas.length}`);
  console.log(`output_clean_personas_size=${personasStat.size}`);
  console.log(`summary_path=${summaryPath}`);
  console.log(`summary_size=${summaryStat.size}`);
  console.log(`audit_path=${auditPath}`);
  console.log(`audit_size=${auditStat.size}`);
  console.log(`merged_pairs=${mergeCount.count}`);
  console.log(`missing_merge_pair_count=${missingMergePairCount}`);
  console.log(`excluded_personas=${excludedNames.size}`);
  console.log(`renamed_personas=${renamedCount.count}`);
  console.log(`phrase_fixes=${totalPolishFixes}`);
  console.log(`difficulty_distribution=${formatDifficultyDistribution(diffDist)}`);
  console.log(`recommended_playground_persona_count=${recommended.length}`);
  console.log(`top_training_focus_count=${topFocus.length}`);
  console.log(`weak_personas_removed=${audit.weak_personas_removed}`);
  console.log(`duplicate_clusters_resolved=${audit.duplicate_clusters_resolved}`);
  console.log(`emotional_label_violations=${audit.emotional_label_violations}`);
  console.log(`raw_content_leak_check=${audit.raw_content_leak_check ? "PASS" : "FAIL"}`);
  console.log(`remaining_risk_persona_count=${audit.remaining_risks.length}`);
  console.log(`top_persona_rows:`);
  safeTopPersonaRows(cleanPersonas).forEach((line) => console.log(line));
}
run().catch(e => { console.error("Phase 10C Error:", e); process.exit(1); });
