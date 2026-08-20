import { strict as assert } from "assert";
import { randomUUID } from "crypto";
import { hash } from "bcryptjs";
import { hasCapability } from "./authorizationPolicy";
import { AuthService, AuthServiceError, hashAuthToken } from "./authService";
import { DatabaseAuthRepository } from "./databaseAuthRepository";
import { prisma } from "./prismaClient";
import { UserRole } from "./userRole";

const fixedNow = new Date("2026-08-20T03:00:00.000Z");
const fixtureUserId = randomUUID();
const fixtureEmail = `phase10a3-${fixtureUserId}@example.test`;
const password = "phase10a3-valid-password";
const primaryToken = `phase10a3-primary-${fixtureUserId}`;
const fixtureSessionIds = new Set<string>();

async function expectAuthError(promise: Promise<unknown>, code: "INVALID_CREDENTIALS" | "UNAUTHENTICATED"): Promise<AuthServiceError> {
  try {
    await promise;
  } catch (error) {
    assert(error instanceof AuthServiceError);
    assert.equal(error.code, code);
    return error;
  }
  assert.fail(`Expected AuthServiceError ${code}`);
}

async function rememberSession(token: string): Promise<string> {
  const session = await prisma.authSession.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(token) } });
  assert.equal(session.userId, fixtureUserId);
  fixtureSessionIds.add(session.id);
  return session.id;
}

async function assertOnlyPrimarySession(primarySessionId: string): Promise<void> {
  const sessions = await prisma.authSession.findMany({ where: { userId: fixtureUserId }, select: { id: true } });
  assert.equal(sessions.length, 1, "role freshness must not create another auth session");
  assert.equal(sessions[0].id, primarySessionId, "role freshness must reuse the original auth session");
}

async function updateRole(role: UserRole): Promise<void> {
  await prisma.user.update({ where: { id: fixtureUserId }, data: { role } });
}

async function main(): Promise<void> {
  const repository = new DatabaseAuthRepository(prisma);
  const auth = new AuthService(repository, { now: () => fixedNow, createToken: () => primaryToken });
  let fixtureUserCreated = false;

  try {
    const fixtureUser = await prisma.user.create({
      data: {
        id: fixtureUserId,
        email: fixtureEmail,
        passwordHash: await hash(password, 4),
        displayName: "Phase 10A-3 Auth Fixture",
        role: "SALE",
        status: "ACTIVE"
      }
    });
    fixtureUserCreated = fixtureUser.id === fixtureUserId && fixtureUser.email === fixtureEmail;

    const saleLogin = await auth.login(fixtureEmail, password);
    assert.equal(saleLogin.user.role, "SALE");
    const primarySessionId = await rememberSession(primaryToken);
    await assertOnlyPrimarySession(primarySessionId);

    const storedSession = await prisma.authSession.findUniqueOrThrow({ where: { id: primarySessionId } });
    assert.equal(storedSession.tokenHash, hashAuthToken(primaryToken));
    assert.notEqual(storedSession.tokenHash, primaryToken);
    assert.equal("role" in storedSession, false);
    assert.equal("capabilities" in storedSession, false);

    const saleUser = await auth.currentUser(primaryToken);
    assert.equal(saleUser.role, "SALE");
    assert.equal(hasCapability(saleUser, "MANAGE_TRAINING_PROGRAMS"), false);

    await updateRole("MANAGER");
    const managerUser = await auth.currentUser(primaryToken);
    assert.equal(managerUser.role, "MANAGER");
    assert.equal(hasCapability(managerUser, "MANAGE_TRAINING_PROGRAMS"), true);
    await assertOnlyPrimarySession(primarySessionId);

    await updateRole("ADMIN");
    assert.equal((await auth.currentUser(primaryToken)).role, "ADMIN");
    await assertOnlyPrimarySession(primarySessionId);

    await updateRole("SALE");
    assert.equal((await auth.currentUser(primaryToken)).role, "SALE");
    await assertOnlyPrimarySession(primarySessionId);

    const wrongPassword = await expectAuthError(auth.login(fixtureEmail, "wrong-password"), "INVALID_CREDENTIALS");
    const unknownEmail = await expectAuthError(auth.login(`unknown-${fixtureEmail}`, password), "INVALID_CREDENTIALS");
    assert.equal(wrongPassword.message, unknownEmail.message, "login errors must not reveal account existence");

    const managerToken = `phase10a3-manager-${fixtureUserId}`;
    await updateRole("MANAGER");
    const managerLogin = await new AuthService(repository, { now: () => fixedNow, createToken: () => managerToken }).login(fixtureEmail, password);
    assert.equal(managerLogin.user.role, "MANAGER");
    await rememberSession(managerToken);

    const adminToken = `phase10a3-admin-${fixtureUserId}`;
    await updateRole("ADMIN");
    const adminLogin = await new AuthService(repository, { now: () => fixedNow, createToken: () => adminToken }).login(fixtureEmail, password);
    assert.equal(adminLogin.user.role, "ADMIN");
    await rememberSession(adminToken);

    await prisma.user.update({ where: { id: fixtureUserId }, data: { status: "DISABLED" } });
    await expectAuthError(auth.currentUser(primaryToken), "UNAUTHENTICATED");
    const inactiveLogin = await expectAuthError(auth.login(fixtureEmail, password), "INVALID_CREDENTIALS");
    assert.equal(inactiveLogin.message, wrongPassword.message);

    await prisma.user.update({ where: { id: fixtureUserId }, data: { status: "ACTIVE", role: "SALE" } });
    assert.equal((await auth.currentUser(primaryToken)).role, "SALE");

    const expiredToken = `phase10a3-expired-${fixtureUserId}`;
    const expiredSessionId = randomUUID();
    await prisma.authSession.create({
      data: {
        id: expiredSessionId,
        userId: fixtureUserId,
        tokenHash: hashAuthToken(expiredToken),
        expiresAt: new Date(fixedNow.getTime() - 1)
      }
    });
    fixtureSessionIds.add(expiredSessionId);
    await expectAuthError(auth.currentUser(expiredToken), "UNAUTHENTICATED");
    await expectAuthError(auth.currentUser(`phase10a3-unknown-${fixtureUserId}`), "UNAUTHENTICATED");
    await expectAuthError(auth.currentUser(null), "UNAUTHENTICATED");

    await auth.logout(primaryToken);
    await expectAuthError(auth.currentUser(primaryToken), "UNAUTHENTICATED");
    assert((await prisma.authSession.findUniqueOrThrow({ where: { id: primarySessionId } })).revokedAt);

    console.log("Phase 10A-3 database auth contract tests: PASS");
  } finally {
    if (fixtureUserCreated) {
      const remainingSessions = await prisma.authSession.findMany({ where: { userId: fixtureUserId }, select: { id: true } });
      for (const { id } of remainingSessions) fixtureSessionIds.add(id);
      for (const id of fixtureSessionIds) {
        const session = await prisma.authSession.findUnique({ where: { id }, select: { userId: true } });
        if (!session) continue;
        assert.equal(session.userId, fixtureUserId, "cleanup refused a session outside the exact fixture user");
        await prisma.authSession.delete({ where: { id } });
      }
      const storedFixtureUser = await prisma.user.findUnique({ where: { id: fixtureUserId }, select: { email: true } });
      if (storedFixtureUser) {
        assert.equal(storedFixtureUser.email, fixtureEmail, "cleanup refused a user outside the exact fixture identity");
        await prisma.user.delete({ where: { id: fixtureUserId } });
      }
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
