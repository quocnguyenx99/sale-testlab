import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { findScenario } from "../../../runtime/customerOpeningBuilder";
import { FALLBACK_SCENARIO, PRODUCT_SCENARIOS, type ProductScenario } from "../../../runtime/productScenarioCatalog";
import { prisma } from "../prismaClient";
import { contentHash } from "./trainingContentCompiler";
import type { PersonaAuthoringFields, PersonaRuntimeConfig, ScenarioAuthoringFields } from "./trainingContentDomain";

interface LegacyPersona extends PersonaRuntimeConfig {}
interface Audit {
  personasToImport: number;
  scenariosToImport: number;
  compatibilityScenarios: number;
  programItemsToBackfill: number;
  runningSessionsToMap: number;
  completedSessionsMappable: number;
  unresolvedProgramItems: string[];
  unresolvedRunningSessions: string[];
}

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const month = process.env.npm_config_month || "2026-03";
const sourceFile = path.join(process.cwd(), "sale-testlab-data", "10d_training_personas_enriched", month, "training_personas_enriched.jsonl");

function deterministicUuid(key: string): string {
  const hex = createHash("sha256").update(`testlab-v3-phase11:${key}`, "utf8").digest("hex").slice(0, 32).split("");
  hex[12] = "5"; hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function readPersonas(): LegacyPersona[] {
  if (!fs.existsSync(sourceFile)) throw new Error(`Legacy Persona source not found: ${sourceFile}`);
  return fs.readFileSync(sourceFile, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as LegacyPersona);
}

function difficulty(value: string): "EASY" | "MEDIUM" | "HARD" {
  const normalized = value.toUpperCase();
  return normalized === "EASY" || normalized === "HARD" ? normalized : "MEDIUM";
}

function personaFields(value: LegacyPersona): PersonaAuthoringFields {
  const interests = value.product_interest_categories.slice(0, 20);
  return {
    displayName: value.display_name,
    buyerRole: value.buyer_role,
    organizationType: value.organization_type,
    difficulty: difficulty(value.difficulty),
    summary: `${value.buyer_role} thuộc nhóm ${value.organization_type}${interests.length ? `, quan tâm ${interests.join(", ")}` : ""}.`,
    productInterests: interests,
    purchaseContext: value.purchase_context,
    behaviorTraits: value.behavior_rules.slice(0, 20),
    commonObjections: value.objection_patterns.slice(0, 20),
    likelyQuestions: value.likely_questions.slice(0, 20),
    trainingFocus: value.sale_training_focus.slice(0, 20)
  };
}

function scenarioFields(value: ProductScenario): ScenarioAuthoringFields {
  return {
    title: value.scenario_product,
    description: value.scenario_need,
    difficulty: "MEDIUM",
    category: value.category,
    customerNeed: value.scenario_need,
    priorities: value.scenario_priority,
    trainingObjective: `Luyện tập tư vấn ${value.category.toLowerCase()} theo đúng nhu cầu và ưu tiên của khách hàng.`,
    tags: value.suitable_persona_patterns,
    openingExamples: value.opening_templates
  };
}

function legacyScenarioId(personaId: string): string { return `persona-${personaId}`; }

async function audit(personas: LegacyPersona[]): Promise<{ audit: Audit; compatibility: Map<string, ProductScenario> }> {
  const personaIds = new Set(personas.map((item) => item.persona_id));
  const scenarioIds = new Set([...PRODUCT_SCENARIOS, FALLBACK_SCENARIO].map((item) => item.scenario_id));
  const [items, running, completed] = await prisma.$transaction([
    prisma.trainingProgramItem.findMany({ select: { id: true, personaId: true, scenarioId: true, personaVersionId: true, scenarioVersionId: true } }),
    prisma.simulationSession.findMany({ where: { status: "RUNNING" }, select: { id: true, personaId: true, scenarioSnapshot: true, personaVersionId: true, scenarioVersionId: true } }),
    prisma.simulationSession.findMany({ where: { status: "COMPLETED" }, select: { id: true, personaId: true, scenarioSnapshot: true } })
  ]);
  const compatibility = new Map<string, ProductScenario>();
  const mapScenario = (personaId: string, scenarioId: string): boolean => {
    if (scenarioIds.has(scenarioId)) return true;
    if (scenarioId !== legacyScenarioId(personaId)) return false;
    const persona = personas.find((item) => item.persona_id === personaId);
    if (!persona) return false;
    compatibility.set(scenarioId, findScenario(persona));
    return true;
  };
  const programItemsToBackfill = items.filter((item) => !item.personaVersionId || !item.scenarioVersionId);
  const runningSessionsToMap = running.filter((item) => !item.personaVersionId || !item.scenarioVersionId);
  const unresolvedProgramItems = programItemsToBackfill.filter((item) => !personaIds.has(item.personaId) || !mapScenario(item.personaId, item.scenarioId)).map((item) => item.id);
  const unresolvedRunningSessions = runningSessionsToMap.filter((session) => {
    const scenarioId = scenarioIdFromSnapshot(session.scenarioSnapshot);
    return !personaIds.has(session.personaId) || !scenarioId || !mapScenario(session.personaId, scenarioId);
  }).map((session) => session.id);
  const completedSessionsMappable = completed.filter((session) => {
    const scenarioId = scenarioIdFromSnapshot(session.scenarioSnapshot);
    return personaIds.has(session.personaId) && Boolean(scenarioId && mapScenario(session.personaId, scenarioId));
  }).length;
  return { audit: {
    personasToImport: personas.length,
    scenariosToImport: PRODUCT_SCENARIOS.length + 1,
    compatibilityScenarios: compatibility.size,
    programItemsToBackfill: programItemsToBackfill.length,
    runningSessionsToMap: runningSessionsToMap.length,
    completedSessionsMappable,
    unresolvedProgramItems,
    unresolvedRunningSessions
  }, compatibility };
}

function scenarioIdFromSnapshot(value: unknown): string | null {
  return value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>).id === "string"
    ? (value as Record<string, string>).id
    : null;
}

async function ensureImportHash(importKey: string, hash: string, kind: "persona" | "scenario"): Promise<boolean> {
  const found = kind === "persona"
    ? await prisma.personaVersion.findUnique({ where: { importKey }, select: { contentHash: true } })
    : await prisma.scenarioVersion.findUnique({ where: { importKey }, select: { contentHash: true } });
  if (!found) return false;
  if (found.contentHash !== hash) throw new Error(`IMPORT_HASH_MISMATCH:${importKey}`);
  return true;
}

async function apply(personas: LegacyPersona[], compatibility: Map<string, ProductScenario>): Promise<void> {
  for (const legacy of personas) {
    const fields = personaFields(legacy);
    const runtime: PersonaRuntimeConfig = {
      persona_id: legacy.persona_id, name: legacy.name, display_name: legacy.display_name,
      buyer_role: legacy.buyer_role, organization_type: legacy.organization_type,
      product_interest_categories: [...legacy.product_interest_categories], purchase_context: legacy.purchase_context,
      salutation_style: legacy.salutation_style || "", name_is_synthetic: Boolean(legacy.name_is_synthetic), difficulty: legacy.difficulty,
      role_prompt: legacy.role_prompt, behavior_rules: [...legacy.behavior_rules], opening_messages: [...legacy.opening_messages],
      likely_questions: [...legacy.likely_questions], objection_patterns: [...legacy.objection_patterns], closing_conditions: [...legacy.closing_conditions],
      sale_training_focus: [...legacy.sale_training_focus], runtime_contexts: [...legacy.runtime_contexts], allowed_states: [...legacy.allowed_states],
      do_not_do: [...legacy.do_not_do], evidence_summary: { source_count: 0, dominant_contexts: [...legacy.evidence_summary.dominant_contexts], core_behavior_patterns: [...legacy.evidence_summary.core_behavior_patterns], confidence: legacy.evidence_summary.confidence }, risk_flags: [...legacy.risk_flags]
    };
    const importKey = `legacy-persona:${legacy.persona_id}:v1`; const hash = contentHash({ fields, runtime });
    if (await ensureImportHash(importKey, hash, "persona")) continue;
    await prisma.persona.create({ data: { id: legacy.persona_id, origin: "LEGACY_IMPORT", nextVersion: 2, versions: { create: { id: deterministicUuid(importKey), version: 1, status: "PUBLISHED", draftSlot: null, displayName: fields.displayName, buyerRole: fields.buyerRole, organizationType: fields.organizationType, difficulty: fields.difficulty, summary: fields.summary, productInterests: json(fields.productInterests), purchaseContext: fields.purchaseContext, behaviorTraits: json(fields.behaviorTraits), commonObjections: json(fields.commonObjections), likelyQuestions: json(fields.likelyQuestions), trainingFocus: json(fields.trainingFocus), runtimeConfig: json(runtime), contentHash: hash, importKey, publishedAt: new Date() } } } });
  }

  const scenarioSources = [...PRODUCT_SCENARIOS, FALLBACK_SCENARIO, ...Array.from(compatibility, ([id, base]) => ({ ...base, scenario_id: id }))];
  for (const source of scenarioSources) {
    const fields = scenarioFields(source); const importKey = `legacy-scenario:${source.scenario_id}:v1`; const hash = contentHash({ fields, runtime: source });
    if (await ensureImportHash(importKey, hash, "scenario")) continue;
    await prisma.scenario.create({ data: { id: source.scenario_id, origin: "LEGACY_IMPORT", nextVersion: 2, versions: { create: { id: deterministicUuid(importKey), version: 1, status: "PUBLISHED", draftSlot: null, title: fields.title, description: fields.description, difficulty: fields.difficulty, category: fields.category, customerNeed: fields.customerNeed, priorities: json(fields.priorities), trainingObjective: fields.trainingObjective, tags: json(fields.tags), openingExamples: json(fields.openingExamples), runtimeConfig: json(source), contentHash: hash, importKey, publishedAt: new Date() } } } });
  }

  for (const persona of personas) {
    const scenario = findScenario(persona);
    await prisma.personaScenario.upsert({ where: { personaId_scenarioId: { personaId: persona.persona_id, scenarioId: scenario.scenario_id } }, create: { personaId: persona.persona_id, scenarioId: scenario.scenario_id, isDefault: true, sortOrder: 1 }, update: { isDefault: true, sortOrder: 1 } });
  }

  const items = await prisma.trainingProgramItem.findMany({
    where: { OR: [{ personaVersionId: null }, { scenarioVersionId: null }] }
  });
  for (const item of items) {
    const scenarioId = item.scenarioId;
    const personaVersionId = deterministicUuid(`legacy-persona:${item.personaId}:v1`);
    const scenarioVersionId = deterministicUuid(`legacy-scenario:${scenarioId}:v1`);
    await prisma.trainingProgramItem.update({
      where: { id: item.id },
      data: {
        personaVersionId: item.personaVersionId ?? personaVersionId,
        scenarioVersionId: item.scenarioVersionId ?? scenarioVersionId
      }
    });
  }

  const sessions = await prisma.simulationSession.findMany({
    where: { OR: [{ personaVersionId: null }, { scenarioVersionId: null }] },
    select: { id: true, personaId: true, scenarioSnapshot: true, status: true, personaVersionId: true, scenarioVersionId: true }
  });
  for (const session of sessions) {
    const scenarioId = scenarioIdFromSnapshot(session.scenarioSnapshot);
    if (!scenarioId) continue;
    const personaVersionId = deterministicUuid(`legacy-persona:${session.personaId}:v1`);
    const scenarioImportKey = `legacy-scenario:${scenarioId}:v1`;
    const scenarioVersion = await prisma.scenarioVersion.findUnique({ where: { importKey: scenarioImportKey }, select: { id: true } });
    if (!scenarioVersion) { if (session.status === "RUNNING") throw new Error(`UNRESOLVED_RUNNING_SESSION:${session.id}`); continue; }
    await prisma.simulationSession.update({
      where: { id: session.id },
      data: {
        personaVersionId: session.personaVersionId ?? personaVersionId,
        scenarioVersionId: session.scenarioVersionId ?? scenarioVersion.id
      }
    });
  }
}

async function main(): Promise<void> {
  const dryRun = !process.argv.includes("--apply");
  await prisma.$connect();
  try {
    const personas = readPersonas();
    const result = await audit(personas);
    process.stdout.write(`${JSON.stringify({ mode: dryRun ? "DRY_RUN" : "APPLY", sourceFile, ...result.audit }, null, 2)}\n`);
    if (result.audit.unresolvedProgramItems.length || result.audit.unresolvedRunningSessions.length) throw new Error("BACKFILL_UNRESOLVED");
    if (!dryRun) {
      await apply(personas, result.compatibility);
      const after = await audit(personas);
      if (after.audit.unresolvedProgramItems.length || after.audit.unresolvedRunningSessions.length) throw new Error("BACKFILL_UNRESOLVED_AFTER_APPLY");
      process.stdout.write(`${JSON.stringify({ mode: "APPLY_COMPLETE", ...after.audit }, null, 2)}\n`);
    }
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
