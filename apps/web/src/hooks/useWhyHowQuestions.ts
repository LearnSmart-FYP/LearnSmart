import { useMemo, useState } from "react"
import { callAiJson } from "../lib/aiCall"

export type QuestionType = "why" | "how"
export type Difficulty = "easy" | "medium" | "hard"

export type GeneratedQuestion = {
  id: string
  type: QuestionType
  difficulty: Difficulty
  question: string
  rationale: string
  focus?: string
}

type WhyHowRequestContext = {
  subjectName?: string
  documentId?: string
  documentName?: string
  documentConcepts?: string[]
}

type UseWhyHowQuestionsReturn = {
  sourceText: string
  setSourceText: (v: string) => void
  focusConcept: string
  setFocusConcept: (v: string) => void
  detectedKeywords: string[]
  difficulty: Difficulty
  setDifficulty: (v: Difficulty) => void
  count: number
  setCount: (v: number) => void
  includeWhy: boolean
  setIncludeWhy: (v: boolean) => void
  includeHow: boolean
  setIncludeHow: (v: boolean) => void
  isLoading: boolean
  questions: GeneratedQuestion[]
  showResults: boolean
  setShowResults: (v: boolean) => void
  generate: (onToast: (msg: string) => void, context?: WhyHowRequestContext) => Promise<void>
  reset: () => void
  copyAll: (onToast: (msg: string) => void) => Promise<void>
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function normalizeText(s: string) {
  return s.replace(/\s+/g, " ").trim()
}

function pickKeywords(text: string) {
  const t = normalizeText(text)

  const hasSpaces = /\s/.test(t)
  if (!hasSpaces) {
    const chunk = t.slice(0, 24)
    return chunk ? [chunk] : []
  }

  const stop = new Set([
    "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with", "as", "is", "are", "was", "were",
    "be", "been", "being", "this", "that", "these", "those", "it", "its", "they", "their", "we", "you", "i",
    "from", "by", "at", "into", "over", "under", "than", "then", "because", "therefore", "thus", "so"
  ])

  const words = t
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !stop.has(word))

  const freq = new Map<string, number>()
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1)
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 5)
}

function buildPrompt(args: {
  sourceText: string
  focusConcept: string
  difficulty: Difficulty
  count: number
  includeWhy: boolean
  includeHow: boolean
  keywords: string[]
  context?: WhyHowRequestContext
}) {
  const {
    sourceText,
    focusConcept,
    difficulty,
    count,
    includeWhy,
    includeHow,
    keywords,
    context
  } = args

  return [
    "You are an expert comprehension coach.",
    "Generate a JSON object with a `questions` array.",
    "Each item must contain: `type`, `difficulty`, `question`, `rationale`, and optional `focus`.",
    "Do not include markdown fences.",
    "",
    `Difficulty: ${difficulty}`,
    `Question count: ${count}`,
    `Include why questions: ${includeWhy ? "yes" : "no"}`,
    `Include how questions: ${includeHow ? "yes" : "no"}`,
    `Focus concept: ${focusConcept || "Infer from the source"}`,
    `Detected keywords: ${keywords.join(", ") || "None"}`,
    `Subject: ${context?.subjectName || "None linked"}`,
    `Linked document id: ${context?.documentId || "None"}`,
    `Linked document name: ${context?.documentName || "None"}`,
    `Linked document concepts: ${context?.documentConcepts?.join(", ") || "None"}`,
    "",
    "Source text:",
    sourceText
  ].join("\n")
}

export function useWhyHowQuestions(): UseWhyHowQuestionsReturn {
  const [sourceText, setSourceText] = useState("")
  const [focusConcept, setFocusConcept] = useState("")
  const [difficulty, setDifficulty] = useState<Difficulty>("medium")
  const [count, setCount] = useState(6)
  const [includeWhy, setIncludeWhy] = useState(true)
  const [includeHow, setIncludeHow] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([])
  const [showResults, setShowResults] = useState(false)

  const keywords = useMemo(() => pickKeywords(sourceText), [sourceText])

  const generate = async (onToast: (msg: string) => void, context?: WhyHowRequestContext) => {
    const text = normalizeText(sourceText)
    if (!text) {
      onToast("Paste some source content first")
      return
    }
    if (!includeWhy && !includeHow) {
      onToast("Select at least one question type")
      return
    }

    setIsLoading(true)
    try {
      const prompt = buildPrompt({
        sourceText: text,
        focusConcept: focusConcept.trim(),
        difficulty,
        count: clamp(Number(count) || 6, 1, 20),
        includeWhy,
        includeHow,
        keywords,
        context
      })

      const data = await callAiJson<{ questions?: Array<Partial<GeneratedQuestion>> }>({
        prompt,
        temperature: 0.4,
        max_tokens: 1200
      })
      const normalized = (data.questions ?? [])
        .filter((item) => item.question && item.type)
        .slice(0, clamp(Number(count) || 6, 1, 20))
        .map((item, index) => ({
          id: `${item.type || "question"}-${index}-${Date.now()}`,
          type: item.type === "how" ? "how" : "why",
          difficulty: item.difficulty === "easy" || item.difficulty === "hard" ? item.difficulty : difficulty,
          question: item.question?.trim() || "",
          rationale: item.rationale?.trim() || "",
          focus: item.focus?.trim() || undefined
        }))

      if (!normalized.length) {
        throw new Error("AI did not return any questions")
      }

      setQuestions(normalized)
      setShowResults(true)
      onToast(`Generated ${normalized.length} question(s)`)
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not generate questions")
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    setSourceText("")
    setFocusConcept("")
    setDifficulty("medium")
    setCount(6)
    setIncludeWhy(true)
    setIncludeHow(true)
    setQuestions([])
    setShowResults(false)
  }

  const copyAll = async (onToast: (msg: string) => void) => {
    if (!questions.length) return
    await navigator.clipboard.writeText(
      questions
        .map((question, index) => `${index + 1}. ${question.question}\n${question.rationale}`.trim())
        .join("\n\n")
    )
    onToast("Copied questions")
  }

  return {
    sourceText,
    setSourceText,
    focusConcept,
    setFocusConcept,
    detectedKeywords: keywords,
    difficulty,
    setDifficulty,
    count,
    setCount,
    includeWhy,
    setIncludeWhy,
    includeHow,
    setIncludeHow,
    isLoading,
    questions,
    showResults,
    setShowResults,
    generate,
    reset,
    copyAll
  }
}
