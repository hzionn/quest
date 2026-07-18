// AWS + GCP service names, used both to surface service chips and to score
// sentences when picking the anchor.
const SERVICE_RE = /\b(?:AWS|Amazon|Aurora|S3|EC2|Lambda|IAM|CloudWatch|CloudFront|DynamoDB|RDS|Route 53|Bedrock|SageMaker|VPC|EBS|EFS|SQS|SNS|KMS|WAF|GuardDuty|CloudTrail|ECS|EKS|Fargate|Athena|Redshift|Kinesis|Step Functions|API Gateway|Secrets Manager|Systems Manager|Cognito|Elastic Beanstalk|Auto Scaling|Transfer Acceleration|Global Accelerator|Direct Connect|Storage Gateway|Macie|Shield|Organizations|Control Tower|BigQuery|Cloud Storage|GKE|Compute Engine|App Engine|Cloud Run|Cloud Functions|Pub\/Sub|Cloud SQL|Spanner|Bigtable|Dataflow|Dataproc|Vertex AI|Cloud CDN|Cloud Armor|Cloud Spanner|Firestore|Looker)\b/gi

// Leading verdict boilerplate ("正确。" / "错误：" / "此选项正确。" …) carries no
// memory value — nearly every explanation in the bank starts with it, and the
// old first-sentence anchor degenerated to just "正确。".
const VERDICT_RE = /^(?:[A-E][.、:：]?\s*)?(?:[✓✗√×]\s*)?(?:此[选選]项|[该該][选選]项|[这這][个個][选選]项)?(?:是)?(?:正[确確]|[错錯][误誤]|不正[确確]|[对對]|[错錯])(?:的)?(?:答案|[选選]项|做法)?\s*[。．.:：，,！!]?\s*/

// Outcome words: a clause stating the EFFECT ("解决连通性问题") is the judgment
// worth remembering.
const BENEFIT_RE = /解[决決]|[满滿]足|加[速快]|[扩擴]展|提[高升]|降低|[减減]少|避免|[确確]保|保持|[实實][现現]|[优優]化|支[持援]|无需|無需|不需|安全(?![组組])|成本|效能|性能|可用性|延[迟遲]|容[错錯]|高可用|最佳|定位|排查|[诊診][断斷]|判[断斷]/
// Leading connectives to trim off the benefit clause（既/又/即可/從而…）.
const CONNECTIVE_RE = /^(?:既|又|且|并且|並且|同[时時]|即可|[从從]而|因此|所以|[这這][样樣]|可以|能[够夠]|[进進]而)/

// Distil a SHORT "action → effect" takeaway out of an explanation — a judgment
// plus keywords, NOT a copy of the explanation shown right below it. Returns
// null whenever the anchor wouldn't be meaningfully shorter than the
// explanation itself (short explanations are their own anchor).
//
// Curated anchors win: when the question data carries a hand-authored
// `anchor` field (SOA-C02/C03 to start), use it verbatim — clause heuristics
// can't tell which term is the actual exam point (e.g. they'd keep
// 「是最安全的方法」 but drop GenerateSecretString/RotationSchedule).
// The heuristic below remains the fallback for banks without curated anchors.
export function createMemoryAnchor(question, explanation) {
  const raw = String(explanation || '').replace(/\s+/g, ' ').trim()
  const curated = typeof question?.anchor === 'string' ? question.anchor.trim() : ''
  if (curated) {
    const services = [...new Set(((curated + ' ' + raw).match(SERVICE_RE) || []).map(s => s.replace(/\s+/g, ' ')))].slice(0, 5)
    return { anchor: curated, services, exam: question?.exam || '' }
  }
  if (!raw) return null
  const text = raw.replace(VERDICT_RE, '').trim()
  // Short explanations read in one glance — an anchor box would just repeat them.
  if (text.length < 50) return null

  // Clause polish: balanced parentheticals go, then any unbalanced tail/head
  // left by clause-splitting, leading emoji/tick symbols, and a trailing
  // mid-text verdict（「X 正确」的格式）.
  const polish = (c) => c
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[（(][^）)]*$/, '')
    .replace(/^[^（(]*[）)]/, '')
    .replace(/^(?:[\u2705\u274C\u2714\u2733\u2611\u2713\u2717\u221A\u00D7\u2022\u00B7\-\s]|\uFE0F)+/, '')
    .replace(/(?:正[确確]|[错錯][误誤])[:：]?$/, '')
    .trim()

  // Colons separate clauses too（「服務：說明」的格式很常見）.
  const clauses = text.split(/[，、；。！？:：,;.!?]\s*/).map(c => polish(c)).filter(c => c.length >= 4)
  if (!clauses.length) return null

  // Action = the first clause naming a service (else the first clause).
  let actionIdx = clauses.findIndex(c => { const hit = SERVICE_RE.test(c); SERVICE_RE.lastIndex = 0; return hit })
  if (actionIdx < 0) actionIdx = 0
  let action = clauses[actionIdx]
  if (action.length > 40) action = `${action.slice(0, 38)}…`

  // Effect = the SHORTEST later clause stating an outcome (short effects are
  // punchier anchors), trimmed of connectives.
  let benefit = ''
  for (const c of clauses.slice(actionIdx + 1)) {
    if (!BENEFIT_RE.test(c)) continue
    const cand = c.replace(CONNECTIVE_RE, '').trim()
    if (!benefit || cand.length < benefit.length) benefit = cand
  }
  if (benefit.length > 24) benefit = `${benefit.slice(0, 22)}…`

  // Prefer action → effect; when that isn't a real compression of a compact
  // explanation, fall back to the action alone before giving up.
  let anchor = benefit ? `${action} → ${benefit}` : action
  if (anchor.length >= text.length * 0.7) anchor = action
  if (anchor.length < 10 || anchor.length >= text.length * 0.7) return null
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
