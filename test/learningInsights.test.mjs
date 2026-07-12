import test from 'node:test'
import assert from 'node:assert/strict'
import { buildExamProgressReport, createMemoryAnchor } from '../src/learningInsights.js'

test('memory anchor extracts a short first conclusion and service names', () => {
  const result = createMemoryAnchor({ exam: 'SAA-C03' }, 'Amazon S3 Transfer Acceleration 可加速跨洲上傳。搭配分段上傳可提高可靠性。')
  assert.match(result.anchor, /Transfer Acceleration/)
  assert.deepEqual(result.services, ['Amazon', 'S3', 'Transfer Acceleration'])
})

test('memory anchor strips the leading verdict word before picking a sentence', () => {
  const result = createMemoryAnchor({ exam: 'SAA-C03' }, '正确。由于查询中 95% 是读操作，使用 Aurora Auto Scaling 可以有效扩展读取能力。')
  assert.ok(!/^正确/.test(result.anchor))
  assert.match(result.anchor, /Aurora Auto Scaling/)
})

test('memory anchor hides when the explanation is only boilerplate', () => {
  assert.equal(createMemoryAnchor({ exam: 'SAA-C03' }, '正确。'), null)
  assert.equal(createMemoryAnchor({ exam: 'SAA-C03' }, '错误。此选项不正确。'), null)
})

test('exam report compares with the previous result for the same exam', () => {
  const report = buildExamProgressReport([{ exam: 'SAA-C03', pct: 70 }, { exam: 'CLF-C02', pct: 90 }], 'SAA-C03', 82, 2)
  assert.equal(report.delta, 12)
  assert.equal(report.repeatedWrong, 2)
})
