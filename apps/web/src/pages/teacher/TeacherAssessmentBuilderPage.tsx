import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { ClipboardList, Plus, Trash2, Globe, FileText, RefreshCw } from "lucide-react"

type Assessment = {
  id: string
  title: string
  quiz_type: string
  time_limit_minutes: number | null
  passing_score: number
  is_published: boolean
  created_at: string
  question_count: number
}

export function TeacherAssessmentBuilderPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: "", description: "", quiz_type: "practice", time_limit_minutes: "", passing_score: 60 })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ assessments: Assessment[] }>("/api/teacher/assessments")
      setAssessments(res.assessments)
    } catch {
      showToast("Failed to load assessments", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const createAssessment = async () => {
    if (!form.title.trim()) { showToast("Title is required", "error"); return }
    setCreating(true)
    try {
      const res = await apiClient.post<{ id: string }>("/api/teacher/assessments", {
        ...form,
        time_limit_minutes: form.time_limit_minutes ? Number(form.time_limit_minutes) : null,
      })
      showToast("Assessment created", "success")
      setShowCreate(false)
      navigate(`/classroom/assessments/${res.id}/edit`)
    } catch {
      showToast("Failed to create assessment", "error")
    } finally {
      setCreating(false)
    }
  }

  const publish = async (id: string) => {
    try {
      await apiClient.put(`/api/teacher/assessments/${id}/publish`, {})
      showToast("Assessment published", "success")
      load()
    } catch {
      showToast("Failed to publish", "error")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Assessment Builder</h1>
        </div>
        <Button onClick={() => setShowCreate(v => !v)}>
          <Plus className="w-4 h-4 mr-1" /> New Assessment
        </Button>
      </div>

      {showCreate && (
        <Card className="p-4 space-y-3 border-blue-200 bg-blue-50/30">
          <p className="font-semibold text-sm">New Assessment</p>
          <input className="w-full border rounded-lg p-2 text-sm" placeholder="Title..." value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} />
          <textarea rows={2} className="w-full border rounded-lg p-2 text-sm" placeholder="Description (optional)..." value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} />
          <div className="flex gap-2 flex-wrap">
            <select className="border rounded-lg px-2 py-1.5 text-sm" value={form.quiz_type} onChange={e => setForm(v => ({ ...v, quiz_type: e.target.value }))}>
              <option value="practice">Practice</option>
              <option value="quiz">Quiz</option>
              <option value="midterm">Midterm</option>
              <option value="final">Final</option>
            </select>
            <input type="number" className="border rounded-lg px-2 py-1.5 text-sm w-36" placeholder="Time limit (min)" value={form.time_limit_minutes} onChange={e => setForm(v => ({ ...v, time_limit_minutes: e.target.value }))} />
            <input type="number" className="border rounded-lg px-2 py-1.5 text-sm w-36" placeholder="Passing score %" value={form.passing_score} onChange={e => setForm(v => ({ ...v, passing_score: Number(e.target.value) }))} />
          </div>
          <div className="flex gap-2">
            <Button onClick={createAssessment} disabled={creating}>{creating ? "Creating..." : "Create & Add Questions"}</Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : assessments.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">No assessments yet. Create one above.</Card>
      ) : (
        <div className="space-y-3">
          {assessments.map(a => (
            <Card key={a.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{a.title}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${a.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {a.is_published ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {a.quiz_type} · {a.question_count} questions
                  {a.time_limit_minutes ? ` · ${a.time_limit_minutes} min` : " · No time limit"}
                  {` · Pass: ${a.passing_score}%`}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="secondary" onClick={() => navigate(`/classroom/assessments/${a.id}/edit`)}>
                  <FileText className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
                {!a.is_published && (
                  <Button onClick={() => publish(a.id)}>
                    <Globe className="w-3.5 h-3.5 mr-1" /> Publish
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
