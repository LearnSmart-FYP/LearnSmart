import { useState, useEffect } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { TextField } from "../../components/form/TextField"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { cn } from "../../../../../shared/utils"


type Student = {
  id: string
  username: string
  email: string
  display_name: string
  enrolled_at: string
  last_active?: string
  progress?: {
    completed_challenges: number
    total_points: number
  }
}

export function ManageStudentsPage() {
  const { showToast } = useToast()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadStudents()
  }, [])

  async function loadStudents() {
    setLoading(true)
    try {
      const response = await apiClient.get<{ students: Student[] }>("/api/classroom/teacher/students")
      setStudents(response.students)
    } catch (error) {
      showToast("Failed to load students")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function toggleSelectStudent(id: string) {
    setSelectedStudents(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set())
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)))
    }
  }

  const filteredStudents = students.filter(student =>
    student.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading students...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Manage Students
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View and manage your enrolled students
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {students.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Total Students
            </div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {students.filter(s => s.last_active && new Date(s.last_active) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Active (7 days)
            </div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {Math.round(students.reduce((sum, s) => sum + (s.progress?.total_points || 0), 0) / students.length) || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Avg Points
            </div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {Math.round(students.reduce((sum, s) => sum + (s.progress?.completed_challenges || 0), 0) / students.length * 10) / 10 || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Avg Challenges
            </div>
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 w-full sm:max-w-md">
            <TextField
              placeholder="Search by name, username, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => showToast("Export functionality coming soon")}
            >
              Export
            </Button>
            {selectedStudents.size > 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  showToast(`${selectedStudents.size} students selected`)
                  setSelectedStudents(new Set())
                }}
              >
                Actions ({selectedStudents.size})
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left p-3">
                  <input
                    type="checkbox"
                    checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Student
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enrolled
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Challenges
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Points
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Last Active
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr
                  key={student.id}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedStudents.has(student.id)}
                      onChange={() => toggleSelectStudent(student.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="p-3">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {student.display_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        @{student.username}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                    {student.email}
                  </td>
                  <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                    {new Date(student.enrolled_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-sm text-gray-900 dark:text-white">
                    {student.progress?.completed_challenges || 0}
                  </td>
                  <td className="p-3 text-sm font-medium text-purple-600 dark:text-purple-400">
                    {student.progress?.total_points || 0}
                  </td>
                  <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                    {student.last_active ? new Date(student.last_active).toLocaleDateString() : "Never"}
                  </td>
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      onClick={() => showToast(`Viewing details for ${student.display_name}`)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStudents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery ? "No students found matching your search" : "No students enrolled yet"}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
