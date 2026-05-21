export interface RuntimePersona {
  runtime_persona_id: string;
  source_entity_id: string;
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
  interaction_patterns: {
    pattern_name: string;
    priority: string;
    stability: string;
    runtime_weight: number;
  }[];
  risk_flags: string[];
}

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

export interface ArchetypeBuilderResult {
  archetypes: Archetype[];
  outliers: Archetype[];
  summary: any;
  audit: any;
}

const vnPatternNames: Record<string, string> = {
  logistics_followup_tendency: "hỏi giao hàng",
  high_frequency_operational_coordination: "nhắn tin liên tục",
  price_sensitive_research_behavior: "khảo giá",
  repeated_product_comparison_behavior: "so sánh nhiều model",
  short_operational_response_style: "trả lời ngắn gọn",
  operational_payment_followup_behavior: "hỏi thanh toán/UNC",
  detailed_product_inquiry_behavior: "hỏi kỹ cấu hình",
  document_request_pattern: "yêu cầu chứng từ",
  bulk_purchase_pattern: "hỏi mua sỉ",
  repeated_price_inquiry_behavior: "hỏi giá nhiều lần",
  repeated_stock_check_pattern: "check tồn kho liên tục"
};

function determineArchetypeGroup(p: RuntimePersona): { key: string; name: string } {
  const sortedPatterns = [...p.interaction_patterns].sort((a, b) => b.runtime_weight - a.runtime_weight);
  const topPatterns = sortedPatterns.map(x => x.pattern_name);

  const contexts = p.primary_contexts || [];
  const primaryContext = contexts.length > 0 ? contexts[0] : "mixed_context";

  if (topPatterns.length === 0) {
    return { key: `fallback_${primaryContext}`, name: `Khách thiếu pattern rõ ràng (${primaryContext})` };
  }

  const p1 = topPatterns[0];
  const p2 = topPatterns[1]; // may be undefined
  
  const getContextSuffix = (ctx: string) => {
    switch (ctx) {
      case "sales_context": return "thiên hướng mua hàng";
      case "logistics_context": return "quan tâm vận chuyển";
      case "payment_context": return "quan tâm thanh toán";
      case "mixed_context": return "mục đích hỗn hợp";
      case "operational_context": return "trao đổi vận hành";
      case "communication_context": return "cần tương tác nhiều";
      default: return "";
    }
  };

  const name1 = vnPatternNames[p1] || p1.replace(/_/g, " ");
  const name2 = p2 ? (vnPatternNames[p2] || p2.replace(/_/g, " ")) : "";

  let key = p2 ? `${p1}_${p2}_${primaryContext}` : `${p1}_only_${primaryContext}`;
  
  let finalName = p2 ? `Khách ${name1} kết hợp ${name2}` : `Khách chuyên ${name1}`;
  const suffix = getContextSuffix(primaryContext);
  if (suffix) {
    finalName += ` (${suffix})`;
  }

  return { key, name: finalName };
}

function calculateConfidence(personas: RuntimePersona[]): number {
  if (personas.length === 0) return 0;
  
  const avgUsefulness = personas.reduce((sum, p) => sum + p.runtime_usefulness_score, 0) / personas.length;
  const approvedCount = personas.filter(p => p.runtime_readiness === "approved").length;
  const approvedRatio = approvedCount / personas.length;
  
  let riskPenalty = 0;
  personas.forEach(p => {
    if (p.risk_flags.length > 0) riskPenalty += 2;
    if (p.risk_flags.includes("contradiction:rapid_vs_slow_pacing")) riskPenalty += 5;
  });
  riskPenalty = Math.min(30, riskPenalty / personas.length);
  
  const sourceBonus = Math.min(20, personas.length * 2);
  
  let confidence = (avgUsefulness * 0.5) + (approvedRatio * 30) + sourceBonus - riskPenalty;
  return Math.max(0, Math.min(100, Math.round(confidence)));
}

export function buildArchetypes(personasInput: RuntimePersona[]): ArchetypeBuilderResult {
  const approvedAndLimited = personasInput.filter(p => p.runtime_readiness !== "archive_only");
  const archiveOnly = personasInput.filter(p => p.runtime_readiness === "archive_only");
  
  const archiveIds = archiveOnly.map(p => p.runtime_persona_id);
  
  let groups: Record<string, { name: string; personas: RuntimePersona[] }> = {};
  
  for (const p of approvedAndLimited) {
    const { key, name } = determineArchetypeGroup(p);
    if (!groups[key]) groups[key] = { name, personas: [] };
    groups[key].personas.push(p);
  }
  
  // Pass 2: Split oversized groups
  const MAX_GROUP_SIZE = approvedAndLimited.length * 0.20;
  const newGroups: Record<string, { name: string; personas: RuntimePersona[] }> = {};

  for (const [key, group] of Object.entries(groups)) {
    if (group.personas.length > MAX_GROUP_SIZE) {
      // Split by 3rd pattern
      group.personas.forEach(p => {
        const sortedPatterns = [...p.interaction_patterns].sort((a, b) => b.runtime_weight - a.runtime_weight);
        const topPatterns = sortedPatterns.map(x => x.pattern_name);
        const p3 = topPatterns[2];
        
        if (p3) {
          const name3 = vnPatternNames[p3] || p3.replace(/_/g, " ");
          const splitKey = `${key}_${p3}`;
          const splitName = `${group.name} (thêm ${name3})`;
          if (!newGroups[splitKey]) newGroups[splitKey] = { name: splitName, personas: [] };
          newGroups[splitKey].personas.push(p);
        } else {
          // If no 3rd pattern, keep in original group
          if (!newGroups[key]) newGroups[key] = { name: group.name, personas: [] };
          newGroups[key].personas.push(p);
        }
      });
    } else {
      newGroups[key] = group;
    }
  }
  
  groups = newGroups;

  const allArchetypes: Archetype[] = [];
  const outliers: Archetype[] = [];
  
  let idCounter = 1;
  
  for (const [key, group] of Object.entries(groups)) {
    const pList = group.personas;
    const confidence = calculateConfidence(pList);
    const approvedCount = pList.filter(p => p.runtime_readiness === "approved").length;
    const limitedCount = pList.filter(p => p.runtime_readiness === "limited").length;
    
    // Determine difficulty
    const allContexts = new Set<string>();
    const allRiskFlags = new Set<string>();
    let totalPatterns = 0;
    
    pList.forEach(p => {
      p.primary_contexts.forEach(c => allContexts.add(c));
      p.risk_flags.forEach(f => allRiskFlags.add(f));
      totalPatterns += p.interaction_patterns.length;
    });
    
    let difficulty: "easy" | "medium" | "hard" = "medium";
    if (allContexts.size > 2 && allRiskFlags.size > 0) difficulty = "hard";
    else if (allContexts.size <= 1 && allRiskFlags.size === 0) difficulty = "easy";
    
    // Collect behaviors
    const countBehaviors = (extractor: (p: RuntimePersona) => string[]) => {
      const counts: Record<string, number> = {};
      pList.forEach(p => {
        extractor(p).forEach(b => {
          counts[b] = (counts[b] || 0) + 1;
        });
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .filter(x => x[1] >= pList.length * 0.3) // present in at least 30% of personas
        .map(x => x[0]);
    };
    
    const corePatterns = countBehaviors(p => p.interaction_patterns.filter(x => x.runtime_weight > 0.6).map(x => x.pattern_name));
    const secondaryPatterns = countBehaviors(p => p.interaction_patterns.filter(x => x.runtime_weight <= 0.6).map(x => x.pattern_name));
    
    const readiness = approvedCount >= limitedCount ? "approved" : "limited";
    const evidence = confidence >= 70 ? "strong" : (confidence >= 40 ? "moderate" : "weak");

    const archetype: Archetype = {
      archetype_id: `archetype_${idCounter.toString().padStart(3, "0")}_${key}`,
      archetype_name: group.name,
      source_runtime_persona_ids: pList.map(p => p.runtime_persona_id),
      source_count: pList.length,
      approved_source_count: approvedCount,
      limited_source_count: limitedCount,
      dominant_contexts: Array.from(allContexts),
      core_behavior_patterns: corePatterns,
      secondary_behavior_patterns: secondaryPatterns,
      sales_behaviors: countBehaviors(p => p.runtime_behavior_profile.pricing_behavior),
      payment_behaviors: countBehaviors(p => p.runtime_behavior_profile.payment_behavior),
      logistics_behaviors: countBehaviors(p => p.runtime_behavior_profile.logistics_behavior),
      research_behaviors: countBehaviors(p => p.runtime_behavior_profile.research_behavior),
      communication_behaviors: countBehaviors(p => p.runtime_behavior_profile.communication_behavior),
      difficulty_hint: difficulty,
      runtime_readiness: readiness,
      evidence_strength: evidence,
      archetype_confidence: confidence,
      risk_flags: Array.from(allRiskFlags),
      excluded_personas: archiveIds
    };
    
    if (archetype.source_count === 1 && archetype.archetype_confidence < 40 && archetype.evidence_strength === "weak") {
      outliers.push(archetype);
    } else {
      allArchetypes.push(archetype);
    }
    
    idCounter++;
  }
  
  // Sort archetypes by source count
  allArchetypes.sort((a, b) => b.source_count - a.source_count);
  
  // Summary
  const difficultyDist = { easy: 0, medium: 0, hard: 0 };
  const evidenceDist = { weak: 0, moderate: 0, strong: 0 };
  const contextDist: Record<string, number> = {};
  
  allArchetypes.forEach(a => {
    difficultyDist[a.difficulty_hint]++;
    evidenceDist[a.evidence_strength]++;
    a.dominant_contexts.forEach(c => {
      contextDist[c] = (contextDist[c] || 0) + 1;
    });
  });

  const summary = {
    total_archetypes: allArchetypes.length,
    archetype_context_distribution: contextDist,
    difficulty_distribution: difficultyDist,
    evidence_strength_distribution: evidenceDist,
    top_archetypes_by_source_count: allArchetypes.slice(0, 5).map(a => ({ name: a.archetype_name, count: a.source_count })),
    top_archetypes_by_confidence: [...allArchetypes].sort((a, b) => b.archetype_confidence - a.archetype_confidence).slice(0, 5).map(a => ({ name: a.archetype_name, confidence: a.archetype_confidence })),
    excluded_persona_count: archiveOnly.length + outliers.reduce((sum, o) => sum + o.source_count, 0)
  };

  // Audit
  const oversized = allArchetypes.filter(a => a.source_count > approvedAndLimited.length * 0.2).map(a => a.archetype_name);
  const weakArchetypes = allArchetypes.filter(a => a.evidence_strength === "weak").map(a => a.archetype_name);
  
  const riskSummary: Record<string, number> = {};
  allArchetypes.forEach(a => {
    a.risk_flags.forEach(f => {
      riskSummary[f] = (riskSummary[f] || 0) + 1;
    });
  });

  const audit = {
    total_runtime_personas_input: personasInput.length,
    approved_personas_grouped: approvedAndLimited.filter(p => p.runtime_readiness === "approved").length,
    limited_personas_grouped: approvedAndLimited.filter(p => p.runtime_readiness === "limited").length,
    archive_only_excluded: archiveOnly.length,
    total_archetypes: allArchetypes.length,
    outlier_personas: outliers.reduce((sum, o) => sum + o.source_count, 0),
    oversized_archetypes: oversized,
    weak_archetypes: weakArchetypes,
    duplicate_archetype_candidates: 0,
    risk_flags_summary: riskSummary
  };

  return { archetypes: allArchetypes, outliers, summary, audit };
}
