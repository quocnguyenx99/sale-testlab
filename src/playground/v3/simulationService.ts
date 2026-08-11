import { randomUUID } from "crypto";
import { SessionRepository } from "./sessionRepository";
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

export type SimulationErrorCode =
  | "PERSONA_NOT_FOUND"
  | "INVALID_MODE"
  | "SESSION_NOT_FOUND"
  | "SESSION_COMPLETED"
  | "SESSION_PERSONA_MISMATCH"
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

interface SimulationServiceDependencies {
  sessions: SessionRepository;
  orchestrator: SimulationOrchestrator;
  personas: EnrichedPersonaSource[];
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

  constructor(private readonly dependencies: SimulationServiceDependencies) {
    this.personasById = new Map(dependencies.personas.map((persona) => [persona.persona_id, personaSnapshot(persona)]));
    this.now = dependencies.now ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
  }

  listPersonas(): SimulationPersonaSnapshot[] {
    return Array.from(this.personasById.values());
  }

  getPersona(personaId: string): SimulationPersonaSnapshot {
    const persona = this.personasById.get(personaId);
    if (!persona) throw new SimulationServiceError("PERSONA_NOT_FOUND", "Không tìm thấy khách hàng AI.");
    return persona;
  }

  async createSession(personaId: string, mode: unknown): Promise<SimulationSession> {
    const persona = this.getPersona(personaId);
    if (mode !== "CUSTOMER_FIRST" && mode !== "SALE_FIRST") {
      throw new SimulationServiceError("INVALID_MODE", "Chế độ luyện tập không hợp lệ.");
    }
    const snapshot = persona;
    let id = this.createId();
    let runtimeSessionId = id;
    let scenario = defaultScenario(snapshot);
    let messages: SimulationMessage[] = [];
    let runtimeInsight: SimulationSession["runtimeInsight"] = null;

    if (mode === "CUSTOMER_FIRST") {
      const opening = await this.callRuntime(() => this.dependencies.orchestrator.startCustomer(personaId));
      id = opening.runtimeSessionId;
      runtimeSessionId = opening.runtimeSessionId;
      scenario = opening.scenario ? { ...opening.scenario, difficulty: snapshot.difficulty } : scenario;
      messages = [{ id: this.createId(), sender: "CUSTOMER", content: opening.finalCustomerReply, createdAt: this.now().toISOString() }];
      runtimeInsight = opening.runtimeInsight;
    }

    const session: SimulationSession = {
      id,
      runtimeSessionId,
      personaId,
      personaSnapshot: snapshot,
      scenarioSnapshot: scenario,
      mode,
      status: "RUNNING",
      createdAt: this.now().toISOString(),
      completedAt: null,
      messages,
      runtimeInsight,
      signals: []
    };
    await this.dependencies.sessions.save(session);
    return session;
  }

  async getSession(sessionId: string): Promise<SimulationSession> {
    const session = await this.dependencies.sessions.findById(sessionId);
    if (!session) throw new SimulationServiceError("SESSION_NOT_FOUND", "Phiên luyện tập không tồn tại hoặc đã hết hạn.");
    return session;
  }

  async sendMessage(sessionId: string, messageInput: unknown, requestedPersonaId?: unknown): Promise<SendMessageResult> {
    const session = await this.getSession(sessionId);
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
      message
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
      signals: runtime.signals
    };
    if (runtime.shouldEndSession) this.complete(updated);
    await this.dependencies.sessions.save(updated);
    return { saleMessage, customerMessage, session: updated };
  }

  async stopSession(sessionId: string): Promise<SimulationSession> {
    const session = await this.getSession(sessionId);
    if (session.status === "COMPLETED" && session.result && session.completedAt) return session;
    const updated: SimulationSession = { ...session };
    this.complete(updated);
    await this.dependencies.sessions.save(updated);
    return updated;
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
}
