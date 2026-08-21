import { strict as assert } from 'assert'
import backendAuthorizationPolicy from '../../../src/playground/v3/authorizationPolicy'
import { hasUiCapability, ROLE_UI_CAPABILITIES, USER_ROLES } from '../src/app/authorizationPolicy'
import { isNavigationItemVisible } from '../src/app/navigationPolicy'
import {
  assignmentItemStateLabel,
  assignmentStateClass,
  assignmentStateLabel,
  trainingModeLabel,
} from '../src/utils/trainingAssignmentPresentation'

assert.equal(assignmentStateLabel('ASSIGNED'), 'Đã giao')
assert.equal(assignmentStateLabel('IN_PROGRESS'), 'Đang thực hiện')
assert.equal(assignmentStateLabel('COMPLETED'), 'Hoàn thành')
assert.equal(assignmentStateLabel('CANCELLED'), 'Đã hủy')
assert.equal(assignmentStateClass('COMPLETED').includes('emerald'), true)
assert.equal(assignmentStateClass('CANCELLED').includes('slate'), true)
assert.equal(assignmentItemStateLabel('NOT_STARTED'), 'Chưa bắt đầu')
assert.equal(assignmentItemStateLabel('IN_PROGRESS'), 'Đang luyện tập')
assert.equal(assignmentItemStateLabel('COMPLETED'), 'Hoàn thành')
assert.equal(trainingModeLabel('SALE_FIRST'), 'Bạn mở lời')
assert.equal(trainingModeLabel('CUSTOMER_FIRST'), 'Khách hàng mở lời')

const management = { requiredCapability: 'ASSIGN_TRAINING' as const }
const ownAssignments = { roles: ['SALE'] as const }
assert.equal(isNavigationItemVisible(management, 'SALE'), false)
assert.equal(isNavigationItemVisible(management, 'MANAGER'), true)
assert.equal(isNavigationItemVisible(management, 'ADMIN'), true)
assert.equal(isNavigationItemVisible(ownAssignments, 'SALE'), true)
assert.equal(isNavigationItemVisible(ownAssignments, 'MANAGER'), false)
assert.equal(isNavigationItemVisible(ownAssignments, 'ADMIN'), false)
assert.equal(hasUiCapability('SALE', 'ASSIGN_TRAINING'), false)

for (const role of USER_ROLES) {
  assert.deepEqual([...ROLE_UI_CAPABILITIES[role]].sort(), [...backendAuthorizationPolicy.ROLE_CAPABILITIES[role]].sort())
}

console.log('Phase 10C assignment presentation/navigation policy tests: PASS')
