import { PrismaClient } from "@prisma/client";
import { AuthRepository, AuthUserRecord } from "./authRepository";

export class DatabaseAuthRepository implements AuthRepository {
  constructor(private readonly client: PrismaClient) {}

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return this.client.user.findUnique({ where: { email } });
  }

  async createSession(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.client.authSession.create({ data: input });
  }

  async findUserBySessionTokenHash(tokenHash: string, now: Date): Promise<AuthUserRecord | null> {
    const session = await this.client.authSession.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now }, user: { status: "ACTIVE" } },
      include: { user: true }
    });
    if (!session) return null;
    if (!session.lastSeenAt || now.getTime() - session.lastSeenAt.getTime() >= 15 * 60 * 1000) {
      await this.client.authSession.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    }
    return session.user;
  }

  async revokeSession(tokenHash: string, now: Date): Promise<void> {
    await this.client.authSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: now } });
  }

  async touchUserLogin(userId: string, now: Date): Promise<void> {
    await this.client.user.update({ where: { id: userId }, data: { lastLoginAt: now } });
  }
}
