import { useMemo, useState } from "react"
import { callAiJson } from "../lib/aiCall"

export type RewriteLanguage = "auto" | "english" | "chinese"
export type RewriteLevel = "light" | "standard" | "strong"

export type RewriteResult = {
  original: string
  simplified: string
  language: "english" | "chinese"
  level: RewriteLevel
}

type SimplifyRequestContext = {
  subjectName?: string
  documentId?: string
  documentName?: string
  documentConcepts?: string[]
}

type UseSimplifyPassageReturn = {
  passage: string
  setPassage: (value: string) => void
  language: RewriteLanguage
  setLanguage: (value: RewriteLanguage) => void
  level: RewriteLevel
  setLevel: (value: RewriteLevel) => void
  isLoading: boolean
  result: RewriteResult | null
  showResults: boolean
  setShowResults: (value: boolean) => void
  rewrite: (onToast: (msg: string) => void, context?: SimplifyRequestContext) => Promise<void>
  reset: () => void
  copy: (which: "original" | "simplified" | "both", onToast: (msg: string) => void) => Promise<void>
}

function normalizeText(s: string) {
  return s.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim()
}

function detectLanguage(text: string): "english" | "chinese" {
  return /[\u4e00-\u9fff]/.test(text) ? "chinese" : "english"
}

function buildPrompt(args: {
  original: string
  language: "english" | "chinese"
  level: RewriteLevel
  context?: SimplifyRequestContext
}) {
  const { original, language, level, context } = args

  return [
    "You are an expert editor who simplifies passages without losing meaning.",
    "Return JSON with: `original`, `simplified`, `language`, and `level`.",
    "Do not include markdown fences.",
    "",
    `Target language: ${language}`,
    `Simplification level: ${level}`,
    `Subject: ${context?.subjectName || "None linked"}`,
    `Linked document id: ${context?.documentId || "None"}`,
    `Linked document name: ${context?.documentName || "None"}`,
    `Linked document concepts: ${context?.documentConcepts?.join(", ") || "None"}`,
    "",
    "Passage to simplify:",
    original
  ].join("\n")
}

export function useSimplifyPassage(): UseSimplifyPassageReturn {
  const [passage, setPassage] = useState("")
  const [language, setLanguage] = useState<RewriteLanguage>("auto")
  const [level, setLevel] = useState<RewriteLevel>("standard")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<RewriteResult | null>(null)
  const [showResults, setShowResults] = useState(false)

  const resolvedLanguage = useMemo(() => {
    const cleaned = normalizeText(passage)
    if (!cleaned) return "english" as const
    if (language === "auto") return detectLanguage(cleaned)
    return language
  }, [passage, language])

  const rewrite = async (onToast: (msg: string) => void, context?: SimplifyRequestContext) => {
    const original = normalizeText(passage)
    if (!original) {
      onToast("Please paste a passage first")
      return
    }

    setIsLoading(true)
    try {
      const prompt = buildPrompt({
        original,
        language: resolvedLanguage,
        level,
        context
      })

      const data = await callAiJson<Partial<RewriteResult>>({
        prompt,
        temperature: 0.2,
        max_tokens: 900
      })
      const simplified = data.simplified?.trim()
      if (!simplified) {
        throw new Error("AI did not return a simplified passage")
      }

      setResult({
        original: data.original?.trim() || original,
        simplified,
        language: data.language === "chinese" ? "chinese" : resolvedLanguage,
        level: data.level === "light" || data.level === "strong" ? data.level : level
      })
      setShowResults(true)
      onToast("Simplified version generated")
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not simplify the passage")
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    setPassage("")
    setLanguage("auto")
    setLevel("standard")
    setResult(null)
    setShowResults(false)
  }

  const copy = async (which: "original" | "simplified" | "both", onToast: (msg: string) => void) => {
    if (!result) return
    const payload =
      which === "original"
        ? result.original
        : which === "simplified"
          ? result.simplified
          : `Original:\n${result.original}\n\nSimplified:\n${result.simplified}`

    await navigator.clipboard.writeText(payload)
    onToast(which === "both" ? "Copied original and simplified text" : `Copied ${which}`)
  }

  return {
    passage,
    setPassage,
    language,
    setLanguage,
    level,
    setLevel,
    isLoading,
    result,
    showResults,
    setShowResults,
    rewrite,
    reset,
    copy
  }
}
