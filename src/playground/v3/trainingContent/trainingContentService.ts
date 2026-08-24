import { randomUUID } from "crypto";
import { compilePersonaRuntimeConfig, compileScenarioRuntimeConfig, contentHash } from "./trainingContentCompiler";
import type { PersonaAuthoringFields, ScenarioAuthoringFields } from "./trainingContentDomain";
import type { TrainingContentRepository } from "./trainingContentRepository";

export type TrainingContentErrorCode =
  | "CONTENT_NOT_FOUND"
  | "INVALID_CONTENT_INPUT"
  | "CONTENT_DRAFT_EXISTS"
  | "CONTENT_VERSION_CONFLICT"
  | "CONTENT_VERSION_IMMUTABLE"
  | "CONTENT_ARCHIVE_BLOCKED"
  | "INVALID_CONTENT_LINKS";

export class TrainingContentServiceError extends Error {
  constructor(public readonly code: TrainingContentErrorCode, message: string) {
    super(message);
    this.name = "TrainingContentServiceError";
  }
}

export class TrainingContentService {
  constructor(private readonly repository: TrainingContentRepository, private readonly createId = randomUUID) {}

  listPublic() { return this.repository.listPublicCatalog(); }
  listPersonas() { return this.repository.listManagedPersonas(); }
  listScenarios() { return this.repository.listManagedScenarios(); }

  async getPersona(id: unknown, versionId?: unknown) {
    const result = await this.repository.getManagedPersona(identifier(id), optionalIdentifier(versionId));
    if (!result) throw notFound();
    return result;
  }

  async getScenario(id: unknown, versionId?: unknown) {
    const result = await this.repository.getManagedScenario(identifier(id), optionalIdentifier(versionId));
    if (!result) throw notFound();
    return result;
  }

  async createPersona(userId: string, input: unknown) {
    const body = object(input);
    const fields = personaFields(body);
    const entityId = optionalIdentifier(body.id) ?? this.createId();
    const runtime = compilePersonaRuntimeConfig(entityId, fields);
    await this.repository.createPersona({ id: this.createId(), entityId, version: 1, fields, runtimeConfig: runtime, contentHash: contentHash({ fields, runtime }), createdByUserId: userId });
    return this.getPersona(entityId);
  }

  async createScenario(userId: string, input: unknown) {
    const body = object(input);
    const fields = scenarioFields(body);
    const entityId = optionalIdentifier(body.id) ?? this.createId();
    const runtime = compileScenarioRuntimeConfig(entityId, fields);
    await this.repository.createScenario({ id: this.createId(), entityId, version: 1, fields, runtimeConfig: runtime, contentHash: contentHash({ fields, runtime }), createdByUserId: userId });
    return this.getScenario(entityId);
  }

  async updatePersona(personaIdInput: unknown, versionIdInput: unknown, input: unknown) {
    const personaId = identifier(personaIdInput); const versionId = identifier(versionIdInput); const body = object(input);
    const detail = await this.getPersona(personaId, versionId);
    if (detail.currentVersion.status !== "DRAFT") throw immutable();
    const fields = personaFields(body);
    const runtime = compilePersonaRuntimeConfig(personaId, fields);
    if (!await this.repository.updatePersonaDraft(versionId, timestamp(body.expectedUpdatedAt), fields, runtime, contentHash({ fields, runtime }))) throw conflict();
    return this.getPersona(personaId, versionId);
  }

  async updateScenario(scenarioIdInput: unknown, versionIdInput: unknown, input: unknown) {
    const scenarioId = identifier(scenarioIdInput); const versionId = identifier(versionIdInput); const body = object(input);
    const detail = await this.getScenario(scenarioId, versionId);
    if (detail.currentVersion.status !== "DRAFT") throw immutable();
    const fields = scenarioFields(body);
    const runtime = compileScenarioRuntimeConfig(scenarioId, fields);
    if (!await this.repository.updateScenarioDraft(versionId, timestamp(body.expectedUpdatedAt), fields, runtime, contentHash({ fields, runtime }))) throw conflict();
    return this.getScenario(scenarioId, versionId);
  }

  async createPersonaVersion(userId: string, personaIdInput: unknown) {
    const personaId = identifier(personaIdInput); const detail = await this.getPersona(personaId);
    if (!detail.latestPublished) throw invalid("Persona cần có phiên bản đã xuất bản.");
    const fields = pickPersonaFields(detail.currentVersion); const runtime = compilePersonaRuntimeConfig(personaId, fields);
    const result = await this.repository.clonePersonaDraft(personaId, { id: this.createId(), entityId: personaId, version: 0, fields, runtimeConfig: runtime, contentHash: contentHash({ fields, runtime }), createdByUserId: userId });
    if (result === "DRAFT_EXISTS") throw draftExists(); if (result === "NOT_FOUND") throw notFound();
    return this.getPersona(personaId);
  }

  async createScenarioVersion(userId: string, scenarioIdInput: unknown) {
    const scenarioId = identifier(scenarioIdInput); const detail = await this.getScenario(scenarioId);
    if (!detail.latestPublished) throw invalid("Tình huống cần có phiên bản đã xuất bản.");
    const fields = pickScenarioFields(detail.currentVersion); const runtime = compileScenarioRuntimeConfig(scenarioId, fields);
    const result = await this.repository.cloneScenarioDraft(scenarioId, { id: this.createId(), entityId: scenarioId, version: 0, fields, runtimeConfig: runtime, contentHash: contentHash({ fields, runtime }), createdByUserId: userId });
    if (result === "DRAFT_EXISTS") throw draftExists(); if (result === "NOT_FOUND") throw notFound();
    return this.getScenario(scenarioId);
  }

  async publishPersona(personaIdInput: unknown, versionIdInput: unknown, input: unknown) {
    const personaId = identifier(personaIdInput); const versionId = identifier(versionIdInput); const body = object(input);
    let detail = await this.getPersona(personaId, versionId);
    if (detail.currentVersion.status !== "DRAFT") throw immutable();
    const fields = pickPersonaFields(detail.currentVersion); const runtime = compilePersonaRuntimeConfig(personaId, fields);
    if (!await this.repository.updatePersonaDraft(versionId, timestamp(body.expectedUpdatedAt), fields, runtime, contentHash({ fields, runtime }))) throw conflict();
    detail = await this.getPersona(personaId, versionId);
    if (!await this.repository.publishPersonaVersion(personaId, versionId, detail.currentVersion.updatedAt)) throw conflict();
    return this.getPersona(personaId, versionId);
  }

  async publishScenario(scenarioIdInput: unknown, versionIdInput: unknown, input: unknown) {
    const scenarioId = identifier(scenarioIdInput); const versionId = identifier(versionIdInput); const body = object(input);
    let detail = await this.getScenario(scenarioId, versionId);
    if (detail.currentVersion.status !== "DRAFT") throw immutable();
    const fields = pickScenarioFields(detail.currentVersion); const runtime = compileScenarioRuntimeConfig(scenarioId, fields);
    if (!await this.repository.updateScenarioDraft(versionId, timestamp(body.expectedUpdatedAt), fields, runtime, contentHash({ fields, runtime }))) throw conflict();
    detail = await this.getScenario(scenarioId, versionId);
    if (!await this.repository.publishScenarioVersion(scenarioId, versionId, detail.currentVersion.updatedAt)) throw conflict();
    return this.getScenario(scenarioId, versionId);
  }

  async deletePersonaDraft(personaId: unknown, versionId: unknown) { if (!await this.repository.deletePersonaDraft(identifier(personaId), identifier(versionId))) throw immutable(); }
  async deleteScenarioDraft(scenarioId: unknown, versionId: unknown) { if (!await this.repository.deleteScenarioDraft(identifier(scenarioId), identifier(versionId))) throw immutable(); }

  async archivePersona(personaId: unknown) {
    const result = await this.repository.archivePersona(identifier(personaId));
    if (result === "DRAFT_EXISTS") throw new TrainingContentServiceError("CONTENT_ARCHIVE_BLOCKED", "Hãy xuất bản hoặc xóa bản nháp trước khi lưu trữ.");
    if (result === "NOT_FOUND") throw notFound();
  }

  async archiveScenario(scenarioId: unknown) {
    const result = await this.repository.archiveScenario(identifier(scenarioId));
    if (result === "DRAFT_EXISTS") throw new TrainingContentServiceError("CONTENT_ARCHIVE_BLOCKED", "Hãy xuất bản hoặc xóa bản nháp trước khi lưu trữ.");
    if (result === "NOT_FOUND") throw notFound();
  }

  async replaceLinks(personaIdInput: unknown, input: unknown) {
    const body = object(input); const personaId = identifier(personaIdInput);
    if (!Array.isArray(body.links) || body.links.length > 100) throw invalid("Danh sách tình huống không hợp lệ.");
    const links = body.links.map((value, index) => { const link = object(value); return { scenarioId: identifier(link.scenarioId), isDefault: link.isDefault === true, sortOrder: index + 1 }; });
    if (!await this.repository.replacePersonaScenarioLinks(personaId, links)) throw new TrainingContentServiceError("INVALID_CONTENT_LINKS", "Liên kết hoặc tình huống mặc định không khả dụng.");
    return this.getPersona(personaId);
  }
}

function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid("Dữ liệu nội dung không hợp lệ."); return value as Record<string, unknown>; }
function text(value: unknown, max: number, label: string): string { if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw invalid(`${label} không hợp lệ.`); return value.trim(); }
function optionalText(value: unknown, max: number): string { if (value === undefined || value === null) return ""; if (typeof value !== "string" || value.trim().length > max) throw invalid("Nội dung văn bản không hợp lệ."); return value.trim(); }
function list(value: unknown, maxItems = 20, maxLength = 240): string[] { if (!Array.isArray(value) || value.length > maxItems) throw invalid("Danh sách nội dung không hợp lệ."); const result = value.map((item) => text(item, maxLength, "Nội dung")); return Array.from(new Set(result)); }
function difficulty(value: unknown): "EASY" | "MEDIUM" | "HARD" { if (value !== "EASY" && value !== "MEDIUM" && value !== "HARD") throw invalid("Độ khó không hợp lệ."); return value; }
function identifier(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.trim().length > 160) throw notFound(); return value.trim(); }
function optionalIdentifier(value: unknown): string | undefined { return value === undefined || value === null ? undefined : identifier(value); }
function timestamp(value: unknown): string { if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw conflict(); return value; }
function personaFields(body: Record<string, unknown>): PersonaAuthoringFields { return { displayName: text(body.displayName, 160, "Tên Persona"), buyerRole: text(body.buyerRole, 160, "Vai trò người mua"), organizationType: text(body.organizationType, 160, "Loại tổ chức"), difficulty: difficulty(body.difficulty), summary: text(body.summary, 2_000, "Tóm tắt"), productInterests: list(body.productInterests), purchaseContext: text(body.purchaseContext, 2_000, "Bối cảnh mua hàng"), behaviorTraits: list(body.behaviorTraits), commonObjections: list(body.commonObjections), likelyQuestions: list(body.likelyQuestions), trainingFocus: list(body.trainingFocus) }; }
function scenarioFields(body: Record<string, unknown>): ScenarioAuthoringFields { return { title: text(body.title, 160, "Tên tình huống"), description: text(body.description, 2_000, "Mô tả"), difficulty: difficulty(body.difficulty), category: text(body.category, 160, "Danh mục"), customerNeed: text(body.customerNeed, 2_000, "Nhu cầu khách hàng"), priorities: list(body.priorities), trainingObjective: text(body.trainingObjective, 2_000, "Mục tiêu đào tạo"), tags: list(body.tags), openingExamples: body.openingExamples === undefined ? [] : list(body.openingExamples, 10, 500) }; }
function pickPersonaFields(value: PersonaAuthoringFields): PersonaAuthoringFields { return { displayName: value.displayName, buyerRole: value.buyerRole, organizationType: value.organizationType, difficulty: value.difficulty, summary: value.summary, productInterests: [...value.productInterests], purchaseContext: value.purchaseContext, behaviorTraits: [...value.behaviorTraits], commonObjections: [...value.commonObjections], likelyQuestions: [...value.likelyQuestions], trainingFocus: [...value.trainingFocus] }; }
function pickScenarioFields(value: ScenarioAuthoringFields): ScenarioAuthoringFields { return { title: value.title, description: value.description, difficulty: value.difficulty, category: value.category, customerNeed: value.customerNeed, priorities: [...value.priorities], trainingObjective: value.trainingObjective, tags: [...value.tags], openingExamples: [...value.openingExamples] }; }
function invalid(message: string) { return new TrainingContentServiceError("INVALID_CONTENT_INPUT", message); }
function notFound() { return new TrainingContentServiceError("CONTENT_NOT_FOUND", "Không tìm thấy nội dung đào tạo."); }
function conflict() { return new TrainingContentServiceError("CONTENT_VERSION_CONFLICT", "Nội dung vừa được thay đổi. Vui lòng tải lại."); }
function immutable() { return new TrainingContentServiceError("CONTENT_VERSION_IMMUTABLE", "Phiên bản đã xuất bản không thể chỉnh sửa hoặc xóa."); }
function draftExists() { return new TrainingContentServiceError("CONTENT_DRAFT_EXISTS", "Nội dung đã có một bản nháp."); }
