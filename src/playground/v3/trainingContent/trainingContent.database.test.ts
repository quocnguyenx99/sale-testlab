import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { prisma } from "../prismaClient";
import { DatabaseTrainingContentRepository } from "./databaseTrainingContentRepository";
import { TrainingContentService, TrainingContentServiceError } from "./trainingContentService";
import { compilePersonaRuntimeConfig, compileScenarioRuntimeConfig, contentHash } from "./trainingContentCompiler";

const personaFields = { displayName: "Persona Phase 11", buyerRole: "Quản lý mua hàng", organizationType: "Doanh nghiệp", difficulty: "MEDIUM" as const, summary: "Khách hàng thận trọng và cần thông tin rõ ràng.", productInterests: ["Máy chủ"], purchaseContext: "Mua cho hệ thống nội bộ", behaviorTraits: ["Hỏi kỹ cấu hình"], commonObjections: ["Giá cao"], likelyQuestions: ["Bảo hành bao lâu?"], trainingFocus: ["Khám phá nhu cầu"] };
const scenarioFields = { title: "Tư vấn máy chủ", description: "Tư vấn máy chủ cho doanh nghiệp.", difficulty: "MEDIUM" as const, category: "Máy chủ", customerNeed: "Triển khai hệ thống nội bộ", priorities: ["cấu hình", "bảo hành"], trainingObjective: "Luyện khám phá nhu cầu kỹ thuật.", tags: ["server"], openingExamples: ["Bên em có máy chủ phù hợp không?"] };

async function expectCode(operation: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(operation, (error: unknown) => error instanceof TrainingContentServiceError && error.code === code);
}

async function main(): Promise<void> {
  const userId = randomUUID(); const email = `phase11-${userId}@test.local`;
  const repository = new DatabaseTrainingContentRepository(prisma); const service = new TrainingContentService(repository);
  let personaId = ""; let scenarioId = ""; let programId = ""; let programItemId = "";
  const compiledPersona = compilePersonaRuntimeConfig("p", personaFields); const compiledScenario = compileScenarioRuntimeConfig("s", scenarioFields);
  assert.deepEqual(compiledPersona, compilePersonaRuntimeConfig("p", personaFields));
  assert.equal(contentHash(compiledPersona), contentHash(compilePersonaRuntimeConfig("p", personaFields)));
  assert.deepEqual(compiledScenario, compileScenarioRuntimeConfig("s", scenarioFields));
  await prisma.$connect();
  try {
    await prisma.user.create({ data: { id: userId, email, passwordHash: "phase11-test-only", displayName: "Phase 11 Manager", role: "MANAGER", status: "ACTIVE" } });
    const persona = await service.createPersona(userId, personaFields); personaId = persona.id;
    const scenario = await service.createScenario(userId, scenarioFields); scenarioId = scenario.id;
    assert.equal(persona.currentVersion.version, 1); assert.equal(persona.currentVersion.status, "DRAFT");
    await expectCode(() => service.createPersonaVersion(userId, personaId), "INVALID_CONTENT_INPUT");
    const publishedPersona = await service.publishPersona(personaId, persona.currentVersion.id, { expectedUpdatedAt: persona.currentVersion.updatedAt });
    const publishedScenario = await service.publishScenario(scenarioId, scenario.currentVersion.id, { expectedUpdatedAt: scenario.currentVersion.updatedAt });
    assert.equal(publishedPersona.currentVersion.status, "PUBLISHED"); assert.equal(publishedScenario.currentVersion.status, "PUBLISHED");
    await service.replaceLinks(personaId, { links: [{ scenarioId, isDefault: true }] });
    await expectCode(() => service.replaceLinks(personaId, { links: [{ scenarioId, isDefault: false }] }), "INVALID_CONTENT_LINKS");
    await prisma.personaScenario.update({ where: { personaId_scenarioId: { personaId, scenarioId } }, data: { isDefault: false } });
    assert.equal(await repository.resolveCurrent(personaId), null, "Missing default relationship must fail closed");
    await prisma.personaScenario.update({ where: { personaId_scenarioId: { personaId, scenarioId } }, data: { isDefault: true } });
    const pinnedV1 = await repository.resolveCurrent(personaId, scenarioId); assert(pinnedV1); assert.equal(pinnedV1.personaVersionId, publishedPersona.currentVersion.id);
    programId = randomUUID(); programItemId = randomUUID();
    await prisma.trainingProgram.create({
      data: {
        id: programId, name: "Phase 11 managed pin idempotency", status: "PUBLISHED", createdByUserId: userId,
        items: { create: { id: programItemId, personaId, scenarioId, personaVersionId: pinnedV1.personaVersionId, scenarioVersionId: pinnedV1.scenarioVersionId, mode: "SALE_FIRST", sortOrder: 1 } }
      }
    });
    execFileSync(process.execPath, [path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "src/playground/v3/trainingContent/importTrainingContent.ts", "--apply"], { cwd: process.cwd(), stdio: "pipe" });
    const pinAfterImportRerun = await prisma.trainingProgramItem.findUnique({ where: { id: programItemId } }); assert(pinAfterImportRerun);
    assert.equal(pinAfterImportRerun.personaVersionId, pinnedV1.personaVersionId, "Import rerun must not repin managed Program content");
    assert.equal(pinAfterImportRerun.scenarioVersionId, pinnedV1.scenarioVersionId, "Import rerun must preserve existing Scenario pin");
    const draftV2 = await service.createPersonaVersion(userId, personaId); assert.equal(draftV2.currentVersion.version, 2);
    await expectCode(() => service.createPersonaVersion(userId, personaId), "CONTENT_DRAFT_EXISTS");
    await expectCode(() => service.updatePersona(personaId, draftV2.currentVersion.id, { ...personaFields, expectedUpdatedAt: new Date(0).toISOString() }), "CONTENT_VERSION_CONFLICT");
    const updatedV2 = await service.updatePersona(personaId, draftV2.currentVersion.id, { ...personaFields, displayName: "Persona Phase 11 v2", expectedUpdatedAt: draftV2.currentVersion.updatedAt });
    await service.publishPersona(personaId, updatedV2.currentVersion.id, { expectedUpdatedAt: updatedV2.currentVersion.updatedAt });
    const currentV2 = await repository.resolveCurrent(personaId, scenarioId); assert(currentV2); assert.notEqual(currentV2.personaVersionId, pinnedV1.personaVersionId);
    const stillV1 = await repository.resolvePinned(pinnedV1.personaVersionId, pinnedV1.scenarioVersionId); assert(stillV1); assert.equal(stillV1.personaSnapshot.displayName, "Persona Phase 11");
    const draftV3 = await service.createPersonaVersion(userId, personaId); await service.deletePersonaDraft(personaId, draftV3.currentVersion.id);
    const draftV4 = await service.createPersonaVersion(userId, personaId); assert.equal(draftV4.currentVersion.version, 4);
    await expectCode(() => service.archivePersona(personaId), "CONTENT_ARCHIVE_BLOCKED");
    await service.deletePersonaDraft(personaId, draftV4.currentVersion.id);
    const safeDetail = JSON.stringify(await service.getPersona(personaId));
    assert(!/runtimeConfig|role_prompt|contentHash|importKey|source_entity|stock_qty|transcript|passwordHash|tokenHash/i.test(safeDetail));
    await service.archiveScenario(scenarioId);
    assert.equal((await repository.listPublicCatalog()).some((item) => item.id === personaId), false);
    assert(await repository.resolvePinned(pinnedV1.personaVersionId, pinnedV1.scenarioVersionId));
    process.stdout.write("Phase 11 managed content domain/database/compiler/privacy tests: PASS\n");
  } finally {
    if (programId) await prisma.trainingProgram.deleteMany({ where: { id: programId } });
    if (personaId || scenarioId) await prisma.personaScenario.deleteMany({ where: { OR: [{ personaId: personaId || "__none__" }, { scenarioId: scenarioId || "__none__" }] } });
    if (personaId) { await prisma.personaVersion.deleteMany({ where: { personaId } }); await prisma.persona.deleteMany({ where: { id: personaId } }); }
    if (scenarioId) { await prisma.scenarioVersion.deleteMany({ where: { scenarioId } }); await prisma.scenario.deleteMany({ where: { id: scenarioId } }); }
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
