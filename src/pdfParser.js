import * as pdfjsLib from 'pdfjs-dist'

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

/**
 * Extract all text from a PDF file
 */
export async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map(item => item.str).join(' ')
    pages.push(text)
  }
  return pages.join('\n')
}

/**
 * Parse AWS exam dump text into structured questions
 * Supports: single choice, multiple choice
 */
export function parseExamDump(text, examCode = 'AWS') {
  const questions = []

  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Split into question blocks
  // Match patterns like: "Question #1", "Question 1", "第1題", "Q1.", "#1"
  const questionPattern = /(?:Question\s*#?\s*(\d+)|第\s*(\d+)\s*題|Q(\d+)[.\s]|#(\d+)[.\s])/gi
  const splits = []
  let match
  while ((match = questionPattern.exec(normalized)) !== null) {
    const id = parseInt(match[1] || match[2] || match[3] || match[4])
    splits.push({ id, index: match.index })
  }

  if (splits.length === 0) {
    return { questions: [], error: '找不到題目。請確認 PDF 格式包含 "Question #1" 或 "第1題" 等標記。' }
  }

  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].index
    const end = i + 1 < splits.length ? splits[i + 1].index : normalized.length
    const block = normalized.substring(start, end).trim()
    const qId = splits[i].id

    try {
      const parsed = parseQuestionBlock(block, qId, examCode)
      if (parsed) questions.push(parsed)
    } catch {
      // Skip unparseable questions
    }
  }

  return { questions, error: null }
}

function parseQuestionBlock(block, qId, examCode) {
  // Extract question text (between the question header and the first option)
  const optionStartPattern = /\n\s*A[.)\s]/
  const optionMatch = block.match(optionStartPattern)
  if (!optionMatch) return null

  const headerEnd = block.indexOf('\n')
  const questionText = block.substring(headerEnd + 1, optionMatch.index).trim()
  if (!questionText) return null

  // Extract options (A, B, C, D, E, F)
  const options = {}
  const optionPattern = /(?:^|\n)\s*([A-F])[.)\s]\s*([\s\S]*?)(?=(?:\n\s*[A-F][.)\s])|(?:\n\s*(?:Answer|Correct|答案|正確|Explanation|解[析釋]))|\s*$)/gi
  const optionBlock = block.substring(optionMatch.index)
  let optMatch
  while ((optMatch = optionPattern.exec(optionBlock)) !== null) {
    const letter = optMatch[1].toUpperCase()
    const text = optMatch[2].trim().replace(/\s+/g, ' ')
    if (text) options[letter] = text
  }

  if (Object.keys(options).length < 2) return null

  // Extract answer
  const answerPatterns = [
    /(?:Answer|Correct\s*Answer|答案|正確答案)\s*[:：]\s*([A-F](?:\s*[,、&]\s*[A-F])*)/i,
    /(?:Answer|Correct\s*Answer|答案|正確答案)\s*[:：]?\s*([A-F](?:\s*[,、&]\s*[A-F])*)/i,
  ]

  let answerStr = null
  for (const pattern of answerPatterns) {
    const ansMatch = block.match(pattern)
    if (ansMatch) {
      answerStr = ansMatch[1].trim()
      break
    }
  }

  if (!answerStr) return null

  // Parse answer letters
  const answerLetters = answerStr.match(/[A-F]/gi)?.map(l => l.toUpperCase()) || []
  if (answerLetters.length === 0) return null

  const isMultiple = answerLetters.length > 1

  // Extract explanation
  let explanation = ''
  const explPatterns = [
    /(?:Explanation|解[析釋]|說明)\s*[:：]\s*([\s\S]*?)$/i,
    /(?:Explanation|解[析釋]|說明)\s*[:：]?\s*([\s\S]*?)$/i,
  ]
  for (const pattern of explPatterns) {
    const explMatch = block.match(pattern)
    if (explMatch) {
      explanation = explMatch[1].trim().replace(/\s+/g, ' ')
      break
    }
  }

  // Build explanations object
  const explanations = {}
  if (explanation) {
    // Try to split by option letters
    const perOption = explanation.match(/[A-F][.)\s]/g)
    if (perOption && perOption.length >= 2) {
      // Has per-option explanations
      const parts = explanation.split(/(?=[A-F][.)\s])/)
      for (const part of parts) {
        const letterMatch = part.match(/^([A-F])[.)\s]\s*(.*)/)
        if (letterMatch) {
          explanations[letterMatch[1].toUpperCase()] = letterMatch[2].trim()
        }
      }
    } else {
      // Single explanation - assign to correct answer(s)
      for (const letter of answerLetters) {
        explanations[letter] = explanation
      }
    }
  }

  return {
    exam: examCode,
    id: qId,
    type: isMultiple ? 'multiple' : 'single',
    question: questionText.replace(/\s+/g, ' '),
    options,
    answer: isMultiple ? answerLetters : answerLetters[0],
    explanations,
  }
}
