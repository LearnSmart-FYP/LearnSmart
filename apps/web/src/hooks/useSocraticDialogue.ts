import { useMemo, useState } from "react"
import { callAiJson, callAiText } from "../lib/aiCall"

export type SocraticDifficulty = "guided" | "standard" | "challenge"
export type SocraticAction = "follow-up" | "hint" | "feedback" | "wrap-up"

export type DialogueRole = "assistant" | "user"

export type DialogueMessage = {
  id: string
  role: DialogueRole
  text: string
  createdAt: number
  tag?: "question" | "hint" | "feedback" | "wrapup" | "system"
}

type SocraticRequestContext = {
  subjectName?: string
  documentId?: string
  documentName?: string
  documentConcepts?: string[]
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function createIntroMessage(): DialogueMessage {
  return {
    id: uid(),
    role: "assistant",
    tag: "system",
    createdAt: Date.now(),
    text:
      "Write your explanation in the chat. Each action now sends a real AI request and appends the returned tutoring response here."
  }
}

function buildPrompt(args: {
  action: SocraticAction
  concept: string
  goal: string
  context: string
  difficulty: SocraticDifficulty
  messages: DialogueMessage[]
  source?: SocraticRequestContext
}) {
  const { action, concept, goal, context, difficulty, messages, source } = args

  return [
    "You are an expert Socratic tutor.",
    `Requested action: ${action}`,
    "Return JSON only.",
    "Return an object with `assistant_message` and optional `observations`.",
    "The `assistant_message` should be the exact message shown to the learner.",
    "",
    `Concept: ${concept || "Not provided"}`,
    `Goal: ${goal || "Not provided"}`,
    `Context: ${context || "None"}`,
    `Difficulty: ${difficulty}`,
    `Subject: ${source?.subjectName || "None linked"}`,
    `Linked document id: ${source?.documentId || "None"}`,
    `Linked document name: ${source?.documentName || "None"}`,
    `Linked document concepts: ${source?.documentConcepts?.join(", ") || "None"}`,
    "",
    "Conversation so far:",
    JSON.stringify(
      messages.map((message) => ({
        role: message.role,
        tag: message.tag,
        text: message.text
      })),
      null,
      2
    )
  ].join("\n")
}

export function useSocraticDialogue() {
  const [concept, setConcept] = useState("")
  const [goal, setGoal] = useState("")
  const [context, setContext] = useState("")
  const [difficulty, setDifficulty] = useState<SocraticDifficulty>("standard")
  const [messages, setMessages] = useState<DialogueMessage[]>([createIntroMessage()])
  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const userTurns = useMemo(
    () => messages.filter((message) => message.role === "user").map((message) => message.text),
    [messages]
  )

  const getAssistantMessage = async (
    action: SocraticAction,
    source?: SocraticRequestContext,
    nextMessages?: DialogueMessage[]
  ) => {
    const payload = {
      prompt: buildPrompt({
        action,
        concept: concept.trim(),
        goal: goal.trim(),
        context: context.trim(),
        difficulty,
        messages: nextMessages ?? messages,
        source
      }),
      temperature: action === "follow-up" ? 0.4 : 0.3,
      max_tokens: action === "wrap-up" ? 1200 : 900
    }

    try {
      const data = await callAiJson<{ assistant_message?: string }>(payload)
      return data.assistant_message?.trim() || ""
    } catch {
      const text = await callAiText(payload)
      return text.trim()
    }
  }

  const send = async (onToast: (m: string) => void, source?: SocraticRequestContext) => {
    const trimmed = draft.trim()
    if (!trimmed) return

    const nextMessages = [
      ...messages,
      { id: uid(), role: "user" as const, tag: "question", createdAt: Date.now(), text: trimmed }
    ]

    setMessages(nextMessages)
    setDraft("")
    setIsLoading(true)
    try {
      const assistantMessage = await getAssistantMessage("follow-up", source, nextMessages)
      if (!assistantMessage) {
        throw new Error("AI did not return a follow-up question")
      }
      setMessages((current) => [
        ...current,
        { id: uid(), role: "assistant", tag: "question", createdAt: Date.now(), text: assistantMessage }
      ])
      onToast("Generated next Socratic turn")
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not generate the next turn")
    } finally {
      setIsLoading(false)
    }
  }

  const addHint = async (onToast: (m: string) => void, source?: SocraticRequestContext) => {
    setIsLoading(true)
    try {
      const assistantMessage = await getAssistantMessage("hint", source)
      if (!assistantMessage) {
        throw new Error("AI did not return a hint")
      }
      setMessages((current) => [
        ...current,
        { id: uid(), role: "assistant", tag: "hint", createdAt: Date.now(), text: assistantMessage }
      ])
      onToast("Hint generated")
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not generate a hint")
    } finally {
      setIsLoading(false)
    }
  }

  const addFeedback = async (onToast: (m: string) => void, source?: SocraticRequestContext) => {
    if (userTurns.length === 0) {
      onToast("Write at least one answer first")
      return
    }

    setIsLoading(true)
    try {
      const assistantMessage = await getAssistantMessage("feedback", source)
      if (!assistantMessage) {
        throw new Error("AI did not return feedback")
      }
      setMessages((current) => [
        ...current,
        { id: uid(), role: "assistant", tag: "feedback", createdAt: Date.now(), text: assistantMessage }
      ])
      onToast("Feedback generated")
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not generate feedback")
    } finally {
      setIsLoading(false)
    }
  }

  const wrapUp = async (onToast: (m: string) => void, source?: SocraticRequestContext) => {
    if (userTurns.length === 0) {
      onToast("Write at least one answer first")
      return
    }

    setIsLoading(true)
    try {
      const assistantMessage = await getAssistantMessage("wrap-up", source)
      if (!assistantMessage) {
        throw new Error("AI did not return a wrap-up")
      }
      setMessages((current) => [
        ...current,
        { id: uid(), role: "assistant", tag: "wrapup", createdAt: Date.now(), text: assistantMessage }
      ])
      onToast("Wrap-up generated")
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not generate a wrap-up")
    } finally {
      setIsLoading(false)
    }
  }

  const clear = (onToast: (m: string) => void) => {
    setMessages([createIntroMessage()])
    setDraft("")
    setIsLoading(false)
    onToast("Cleared")
  }

  return {
    concept, setConcept,
    goal, setGoal,
    context, setContext,
    difficulty, setDifficulty,
    isLoading,
    messages,
    draft, setDraft,
    send,
    addHint,
    addFeedback,
    wrapUp,
    clear
  }
}
