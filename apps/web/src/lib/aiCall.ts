import { apiClient } from "./api"

export type AiCallPayload = {
  prompt: string
  temperature?: number
  max_tokens?: number
  provider?: string
  model_key?: string
}

type AiCallResponse = {
  id?: string
  response: string
}

const JSON_BLOCK = /\{[\s\S]*\}|\[[\s\S]*\]/

function normalizeAiErrorMessage(message: string) {
  const trimmed = message.trim()
  if (!trimmed) return "AI request failed"

  if (/insufficient balance/i.test(trimmed)) {
    return "AI request failed because the configured provider returned 402 Insufficient Balance."
  }

  if (/all ai providers failed/i.test(trimmed)) {
    const withoutNoise = trimmed
      .replace(/;?\s*'str' object has no attribute 'model_dump'/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim()

    return withoutNoise || "AI request failed because every configured provider returned an error."
  }

  return trimmed
}

function stripCodeFence(text: string) {
  const trimmed = text.trim()
  if (!trimmed.startsWith("```")) return trimmed

  const lines = trimmed.split("\n")
  if (lines.length >= 3) {
    return lines.slice(1, -1).join("\n").trim()
  }

  return trimmed.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim()
}

export function extractJsonFromText<T>(raw: string): T {
  const cleaned = stripCodeFence(raw)

  try {
    return JSON.parse(cleaned) as T
  } catch {
    const match = cleaned.match(JSON_BLOCK)
    if (!match) {
      throw new Error("AI response was not valid JSON")
    }
    return JSON.parse(match[0]) as T
  }
}

export async function callAiText(payload: AiCallPayload): Promise<string> {
  try {
    const response = await apiClient.post<AiCallResponse>("/api/ai/call", payload)
    return response?.response?.trim() || ""
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(normalizeAiErrorMessage(message))
  }
}

export async function callAiJson<T>(payload: AiCallPayload): Promise<T> {
  const text = await callAiText(payload)
  return extractJsonFromText<T>(text)
}
