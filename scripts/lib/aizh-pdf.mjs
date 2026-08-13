// Shared reading helpers for the "中文AI解析版" question dumps (the AIF-C01 and
// AZ-305 sources are the same publisher and the same layout).
//
// Each section is one ExamTopics question: English stem, Chinese translation,
// the lettered options in both languages, then a Chinese coaching write-up that
// analyses every option and restates the official answer.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFileSync } from 'node:fs'

// The text layer encodes many Han characters as Kangxi radicals (U+2F00…) rather
// than unified ideographs, so `目` arrives as `⽬` and any regex over the Chinese
// text silently misses. Fold only those ranges — folding everything would also
// flatten the full-width punctuation the banks use.
export const foldLookalikes = (text) => text.replace(/[⺀-⿿豈-﫿]/gu, ch => ch.normalize('NFKC'))

export async function extractPages(path) {
  const data = new Uint8Array(readFileSync(path))
  const pdf = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent()
    let text = ''
    for (const item of content.items) {
      if (item.str !== undefined) text += item.str
      if (item.hasEOL) text += '\n'
    }
    pages.push(foldLookalikes(text))
  }
  return pages
}

// The page furniture is scrubbed inline rather than by dropping whole lines,
// because the text layer regularly merges the last line of real content with the
// watermark beside it ("⼀次或不选择。淘宝/闲鱼: IT认证轻松过，微信: Examtopics").
// Dropping that line would silently swallow the end of a stem. Read the answer
// key off the raw block before calling this.
const INLINE_NOISE = [
  /\s*淘宝\/?闲鱼\s*[:：]\s*IT认证轻松过\s*[，,]?\s*微信\s*[:：]\s*Examt(?:opics)?/g,
  /\s*淘宝\/?闲鱼\s*[:：]\s*IT认证轻松过/g,
  /\s*微信\s*[:：]\s*Examt(?:opics)?/g,
  /\s*IT认证轻松过/g,
  /\s*Most Voted/g,
  /\s*Community vote distribution/gi,
  /\s*社区投票分[布发]/g,
  /\s*Correct Answer\s*[:：]\s*[A-F]*/g,
  /\s*正确答案\s*[:：]\s*[A-F]*/g,
  /\s*🗳/g,
]
export const scrub = (line) => INLINE_NOISE.reduce((text, re) => text.replace(re, ' '), line)

// What is left over once the furniture is scrubbed: standalone fragments of the
// watermark, the vote histogram, and the cover page.
const NOISE = [
  /^opics$/,
  /^Examtopics$/,
  /^(?:淘宝|咸鱼|闲鱼|微信)$/,
  /^社区投票分[布发]$/,
  /^Community vote distribution$/i,
  /^(?:[A-F]{1,3}\s*\(\d+%\)\s*\(?\s*)+$/,
  /^扫码关注.*$/,
  /^中文AI解析版$/,
  /^下载时间.*$/,
  /^使用指南$/,
]
export const isNoise = (line) => NOISE.some(re => re.test(line.trim()))

// Turn a raw section into the lines the parsers work on: furniture scrubbed
// inline first, then whatever is left that is empty or pure noise dropped.
export const cleanLines = (block) => block.split('\n')
  .map(line => scrub(line).replace(/\s+$/, ''))
  .filter(line => line.trim() && !isNoise(line))

// Collapse the spacing the text layer sprinkles between runs *within* one line,
// then close up the gaps it leaves inside CJK text and around full-width
// punctuation.
export function tidy(text) {
  return text
    .replace(/[ \t ]+/g, ' ')
    .replace(/(?<=[㐀-鿿])\s+(?=[㐀-鿿])/gu, '')
    .replace(/\s+(?=[，。、？！：；）』」》%])/gu, '')
    .replace(/(?<=[（『「《])\s+/gu, '')
    .trim()
}

// Line breaks in the source are real separators — one sentence ends and the next
// begins — so each line is tidied on its own and then joined with a space.
// Tidying the joined string instead would swallow the boundary between two Han
// characters and run "自动扩展推理端点" straight into "此选项与…".
export const joinLines = (lines) => lines.map(tidy).filter(Boolean).join(' ').trim()

export const hasHan = (line) => /[㐀-鿿]/u.test(line)

// Split a stem into its English half and its Chinese half. The source always
// puts the English first, so the first Han-bearing line is the seam.
export function splitLangs(lines) {
  const seam = lines.findIndex(hasHan)
  if (seam === -1) return { en: joinLines(lines), zh: '' }
  return {
    en: joinLines(lines.slice(0, seam)),
    zh: joinLines(lines.slice(seam)),
  }
}

export const OPTION_LINE = /^([A-F])[.、:：]\s*(.*)$/

// The coaching write-up opens with one of a handful of labels — sometimes the
// "题目解析/题目分析" banner, sometimes a bare or numbered "考察的知识点", and in
// a few sections just "知识点". Any numbered Chinese section heading also marks
// the boundary, since nothing in a stem or option is numbered that way.
const ANALYSIS_HEAD = [
  // A few sections title the banner rather than just opening it
  // ("AZ-305 考试辅导：题目解析"), so allow a short prefix before the label.
  /^(?:[^：:]{0,24}[：:]\s*)?题目(?:解析|分析)/,
  /^知识点(?:分析)?$/,
  /^(?:\d+\s*[.)、]\s*)?(?:本题|这题)?考察(?:的)?知识点/,
  /^\d+\s*[.)、]\s*[㐀-鿿]/u,
]
export const isAnalysisHead = (line) => ANALYSIS_HEAD.some(re => re.test(line))

// Where the per-option analysis stops and the answer recap begins. Anchored to
// the whole line: several write-ups open a paragraph with "官方答案可能不正确…",
// and a prefix match there would truncate the analysis. `结论` is deliberately
// absent — it appears *inside* each option's analysis.
export const ANALYSIS_END = /^(?:\d+\s*[.)、]\s*)?(?:推荐答案|建议答案|官方答案|我的答案|我选的答案|我选择的答案|我的选择|最终答案|比较与验证|比较与分析|与官方答案.{0,6}(?:比较|一致)|复盘)\s*[:：]?\s*$/
const SECTION_HEAD = /^\d+\s*[.、]\s*/

// The write-up analyses each option under a heading that repeats the option text
// ("B. Partial dependence plots (PDPs)(部分依赖图)"). Capture the body under each
// heading, stopping at the next option or the next numbered section.
// Inside the write-up an option heading may carry a "选项" prefix
// ("选项 A: Yes"), which the plain option-line form would miss.
const ANALYSIS_OPTION_LINE = /^(?:选项|選項)?\s*([A-F])\s*[.、:：]\s*(.*)$/

export function parseAnalysis(lines) {
  const found = new Map()
  let current = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (ANALYSIS_END.test(line)) break
    const option = line.match(ANALYSIS_OPTION_LINE)
    if (option && /^[A-F]$/.test(option[1])) {
      current = option[1]
      if (!found.has(current)) found.set(current, [])
      // The heading restates the option before the analysis, either on the same
      // line ("A. Nova Lite: Nova Lite 通常是…") or on its own. Keep whatever
      // followed the letter; only the letter prefix itself is dropped.
      if (option[2]) found.get(current).push(option[2])
      continue
    }
    if (SECTION_HEAD.test(line)) { current = null; continue }
    if (current) found.get(current).push(line)
  }
  const out = {}
  for (const [letter, body] of found) {
    const text = joinLines(body)
    if (text) out[letter] = text
  }
  return out
}

// How many answers a stem asks for, or null when it does not say. Covers both
// the AWS phrasing ("(Choose two.)") and the Microsoft one ("Which two actions…",
// "Each correct answer presents part of the solution").
export function answersWanted(text) {
  if (typeof text !== 'string') return null
  const words = { two: 2, three: 3, four: 4, five: 5 }
  const en = text.match(/\(?\s*(?:choose|select|pick)\s+(two|three|four|five|2|3|4|5)\s*\.?\s*\)?/i)
  if (en) return words[en[1].toLowerCase()] ?? Number(en[1])
  const ms = text.match(/\bwhich\s+(two|three|four|five)\b/i)
  if (ms) return words[ms[1].toLowerCase()]
  const zh = text.match(/[选選]\s*[择擇]?\s*(两|兩|二|三|四|五|2|3|4|5)\s*[个個]/)
  if (zh) return words[zh[1]] ?? { 两: 2, 兩: 2, 二: 2, 三: 3, 四: 4, 五: 5 }[zh[1]] ?? Number(zh[1])
  const zhWhich = text.match(/哪\s*(两|兩|三|四)\s*[个個项項種种]/)
  if (zhWhich) return { 两: 2, 兩: 2, 三: 3, 四: 4 }[zhWhich[1]]
  return null
}
