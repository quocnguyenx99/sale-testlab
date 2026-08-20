import * as http from "http";
export type {
  PublicChatMessage,
  PublicCoachingPriority,
  PublicProgress,
  PublicPersona,
  PublicRecentSession,
  PublicRuntimeInsight,
  PublicScenario,
  PublicSession,
  PublicSessionCoaching,
  PublicSessionEvaluation,
  PublicSessionResult,
  PublicSessionStatus,
  PublicTrainingMode
} from "./publicContracts";
export type { EnrichedPersonaSource } from "./simulationSession";
import {
  toPublicChatMessage,
  toPublicPersona,
  toPublicRecentSession,
  toPublicRuntimeInsight,
  toPublicSession,
  toPublicSessionCoaching,
  toPublicSessionEvaluation,
  toPublicSessionResult
} from "./publicDtoMapper";
import { SimulationService, SimulationServiceError } from "./simulationService";
import { AuthService, AuthServiceError } from "./authService";
import { SessionHistoryQuery } from "./sessionRepository";
import { EvaluationService, EvaluationServiceError } from "./evaluation/evaluationService";
import { CoachingService, CoachingServiceError } from "./coaching/coachingService";
import { ProgressService } from "./progress/progressService";
import { AuthorizationError } from "./authorizationPolicy";

const AUTH_COOKIE = "testlab_session";

class HttpRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export interface AuthorizationHttpErrorResponse {
  status: 403;
  payload: { error: { code: "FORBIDDEN"; message: string } };
}

export function mapAuthorizationError(error: unknown): AuthorizationHttpErrorResponse | null {
  if (!(error instanceof AuthorizationError)) return null;
  return {
    status: 403,
    payload: { error: { code: error.code, message: error.message } }
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    let exceeded = false;
    req.on("data", (chunk: Buffer | string) => {
      if (exceeded) return;
      body += chunk.toString();
      if (body.length > 64_000) {
        exceeded = true;
        reject(new HttpRequestError(413, "PAYLOAD_TOO_LARGE", "Yêu cầu vượt quá giới hạn cho phép."));
      }
    });
    req.on("end", () => {
      if (exceeded) return;
      try {
        const value = record(JSON.parse(body || "{}"));
        if (!value) throw new HttpRequestError(400, "INVALID_BODY", "Dữ liệu yêu cầu không hợp lệ.");
        resolve(value);
      } catch (error) {
        reject(error instanceof HttpRequestError ? error : new HttpRequestError(400, "INVALID_JSON", "Dữ liệu JSON không hợp lệ."));
      }
    });
    req.on("error", () => reject(new HttpRequestError(400, "REQUEST_ERROR", "Không thể đọc yêu cầu.")));
  });
}

function statusFor(error: SimulationServiceError): number {
  if (error.code === "PERSONA_NOT_FOUND" || error.code === "SESSION_NOT_FOUND" || error.code === "SESSION_FORBIDDEN") return 404;
  if (error.code === "SESSION_COMPLETED" || error.code === "SESSION_PERSONA_MISMATCH") return 409;
  if (error.code === "RUNTIME_UNAVAILABLE") return 503;
  return 400;
}

function cookie(req: http.IncomingMessage, name: string): string | null {
  for (const part of (req.headers.cookie || "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(value.join("="));
      } catch (error) {
        if (error instanceof URIError) return null;
        throw error;
      }
    }
  }
  return null;
}

function authCookie(token: string, expiresAt: Date): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${AUTH_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}${secure}`;
}

function clearAuthCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${AUTH_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

function positiveInteger(value: string | null, fallback: number, name: string): number {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new HttpRequestError(400, "INVALID_QUERY", `${name} không hợp lệ.`);
  return parsed;
}

function historyQuery(url: URL): SessionHistoryQuery {
  const statusValue = url.searchParams.get("status");
  const modeValue = url.searchParams.get("mode");
  if (statusValue && statusValue !== "RUNNING" && statusValue !== "COMPLETED") {
    throw new HttpRequestError(400, "INVALID_QUERY", "Trạng thái phiên không hợp lệ.");
  }
  if (modeValue && modeValue !== "CUSTOMER_FIRST" && modeValue !== "SALE_FIRST") {
    throw new HttpRequestError(400, "INVALID_QUERY", "Chế độ luyện tập không hợp lệ.");
  }
  const status = statusValue === "RUNNING" || statusValue === "COMPLETED" ? statusValue : undefined;
  const mode = modeValue === "CUSTOMER_FIRST" || modeValue === "SALE_FIRST" ? modeValue : undefined;
  return {
    page: positiveInteger(url.searchParams.get("page"), 1, "page"),
    pageSize: positiveInteger(url.searchParams.get("pageSize"), 10, "pageSize"),
    ...(status ? { status } : {}),
    ...(mode ? { mode } : {}),
    ...(url.searchParams.get("search")?.trim() ? { search: url.searchParams.get("search")!.trim() } : {})
  };
}

export function createV3Api(dependencies: { service: SimulationService; auth: AuthService; evaluationService?: EvaluationService; coachingService?: CoachingService; progressService?: ProgressService }) {
  const { service, auth, evaluationService, coachingService, progressService } = dependencies;
  return async function handleV3Request(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;
    if (!pathname.startsWith("/api/v3/")) return false;

    try {
      if (req.method === "POST" && pathname === "/api/v3/auth/login") {
        const body = await readJsonBody(req);
        const result = await auth.login(body.email, body.password);
        sendJson(res, 200, { user: result.user }, { "Set-Cookie": authCookie(result.token, result.expiresAt) });
        return true;
      }

      if (req.method === "GET" && pathname === "/api/v3/auth/me") {
        const user = await auth.currentUser(cookie(req, AUTH_COOKIE));
        sendJson(res, 200, { user });
        return true;
      }

      if (req.method === "POST" && pathname === "/api/v3/auth/logout") {
        await auth.logout(cookie(req, AUTH_COOKIE));
        sendJson(res, 200, { ok: true }, { "Set-Cookie": clearAuthCookie() });
        return true;
      }

      const currentUser = await auth.currentUser(cookie(req, AUTH_COOKIE));

      if (req.method === "GET" && pathname === "/api/v3/progress") {
        if (!progressService) throw new HttpRequestError(503, "PROGRESS_UNAVAILABLE", "Tiến độ luyện tập tạm thời chưa sẵn sàng.");
        try {
          sendJson(res, 200, { progress: await progressService.get(currentUser.id) });
        } catch {
          throw new HttpRequestError(503, "PROGRESS_UNAVAILABLE", "Tiến độ luyện tập tạm thời chưa sẵn sàng.");
        }
        return true;
      }

      const coachingMatch = pathname.match(/^\/api\/v3\/sessions\/([^/]+)\/coaching$/);
      if (coachingMatch && (req.method === "GET" || req.method === "POST")) {
        if (!coachingService) throw new HttpRequestError(503, "COACHING_UNAVAILABLE", "AI Coach tạm thời chưa sẵn sàng.");
        const sessionId = decodeURIComponent(coachingMatch[1]);
        if (req.method === "GET") {
          const result = await coachingService.get(sessionId, currentUser.id);
          sendJson(res, 200, { state: result.state, coaching: result.coaching ? toPublicSessionCoaching(result.coaching) : null });
        } else {
          const coaching = await coachingService.generate(sessionId, currentUser.id);
          sendJson(res, 200, { state: coaching.status, coaching: toPublicSessionCoaching(coaching) });
        }
        return true;
      }

      const evaluationMatch = pathname.match(/^\/api\/v3\/sessions\/([^/]+)\/evaluation$/);
      if (evaluationMatch && (req.method === "GET" || req.method === "POST")) {
        if (!evaluationService) throw new HttpRequestError(503, "EVALUATION_UNAVAILABLE", "Tinh nang danh gia tam thoi chua san sang.");
        const sessionId = decodeURIComponent(evaluationMatch[1]);
        const evaluation = req.method === "GET"
          ? await evaluationService.get(sessionId, currentUser.id)
          : await evaluationService.evaluate(sessionId, currentUser.id);
        sendJson(res, 200, { state: evaluation?.status ?? "NOT_EVALUATED", evaluation: evaluation ? toPublicSessionEvaluation(evaluation) : null });
        return true;
      }

      if (req.method === "GET" && pathname === "/api/v3/personas") {
        sendJson(res, 200, { personas: service.listPersonas().map(toPublicPersona) });
        return true;
      }

      const personaMatch = pathname.match(/^\/api\/v3\/personas\/([^/]+)$/);
      if (req.method === "GET" && personaMatch) {
        sendJson(res, 200, { persona: toPublicPersona(service.getPersona(decodeURIComponent(personaMatch[1]))) });
        return true;
      }

      if (req.method === "POST" && pathname === "/api/v3/sessions") {
        const body = await readJsonBody(req);
        const personaId = typeof body.personaId === "string" ? body.personaId.trim() : "";
        const session = await service.createSession(personaId, body.mode, currentUser.id);
        sendJson(res, 201, { session: toPublicSession(session) });
        return true;
      }

      if (req.method === "GET" && pathname === "/api/v3/sessions") {
        const history = await service.listHistorySessions(currentUser.id, historyQuery(url));
        const items = history.items.map(toPublicRecentSession);
        sendJson(res, 200, { sessions: items, items, page: history.page, pageSize: history.pageSize, total: history.total, totalPages: history.totalPages });
        return true;
      }

      const sessionMatch = pathname.match(/^\/api\/v3\/sessions\/([^/]+)$/);
      if (req.method === "GET" && sessionMatch) {
        const sessionId = decodeURIComponent(sessionMatch[1]);
        const session = url.searchParams.get("view") === "replay"
          ? await service.getPersistedSession(sessionId, currentUser.id)
          : await service.getSession(sessionId, currentUser.id);
        sendJson(res, 200, { session: toPublicSession(session) });
        return true;
      }

      const messageMatch = pathname.match(/^\/api\/v3\/sessions\/([^/]+)\/messages$/);
      if (req.method === "POST" && messageMatch) {
        const body = await readJsonBody(req);
        const result = await service.sendMessage(
          decodeURIComponent(messageMatch[1]),
          body.message,
          body.personaId,
          currentUser.id
        );
        if (!result.session.runtimeInsight) throw new Error("Runtime insight missing after message");
        sendJson(res, 200, {
          saleMessage: toPublicChatMessage(result.saleMessage),
          customerMessage: toPublicChatMessage(result.customerMessage),
          runtimeInsight: toPublicRuntimeInsight(result.session.runtimeInsight),
          sessionStatus: result.session.status
        });
        return true;
      }

      const stopMatch = pathname.match(/^\/api\/v3\/sessions\/([^/]+)\/stop$/);
      if (req.method === "POST" && stopMatch) {
        const session = await service.stopSession(decodeURIComponent(stopMatch[1]), currentUser.id);
        if (!session.result) throw new Error("Session result missing after stop");
        sendJson(res, 200, { session: toPublicSession(session), result: toPublicSessionResult(session.result) });
        return true;
      }

      throw new HttpRequestError(404, "NOT_FOUND", "API không tồn tại.");
    } catch (error) {
      const authorizationError = mapAuthorizationError(error);
      if (authorizationError) {
        sendJson(res, authorizationError.status, authorizationError.payload);
      } else if (error instanceof HttpRequestError) {
        sendJson(res, error.status, { error: { code: error.code, message: error.message } });
      } else if (error instanceof SimulationServiceError) {
        sendJson(res, statusFor(error), { error: { code: error.code, message: error.message } });
      } else if (error instanceof AuthServiceError) {
        sendJson(res, 401, { error: { code: error.code, message: error.message } });
      } else if (error instanceof EvaluationServiceError) {
        const status = error.code === "EVALUATION_SESSION_NOT_FOUND" ? 404 : error.code === "SESSION_NOT_COMPLETED" ? 409 : 503;
        sendJson(res, status, { error: { code: error.code, message: error.message } });
      } else if (error instanceof CoachingServiceError) {
        const status = error.code === "COACHING_SESSION_NOT_FOUND" ? 404 : error.code === "SESSION_NOT_COMPLETED" || error.code === "EVALUATION_REQUIRED" ? 409 : 503;
        sendJson(res, status, { error: { code: error.code, message: error.message } });
      } else {
        sendJson(res, 503, { error: { code: "SERVICE_UNAVAILABLE", message: "Dịch vụ tạm thời chưa sẵn sàng. Vui lòng thử lại." } });
      }
      return true;
    }
  };
}
