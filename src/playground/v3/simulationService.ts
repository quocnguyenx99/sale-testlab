import { randomUUID } from "crypto";
import { SessionHistoryQuery, SessionRepository } from "./sessionRepository";
import { OrchestrationResult, SimulationOrchestrator } from "./simulationOrchestrator";
import {
  EnrichedPersonaSource,
  SimulationMessage,
  SimulationMode,
  SimulationPersonaSnapshot,
  SimulationResult,
  SimulationScenarioSnapshot,
  SimulationSession
} from "./simulationSession";
import type { RuntimeContentSelection } from "./trainingContent/trainingContentDomain";
import type { RuntimeContentResolver } from "./trainingContent/runtimeContentResolver";

export type SimulationErrorCode =
  | "PERSONA_NOT_FOUND"
  | "INVALID_MODE"
  | "SESSION_NOT_FOUND"
  | "SESSION_COMPLETED"
  | "SESSION_PERSONA_MISMATCH"
  | "SESSION_FORBIDDEN"
  | "MESSAGE_REQUIRED"
  | "MESSAGE_TOO_LONG"
  | "RUNTIME_UNAVAILABLE";

export class SimulationServiceError extends Error {
  constructor(public readonly code: SimulationErrorCode, message: string) {
    super(message);
  }
}

export interface SendMessageResult {
  saleMessage: SimulationMessage;
  customerMessage: SimulationMessage;
  session: SimulationSession;
}

export interface AssignedSessionContext {
  trainingAssignmentId: string;
  trainingProgramItemId: string;
  personaVersionId?: string;
  scenarioVersionId?: string;
}

interface SimulationServiceDependencies {
  sessions: SessionRepository;
  orchestrator: SimulationOrchestrator;
  personas?: EnrichedPersonaSource[];
  contentResolver?: RuntimeContentResolver;
  now?: () => Date;
  createId?: () => string;
}

function difficulty(value: string): "EASY" | "MEDIUM" | "HARD" {
  const normalized = value.trim().toUpperCase();
  if (normalized === "HARD") return "HARD";
  if (normalized === "EASY") return "EASY";
  return "MEDIUM";
}

function personaSnapshot(persona: EnrichedPersonaSource): SimulationPersonaSnapshot {
  const interests = persona.product_interest_categories.slice(0, 5);
  return {
    id: persona.persona_id,
    displayName: persona.display_name,
    role: persona.buyer_role,
    customerType: persona.organization_type,
    difficulty: difficulty(persona.difficulty),
    summary: `${persona.buyer_role} thuộc nhóm ${persona.organization_type}${interests.length > 0 ? `, quan tâm ${interests.join(", ")}` : ""}.`,
    interests,
    scenarioContext: persona.purchase_context
  };
}

function defaultScenario(persona: SimulationPersonaSnapshot): SimulationScenarioSnapshot {
  const interest = persona.interests[0] || "giải pháp phù hợp";
  return {
    id: `persona-${persona.id}`,
    title: `Tư vấn ${interest}`,
    description: persona.scenarioContext || `Khám phá nhu cầu của ${persona.role}.`,
    difficulty: persona.difficulty
  };
}

function completedResult(session: SimulationSession, completedAt: string): SimulationResult {
  const insight = session.runtimeInsight;
  return {
    outcome: insight?.dealOutcome ?? "not_ready",
    trainingStatus: insight?.trainingStatus ?? "in_progress",
    turnCount: session.messages.filter((message) => message.sender === "SALE").length,
    durationSeconds: Math.max(0, Math.round((Date.parse(completedAt) - Date.parse(session.createdAt)) / 1000)),
    resolvedTopics: insight?.resolvedTopics ?? [],
    missingTopics: insight?.missingTopics ?? ["product_model", "configuration", "price", "stock", "delivery", "warranty", "payment", "invoice_or_document", "next_step"],
    signals: session.signals
  };
}

export class SimulationService {
  private readonly personasById: Map<string, SimulationPersonaSnapshot>;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly turnLocks = new Map<string, Promise<void>>();

  constructor(private readonly dependencies: SimulationServiceDependencies) {
    this.personasById = new Map((dependencies.personas ?? []).map((persona) => [persona.persona_id, personaSnapshot(persona)]));
    this.now = dependencies.now ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
  }

  async listPersonas(): Promise<SimulationPersonaSnapshot[]> {
    if (this.dependencies.contentResolver) return (await this.dependencies.contentResolver.listPublicCatalog()).map((item) => ({ id: item.id, displayName: item.displayName, role: item.role, customerType: item.customerType, difficulty: item.difficulty, summary: item.summary, interests: item.interests, scenarioContext: item.scenarioContext }));
    return Array.from(this.personasById.values());
  }

  async getPersona(personaId: string): Promise<SimulationPersonaSnapshot> {
    if (this.dependencies.contentResolver) {
      const item = (await this.dependencies.contentResolver.listPublicCatalog()).find((candidate) => candidate.id === personaId);
      if (item) return { id: item.id, displayName: item.displayName, role: item.role, customerType: item.customerType, difficulty: item.difficulty, summary: item.summary, interests: item.interests, scenarioContext: item.scenarioContext };
    }
    const persona = this.personasById.get(personaId);
    if (!persona) throw new SimulationServiceError("PERSONA_NOT_FOUND", "Không tìm thấy khách hàng AI.");
    return persona;
  }

  async listRecentSessions(userId: string, limit = 10) {
    return (await this.listHistorySessions(userId, { page: 1, pageSize: limit })).items;
  }

  async listHistorySessions(userId: string, input: Partial<SessionHistoryQuery> = {}) {
    const query: SessionHistoryQuery = {
      page: Math.max(1, Math.floor(input.page ?? 1)),
      pageSize: Math.max(1, Math.min(20, Math.floor(input.pageSize ?? 10))),
      ...(input.status ? { status: input.status } : {}),
      ...(input.mode ? { mode: input.mode } : {}),
      ...(input.search?.trim() ? { search: input.search.trim().slice(0, 100) } : {})
    };
    return this.dependencies.sessions.findHistoryByUserId(userId, query);
  }

  async createSession(personaId: string, mode: unknown, userId = "phase3-compatibility", scenarioId?: string | null): Promise<SimulationSession> {
    return this.createSessionWithContext(personaId, mode, userId, null, scenarioId ?? null);
  }

  async createAssignedSession(
    personaId: string,
    mode: unknown,
    userId: string,
    context: AssignedSessionContext
  ): Promise<SimulationSession> {
    if (!context.trainingAssignmentId.trim() || !context.trainingProgramItemId.trim()) {
      throw new SimulationServiceError("SESSION_NOT_FOUND", "Không tìm thấy nội dung được phân công.");
    }
    return this.createSessionWithContext(personaId, mode, userId, context, null);
  }

  private async createSessionWithContext(
    personaId: string,
    mode: unknown,
    userId: string,
    assignmentContext: AssignedSessionContext | null,
    scenarioId: string | null
  ): Promise<SimulationSession> {
    let content: RuntimeContentSelection | null = null;
    if (this.dependencies.contentResolver) {
      content = assignmentContext?.personaVersionId && assignmentContext.scenarioVersionId
        ? await this.dependencies.contentResolver.resolvePinned(assignmentContext.personaVersionId, assignmentContext.scenarioVersionId)
        : await this.dependencies.contentResolver.resolveCurrent(personaId, scenarioId);
      if (!content || content.personaId !== personaId) throw new SimulationServiceError("PERSONA_NOT_FOUND", "Không tìm thấy nội dung luyện tập khả dụng.");
    }
    const persona = content?.personaSnapshot ?? await this.getPersona(personaId);
    if (mode !== "CUSTOMER_FIRST" && mode !== "SALE_FIRST") {
      throw new SimulationServiceError("INVALID_MODE", "Chế độ luyện tập không hợp lệ.");
    }
    const snapshot = persona;
    let id = this.createId();
    let runtimeSessionId = id;
    let scenario = content?.scenarioSnapshot ?? defaultScenario(snapshot);
    let messages: SimulationMessage[] = [];
    let runtimeInsight: SimulationSession["runtimeInsight"] = null;
    let runtimeSnapshot: SimulationSession["runtimeSnapshot"] = null;

    if (mode === "CUSTOMER_FIRST") {
      const opening = await this.callRuntime(() => this.dependencies.orchestrator.startCustomer(personaId, content));
      id = opening.runtimeSessionId;
      runtimeSessionId = opening.runtimeSessionId;
      scenario = opening.scenario ? { ...opening.scenario, difficulty: snapshot.difficulty } : scenario;
      messages = [{ id: this.createId(), sender: "CUSTOMER", content: opening.finalCustomerReply, createdAt: this.now().toISOString() }];
      runtimeInsight = opening.runtimeInsight;
      runtimeSnapshot = opening.runtimeSnapshot;
    }

    const session: SimulationSession = {
      id,
      userId,
      runtimeSessionId,
      personaId,
      personaSnapshot: snapshot,
      scenarioSnapshot: scenario,
      personaVersionId: content?.personaVersionId ?? null,
      scenarioVersionId: content?.scenarioVersionId ?? null,
      contentSnapshot: content,
      mode,
      status: "RUNNING",
      createdAt: this.now().toISOString(),
      completedAt: null,
      messages,
      runtimeInsight,
      runtimeSnapshot,
      signals: [],
      trainingAssignmentId: assignmentContext?.trainingAssignmentId ?? null,
      trainingProgramItemId: assignmentContext?.trainingProgramItemId ?? null
    };
    try {
      await this.dependencies.sessions.save(session);
    } catch (error) {
      await this.dependencies.orchestrator.ensureRuntime?.({
        runtimeSessionId: session.runtimeSessionId,
        personaId: session.personaId,
        messages: [],
        snapshot: null,
        content: session.contentSnapshot
      }, true);
      throw error;
    }
    return session;
  }

  async getSession(sessionId: string, userId?: string): Promise<SimulationSession> {
    const session = await this.getPersistedSession(sessionId, userId);
    if (session.status === "RUNNING" && !session.contentSnapshot && session.personaVersionId && session.scenarioVersionId && this.dependencies.contentResolver) {
      session.contentSnapshot = await this.dependencies.contentResolver.resolvePinned(session.personaVersionId, session.scenarioVersionId);
      if (!session.contentSnapshot) throw new SimulationServiceError("RUNTIME_UNAVAILABLE", "Không thể khôi phục nội dung phiên Runtime.");
      await this.dependencies.sessions.save(session);
    }
    if (session.status === "RUNNING" && session.runtimeSnapshot) {
      try {
        await this.dependencies.orchestrator.ensureRuntime?.({
          runtimeSessionId: session.runtimeSessionId,
          personaId: session.personaId,
          messages: session.messages,
          snapshot: session.runtimeSnapshot,
          content: session.contentSnapshot
        });
      } catch {
        throw new SimulationServiceError("RUNTIME_UNAVAILABLE", "Không thể khôi phục phiên Runtime. Vui lòng thử lại.");
      }
    }
    return session;
  }

  async getPersistedSession(sessionId: string, userId?: string): Promise<SimulationSession> {
    const session = await this.dependencies.sessions.findById(sessionId);
    if (!session) throw new SimulationServiceError("SESSION_NOT_FOUND", "Phiên luyện tập không tồn tại hoặc đã hết hạn.");
    if (userId && session.userId !== userId) throw new SimulationServiceError("SESSION_FORBIDDEN", "Phiên luyện tập không tồn tại hoặc đã hết hạn.");
    return session;
  }

  async sendMessage(sessionId: string, messageInput: unknown, requestedPersonaId?: unknown, userId?: string): Promise<SendMessageResult> {
    return this.withSessionLock(sessionId, async () => {
    const session = await this.getSession(sessionId, userId);
    if (session.status !== "RUNNING") throw new SimulationServiceError("SESSION_COMPLETED", "Phiên luyện tập đã kết thúc.");
    if (typeof requestedPersonaId === "string" && requestedPersonaId !== session.personaId) {
      throw new SimulationServiceError("SESSION_PERSONA_MISMATCH", "Phiên không thuộc khách hàng đã chọn.");
    }
    const message = typeof messageInput === "string" ? messageInput.trim() : "";
    if (!message) throw new SimulationServiceError("MESSAGE_REQUIRED", "Vui lòng nhập nội dung tin nhắn.");
    if (message.length > 4_000) throw new SimulationServiceError("MESSAGE_TOO_LONG", "Tin nhắn vượt quá độ dài cho phép.");

    const runtime = await this.callRuntime(() => this.dependencies.orchestrator.handleSaleMessage({
      runtimeSessionId: session.runtimeSessionId,
      personaId: session.personaId,
      message,
      content: session.contentSnapshot
    }));
    if (runtime.runtimeSessionId !== session.runtimeSessionId) {
      throw new SimulationServiceError("RUNTIME_UNAVAILABLE", "Khách hàng AI chưa thể phản hồi. Vui lòng thử lại.");
    }

    const now = this.now().toISOString();
    const saleMessage: SimulationMessage = { id: this.createId(), sender: "SALE", content: message, createdAt: now };
    const customerMessage: SimulationMessage = { id: this.createId(), sender: "CUSTOMER", content: runtime.finalCustomerReply, createdAt: this.now().toISOString() };
    const updated: SimulationSession = {
      ...session,
      messages: [...session.messages, saleMessage, customerMessage],
      runtimeInsight: runtime.runtimeInsight,
      runtimeSnapshot: runtime.runtimeSnapshot,
      signals: runtime.signals
    };
    if (runtime.shouldEndSession) this.complete(updated);
    try {
      await this.dependencies.sessions.save(updated);
    } catch (error) {
      await this.dependencies.orchestrator.ensureRuntime?.({
        runtimeSessionId: session.runtimeSessionId,
        personaId: session.personaId,
        messages: session.messages,
        snapshot: session.runtimeSnapshot,
        content: session.contentSnapshot
      }, true);
      throw error;
    }
    return { saleMessage, customerMessage, session: updated };
    });
  }

  async stopSession(sessionId: string, userId?: string): Promise<SimulationSession> {
    return this.withSessionLock(sessionId, async () => {
    const session = await this.getSession(sessionId, userId);
    if (session.status === "COMPLETED" && session.result && session.completedAt) return session;
    const updated: SimulationSession = { ...session };
    this.complete(updated);
    await this.dependencies.sessions.save(updated);
    return updated;
    });
  }

  private complete(session: SimulationSession): void {
    const completedAt = session.completedAt ?? this.now().toISOString();
    session.status = "COMPLETED";
    session.completedAt = completedAt;
    session.result = session.result ?? completedResult(session, completedAt);
  }

  private async callRuntime(operation: () => Promise<OrchestrationResult>): Promise<OrchestrationResult> {
    try {
      return await operation();
    } catch {
      throw new SimulationServiceError("RUNTIME_UNAVAILABLE", "Khách hàng AI chưa thể phản hồi. Vui lòng thử lại.");
    }
  }

  private async withSessionLock<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.turnLocks.get(sessionId) ?? Promise.resolve();
    let release = (): void => {};
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.turnLocks.set(sessionId, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.turnLocks.get(sessionId) === current) this.turnLocks.delete(sessionId);
    }
  }
}
