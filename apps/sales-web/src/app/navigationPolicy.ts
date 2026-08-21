import { hasUiCapability, isUserRole, type UiCapability, type UserRole } from './authorizationPolicy'

export interface RoleAwareNavigationRule {
  requiredCapability?: UiCapability
  roles?: readonly UserRole[]
}

export function isNavigationItemVisible(item: RoleAwareNavigationRule, role: unknown): boolean {
  if (item.requiredCapability) return hasUiCapability(role, item.requiredCapability)
  return isUserRole(role) && Boolean(item.roles?.includes(role))
}
