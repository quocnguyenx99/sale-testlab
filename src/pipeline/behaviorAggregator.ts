export interface BehaviorSignal {
  signal_name: string;
  signal_family: string;
  confidence: number;
  evidence_strength?: "weak" | "moderate" | "strong";
  evidence_message_ids: string[];
  evidence_texts: string[];
  trigger_rules: string[];
  why_triggered: string;
}

export interface BehaviorSessionRecord {
  session_id: string;
  conversation_id?: string;
  message_count: number;
  avg_confidence: number;
  behavior_signals: BehaviorSignal[];
}

export interface AggregatedPattern {
  pattern_name: string;
  pattern_family: string;
  confidence: number;
  evidence_sessions: string[];
  evidence_signals: string[];
  supporting_signal_count: number;
  aggregation_reason: string;
  context_group: string;
  stability: "weak" | "moderate" | "strong";
}

export interface AggregatedBehaviorRecord {
  entity_id: string;
  aggregation_window: string;
  session_count: number;
  message_count: number;
  aggregated_patterns: AggregatedPattern[];
  behavior_consistency: Record<string, number | boolean | string>;
  communication_contexts: Record<string, number>;
  operational_contexts: Record<string, number>;
  sales_contexts: Record<string, number>;
  risk_flags: string[];
}

export interface AggregationSummary {
  total_entities: number;
  total_aggregated_patterns: number;
  pattern_family_counts: Record<string, number>;
  top_patterns: Array<{ pattern_name: string; count: number }>;
  high_confidence_patterns: number;
  weak_patterns: number;
  context_distribution: Record<string, number>;
  stable_behavior_count: number;
  unstable_behavior_count: number;
}

export interface AggregationAudit {
  contradictory_pattern_count: number;
  weak_single_session_pattern_count: number;
  unstable_pattern_count: number;
  over_aggregated_pattern_count: number;
  unsupported_high_confidence_pattern_count: number;
  context_conflict_count: number;
  entities_with_no_patterns: number;
  risk_flags_summary: Record<string, number>;
}

type EntityAccumulator = {
  entity_id: string;
  session_count: number;
  message_count: number;
  avg_conf_sum: number;
  signal_occurrence: Record<string, number>;
  signal_sessions: Record<string, Set<string>>;
  signal_families: Record<string, number>;
  session_ids: string[];
};

export interface BehaviorAggregationState {
  entity_map: Map<string, EntityAccumulator>;
}

const STRONG_SIGNALS = new Set([
  "operational_code_present",
  "sends_unc",
  "requests_tod_removal"
]);

function emptyAcc(id: string): EntityAccumulator {
  return {
    entity_id: id,
    session_count: 0,
    message_count: 0,
    avg_conf_sum: 0,
    signal_occurrence: {},
    signal_sessions: {},
    signal_families: {},
    session_ids: []
  };
}

export function createBehaviorAggregationState(): BehaviorAggregationState {
  return {
    entity_map: new Map<string, EntityAccumulator>()
  };
}

function incr(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

function sessionsFor(acc: EntityAccumulator, signal: string): string[] {
  return Array.from(acc.signal_sessions[signal] ?? []).sort();
}

function signalCount(acc: EntityAccumulator, signal: string): number {
  return acc.signal_occurrence[signal] ?? 0;
}

function signalSessionCount(acc: EntityAccumulator, signal: string): number {
  return sessionsFor(acc, signal).length;
}

function deriveStability(sessionEvidenceCount: number, supportCount: number): "weak" | "moderate" | "strong" {
  if (sessionEvidenceCount >= 3 && supportCount >= 4) return "strong";
  if (sessionEvidenceCount >= 2 && supportCount >= 2) return "moderate";
  return "weak";
}

function basePatternConfidence(
  supportCount: number,
  sessionEvidenceCount: number,
  strongEvidence: boolean
): number {
  let conf = 0.3;
  conf += Math.min(0.35, supportCount * 0.07);
  conf += Math.min(0.2, Math.max(0, sessionEvidenceCount - 1) * 0.1);
  if (strongEvidence) conf += 0.15;
  if (sessionEvidenceCount < 2) conf = Math.min(conf, 0.4);
  return Math.min(1, Number(conf.toFixed(4)));
}

function addPattern(
  patterns: AggregatedPattern[],
  patternName: string,
  family: string,
  evidenceSignals: string[],
  acc: EntityAccumulator,
  reason: string,
  contextGroup: string
): void {
  const evidenceSessionSet = new Set<string>();
  let support = 0;
  let strongEvidence = false;
  for (const signal of evidenceSignals) {
    support += signalCount(acc, signal);
    for (const sid of sessionsFor(acc, signal)) evidenceSessionSet.add(sid);
    if (STRONG_SIGNALS.has(signal)) strongEvidence = true;
  }
  const evidenceSessions = Array.from(evidenceSessionSet).sort();
  const sessionEvidenceCount = evidenceSessions.length;
  const stability = deriveStability(sessionEvidenceCount, support);
  const confidence = basePatternConfidence(support, sessionEvidenceCount, strongEvidence);

  if (sessionEvidenceCount < 2) return;

  patterns.push({
    pattern_name: patternName,
    pattern_family: family,
    confidence,
    evidence_sessions: evidenceSessions,
    evidence_signals: evidenceSignals,
    supporting_signal_count: support,
    aggregation_reason: reason,
    context_group: contextGroup,
    stability
  });
}

function hasOperationalEvidence(acc: EntityAccumulator): boolean {
  const opSignals = [
    "requests_payment_check",
    "sends_unc",
    "requests_tod_removal",
    "internal_coordination",
    "operational_code_present"
  ];
  return opSignals.some((s) => signalCount(acc, s) > 0);
}

function hasSalesEvidence(acc: EntityAccumulator): boolean {
  const salesSignals = ["asks_price", "product_model_inquiry", "asks_stock", "bulk_purchase_signal"];
  return salesSignals.some((s) => signalCount(acc, s) > 0);
}

function buildEntityRecord(acc: EntityAccumulator, month: string): AggregatedBehaviorRecord {
  const patterns: AggregatedPattern[] = [];

  if (signalSessionCount(acc, "asks_price") >= 2) {
    addPattern(
      patterns,
      "repeated_price_inquiry_pattern",
      "sales",
      ["asks_price"],
      acc,
      "asks_price repeated across sessions",
      "sales_context"
    );
  }
  if (signalSessionCount(acc, "product_model_inquiry") >= 2) {
    addPattern(
      patterns,
      "repeated_product_research_pattern",
      "sales",
      ["product_model_inquiry"],
      acc,
      "product_model_inquiry repeated across sessions",
      "sales_context"
    );
  }
  if (signalCount(acc, "bulk_purchase_signal") >= 2) {
    addPattern(
      patterns,
      "bulk_purchase_pattern",
      "sales",
      ["bulk_purchase_signal"],
      acc,
      "bulk_purchase_signal repeated",
      "sales_context"
    );
  }
  if (signalCount(acc, "asks_stock") >= 2) {
    addPattern(
      patterns,
      "repeated_stock_check_pattern",
      "sales",
      ["asks_stock"],
      acc,
      "asks_stock repeated",
      "sales_context"
    );
  }

  if (signalCount(acc, "requests_payment_check") >= 2) {
    addPattern(
      patterns,
      "repeated_payment_followup_pattern",
      "operational",
      ["requests_payment_check"],
      acc,
      "requests_payment_check repeated",
      "payment_context"
    );
  }
  if (signalCount(acc, "sends_unc") >= 2) {
    addPattern(
      patterns,
      "frequent_unc_submission_pattern",
      "operational",
      ["sends_unc"],
      acc,
      "sends_unc repeated",
      "payment_context"
    );
  }
  if (signalCount(acc, "requests_tod_removal") >= 2) {
    addPattern(
      patterns,
      "tod_resolution_pattern",
      "operational",
      ["requests_tod_removal"],
      acc,
      "requests_tod_removal repeated",
      "operational_context"
    );
  }
  if (
    signalSessionCount(acc, "operational_code_present") >= 2 ||
    signalSessionCount(acc, "internal_coordination") >= 2
  ) {
    addPattern(
      patterns,
      "operational_workflow_pattern",
      "operational",
      ["operational_code_present", "internal_coordination"],
      acc,
      "operational markers repeated across sessions",
      "operational_context"
    );
  }

  if (signalCount(acc, "delivery_followup") + signalCount(acc, "warehouse_coordination") >= 2) {
    addPattern(
      patterns,
      "logistics_followup_pattern",
      "logistics",
      ["delivery_followup", "warehouse_coordination"],
      acc,
      "logistics follow-up signals repeated",
      "logistics_context"
    );
  }
  if (signalCount(acc, "document_request") >= 2) {
    addPattern(
      patterns,
      "document_request_pattern",
      "logistics",
      ["document_request"],
      acc,
      "document_request repeated",
      "logistics_context"
    );
  }

  if ((signalCount(acc, "low_context_reply") + signalCount(acc, "short_ack")) >= 3 && hasOperationalEvidence(acc)) {
    addPattern(
      patterns,
      "short_operational_reply_pattern",
      "communication",
      ["low_context_reply", "short_ack"],
      acc,
      "short operational reply markers repeated",
      "communication_context"
    );
  }
  if (signalCount(acc, "detailed_question") >= 2) {
    addPattern(
      patterns,
      "detailed_inquiry_pattern",
      "communication",
      ["detailed_question"],
      acc,
      "detailed_question repeated",
      "communication_context"
    );
  }
  if (signalSessionCount(acc, "high_frequency_exchange") >= 2 && hasOperationalEvidence(acc)) {
    addPattern(
      patterns,
      "high_frequency_operational_chat_pattern",
      "communication",
      ["high_frequency_exchange"],
      acc,
      "high_frequency_exchange repeated with operational evidence",
      "communication_context"
    );
  }

  if (signalSessionCount(acc, "high_frequency_exchange") >= 2) {
    addPattern(
      patterns,
      "rapid_multi_message_pattern",
      "timing",
      ["high_frequency_exchange"],
      acc,
      "high_frequency_exchange repeated across sessions",
      "timing_context"
    );
  }
  if (signalSessionCount(acc, "reengagement_after_gap") >= 2) {
    addPattern(
      patterns,
      "delayed_reengagement_pattern",
      "timing",
      ["reengagement_after_gap"],
      acc,
      "reengagement_after_gap repeated across sessions",
      "timing_context"
    );
  }
  if (signalSessionCount(acc, "slow_paced_exchange") >= 2) {
    addPattern(
      patterns,
      "slow_paced_interaction_pattern",
      "timing",
      ["slow_paced_exchange"],
      acc,
      "slow_paced_exchange repeated across sessions",
      "timing_context"
    );
  }

  if (
    signalSessionCount(acc, "operational_workflow_pattern") >= 2 ||
    signalSessionCount(acc, "repeated_operational_code_session") >= 2 ||
    signalSessionCount(acc, "repeated_payment_followup_session") >= 2
  ) {
    addPattern(
      patterns,
      "stable_operational_flow_pattern",
      "session_structure",
      ["repeated_operational_code_session", "repeated_payment_followup_session", "operational_code_present"],
      acc,
      "operational flow/session-structure markers repeated",
      "operational_context"
    );
  }
  if (signalCount(acc, "mixed_operation_session") >= 2) {
    addPattern(
      patterns,
      "mixed_operation_pattern",
      "session_structure",
      ["mixed_operation_session"],
      acc,
      "mixed_operation_session repeated",
      "mixed_context"
    );
  }
  if (signalCount(acc, "long_session") >= 2) {
    addPattern(
      patterns,
      "long_interaction_pattern",
      "session_structure",
      ["long_session"],
      acc,
      "long_session repeated",
      "timing_context"
    );
  }

  const riskFlags: string[] = [];
  const patternByName = new Set(patterns.map((p) => p.pattern_name));
  const hasHighFreq = patternByName.has("rapid_multi_message_pattern");
  const hasSlowPaced = patternByName.has("slow_paced_interaction_pattern");
  if (hasHighFreq && hasSlowPaced) riskFlags.push("contradiction:rapid_vs_slow_pacing");

  const hasPricePattern = patternByName.has("repeated_price_inquiry_pattern");
  if (hasPricePattern && !hasSalesEvidence(acc)) {
    riskFlags.push("contradiction:price_pattern_without_sales_evidence");
  }

  const hasShortOpReply = patternByName.has("short_operational_reply_pattern");
  if (hasShortOpReply && !hasOperationalEvidence(acc)) {
    riskFlags.push("contradiction:short_operational_reply_without_operational_context");
  }

  for (const p of patterns) {
    if (p.confidence >= 0.85 && p.stability === "weak") {
      riskFlags.push(`confidence_mismatch:${p.pattern_name}`);
    }
    if (p.pattern_name === "mixed_operation_pattern" && p.confidence >= 0.8 && (acc.avg_conf_sum / Math.max(1, acc.session_count)) < 0.45) {
      riskFlags.push("contradiction:mixed_operation_high_conf_low_avg_session_conf");
    }
  }

  const communicationContexts = {
    short_operational_reply_signals: signalCount(acc, "short_ack") + signalCount(acc, "low_context_reply"),
    detailed_inquiry_signals: signalCount(acc, "detailed_question"),
    high_frequency_chat_sessions: signalSessionCount(acc, "high_frequency_exchange")
  };
  const operationalContexts = {
    payment_followups: signalCount(acc, "requests_payment_check"),
    unc_submissions: signalCount(acc, "sends_unc"),
    tod_resolutions: signalCount(acc, "requests_tod_removal"),
    operational_codes: signalCount(acc, "operational_code_present"),
    internal_coordination: signalCount(acc, "internal_coordination")
  };
  const salesContexts = {
    price_inquiries: signalCount(acc, "asks_price"),
    product_inquiries: signalCount(acc, "product_model_inquiry"),
    stock_checks: signalCount(acc, "asks_stock"),
    bulk_purchase_signals: signalCount(acc, "bulk_purchase_signal")
  };

  const stablePatterns = patterns.filter((p) => p.stability !== "weak").length;
  const unstablePatterns = patterns.filter((p) => p.stability === "weak").length;
  const consistencyScore = patterns.length
    ? Number((stablePatterns / patterns.length).toFixed(4))
    : 0;

  return {
    entity_id: acc.entity_id,
    aggregation_window: month,
    session_count: acc.session_count,
    message_count: acc.message_count,
    aggregated_patterns: patterns,
    behavior_consistency: {
      stable_pattern_count: stablePatterns,
      unstable_pattern_count: unstablePatterns,
      consistency_score: consistencyScore,
      has_contradiction: riskFlags.some((f) => f.startsWith("contradiction:"))
    },
    communication_contexts: communicationContexts,
    operational_contexts: operationalContexts,
    sales_contexts: salesContexts,
    risk_flags: riskFlags
  };
}

export function addBehaviorSessionToAggregation(
  state: BehaviorAggregationState,
  row: BehaviorSessionRecord
): void {
  const entityId = row.conversation_id || "unknown_conversation";
  const acc = state.entity_map.get(entityId) ?? emptyAcc(entityId);
  acc.session_count += 1;
  acc.message_count += row.message_count ?? 0;
  acc.avg_conf_sum += row.avg_confidence ?? 0;
  acc.session_ids.push(row.session_id);

  for (const sig of row.behavior_signals ?? []) {
    incr(acc.signal_occurrence, sig.signal_name, 1);
    incr(acc.signal_families, sig.signal_family, 1);
    acc.signal_sessions[sig.signal_name] = acc.signal_sessions[sig.signal_name] ?? new Set<string>();
    acc.signal_sessions[sig.signal_name].add(row.session_id);
  }

  state.entity_map.set(entityId, acc);
}

export function finalizeBehaviorAggregation(
  state: BehaviorAggregationState,
  month: string
): {
  records: AggregatedBehaviorRecord[];
  summary: AggregationSummary;
  audit: AggregationAudit;
} {
  const records = Array.from(state.entity_map.values())
    .map((acc) => buildEntityRecord(acc, month))
    .sort((a, b) => a.entity_id.localeCompare(b.entity_id));

  const patternFamilyCounts: Record<string, number> = {};
  const patternNameCounts: Record<string, number> = {};
  const contextDistribution: Record<string, number> = {};
  let totalPatterns = 0;
  let highConfidencePatterns = 0;
  let weakPatterns = 0;
  let stableBehaviorCount = 0;
  let unstableBehaviorCount = 0;

  for (const rec of records) {
    const hasStable = rec.aggregated_patterns.some((p) => p.stability !== "weak");
    if (hasStable) stableBehaviorCount += 1;
    else unstableBehaviorCount += 1;

    for (const p of rec.aggregated_patterns) {
      totalPatterns += 1;
      incr(patternFamilyCounts, p.pattern_family, 1);
      incr(patternNameCounts, p.pattern_name, 1);
      incr(contextDistribution, p.context_group, 1);
      if (p.confidence >= 0.85) highConfidencePatterns += 1;
      if (p.stability === "weak") weakPatterns += 1;
    }
  }

  const topPatterns = Object.entries(patternNameCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([pattern_name, count]) => ({ pattern_name, count }));

  const summary: AggregationSummary = {
    total_entities: records.length,
    total_aggregated_patterns: totalPatterns,
    pattern_family_counts: patternFamilyCounts,
    top_patterns: topPatterns,
    high_confidence_patterns: highConfidencePatterns,
    weak_patterns: weakPatterns,
    context_distribution: contextDistribution,
    stable_behavior_count: stableBehaviorCount,
    unstable_behavior_count: unstableBehaviorCount
  };

  let contradictoryPatternCount = 0;
  let weakSingleSessionPatternCount = 0;
  let unstablePatternCount = 0;
  let overAggregatedPatternCount = 0;
  let unsupportedHighConfidencePatternCount = 0;
  let contextConflictCount = 0;
  let entitiesWithNoPatterns = 0;
  const riskFlagsSummary: Record<string, number> = {};

  for (const rec of records) {
    if (rec.aggregated_patterns.length === 0) entitiesWithNoPatterns += 1;
    if (rec.aggregated_patterns.length > 10) overAggregatedPatternCount += 1;
    if (rec.risk_flags.some((f) => f.startsWith("contradiction:"))) contradictoryPatternCount += 1;
    if (rec.risk_flags.some((f) => f.startsWith("confidence_mismatch:"))) contextConflictCount += 1;

    for (const rf of rec.risk_flags) incr(riskFlagsSummary, rf, 1);

    for (const p of rec.aggregated_patterns) {
      if (p.evidence_sessions.length < 2) weakSingleSessionPatternCount += 1;
      if (p.stability === "weak") unstablePatternCount += 1;
      if (p.confidence >= 0.85 && p.supporting_signal_count < 2) {
        unsupportedHighConfidencePatternCount += 1;
      }
    }
  }

  const audit: AggregationAudit = {
    contradictory_pattern_count: contradictoryPatternCount,
    weak_single_session_pattern_count: weakSingleSessionPatternCount,
    unstable_pattern_count: unstablePatternCount,
    over_aggregated_pattern_count: overAggregatedPatternCount,
    unsupported_high_confidence_pattern_count: unsupportedHighConfidencePatternCount,
    context_conflict_count: contextConflictCount,
    entities_with_no_patterns: entitiesWithNoPatterns,
    risk_flags_summary: riskFlagsSummary
  };

  return { records, summary, audit };
}

export function aggregateBehaviorByConversation(
  sessionRecords: BehaviorSessionRecord[],
  month: string
): {
  records: AggregatedBehaviorRecord[];
  summary: AggregationSummary;
  audit: AggregationAudit;
} {
  const state = createBehaviorAggregationState();
  for (const row of sessionRecords) {
    addBehaviorSessionToAggregation(state, row);
  }
  return finalizeBehaviorAggregation(state, month);
}
