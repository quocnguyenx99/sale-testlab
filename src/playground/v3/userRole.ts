export const USER_ROLES = ["SALE", "MANAGER", "ADMIN"] as const;

export type UserRole = typeof USER_ROLES[number];

export function parseUserRole(value: unknown): UserRole {
  if (typeof value === "string" && (USER_ROLES as readonly string[]).includes(value)) return value as UserRole;
  throw new Error("INVALID_USER_ROLE");
}
