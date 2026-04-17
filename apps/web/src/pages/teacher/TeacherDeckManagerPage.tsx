import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { Layers, Plus, Archive, Edit2, Trash2, Search, RefreshCw } from "lucide-react"

type Deck = {
  id: string
  name: string
  card_type: string
  is_archived: boolean
  created_at: string
  source_type: string
  review_count: number
  tags: string[]
}

export function TeacherDeckManagerPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ decks: Deck[] }>("/api/teacher/decks")
      setDecks(res.decks)
    } catch {
      showToast("Failed to load decks", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const archiveDeck = async (id: string) => {
    try {
      await apiClient.delete(`/api/teacher/decks/${id}`)
      showToast("Card archived", "success")
      load()
    } catch {
      showToast("Failed to archive", "error")
    }
  }

  const filtered = decks.filter(d =>
    (showArchived || !d.is_archived) &&
    d.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Deck Manager</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowArchived(v => !v)}>
            <Archive className="w-4 h-4 mr-1" />
            {showArchived ? "Hide Archived" : "Show Archived"}
          </Button>
          <Button onClick={() => navigate("/classroom/decks/create")}>
            <Plus className="w-4 h-4 mr-1" /> New Card
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
          placeholder="Search cards..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">No cards found.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(deck => (
            <Card key={deck.id} className={`p-4 space-y-2 ${deck.is_archived ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between">
                <p className="font-medium text-sm line-clamp-2">{deck.name}</p>
                <div className="flex gap-1 ml-2 shrink-0">
                  <button
                    onClick={() => navigate(`/classroom/decks/${deck.id}/edit`)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button
                    onClick={() => archiveDeck(deck.id)}
                    className="p-1 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {(deck.tags || []).slice(0, 3).map(t => (
                  <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{t}</span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{deck.card_type}</span>
                <span>{deck.review_count} reviews</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
