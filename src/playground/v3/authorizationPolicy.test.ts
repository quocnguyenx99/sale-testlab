import { strict as assert } from "assert";
import {
  AUTHORIZATION_CAPABILITIES,
  AuthorizationError,
  hasCapability,
  requireCapability,
  ROLE_CAPABILITIES
} from "./authorizationPolicy";
import type { AuthorizationCapability } from "./authorizationPolicy";
import { mapAuthorizationError } from "./publicApi";
import { USER_ROLES, type UserRole } from "./userRole";
import { InMemorySessionRepository } from "./inMemorySessionRepository";
import { SimulationService, SimulationServiceError } from "./simulationService";

const expected: Readonly<Record<UserRole, readonly AuthorizationCapability[]>> = {
  SALE: ["USE_OWN_TRAINING"],
  MANAGER: [
    "USE_OWN_TRAINING",
    "MANAGE_TRAINING_PROGRAMS",
    "ASSIGN_TRAINING",
    "MANAGE_PERSONAS",
    "MANAGE_SCENARIOS"
  ],
  ADMIN: AUTHORIZATION_CAPABILITIES
};

async function main(): Promise<void> {
  for (const role of USER_ROLES) {
    assert.deepEqual(ROLE_CAPABILITIES[role], expected[role]);
    for (const capability of AUTHORIZATION_CAPABILITIES) {
      const allowed = expected[role].includes(capability);
      assert.equal(hasCapability(role, capability), allowed, `${role}:${capability}`);
      assert.equal(hasCapability({ role }, capability), allowed, `user:${role}:${capability}`);
      if (allowed) {
        assert.doesNotThrow(() => requireCapability({ role }, capability));
      } else {
        assert.throws(
          () => requireCapability({ role }, capability),
          (error: unknown) => error instanceof AuthorizationError && error.code === "FORBIDDEN"
        );
      }
    }
  }

  assert.equal(hasCapability("OWNER", "USE_OWN_TRAINING"), false);
  assert.equal(hasCapability("ADMIN", "UNKNOWN_CAPABILITY"), false);
  assert.equal(hasCapability({ role: "SALE", capability: "MANAGE_SYSTEM" }, "MANAGE_SYSTEM"), false);
  assert.equal(hasCapability({ role: "SALE", requestedRole: "ADMIN" }, "MANAGE_SYSTEM"), false);
  assert.throws(() => requireCapability({ role: "OWNER" }, "USE_OWN_TRAINING"), AuthorizationError);
  assert.throws(() => requireCapability({ role: "ADMIN" }, "UNKNOWN"), AuthorizationError);

  const forbidden = mapAuthorizationError(new AuthorizationError());
  assert.deepEqual(forbidden, {
    status: 403,
    payload: { error: { code: "FORBIDDEN", message: "Bạn không có quyền thực hiện thao tác này." } }
  });
  assert.equal(mapAuthorizationError(new Error("FORBIDDEN")), null);
  assert(!JSON.stringify(forbidden).includes("MANAGE_SYSTEM"));

  const sessions = new InMemorySessionRepository();
  await sessions.save({
    id: "owned-session",
    userId: "owner-user",
    runtimeSessionId: "runtime-owned-session",
    personaId: "safe-persona",
    personaSnapshot: { id: "safe-persona", displayName: "Safe", role: "Buyer", customerType: "Business", difficulty: "MEDIUM", summary: "Safe", interests: [], scenarioContext: "Safe" },
    scenarioSnapshot: { id: "safe-scenario", title: "Safe", description: "Safe", difficulty: "MEDIUM" },
    mode: "SALE_FIRST",
    status: "COMPLETED",
    createdAt: "2026-08-20T00:00:00.000Z",
    completedAt: "2026-08-20T00:01:00.000Z",
    messages: [],
    runtimeInsight: null,
    runtimeSnapshot: null,
    signals: [],
    result: { outcome: "completed", trainingStatus: "completed", turnCount: 0, durationSeconds: 60, resolvedTopics: [], missingTopics: [], signals: [] }
  });
  const service = new SimulationService({ sessions, personas: [], orchestrator: {
    startCustomer: async () => { throw new Error("UNUSED"); },
    handleSaleMessage: async () => { throw new Error("UNUSED"); }
  } });
  for (const role of ["MANAGER", "ADMIN"] as const) {
    requireCapability({ id: `${role.toLowerCase()}-user`, role }, "USE_OWN_TRAINING");
    await assert.rejects(
      () => service.getPersistedSession("owned-session", `${role.toLowerCase()}-user`),
      (error: unknown) => error instanceof SimulationServiceError && error.code === "SESSION_FORBIDDEN"
    );
  }

  console.log("Phase 10A-2 authorization capability policy tests: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
