import { useEffect, useState, useCallback } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { CheckSquare, RefreshCw, ChevronDown, ChevronUp, Save } from "lucide-react"

type QueueItem = {
  assessment_id: string
  title: string
  total_attempts: number
  ungraded: number
}

type Submission = {
  id: string
  user_id: string
  display_name: string
  username: string
  score_earned: number | null
  is_correct: boolean
  time_spent_ms: number | null
  created_at: string
}

export function TeacherGradingDashboardPage() {
  const { showToast } = useToast()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<Record<string, Submission[]>>({})
  const [overrideScores, setOverrideScores] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ queue: QueueItem[] }>("/api/teacher/grading/pending")
      setQueue(res.queue)
    } catch {
      showToast("Failed to load grading queue", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const toggleExpand = async (assessmentId: string) => {
    if (expanded === assessmentId) { setExpanded(null); return }
    setExpanded(assessmentId)
    if (!submissions[assessmentId]) {
      try {
        const res = await apiClient.get<{ submissions: Submission[] }>(`/api/teacher/grading/${assessmentId}/submissions`)
        setSubmissions(prev => ({ ...prev, [assessmentId]: res.submissions }))
      } catch {
        showToast("Failed to load submissions", "error")
      }
    }
  }

  const saveScore = async (attemptId: string, assessmentId: string) => {
    const score = parseFloat(overrideScores[attemptId])
    if (isNaN(score)) { showToast("Enter a valid score", "error"); return }
    setSaving(attemptId)
    try {
      await apiClient.put(`/api/teacher/grading/${attemptId}/score`, { score })
      showToast("Score saved", "success")
      const res = await apiClient.get<{ submissions: Submission[] }>(`/api/teacher/grading/${assessmentId}/submissions`)
      setSubmissions(prev => ({ ...prev, [assessmentId]: res.submissions }))
    } catch {
      showToast("Failed to save score", "error")
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <CheckSquare className="w-6 h-6 text-blue-500" />
        <h1 className="text-2xl font-bold">Grading Dashboard</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : queue.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">No pending grading. All caught up!</Card>
      ) : (
        <div className="space-y-3">
          {queue.map(item => (
            <Card key={item.assessment_id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-gray-500">
                    {item.ungraded} ungraded / {item.total_attempts} total
                  </p>
                </div>
                <button onClick={() => toggleExpand(item.assessment_id)} className="p-1 hover:bg-gray-100 rounded">
                  {expanded === item.assessment_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {expanded === item.assessment_id && (
                <div className="border-t pt-3 space-y-2">
                  {(submissions[item.assessment_id] || []).map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{s.display_name || s.username}</span>
                      <div className="flex items-center gap-2">
                        {s.score_earned != null ? (
                          <span className="text-gray-500">{s.score_earned} pts</span>
                        ) : (
                          <span className="text-amber-600 text-xs">Ungraded</span>
                        )}
                        <input
                          type="number"
                          className="border rounded px-2 py-1 text-sm w-20"
                          placeholder="Score"
                          value={overrideScores[s.id] ?? ""}
                          onChange={e => setOverrideScores(prev => ({ ...prev, [s.id]: e.target.value }))}
                        />
                        <Button
                          onClick={() => saveScore(s.id, item.assessment_id)}
                          disabled={saving === s.id}
                        >
                          <Save className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
