export interface RefinedTendency {
  tendency_name: string;
  confidence: number;
  stability: "weak" | "moderate" | "strong";
  runtime_priority: "low" | "medium" | "high";
  supporting_patterns: string[];
  supporting_relationships: string[];
  reasoning: string;
}

export interface RefinedPersona {
  entity_id: string;
  runtime_profile_version: "refined_v1";
  runtime_usefulness_score: number;
  evidence_quality: "weak" | "moderate" | "strong";
  dominant_contexts: string[];
  refined_tendencies: RefinedTendency[];
  communication_runtime_profile: {
    reply_style_patterns: string[];
    interaction_pacing_patterns: string[];
    operational_coordination_patterns: string[];
  };
  sales_runtime_profile: {
    research_patterns: string[];
    price_patterns: string[];
    payment_patterns: string[];
    logistics_patterns: string[];
  };
  operational_constraints: string[];
  runtime_risk_flags: string[];
  removed_tendencies: Array<{ tendency_name: string; reason: string }>;
}

export interface RuntimeInteractionPattern {
  pattern_name: string;
  priority: "low" | "medium" | "high";
  stability: "weak" | "moderate" | "strong";
  runtime_weight: number;
  supporting_evidence: string[];
}

export interface RuntimePersona {
  runtime_persona_id: string;
  source_entity_id: string;
  runtime_version: "runtime_v1";
  runtime_readiness: "approved" | "limited" | "archive_only";
  runtime_usefulness_score: number;
  primary_contexts: string[];
  runtime_behavior_profile: {
    research_behavior: string[];
    pricing_behavior: string[];
    payment_behavior: string[];
    logistics_behavior: string[];
    communication_behavior: string[];
  };
  interaction_patterns: RuntimeInteractionPattern[];
  conversation_constraints: string[];
  allowed_runtime_usage: {
    sales_training: boolean;
    customer_simulation: boolean;
    objection_training: boolean;
    negotiation_training: boolean;
  };
  risk_flags: string[];
}

export interface RuntimePersonaSummary {
  total_runtime_personas: number;
  approved_runtime_personas: number;
  limited_runtime_personas: number;
  archive_only_personas: number;
  high_usefulness_personas: number;
  sales_training_ready: number;
  customer_simulation_ready: number;
  top_runtime_patterns: Array<{ pattern_name: string; count: number }>;
  excluded_profiles: number;
}

export interface RuntimePersonaAudit {
  weak_profiles_excluded: number;
  operational_only_profiles_excluded: number;
  timing_noise_profiles_excluded: number;
  unsupported_runtime_claims_removed: number;
  runtime_risk_profiles: number;
  overweighted_patterns_detected: number;
  risk_flags_summary: Record<string, number>;
}

interface BuildStats {
  weakExcluded: number;
  opOnlyExcluded: number;
  timingExcluded: number;
  unsupportedRemoved: number;
  overweightDetected: number;
}

function incr(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function buildPersonaId(entityId: string): string {
  return `rp_${entityId.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase()}`;
}

function hasStableTendency(p: RefinedPersona): boolean {
  return p.refined_tendencies.some((t) => t.stability === "strong" || t.stability === "moderate");
}

function hasBehaviorCoverage(p: RefinedPersona): boolean {
  const s = p.sales_runtime_profile;
  const nonEmpty =
    s.research_patterns.length +
    s.price_patterns.length +
    s.payment_patterns.length +
    s.logistics_patterns.length;
  return nonEmpty > 0;
}

function hasTimingNoiseOnly(p: RefinedPersona): boolean {
  if (p.refined_tendencies.length === 0) return false;
  return p.refined_tendencies.every(
    (t) =>
      t.tendency_name.includes("reengagement") ||
      (t.runtime_priority === "low" && t.tendency_name.includes("short_operational_response"))
  );
}

function determineReadiness(p: RefinedPersona, stats: BuildStats): RuntimePersona["runtime_readiness"] {
  const hasOpOnly = p.runtime_risk_flags.includes("operational_only_profile");
  const hasWeak = p.evidence_quality === "weak" || p.runtime_risk_flags.includes("weak_evidence_persona");
  const timingOnly = hasTimingNoiseOnly(p);
  const hasStable = hasStableTendency(p);
  const covered = hasBehaviorCoverage(p);

  if (hasWeak || timingOnly || hasOpOnly || !hasStable || !covered) {
    if (hasWeak) stats.weakExcluded += 1;
    if (timingOnly) stats.timingExcluded += 1;
    if (hasOpOnly) stats.opOnlyExcluded += 1;
    return "archive_only";
  }

  if (
    p.runtime_usefulness_score >= 65 &&
    (p.evidence_quality === "strong" || p.evidence_quality === "moderate") &&
    !p.runtime_risk_flags.includes("insufficient_sales_evidence")
  ) {
    return "approved";
  }

  return "limited";
}

function mapCommunicationBehavior(p: RefinedPersona): string[] {
  const out: string[] = [];
  out.push(...p.communication_runtime_profile.reply_style_patterns);
  out.push(...p.communication_runtime_profile.interaction_pacing_patterns);
  out.push(...p.communication_runtime_profile.operational_coordination_patterns);
  return uniq(out);
}

function patternWeight(t: RefinedTendency): number {
  let w = 0.2;
  if (t.runtime_priority === "high") w += 0.35;
  else if (t.runtime_priority === "medium") w += 0.2;
  else w += 0.08;

  if (t.stability === "strong") w += 0.3;
  else if (t.stability === "moderate") w += 0.18;
  else w += 0.08;

  w += Math.min(0.15, t.confidence * 0.15);
  return Math.max(0.05, Math.min(1, Number(w.toFixed(4))));
}

function buildInteractionPatterns(p: RefinedPersona, stats: BuildStats): RuntimeInteractionPattern[] {
  const patterns: RuntimeInteractionPattern[] = [];
  for (const t of p.refined_tendencies) {
    if (t.runtime_priority === "low" && t.tendency_name.includes("reengagement")) {
      stats.unsupportedRemoved += 1;
      continue;
    }
    const weight = patternWeight(t);
    if (weight > 0.95) stats.overweightDetected += 1;
    patterns.push({
      pattern_name: t.tendency_name,
      priority: t.runtime_priority,
      stability: t.stability,
      runtime_weight: weight,
      supporting_evidence: uniq(t.supporting_relationships.slice(0, 12))
    });
  }
  return patterns.sort((a, b) => b.runtime_weight - a.runtime_weight);
}

function buildConstraints(p: RefinedPersona): string[] {
  const base = [
    "avoid emotional inference",
    "avoid unsupported confidence escalation",
    "maintain operational realism",
    "enforce evidence-bound responses"
  ];
  if (p.runtime_risk_flags.includes("insufficient_sales_evidence")) {
    base.push("limit aggressive sales negotiation scenarios");
  }
  if (p.runtime_risk_flags.some((f) => f.includes("contradiction"))) {
    base.push("prefer conservative pacing assumptions");
  }
  return uniq(base);
}

function buildUsage(readiness: RuntimePersona["runtime_readiness"]): RuntimePersona["allowed_runtime_usage"] {
  if (readiness === "approved") {
    return {
      sales_training: true,
      customer_simulation: true,
      objection_training: false,
      negotiation_training: false
    };
  }
  if (readiness === "limited") {
    return {
      sales_training: true,
      customer_simulation: false,
      objection_training: false,
      negotiation_training: false
    };
  }
  return {
    sales_training: false,
    customer_simulation: false,
    objection_training: false,
    negotiation_training: false
  };
}

function toRuntimePersona(p: RefinedPersona, stats: BuildStats): RuntimePersona {
  const readiness = determineReadiness(p, stats);
  const interactionPatterns = buildInteractionPatterns(p, stats);

  return {
    runtime_persona_id: buildPersonaId(p.entity_id),
    source_entity_id: p.entity_id,
    runtime_version: "runtime_v1",
    runtime_readiness: readiness,
    runtime_usefulness_score: p.runtime_usefulness_score,
    primary_contexts: p.dominant_contexts,
    runtime_behavior_profile: {
      research_behavior: uniq(p.sales_runtime_profile.research_patterns),
      pricing_behavior: uniq(p.sales_runtime_profile.price_patterns),
      payment_behavior: uniq(p.sales_runtime_profile.payment_patterns),
      logistics_behavior: uniq(p.sales_runtime_profile.logistics_patterns),
      communication_behavior: mapCommunicationBehavior(p)
    },
    interaction_patterns: interactionPatterns,
    conversation_constraints: buildConstraints(p),
    allowed_runtime_usage: buildUsage(readiness),
    risk_flags: uniq(p.runtime_risk_flags)
  };
}

export function buildRuntimePersonas(
  refined: RefinedPersona[]
): {
  runtimePersonas: RuntimePersona[];
  summary: RuntimePersonaSummary;
  audit: RuntimePersonaAudit;
} {
  const stats: BuildStats = {
    weakExcluded: 0,
    opOnlyExcluded: 0,
    timingExcluded: 0,
    unsupportedRemoved: 0,
    overweightDetected: 0
  };

  const runtimePersonas = refined
    .map((p) => toRuntimePersona(p, stats))
    .sort((a, b) => a.runtime_persona_id.localeCompare(b.runtime_persona_id));

  let approved = 0;
  let limited = 0;
  let archive = 0;
  let highUse = 0;
  let salesReady = 0;
  let simReady = 0;
  const patternCounts: Record<string, number> = {};
  const riskSummary: Record<string, number> = {};

  for (const rp of runtimePersonas) {
    if (rp.runtime_readiness === "approved") approved += 1;
    else if (rp.runtime_readiness === "limited") limited += 1;
    else archive += 1;

    if (rp.runtime_usefulness_score >= 75) highUse += 1;
    if (rp.allowed_runtime_usage.sales_training) salesReady += 1;
    if (rp.allowed_runtime_usage.customer_simulation) simReady += 1;

    for (const p of rp.interaction_patterns) incr(patternCounts, p.pattern_name, 1);
    for (const rf of rp.risk_flags) incr(riskSummary, rf, 1);
  }

  const topPatterns = Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([pattern_name, count]) => ({ pattern_name, count }));

  const summary: RuntimePersonaSummary = {
    total_runtime_personas: runtimePersonas.length,
    approved_runtime_personas: approved,
    limited_runtime_personas: limited,
    archive_only_personas: archive,
    high_usefulness_personas: highUse,
    sales_training_ready: salesReady,
    customer_simulation_ready: simReady,
    top_runtime_patterns: topPatterns,
    excluded_profiles: archive
  };

  const audit: RuntimePersonaAudit = {
    weak_profiles_excluded: stats.weakExcluded,
    operational_only_profiles_excluded: stats.opOnlyExcluded,
    timing_noise_profiles_excluded: stats.timingExcluded,
    unsupported_runtime_claims_removed: stats.unsupportedRemoved,
    runtime_risk_profiles: runtimePersonas.filter((p) => p.risk_flags.length > 0).length,
    overweighted_patterns_detected: stats.overweightDetected,
    risk_flags_summary: riskSummary
  };

  return { runtimePersonas, summary, audit };
}
