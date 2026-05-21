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

export interface ContextRelationship {
  relationship_name: string;
  relationship_family: string;
  patterns_involved: string[];
  relationship_strength: number;
  supporting_sessions: string[];
  supporting_patterns: string[];
  relationship_reason: string;
  context_type:
    | "sales_context"
    | "operational_context"
    | "logistics_context"
    | "mixed_context"
    | "timing_context"
    | "communication_context"
    | "payment_context";
  stability: "weak" | "moderate" | "strong";
}

export interface ContextualRecord {
  entity_id: string;
  aggregation_window: string;
  context_relationships: ContextRelationship[];
  dominant_contexts: Record<string, number>;
  behavioral_transitions: Record<string, number>;
  relationship_clusters: Record<string, string[]>;
  risk_flags: string[];
}

export interface ContextSummary {
  total_entities: number;
  total_relationships: number;
  relationship_family_counts: Record<string, number>;
  dominant_context_distribution: Record<string, number>;
  top_relationships: Array<{ relationship_name: string; count: number }>;
  strong_relationship_count: number;
  weak_relationship_count: number;
  stable_context_entities: number;
  mixed_context_entities: number;
}

export interface ContextAudit {
  contradictory_relationship_count: number;
  weak_relationship_count: number;
  unstable_sequence_count: number;
  over_connected_entity_count: number;
  unsupported_relationship_count: number;
  context_conflict_count: number;
  risk_flags_summary: Record<string, number>;
}

function incr(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function parseSessionIndex(sessionId: string): number {
  const m = sessionId.match(/-(\d{4,})$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return Number(m[1]);
}

function overlapCount(a: string[], b: string[]): number {
  const bs = new Set(b);
  let c = 0;
  for (const x of a) if (bs.has(x)) c += 1;
  return c;
}

function relationshipStrength(
  supportSessionCount: number,
  supportPatternCount: number,
  contradictionPenalty = 0
): number {
  let score = 0.35;
  score += Math.min(0.35, supportSessionCount * 0.12);
  score += Math.min(0.25, supportPatternCount * 0.08);
  score -= contradictionPenalty;
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

function stabilityFromSupport(
  supportSessionCount: number,
  supportPatternCount: number
): "weak" | "moderate" | "strong" {
  if (supportSessionCount >= 4 && supportPatternCount >= 3) return "strong";
  if (supportSessionCount >= 2 && supportPatternCount >= 2) return "moderate";
  return "weak";
}

function contextFromPatterns(patterns: AggregatedPattern[]): Record<string, number> {
  const d: Record<string, number> = {};
  for (const p of patterns) incr(d, p.context_group, 1);
  return d;
}

function dominantContext(contexts: Record<string, number>): string {
  let best = "mixed_context";
  let max = -1;
  for (const [k, v] of Object.entries(contexts)) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}

function relationshipClusterMap(relationships: ContextRelationship[]): Record<string, string[]> {
  const out: Record<string, string[]> = {
    sales_cluster: [],
    operational_cluster: [],
    logistics_cluster: [],
    communication_cluster: [],
    timing_cluster: [],
    mixed_cluster: []
  };
  for (const r of relationships) {
    if (r.context_type === "sales_context") out.sales_cluster.push(r.relationship_name);
    else if (r.context_type === "operational_context") out.operational_cluster.push(r.relationship_name);
    else if (r.context_type === "logistics_context") out.logistics_cluster.push(r.relationship_name);
    else if (r.context_type === "communication_context") out.communication_cluster.push(r.relationship_name);
    else if (r.context_type === "timing_context") out.timing_cluster.push(r.relationship_name);
    else out.mixed_cluster.push(r.relationship_name);
  }
  return out;
}

function buildCoOccurrenceRelationships(patterns: AggregatedPattern[]): ContextRelationship[] {
  const out: ContextRelationship[] = [];
  for (let i = 0; i < patterns.length; i += 1) {
    for (let j = i + 1; j < patterns.length; j += 1) {
      const a = patterns[i];
      const b = patterns[j];
      const overlap = overlapCount(a.evidence_sessions, b.evidence_sessions);
      if (overlap < 2) continue;
      const sessions = uniq([...a.evidence_sessions.filter((s) => b.evidence_sessions.includes(s))]).sort();
      const st = stabilityFromSupport(sessions.length, 2);
      const rel: ContextRelationship = {
        relationship_name: `cooccurrence:${a.pattern_name}+${b.pattern_name}`,
        relationship_family: "co_occurrence",
        patterns_involved: [a.pattern_name, b.pattern_name],
        relationship_strength: relationshipStrength(sessions.length, 2),
        supporting_sessions: sessions,
        supporting_patterns: [a.pattern_name, b.pattern_name],
        relationship_reason: `Patterns co-occurred in ${sessions.length} shared sessions`,
        context_type:
          a.context_group === b.context_group
            ? (a.context_group as ContextRelationship["context_type"])
            : "mixed_context",
        stability: st
      };
      out.push(rel);
    }
  }
  return out;
}

function buildFlowRelationships(patterns: AggregatedPattern[]): ContextRelationship[] {
  const map = new Map<string, AggregatedPattern>();
  for (const p of patterns) map.set(p.pattern_name, p);
  const out: ContextRelationship[] = [];

  function addFlow(
    name: string,
    family: string,
    seq: string[],
    reason: string,
    context: ContextRelationship["context_type"]
  ): void {
    const used = seq.map((x) => map.get(x)).filter(Boolean) as AggregatedPattern[];
    if (used.length < 2) return;
    let sessions = used[0].evidence_sessions;
    for (let i = 1; i < used.length; i += 1) {
      sessions = sessions.filter((s) => used[i].evidence_sessions.includes(s));
    }
    if (sessions.length < 2) return;
    const st = stabilityFromSupport(sessions.length, used.length);
    out.push({
      relationship_name: name,
      relationship_family: family,
      patterns_involved: used.map((u) => u.pattern_name),
      relationship_strength: relationshipStrength(sessions.length, used.length),
      supporting_sessions: sessions.sort(),
      supporting_patterns: used.map((u) => u.pattern_name),
      relationship_reason: reason,
      context_type: context,
      stability: st
    });
  }

  addFlow(
    "sequence:price_inquiry_to_payment_followup",
    "sequential",
    ["repeated_price_inquiry_pattern", "repeated_payment_followup_pattern"],
    "Price inquiry pattern repeatedly shares sessions with payment follow-up pattern",
    "sales_context"
  );
  addFlow(
    "sequence:operational_workflow_to_logistics_followup",
    "sequential",
    ["operational_workflow_pattern", "logistics_followup_pattern"],
    "Operational workflow pattern repeatedly shares sessions with logistics follow-up",
    "operational_context"
  );
  addFlow(
    "sequence:product_research_to_stock_to_payment",
    "sequential",
    [
      "repeated_product_research_pattern",
      "repeated_stock_check_pattern",
      "repeated_payment_followup_pattern"
    ],
    "Product research + stock check + payment follow-up repeatedly co-appear",
    "sales_context"
  );

  return out;
}

function buildDominanceRelationship(patterns: AggregatedPattern[]): ContextRelationship[] {
  if (patterns.length === 0) return [];
  const contexts = contextFromPatterns(patterns);
  const dominant = dominantContext(contexts) as ContextRelationship["context_type"];
  const total = Object.values(contexts).reduce((a, b) => a + b, 0);
  const domCount = contexts[dominant] ?? 0;
  if (total === 0 || domCount === 0) return [];
  const rel: ContextRelationship = {
    relationship_name: `dominance:${dominant}`,
    relationship_family: "context_dominance",
    patterns_involved: patterns
      .filter((p) => p.context_group === dominant)
      .map((p) => p.pattern_name),
    relationship_strength: Number((domCount / total).toFixed(4)),
    supporting_sessions: uniq(patterns.flatMap((p) => p.evidence_sessions)).sort(),
    supporting_patterns: patterns
      .filter((p) => p.context_group === dominant)
      .map((p) => p.pattern_name),
    relationship_reason: `Dominant context ${dominant} appears in ${domCount}/${total} patterns`,
    context_type: dominant,
    stability: domCount >= 3 ? "strong" : domCount >= 2 ? "moderate" : "weak"
  };
  return [rel];
}

function buildBehavioralTransitions(patterns: AggregatedPattern[]): Record<string, number> {
  const edges: Record<string, number> = {};
  for (const p of patterns) {
    const sessionsSorted = [...p.evidence_sessions].sort((a, b) => parseSessionIndex(a) - parseSessionIndex(b));
    if (sessionsSorted.length < 2) continue;
    const edge = `${sessionsSorted[0]}->${sessionsSorted[sessionsSorted.length - 1]}`;
    incr(edges, edge, 1);
  }
  return edges;
}

function detectRelationshipRisks(
  relationships: ContextRelationship[],
  dominant: Record<string, number>
): string[] {
  const flags: string[] = [];
  const names = new Set(relationships.map((r) => r.relationship_name));
  if (names.has("sequence:price_inquiry_to_payment_followup") && !names.has("dominance:sales_context")) {
    flags.push("context_conflict:sales_sequence_without_sales_dominance");
  }
  if (names.has("cooccurrence:rapid_multi_message_pattern+slow_paced_interaction_pattern")) {
    flags.push("contradiction:rapid_and_slow_timing_coexist");
  }
  if (
    names.has("cooccurrence:short_operational_reply_pattern+high_frequency_operational_chat_pattern") &&
    (dominant["operational_context"] ?? 0) === 0
  ) {
    flags.push("context_conflict:operational_reply_without_operational_dominance");
  }
  for (const r of relationships) {
    if (r.relationship_strength >= 0.85 && r.supporting_sessions.length < 2) {
      flags.push(`unsupported_high_confidence:${r.relationship_name}`);
    }
  }
  return uniq(flags);
}

export function buildContextualRelationships(
  entities: AggregatedBehaviorRecord[]
): { records: ContextualRecord[]; summary: ContextSummary; audit: ContextAudit } {
  const records: ContextualRecord[] = [];

  for (const e of entities) {
    const patterns = e.aggregated_patterns ?? [];
    const co = buildCoOccurrenceRelationships(patterns);
    const seq = buildFlowRelationships(patterns);
    const dom = buildDominanceRelationship(patterns);
    const relationships = [...co, ...seq, ...dom];

    const domContexts = contextFromPatterns(patterns);
    const transitions = buildBehavioralTransitions(patterns);
    const clusters = relationshipClusterMap(relationships);
    const risks = detectRelationshipRisks(relationships, domContexts);

    records.push({
      entity_id: e.entity_id,
      aggregation_window: e.aggregation_window,
      context_relationships: relationships,
      dominant_contexts: domContexts,
      behavioral_transitions: transitions,
      relationship_clusters: clusters,
      risk_flags: uniq([...(e.risk_flags ?? []), ...risks])
    });
  }

  const familyCounts: Record<string, number> = {};
  const dominantDist: Record<string, number> = {};
  const relationshipNameCounts: Record<string, number> = {};
  const riskSummary: Record<string, number> = {};
  let totalRelationships = 0;
  let strongCount = 0;
  let weakCount = 0;
  let stableEntities = 0;
  let mixedEntities = 0;

  for (const r of records) {
    const dom = dominantContext(r.dominant_contexts);
    incr(dominantDist, dom, 1);
    if (dom === "mixed_context") mixedEntities += 1;
    if (r.context_relationships.some((x) => x.stability !== "weak")) stableEntities += 1;

    for (const rel of r.context_relationships) {
      totalRelationships += 1;
      incr(familyCounts, rel.relationship_family, 1);
      incr(relationshipNameCounts, rel.relationship_name, 1);
      if (rel.stability === "strong") strongCount += 1;
      if (rel.stability === "weak") weakCount += 1;
    }
    for (const rf of r.risk_flags) incr(riskSummary, rf, 1);
  }

  const topRelationships = Object.entries(relationshipNameCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([relationship_name, count]) => ({ relationship_name, count }));

  const summary: ContextSummary = {
    total_entities: records.length,
    total_relationships: totalRelationships,
    relationship_family_counts: familyCounts,
    dominant_context_distribution: dominantDist,
    top_relationships: topRelationships,
    strong_relationship_count: strongCount,
    weak_relationship_count: weakCount,
    stable_context_entities: stableEntities,
    mixed_context_entities: mixedEntities
  };

  let contradictory = 0;
  let weakRel = 0;
  let unstableSeq = 0;
  let overConnected = 0;
  let unsupportedHigh = 0;
  let contextConflict = 0;

  for (const r of records) {
    if (r.context_relationships.length > 12) overConnected += 1;
    for (const rel of r.context_relationships) {
      if (rel.stability === "weak") weakRel += 1;
      if (rel.relationship_family === "sequential" && rel.stability === "weak") unstableSeq += 1;
      if (rel.relationship_strength >= 0.85 && rel.supporting_sessions.length < 2) unsupportedHigh += 1;
    }
    if (r.risk_flags.some((x) => x.includes("contradiction:"))) contradictory += 1;
    if (r.risk_flags.some((x) => x.includes("context_conflict:"))) contextConflict += 1;
  }

  const audit: ContextAudit = {
    contradictory_relationship_count: contradictory,
    weak_relationship_count: weakRel,
    unstable_sequence_count: unstableSeq,
    over_connected_entity_count: overConnected,
    unsupported_relationship_count: unsupportedHigh,
    context_conflict_count: contextConflict,
    risk_flags_summary: riskSummary
  };

  return { records, summary, audit };
}

