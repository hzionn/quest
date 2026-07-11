const SERVICE_RE = /\b(?:AWS|Amazon|S3|EC2|Lambda|IAM|CloudWatch|CloudFront|DynamoDB|RDS|Route 53|Bedrock|SageMaker|VPC|EBS|EFS|SQS|SNS|KMS|WAF|GuardDuty|CloudTrail)\b/gi

export function createMemoryAnchor(question, explanation) {
  const text = String(explanation || '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  const first = text.split(/(?<=[。！？.!?])\s*/)[0] || text
  const anchor = first.length > 150 ? `${first.slice(0, 147)}…` : first
  const services = [...new Set((text.match(SERVICE_RE) || []).map(s => s.replace(/\s+/g, ' ')))].slice(0, 5)
  return { anchor, services, exam: question?.exam || '' }
}

export function buildExamProgressReport(examHistory = [], exam, currentPct, repeatedWrong = 0) {
  const previous = [...examHistory].reverse().find(item => item.exam === exam)
  const delta = previous ? currentPct - (previous.pct || 0) : null
  const message = delta == null
    ? '這是這個科別的第一份成績基準。'
    : delta > 0 ? `比上次進步 ${delta} 個百分點。`
      : delta < 0 ? `比上次下降 ${Math.abs(delta)} 個百分點，建議先複習錯題。`
        : '與上次成績持平，下一步可提升作答穩定度。'
  return { previousPct: previous?.pct ?? null, delta, repeatedWrong, message }
}
