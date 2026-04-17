import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { TextField } from "../../components/form/TextField"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { callAiJson } from "../../lib/aiCall"
import {
  FileQuestion, Plus, X, ChevronDown, ChevronUp, Search,
  Pencil, Trash2, Eye, Award, Sparkles, Users, CheckCircle,
  Clock, BookOpen, BarChart2, AlertCircle, GraduationCap, Send
} from "lucide-react"


type ClassItem = {
  id: string
  name: string
  class_code: string
  student_count: number
}

type Question = {
  id?: string
  question_text: string
  question_type: "mcq" | "short_answer" | "true_false"
  options?: string[]          // MCQ choices
  correct_answer: string
  marks: number
  explanation?: string
}

type Assessment = {
  id: string
  title: string
  description: string | null
  class_id: string
  class_name?: string
  total_marks: number
  time_limit_minutes: number | null
  due_at: string | null
  status: "draft" | "published" | "closed"
  question_count: number
  submission_count: number
  created_at: string
}

type Submission = {
  id: string
  student_id: string
  username: string
  display_name: string | null
  total_score: number | null
  max_score: number
  percentage: number | null
  status: "submitted" | "graded" | "late"
  submitted_at: string | null
  graded_at: string | null
  teacher_feedback: string | null
  answers: { question_id: string; answer: string; is_correct: boolean | null; marks_awarded: number | null }[]
}

type Tab = "assessments" | "create"

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  published: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  closed:    "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
}

const QTYPE_LABEL: Record<string, string> = {
  mcq:          "MCQ",
  short_answer: "Short Answer",
  true_false:   "True / False",
}


function emptyQuestion(): Question {
  return { question_text: "", question_type: "mcq", options: ["", "", "", ""], correct_answer: "", marks: 1 }
}


export function TeacherAssessmentPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [tab, setTab] = useState<Tab>("assessments")

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [classesLoading, setClassesLoading] = useState(true)

  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [assessmentsLoading, setAssessmentsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published" | "closed">("all")

  const [submissionsModal, setSubmissionsModal] = useState<Assessment | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [gradingId, setGradingId] = useState<string | null>(null)
  const [gradeForm, setGradeForm] = useState<{ score: string; feedback: string }>({ score: "", feedback: "" })
  const [expandedSub, setExpandedSub] = useState<string | null>(null)

  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)

  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null)
  const [form, setForm] = useState({
    title: "",
    description: "",
    class_id: "",
    time_limit_minutes: "",
    due_at: "",
  })
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()])
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [aiTopic, setAiTopic] = useState("")
  const [aiQCount, setAiQCount] = useState("5")
  const [aiQType, setAiQType] = useState<"mcq" | "short_answer" | "true_false">("mcq")
  const [aiGenerating, setAiGenerating] = useState(false)

  useEffect(() => {
    async function loadClasses() {
      setClassesLoading(true)
      try {
        const res = await apiClient.get<{ classes: ClassItem[] }>("/api/classroom/teacher/classes")
        const active = (res?.classes ?? []).filter((c: any) => c.status !== "archived")
        setClasses(active)
        if (active.length > 0) setForm(f => ({ ...f, class_id: active[0].id }))
      } catch {
        showToast("Failed to load classes")
      } finally {
        setClassesLoading(false)
      }
    }
    loadClasses()
  }, [])

  const loadAssessments = useCallback(async () => {
    setAssessmentsLoading(true)
    try {
      const res = await apiClient.get<{ assessments: Assessment[] }>("/api/quiz/teacher/assessments").catch(() => null)
      setAssessments(res?.assessments ?? [])
    } catch {
      showToast("Failed to load assessments")
    } finally {
      setAssessmentsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAssessments()
  }, [loadAssessments])

  async function openSubmissions(assessment: Assessment) {
    setSubmissionsModal(assessment)
    setSubmissions([])
    setAiInsight(null)
    setSubmissionsLoading(true)
    try {
      const res = await apiClient.get<{ submissions: Submission[] }>(
        `/api/quiz/teacher/assessments/${assessment.id}/submissions`
      ).catch(() => null)
      setSubmissions(res?.submissions ?? [])
    } catch {
      showToast("Failed to load submissions")
    } finally {
      setSubmissionsLoading(false)
    }
  }

  async function handleGrade(submissionId: string) {
    if (!submissionsModal) return
    try {
      await apiClient.patch(
        `/api/quiz/teacher/assessments/${submissionsModal.id}/submissions/${submissionId}/grade`,
        { total_score: Number(gradeForm.score), teacher_feedback: gradeForm.feedback }
      )
      showToast("Graded successfully")
      setGradingId(null)
      setGradeForm({ score: "", feedback: "" })
      openSubmissions(submissionsModal)
    } catch {
      showToast("Failed to save grade")
    }
  }

  async function generateInsight() {
    if (submissions.length === 0) { showToast("No submissions yet"); return }
    setInsightLoading(true)
    try {
      const prompt = [
        "You are a teaching assistant. Summarize the class's assessment performance in 2–3 sentences.",
        "Identify any common mistakes and suggest one teaching action.",
        "Return JSON with key: insight (string). No markdown fences.",
        "",
        "Submission data:",
        JSON.stringify(
          submissions.map(s => ({
            username: s.username,
            percentage: s.percentage,
            status: s.status,
          })),
          null, 2
        ),
      ].join("\n")

      const result = await callAiJson<{ insight: string }>(prompt)
      setAiInsight(result.insight)
    } catch {
      showToast("AI insight failed")
    } finally {
      setInsightLoading(false)
    }
  }

  async function handleStatusChange(id: string, newStatus: "published" | "closed") {
    setPublishing(id)
    try {
      await apiClient.patch(`/api/quiz/teacher/assessments/${id}/status`, { status: newStatus })
      setAssessments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
      showToast(`Assessment ${newStatus}`)
    } catch {
      showToast("Failed to update status")
    } finally {
      setPublishing(null)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await apiClient.delete(`/api/quiz/teacher/assessments/${id}`)
      setAssessments(prev => prev.filter(a => a.id !== id))
      showToast("Assessment deleted")
    } catch {
      showToast("Failed to delete")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleAIGenerate() {
    if (!aiTopic.trim()) { showToast("Enter a topic"); return }
    setAiGenerating(true)
    try {
      const prompt = [
        `Generate ${aiQCount} ${QTYPE_LABEL[aiQType]} questions about: "${aiTopic}".`,
        "Return JSON array. Each item: { question_text, question_type, options (array for MCQ/true_false), correct_answer, marks, explanation }.",
        "For true_false, options = [\"True\",\"False\"]. No markdown fences.",
      ].join(" ")

      const result = await callAiJson<Question[]>(prompt)
      const newQs = (Array.isArray(result) ? result : []).map(q => ({
        ...emptyQuestion(),
        ...q,
        question_type: aiQType,
      }))
      setQuestions(prev => [...prev, ...newQs])
      showToast(`Added ${newQs.length} AI-generated questions`)
    } catch {
      showToast("AI generation failed")
    } finally {
      setAiGenerating(false)
    }
  }

  async function handleSave(asDraft: boolean) {
    if (!form.title.trim()) { showToast("Enter a title"); return }
    if (!form.class_id) { showToast("Select a class"); return }
    const validQs = questions.filter(q => q.question_text.trim() && q.correct_answer.trim())
    if (validQs.length === 0) { showToast("Add at least one complete question"); return }

    setSaving(true)
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        class_id: form.class_id,
        time_limit_minutes: form.time_limit_minutes ? Number(form.time_limit_minutes) : null,
        due_at: form.due_at || null,
        status: asDraft ? "draft" : "published",
        questions: validQs,
      }

      if (editingAssessment) {
        await apiClient.put(`/api/quiz/teacher/assessments/${editingAssessment.id}`, payload)
        showToast("Assessment updated")
      } else {
        await apiClient.post("/api/quiz/teacher/assessments", payload)
        showToast("Assessment created")
      }

      setTab("assessments")
      setEditingAssessment(null)
      resetForm()
      loadAssessments()
    } catch {
      showToast("Failed to save assessment")
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setForm({ title: "", description: "", class_id: classes[0]?.id ?? "", time_limit_minutes: "", due_at: "" })
    setQuestions([emptyQuestion()])
    setAiTopic("")
  }

  function startEdit(assessment: Assessment) {
    setEditingAssessment(assessment)
    setForm({
      title: assessment.title,
      description: assessment.description ?? "",
      class_id: assessment.class_id,
      time_limit_minutes: assessment.time_limit_minutes?.toString() ?? "",
      due_at: assessment.due_at ? assessment.due_at.slice(0, 16) : "",
    })
    setQuestions([emptyQuestion()])
    setTab("create")
  }

  function updateQuestion(idx: number, field: keyof Question, value: any) {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
  }

  function updateOption(qIdx: number, optIdx: number, value: string) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const opts = [...(q.options ?? [])]
      opts[optIdx] = value
      return { ...q, options: opts }
    }))
  }

  function addQuestion() {
    setQuestions(prev => [...prev, emptyQuestion()])
  }

  function removeQuestion(idx: number) {
    setQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  const filtered = assessments.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "all" || a.status === statusFilter
    return matchSearch && matchStatus
  })

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
            <FileQuestion className="w-6 h-6 text-violet-500" />
            Assessments
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create assessments, view submissions, and grade your students.
          </p>
        </div>
        <Button
          onClick={() => { setTab("create"); setEditingAssessment(null); resetForm() }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Assessment
        </Button>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(["assessments", "create"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-violet-500 text-violet-600 dark:text-violet-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t === "assessments" ? "My Assessments" : editingAssessment ? "Edit Assessment" : "Create Assessment"}
          </button>
        ))}
      </div>

      {tab === "assessments" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search assessments..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
              />
            </div>
            <div className="flex gap-2">
              {(["all", "draft", "published", "closed"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    statusFilter === s
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-violet-400"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {assessmentsLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <FileQuestion className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {search || statusFilter !== "all" ? "No matching assessments" : "No assessments yet"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {!search && statusFilter === "all" && "Create your first assessment to get started."}
                </p>
                {!search && statusFilter === "all" && (
                  <Button className="mt-4" onClick={() => setTab("create")}>Create Assessment</Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(a => (
                <Card key={a.id} className="hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
                      <FileQuestion className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{a.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[a.status]}`}>
                          {a.status}
                        </span>
                        {a.class_name && (
                          <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {a.class_name}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{a.question_count} questions</span>
                        <span className="flex items-center gap-1"><Award className="w-3 h-3" />{a.total_marks} marks</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{a.submission_count} submissions</span>
                        {a.time_limit_minutes && (
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.time_limit_minutes} min</span>
                        )}
                        {a.due_at && (
                          <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" />
                            Due {new Date(a.due_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openSubmissions(a)}
                        className="p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                        title="View Submissions"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => startEdit(a)}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {a.status === "draft" && (
                        <button
                          onClick={() => handleStatusChange(a.id, "published")}
                          disabled={publishing === a.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {publishing === a.id ? (
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Publish
                        </button>
                      )}
                      {a.status === "published" && (
                        <button
                          onClick={() => handleStatusChange(a.id, "closed")}
                          disabled={publishing === a.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                        >
                          Close
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(a.id)}
                        disabled={deletingId === a.id}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete"
                      >
                        {deletingId === a.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "create" && (
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Assessment Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <TextField
                  label="Title"
                  placeholder="e.g., Chapter 5 Quiz"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm outline-none bg-white text-gray-900 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  rows={2}
                  placeholder="Brief description or instructions for students"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class <span className="text-red-500">*</span></label>
                {classes.length === 0 ? (
                  <p className="text-sm text-red-500">No classes available. <button onClick={() => navigate("/classroom/classes")} className="underline">Create one.</button></p>
                ) : (
                  <select
                    value={form.class_id}
                    onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <TextField
                label="Time Limit (minutes)"
                type="number"
                placeholder="Leave blank for no limit"
                value={form.time_limit_minutes}
                onChange={e => setForm(f => ({ ...f, time_limit_minutes: e.target.value }))}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                <input
                  type="datetime-local"
                  value={form.due_at}
                  onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="font-semibold text-gray-900 dark:text-white">AI Question Generator</h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Topic or concept (e.g., Photosynthesis)"
                value={aiTopic}
                onChange={e => setAiTopic(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              <select
                value={aiQCount}
                onChange={e => setAiQCount(e.target.value)}
                className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
              >
                {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n} Qs</option>)}
              </select>
              <select
                value={aiQType}
                onChange={e => setAiQType(e.target.value as any)}
                className="w-40 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
              >
                {Object.entries(QTYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <Button
                onClick={handleAIGenerate}
                disabled={aiGenerating}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {aiGenerating ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate
              </Button>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Questions <span className="text-sm font-normal text-gray-400 dark:text-gray-500">({questions.filter(q => q.question_text.trim()).length} complete)</span>
              </h2>
              <Button variant="ghost" onClick={addQuestion} className="flex items-center gap-1.5 text-sm">
                <Plus className="w-4 h-4" />
                Add Question
              </Button>
            </div>

            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div key={idx} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Q{idx + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        value={q.question_type}
                        onChange={e => updateQuestion(idx, "question_type", e.target.value)}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none"
                      >
                        {Object.entries(QTYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={q.marks}
                        onChange={e => updateQuestion(idx, "marks", Number(e.target.value))}
                        className="w-16 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none text-center"
                        title="Marks"
                        placeholder="Marks"
                      />
                      <span className="text-xs text-gray-400">mark{q.marks !== 1 ? "s" : ""}</span>
                      {questions.length > 1 && (
                        <button
                          onClick={() => removeQuestion(idx)}
                          className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    rows={2}
                    placeholder="Question text..."
                    value={q.question_text}
                    onChange={e => updateQuestion(idx, "question_text", e.target.value)}
                  />

                  {(q.question_type === "mcq") && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(q.options ?? ["", "", "", ""]).map((opt, oIdx) => (
                        <input
                          key={oIdx}
                          type="text"
                          placeholder={`Option ${oIdx + 1}`}
                          value={opt}
                          onChange={e => updateOption(idx, oIdx, e.target.value)}
                          className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                        />
                      ))}
                    </div>
                  )}

                  {q.question_type === "true_false" && (
                    <div className="flex gap-3">
                      {["True", "False"].map(v => (
                        <label key={v} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`tf-${idx}`}
                            value={v}
                            checked={q.correct_answer === v}
                            onChange={() => updateQuestion(idx, "correct_answer", v)}
                            className="accent-violet-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{v}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {q.question_type !== "true_false" && (
                    <input
                      type="text"
                      placeholder="Correct answer"
                      value={q.correct_answer}
                      onChange={e => updateQuestion(idx, "correct_answer", e.target.value)}
                      className="w-full rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                    />
                  )}

                  {/* Explanation */}
                  <input
                    type="text"
                    placeholder="Explanation (shown after answer)"
                    value={q.explanation ?? ""}
                    onChange={e => updateQuestion(idx, "explanation", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
              ))}
            </div>

            {/* Total marks */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total: <strong className="text-gray-800 dark:text-gray-200">{questions.reduce((s, q) => s + (q.marks || 0), 0)} marks</strong>
              </span>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => { setTab("assessments"); setEditingAssessment(null); resetForm() }}>
                  Cancel
                </Button>
                <Button variant="ghost" onClick={() => handleSave(true)} disabled={saving}>
                  Save Draft
                </Button>
                <Button onClick={() => handleSave(false)} disabled={saving} className="flex items-center gap-2">
                  {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send className="w-4 h-4" />}
                  {editingAssessment ? "Update" : "Publish"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {submissionsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSubmissionsModal(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-900 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{submissionsModal.title}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{submissions.length} submissions</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={generateInsight}
                  disabled={insightLoading || submissions.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {insightLoading ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  AI Insight
                </button>
                <button
                  onClick={() => setSubmissionsModal(null)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* AI Insight */}
              {aiInsight && (
                <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">AI Class Insight</span>
                  </div>
                  <p className="text-sm text-indigo-800 dark:text-indigo-200">{aiInsight}</p>
                </div>
              )}

              {/* Score summary */}
              {submissions.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Average",
                      value: `${Math.round(submissions.filter(s => s.percentage !== null).reduce((a, s) => a + (s.percentage ?? 0), 0) / (submissions.filter(s => s.percentage !== null).length || 1))}%`,
                      color: "text-blue-600 dark:text-blue-400",
                    },
                    {
                      label: "Graded",
                      value: `${submissions.filter(s => s.status === "graded").length}/${submissions.length}`,
                      color: "text-green-600 dark:text-green-400",
                    },
                    {
                      label: "Late",
                      value: submissions.filter(s => s.status === "late").length,
                      color: "text-orange-600 dark:text-orange-400",
                    },
                  ].map(stat => (
                    <div key={stat.label} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 text-center">
                      <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Submission list */}
              {submissionsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                  No submissions yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {submissions.map(sub => (
                    <div
                      key={sub.id}
                      className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        onClick={() => setExpandedSub(expandedSub === sub.id ? null : sub.id)}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {(sub.display_name ?? sub.username).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-gray-800 dark:text-gray-200">
                              {sub.display_name ?? sub.username}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              sub.status === "graded"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : sub.status === "late"
                                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}>
                              {sub.status}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {sub.submitted_at ? `Submitted ${new Date(sub.submitted_at).toLocaleString()}` : "Not submitted"}
                            {sub.percentage !== null && (
                              <span className="ml-3 font-medium text-gray-700 dark:text-gray-300">{sub.percentage}%</span>
                            )}
                          </div>
                        </div>
                        {expandedSub === sub.id
                          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        }
                      </button>

                      {/* Grade form */}
                      {expandedSub === sub.id && (
                        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                          {sub.teacher_feedback && (
                            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Feedback: </span>{sub.teacher_feedback}
                            </div>
                          )}
                          {gradingId === sub.id ? (
                            <div className="space-y-2">
                              <div className="flex gap-3">
                                <input
                                  type="number"
                                  min={0}
                                  max={sub.max_score}
                                  placeholder={`Score (max ${sub.max_score})`}
                                  value={gradeForm.score}
                                  onChange={e => setGradeForm(f => ({ ...f, score: e.target.value }))}
                                  className="w-36 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                />
                                <input
                                  type="text"
                                  placeholder="Feedback to student"
                                  value={gradeForm.feedback}
                                  onChange={e => setGradeForm(f => ({ ...f, feedback: e.target.value }))}
                                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={() => handleGrade(sub.id)} className="text-xs py-1.5 px-3">Save Grade</Button>
                                <Button variant="ghost" onClick={() => setGradingId(null)} className="text-xs py-1.5 px-3">Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setGradingId(sub.id)
                                setGradeForm({ score: sub.total_score?.toString() ?? "", feedback: sub.teacher_feedback ?? "" })
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                            >
                              <Award className="w-3 h-3" />
                              {sub.status === "graded" ? "Edit Grade" : "Grade"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
