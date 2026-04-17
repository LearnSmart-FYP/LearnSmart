import { useEffect, useState, useCallback } from "react"
import { Card } from "../../components/ui/Card"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { BarChart2, RefreshCw, ChevronDown, ChevronUp, Users } from "lucide-react"

type Assignment = {
  card_id: string
  deck_name: string
  class_id: string
  class_name: string
  total_students: number
  completed: number
  completion_pct: number
}

type StudentBreakdown = {
  student_id: string
  display_name: string
  username: string
  state: string
  due_date: string | null
  last_review_date: string | null
  cards_reviewed: number
  status: "completed" | "in_progress" | "not_started"
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  not_started: "bg-red-100 text-red-700",
}

export function TeacherAssignmentTrackingPage() {
  const { showToast } = useToast()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [breakdown, setBreakdown] = useState<Record<string, StudentBreakdown[]>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ assignments: Assignment[] }>("/api/teacher/assignments")
      setAssignments(res.assignments)
    } catch {
      showToast("Failed to load assignments", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const toggleExpand = async (key: string, cardId: string, classId: string) => {
    if (expanded === key) { setExpanded(null); return }
    setExpanded(key)
    if (!breakdown[key]) {
      try {
        const res = await apiClient.get<{ students: StudentBreakdown[] }>(
          `/api/teacher/assignments/${cardId}/students?class_id=${classId}`
        )
        setBreakdown(prev => ({ ...prev, [key]: res.students }))
      } catch {
        showToast("Failed to load student breakdown", "error")
      }
    }
  }

  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-6 h-6 text-blue-500" />
        <h1 className="text-2xl font-bold">Assignment Tracking</h1>
      </div>

      {assignments.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">No assignments yet.</Card>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => {
            const key = `${a.card_id}-${a.class_id}`
            return (
              <Card key={key} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{a.deck_name}</p>
                    <p className="text-sm text-gray-500">{a.class_name}</p>
                  </div>
                  <button onClick={() => toggleExpand(key, a.card_id, a.class_id)} className="p-1 hover:bg-gray-100 rounded">
                    {expanded === key ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{a.completed} / {a.total_students} completed</span>
                    <span>{a.completion_pct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${a.completion_pct}%` }}
                    />
                  </div>
                </div>

                {/* Student breakdown */}
                {expanded === key && (
                  <div className="mt-2 border-t pt-3 space-y-2">
                    <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> Student Breakdown
                    </p>
                    {(breakdown[key] || []).map(s => (
                      <div key={s.student_id} className="flex items-center justify-between text-sm">
                        <span>{s.display_name || s.username}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{s.cards_reviewed} reviews</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status]}`}>
                            {s.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
