import { useMemo, useState } from "react"
import { callAiJson } from "../lib/aiCall"

export type OutputStyle = "analogy" | "metaphor" | "both"
export type AudienceLevel = "beginner" | "intermediate" | "advanced"
export type OutputLanguage = "auto" | "english" | "chinese"

export type AnalogyDomain =
  | "everyday"
  | "cooking"
  | "sports"
  | "travel"
  | "music"
  | "nature"
  | "tech"
  | "money"

type AnalogyRequestContext = {
  subjectName?: string
  documentId?: string
  documentName?: string
  documentConcepts?: string[]
}

export type MappingPair = { left: string; right: string }

export type AnalogyResult = {
  id: string
  kind: "analogy" | "metaphor"
  domain: AnalogyDomain
  title: string
  text: string
  mapping: MappingPair[]
  notes: string[]
  language: "english" | "chinese"
  audience: AudienceLevel
}

type UseAnalogiesReturn = {
  concept: string
  setConcept: (v: string) => void
  context: string
  setContext: (v: string) => void
  domain: AnalogyDomain
  setDomain: (v: AnalogyDomain) => void
  audience: AudienceLevel
  setAudience: (v: AudienceLevel) => void
  style: OutputStyle
  setStyle: (v: OutputStyle) => void
  language: OutputLanguage
  setLanguage: (v: OutputLanguage) => void
  isLoading: boolean
  results: AnalogyResult[]
  showResults: boolean
  setShowResults: (v: boolean) => void
  generate: (onToast: (m: string) => void, source?: AnalogyRequestContext) => Promise<void>
  reset: () => void
  copy: (id: string, onToast: (m: string) => void) => Promise<void>
  copyAll: (onToast: (m: string) => void) => Promise<void>
}

function detectLanguage(text: string): "english" | "chinese" {
  return /[\u4e00-\u9fff]/.test(text) ? "chinese" : "english"
}

function buildPrompt(args: {
  concept: string
  context: string
  domain: AnalogyDomain
  audience: AudienceLevel
  style: OutputStyle
  language: "english" | "chinese"
  source?: AnalogyRequestContext
}) {
  const { concept, context, domain, audience, style, language, source } = args

  return [
    "You are an expert teacher who explains hard ideas with analogies and metaphors.",
    "Return JSON with a `results` array.",
    "Each result must include: `kind`, `title`, `text`, `mapping`, `notes`, `language`, and `audience`.",
    "Do not include markdown fences.",
    "",
    `Concept: ${concept}`,
    `Use case context: ${context || "None provided"}`,
    `Domain to draw from: ${domain}`,
    `Audience level: ${audience}`,
    `Requested output style: ${style}`,
    `Output language: ${language}`,
    `Subject: ${source?.subjectName || "None linked"}`,
    `Linked document id: ${source?.documentId || "None"}`,
    `Linked document name: ${source?.documentName || "None"}`,
    `Linked document concepts: ${source?.documentConcepts?.join(", ") || "None"}`
  ].join("\n")
}

export function useAnalogiesMetaphors(): UseAnalogiesReturn {
  const [concept, setConcept] = useState("")
  const [context, setContext] = useState("")
  const [domain, setDomain] = useState<AnalogyDomain>("everyday")
  const [audience, setAudience] = useState<AudienceLevel>("beginner")
  const [style, setStyle] = useState<OutputStyle>("both")
  const [language, setLanguage] = useState<OutputLanguage>("auto")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<AnalogyResult[]>([])
  const [showResults, setShowResults] = useState(false)

  const resolvedLanguage = useMemo(() => {
    const combined = `${concept}\n${context}`.trim()
    if (!combined) return "english" as const
    if (language === "auto") return detectLanguage(combined)
    return language
  }, [concept, context, language])

  const generate = async (onToast: (m: string) => void, source?: AnalogyRequestContext) => {
    const trimmedConcept = concept.trim()
    if (!trimmedConcept) {
      onToast("Enter a concept first")
      return
    }

    setIsLoading(true)
    try {
      const data = await callAiJson<{ results?: Array<Partial<AnalogyResult>> }>({
        prompt: buildPrompt({
          concept: trimmedConcept,
          context: context.trim(),
          domain,
          audience,
          style,
          language: resolvedLanguage,
          source
        }),
        temperature: 0.6,
        max_tokens: 1400
      })
      const normalized = (data.results ?? [])
        .filter((item) => item.title && item.text)
        .map((item, index) => ({
          id: item.id || `${item.kind || "analogy"}-${index}-${Date.now()}`,
          kind: item.kind === "metaphor" ? "metaphor" : "analogy",
          domain,
          title: item.title?.trim() || "",
          text: item.text?.trim() || "",
          mapping: Array.isArray(item.mapping)
            ? item.mapping
                .filter((pair): pair is MappingPair => Boolean(pair?.left && pair?.right))
                .map((pair) => ({ left: pair.left, right: pair.right }))
            : [],
          notes: Array.isArray(item.notes) ? item.notes.filter(Boolean).map((note) => String(note)) : [],
          language: item.language === "chinese" ? "chinese" : resolvedLanguage,
          audience: item.audience === "advanced" || item.audience === "intermediate" ? item.audience : audience
        }))

      if (!normalized.length) {
        throw new Error("AI did not return any analogies or metaphors")
      }

      setResults(normalized)
      setShowResults(true)
      onToast("Generated analogies and metaphors")
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not generate analogies")
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    setConcept("")
    setContext("")
    setDomain("everyday")
    setAudience("beginner")
    setStyle("both")
    setLanguage("auto")
    setResults([])
    setShowResults(false)
  }

  const copy = async (id: string, onToast: (m: string) => void) => {
    const item = results.find((result) => result.id === id)
    if (!item) return
    await navigator.clipboard.writeText(
      [
        item.title,
        "",
        item.text,
        "",
        ...item.mapping.map((pair) => `${pair.left} ↔ ${pair.right}`),
        "",
        ...item.notes
      ].join("\n")
    )
    onToast("Copied result")
  }

  const copyAll = async (onToast: (m: string) => void) => {
    if (!results.length) return
    await navigator.clipboard.writeText(
      results
        .map((item) => [item.title, item.text, ...item.notes].join("\n"))
        .join("\n\n")
    )
    onToast("Copied all results")
  }

  return {
    concept,
    setConcept,
    context,
    setContext,
    domain,
    setDomain,
    audience,
    setAudience,
    style,
    setStyle,
    language,
    setLanguage,
    isLoading,
    results,
    showResults,
    setShowResults,
    generate,
    reset,
    copy,
    copyAll
  }
}
