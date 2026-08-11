import * as http from "http";
export type {
  PublicChatMessage,
  PublicPersona,
  PublicRuntimeInsight,
  PublicScenario,
  PublicSession,
  PublicSessionResult,
  PublicSessionStatus,
  PublicTrainingMode
} from "./publicContracts";
export type { EnrichedPersonaSource } from "./simulationSession";
import {
  toPublicChatMessage,
  toPublicPersona,
  toPublicRuntimeInsight,
  toPublicSession,
  toPublicSessionResult
} from "./publicDtoMapper";
import { SimulationService, SimulationServiceError } from "./simulationService";

class HttpRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
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
  if (error.code === "PERSONA_NOT_FOUND" || error.code === "SESSION_NOT_FOUND") return 404;
  if (error.code === "SESSION_COMPLETED" || error.code === "SESSION_PERSONA_MISMATCH") return 409;
  if (error.code === "RUNTIME_UNAVAILABLE") return 503;
  return 400;
}

export function createV3Api(service: SimulationService) {
  return async function handleV3Request(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    if (!pathname.startsWith("/api/v3/")) return false;

    try {
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
        const session = await service.createSession(personaId, body.mode);
        sendJson(res, 201, { session: toPublicSession(session) });
        return true;
      }

      const sessionMatch = pathname.match(/^\/api\/v3\/sessions\/([^/]+)$/);
      if (req.method === "GET" && sessionMatch) {
        const session = await service.getSession(decodeURIComponent(sessionMatch[1]));
        sendJson(res, 200, { session: toPublicSession(session) });
        return true;
      }

      const messageMatch = pathname.match(/^\/api\/v3\/sessions\/([^/]+)\/messages$/);
      if (req.method === "POST" && messageMatch) {
        const body = await readJsonBody(req);
        const result = await service.sendMessage(
          decodeURIComponent(messageMatch[1]),
          body.message,
          body.personaId
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
        const session = await service.stopSession(decodeURIComponent(stopMatch[1]));
        if (!session.result) throw new Error("Session result missing after stop");
        sendJson(res, 200, { session: toPublicSession(session), result: toPublicSessionResult(session.result) });
        return true;
      }

      throw new HttpRequestError(404, "NOT_FOUND", "API không tồn tại.");
    } catch (error) {
      if (error instanceof HttpRequestError) {
        sendJson(res, error.status, { error: { code: error.code, message: error.message } });
      } else if (error instanceof SimulationServiceError) {
        sendJson(res, statusFor(error), { error: { code: error.code, message: error.message } });
      } else {
        sendJson(res, 503, { error: { code: "RUNTIME_UNAVAILABLE", message: "Khách hàng AI chưa thể phản hồi. Vui lòng thử lại." } });
      }
      return true;
    }
  };
}
