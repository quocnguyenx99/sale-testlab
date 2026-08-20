import { parseUserRole, type UserRole } from "./userRole";

export const AUTHORIZATION_CAPABILITIES = Object.freeze([
  "USE_OWN_TRAINING",
  "MANAGE_TRAINING_PROGRAMS",
  "ASSIGN_TRAINING",
  "MANAGE_PERSONAS",
  "MANAGE_SCENARIOS",
  "MANAGE_USERS",
  "MANAGE_SYSTEM"
] as const);

export type AuthorizationCapability = typeof AUTHORIZATION_CAPABILITIES[number];

const capabilities = (...values: AuthorizationCapability[]): readonly AuthorizationCapability[] => Object.freeze(values);

export const ROLE_CAPABILITIES: Readonly<Record<UserRole, readonly AuthorizationCapability[]>> = Object.freeze({
  SALE: capabilities(
    "USE_OWN_TRAINING"
  ),
  MANAGER: capabilities(
    "USE_OWN_TRAINING",
    "MANAGE_TRAINING_PROGRAMS",
    "ASSIGN_TRAINING",
    "MANAGE_PERSONAS",
    "MANAGE_SCENARIOS"
  ),
  ADMIN: AUTHORIZATION_CAPABILITIES
});

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN" as const;

  constructor() {
    super("Bạn không có quyền thực hiện thao tác này.");
    this.name = "AuthorizationError";
  }
}

export function hasCapability(subject: unknown, capability: unknown): boolean {
  const role = roleFrom(subject);
  if (!role || !isAuthorizationCapability(capability)) return false;
  return ROLE_CAPABILITIES[role].includes(capability);
}

export function requireCapability(subject: unknown, capability: unknown): void {
  if (!hasCapability(subject, capability)) throw new AuthorizationError();
}

function roleFrom(subject: unknown): UserRole | null {
  const value = typeof subject === "object" && subject !== null && "role" in subject
    ? (subject as { role: unknown }).role
    : subject;
  try {
    return parseUserRole(value);
  } catch {
    return null;
  }
}

function isAuthorizationCapability(value: unknown): value is AuthorizationCapability {
  return typeof value === "string" && (AUTHORIZATION_CAPABILITIES as readonly string[]).includes(value);
}
