import { RuntimeState } from "./runtimeConstraints";
import {
  FALLBACK_SCENARIO,
  PRODUCT_SCENARIOS,
  ProductScenario
} from "./productScenarioCatalog";

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

export function buildCustomerOpeningEnriched(persona: OpeningPersona): {
  text: string;
  state: RuntimeState;
  scenario_context: ProductScenario;
} {
  const scenario = findScenario(persona);
  const seed = stableHash(`${persona.persona_id || "unknown_persona"}:${scenario.scenario_id}`);
  const openingText = scenario.opening_templates[seed % scenario.opening_templates.length].normalize("NFC");

  let state: RuntimeState = "research_phase";
  const contexts = persona.runtime_contexts || [];
  if (contexts.includes("payment_context")) state = "payment_phase";
  else if (contexts.includes("logistics_context")) state = "logistics_phase";
  else if (contexts.includes("sales_context")) state = "pricing_phase";

  return {
    text: openingText,
    state,
    scenario_context: scenario
  };
}
