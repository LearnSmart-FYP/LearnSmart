import { useEffect, useState, useCallback } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { Zap, RefreshCw, X } from "lucide-react"

type ClassItem = { id: string; name: string }
type Alert = {
  topic: string
  wrong_answer: string
  affected_students: number
  pct: number
}

export function TeacherMisconceptionAlertPage() {
  const { showToast } = useToast()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClass, setSelectedClass] = useState("")
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(false)
  const [threshold, setThreshold] = useState(30)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    apiClient.get<{ classes: ClassItem[] }>("/api/classroom/teacher/classes")
      .then(res => { setClasses(res.classes); if (res.classes[0]) setSelectedClass(res.classes[0].id) })
      .catch(() => showToast("Failed to load classes", "error"))
  }, [showToast])

  const load = useCallback(async () => {
    if (!selectedClass) return
    setLoading(true)
    try {
      const res = await apiClient.get<{ alerts: Alert[] }>(
        `/api/teacher/errors/misconceptions/${selectedClass}?threshold_pct=${threshold}`
      )
      setAlerts(res.alerts)
      setDismissed(new Set())
    } catch {
      showToast("Failed to load alerts", "error")
    } finally {
      setLoading(false)
    }
  }, [selectedClass, threshold, showToast])

  useEffect(() => { load() }, [load])

  const visibleAlerts = alerts.filter(a => !dismissed.has(`${a.topic}-${a.wrong_answer}`))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold">Misconception Alerts</h1>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select className="border rounded-lg px-3 py-2 text-sm" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex items-center gap-1 text-sm">
            <label>Threshold</label>
            <input type="number" min={5} max={100} className="border rounded-lg px-2 py-1.5 w-20 text-sm" value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
            <span>%</span>
          </div>
          <Button variant="secondary" onClick={load}>Refresh</Button>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Topics flagged where {threshold}%+ of students share the same wrong answer — a strong indicator of a class-wide misconception.
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : visibleAlerts.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No misconceptions detected above {threshold}% threshold.
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleAlerts.map(a => {
            const key = `${a.topic}-${a.wrong_answer}`
            return (
              <Card key={key} className="p-4 border-l-4 border-amber-400">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{a.topic}</p>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                        {a.pct}% of class · {a.affected_students} students
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Common wrong answer: <span className="font-medium text-red-600">{a.wrong_answer}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setDismissed(prev => new Set([...prev, key]))}
                    className="p-1 hover:bg-gray-100 rounded shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Button variant="secondary" onClick={() => showToast("Navigate to deck creation for this topic", "info")}>
                    Create targeted deck
                  </Button>
                  <Button variant="secondary" onClick={() => showToast("Navigate to assessment builder", "info")}>
                    Create mini-assessment
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
