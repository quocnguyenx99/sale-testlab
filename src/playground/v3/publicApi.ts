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
  PublicTrainingMode,
  PublicTrainingProgram,
  PublicManagedTrainingAssignment,
  PublicOwnTrainingAssignment,
  PublicTrainingAssignee,
  PublicGamificationActivity,
  PublicPersonalGamification,
  PublicLeaderboardRow,
  PublicLeaderboard
} from "./publicContracts";
export type { EnrichedPersonaSource } from "./simulationSession";
import {
  toPublicChatMessage,
  toPublicPersona,
  toPublicPersonaOption,
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
import { AuthorizationError, requireCapability } from "./authorizationPolicy";
import { TrainingProgramService, TrainingProgramServiceError } from "./trainingPrograms/trainingProgramService";
import { TrainingAssignmentService, TrainingAssignmentServiceError } from "./trainingAssignments/trainingAssignmentService";
import { TrainingContentService, TrainingContentServiceError } from "./trainingContent/trainingContentService";
import { GamificationService, GamificationServiceError } from "./gamification/gamificationService";

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

export function createV3Api(dependencies: { service: SimulationService; auth: AuthService; evaluationService?: EvaluationService; coachingService?: CoachingService; progressService?: ProgressService; trainingProgramService?: TrainingProgramService; trainingAssignmentService?: TrainingAssignmentService; trainingContentService?: TrainingContentService; gamificationService?: GamificationService }) {
  const { service, auth, evaluationService, coachingService, progressService, trainingProgramService, trainingAssignmentService, trainingContentService, gamificationService } = dependencies;
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

      if (req.method === "GET" && pathname === "/api/v3/gamification/me") {
        if (!gamificationService) throw new HttpRequestError(503, "GAMIFICATION_UNAVAILABLE", "Gamification tạm thời chưa sẵn sàng.");
        sendJson(res, 200, { gamification: await gamificationService.getPersonal(currentUser) });
        return true;
      }

      if (req.method === "GET" && pathname === "/api/v3/leaderboard") {
        requireCapability(currentUser, "VIEW_LEADERBOARD");
        if (!gamificationService) throw new HttpRequestError(503, "GAMIFICATION_UNAVAILABLE", "Bảng xếp hạng tạm thời chưa sẵn sàng.");
        sendJson(res, 200, { leaderboard: await gamificationService.getLeaderboard(currentUser.id, url.searchParams.get("page"), url.searchParams.get("pageSize")) });
        return true;
      }

      if (pathname === "/api/v3/manage/personas" && (req.method === "GET" || req.method === "POST")) {
        requireCapability(currentUser, "MANAGE_PERSONAS");
        if (!trainingContentService) throw new HttpRequestError(503, "TRAINING_CONTENT_UNAVAILABLE", "Nội dung đào tạo tạm thời chưa sẵn sàng.");
        if (req.method === "GET") sendJson(res, 200, { personas: await trainingContentService.listPersonas() });
        else sendJson(res, 201, { persona: await trainingContentService.createPersona(currentUser.id, await readJsonBody(req)) });
        return true;
      }

      if (pathname === "/api/v3/manage/scenarios" && (req.method === "GET" || req.method === "POST")) {
        requireCapability(currentUser, "MANAGE_SCENARIOS");
        if (!trainingContentService) throw new HttpRequestError(503, "TRAINING_CONTENT_UNAVAILABLE", "Nội dung đào tạo tạm thời chưa sẵn sàng.");
        if (req.method === "GET") sendJson(res, 200, { scenarios: await trainingContentService.listScenarios() });
        else sendJson(res, 201, { scenario: await trainingContentService.createScenario(currentUser.id, await readJsonBody(req)) });
        return true;
      }

      const personaVersionPublish = pathname.match(/^\/api\/v3\/manage\/personas\/([^/]+)\/versions\/([^/]+)\/publish$/);
      const personaVersion = pathname.match(/^\/api\/v3\/manage\/personas\/([^/]+)\/versions\/([^/]+)$/);
      const personaVersions = pathname.match(/^\/api\/v3\/manage\/personas\/([^/]+)\/versions$/);
      const personaArchive = pathname.match(/^\/api\/v3\/manage\/personas\/([^/]+)\/archive$/);
      const personaLinks = pathname.match(/^\/api\/v3\/manage\/personas\/([^/]+)\/scenarios$/);
      const managedPersona = pathname.match(/^\/api\/v3\/manage\/personas\/([^/]+)$/);
      if (personaVersionPublish || personaVersion || personaVersions || personaArchive || personaLinks || managedPersona) {
        requireCapability(currentUser, "MANAGE_PERSONAS");
        if (!trainingContentService) throw new HttpRequestError(503, "TRAINING_CONTENT_UNAVAILABLE", "Nội dung đào tạo tạm thời chưa sẵn sàng.");
        if (personaVersionPublish && req.method === "POST") sendJson(res, 200, { persona: await trainingContentService.publishPersona(decodeURIComponent(personaVersionPublish[1]), decodeURIComponent(personaVersionPublish[2]), await readJsonBody(req)) });
        else if (personaVersion && req.method === "PUT") sendJson(res, 200, { persona: await trainingContentService.updatePersona(decodeURIComponent(personaVersion[1]), decodeURIComponent(personaVersion[2]), await readJsonBody(req)) });
        else if (personaVersion && req.method === "DELETE") { await trainingContentService.deletePersonaDraft(decodeURIComponent(personaVersion[1]), decodeURIComponent(personaVersion[2])); sendJson(res, 200, { ok: true }); }
        else if (personaVersions && req.method === "POST") sendJson(res, 201, { persona: await trainingContentService.createPersonaVersion(currentUser.id, decodeURIComponent(personaVersions[1])) });
        else if (personaArchive && req.method === "POST") { await trainingContentService.archivePersona(decodeURIComponent(personaArchive[1])); sendJson(res, 200, { ok: true }); }
        else if (personaLinks && req.method === "PUT") sendJson(res, 200, { persona: await trainingContentService.replaceLinks(decodeURIComponent(personaLinks[1]), await readJsonBody(req)) });
        else if (managedPersona && req.method === "GET") sendJson(res, 200, { persona: await trainingContentService.getPersona(decodeURIComponent(managedPersona[1]), url.searchParams.get("versionId")) });
        else throw new HttpRequestError(404, "NOT_FOUND", "API không tồn tại.");
        return true;
      }

      const scenarioVersionPublish = pathname.match(/^\/api\/v3\/manage\/scenarios\/([^/]+)\/versions\/([^/]+)\/publish$/);
      const scenarioVersion = pathname.match(/^\/api\/v3\/manage\/scenarios\/([^/]+)\/versions\/([^/]+)$/);
      const scenarioVersions = pathname.match(/^\/api\/v3\/manage\/scenarios\/([^/]+)\/versions$/);
      const scenarioArchive = pathname.match(/^\/api\/v3\/manage\/scenarios\/([^/]+)\/archive$/);
      const managedScenario = pathname.match(/^\/api\/v3\/manage\/scenarios\/([^/]+)$/);
      if (scenarioVersionPublish || scenarioVersion || scenarioVersions || scenarioArchive || managedScenario) {
        requireCapability(currentUser, "MANAGE_SCENARIOS");
        if (!trainingContentService) throw new HttpRequestError(503, "TRAINING_CONTENT_UNAVAILABLE", "Nội dung đào tạo tạm thời chưa sẵn sàng.");
        if (scenarioVersionPublish && req.method === "POST") sendJson(res, 200, { scenario: await trainingContentService.publishScenario(decodeURIComponent(scenarioVersionPublish[1]), decodeURIComponent(scenarioVersionPublish[2]), await readJsonBody(req)) });
        else if (scenarioVersion && req.method === "PUT") sendJson(res, 200, { scenario: await trainingContentService.updateScenario(decodeURIComponent(scenarioVersion[1]), decodeURIComponent(scenarioVersion[2]), await readJsonBody(req)) });
        else if (scenarioVersion && req.method === "DELETE") { await trainingContentService.deleteScenarioDraft(decodeURIComponent(scenarioVersion[1]), decodeURIComponent(scenarioVersion[2])); sendJson(res, 200, { ok: true }); }
        else if (scenarioVersions && req.method === "POST") sendJson(res, 201, { scenario: await trainingContentService.createScenarioVersion(currentUser.id, decodeURIComponent(scenarioVersions[1])) });
        else if (scenarioArchive && req.method === "POST") { await trainingContentService.archiveScenario(decodeURIComponent(scenarioArchive[1])); sendJson(res, 200, { ok: true }); }
        else if (managedScenario && req.method === "GET") sendJson(res, 200, { scenario: await trainingContentService.getScenario(decodeURIComponent(managedScenario[1]), url.searchParams.get("versionId")) });
        else throw new HttpRequestError(404, "NOT_FOUND", "API không tồn tại.");
        return true;
      }

      if (req.method === "GET" && pathname === "/api/v3/training-assignees") {
        requireCapability(currentUser, "ASSIGN_TRAINING");
        if (!trainingAssignmentService) throw new HttpRequestError(503, "TRAINING_ASSIGNMENTS_UNAVAILABLE", "Phân công đào tạo tạm thời chưa sẵn sàng.");
        sendJson(res, 200, { assignees: await trainingAssignmentService.listAssignees() });
        return true;
      }

      const assignmentCancelMatch = pathname.match(/^\/api\/v3\/training-assignments\/([^/]+)\/cancel$/);
      if (assignmentCancelMatch && req.method === "POST") {
        requireCapability(currentUser, "ASSIGN_TRAINING");
        if (!trainingAssignmentService) throw new HttpRequestError(503, "TRAINING_ASSIGNMENTS_UNAVAILABLE", "Phân công đào tạo tạm thời chưa sẵn sàng.");
        sendJson(res, 200, { assignment: await trainingAssignmentService.cancel(decodeURIComponent(assignmentCancelMatch[1])) });
        return true;
      }

      const managedAssignmentMatch = pathname.match(/^\/api\/v3\/training-assignments\/([^/]+)$/);
      if (managedAssignmentMatch && req.method === "GET") {
        requireCapability(currentUser, "ASSIGN_TRAINING");
        if (!trainingAssignmentService) throw new HttpRequestError(503, "TRAINING_ASSIGNMENTS_UNAVAILABLE", "Phân công đào tạo tạm thời chưa sẵn sàng.");
        sendJson(res, 200, { assignment: await trainingAssignmentService.getManaged(decodeURIComponent(managedAssignmentMatch[1])) });
        return true;
      }

      if (pathname === "/api/v3/training-assignments" && (req.method === "GET" || req.method === "POST")) {
        requireCapability(currentUser, "ASSIGN_TRAINING");
        if (!trainingAssignmentService) throw new HttpRequestError(503, "TRAINING_ASSIGNMENTS_UNAVAILABLE", "Phân công đào tạo tạm thời chưa sẵn sàng.");
        if (req.method === "GET") {
          sendJson(res, 200, { assignments: await trainingAssignmentService.listManaged() });
        } else {
          sendJson(res, 201, { assignment: await trainingAssignmentService.create(currentUser.id, await readJsonBody(req)) });
        }
        return true;
      }

      const ownAssignmentStartMatch = pathname.match(/^\/api\/v3\/my-training-assignments\/([^/]+)\/items\/([^/]+)\/start$/);
      if (ownAssignmentStartMatch && req.method === "POST") {
        requireCapability(currentUser, "USE_OWN_TRAINING");
        if (!trainingAssignmentService) throw new HttpRequestError(503, "TRAINING_ASSIGNMENTS_UNAVAILABLE", "Bài tập được giao tạm thời chưa sẵn sàng.");
        const session = await trainingAssignmentService.startAssignedItem(
          decodeURIComponent(ownAssignmentStartMatch[1]),
          decodeURIComponent(ownAssignmentStartMatch[2]),
          currentUser.id
        );
        sendJson(res, 201, { session: toPublicSession(session) });
        return true;
      }

      const ownAssignmentMatch = pathname.match(/^\/api\/v3\/my-training-assignments\/([^/]+)$/);
      if (ownAssignmentMatch && req.method === "GET") {
        requireCapability(currentUser, "USE_OWN_TRAINING");
        if (!trainingAssignmentService) throw new HttpRequestError(503, "TRAINING_ASSIGNMENTS_UNAVAILABLE", "Bài tập được giao tạm thời chưa sẵn sàng.");
        sendJson(res, 200, { assignment: await trainingAssignmentService.getOwn(decodeURIComponent(ownAssignmentMatch[1]), currentUser.id) });
        return true;
      }

      if (pathname === "/api/v3/my-training-assignments" && req.method === "GET") {
        requireCapability(currentUser, "USE_OWN_TRAINING");
        if (!trainingAssignmentService) throw new HttpRequestError(503, "TRAINING_ASSIGNMENTS_UNAVAILABLE", "Bài tập được giao tạm thời chưa sẵn sàng.");
        sendJson(res, 200, { assignments: await trainingAssignmentService.listOwn(currentUser.id) });
        return true;
      }

      const trainingProgramActionMatch = pathname.match(/^\/api\/v3\/training-programs\/([^/]+)\/(publish|archive)$/);
      if (trainingProgramActionMatch && req.method === "POST") {
        requireCapability(currentUser, "MANAGE_TRAINING_PROGRAMS");
        if (!trainingProgramService) throw new HttpRequestError(503, "TRAINING_PROGRAMS_UNAVAILABLE", "Chương trình đào tạo tạm thời chưa sẵn sàng.");
        const programId = decodeURIComponent(trainingProgramActionMatch[1]);
        const program = trainingProgramActionMatch[2] === "publish"
          ? await trainingProgramService.publish(programId)
          : await trainingProgramService.archive(programId);
        sendJson(res, 200, { program });
        return true;
      }

      const trainingProgramMatch = pathname.match(/^\/api\/v3\/training-programs\/([^/]+)$/);
      if (trainingProgramMatch && (req.method === "GET" || req.method === "PATCH" || req.method === "DELETE")) {
        requireCapability(currentUser, "MANAGE_TRAINING_PROGRAMS");
        if (!trainingProgramService) throw new HttpRequestError(503, "TRAINING_PROGRAMS_UNAVAILABLE", "Chương trình đào tạo tạm thời chưa sẵn sàng.");
        const programId = decodeURIComponent(trainingProgramMatch[1]);
        if (req.method === "GET") {
          sendJson(res, 200, { program: await trainingProgramService.get(programId) });
        } else if (req.method === "PATCH") {
          sendJson(res, 200, { program: await trainingProgramService.update(programId, await readJsonBody(req)) });
        } else {
          await trainingProgramService.deleteDraft(programId);
          sendJson(res, 200, { ok: true });
        }
        return true;
      }

      if (pathname === "/api/v3/training-programs" && (req.method === "GET" || req.method === "POST")) {
        requireCapability(currentUser, "MANAGE_TRAINING_PROGRAMS");
        if (!trainingProgramService) throw new HttpRequestError(503, "TRAINING_PROGRAMS_UNAVAILABLE", "Chương trình đào tạo tạm thời chưa sẵn sàng.");
        if (req.method === "GET") {
          sendJson(res, 200, { programs: await trainingProgramService.list() });
        } else {
          sendJson(res, 201, { program: await trainingProgramService.create(currentUser.id, await readJsonBody(req)) });
        }
        return true;
      }

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
        if (req.method === "POST" && evaluation?.status === "COMPLETED" && gamificationService) {
          await safelyReconcile(() => gamificationService.reconcileSession(sessionId));
        }
        sendJson(res, 200, { state: evaluation?.status ?? "NOT_EVALUATED", evaluation: evaluation ? toPublicSessionEvaluation(evaluation) : null });
        return true;
      }

      if (req.method === "GET" && pathname === "/api/v3/personas") {
        const personas = trainingContentService
          ? (await trainingContentService.listPublic()).map(toPublicPersonaOption)
          : (await service.listPersonas()).map(toPublicPersona);
        sendJson(res, 200, { personas });
        return true;
      }

      const personaMatch = pathname.match(/^\/api\/v3\/personas\/([^/]+)$/);
      if (req.method === "GET" && personaMatch) {
        const personaId = decodeURIComponent(personaMatch[1]);
        if (trainingContentService) {
          const persona = (await trainingContentService.listPublic()).find((item) => item.id === personaId);
          if (!persona) throw new SimulationServiceError("PERSONA_NOT_FOUND", "Không tìm thấy khách hàng AI.");
          sendJson(res, 200, { persona: toPublicPersonaOption(persona) });
        } else sendJson(res, 200, { persona: toPublicPersona(await service.getPersona(personaId)) });
        return true;
      }

      if (req.method === "POST" && pathname === "/api/v3/sessions") {
        const body = await readJsonBody(req);
        const personaId = typeof body.personaId === "string" ? body.personaId.trim() : "";
        const scenarioId = typeof body.scenarioId === "string" ? body.scenarioId.trim() : null;
        const session = await service.createSession(personaId, body.mode, currentUser.id, scenarioId);
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
        if (result.session.status === "COMPLETED" && gamificationService) {
          await safelyReconcile(() => gamificationService.reconcileAssignmentForSession(result.session.id));
        }
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
        if (gamificationService) await safelyReconcile(() => gamificationService.reconcileAssignmentForSession(session.id));
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
      } else if (error instanceof TrainingProgramServiceError) {
        const status = error.code === "TRAINING_PROGRAM_NOT_FOUND"
          ? 404
          : error.code === "INVALID_TRAINING_PROGRAM_INPUT" || error.code === "INVALID_TRAINING_CONTENT_REFERENCE"
            ? 400
            : 409;
        sendJson(res, status, { error: { code: error.code, message: error.message } });
      } else if (error instanceof TrainingContentServiceError) {
        const status = error.code === "CONTENT_NOT_FOUND" ? 404
          : error.code === "INVALID_CONTENT_INPUT" || error.code === "INVALID_CONTENT_LINKS" ? 400
            : 409;
        sendJson(res, status, { error: { code: error.code, message: error.message } });
      } else if (error instanceof TrainingAssignmentServiceError) {
        const status = error.code === "TRAINING_ASSIGNMENT_NOT_FOUND" || error.code === "TRAINING_ASSIGNMENT_ITEM_NOT_FOUND"
          ? 404
          : error.code === "INVALID_TRAINING_ASSIGNMENT_INPUT" || error.code === "TRAINING_ASSIGNEE_NOT_ELIGIBLE" || error.code === "TRAINING_PROGRAM_NOT_ASSIGNABLE"
            ? 400
            : 409;
        sendJson(res, status, { error: { code: error.code, message: error.message } });
      } else if (error instanceof GamificationServiceError) {
        const status = error.code === "GAMIFICATION_FORBIDDEN" ? 403 : 400;
        sendJson(res, status, { error: { code: error.code, message: error.message } });
      } else {
        sendJson(res, 503, { error: { code: "SERVICE_UNAVAILABLE", message: "Dịch vụ tạm thời chưa sẵn sàng. Vui lòng thử lại." } });
      }
      return true;
    }
  };
}

async function safelyReconcile(operation: () => Promise<unknown>): Promise<void> {
  try { await operation(); }
  catch { console.error("[gamification] reconciliation pending"); }
}
