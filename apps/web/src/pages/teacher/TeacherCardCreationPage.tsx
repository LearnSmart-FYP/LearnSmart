import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { BookOpen, Sparkles, Save } from "lucide-react"

type CardType = "standard" | "mcq" | "fill_blank" | "true_false"

export function TeacherCardCreationPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [cardType, setCardType] = useState<CardType>("standard")
  const [front, setFront] = useState("")
  const [back, setBack] = useState("")
  const [tips, setTips] = useState("")
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!front.trim() || !back.trim()) {
      showToast("Front and back content are required", "error")
      return
    }
    setSaving(true)
    try {
      await apiClient.post("/api/teacher/decks", {
        front_content: front,
        back_content: back,
        card_type: cardType,
        tips: tips ? tips.split("\n").filter(Boolean) : [],
        metadata: { difficulty },
      })
      showToast("Card created successfully", "success")
      navigate("/classroom/classes")
    } catch {
      showToast("Failed to create card", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-blue-500" />
        <h1 className="text-2xl font-bold">Create Card</h1>
      </div>

      <Card className="p-4 space-y-4">
        {/* Card Type */}
        <div>
          <label className="block text-sm font-medium mb-1">Card Type</label>
          <div className="flex gap-2 flex-wrap">
            {(["standard", "mcq", "fill_blank", "true_false"] as CardType[]).map(t => (
              <button
                key={t}
                onClick={() => setCardType(t)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  cardType === t
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        {/* Front */}
        <div>
          <label className="block text-sm font-medium mb-1">Front (Question)</label>
          <textarea
            rows={3}
            className="w-full border rounded-lg p-2 text-sm"
            placeholder="Enter the question or prompt..."
            value={front}
            onChange={e => setFront(e.target.value)}
          />
        </div>

        {/* Back */}
        <div>
          <label className="block text-sm font-medium mb-1">Back (Answer)</label>
          <textarea
            rows={3}
            className="w-full border rounded-lg p-2 text-sm"
            placeholder="Enter the answer or explanation..."
            value={back}
            onChange={e => setBack(e.target.value)}
          />
        </div>

        {/* Tips */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Hints / Tips <span className="text-gray-400 font-normal">(one per line)</span>
          </label>
          <textarea
            rows={2}
            className="w-full border rounded-lg p-2 text-sm"
            placeholder="Add hints shown to struggling students..."
            value={tips}
            onChange={e => setTips(e.target.value)}
          />
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-medium mb-1">Difficulty</label>
          <div className="flex gap-2">
            {(["Easy", "Medium", "Hard"] as const).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  difficulty === d
                    ? d === "Easy" ? "bg-green-600 text-white border-green-600"
                      : d === "Medium" ? "bg-yellow-500 text-white border-yellow-500"
                      : "bg-red-600 text-white border-red-600"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate("/classroom/classes")}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1" />
          {saving ? "Saving..." : "Save Card"}
        </Button>
      </div>
    </div>
  )
}
