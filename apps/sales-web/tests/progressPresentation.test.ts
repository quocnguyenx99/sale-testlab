import { strict as assert } from 'assert'
import { formatProgressDate, formatProgressScore, isLowDataTrend, labelProgressMode, labelProgressTrend, progressResultPath } from '../src/utils/progressPresentation'

assert.equal(formatProgressScore(null), 'Chưa có dữ liệu')
assert.equal(formatProgressScore(82.25), '82,3')
assert.equal(formatProgressDate('invalid'), 'Chưa rõ thời điểm')
assert.equal(labelProgressMode('CUSTOMER_FIRST'), 'Khách hàng mở lời')
assert.equal(labelProgressMode('SALE_FIRST'), 'Bạn mở lời')
assert.equal(progressResultPath('session / 1'), '/practice/session%20%2F%201/result')

const labels = {
  NO_DATA: 'Chưa có dữ liệu',
  BASELINE_ONLY: 'Đã có điểm khởi đầu',
  LIMITED_DATA: 'Chưa đủ dữ liệu để xác định xu hướng',
  IMPROVING: 'Đang cải thiện',
  STABLE: 'Tương đối ổn định',
  DECLINING: 'Có xu hướng giảm',
} as const

for (const [state, label] of Object.entries(labels)) assert.equal(labelProgressTrend(state as keyof typeof labels), label)
assert.equal(isLowDataTrend('NO_DATA'), true)
assert.equal(isLowDataTrend('BASELINE_ONLY'), true)
assert.equal(isLowDataTrend('LIMITED_DATA'), true)
assert.equal(isLowDataTrend('IMPROVING'), false)
assert.equal(isLowDataTrend('STABLE'), false)
assert.equal(isLowDataTrend('DECLINING'), false)

console.log('Phase 9C progress presentation tests: PASS')
