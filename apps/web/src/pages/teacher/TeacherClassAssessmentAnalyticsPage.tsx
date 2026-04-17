import { useEffect, useState, useCallback } from "react"
import { Card } from "../../components/ui/Card"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { PieChart, RefreshCw } from "lucide-react"

type ClassItem = { id: string; name: string }
type AssessmentStat = {
  assessment_id: string
  title: string
  total_attempts: number
  avg_score: number
  highest_score: number
  lowest_score: number
  pass_rate_pct: number
}
type QuestionStat = {
  id: string
  question_text: string
  question_type: string
  attempts: number
  correct_pct: number
  avg_time_seconds: number
}

export function TeacherClassAssessmentAnalyticsPage() {
  const { showToast } = useToast()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClass, setSelectedClass] = useState("")
  const [stats, setStats] = useState<AssessmentStat[]>([])
  const [perQuestion, setPerQuestion] = useState<QuestionStat[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiClient.get<{ classes: ClassItem[] }>("/api/classroom/teacher/classes")
      .then(res => { setClasses(res.classes); if (res.classes[0]) setSelectedClass(res.classes[0].id) })
      .catch(() => showToast("Failed to load classes", "error"))
  }, [showToast])

  const load = useCallback(async () => {
    if (!selectedClass) return
    setLoading(true)
    try {
      const res = await apiClient.get<{ assessment_stats: AssessmentStat[]; per_question: QuestionStat[] }>(
        `/api/teacher/analytics/assessments/${selectedClass}`
      )
      setStats(res.assessment_stats)
      setPerQuestion(res.per_question)
    } catch {
      showToast("Failed to load analytics", "error")
    } finally {
      setLoading(false)
    }
  }, [selectedClass, showToast])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Assessment Analytics</h1>
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <>
          {stats.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">No assessment data for this class.</Card>
          ) : (
            <div className="space-y-4">
              {stats.map(s => (
                <Card key={s.assessment_id} className="p-4 space-y-3">
                  <p className="font-semibold">{s.title}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Avg Score", value: s.avg_score ?? "—", color: "text-blue-600" },
                      { label: "Highest", value: s.highest_score ?? "—", color: "text-green-600" },
                      { label: "Lowest", value: s.lowest_score ?? "—", color: "text-red-500" },
                      { label: "Pass Rate", value: `${s.pass_rate_pct ?? 0}%`, color: "text-purple-600" },
                    ].map(m => (
                      <div key={m.label} className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">{s.total_attempts} total attempts</p>
                </Card>
              ))}
            </div>
          )}

          {perQuestion.length > 0 && (
            <Card className="p-4 space-y-2">
              <p className="font-semibold text-sm">Per-Question Analysis</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="pb-2 font-medium">Question</th>
                      <th className="pb-2 font-medium text-center">Type</th>
                      <th className="pb-2 font-medium text-center">Attempts</th>
                      <th className="pb-2 font-medium text-center">Correct %</th>
                      <th className="pb-2 font-medium text-center">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {perQuestion.map(q => (
                      <tr key={q.id} className={q.correct_pct < 40 ? "bg-red-50/30" : ""}>
                        <td className="py-2 max-w-xs truncate">{q.question_text}</td>
                        <td className="py-2 text-center text-gray-500 text-xs">{q.question_type}</td>
                        <td className="py-2 text-center">{q.attempts}</td>
                        <td className={`py-2 text-center font-medium ${q.correct_pct >= 70 ? "text-green-600" : q.correct_pct >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                          {q.correct_pct}%
                        </td>
                        <td className="py-2 text-center text-gray-500">{q.avg_time_seconds}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
