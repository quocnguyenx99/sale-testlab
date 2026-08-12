import { createHash, randomBytes } from "crypto";
import { compare } from "bcryptjs";
import { AuthRepository, AuthUserRecord, PublicAuthUser } from "./authRepository";

export type AuthErrorCode = "INVALID_CREDENTIALS" | "UNAUTHENTICATED";

export class AuthServiceError extends Error {
  constructor(public readonly code: AuthErrorCode, message: string) { super(message); }
}

export interface LoginResult {
  user: PublicAuthUser;
  token: string;
  expiresAt: Date;
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly options: { now?: () => Date; ttlHours?: number; createToken?: () => string } = {}
  ) {}

  async login(emailInput: unknown, passwordInput: unknown): Promise<LoginResult> {
    const email = typeof emailInput === "string" ? emailInput.trim().toLowerCase() : "";
    const password = typeof passwordInput === "string" ? passwordInput : "";
    const invalid = () => new AuthServiceError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.");
    if (!email || !password) throw invalid();
    const user = await this.repository.findUserByEmail(email);
    if (!user || user.status !== "ACTIVE" || !await compare(password, user.passwordHash)) throw invalid();

    const now = this.now();
    const expiresAt = new Date(now.getTime() + (this.options.ttlHours ?? 168) * 60 * 60 * 1000);
    const token = this.options.createToken?.() ?? randomBytes(32).toString("base64url");
    await this.repository.createSession({ userId: user.id, tokenHash: hashAuthToken(token), expiresAt });
    await this.repository.touchUserLogin(user.id, now);
    return { user: toPublicAuthUser(user), token, expiresAt };
  }

  async currentUser(token: string | null | undefined): Promise<PublicAuthUser> {
    if (!token) throw new AuthServiceError("UNAUTHENTICATED", "Vui lòng đăng nhập để tiếp tục.");
    const user = await this.repository.findUserBySessionTokenHash(hashAuthToken(token), this.now());
    if (!user) throw new AuthServiceError("UNAUTHENTICATED", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
    return toPublicAuthUser(user);
  }

  async logout(token: string | null | undefined): Promise<void> {
    if (token) await this.repository.revokeSession(hashAuthToken(token), this.now());
  }

  private now(): Date { return this.options.now?.() ?? new Date(); }
}

export function hashAuthToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function toPublicAuthUser(user: AuthUserRecord): PublicAuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}
