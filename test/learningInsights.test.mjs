import test from 'node:test'
import assert from 'node:assert/strict'
import { buildExamProgressReport, createMemoryAnchor } from '../src/learningInsights.js'

test('memory anchor extracts a short first conclusion and service names', () => {
  const result = createMemoryAnchor({ exam: 'SAA-C03' }, 'Amazon S3 Transfer Acceleration 可加速跨洲上傳。搭配分段上傳可提高可靠性。')
  assert.match(result.anchor, /Transfer Acceleration/)
  assert.deepEqual(result.services, ['Amazon', 'S3'])
})

test('exam report compares with the previous result for the same exam', () => {
  const report = buildExamProgressReport([{ exam: 'SAA-C03', pct: 70 }, { exam: 'CLF-C02', pct: 90 }], 'SAA-C03', 82, 2)
  assert.equal(report.delta, 12)
  assert.equal(report.repeatedWrong, 2)
})
