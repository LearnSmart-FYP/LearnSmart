import { useEffect, useRef, useState } from "react"
import { AUTH_STORAGE_KEY } from "../../../../shared/constants"
import { logActivity } from "../lib/activityLog"

type QuizApiQuestion = {
  id: string
  source_exam: string
  year: number
  paper?: string | null
  question_no?: string | null
  topic?: string | null
  question_stem: string
  question_type?: string | null
  options?: unknown
  correct_answer?: string | null
  answer_explanation?: string | null
  difficulty_level?: number | null
  subject_id?: string | null
}


export type ExamQuestion = {
  id: string
  topic: string
  board: string
  year: number
  question_text: string
  marks: number
  difficulty: "easy" | "medium" | "hard"
  syllabus_code?: string
  type?: "open" | "multiple-choice"
  model_answer?: string
  choices?: string[]
  correct_answer?: number
  correct_answer_text?: string
}

export type SubmissionFeedback = {
  verdict: "correct" | "partial" | "incorrect"
  score?: number
  summary?: string
  model_answer?: string
  matched_keywords?: string[]
  reasoning?: string
}

type AiEvaluateAnswerResponse = {
  is_correct: boolean
  confidence: number
  reasoning: string
  feedback: string
}

export type KbSubject = {
  id: string
  name: string
}

type UsePracticeExamQuestionsReturn = {
  selectedTopic: string
  setSelectedTopic: (topic: string) => void
  isSearching: boolean
  isSubmitting: boolean
  allQuestions: ExamQuestion[]
  isLoadingAll: boolean
  kbSubjects: KbSubject[]
  searchResults: ExamQuestion[]
  questions: ExamQuestion[]
  currentQuestion: ExamQuestion | null
  currentQuestionIndex: number
  userAnswer: string
  setUserAnswer: (answer: string) => void
  selectedChoice: number | null
  setSelectedChoice: (index: number | null) => void
  feedback: SubmissionFeedback | null
  error: string | null
  evaluationError: string | null
  usingSampleData: boolean
  startQuestion: (question: ExamQuestion) => void
  searchQuestions: (onToast: (msg: string) => void, topicOverride?: string) => Promise<void>
  submitAnswer: (onToast: (msg: string) => void) => Promise<void>
  selectQuestion: (index: number) => void
  nextQuestion: () => void
  previousQuestion: () => void
  reset: () => void
}

function parseChoices(options: unknown): string[] {
  // Handle empty/null input
  if (!options) return []
  
  // Handle string input (JSON string from API)
  if (typeof options === "string") {
    try {
      const parsed = JSON.parse(options)
      return Array.isArray(parsed) ? parsed.map(item => String(item)) : []
    } catch {
      return []
    }
  }
  
  // Handle array input
  if (Array.isArray(options)) {
    return options
      .filter(item => item !== null && item !== undefined)
      .map(item => String(item))
  }
  
  // Handle object input (keyed choices like {A: "choice1", B: "choice2"})
  if (typeof options === "object") {
    const entries = Object.entries(options as Record<string, unknown>)
    if (entries.length === 0) return []
    
    return entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        const val = String(value)
        // If value already starts with letter+period, don't add another
        if (/^[A-Z]\./.test(val)) return val
        return `${key}. ${val}`
      })
  }
  
  return []
}

function parseCorrectAnswerIndex(correctAnswer: string | null | undefined, choices: string[]): number | undefined {
  if (!correctAnswer) return undefined

  const letterMatch = correctAnswer.trim().toUpperCase().match(/^[A-Z]$/)
  if (letterMatch) {
    const idx = letterMatch[0].charCodeAt(0) - 65
    return idx >= 0 && idx < choices.length ? idx : undefined
  }

  const numeric = Number(correctAnswer)
  if (!Number.isNaN(numeric) && numeric >= 0 && numeric < choices.length) {
    console.warn(`parseCorrectAnswerIndex: received numeric index "${correctAnswer}" instead of letter (A/B/C/D). This may indicate a data convention mismatch.`)
    return numeric
  }

  return undefined
}

function mapDifficulty(level?: number | null): "easy" | "medium" | "hard" {
  if (!level || level <= 2) return "easy"
  if (level === 3) return "medium"
  return "hard"
}

function getUserIdFromStorage(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { id?: string }
    return parsed?.id || null
  } catch {
    return null
  }
}

function mapRow(row: QuizApiQuestion, fallbackTopic = ""): ExamQuestion {
  const isMC = row.question_type === "mcq"
  const choices = isMC ? parseChoices(row.options) : []
  
  // If marked as MCQ but has no choices, treat as open-ended
  const actualType = isMC && choices.length === 0 ? "open" : isMC ? "multiple-choice" : "open"
  
  return {
    id: row.id,
    topic: fallbackTopic || row.topic || row.source_exam,
    board: row.source_exam,
    year: row.year,
    question_text: row.question_stem,
    marks: row.difficulty_level ? Math.max(1, row.difficulty_level) : 1,
    difficulty: mapDifficulty(row.difficulty_level),
    syllabus_code: [row.paper, row.question_no].filter(Boolean).join("-"),
    type: actualType,
    choices: actualType === "multiple-choice" ? choices : undefined,
    correct_answer: actualType === "multiple-choice" ? parseCorrectAnswerIndex(row.correct_answer, choices) : undefined,
    correct_answer_text: actualType === "multiple-choice" ? (row.correct_answer || undefined) : undefined,
    model_answer: actualType === "multiple-choice"
      ? (row.answer_explanation || undefined)
      : (row.correct_answer && row.correct_answer !== "N/A" ? row.correct_answer : (row.answer_explanation || undefined))
  }
}

export function usePracticeExamQuestions(): UsePracticeExamQuestionsReturn {
  const [selectedTopic, setSelectedTopic] = useState("")
  const [kbSubjects, setKbSubjects] = useState<KbSubject[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [allQuestions, setAllQuestions] = useState<ExamQuestion[]>([])
  const [isLoadingAll, setIsLoadingAll] = useState(false)
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState("")
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [searchResults, setSearchResults] = useState<ExamQuestion[]>([])
  const [feedback, setFeedback] = useState<SubmissionFeedback | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [evaluationError, setEvaluationError] = useState<string | null>(null)
  const [usingSampleData, setUsingSampleData] = useState(false)
  const isSubmittingRef = useRef(false)

  // Load knowledge base subjects for browse filter
  useEffect(() => {
    fetch("/api/subjects", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: unknown) => {
        if (Array.isArray(data)) setKbSubjects(data as KbSubject[])
      })
      .catch(() => {})
  }, [])

  // Load all questions for the browse-by-paper UI
  useEffect(() => {
    setIsLoadingAll(true)
    fetch("/api/quiz/questions?limit=200", { credentials: "include" })
      .then(r => r.ok ? r.json() : { questions: [] })
      .then((data: { questions?: QuizApiQuestion[] }) => {
        const rows = Array.isArray(data.questions) ? data.questions : []
        setAllQuestions(rows.map(r => mapRow(r)))
      })
      .catch(() => {})
      .finally(() => setIsLoadingAll(false))
  }, [])

  const currentQuestion = questions.length > 0 ? questions[currentQuestionIndex] : null

  const searchQuestions = async (onToast: (msg: string) => void, topicOverride?: string) => {
    const topic = (topicOverride ?? selectedTopic).trim()
    if (!topic) {
      onToast("Please select or enter a topic first")
      return
    }

    setIsSearching(true)
    setError(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    try {
      const url = `/api/quiz/questions?limit=100&topic=${encodeURIComponent(topic)}`
      const response = await fetch(url, { method: "GET", credentials: "include", signal: controller.signal })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to load questions" }))
        throw new Error(errorData.detail || "Failed to load questions")
      }

      const data = await response.json() as { questions?: QuizApiQuestion[] }
      const rows = Array.isArray(data.questions) ? data.questions : []
      const mapped = rows.map(row => mapRow(row, topic))

      if (mapped.length === 0) {
        setSearchResults([])
        setError(`No questions found for topic: "${topic}"`)
        onToast("No questions found for this topic")
      } else {
        setSearchResults(mapped)
        setError(null)
        setUsingSampleData(false)
        onToast(`Found ${mapped.length} question(s)`)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Search timed out — please try again')
        onToast('Search timed out — please try again')
      } else {
        const message = err instanceof Error ? err.message : "Failed to load questions"
        setSearchResults([])
        setError(message)
        setUsingSampleData(true)
        onToast(message)
      }
    } finally {
      clearTimeout(timeoutId)
      setIsSearching(false)
    }
  }

  const submitAnswer = async (onToast: (msg: string) => void) => {
    if (isSubmittingRef.current) return
    if (!currentQuestion) {
      setEvaluationError("No question to submit")
      onToast("No question to submit")
      return
    }

    const isMC = currentQuestion.type === "multiple-choice"

    if (isMC) {
      if (selectedChoice === null) {
        setEvaluationError("Please select an answer")
        onToast("Please select an answer")
        return
      }
    } else if (!userAnswer.trim()) {
      setEvaluationError("Please enter your answer")
      onToast("Please enter your answer")
      return
    }

    isSubmittingRef.current = true
    setIsSubmitting(true)
    setEvaluationError(null)

    try {
      const selectedChoiceText =
        isMC && selectedChoice !== null && currentQuestion.choices?.[selectedChoice]
          ? currentQuestion.choices[selectedChoice]
          : ""
      const submittedAnswer = isMC ? selectedChoiceText : userAnswer.trim()

      // For MCQ: Check immediately without AI
      if (isMC) {
        const isCorrect = selectedChoice === currentQuestion.correct_answer
        
        // Show feedback immediately
        setFeedback({
          verdict: isCorrect ? "correct" : "incorrect",
          score: isCorrect ? 100 : 0,
          summary: isCorrect ? "Correct!" : "Incorrect",
          model_answer: currentQuestion.model_answer,
          matched_keywords: [selectedChoiceText]
        })

        const userId = getUserIdFromStorage()

        if (!isCorrect) {
          setEvaluationError("Incorrect. Please review the correct answer above.")
          if (userId) {
            // Save to error book
            try {
              const correctAnswerText = typeof currentQuestion.correct_answer === "number" && currentQuestion.choices?.[currentQuestion.correct_answer]
                ? currentQuestion.choices[currentQuestion.correct_answer]
                : currentQuestion.model_answer || ""
              await fetch("/api/error-book/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  question_id: currentQuestion.id,
                  wrong_answer: submittedAnswer,
                  correct_answer_snapshot: correctAnswerText,
                  system_explanation: currentQuestion.model_answer || "",
                  error_category: "unknown",
                  question_text: currentQuestion.question_text,
                })
              })
              logActivity("error_review", "add", currentQuestion.id)
            } catch {
              // non-blocking
            }
          }
        }

        // Record attempt
        if (userId) {
          await fetch("/api/quiz/attempts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              user_id: userId,
              exam_question_id: currentQuestion.id,
              chosen_option: selectedChoice !== null ? String.fromCharCode(65 + selectedChoice) : null,
              is_correct: isCorrect,
              time_spent_seconds: null
            })
          })
        }

        logActivity("quiz", "attempt", currentQuestion.id, { is_correct: isCorrect, type: "mcq" })
        onToast(isCorrect ? "✓ Correct!" : "✗ Incorrect")
      } else {
        // For open-ended questions: Use AI evaluation
        const correctAnswerForAi = currentQuestion.model_answer

        const evaluationResponse = await fetch("/api/quiz/evaluate-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            question_stem: currentQuestion.question_text,
            user_answer: submittedAnswer,
            correct_answer: correctAnswerForAi,
            answer_explanation: currentQuestion.model_answer
          })
        })

        if (!evaluationResponse.ok) {
          const errorData = await evaluationResponse.json().catch(() => ({ detail: "AI evaluation failed" }))
          if (evaluationResponse.status === 503) {
            setFeedback(null)
            setEvaluationError("AI evaluation is temporarily unavailable. Your answer was NOT marked — please try again.")
            onToast("AI unavailable — answer not marked")
            return
          }
          throw new Error(errorData.detail || "AI evaluation failed")
        }

        const aiResult = await evaluationResponse.json() as AiEvaluateAnswerResponse
        const isCorrect = Boolean(aiResult.is_correct)
        setFeedback({
          verdict: isCorrect ? "correct" : "incorrect",
          score: Math.round((Number(aiResult.confidence) || 0) * 100),
          summary: aiResult.feedback || (isCorrect ? "Answer is OK." : "Answer is not correct."),
          reasoning: aiResult.reasoning,
          model_answer: currentQuestion.model_answer,
          matched_keywords: []
        })

        const userId = getUserIdFromStorage()

        if (!isCorrect) {
          setEvaluationError("AI marked this answer as NOT OK. Please review and try again.")
          if (userId) {
            // Save to error book
            try {
              await fetch("/api/error-book/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  question_id: currentQuestion.id,
                  wrong_answer: submittedAnswer,
                  correct_answer_snapshot: correctAnswerForAi || currentQuestion.model_answer || "",
                  system_explanation: currentQuestion.model_answer || "",
                  error_category: "unknown",
                  question_text: currentQuestion.question_text,
                })
              })
              logActivity("error_review", "add", currentQuestion.id)
            } catch {
              // non-blocking
            }
          }
        }

        if (userId) {
          await fetch("/api/quiz/attempts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              user_id: userId,
              exam_question_id: currentQuestion.id,
              chosen_option: userAnswer.trim(),
              is_correct: Boolean(aiResult.is_correct),
              time_spent_seconds: null
            })
          })
        }

        logActivity("quiz", "attempt", currentQuestion.id, { is_correct: Boolean(aiResult.is_correct), type: "open_ended" })
        onToast("Answer submitted")
      }

      setUserAnswer("")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error submitting answer"
      setEvaluationError(message)
      onToast(message)
      console.error("Submit error:", err)
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      setUserAnswer("")
      setSelectedChoice(null)
      setFeedback(null)
      setEvaluationError(null)
    }
  }

  const selectQuestion = (index: number) => {
    if (index < 0 || index >= questions.length) return
    setCurrentQuestionIndex(index)
    setUserAnswer("")
    setSelectedChoice(null)
    setFeedback(null)
    setEvaluationError(null)
  }

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
      setUserAnswer("")
      setSelectedChoice(null)
      setFeedback(null)
      setEvaluationError(null)
    }
  }

  const startQuestion = async (question: ExamQuestion) => {
    setUserAnswer("")
    setSelectedChoice(null)
    setFeedback(null)
    setEvaluationError(null)
    setQuestions([question])
    setCurrentQuestionIndex(0)
  }

  const reset = () => {
    setSelectedTopic("")
    setQuestions([])
    setSearchResults([])
    setCurrentQuestionIndex(0)
    setUserAnswer("")
    setSelectedChoice(null)
    setError(null)
    setFeedback(null)
    setEvaluationError(null)
    setIsSearching(false)
    setIsSubmitting(false)
  }

  return {
    selectedTopic,
    setSelectedTopic,
    isSearching,
    isSubmitting,
    allQuestions,
    isLoadingAll,
    kbSubjects,
    questions,
    currentQuestion,
    currentQuestionIndex,
    userAnswer,
    setUserAnswer,
    selectedChoice,
    setSelectedChoice,
    feedback,
    error,
    evaluationError,
    searchResults,
    usingSampleData,
    startQuestion,
    searchQuestions,
    submitAnswer,
    selectQuestion,
    nextQuestion,
    previousQuestion,
    reset
  }
}
