import { RuntimeState } from "./runtimeConstraints";
import {
  FALLBACK_SCENARIO,
  PRODUCT_SCENARIOS,
  ProductScenario
} from "./productScenarioCatalog";
import { inferVoiceGroup, VoiceGroup } from "./responseBank";
import { buildIdentityProfileFromPersona } from "./conversationIdentity";
import { searchProducts } from "./productKnowledge/productKnowledge";
import { ProductKnowledgeItem } from "./productKnowledge/normalize_products";

type OpeningPersona = {
  persona_id?: string;
  display_name?: string;
  name?: string;
  buyer_role?: string;
  product_interest_categories?: string[];
  behavior_rules?: string[];
  purchase_context?: string;
  runtime_contexts?: string[];
};

export type OpeningSourceType =
  | "catalog_grounded"
  | "persona_template"
  | "fallback_template";

function normalize(input: string): string {
  return (input || "")
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function scoreScenario(scenario: ProductScenario, persona: OpeningPersona): number {
  const categories = persona.product_interest_categories || [];
  const behavior = persona.behavior_rules || [];
  const context = persona.purchase_context || "";
  const identity = `${persona.display_name || ""} ${persona.name || ""} ${persona.buyer_role || ""}`;

  const categoryText = normalize(categories.join(" "));
  const behaviorText = normalize(behavior.join(" "));
  const contextText = normalize(context);
  const identityText = normalize(identity);

  let score = 0;
  for (const pattern of scenario.suitable_persona_patterns) {
    const p = normalize(pattern);
    if (!p) continue;
    if (categoryText.includes(p)) score += 6;
    if (behaviorText.includes(p)) score += 3;
    if (contextText.includes(p)) score += 2;
    if (identityText.includes(p)) score += 2;
  }
  return score;
}

function findScenario(persona: OpeningPersona): ProductScenario {
  let best = FALLBACK_SCENARIO;
  let bestScore = 0;

  for (const scenario of PRODUCT_SCENARIOS) {
    const score = scoreScenario(scenario, persona);
    if (score > bestScore) {
      bestScore = score;
      best = scenario;
    }
  }

  return bestScore > 0 ? best : FALLBACK_SCENARIO;
}

function hasPlaceholder(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  if (lower.includes("undefined") || lower.includes("null") || lower.includes("placeholder")) {
    return true;
  }
  if (/\[.*?model.*?\]/i.test(text) || /\{.*?model.*?\}/i.test(text)) {
    return true;
  }
  if (/\[[^\]]*?tên[^\]]*?\]/i.test(text) || /\[[^\]]*?chưa[^\]]*?\]/i.test(text)) {
    return true;
  }
  return false;
}

function dedupeProducts(items: ProductKnowledgeItem[]): ProductKnowledgeItem[] {
  const seen = new Set<string>();
  const unique: ProductKnowledgeItem[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

function buildCatalogQueries(persona: OpeningPersona, scenario: ProductScenario): string[] {
  const queries: string[] = [];
  const seen = new Set<string>();
  const push = (value: string | undefined | null): void => {
    const clean = (value || "").trim();
    if (!clean) return;
    const key = normalize(clean);
    if (!key || seen.has(key)) return;
    seen.add(key);
    queries.push(clean);
  };

  for (const category of persona.product_interest_categories || []) {
    push(category);
  }

  return queries;
}

function getCatalogCandidates(persona: OpeningPersona, scenario: ProductScenario): ProductKnowledgeItem[] {
  const candidates: ProductKnowledgeItem[] = [];
  for (const query of buildCatalogQueries(persona, scenario)) {
    const found = searchProducts(query, { limit: 3 });
    candidates.push(...found);
    const unique = dedupeProducts(candidates);
    if (unique.length >= 3) {
      return unique.slice(0, 3);
    }
  }
  return dedupeProducts(candidates).slice(0, 3);
}

function chooseCatalogCandidate(
  candidates: ProductKnowledgeItem[],
  persona: OpeningPersona,
  scenario: ProductScenario
): ProductKnowledgeItem {
  const seed = stableHash(`${persona.persona_id || "unknown_persona"}:${scenario.scenario_id}:catalog`);
  return candidates[seed % candidates.length];
}

function buildGroundedScenario(base: ProductScenario, candidate: ProductKnowledgeItem): ProductScenario {
  return {
    ...base,
    category: candidate.category1 || candidate.category2 || base.category,
    scenario_product: candidate.display_name || base.scenario_product
  };
}

const VOICE_OPENINGS_DEFAULT: Record<VoiceGroup, string[]> = {
  corporate_buyer: [
    "{self_cap} cần tìm {product} cho công ty. {sale_cap} tư vấn và gửi báo giá kèm thủ tục xuất hóa đơn VAT giúp {self} nhé.",
    "{self_cap} đang tìm mua {product} cho dự án mới. Bên {sale} có mẫu nào sẵn hàng và hỗ trợ xuất VAT không, gửi {self} xem trước nhé."
  ],
  price_sensitive: [
    "{self_cap} cần mua {product} bên {sale}, giá tầm bao nhiêu thế? Có chương trình chiết khấu tốt hay ưu đãi gì cho {self} không em?",
    "Bên em có mẫu {product} nào cấu hình ổn mà giá mềm mềm chút không, báo giá giúp {self} với nhé."
  ],
  urgent_buyer: [
    "{self_cap} cần gấp {product} trong ngày hôm nay. Bên {sale} có hàng sẵn giao ngay được không báo {self} chốt nhanh nhé.",
    "{self_cap} cần {product} gấp, còn sẵn hàng giao ngay trong ngày không {sale}? Gửi {self} thông tin để {self} thanh toán lấy gấp nha."
  ],
  reseller: [
    "{self_cap} bên đại lý đang cần tìm {product} cho khách. Bên {sale} có chính sách giá sỉ tốt cho đại lý không, gửi {self} báo giá nhé.",
    "Bên đại lý của {self} cần lấy số lượng {product}. {sale_cap} cho xin bảng giá sỉ và lượng tồn kho hiện tại nhé."
  ],
  internal_it: [
    "{self_cap} bên kỹ thuật nội bộ đang tìm mua {product}. {sale_cap} gửi giúp thông số chuẩn và báo giá nhé.",
    "Bên IT của {self} đang chọn {product} cho công ty. {sale_cap} gửi giúp thông số chi tiết của các dòng sẵn hàng nha."
  ],
  hesitant_buyer: [
    "{self_cap} đang cân nhắc tìm mua {product} mà chưa biết chọn dòng nào. {sale_cap} gửi trước vài mẫu tiêu biểu để {self} tham khảo so sánh nhé.",
    "Mình đang xem thử mấy mẫu {product}, bên {sale} cứ gửi thông tin và giá để {self} xem kỹ nhé."
  ],
  standard: [
    "{self_cap} đang cần tìm {product}, bên {sale} có mẫu nào phù hợp sẵn hàng không em?",
    "Bên mình còn {product} không {sale}? Gửi {self} xin thông tin nhé."
  ]
};

function renderOpening(text: string, identity: ReturnType<typeof buildIdentityProfileFromPersona>, product: string): string {
  const s = identity.customer_self_pronoun;
  const sCap = s.charAt(0).toUpperCase() + s.slice(1);
  const t = identity.customer_target_pronoun;
  const tCap = t.charAt(0).toUpperCase() + t.slice(1);

  return text
    .replaceAll("{self}", s)
    .replaceAll("{sale}", t)
    .replaceAll("{self_cap}", sCap)
    .replaceAll("{sale_cap}", tCap)
    .replaceAll("{product}", product);
}

export function buildCustomerOpeningEnriched(persona: OpeningPersona): {
  text: string;
  state: RuntimeState;
  scenario_context: ProductScenario;
  opening_source_type: OpeningSourceType;
  product_grounding_used: boolean;
  candidate_count: number;
  selected_catalog_category: string | null;
  selected_catalog_model_present: boolean;
  selected_catalog_price_available: boolean;
  selected_catalog_stock_status_present: boolean;
} {
  const scenario = findScenario(persona);
  const seed = stableHash(`${persona.persona_id || "unknown_persona"}:${scenario.scenario_id}`);
  const identity = buildIdentityProfileFromPersona(persona, undefined, false);
  const voiceGroup = inferVoiceGroup(persona);
  const catalogCandidates = getCatalogCandidates(persona, scenario);
  const selectedCandidate = catalogCandidates.length > 0
    ? chooseCatalogCandidate(catalogCandidates, persona, scenario)
    : null;

  let finalScenario = scenario;
  let openingText = "";
  let openingSourceType: OpeningSourceType = "persona_template";

  if (selectedCandidate) {
    finalScenario = buildGroundedScenario(scenario, selectedCandidate);
    const templates = VOICE_OPENINGS_DEFAULT[voiceGroup] || VOICE_OPENINGS_DEFAULT.standard;
    const template = templates[seed % templates.length];
    openingText = renderOpening(template, identity, finalScenario.scenario_product);
    openingSourceType = "catalog_grounded";
  } else {
    openingText = scenario.opening_templates[seed % scenario.opening_templates.length].normalize("NFC");

    const self = identity.customer_self_pronoun;
    let hasPronounMismatch = false;
    if (self === "chị" && /\b(Anh|anh)\b/.test(openingText)) {
      hasPronounMismatch = true;
    }
    if (self === "anh" && /\b(Chị|chị)\b/.test(openingText)) {
      hasPronounMismatch = true;
    }

    if (hasPlaceholder(openingText) || hasPronounMismatch) {
      const templates = VOICE_OPENINGS_DEFAULT[voiceGroup] || VOICE_OPENINGS_DEFAULT.standard;
      const template = templates[seed % templates.length];
      openingText = renderOpening(template, identity, scenario.scenario_product);
      openingSourceType = "fallback_template";
    }
  }

  let state: RuntimeState = "research_phase";
  const contexts = persona.runtime_contexts || [];
  if (contexts.includes("payment_context")) state = "payment_phase";
  else if (contexts.includes("logistics_context")) state = "logistics_phase";
  else if (contexts.includes("sales_context")) state = "pricing_phase";

  return {
    text: openingText,
    state,
    scenario_context: finalScenario,
    opening_source_type: openingSourceType,
    product_grounding_used: selectedCandidate !== null,
    candidate_count: catalogCandidates.length,
    selected_catalog_category: selectedCandidate?.category1 || selectedCandidate?.category2 || null,
    selected_catalog_model_present: Boolean(selectedCandidate?.display_name),
    selected_catalog_price_available: Boolean(selectedCandidate && (selectedCandidate.price_si !== null || selectedCandidate.price_le !== null)),
    selected_catalog_stock_status_present: Boolean(selectedCandidate?.stock_status)
  };
}
