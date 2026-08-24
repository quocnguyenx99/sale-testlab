export const USER_ROLES = ['SALE', 'MANAGER', 'ADMIN'] as const

export type UserRole = (typeof USER_ROLES)[number]

export const UI_CAPABILITIES = [
  'USE_OWN_TRAINING',
  'MANAGE_TRAINING_PROGRAMS',
  'ASSIGN_TRAINING',
  'MANAGE_PERSONAS',
  'MANAGE_SCENARIOS',
  'VIEW_LEADERBOARD',
  'MANAGE_USERS',
  'MANAGE_SYSTEM',
] as const

export type UiCapability = (typeof UI_CAPABILITIES)[number]

const capabilities = (...values: UiCapability[]): readonly UiCapability[] => Object.freeze(values)

export const ROLE_UI_CAPABILITIES: Readonly<Record<UserRole, readonly UiCapability[]>> = Object.freeze({
  SALE: capabilities('USE_OWN_TRAINING', 'VIEW_LEADERBOARD'),
  MANAGER: capabilities(
    'USE_OWN_TRAINING',
    'MANAGE_TRAINING_PROGRAMS',
    'ASSIGN_TRAINING',
    'MANAGE_PERSONAS',
    'MANAGE_SCENARIOS',
    'VIEW_LEADERBOARD',
  ),
  ADMIN: UI_CAPABILITIES,
})

const roleLabels: Readonly<Record<UserRole, string>> = Object.freeze({
  SALE: 'Nhân viên kinh doanh',
  MANAGER: 'Quản lý',
  ADMIN: 'Quản trị viên',
})

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

export function userRoleLabel(role: unknown): string {
  return isUserRole(role) ? roleLabels[role] : 'Vai trò không xác định'
}

export function hasUiCapability(role: unknown, capability: unknown): boolean {
  if (!isUserRole(role) || !isUiCapability(capability)) return false
  return ROLE_UI_CAPABILITIES[role].includes(capability)
}

function isUiCapability(value: unknown): value is UiCapability {
  return typeof value === 'string' && (UI_CAPABILITIES as readonly string[]).includes(value)
}
