import { strict as assert } from 'assert'
import backendAuthorizationPolicy from '../../../src/playground/v3/authorizationPolicy'
import { hasUiCapability, ROLE_UI_CAPABILITIES, USER_ROLES } from '../src/app/authorizationPolicy'
import {
  isTrainingProgramEditable,
  trainingProgramStatusClass,
  trainingProgramStatusLabel,
} from '../src/utils/trainingProgramPresentation'

assert.equal(trainingProgramStatusLabel('DRAFT'), 'Bản nháp')
assert.equal(trainingProgramStatusLabel('PUBLISHED'), 'Đã xuất bản')
assert.equal(trainingProgramStatusLabel('ARCHIVED'), 'Đã lưu trữ')
assert.equal(trainingProgramStatusClass('DRAFT').includes('amber'), true)
assert.equal(trainingProgramStatusClass('PUBLISHED').includes('emerald'), true)
assert.equal(trainingProgramStatusClass('ARCHIVED').includes('slate'), true)

assert.equal(isTrainingProgramEditable('DRAFT'), true)
assert.equal(isTrainingProgramEditable('PUBLISHED'), false)
assert.equal(isTrainingProgramEditable('ARCHIVED'), false)

assert.equal(hasUiCapability('SALE', 'MANAGE_TRAINING_PROGRAMS'), false)
assert.equal(hasUiCapability('MANAGER', 'MANAGE_TRAINING_PROGRAMS'), true)
assert.equal(hasUiCapability('ADMIN', 'MANAGE_TRAINING_PROGRAMS'), true)

for (const role of USER_ROLES) {
  assert.deepEqual(
    [...ROLE_UI_CAPABILITIES[role]].sort(),
    [...backendAuthorizationPolicy.ROLE_CAPABILITIES[role]].sort(),
    `${role} frontend/backend capability drift`,
  )
}

console.log('Phase 10B Training Program presentation/policy tests: PASS')
