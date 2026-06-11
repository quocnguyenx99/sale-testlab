export interface PrunedRelationship {
  relationship_name: string;
  relationship_family: string;
  patterns_involved: string[];
  relationship_strength: number;
  supporting_sessions: string[];
  supporting_patterns: string[];
  relationship_reason: string;
  context_type: string;
  stability: "weak" | "moderate" | "strong";
  relevance_score: number;
  pruning_status: "kept" | "downgraded" | "pruned";
  pruning_reason: string;
}

export interface PrunedEntityRecord {
  entity_id: string;
  aggregation_window: string;
  relationships_before: number;
  relationships_after: number;
  pruned_relationships: PrunedRelationship[];
  risk_flags: string[];
}

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
  persona_version: "draft_v1";
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

export interface PersonaSummary {
  total_persona_drafts: number;
  strong_persona_count: number;
  moderate_persona_count: number;
  weak_persona_count: number;
  dominant_context_distribution: Record<string, number>;
  top_behavioral_tendencies: Array<{ tendency_name: string; count: number }>;
  operational_heavy_profiles: number;
  sales_behavior_profiles: number;
  communication_style_profiles: number;
}

export interface PersonaAudit {
  unsupported_claim_count: number;
  overgeneralized_behavior_count: number;
  timing_noise_dependency_count: number;
  operational_only_profile_count: number;
  unstable_behavior_profile_count: number;
  weak_evidence_persona_count: number;
  risk_flags_summary: Record<string, number>;
}

function incr(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function deriveEvidenceStrength(
  tendencies: PersonaTendency[],
  riskFlags: string[]
): "weak" | "moderate" | "strong" {
  const strongCount = tendencies.filter((t) => t.stability === "strong").length;
  const moderateCount = tendencies.filter((t) => t.stability === "moderate").length;
  const hasUnstable = riskFlags.includes("unstable_behavior_profile");
  if (!hasUnstable && strongCount >= 2) return "strong";
  if (moderateCount + strongCount >= 2) return "moderate";
  return "weak";
}

function tendencyConfidence(
  relationshipStrengthAvg: number,
  supportingRelationshipCount: number,
  contradictionPenalty: number
): number {
  let c = 0.35;
  c += Math.min(0.3, relationshipStrengthAvg * 0.35);
  c += Math.min(0.2, supportingRelationshipCount * 0.05);
  c -= contradictionPenalty;
  return Math.max(0, Math.min(1, Number(c.toFixed(4))));
}

function tendencyStability(
  sessionCount: number,
  relationshipCount: number
): "weak" | "moderate" | "strong" {
  if (sessionCount >= 4 && relationshipCount >= 2) return "strong";
  if (sessionCount >= 2 && relationshipCount >= 1) return "moderate";
  return "weak";
}

function buildTendency(
  name: string,
  rels: PrunedRelationship[],
  reasoning: string,
  contradictionPenalty = 0
): PersonaTendency | null {
  if (rels.length === 0) return null;
  const evidencePatterns = uniq(rels.flatMap((r) => r.patterns_involved));
  const evidenceRelationships = uniq(rels.map((r) => r.relationship_name));
  const relationshipStrengthAvg =
    rels.reduce((a, b) => a + b.relationship_strength, 0) / rels.length;
  const sessionSet = new Set(rels.flatMap((r) => r.supporting_sessions));
  const supportSessions = sessionSet.size;
  const confidence = tendencyConfidence(relationshipStrengthAvg, rels.length, contradictionPenalty);
  const stability = tendencyStability(supportSessions, rels.length);
  return {
    tendency_name: name,
    evidence_patterns: evidencePatterns,
    evidence_relationships: evidenceRelationships,
    confidence,
    stability,
    supporting_sessions: supportSessions,
    reasoning
  };
}

function pickDominantContexts(rels: PrunedRelationship[]): string[] {
  const counts: Record<string, number> = {};
  for (const r of rels) incr(counts, r.context_type, 1);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
}

function keptRelationships(entity: PrunedEntityRecord): PrunedRelationship[] {
  return entity.pruned_relationships.filter((r) => r.pruning_status !== "pruned");
}

function mapCommunicationStyle(rels: PrunedRelationship[]): PersonaDraft["communication_style"] {
  const names = new Set(rels.map((r) => r.relationship_name));
  const stylePatterns: string[] = [];
  const contextualBehavior: string[] = [];
  const timingPatterns: string[] = [];

  if ([...names].some((n) => n.includes("short_operational_reply_pattern"))) {
    stylePatterns.push("short_operational_response_style");
  }
  if ([...names].some((n) => n.includes("detailed_inquiry_pattern"))) {
    stylePatterns.push("detailed_product_inquiry_behavior");
  }
  if ([...names].some((n) => n.includes("high_frequency_operational_chat_pattern"))) {
    contextualBehavior.push("high_frequency_operational_coordination");
  }
  if ([...names].some((n) => n.includes("delayed_reengagement_pattern"))) {
    timingPatterns.push("delayed_purchase_reengagement_pattern");
  }
  if ([...names].some((n) => n.includes("rapid_multi_message_pattern"))) {
    timingPatterns.push("rapid_multi_message_interaction_pattern");
  }
  if ([...names].some((n) => n.includes("slow_paced_interaction_pattern"))) {
    timingPatterns.push("slow_paced_interaction_pattern");
  }

  return {
    style_patterns: uniq(stylePatterns),
    contextual_behavior: uniq(contextualBehavior),
    response_timing_patterns: uniq(timingPatterns)
  };
}

function mapSalesProfile(rels: PrunedRelationship[]): PersonaDraft["sales_interaction_profile"] {
  const names = new Set(rels.map((r) => r.relationship_name));
  const research: string[] = [];
  const price: string[] = [];
  const payment: string[] = [];
  const logistics: string[] = [];

  if ([...names].some((n) => n.includes("repeated_product_research_pattern"))) {
    research.push("repeated_product_research_behavior");
  }
  if ([...names].some((n) => n.includes("repeated_stock_check_pattern"))) {
    research.push("repeated_stock_verification_behavior");
  }
  if ([...names].some((n) => n.includes("repeated_price_inquiry_pattern"))) {
    price.push("repeated_price_inquiry_behavior");
  }
  if ([...names].some((n) => n.includes("repeated_payment_followup_pattern"))) {
    payment.push("operational_payment_followup_behavior");
  }
  if ([...names].some((n) => n.includes("frequent_unc_submission_pattern"))) {
    payment.push("frequent_unc_submission_behavior");
  }
  if ([...names].some((n) => n.includes("tod_resolution_pattern"))) {
    payment.push("tod_resolution_behavior");
  }
  if ([...names].some((n) => n.includes("logistics_followup_pattern"))) {
    logistics.push("logistics_followup_tendency");
  }
  if ([...names].some((n) => n.includes("document_request_pattern"))) {
    logistics.push("document_request_tendency");
  }

  return {
    research_behavior: uniq(research),
    price_behavior: uniq(price),
    payment_behavior: uniq(payment),
    logistics_behavior: uniq(logistics)
  };
}

export function buildPersonaDraft(entity: PrunedEntityRecord): PersonaDraft {
  const kept = keptRelationships(entity);
  const dominant = pickDominantContexts(kept);
  const names = new Set(kept.map((r) => r.relationship_name));
  const contradictionPenalty = entity.risk_flags.some((f) => f.includes("contradiction")) ? 0.05 : 0;

  const tendencies: PersonaTendency[] = [];
  const t1 = buildTendency(
    "repeated_product_comparison_behavior",
    kept.filter((r) =>
      r.relationship_name.includes("repeated_product_research_pattern") ||
      r.relationship_name.includes("repeated_stock_check_pattern")
    ),
    "Repeated product-research and stock-check relationships observed across sessions.",
    contradictionPenalty
  );
  if (t1) tendencies.push(t1);

  const t2 = buildTendency(
    "price_sensitive_research_behavior",
    kept.filter((r) => r.relationship_name.includes("repeated_price_inquiry_pattern")),
    "Repeated price-inquiry relationships observed across sessions.",
    contradictionPenalty
  );
  if (t2) tendencies.push(t2);

  const t3 = buildTendency(
    "operational_payment_followup_behavior",
    kept.filter((r) =>
      r.relationship_name.includes("repeated_payment_followup_pattern") ||
      r.relationship_name.includes("tod_resolution_pattern") ||
      r.relationship_name.includes("frequent_unc_submission_pattern")
    ),
    "Payment follow-up, TOD resolution, or UNC-related relationships repeatedly observed."
  );
  if (t3) tendencies.push(t3);

  const t4 = buildTendency(
    "logistics_followup_tendency",
    kept.filter((r) =>
      r.relationship_name.includes("logistics_followup_pattern") ||
      r.relationship_name.includes("document_request_pattern")
    ),
    "Logistics follow-up and document-request relationships repeatedly observed."
  );
  if (t4) tendencies.push(t4);

  const t5 = buildTendency(
    "short_operational_response_style",
    kept.filter((r) => r.relationship_name.includes("short_operational_reply_pattern")),
    "Short operational reply relationships observed with operational workflow context."
  );
  if (t5) tendencies.push(t5);

  const t6 = buildTendency(
    "high_frequency_operational_coordination",
    kept.filter((r) => r.relationship_name.includes("high_frequency_operational_chat_pattern")),
    "High-frequency operational chat relationships observed across sessions.",
    contradictionPenalty
  );
  if (t6) tendencies.push(t6);

  const t7 = buildTendency(
    "delayed_purchase_reengagement_pattern",
    kept.filter((r) => r.relationship_name.includes("delayed_reengagement_pattern")),
    "Delayed re-engagement timing relationships repeatedly observed."
  );
  if (t7) tendencies.push(t7);

  const communicationStyle = mapCommunicationStyle(kept);
  const salesProfile = mapSalesProfile(kept);

  const operationalConstraints: string[] = [];
  if (names.has("dominance:operational_context")) {
    operationalConstraints.push("operational_context_dominant");
  }
  if (names.has("sequence:operational_workflow_to_logistics_followup")) {
    operationalConstraints.push("workflow_progression_operational_to_logistics");
  }

  const riskFlags = [...entity.risk_flags];
  const unsupportedClaimsRemoved = [
    "emotion_inference_removed",
    "personality_label_removed",
    "demographic_inference_removed",
    "motive_inference_removed"
  ];

  const hasSalesEvidence =
    salesProfile.research_behavior.length > 0 ||
    salesProfile.price_behavior.length > 0;
  const hasOperationalEvidence =
    salesProfile.payment_behavior.length > 0 ||
    operationalConstraints.length > 0;

  if (!hasSalesEvidence) riskFlags.push("insufficient_sales_evidence");
  if (!hasOperationalEvidence && dominant.includes("operational_context")) {
    riskFlags.push("operational_only_profile");
  }
  if (tendencies.length <= 1) riskFlags.push("weak_evidence_persona");
  if (tendencies.some((t) => t.stability === "weak") && tendencies.length >= 2) {
    riskFlags.push("unstable_behavior_profile");
  }

  const evidenceStrength = deriveEvidenceStrength(tendencies, riskFlags);

  return {
    entity_id: entity.entity_id,
    persona_version: "draft_v1",
    evidence_strength: evidenceStrength,
    dominant_contexts: dominant,
    behavioral_tendencies: tendencies,
    communication_style: communicationStyle,
    sales_interaction_profile: salesProfile,
    operational_constraints: uniq(operationalConstraints),
    risk_flags: uniq(riskFlags),
    unsupported_claims_removed: unsupportedClaimsRemoved
  };
}

export interface PersonaDraftAggregationState {
  drafts: PersonaDraft[];
  dominantDist: Record<string, number>;
  tendencyCounts: Record<string, number>;
  riskSummary: Record<string, number>;
  strongCount: number;
  moderateCount: number;
  weakCount: number;
  opHeavy: number;
  salesProfiles: number;
  commProfiles: number;
  unsupportedClaimCount: number;
  overgeneralizedCount: number;
  timingNoiseDependency: number;
  operationalOnlyCount: number;
  unstableCount: number;
  weakEvidenceCount: number;
}

export function createPersonaDraftAggregationState(): PersonaDraftAggregationState {
  return {
    drafts: [],
    dominantDist: {},
    tendencyCounts: {},
    riskSummary: {},
    strongCount: 0,
    moderateCount: 0,
    weakCount: 0,
    opHeavy: 0,
    salesProfiles: 0,
    commProfiles: 0,
    unsupportedClaimCount: 0,
    overgeneralizedCount: 0,
    timingNoiseDependency: 0,
    operationalOnlyCount: 0,
    unstableCount: 0,
    weakEvidenceCount: 0
  };
}

export function addPersonaDraftToAggregation(
  state: PersonaDraftAggregationState,
  draft: PersonaDraft
): void {
  state.drafts.push(draft);
  for (const c of draft.dominant_contexts) incr(state.dominantDist, c, 1);
  for (const t of draft.behavioral_tendencies) incr(state.tendencyCounts, t.tendency_name, 1);
  for (const rf of draft.risk_flags) incr(state.riskSummary, rf, 1);

  if (draft.evidence_strength === "strong") state.strongCount += 1;
  else if (draft.evidence_strength === "moderate") state.moderateCount += 1;
  else state.weakCount += 1;

  if (draft.dominant_contexts.includes("operational_context")) state.opHeavy += 1;
  if (
    draft.sales_interaction_profile.research_behavior.length +
      draft.sales_interaction_profile.price_behavior.length >
    0
  ) {
    state.salesProfiles += 1;
  }
  if (
    draft.communication_style.style_patterns.length +
      draft.communication_style.contextual_behavior.length >
    0
  ) {
    state.commProfiles += 1;
  }

  state.unsupportedClaimCount += draft.unsupported_claims_removed.length;
  if (draft.risk_flags.includes("overgeneralized_behavior")) state.overgeneralizedCount += 1;
  if (
    draft.behavioral_tendencies.some((t) => t.tendency_name.includes("timing")) &&
    draft.behavioral_tendencies.length <= 2
  ) {
    state.timingNoiseDependency += 1;
  }
  if (draft.risk_flags.includes("operational_only_profile")) state.operationalOnlyCount += 1;
  if (draft.risk_flags.includes("unstable_behavior_profile")) state.unstableCount += 1;
  if (
    draft.evidence_strength === "weak" ||
    draft.risk_flags.includes("weak_evidence_persona")
  ) {
    state.weakEvidenceCount += 1;
  }
}

export function finalizePersonaDraftAggregation(
  state: PersonaDraftAggregationState
): { drafts: PersonaDraft[]; summary: PersonaSummary; audit: PersonaAudit } {
  state.drafts.sort((a, b) => a.entity_id.localeCompare(b.entity_id));

  const topTendencies = Object.entries(state.tendencyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tendency_name, count]) => ({ tendency_name, count }));

  const summary: PersonaSummary = {
    total_persona_drafts: state.drafts.length,
    strong_persona_count: state.strongCount,
    moderate_persona_count: state.moderateCount,
    weak_persona_count: state.weakCount,
    dominant_context_distribution: state.dominantDist,
    top_behavioral_tendencies: topTendencies,
    operational_heavy_profiles: state.opHeavy,
    sales_behavior_profiles: state.salesProfiles,
    communication_style_profiles: state.commProfiles
  };

  const audit: PersonaAudit = {
    unsupported_claim_count: state.unsupportedClaimCount,
    overgeneralized_behavior_count: state.overgeneralizedCount,
    timing_noise_dependency_count: state.timingNoiseDependency,
    operational_only_profile_count: state.operationalOnlyCount,
    unstable_behavior_profile_count: state.unstableCount,
    weak_evidence_persona_count: state.weakEvidenceCount,
    risk_flags_summary: state.riskSummary
  };

  return { drafts: state.drafts, summary, audit };
}

export function buildPersonaDrafts(
  entities: PrunedEntityRecord[]
): { drafts: PersonaDraft[]; summary: PersonaSummary; audit: PersonaAudit } {
  const state = createPersonaDraftAggregationState();
  for (const entity of entities) {
    addPersonaDraftToAggregation(state, buildPersonaDraft(entity));
  }
  return finalizePersonaDraftAggregation(state);
}
