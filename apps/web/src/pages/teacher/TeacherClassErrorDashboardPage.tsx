import { useEffect, useState, useCallback } from "react"
import { Card } from "../../components/ui/Card"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { AlertOctagon, RefreshCw, ChevronRight } from "lucide-react"

type ClassItem = { id: string; name: string; student_count: number }
type ErrorStats = {
  top_categories: { category: string; count: number }[]
  top_topics: { topic: string; count: number }[]
  mastery_rate_pct: number
}
type DrillRow = { display_name: string; username: string; wrong_answer: string; correct_answer_snapshot: string; review_count: number; is_mastered: boolean }

export function TeacherClassErrorDashboardPage() {
  const { showToast } = useToast()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClass, setSelectedClass] = useState("")
  const [stats, setStats] = useState<ErrorStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [drillTopic, setDrillTopic] = useState<string | null>(null)
  const [drillData, setDrillData] = useState<DrillRow[]>([])
  const [drillLoading, setDrillLoading] = useState(false)

  useEffect(() => {
    apiClient.get<{ classes: ClassItem[] }>("/api/classroom/teacher/classes")
      .then(res => { setClasses(res.classes); if (res.classes[0]) setSelectedClass(res.classes[0].id) })
      .catch(() => showToast("Failed to load classes", "error"))
  }, [showToast])

  const loadStats = useCallback(async () => {
    if (!selectedClass) return
    setLoading(true)
    try {
      const res = await apiClient.get<ErrorStats>(`/api/teacher/errors/class/${selectedClass}`)
      setStats(res)
      setDrillTopic(null)
    } catch {
      showToast("Failed to load error stats", "error")
    } finally {
      setLoading(false)
    }
  }, [selectedClass, showToast])

  useEffect(() => { loadStats() }, [loadStats])

  const drillDown = async (topic: string) => {
    setDrillTopic(topic)
    setDrillLoading(true)
    try {
      const res = await apiClient.get<{ errors: DrillRow[] }>(`/api/teacher/errors/class/${selectedClass}/topic/${encodeURIComponent(topic)}`)
      setDrillData(res.errors)
    } catch {
      showToast("Failed to load topic details", "error")
    } finally {
      setDrillLoading(false)
    }
  }

  const maxCat = Math.max(...(stats?.top_categories.map(c => c.count) || [1]))
  const maxTop = Math.max(...(stats?.top_topics.map(t => t.count) || [1]))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-6 h-6 text-red-500" />
          <h1 className="text-2xl font-bold">Class Error Dashboard</h1>
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : !stats ? null : (
        <>
          {/* Mastery rate */}
          <Card className="p-4 flex items-center gap-4">
            <div className="text-3xl font-bold text-green-600">{stats.mastery_rate_pct}%</div>
            <div>
              <p className="font-medium">Error-to-Mastery Rate</p>
              <p className="text-sm text-gray-500">% of logged errors that students eventually mastered</p>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top error categories */}
            <Card className="p-4 space-y-3">
              <p className="font-semibold text-sm">Top Error Categories</p>
              {stats.top_categories.map(c => (
                <div key={c.category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{c.category}</span>
                    <span className="text-gray-500">{c.count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-red-400 h-2 rounded-full" style={{ width: `${(c.count / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </Card>

            {/* Top error topics */}
            <Card className="p-4 space-y-3">
              <p className="font-semibold text-sm">Top Error Topics <span className="text-xs text-blue-500 font-normal">(click to drill down)</span></p>
              {stats.top_topics.map(t => (
                <div key={t.topic} className="space-y-1 cursor-pointer" onClick={() => drillDown(t.topic)}>
                  <div className="flex justify-between text-sm hover:text-blue-600">
                    <span className="flex items-center gap-1">{t.topic} <ChevronRight className="w-3 h-3" /></span>
                    <span className="text-gray-500">{t.count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-orange-400 h-2 rounded-full" style={{ width: `${(t.count / maxTop) * 100}%` }} />
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* Drill down */}
          {drillTopic && (
            <Card className="p-4 space-y-3">
              <p className="font-semibold text-sm">Topic: <span className="text-blue-600">{drillTopic}</span></p>
              {drillLoading ? (
                <div className="flex justify-center py-4"><RefreshCw className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : drillData.length === 0 ? (
                <p className="text-sm text-gray-500">No error data for this topic.</p>
              ) : (
                <div className="space-y-2">
                  {drillData.map((d, i) => (
                    <div key={i} className="text-sm border rounded-lg p-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{d.display_name || d.username}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${d.is_mastered ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {d.is_mastered ? "Mastered" : "Outstanding"}
                        </span>
                      </div>
                      <p className="text-gray-500">Wrong: <span className="text-red-500">{d.wrong_answer}</span> → Correct: <span className="text-green-600">{d.correct_answer_snapshot}</span></p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
