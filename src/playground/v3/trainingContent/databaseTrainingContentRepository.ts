import { Prisma, PrismaClient } from "@prisma/client";
import type {
  ManagedPersonaDetail,
  ManagedPersonaSummary,
  ManagedScenarioDetail,
  ManagedScenarioSummary,
  PersonaAuthoringFields,
  PersonaRuntimeConfig,
  PublicPersonaOption,
  RuntimeContentSelection,
  ScenarioAuthoringFields,
  ScenarioRuntimeConfig
} from "./trainingContentDomain";
import type { CreateVersionInput, TrainingContentRepository } from "./trainingContentRepository";

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export class DatabaseTrainingContentRepository implements TrainingContentRepository {
  constructor(private readonly client: PrismaClient) {}

  async listPublicCatalog(): Promise<PublicPersonaOption[]> {
    const rows = await this.client.persona.findMany({
      where: { archivedAt: null },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      include: {
        versions: { where: { status: "PUBLISHED" }, orderBy: { version: "desc" }, take: 1 },
        scenarios: {
          orderBy: [{ sortOrder: "asc" }, { scenarioId: "asc" }],
          include: { scenario: { include: { versions: { where: { status: "PUBLISHED" }, orderBy: { version: "desc" }, take: 1 } } } }
        }
      }
    });
    return rows.flatMap((row) => {
      const version = row.versions[0];
      if (!version) return [];
      const scenarios = row.scenarios.flatMap((link) => {
        const scenarioVersion = link.scenario.archivedAt ? null : link.scenario.versions[0];
        if (!scenarioVersion) return [];
        return [{
          id: link.scenarioId,
          versionId: scenarioVersion.id,
          version: scenarioVersion.version,
          title: scenarioVersion.title,
          description: scenarioVersion.description,
          difficulty: scenarioVersion.difficulty,
          trainingObjective: scenarioVersion.trainingObjective,
          isDefault: link.isDefault
        }];
      });
      if (scenarios.length === 0 || scenarios.filter((item) => item.isDefault).length !== 1) return [];
      const publicPersona: PublicPersonaOption = {
        id: row.id,
        versionId: version.id,
        version: version.version,
        displayName: version.displayName,
        role: version.buyerRole,
        customerType: version.organizationType,
        difficulty: version.difficulty,
        summary: version.summary,
        interests: strings(version.productInterests),
        scenarioContext: version.purchaseContext,
        scenarios
      };
      return [publicPersona];
    });
  }

  async resolveCurrent(personaId: string, scenarioId?: string | null): Promise<RuntimeContentSelection | null> {
    const catalog = await this.listPublicCatalog();
    const persona = catalog.find((item) => item.id === personaId);
    if (!persona) return null;
    const scenario = scenarioId
      ? persona.scenarios.find((item) => item.id === scenarioId)
      : persona.scenarios.find((item) => item.isDefault);
    if (!scenario) return null;
    return this.resolvePinned(persona.versionId, scenario.versionId);
  }

  async resolvePinned(personaVersionId: string, scenarioVersionId: string): Promise<RuntimeContentSelection | null> {
    const [persona, scenario] = await this.client.$transaction([
      this.client.personaVersion.findUnique({ where: { id: personaVersionId }, include: { persona: true } }),
      this.client.scenarioVersion.findUnique({ where: { id: scenarioVersionId }, include: { scenario: true } })
    ]);
    if (!persona || !scenario || persona.status !== "PUBLISHED" || scenario.status !== "PUBLISHED") return null;
    return {
      personaId: persona.personaId,
      personaVersionId: persona.id,
      scenarioId: scenario.scenarioId,
      scenarioVersionId: scenario.id,
      personaSnapshot: {
        id: persona.personaId,
        displayName: persona.displayName,
        role: persona.buyerRole,
        customerType: persona.organizationType,
        difficulty: persona.difficulty,
        summary: persona.summary,
        interests: strings(persona.productInterests),
        scenarioContext: persona.purchaseContext
      },
      scenarioSnapshot: {
        id: scenario.scenarioId,
        title: scenario.title,
        description: scenario.description,
        difficulty: scenario.difficulty
      },
      personaRuntime: persona.runtimeConfig as unknown as PersonaRuntimeConfig,
      scenarioRuntime: scenario.runtimeConfig as unknown as ScenarioRuntimeConfig
    };
  }

  async listManagedPersonas(): Promise<ManagedPersonaSummary[]> {
    const rows = await this.client.persona.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      include: {
        versions: { orderBy: { version: "desc" }, take: 2, select: versionSummarySelect(true) },
        scenarios: { include: { scenario: { include: { versions: { where: { status: "PUBLISHED" }, take: 1, select: { id: true } } } } } }
      }
    });
    return rows.map((row) => {
      const latestPublished = row.versions.find((item) => item.status === "PUBLISHED") ?? null;
      const draft = row.versions.find((item) => item.status === "DRAFT") ?? null;
      return {
        id: row.id,
        origin: row.origin,
        archivedAt: iso(row.archivedAt),
        latestPublished: latestPublished ? versionSummary(latestPublished) : null,
        draft: draft ? versionSummary(draft) : null,
        displayName: (draft ?? latestPublished)?.displayName ?? row.id,
        linkedScenarioCount: row.scenarios.length,
        hasUsableScenario: row.scenarios.some((link) => !link.scenario.archivedAt && link.scenario.versions.length > 0),
        updatedAt: row.updatedAt.toISOString()
      };
    });
  }

  async listManagedScenarios(): Promise<ManagedScenarioSummary[]> {
    const rows = await this.client.scenario.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      include: {
        versions: { orderBy: { version: "desc" }, take: 2, select: scenarioVersionSummarySelect(true) },
        personas: { select: { personaId: true } }
      }
    });
    return rows.map((row) => {
      const latestPublished = row.versions.find((item) => item.status === "PUBLISHED") ?? null;
      const draft = row.versions.find((item) => item.status === "DRAFT") ?? null;
      return {
        id: row.id,
        origin: row.origin,
        archivedAt: iso(row.archivedAt),
        latestPublished: latestPublished ? versionSummary(latestPublished) : null,
        draft: draft ? versionSummary(draft) : null,
        title: (draft ?? latestPublished)?.title ?? row.id,
        linkedPersonaCount: row.personas.length,
        updatedAt: row.updatedAt.toISOString()
      };
    });
  }

  async getManagedPersona(id: string, versionId?: string): Promise<ManagedPersonaDetail | null> {
    const row = await this.client.persona.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: "desc" }, select: personaVersionDetailSelect },
        scenarios: { orderBy: { sortOrder: "asc" }, include: { scenario: { include: { versions: { where: { status: "PUBLISHED" }, orderBy: { version: "desc" }, take: 1, select: { title: true } } } } } }
      }
    });
    if (!row || row.versions.length === 0) return null;
    const current = (versionId ? row.versions.find((item) => item.id === versionId) : null)
      ?? row.versions.find((item) => item.status === "DRAFT")
      ?? row.versions.find((item) => item.status === "PUBLISHED");
    if (!current) return null;
    const latestPublished = row.versions.find((item) => item.status === "PUBLISHED") ?? null;
    const draft = row.versions.find((item) => item.status === "DRAFT") ?? null;
    return {
      id: row.id,
      origin: row.origin,
      archivedAt: iso(row.archivedAt),
      latestPublished: latestPublished ? versionSummary(latestPublished) : null,
      draft: draft ? versionSummary(draft) : null,
      displayName: current.displayName,
      linkedScenarioCount: row.scenarios.length,
      hasUsableScenario: row.scenarios.some((link) => !link.scenario.archivedAt && link.scenario.versions.length > 0),
      updatedAt: row.updatedAt.toISOString(),
      versions: row.versions.map(versionSummary),
      currentVersion: { ...versionSummary(current), ...personaFields(current) },
      scenarioLinks: row.scenarios.map((link) => ({
        scenarioId: link.scenarioId,
        title: link.scenario.versions[0]?.title ?? link.scenarioId,
        isDefault: link.isDefault,
        sortOrder: link.sortOrder,
        available: !link.scenario.archivedAt && link.scenario.versions.length > 0
      }))
    };
  }

  async getManagedScenario(id: string, versionId?: string): Promise<ManagedScenarioDetail | null> {
    const row = await this.client.scenario.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: "desc" }, select: scenarioVersionDetailSelect },
        personas: { include: { persona: { include: { versions: { where: { status: "PUBLISHED" }, orderBy: { version: "desc" }, take: 1, select: { displayName: true } } } } } }
      }
    });
    if (!row || row.versions.length === 0) return null;
    const current = (versionId ? row.versions.find((item) => item.id === versionId) : null)
      ?? row.versions.find((item) => item.status === "DRAFT")
      ?? row.versions.find((item) => item.status === "PUBLISHED");
    if (!current) return null;
    const latestPublished = row.versions.find((item) => item.status === "PUBLISHED") ?? null;
    const draft = row.versions.find((item) => item.status === "DRAFT") ?? null;
    return {
      id: row.id,
      origin: row.origin,
      archivedAt: iso(row.archivedAt),
      latestPublished: latestPublished ? versionSummary(latestPublished) : null,
      draft: draft ? versionSummary(draft) : null,
      title: current.title,
      linkedPersonaCount: row.personas.length,
      updatedAt: row.updatedAt.toISOString(),
      versions: row.versions.map(versionSummary),
      currentVersion: { ...versionSummary(current), ...scenarioFields(current) },
      personaLinks: row.personas.map((link) => ({
        personaId: link.personaId,
        displayName: link.persona.versions[0]?.displayName ?? link.personaId,
        isDefault: link.isDefault
      }))
    };
  }

  async createPersona(input: CreateVersionInput<PersonaAuthoringFields>): Promise<void> {
    await this.client.persona.create({ data: {
      id: input.entityId, origin: "MANAGED", nextVersion: 2, createdByUserId: input.createdByUserId,
      versions: { create: personaVersionData(input, "DRAFT") }
    } });
  }

  async createScenario(input: CreateVersionInput<ScenarioAuthoringFields>): Promise<void> {
    await this.client.scenario.create({ data: {
      id: input.entityId, origin: "MANAGED", nextVersion: 2, createdByUserId: input.createdByUserId,
      versions: { create: scenarioVersionData(input, "DRAFT") }
    } });
  }

  async updatePersonaDraft(versionId: string, expectedUpdatedAt: string, fields: PersonaAuthoringFields, runtimeConfig: unknown, hash: string): Promise<boolean> {
    const result = await this.client.personaVersion.updateMany({ where: { id: versionId, status: "DRAFT", updatedAt: new Date(expectedUpdatedAt) }, data: { ...personaWrite(fields), runtimeConfig: json(runtimeConfig), contentHash: hash } });
    return result.count === 1;
  }

  async updateScenarioDraft(versionId: string, expectedUpdatedAt: string, fields: ScenarioAuthoringFields, runtimeConfig: unknown, hash: string): Promise<boolean> {
    const result = await this.client.scenarioVersion.updateMany({ where: { id: versionId, status: "DRAFT", updatedAt: new Date(expectedUpdatedAt) }, data: { ...scenarioWrite(fields), runtimeConfig: json(runtimeConfig), contentHash: hash } });
    return result.count === 1;
  }

  async clonePersonaDraft(personaId: string, input: CreateVersionInput<PersonaAuthoringFields>): Promise<"CREATED" | "DRAFT_EXISTS" | "NOT_FOUND"> {
    return this.client.$transaction(async (tx) => {
      const entity = await tx.persona.findUnique({ where: { id: personaId }, include: { versions: { where: { status: "DRAFT" }, take: 1 } } });
      if (!entity || entity.archivedAt) return "NOT_FOUND";
      if (entity.versions.length > 0) return "DRAFT_EXISTS";
      const version = entity.nextVersion;
      await tx.persona.update({ where: { id: personaId }, data: { nextVersion: { increment: 1 }, versions: { create: personaVersionData({ ...input, version }, "DRAFT") } } });
      return "CREATED";
    });
  }

  async cloneScenarioDraft(scenarioId: string, input: CreateVersionInput<ScenarioAuthoringFields>): Promise<"CREATED" | "DRAFT_EXISTS" | "NOT_FOUND"> {
    return this.client.$transaction(async (tx) => {
      const entity = await tx.scenario.findUnique({ where: { id: scenarioId }, include: { versions: { where: { status: "DRAFT" }, take: 1 } } });
      if (!entity || entity.archivedAt) return "NOT_FOUND";
      if (entity.versions.length > 0) return "DRAFT_EXISTS";
      const version = entity.nextVersion;
      await tx.scenario.update({ where: { id: scenarioId }, data: { nextVersion: { increment: 1 }, versions: { create: scenarioVersionData({ ...input, version }, "DRAFT") } } });
      return "CREATED";
    });
  }

  async publishPersonaVersion(personaId: string, versionId: string, expectedUpdatedAt: string): Promise<boolean> {
    const result = await this.client.personaVersion.updateMany({ where: { id: versionId, personaId, status: "DRAFT", updatedAt: new Date(expectedUpdatedAt) }, data: { status: "PUBLISHED", draftSlot: null, publishedAt: new Date() } });
    return result.count === 1;
  }

  async publishScenarioVersion(scenarioId: string, versionId: string, expectedUpdatedAt: string): Promise<boolean> {
    const result = await this.client.scenarioVersion.updateMany({ where: { id: versionId, scenarioId, status: "DRAFT", updatedAt: new Date(expectedUpdatedAt) }, data: { status: "PUBLISHED", draftSlot: null, publishedAt: new Date() } });
    return result.count === 1;
  }

  async deletePersonaDraft(personaId: string, versionId: string): Promise<boolean> {
    const result = await this.client.personaVersion.deleteMany({ where: { id: versionId, personaId, status: "DRAFT" } });
    return result.count === 1;
  }

  async deleteScenarioDraft(scenarioId: string, versionId: string): Promise<boolean> {
    const result = await this.client.scenarioVersion.deleteMany({ where: { id: versionId, scenarioId, status: "DRAFT" } });
    return result.count === 1;
  }

  async archivePersona(personaId: string): Promise<"ARCHIVED" | "DRAFT_EXISTS" | "NOT_FOUND"> {
    return this.client.$transaction(async (tx) => {
      const row = await tx.persona.findUnique({ where: { id: personaId }, include: { versions: { where: { status: "DRAFT" }, take: 1 } } });
      if (!row || row.archivedAt) return "NOT_FOUND";
      if (row.versions.length > 0) return "DRAFT_EXISTS";
      await tx.persona.update({ where: { id: personaId }, data: { archivedAt: new Date() } });
      return "ARCHIVED";
    });
  }

  async archiveScenario(scenarioId: string): Promise<"ARCHIVED" | "DRAFT_EXISTS" | "NOT_FOUND"> {
    return this.client.$transaction(async (tx) => {
      const row = await tx.scenario.findUnique({ where: { id: scenarioId }, include: { versions: { where: { status: "DRAFT" }, take: 1 } } });
      if (!row || row.archivedAt) return "NOT_FOUND";
      if (row.versions.length > 0) return "DRAFT_EXISTS";
      await tx.scenario.update({ where: { id: scenarioId }, data: { archivedAt: new Date() } });
      return "ARCHIVED";
    });
  }

  async replacePersonaScenarioLinks(personaId: string, links: Array<{ scenarioId: string; isDefault: boolean; sortOrder: number }>): Promise<boolean> {
    return this.client.$transaction(async (tx) => {
      const persona = await tx.persona.findUnique({ where: { id: personaId } });
      if (!persona || persona.archivedAt) return false;
      const scenarioIds = links.map((item) => item.scenarioId);
      const available = await tx.scenario.findMany({ where: { id: { in: scenarioIds }, archivedAt: null, versions: { some: { status: "PUBLISHED" } } }, select: { id: true } });
      if (available.length !== new Set(scenarioIds).size || links.filter((item) => item.isDefault).length !== (links.length > 0 ? 1 : 0)) return false;
      await tx.personaScenario.deleteMany({ where: { personaId } });
      if (links.length > 0) await tx.personaScenario.createMany({ data: links.map((item) => ({ ...item, personaId })) });
      return true;
    });
  }
}

const versionSummarySelect = (withName: boolean) => ({ id: true, version: true, status: true, publishedAt: true, updatedAt: true, ...(withName ? { displayName: true } : {}) } as const);
const scenarioVersionSummarySelect = (withTitle: boolean) => ({ id: true, version: true, status: true, publishedAt: true, updatedAt: true, ...(withTitle ? { title: true } : {}) } as const);
const personaVersionDetailSelect = { ...versionSummarySelect(true), buyerRole: true, organizationType: true, difficulty: true, summary: true, productInterests: true, purchaseContext: true, behaviorTraits: true, commonObjections: true, likelyQuestions: true, trainingFocus: true } as const;
const scenarioVersionDetailSelect = { ...scenarioVersionSummarySelect(true), description: true, difficulty: true, category: true, customerNeed: true, priorities: true, trainingObjective: true, tags: true, openingExamples: true } as const;

function versionSummary(value: { id: string; version: number; status: "DRAFT" | "PUBLISHED"; publishedAt: Date | null; updatedAt: Date }) {
  return { id: value.id, version: value.version, status: value.status, publishedAt: iso(value.publishedAt), updatedAt: value.updatedAt.toISOString() };
}
function iso(value: Date | null): string | null { return value?.toISOString() ?? null; }
function personaFields(value: any): PersonaAuthoringFields { return { displayName: value.displayName, buyerRole: value.buyerRole, organizationType: value.organizationType, difficulty: value.difficulty, summary: value.summary, productInterests: strings(value.productInterests), purchaseContext: value.purchaseContext, behaviorTraits: strings(value.behaviorTraits), commonObjections: strings(value.commonObjections), likelyQuestions: strings(value.likelyQuestions), trainingFocus: strings(value.trainingFocus) }; }
function scenarioFields(value: any): ScenarioAuthoringFields { return { title: value.title, description: value.description, difficulty: value.difficulty, category: value.category, customerNeed: value.customerNeed, priorities: strings(value.priorities), trainingObjective: value.trainingObjective, tags: strings(value.tags), openingExamples: strings(value.openingExamples) }; }
function personaWrite(fields: PersonaAuthoringFields) { return { displayName: fields.displayName, buyerRole: fields.buyerRole, organizationType: fields.organizationType, difficulty: fields.difficulty, summary: fields.summary, productInterests: json(fields.productInterests), purchaseContext: fields.purchaseContext, behaviorTraits: json(fields.behaviorTraits), commonObjections: json(fields.commonObjections), likelyQuestions: json(fields.likelyQuestions), trainingFocus: json(fields.trainingFocus) }; }
function scenarioWrite(fields: ScenarioAuthoringFields) { return { title: fields.title, description: fields.description, difficulty: fields.difficulty, category: fields.category, customerNeed: fields.customerNeed, priorities: json(fields.priorities), trainingObjective: fields.trainingObjective, tags: json(fields.tags), openingExamples: json(fields.openingExamples) }; }
function personaVersionData(input: CreateVersionInput<PersonaAuthoringFields>, status: "DRAFT" | "PUBLISHED") { return { id: input.id, version: input.version, status, draftSlot: status === "DRAFT" ? 1 : null, ...personaWrite(input.fields), runtimeConfig: json(input.runtimeConfig), contentHash: input.contentHash, createdByUserId: input.createdByUserId }; }
function scenarioVersionData(input: CreateVersionInput<ScenarioAuthoringFields>, status: "DRAFT" | "PUBLISHED") { return { id: input.id, version: input.version, status, draftSlot: status === "DRAFT" ? 1 : null, ...scenarioWrite(input.fields), runtimeConfig: json(input.runtimeConfig), contentHash: input.contentHash, createdByUserId: input.createdByUserId }; }
