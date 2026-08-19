import { strict as assert } from "assert";
import { UserRole as PrismaUserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { AuthService } from "./authService";
import { bootstrapDevelopmentUser } from "./bootstrapUser";
import { DatabaseAuthRepository } from "./databaseAuthRepository";
import { prisma } from "./prismaClient";
import { parseUserRole, USER_ROLES } from "./userRole";

const fixturePrefix = `phase10a1-${process.pid}-${Date.now()}`;
const fixtureEmail = (name: string): string => `${fixturePrefix}-${name}@example.test`;

async function main(): Promise<void> {
  const password = "phase10a1-valid-password";
  const passwordHash = await hash(password, 4);

  try {
    assert.deepEqual(Object.values(PrismaUserRole), USER_ROLES);
    assert.equal(parseUserRole("SALE"), "SALE");
    assert.equal(parseUserRole("MANAGER"), "MANAGER");
    assert.equal(parseUserRole("ADMIN"), "ADMIN");
    assert.throws(() => parseUserRole("OWNER"), /INVALID_USER_ROLE/);

    const defaultUser = await prisma.user.create({
      data: { email: fixtureEmail("default"), passwordHash, displayName: "Default Role Fixture" }
    });
    const sale = await prisma.user.create({
      data: { email: fixtureEmail("sale"), passwordHash, displayName: "Sale Fixture", role: "SALE" }
    });
    const manager = await prisma.user.create({
      data: { email: fixtureEmail("manager"), passwordHash, displayName: "Manager Fixture", role: "MANAGER" }
    });
    const admin = await prisma.user.create({
      data: { email: fixtureEmail("admin"), passwordHash, displayName: "Admin Fixture", role: "ADMIN" }
    });

    assert.equal(defaultUser.role, "SALE");
    assert.equal(sale.role, "SALE");
    assert.equal(manager.role, "MANAGER");
    assert.equal(admin.role, "ADMIN");

    const auth = new AuthService(new DatabaseAuthRepository(prisma), { createToken: () => `${fixturePrefix}-token` });
    const login = await auth.login(manager.email, password);
    assert.equal(login.user.role, "MANAGER");
    assert.equal((await auth.currentUser(login.token)).role, "MANAGER");

    const bootstrapEmail = fixtureEmail("bootstrap");
    const bootstrapEnvironment = {
      DEV_BOOTSTRAP_EMAIL: bootstrapEmail,
      DEV_BOOTSTRAP_PASSWORD: password,
      DEV_BOOTSTRAP_DISPLAY_NAME: "Bootstrap Fixture"
    };
    await bootstrapDevelopmentUser(prisma, bootstrapEnvironment);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { email: bootstrapEmail } })).role, "SALE");
    await prisma.user.update({ where: { email: bootstrapEmail }, data: { role: "MANAGER" } });
    await bootstrapDevelopmentUser(prisma, { ...bootstrapEnvironment, DEV_BOOTSTRAP_DISPLAY_NAME: "Updated Bootstrap Fixture" });
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { email: bootstrapEmail } })).role, "MANAGER");

    console.log("Phase 10A-1 role model/database/bootstrap tests: PASS");
  } finally {
    await prisma.user.deleteMany({ where: { email: { startsWith: fixturePrefix } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
