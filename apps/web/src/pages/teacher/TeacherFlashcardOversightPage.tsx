import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { callAiJson } from "../../lib/aiCall"
import {
  Layers, Users, Plus, Search, X, ChevronDown, ChevronUp,
  BarChart2, Brain, RefreshCw, GraduationCap, Send, CheckCircle,
  Clock, Sparkles, BookOpen
} from "lucide-react"


type ClassItem = {
  id: string
  name: string
  class_code: string
  student_count: number
}

type Deck = {
  id: string
  name?: string
  front?: string
  back?: string
  tags?: string[]
  next_review?: string | null
  status?: string
}

type StudentProgress = {
  student_id: string
  username: string
  display_name: string | null
  due_count: number
  reviewed_today: number
  mastered_count: number
  total_assigned: number
}

type AISummary = {
  overall: string
  at_risk: string[]
  recommendations: string[]
}


export function TeacherFlashcardOversightPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [selectedClassId, setSelectedClassId] = useState<string>("")

  const [myDecks, setMyDecks] = useState<Deck[]>([])
  const [decksLoading, setDecksLoading] = useState(false)
  const [deckSearch, setDeckSearch] = useState("")
  const [assigning, setAssigning] = useState<string | null>(null)

  const [progress, setProgress] = useState<StudentProgress[]>([])
  const [progressLoading, setProgressLoading] = useState(false)
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)

  const [aiSummary, setAiSummary] = useState<AISummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    async function loadClasses() {
      setClassesLoading(true)
      try {
        const res = await apiClient.get<{ classes: ClassItem[] }>("/api/classroom/teacher/classes")
        const active = (res?.classes ?? []).filter((c: any) => c.status !== "archived")
        setClasses(active)
        if (active.length > 0) setSelectedClassId(active[0].id)
      } catch {
        showToast("Failed to load classes")
      } finally {
        setClassesLoading(false)
      }
    }
    loadClasses()
  }, [])

  const loadDecks = useCallback(async () => {
    setDecksLoading(true)
    try {
      const res = await apiClient.get<{ flashcards: Deck[] }>("/api/flashcards?limit=100")
      setMyDecks(res?.flashcards ?? [])
    } catch {
      showToast("Failed to load flashcards")
    } finally {
      setDecksLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDecks()
  }, [loadDecks])

  const loadProgress = useCallback(async (classId: string) => {
    if (!classId) return
    setProgressLoading(true)
    setProgress([])
    setAiSummary(null)
    try {
      const res = await apiClient.get<{ progress: StudentProgress[] }>(
        `/api/classroom/teacher/classes/${classId}/flashcard-progress`
      ).catch(() => null)

      if (res?.progress) {
        setProgress(res.progress)
      } else {
        // Fallback: build progress from classmates list
        const classRes = await apiClient.get<{ classmates: any[] }>(`/api/classroom/${classId}`)
        const classmates = classRes?.classmates ?? []
        setProgress(classmates.map((s: any) => ({
          student_id: s.id,
          username: s.username,
          display_name: s.display_name,
          due_count: 0,
          reviewed_today: 0,
          mastered_count: 0,
          total_assigned: 0,
        })))
      }
    } catch {
      showToast("Failed to load student progress")
    } finally {
      setProgressLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedClassId) loadProgress(selectedClassId)
  }, [selectedClassId, loadProgress])

  async function handleAssignDeck(deckId: string) {
    if (!selectedClassId) { showToast("Select a class first"); return }
    setAssigning(deckId)
    try {
      await apiClient.post(`/api/classroom/teacher/classes/${selectedClassId}/assign-flashcards`, {
        flashcard_ids: [deckId],
      })
      showToast("Deck assigned to class")
    } catch {
      showToast("Failed to assign deck")
    } finally {
      setAssigning(null)
    }
  }

  async function generateAISummary() {
    if (progress.length === 0) { showToast("No progress data yet"); return }
    setSummaryLoading(true)
    try {
      const prompt = [
        "You are a teaching assistant reviewing flashcard progress data for a class.",
        "Return JSON with keys: overall (string), at_risk (array of student usernames), recommendations (array of strings).",
        "Do not include markdown fences.",
        "",
        "Student progress data:",
        JSON.stringify(
          progress.map(p => ({
            username: p.username,
            due: p.due_count,
            reviewed_today: p.reviewed_today,
            mastered: p.mastered_count,
            total_assigned: p.total_assigned,
          })),
          null, 2
        ),
      ].join("\n")

      const result = await callAiJson<AISummary>(prompt)
      setAiSummary(result)
    } catch {
      showToast("AI summary failed")
    } finally {
      setSummaryLoading(false)
    }
  }

  const filteredDecks = myDecks.filter(d =>
    (d.front ?? "").toLowerCase().includes(deckSearch.toLowerCase()) ||
    (d.tags ?? []).some(t => t.toLowerCase().includes(deckSearch.toLowerCase()))
  )

  const selectedClass = classes.find(c => c.id === selectedClassId)

  if (classesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <span className="ml-3 text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue-500" />
            Flashcard Oversight
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Assign flashcard decks to your classes and monitor student memorization progress.
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate("/flashcards/create")} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Cards
        </Button>
      </div>

      {classes.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <GraduationCap className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No active classes. Create a class first.</p>
            <Button className="mt-4" onClick={() => navigate("/classroom/classes")}>Go to Classes</Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {classes.map(cls => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                selectedClassId === cls.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400"
              }`}
            >
              {cls.name}
              <span className="ml-2 opacity-70 text-xs">{cls.student_count} students</span>
            </button>
          ))}
        </div>
      )}

      {selectedClassId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Assign Flashcards
                </h2>
                <button
                  onClick={loadDecks}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search cards..."
                  value={deckSearch}
                  onChange={e => setDeckSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
                {deckSearch && (
                  <button onClick={() => setDeckSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                )}
              </div>

              {decksLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                </div>
              ) : filteredDecks.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                  {deckSearch ? "No cards match your search." : "No flashcards yet. Create some first."}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {filteredDecks.map(deck => (
                    <div
                      key={deck.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800 dark:text-gray-200 truncate font-medium">
                          {deck.front ?? "(no front)"}
                        </p>
                        {(deck.tags ?? []).length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {deck.tags!.slice(0, 3).map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleAssignDeck(deck.id)}
                        disabled={assigning === deck.id}
                        className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
                      >
                        {assigning === deck.id ? (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        Assign
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-green-500" />
                  Student Progress
                  {selectedClass && (
                    <span className="text-xs font-normal text-gray-400 dark:text-gray-500">— {selectedClass.name}</span>
                  )}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadProgress(selectedClassId)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={generateAISummary}
                    disabled={summaryLoading || progress.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {summaryLoading ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    AI Summary
                  </button>
                </div>
              </div>

              {progressLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
                </div>
              ) : progress.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                  No students enrolled yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {progress.map(s => {
                    const masteryPct = s.total_assigned > 0
                      ? Math.round((s.mastered_count / s.total_assigned) * 100)
                      : 0
                    const isExpanded = expandedStudent === s.student_id
                    const isAtRisk = aiSummary?.at_risk.includes(s.username)

                    return (
                      <div
                        key={s.student_id}
                        className={`rounded-lg border transition-colors ${
                          isAtRisk
                            ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
                            : "border-gray-100 dark:border-gray-800"
                        }`}
                      >
                        <button
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                          onClick={() => setExpandedStudent(isExpanded ? null : s.student_id)}
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(s.display_name ?? s.username).charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                {s.display_name ?? s.username}
                              </span>
                              {isAtRisk && (
                                <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-medium">
                                  At risk
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-green-500 transition-all"
                                  style={{ width: `${masteryPct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">
                                {masteryPct}%
                              </span>
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 grid grid-cols-3 gap-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2 text-center">
                              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{s.due_count}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Due</p>
                            </div>
                            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-2 text-center">
                              <p className="text-lg font-bold text-green-600 dark:text-green-400">{s.reviewed_today}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Today</p>
                            </div>
                            <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 p-2 text-center">
                              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{s.mastered_count}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Mastered</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {aiSummary && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">AI Class Summary</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{aiSummary.overall}</p>
                {aiSummary.at_risk.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Students needing attention:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {aiSummary.at_risk.map(u => (
                        <span key={u} className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          {u}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {aiSummary.recommendations.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Recommendations:</p>
                    <ul className="space-y-1">
                      {aiSummary.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                          <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
