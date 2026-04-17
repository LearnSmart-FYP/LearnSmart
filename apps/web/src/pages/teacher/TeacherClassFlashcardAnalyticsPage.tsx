import { useEffect, useState, useCallback } from "react"
import { Card } from "../../components/ui/Card"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { BarChart2, RefreshCw, AlertCircle } from "lucide-react"

type ClassItem = { id: string; name: string }
type StudentStat = {
  student_id: string
  display_name: string
  username: string
  total_assigned: number
  mastered: number
  overdue: number
  last_review: string | null
  algorithm: string | null
}
type Analytics = {
  students: StudentStat[]
  algorithm_distribution: { algorithm: string; user_count: number }[]
}

export function TeacherClassFlashcardAnalyticsPage() {
  const { showToast } = useToast()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClass, setSelectedClass] = useState("")
  const [data, setData] = useState<Analytics | null>(null)
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
      const res = await apiClient.get<Analytics>(`/api/teacher/analytics/flashcards/${selectedClass}`)
      setData(res)
    } catch {
      showToast("Failed to load analytics", "error")
    } finally {
      setLoading(false)
    }
  }, [selectedClass, showToast])

  useEffect(() => { load() }, [load])

  const atRisk = data?.students.filter(s => !s.last_review || new Date(s.last_review) < new Date(Date.now() - 7 * 86400000)) || []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Flashcard Analytics</h1>
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : !data ? null : (
        <>
          {atRisk.length > 0 && (
            <Card className="p-4 border-l-4 border-red-400 bg-red-50/40 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm text-red-700">{atRisk.length} at-risk students</p>
                <p className="text-xs text-red-600">{atRisk.map(s => s.display_name || s.username).join(", ")} — no reviews in the past 7 days</p>
              </div>
            </Card>
          )}

          {/* Algorithm distribution */}
          {data.algorithm_distribution.length > 0 && (
            <Card className="p-4 space-y-2">
              <p className="font-semibold text-sm">Algorithm Distribution</p>
              <div className="flex gap-3 flex-wrap">
                {data.algorithm_distribution.map(a => (
                  <span key={a.algorithm} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm">
                    {a.algorithm}: {a.user_count} students
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Per-student table */}
          <Card className="p-4 space-y-2">
            <p className="font-semibold text-sm">Student Flashcard Progress</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-2 font-medium">Student</th>
                    <th className="pb-2 font-medium text-center">Assigned</th>
                    <th className="pb-2 font-medium text-center">Mastered</th>
                    <th className="pb-2 font-medium text-center">Overdue</th>
                    <th className="pb-2 font-medium">Last Review</th>
                    <th className="pb-2 font-medium">Algorithm</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.students.map(s => (
                    <tr key={s.student_id} className={atRisk.some(r => r.student_id === s.student_id) ? "bg-red-50/30" : ""}>
                      <td className="py-2 font-medium">{s.display_name || s.username}</td>
                      <td className="py-2 text-center text-gray-600">{s.total_assigned}</td>
                      <td className="py-2 text-center text-green-600">{s.mastered}</td>
                      <td className="py-2 text-center text-red-500">{s.overdue}</td>
                      <td className="py-2 text-gray-500 text-xs">{s.last_review ? new Date(s.last_review).toLocaleDateString() : "Never"}</td>
                      <td className="py-2 text-gray-500 text-xs">{s.algorithm || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
