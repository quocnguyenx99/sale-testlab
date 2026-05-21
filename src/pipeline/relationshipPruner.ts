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

export interface PrunedRelationship extends ContextRelationship {
  relevance_score: number;
  pruning_status: "kept" | "downgraded" | "pruned";
  pruning_reason: string;
}

export interface PrunedContextRecord {
  entity_id: string;
  aggregation_window: string;
  relationships_before: number;
  relationships_after: number;
  pruned_relationships: PrunedRelationship[];
  risk_flags: string[];
}

export interface PruningSummary {
  total_entities: number;
  relationships_before: number;
  relationships_after: number;
  relationships_pruned: number;
  relationships_downgraded: number;
  relationships_kept: number;
  high_value_relationships: number;
  medium_value_relationships: number;
  low_value_relationships: number;
  timing_noise_removed: number;
  average_relationships_per_entity_before: number;
  average_relationships_per_entity_after: number;
}

export interface PruningAudit {
  overconnected_entities_before: number;
  overconnected_entities_after: number;
  timing_only_relationships_removed: number;
  weak_relationships_removed: number;
  operational_relationships_preserved: number;
  sales_relationships_preserved: number;
  high_value_relationship_loss: number;
  risk_flags_summary: Record<string, number>;
}

function incr(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

const HIGH_VALUE_PATTERN_PAIRS = [
  ["repeated_price_inquiry_pattern", "repeated_product_research_pattern"],
  ["repeated_payment_followup_pattern", "tod_resolution_pattern"],
  ["operational_workflow_pattern", "frequent_unc_submission_pattern"],
  ["logistics_followup_pattern", "repeated_payment_followup_pattern"],
  ["repeated_product_research_pattern", "repeated_stock_check_pattern"]
];

function includesPair(patterns: string[], pair: string[]): boolean {
  return pair.every((p) => patterns.includes(p));
}

function isTimingOnly(rel: ContextRelationship): boolean {
  if (rel.context_type !== "timing_context") return false;
  const nonTimingTokens = ["sales", "payment", "operational", "logistics", "product", "stock", "unc", "tod"];
  const name = rel.relationship_name.toLowerCase();
  return !nonTimingTokens.some((t) => name.includes(t));
}

function scoreRelationship(rel: ContextRelationship): { score: number; bucket: "high" | "medium" | "low" } {
  let score = 40;
  if (rel.context_type === "operational_context" || rel.context_type === "payment_context") score += 18;
  if (rel.context_type === "sales_context") score += 14;
  if (rel.context_type === "logistics_context") score += 12;
  if (rel.relationship_family === "sequential") score += 10;
  if (rel.stability === "strong") score += 15;
  if (rel.stability === "moderate") score += 8;
  score += Math.min(12, rel.supporting_sessions.length * 2);
  score += Math.min(10, rel.supporting_patterns.length * 2);

  if (HIGH_VALUE_PATTERN_PAIRS.some((pair) => includesPair(rel.patterns_involved, pair))) score += 20;

  if (isTimingOnly(rel)) score -= 22;
  if (rel.stability === "weak") score -= 10;
  if (rel.relationship_name.includes("rapid") && rel.relationship_name.includes("slow")) score -= 8;

  score = Math.max(0, Math.min(100, score));
  let bucket: "high" | "medium" | "low" = "medium";
  if (score >= 75) bucket = "high";
  else if (score < 45) bucket = "low";
  return { score, bucket };
}

function shouldPrune(
  rel: ContextRelationship,
  scored: { score: number; bucket: "high" | "medium" | "low" },
  hasOperationalOrSalesContext: boolean
): { status: "kept" | "downgraded" | "pruned"; reason: string } {
  const name = rel.relationship_name.toLowerCase();
  const timingOnly = isTimingOnly(rel);

  if (timingOnly && !hasOperationalOrSalesContext) {
    return { status: "pruned", reason: "timing_only_without_operational_or_sales_support" };
  }

  if (
    name.includes("short_operational_reply_pattern") &&
    (rel.context_type === "timing_context" || rel.context_type === "communication_context") &&
    !hasOperationalOrSalesContext
  ) {
    return { status: "pruned", reason: "weak_short_reply_without_operational_or_payment_context" };
  }

  if (scored.bucket === "low" && rel.stability === "weak") {
    return { status: "pruned", reason: "low_relevance_weak_stability" };
  }

  if (name.includes("rapid") && name.includes("slow")) {
    return { status: "downgraded", reason: "pacing_contradiction_downgraded_not_pruned" };
  }

  if (scored.bucket === "low") {
    return { status: "downgraded", reason: "low_relevance_downgraded" };
  }

  return { status: "kept", reason: "relevance_and_evidence_sufficient" };
}

export function pruneContextRelationships(
  records: ContextualRecord[]
): { records: PrunedContextRecord[]; summary: PruningSummary; audit: PruningAudit } {
  const MAX_REL_PER_ENTITY = 18;
  const out: PrunedContextRecord[] = [];

  let before = 0;
  let after = 0;
  let pruned = 0;
  let downgraded = 0;
  let kept = 0;
  let highValue = 0;
  let mediumValue = 0;
  let lowValue = 0;
  let timingNoiseRemoved = 0;
  let overBefore = 0;
  let overAfter = 0;
  let timingOnlyRemoved = 0;
  let weakRemoved = 0;
  let opPreserved = 0;
  let salesPreserved = 0;
  let highValueLoss = 0;
  const riskSummary: Record<string, number> = {};

  for (const rec of records) {
    const rels = rec.context_relationships ?? [];
    before += rels.length;
    if (rels.length > MAX_REL_PER_ENTITY) overBefore += 1;
    const hasOpSales =
      (rec.dominant_contexts["operational_context"] ?? 0) > 0 ||
      (rec.dominant_contexts["sales_context"] ?? 0) > 0;

    const scored = rels.map((r) => {
      const s = scoreRelationship(r);
      if (s.bucket === "high") highValue += 1;
      else if (s.bucket === "medium") mediumValue += 1;
      else lowValue += 1;
      const dec = shouldPrune(r, s, hasOpSales);
      const pr: PrunedRelationship = {
        ...r,
        relevance_score: s.score,
        pruning_status: dec.status,
        pruning_reason: dec.reason
      };
      return pr;
    });

    // Over-connection control: keep top by relevance if above threshold
    let ranked = [...scored].sort((a, b) => b.relevance_score - a.relevance_score);
    if (ranked.filter((r) => r.pruning_status !== "pruned").length > MAX_REL_PER_ENTITY) {
      let keepBudget = MAX_REL_PER_ENTITY;
      ranked = ranked.map((r) => {
        if (r.pruning_status === "pruned") return r;
        if (keepBudget > 0) {
          keepBudget -= 1;
          return r;
        }
        return { ...r, pruning_status: "pruned", pruning_reason: "overconnection_rank_prune" };
      });
    }

    const finalRels = ranked.filter((r) => r.pruning_status !== "pruned");
    if (finalRels.length > MAX_REL_PER_ENTITY) overAfter += 1;

    for (const r of ranked) {
      if (r.pruning_status === "pruned") {
        pruned += 1;
        if (isTimingOnly(r)) {
          timingNoiseRemoved += 1;
          timingOnlyRemoved += 1;
        }
        if (r.stability === "weak") weakRemoved += 1;
        if (r.relevance_score >= 75) highValueLoss += 1;
      } else if (r.pruning_status === "downgraded") {
        downgraded += 1;
      } else {
        kept += 1;
      }

      if (r.pruning_status !== "pruned" && r.context_type === "operational_context") opPreserved += 1;
      if (r.pruning_status !== "pruned" && r.context_type === "sales_context") salesPreserved += 1;
    }

    after += finalRels.length;
    for (const rf of rec.risk_flags ?? []) incr(riskSummary, rf, 1);

    out.push({
      entity_id: rec.entity_id,
      aggregation_window: rec.aggregation_window,
      relationships_before: rels.length,
      relationships_after: finalRels.length,
      pruned_relationships: ranked,
      risk_flags: rec.risk_flags ?? []
    });
  }

  const summary: PruningSummary = {
    total_entities: records.length,
    relationships_before: before,
    relationships_after: after,
    relationships_pruned: pruned,
    relationships_downgraded: downgraded,
    relationships_kept: kept,
    high_value_relationships: highValue,
    medium_value_relationships: mediumValue,
    low_value_relationships: lowValue,
    timing_noise_removed: timingNoiseRemoved,
    average_relationships_per_entity_before: records.length ? Number((before / records.length).toFixed(4)) : 0,
    average_relationships_per_entity_after: records.length ? Number((after / records.length).toFixed(4)) : 0
  };

  const audit: PruningAudit = {
    overconnected_entities_before: overBefore,
    overconnected_entities_after: overAfter,
    timing_only_relationships_removed: timingOnlyRemoved,
    weak_relationships_removed: weakRemoved,
    operational_relationships_preserved: opPreserved,
    sales_relationships_preserved: salesPreserved,
    high_value_relationship_loss: highValueLoss,
    risk_flags_summary: riskSummary
  };

  return { records: out, summary, audit };
}

