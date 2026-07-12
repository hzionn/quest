import test from 'node:test'
import assert from 'node:assert/strict'
import { buildExamProgressReport, createMemoryAnchor } from '../src/learningInsights.js'

const LAMBDA_EXP = '正确。将 Lambda 函数配置到数据库所在的 VPC（连接到相应子网），即可通过私有端点访问位于私有子网中的数据库，既解决了连通性问题，又保持了数据库的私有配置，不影响安全性。'

test('memory anchor compresses to a short action → effect with service names', () => {
  const result = createMemoryAnchor({ exam: 'SAA-C03' }, LAMBDA_EXP)
  assert.match(result.anchor, /Lambda/)
  assert.match(result.anchor, /→/)
  // Must be a real compression, not a copy of the explanation.
  assert.ok(result.anchor.length < LAMBDA_EXP.length * 0.7)
  assert.deepEqual(result.services, ['Lambda', 'VPC'])
})

test('memory anchor strips the leading verdict word', () => {
  const result = createMemoryAnchor({ exam: 'SAA-C03' }, '正确。由于查询中 95% 是读操作，使用 Aurora Auto Scaling 根据 Aurora 副本的平均 CPU 利用率自动添加或移除 Aurora 副本，可以有效扩展读取能力，满足读取流量增长的需求。')
  assert.ok(!/^正确/.test(result.anchor))
  assert.match(result.anchor, /Aurora/)
})

test('memory anchor hides for boilerplate or short explanations', () => {
  assert.equal(createMemoryAnchor({ exam: 'SAA-C03' }, '正确。'), null)
  assert.equal(createMemoryAnchor({ exam: 'SAA-C03' }, '错误。此选项不正确。'), null)
  // Short enough to read in one glance → no anchor box.
  assert.equal(createMemoryAnchor({ exam: 'SAA-C03' }, '正确。S3 Transfer Acceleration 通过边缘节点加速上传。'), null)
})

test('exam report compares with the previous result for the same exam', () => {
  const report = buildExamProgressReport([{ exam: 'SAA-C03', pct: 70 }, { exam: 'CLF-C02', pct: 90 }], 'SAA-C03', 82, 2)
  assert.equal(report.delta, 12)
  assert.equal(report.repeatedWrong, 2)
})
