import { randomUUID } from "crypto";
import * as http from "http";

export type PublicTrainingMode = "CUSTOMER_FIRST" | "SALE_FIRST";
export type PublicSessionStatus = "RUNNING" | "COMPLETED";

export interface PublicScenario {
  id: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

export interface PublicPersona {
  id: string;
  displayName: string;
  role: string;
  customerType: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  summary: string;
  interests: string[];
  scenarioContext: string;
  defaultScenario: PublicScenario;
}

export interface PublicChatMessage {
  id: string;
  sender: "CUSTOMER" | "SALE";
  content: string;
  createdAt: string;
}

export interface PublicRuntimeInsight {
  runtimeState: string;
  resolvedTopics: string[];
  missingTopics: string[];
  nextUnresolvedTopic: string | null;
  dealOutcome: string;
  trainingStatus: string;
  topicProgress: { resolved: number; total: number };
  activeProduct: { model: string; code: string } | null;
}

export interface PublicSessionResult {
  outcome: string;
  trainingStatus: string;
  turnCount: number;
  durationSeconds: number;
  resolvedTopics: string[];
  missingTopics: string[];
  signals: string[];
}

export interface PublicSession {
  id: string;
  persona: PublicPersona;
  scenario: PublicScenario;
  mode: PublicTrainingMode;
  status: PublicSessionStatus;
  createdAt: string;
  messages: PublicChatMessage[];
  runtimeInsight: PublicRuntimeInsight | null;
  result?: PublicSessionResult;
}

export interface EnrichedPersonaSource {
  persona_id: string;
  display_name: string;
  buyer_role: string;
  organization_type: string;
  product_interest_categories: string[];
  purchase_context: string;
  difficulty: string;
}

type RuntimePayload = Record<string, unknown>;

interface PublicApiContext {
  personas: EnrichedPersonaSource[];
  startCustomer: (personaId: string) => Promise<RuntimePayload>;
  chat: (input: { sessionId: string; personaId: string; message: string }) => Promise<RuntimePayload>;
}

interface StoredSession extends PublicSession {
  signals: string[];
}

const TOPICS = ["product_model", "configuration", "price", "stock", "delivery", "warranty", "payment", "invoice_or_document", "next_step"];

class PublicApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function difficulty(value: string): "EASY" | "MEDIUM" | "HARD" {
  const normalized = value.trim().toUpperCase();
  if (normalized === "HARD") return "HARD";
  if (normalized === "EASY") return "EASY";
  return "MEDIUM";
}

function defaultScenario(persona: EnrichedPersonaSource): PublicScenario {
  const interest = persona.product_interest_categories[0] || "giải pháp phù hợp";
  return {
    id: `persona-${persona.persona_id}`,
    title: `Tư vấn ${interest}`,
    description: persona.purchase_context || `Khám phá nhu cầu của ${persona.buyer_role}.`,
    difficulty: difficulty(persona.difficulty)
  };
}

function projectPersona(persona: EnrichedPersonaSource): PublicPersona {
  const interests = persona.product_interest_categories.slice(0, 5);
  return {
    id: persona.persona_id,
    displayName: persona.display_name,
    role: persona.buyer_role,
    customerType: persona.organization_type,
    difficulty: difficulty(persona.difficulty),
    summary: `${persona.buyer_role} thuộc nhóm ${persona.organization_type}${interests.length > 0 ? `, quan tâm ${interests.join(", ")}` : ""}.`,
    interests,
    scenarioContext: persona.purchase_context,
    defaultScenario: defaultScenario(persona)
  };
}

function projectScenario(value: unknown, persona: EnrichedPersonaSource): PublicScenario {
  const source = record(value);
  if (!source) return defaultScenario(persona);
  const title = typeof source.scenario_product === "string" ? source.scenario_product : "Tình huống tư vấn sản phẩm";
  const need = typeof source.scenario_need === "string" ? source.scenario_need : persona.purchase_context;
  return {
    id: typeof source.scenario_id === "string" ? source.scenario_id : `persona-${persona.persona_id}`,
    title,
    description: need,
    difficulty: difficulty(persona.difficulty)
  };
}

function projectInsight(payload: RuntimePayload): PublicRuntimeInsight {
  const progress = record(payload.conversation_progress);
  const resolvedFromPayload = strings(payload.resolved_topics);
  const missingFromPayload = strings(payload.missing_topics);
  const resolvedTopics = resolvedFromPayload.length > 0
    ? resolvedFromPayload.filter((topic) => TOPICS.includes(topic))
    : TOPICS.filter((topic) => {
      const state = record(progress?.[topic]);
      return Boolean(state?.answered || state?.confirmed);
    });
  const missingTopics = missingFromPayload.length > 0
    ? missingFromPayload.filter((topic) => TOPICS.includes(topic))
    : TOPICS.filter((topic) => !resolvedTopics.includes(topic));
  const activeProduct = typeof payload.selected_product_model === "string" && typeof payload.selected_product_model_code === "string"
    ? { model: payload.selected_product_model, code: payload.selected_product_model_code }
    : null;
  return {
    runtimeState: typeof payload.runtime_state === "string" ? payload.runtime_state : "auto_state",
    resolvedTopics,
    missingTopics,
    nextUnresolvedTopic: typeof payload.next_unresolved_topic === "string" ? payload.next_unresolved_topic : null,
    dealOutcome: typeof payload.deal_outcome === "string" ? payload.deal_outcome : "not_ready",
    trainingStatus: typeof payload.training_success === "string" ? payload.training_success : "in_progress",
    topicProgress: { resolved: resolvedTopics.length, total: TOPICS.length },
    activeProduct
  };
}

function projectSignals(payload: RuntimePayload): string[] {
  return Array.from(new Set([
    ...strings(payload.buying_signals),
    ...strings(payload.closing_signals),
    ...strings(payload.objection_signals)
  ])).slice(0, 8);
}

function publicSession(session: StoredSession): PublicSession {
  return {
    id: session.id,
    persona: session.persona,
    scenario: session.scenario,
    mode: session.mode,
    status: session.status,
    createdAt: session.createdAt,
    messages: session.messages,
    runtimeInsight: session.runtimeInsight,
    ...(session.result ? { result: session.result } : {})
  };
}

function buildResult(session: StoredSession): PublicSessionResult {
  const insight = session.runtimeInsight;
  return {
    outcome: insight?.dealOutcome ?? "not_ready",
    trainingStatus: insight?.trainingStatus ?? "in_progress",
    turnCount: session.messages.filter((message) => message.sender === "SALE").length,
    durationSeconds: Math.max(0, Math.round((Date.now() - Date.parse(session.createdAt)) / 1000)),
    resolvedTopics: insight?.resolvedTopics ?? [],
    missingTopics: insight?.missingTopics ?? TOPICS,
    signals: session.signals
  };
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer | string) => {
      body += chunk.toString();
      if (body.length > 64_000) reject(new PublicApiError(413, "PAYLOAD_TOO_LARGE", "Yêu cầu vượt quá giới hạn cho phép."));
    });
    req.on("end", () => {
      try {
        const parsed: unknown = JSON.parse(body || "{}");
        const value = record(parsed);
        if (!value) throw new PublicApiError(400, "INVALID_BODY", "Dữ liệu yêu cầu không hợp lệ.");
        resolve(value);
      } catch (error) {
        reject(error instanceof PublicApiError ? error : new PublicApiError(400, "INVALID_JSON", "Dữ liệu JSON không hợp lệ."));
      }
    });
    req.on("error", () => reject(new PublicApiError(400, "REQUEST_ERROR", "Không thể đọc yêu cầu.")));
  });
}

export function createV3Api(context: PublicApiContext) {
  const sessions = new Map<string, StoredSession>();
  const personasById = new Map(context.personas.map((persona) => [persona.persona_id, persona]));

  return async function handleV3Request(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    if (!pathname.startsWith("/api/v3/")) return false;

    try {
      if (req.method === "GET" && pathname === "/api/v3/personas") {
        sendJson(res, 200, { personas: context.personas.map(projectPersona) });
        return true;
      }

      const personaMatch = pathname.match(/^\/api\/v3\/personas\/([^/]+)$/);
      if (req.method === "GET" && personaMatch) {
        const persona = personasById.get(decodeURIComponent(personaMatch[1]));
        if (!persona) throw new PublicApiError(404, "PERSONA_NOT_FOUND", "Không tìm thấy khách hàng AI.");
        sendJson(res, 200, { persona: projectPersona(persona) });
        return true;
      }

      if (req.method === "POST" && pathname === "/api/v3/sessions") {
        const body = await readJsonBody(req);
        const personaId = typeof body.personaId === "string" ? body.personaId.trim() : "";
        const mode = body.mode;
        const persona = personasById.get(personaId);
        if (!persona) throw new PublicApiError(404, "PERSONA_NOT_FOUND", "Không tìm thấy khách hàng AI.");
        if (mode !== "CUSTOMER_FIRST" && mode !== "SALE_FIRST") throw new PublicApiError(400, "INVALID_MODE", "Chế độ luyện tập không hợp lệ.");

        let id: string = randomUUID();
        let scenario = defaultScenario(persona);
        let messages: PublicChatMessage[] = [];
        let runtimeInsight: PublicRuntimeInsight | null = null;
        if (mode === "CUSTOMER_FIRST") {
          const runtime = await context.startCustomer(personaId);
          if (typeof runtime.sessionId !== "string" || typeof runtime.reply !== "string") throw new Error("Invalid runtime opening response");
          id = runtime.sessionId;
          scenario = projectScenario(runtime.scenario_context, persona);
          messages = [{ id: randomUUID(), sender: "CUSTOMER", content: runtime.reply, createdAt: new Date().toISOString() }];
          runtimeInsight = projectInsight(runtime);
        }

        const session: StoredSession = {
          id,
          persona: projectPersona(persona),
          scenario,
          mode,
          status: "RUNNING",
          createdAt: new Date().toISOString(),
          messages,
          runtimeInsight,
          signals: []
        };
        sessions.set(id, session);
        sendJson(res, 201, { session: publicSession(session) });
        return true;
      }

      const sessionMatch = pathname.match(/^\/api\/v3\/sessions\/([^/]+)$/);
      if (req.method === "GET" && sessionMatch) {
        const session = sessions.get(decodeURIComponent(sessionMatch[1]));
        if (!session) throw new PublicApiError(404, "SESSION_NOT_FOUND", "Phiên luyện tập không tồn tại hoặc đã hết hạn.");
        sendJson(res, 200, { session: publicSession(session) });
        return true;
      }

      const messageMatch = pathname.match(/^\/api\/v3\/sessions\/([^/]+)\/messages$/);
      if (req.method === "POST" && messageMatch) {
        const session = sessions.get(decodeURIComponent(messageMatch[1]));
        if (!session) throw new PublicApiError(404, "SESSION_NOT_FOUND", "Phiên luyện tập không tồn tại hoặc đã hết hạn.");
        if (session.status !== "RUNNING") throw new PublicApiError(409, "SESSION_COMPLETED", "Phiên luyện tập đã kết thúc.");
        const body = await readJsonBody(req);
        const message = typeof body.message === "string" ? body.message.trim() : "";
        if (!message) throw new PublicApiError(400, "MESSAGE_REQUIRED", "Vui lòng nhập nội dung tin nhắn.");
        if (message.length > 4_000) throw new PublicApiError(400, "MESSAGE_TOO_LONG", "Tin nhắn vượt quá độ dài cho phép.");
        if (typeof body.personaId === "string" && body.personaId !== session.persona.id) throw new PublicApiError(409, "SESSION_PERSONA_MISMATCH", "Phiên không thuộc khách hàng đã chọn.");

        const runtime = await context.chat({ sessionId: session.id, personaId: session.persona.id, message });
        if (typeof runtime.reply !== "string" || !runtime.reply.trim()) throw new Error("Invalid runtime chat response");
        const now = new Date().toISOString();
        const saleMessage: PublicChatMessage = { id: randomUUID(), sender: "SALE", content: message, createdAt: now };
        const customerMessage: PublicChatMessage = { id: randomUUID(), sender: "CUSTOMER", content: runtime.reply, createdAt: new Date().toISOString() };
        session.messages.push(saleMessage, customerMessage);
        session.runtimeInsight = projectInsight(runtime);
        session.signals = projectSignals(runtime);
        if (runtime.should_end_session === true) {
          session.status = "COMPLETED";
          session.result = buildResult(session);
        }
        sendJson(res, 200, { saleMessage, customerMessage, runtimeInsight: session.runtimeInsight, sessionStatus: session.status });
        return true;
      }

      const stopMatch = pathname.match(/^\/api\/v3\/sessions\/([^/]+)\/stop$/);
      if (req.method === "POST" && stopMatch) {
        const session = sessions.get(decodeURIComponent(stopMatch[1]));
        if (!session) throw new PublicApiError(404, "SESSION_NOT_FOUND", "Phiên luyện tập không tồn tại hoặc đã hết hạn.");
        session.status = "COMPLETED";
        session.result = buildResult(session);
        sendJson(res, 200, { session: publicSession(session), result: session.result });
        return true;
      }

      throw new PublicApiError(404, "NOT_FOUND", "API không tồn tại.");
    } catch (error) {
      if (error instanceof PublicApiError) {
        sendJson(res, error.status, { error: { code: error.code, message: error.message } });
      } else {
        sendJson(res, 503, { error: { code: "RUNTIME_UNAVAILABLE", message: "Khách hàng AI chưa thể phản hồi. Vui lòng thử lại." } });
      }
      return true;
    }
  };
}
