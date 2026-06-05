import { RuntimeState } from "./runtimeConstraints";

export interface RuntimeStateRouterInput {
  latestSaleMessage: string;
  recentMessages: string[];
  selectedPersona?: {
    runtime_behavior_profile?: {
      research_behavior?: string[];
      pricing_behavior?: string[];
      payment_behavior?: string[];
      logistics_behavior?: string[];
    };
  };
  debugOverrideState?: string;
  product_context_status?: string; // Phase 12H.1-C
}

export interface RuntimeStateRouterOutput {
  runtime_state: RuntimeState;
  confidence: number;
  matched_rules: string[];
  fallback_reason?: string;
}

const ORDER: RuntimeState[] = [
  "pricing_phase",
  "logistics_phase",
  "payment_phase",
  "research_phase",
  "uncertain_interest",
  "operational_followup"
];

const RULES: Record<RuntimeState, string[]> = {
  pricing_phase: [
    "gia",
    "bao gia",
    "gia tot",
    "fix gia",
    "giam them",
    "mac",
    "re",
    "ben kia bao",
    "deal"
  ],
  logistics_phase: [
    "giao",
    "giao hang",
    "van chuyen",
    "kho",
    "con hang",
    "het hang",
    "lich giao",
    "may gio giao",
    "giao hom nay"
  ],
  payment_phase: [
    "chuyen khoan",
    "thanh toan",
    "bill",
    "unc",
    "coc",
    "tien",
    "anh chuyen",
    "em check",
    "check giup anh"
  ],
  research_phase: [
    "tu van",
    "cau hinh",
    "bao hanh",
    "so sanh",
    "khac gi",
    "dong nao",
    "model",
    "nhu cau",
    "dung van phong",
    "choi game"
  ],
  uncertain_interest: [
    "xem thu",
    "tham khao",
    "chua biet",
    "phan van",
    "de anh xem",
    "chua chot",
    "can nhac"
  ],
  operational_followup: ["tod", "cod", "duyet phieu", "ma khach", "don hang"],
  passive_followup: []
};

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPersonaFallbackState(input: RuntimeStateRouterInput): RuntimeState {
  const b = input.selectedPersona?.runtime_behavior_profile;
  if ((b?.pricing_behavior?.length ?? 0) > 0) return "pricing_phase";
  if ((b?.logistics_behavior?.length ?? 0) > 0) return "logistics_phase";
  if ((b?.payment_behavior?.length ?? 0) > 0) return "payment_phase";
  if ((b?.research_behavior?.length ?? 0) > 0) return "research_phase";
  return "uncertain_interest";
}

function countMatches(text: string, patterns: string[]): string[] {
  const hits: string[] = [];
  for (const p of patterns) {
    if (text.includes(p)) hits.push(p);
  }
  return hits;
}

export function routeRuntimeState(input: RuntimeStateRouterInput): RuntimeStateRouterOutput {
  const override = (input.debugOverrideState || "").trim();
  if (override && override !== "auto_state") {
    return {
      runtime_state: override as RuntimeState,
      confidence: 1,
      matched_rules: ["debug_override_state"]
    };
  }

  const latest = normalizeForMatch(input.latestSaleMessage || "");
  const recent = (input.recentMessages || [])
    .slice(-3)
    .map((m) => normalizeForMatch(m))
    .join(" | ");

  const score: Record<RuntimeState, number> = {
    pricing_phase: 0,
    logistics_phase: 0,
    payment_phase: 0,
    research_phase: 0,
    uncertain_interest: 0,
    operational_followup: 0,
    passive_followup: 0
  };
  const matched: string[] = [];

  for (const state of ORDER) {
    const latestHits = countMatches(latest, RULES[state] || []);
    const recentHits = countMatches(recent, RULES[state] || []);
    if (latestHits.length > 0) {
      score[state] += latestHits.length * 0.28;
      latestHits.forEach((h) => matched.push(`latest:${state}:${h}`));
    }
    if (latest.length <= 15 && recentHits.length > 0) {
      score[state] += recentHits.length * 0.14;
      recentHits.forEach((h) => matched.push(`context:${state}:${h}`));
    }
  }

  const sorted = [...ORDER].sort((a, b) => score[b] - score[a]);
  let best = sorted[0];
  let bestScore = score[best];
  let matchedRules = matched.filter((m) => m.includes(`:${best}:`));
  let isFallback = false;

  if (bestScore === 0) {
    best = getPersonaFallbackState(input);
    isFallback = true;
  }

  // Phase 12H.1-C Product Context Routing Gates
  const status = input.product_context_status;
  if (status === "unknown") {
    if (best === "pricing_phase" || best === "payment_phase" || best === "logistics_phase" || best === "operational_followup") {
      const oldState = best;
      best = score["uncertain_interest"] > 0 ? "uncertain_interest" : "research_phase";
      matchedRules = [`product_context_unknown_gate_override_from_${oldState}`];
    }
  } else if (status === "vague") {
    if (best === "payment_phase") {
      const oldState = best;
      best = score["pricing_phase"] > 0 || score["research_phase"] > 0
        ? (score["pricing_phase"] >= score["research_phase"] ? "pricing_phase" : "research_phase")
        : "pricing_phase";
      matchedRules = [`product_context_vague_gate_override_from_${oldState}`];
    }
  }

  return {
    runtime_state: best,
    confidence: isFallback ? 0.4 : Number(Math.min(0.98, 0.5 + bestScore).toFixed(2)),
    matched_rules: matchedRules,
    fallback_reason: isFallback ? "no_keyword_match_use_persona_default" : undefined
  };
}

export { normalizeForMatch };
