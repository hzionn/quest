import test from 'node:test'
import assert from 'node:assert/strict'
import { getExcludedExams } from '../src/certifications.js'

test('earning Security Specialty excludes every bank version from recommendations', () => {
  const excluded = getExcludedExams({ 'aws-scs': { enabled: true } })
  assert.equal(excluded.has('SCS-C02'), true)
  assert.equal(excluded.has('SCS-C03'), true)
  assert.equal(excluded.has('SCS-C03 補充'), true)
})

test('disabled certifications remain eligible for recommendations', () => {
  const excluded = getExcludedExams({ 'aws-saa': { enabled: false } })
  assert.equal(excluded.has('SAA-C03'), false)
})
