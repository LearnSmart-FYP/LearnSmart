import { useEffect, useState, useCallback } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { Send, RefreshCw, Users, Layers } from "lucide-react"

type Deck = { id: string; name: string; card_type: string }
type ClassItem = { id: string; name: string; student_count: number }

export function TeacherAssignDeckPage() {
  const { showToast } = useToast()
  const [decks, setDecks] = useState<Deck[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDeck, setSelectedDeck] = useState("")
  const [selectedClass, setSelectedClass] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [assigning, setAssigning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [decksRes, classesRes] = await Promise.all([
        apiClient.get<{ decks: Deck[] }>("/api/teacher/decks"),
        apiClient.get<{ classes: ClassItem[] }>("/api/classroom/teacher/classes"),
      ])
      setDecks(decksRes.decks.filter(d => !d.is_archived))
      setClasses(classesRes.classes)
    } catch {
      showToast("Failed to load data", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const handleAssign = async () => {
    if (!selectedDeck || !selectedClass) {
      showToast("Please select a deck and a class", "error")
      return
    }
    setAssigning(true)
    try {
      const res = await apiClient.post<{ student_count: number }>(
        `/api/teacher/decks/${selectedDeck}/assign`,
        { class_id: selectedClass, due_date: dueDate || null }
      )
      showToast(`Assigned to ${res.student_count} students`, "success")
      setSelectedDeck("")
      setSelectedClass("")
      setDueDate("")
    } catch {
      showToast("Assignment failed", "error")
    } finally {
      setAssigning(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Send className="w-6 h-6 text-blue-500" />
        <h1 className="text-2xl font-bold">Assign Deck to Class</h1>
      </div>

      <Card className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            <Layers className="w-4 h-4 inline mr-1" />Select Deck
          </label>
          <select
            className="w-full border rounded-lg p-2 text-sm"
            value={selectedDeck}
            onChange={e => setSelectedDeck(e.target.value)}
          >
            <option value="">-- Choose a deck --</option>
            {decks.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            <Users className="w-4 h-4 inline mr-1" />Select Class
          </label>
          <select
            className="w-full border rounded-lg p-2 text-sm"
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
          >
            <option value="">-- Choose a class --</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.student_count} students)</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Due Date (optional)</label>
          <input
            type="datetime-local"
            className="w-full border rounded-lg p-2 text-sm"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>

        <Button className="w-full" onClick={handleAssign} disabled={assigning}>
          <Send className="w-4 h-4 mr-1" />
          {assigning ? "Assigning..." : "Assign Deck"}
        </Button>
      </Card>
    </div>
  )
}
