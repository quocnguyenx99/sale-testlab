export interface PersonaTendency {
  tendency_name: string;
  evidence_patterns: string[];
  evidence_relationships: string[];
  confidence: number;
  stability: "weak" | "moderate" | "strong";
  supporting_sessions: number;
  reasoning: string;
}

export interface PersonaDraft {
  entity_id: string;
  persona_version: string;
  evidence_strength: "weak" | "moderate" | "strong";
  dominant_contexts: string[];
  behavioral_tendencies: PersonaTendency[];
  communication_style: {
    style_patterns: string[];
    contextual_behavior: string[];
    response_timing_patterns: string[];
  };
  sales_interaction_profile: {
    research_behavior: string[];
    price_behavior: string[];
    payment_behavior: string[];
    logistics_behavior: string[];
  };
  operational_constraints: string[];
  risk_flags: string[];
  unsupported_claims_removed: string[];
}

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

export interface RefinedPersonaSummary {
  total_refined_personas: number;
  high_runtime_usefulness_count: number;
  medium_runtime_usefulness_count: number;
  low_runtime_usefulness_count: number;
  strong_evidence_profiles: number;
  sales_ready_profiles: number;
  operational_heavy_profiles: number;
  weak_profiles_removed: number;
  top_runtime_tendencies: Array<{ tendency_name: string; count: number }>;
}

export interface RefinedPersonaAudit {
  unsupported_tendencies_removed: number;
  timing_noise_tendencies_removed: number;
  weak_profiles_removed: number;
  runtime_risk_profiles: number;
  overgeneralized_claims_removed: number;
  operational_only_profiles_detected: number;
  risk_flags_summary: Record<string, number>;
}

interface RefineStats {
  unsupportedRemoved: number;
  timingNoiseRemoved: number;
  weakProfilesRemoved: number;
  overgeneralizedRemoved: number;
}

function incr(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function isHighValue(name: string): boolean {
  return [
    "repeated_product_comparison_behavior",
    "price_sensitive_research_behavior",
    "logistics_followup_tendency",
    "operational_payment_followup_behavior",
    "detailed_product_inquiry_behavior",
    "high_frequency_operational_coordination"
  ].includes(name);
}

function isTimingOnly(name: string): boolean {
  return [
    "delayed_purchase_reengagement_pattern"
  ].includes(name);
}

function isLowValue(name: string): boolean {
  return [
    "short_operational_response_style",
    "delayed_purchase_reengagement_pattern"
  ].includes(name);
}

function hasSalesSignal(d: PersonaDraft): boolean {
  const s = d.sales_interaction_profile;
  return s.research_behavior.length + s.price_behavior.length + s.payment_behavior.length > 0;
}

function hasOperationalSignal(d: PersonaDraft): boolean {
  const s = d.sales_interaction_profile;
  return s.payment_behavior.length > 0 || d.operational_constraints.length > 0;
}

function runtimePriority(t: PersonaTendency): "low" | "medium" | "high" {
  if (isHighValue(t.tendency_name) && (t.stability !== "weak" || t.supporting_sessions >= 2)) {
    return "high";
  }
  if (isTimingOnly(t.tendency_name) || isLowValue(t.tendency_name)) {
    return "low";
  }
  return "medium";
}

function shouldRemoveTendency(
  t: PersonaTendency,
  draft: PersonaDraft
): { remove: boolean; reason: string } {
  const weakSingle =
    t.stability === "weak" &&
    t.evidence_relationships.length <= 1 &&
    t.supporting_sessions <= 1;
  if (weakSingle) return { remove: true, reason: "single_weak_relationship" };

  if (t.confidence < 0.55) return { remove: true, reason: "below_confidence_threshold" };

  if (isTimingOnly(t.tendency_name)) {
    const hasNonTimingContext = draft.dominant_contexts.some((c) => c !== "timing_context");
    if (!hasNonTimingContext || t.stability === "weak") {
      return { remove: true, reason: "timing_only_noise" };
    }
  }

  const contradictionDominant = draft.risk_flags.filter((r) => r.includes("contradiction")).length >= 2;
  if (contradictionDominant && t.stability === "weak") {
    return { remove: true, reason: "contradiction_dominated" };
  }

  if (t.tendency_name === "short_operational_response_style") {
    const opSupport = hasOperationalSignal(draft);
    if (!opSupport) return { remove: true, reason: "isolated_short_reply_noise" };
  }

  return { remove: false, reason: "kept" };
}

function evidenceQuality(tendencies: RefinedTendency[]): "weak" | "moderate" | "strong" {
  const strongLike = tendencies.filter(
    (t) => t.stability === "strong" && t.runtime_priority === "high"
  ).length;
  if (strongLike >= 2) return "strong";
  if (tendencies.length >= 2) return "moderate";
  return "weak";
}

function runtimeUsefulnessScore(d: RefinedPersona): number {
  const high = d.refined_tendencies.filter((t) => t.runtime_priority === "high").length;
  const medium = d.refined_tendencies.filter((t) => t.runtime_priority === "medium").length;
  const low = d.refined_tendencies.filter((t) => t.runtime_priority === "low").length;

  let score = 20;
  score += Math.min(45, high * 15);
  score += Math.min(20, medium * 6);
  score -= Math.min(15, low * 5);

  const salesCoverage =
    d.sales_runtime_profile.research_patterns.length +
    d.sales_runtime_profile.price_patterns.length +
    d.sales_runtime_profile.payment_patterns.length +
    d.sales_runtime_profile.logistics_patterns.length;
  score += Math.min(10, salesCoverage * 2);

  if (d.runtime_risk_flags.includes("operational_only_profile")) score -= 12;
  if (d.runtime_risk_flags.includes("unstable_tendency_mix")) score -= 8;
  if (d.runtime_risk_flags.includes("timing_noise_dependency")) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function mapSalesRuntimeProfile(d: PersonaDraft): RefinedPersona["sales_runtime_profile"] {
  return {
    research_patterns: uniq(d.sales_interaction_profile.research_behavior),
    price_patterns: uniq(d.sales_interaction_profile.price_behavior),
    payment_patterns: uniq(d.sales_interaction_profile.payment_behavior),
    logistics_patterns: uniq(d.sales_interaction_profile.logistics_behavior)
  };
}

function mapCommunicationRuntimeProfile(d: PersonaDraft): RefinedPersona["communication_runtime_profile"] {
  return {
    reply_style_patterns: uniq(d.communication_style.style_patterns),
    interaction_pacing_patterns: uniq(
      d.communication_style.response_timing_patterns.filter(
        (p) => p !== "rapid_multi_message_interaction_pattern" || d.behavioral_tendencies.length >= 2
      )
    ),
    operational_coordination_patterns: uniq(d.communication_style.contextual_behavior)
  };
}

function refineOne(draft: PersonaDraft, stats: RefineStats): RefinedPersona {
  const removed: Array<{ tendency_name: string; reason: string }> = [];
  const kept: RefinedTendency[] = [];

  for (const t of draft.behavioral_tendencies) {
    const decision = shouldRemoveTendency(t, draft);
    if (decision.remove) {
      removed.push({ tendency_name: t.tendency_name, reason: decision.reason });
      stats.unsupportedRemoved += 1;
      if (decision.reason === "timing_only_noise") stats.timingNoiseRemoved += 1;
      continue;
    }
    kept.push({
      tendency_name: t.tendency_name,
      confidence: Number(t.confidence.toFixed(4)),
      stability: t.stability,
      runtime_priority: runtimePriority(t),
      supporting_patterns: uniq(t.evidence_patterns),
      supporting_relationships: uniq(t.evidence_relationships),
      reasoning: t.reasoning
    });
  }

  const runtimeRiskFlags = uniq(
    draft.risk_flags.filter(
      (f) =>
        f.includes("insufficient_sales_evidence") ||
        f.includes("operational_only_profile") ||
        f.includes("contradiction") ||
        f.includes("weak_evidence")
    )
  );

  const salesProfile = mapSalesRuntimeProfile(draft);
  const commProfile = mapCommunicationRuntimeProfile(draft);

  if (
    salesProfile.research_patterns.length +
      salesProfile.price_patterns.length +
      salesProfile.payment_patterns.length ===
    0
  ) {
    runtimeRiskFlags.push("operational_only_profile");
  }

  const timingTendencyOnly =
    kept.length > 0 && kept.every((t) => isTimingOnly(t.tendency_name) || t.runtime_priority === "low");
  if (timingTendencyOnly) runtimeRiskFlags.push("timing_noise_dependency");

  if (kept.some((t) => t.stability === "weak") && kept.some((t) => t.stability === "strong")) {
    runtimeRiskFlags.push("unstable_tendency_mix");
  }

  if (removed.length > 0 && kept.length === 0) {
    stats.weakProfilesRemoved += 1;
    runtimeRiskFlags.push("weak_profile_after_refinement");
  }

  const refined: RefinedPersona = {
    entity_id: draft.entity_id,
    runtime_profile_version: "refined_v1",
    runtime_usefulness_score: 0,
    evidence_quality: evidenceQuality(kept),
    dominant_contexts: draft.dominant_contexts,
    refined_tendencies: kept,
    communication_runtime_profile: commProfile,
    sales_runtime_profile: salesProfile,
    operational_constraints: uniq(draft.operational_constraints),
    runtime_risk_flags: uniq(runtimeRiskFlags),
    removed_tendencies: removed
  };

  refined.runtime_usefulness_score = runtimeUsefulnessScore(refined);
  return refined;
}

export function refinePersonaDrafts(
  drafts: PersonaDraft[]
): {
  refined: RefinedPersona[];
  summary: RefinedPersonaSummary;
  audit: RefinedPersonaAudit;
} {
  const stats: RefineStats = {
    unsupportedRemoved: 0,
    timingNoiseRemoved: 0,
    weakProfilesRemoved: 0,
    overgeneralizedRemoved: 0
  };

  const refined = drafts.map((d) => refineOne(d, stats)).sort((a, b) => a.entity_id.localeCompare(b.entity_id));

  let highUsefulness = 0;
  let mediumUsefulness = 0;
  let lowUsefulness = 0;
  let strongEvidence = 0;
  let salesReady = 0;
  let operationalHeavy = 0;
  const tendencyCounts: Record<string, number> = {};
  const riskCounts: Record<string, number> = {};

  for (const p of refined) {
    if (p.runtime_usefulness_score >= 75) highUsefulness += 1;
    else if (p.runtime_usefulness_score >= 50) mediumUsefulness += 1;
    else lowUsefulness += 1;

    if (p.evidence_quality === "strong") strongEvidence += 1;

    const salesSignals =
      p.sales_runtime_profile.research_patterns.length +
      p.sales_runtime_profile.price_patterns.length +
      p.sales_runtime_profile.logistics_patterns.length;
    if (salesSignals > 0 && p.runtime_usefulness_score >= 50) salesReady += 1;

    if (
      p.sales_runtime_profile.payment_patterns.length > 0 &&
      p.sales_runtime_profile.research_patterns.length === 0 &&
      p.sales_runtime_profile.price_patterns.length === 0
    ) {
      operationalHeavy += 1;
    }

    for (const t of p.refined_tendencies) incr(tendencyCounts, t.tendency_name, 1);
    for (const rf of p.runtime_risk_flags) incr(riskCounts, rf, 1);
  }

  const topRuntimeTendencies = Object.entries(tendencyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tendency_name, count]) => ({ tendency_name, count }));

  const summary: RefinedPersonaSummary = {
    total_refined_personas: refined.length,
    high_runtime_usefulness_count: highUsefulness,
    medium_runtime_usefulness_count: mediumUsefulness,
    low_runtime_usefulness_count: lowUsefulness,
    strong_evidence_profiles: strongEvidence,
    sales_ready_profiles: salesReady,
    operational_heavy_profiles: operationalHeavy,
    weak_profiles_removed: stats.weakProfilesRemoved,
    top_runtime_tendencies: topRuntimeTendencies
  };

  const audit: RefinedPersonaAudit = {
    unsupported_tendencies_removed: stats.unsupportedRemoved,
    timing_noise_tendencies_removed: stats.timingNoiseRemoved,
    weak_profiles_removed: stats.weakProfilesRemoved,
    runtime_risk_profiles: refined.filter((r) => r.runtime_risk_flags.length > 0).length,
    overgeneralized_claims_removed: stats.overgeneralizedRemoved,
    operational_only_profiles_detected: refined.filter((r) =>
      r.runtime_risk_flags.includes("operational_only_profile")
    ).length,
    risk_flags_summary: riskCounts
  };

  return { refined, summary, audit };
}
