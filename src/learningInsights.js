// AWS + GCP service names, used both to surface service chips and to score
// sentences when picking the anchor.
const SERVICE_RE = /\b(?:AWS|Amazon|Aurora|S3|EC2|Lambda|IAM|CloudWatch|CloudFront|DynamoDB|RDS|Route 53|Bedrock|SageMaker|VPC|EBS|EFS|SQS|SNS|KMS|WAF|GuardDuty|CloudTrail|ECS|EKS|Fargate|Athena|Redshift|Kinesis|Step Functions|API Gateway|Secrets Manager|Systems Manager|Cognito|Elastic Beanstalk|Auto Scaling|Transfer Acceleration|Global Accelerator|Direct Connect|Storage Gateway|Macie|Shield|Organizations|Control Tower|BigQuery|Cloud Storage|GKE|Compute Engine|App Engine|Cloud Run|Cloud Functions|Pub\/Sub|Cloud SQL|Spanner|Bigtable|Dataflow|Dataproc|Vertex AI|Cloud CDN|Cloud Armor|Cloud Spanner|Firestore|Looker)\b/gi

// Leading verdict boilerplate ("正确。" / "错误：" / "此选项正确。" …) carries no
// memory value — nearly every explanation in the bank starts with it, and the
// old first-sentence anchor degenerated to just "正确。".
const VERDICT_RE = /^(?:[A-E][.、:：]?\s*)?(?:[✓✗√×]\s*)?(?:此[选選]项|[该該][选選]项|[这這][个個][选選]项)?(?:是)?(?:正[确確]|[错錯][误誤]|不正[确確]|[对對]|[错錯])(?:的)?(?:答案|[选選]项|做法)?\s*[。．.:：，,！!]?\s*/

// Reasoning connectives: a sentence explaining WHY is worth anchoring.
const REASON_RE = /因[为為]|由于|由於|[通透][过過]|可以|能[够夠]|用[于於]|[适適]合|提供|支[持援]|[实實][现現]|[确確]保|避免|[满滿]足|降低|减少|減少|提高|自[动動]|无需|無需|最佳|首[选選]|[专專][为為]|[设設][计計]/

// Distil a one-liner worth remembering out of an explanation. Returns null when
// there is nothing substantive to anchor (short/boilerplate explanations) so
// the UI hides the box instead of showing junk.
export function createMemoryAnchor(question, explanation) {
  const raw = String(explanation || '').replace(/\s+/g, ' ').trim()
  if (!raw) return null
  const text = raw.replace(VERDICT_RE, '').trim()
  // A short explanation IS its own anchor — a highlight box would just repeat it.
  if (text.length < 20) return null

  const sentences = text.split(/(?<=[。！？.!?])\s*/).map(s => s.trim()).filter(s => s.length >= 8)
  if (!sentences.length) return null

  // Score: service mention +2, reasoning connective +2, comfortable length +1.
  // Earlier sentences win ties (they usually state the core point).
  let best = sentences[0], bestScore = -1
  for (const s of sentences) {
    let score = 0
    if (SERVICE_RE.test(s)) score += 2
    SERVICE_RE.lastIndex = 0
    if (REASON_RE.test(s)) score += 2
    if (s.length >= 15 && s.length <= 120) score += 1
    if (score > bestScore) { bestScore = score; best = s }
  }

  const anchor = best.length > 150 ? `${best.slice(0, 147)}…` : best
  if (anchor.length < 10) return null
  const services = [...new Set((raw.match(SERVICE_RE) || []).map(s => s.replace(/\s+/g, ' ')))].slice(0, 5)
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
