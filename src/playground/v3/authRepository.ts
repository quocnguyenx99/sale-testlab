import { UserRole } from "./userRole";

export type AuthUserRole = UserRole;

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: AuthUserRole;
  status: "ACTIVE" | "DISABLED";
}

export interface PublicAuthUser {
  id: string;
  email: string;
  displayName: string;
  role: AuthUserRole;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  createSession(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findUserBySessionTokenHash(tokenHash: string, now: Date): Promise<AuthUserRecord | null>;
  revokeSession(tokenHash: string, now: Date): Promise<void>;
  touchUserLogin(userId: string, now: Date): Promise<void>;
}
