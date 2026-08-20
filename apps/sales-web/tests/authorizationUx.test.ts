import { strict as assert } from 'assert'
import backendAuthorizationPolicy from '../../../src/playground/v3/authorizationPolicy'
import { classifyApiAccess, notifyApiAccess, subscribeApiAccess } from '../src/app/apiAccessNotifier'
import {
  hasUiCapability,
  ROLE_UI_CAPABILITIES,
  UI_CAPABILITIES,
  USER_ROLES,
  userRoleLabel,
  type UserRole,
} from '../src/app/authorizationPolicy'

const { ROLE_CAPABILITIES: BACKEND_ROLE_CAPABILITIES } = backendAuthorizationPolicy

assert.equal(userRoleLabel('SALE'), 'Nhân viên kinh doanh')
assert.equal(userRoleLabel('MANAGER'), 'Quản lý')
assert.equal(userRoleLabel('ADMIN'), 'Quản trị viên')
assert.equal(userRoleLabel('OWNER'), 'Vai trò không xác định')
assert.equal(hasUiCapability('OWNER', 'USE_OWN_TRAINING'), false)
assert.equal(hasUiCapability('ADMIN', 'UNKNOWN_CAPABILITY'), false)

const expectedCapabilities: Readonly<Record<UserRole, readonly string[]>> = {
  SALE: ['USE_OWN_TRAINING'],
  MANAGER: [
    'USE_OWN_TRAINING',
    'MANAGE_TRAINING_PROGRAMS',
    'ASSIGN_TRAINING',
    'MANAGE_PERSONAS',
    'MANAGE_SCENARIOS',
  ],
  ADMIN: UI_CAPABILITIES,
}

for (const role of USER_ROLES) {
  for (const capability of UI_CAPABILITIES) {
    assert.equal(
      hasUiCapability(role, capability),
      expectedCapabilities[role].includes(capability),
      `${role} capability mismatch for ${capability}`,
    )
  }
  assert.deepEqual(
    [...ROLE_UI_CAPABILITIES[role]].sort(),
    [...BACKEND_ROLE_CAPABILITIES[role]].sort(),
    `${role} frontend policy drifted from backend policy`,
  )
}

assert.equal(hasUiCapability('MANAGER', 'MANAGE_TRAINING_PROGRAMS'), true)
assert.equal(hasUiCapability('SALE', 'MANAGE_TRAINING_PROGRAMS'), false)

assert.equal(classifyApiAccess(401), 'UNAUTHENTICATED')
assert.equal(classifyApiAccess(403), 'FORBIDDEN')
for (const status of [200, 400, 404, 500]) assert.equal(classifyApiAccess(status), null)

const notifications: string[] = []
const listener = (status: string) => notifications.push(status)
const unsubscribeFirst = subscribeApiAccess(listener)
const unsubscribeDuplicate = subscribeApiAccess(listener)
notifyApiAccess(401)
notifyApiAccess(403)
notifyApiAccess(500)
assert.deepEqual(notifications, ['UNAUTHENTICATED', 'FORBIDDEN'])
unsubscribeFirst()
unsubscribeFirst()
unsubscribeDuplicate()
notifyApiAccess(401)
assert.deepEqual(notifications, ['UNAUTHENTICATED', 'FORBIDDEN'])

const remountNotifications: string[] = []
const unsubscribeRemount = subscribeApiAccess((status) => remountNotifications.push(status))
notifyApiAccess(401)
notifyApiAccess(401)
notifyApiAccess(403)
assert.deepEqual(remountNotifications, ['UNAUTHENTICATED', 'UNAUTHENTICATED', 'FORBIDDEN'])
unsubscribeRemount()
notifyApiAccess(403)
assert.deepEqual(remountNotifications, ['UNAUTHENTICATED', 'UNAUTHENTICATED', 'FORBIDDEN'])

console.log('Phase 10A-4 frontend authorization policy/notifier tests: PASS')
