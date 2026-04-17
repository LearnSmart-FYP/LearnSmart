import { useEffect, useState, useCallback } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { FileText, RefreshCw, User, Download } from "lucide-react"

type ClassItem = { id: string; name: string }
type Student = { id: string; display_name: string; username: string }
type Report = {
  student: { id: string; display_name: string; email: string }
  flashcards: { total: number; mastered: number; overdue: number; last_review: string | null }
  assessments: { total_attempts: number; avg_score: number; correct: number }
  errors: { total_errors: number; mastered_errors: number; outstanding_errors: number }
}

export function TeacherStudentReportPage() {
  const { showToast } = useToast()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClass, setSelectedClass] = useState("")
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState("")
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiClient.get<{ classes: ClassItem[] }>("/api/classroom/teacher/classes")
      .then(res => { setClasses(res.classes); if (res.classes[0]) setSelectedClass(res.classes[0].id) })
      .catch(() => showToast("Failed to load classes", "error"))
  }, [showToast])

  useEffect(() => {
    if (!selectedClass) return
    apiClient.get<{ students: Student[] }>(`/api/classroom/teacher/classes/${selectedClass}/students`)
      .then(res => { setStudents(res.students || []); setSelectedStudent("") })
      .catch(() => {})
  }, [selectedClass])

  const loadReport = useCallback(async () => {
    if (!selectedStudent) return
    setLoading(true)
    try {
      const res = await apiClient.get<Report>(`/api/teacher/analytics/student/${selectedStudent}`)
      setReport(res)
    } catch {
      showToast("Failed to generate report", "error")
    } finally {
      setLoading(false)
    }
  }, [selectedStudent, showToast])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="w-6 h-6 text-blue-500" />
        <h1 className="text-2xl font-bold">Student Progress Report</h1>
      </div>

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Class</label>
          <select className="border rounded-lg px-3 py-2 text-sm" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Student</label>
          <select className="border rounded-lg px-3 py-2 text-sm" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
            <option value="">-- Select student --</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.display_name || s.username}</option>)}
          </select>
        </div>
        <Button onClick={loadReport} disabled={!selectedStudent || loading}>
          {loading ? "Loading..." : "Generate Report"}
        </Button>
      </Card>

      {loading && <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>}

      {report && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-semibold">{report.student.display_name}</h2>
              <span className="text-sm text-gray-400">{report.student.email}</span>
            </div>
            <Button variant="secondary" onClick={() => showToast("PDF export coming soon", "info")}>
              <Download className="w-4 h-4 mr-1" /> Export PDF
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Flashcards */}
            <Card className="p-4 space-y-2">
              <p className="font-semibold text-sm text-blue-600">Flashcards</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Total assigned</span><span>{report.flashcards.total}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Mastered</span><span className="text-green-600">{report.flashcards.mastered}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Overdue</span><span className="text-red-500">{report.flashcards.overdue}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Last review</span><span>{report.flashcards.last_review ? new Date(report.flashcards.last_review).toLocaleDateString() : "Never"}</span></div>
              </div>
            </Card>

            {/* Assessments */}
            <Card className="p-4 space-y-2">
              <p className="font-semibold text-sm text-purple-600">Assessments</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Total attempts</span><span>{report.assessments.total_attempts}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Avg score</span><span>{report.assessments.avg_score ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Correct answers</span><span className="text-green-600">{report.assessments.correct}</span></div>
              </div>
            </Card>

            {/* Errors */}
            <Card className="p-4 space-y-2">
              <p className="font-semibold text-sm text-red-600">Error Book</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Total errors</span><span>{report.errors.total_errors}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Mastered</span><span className="text-green-600">{report.errors.mastered_errors}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Outstanding</span><span className="text-red-500">{report.errors.outstanding_errors}</span></div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
