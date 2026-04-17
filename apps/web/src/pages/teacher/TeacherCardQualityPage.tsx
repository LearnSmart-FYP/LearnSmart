import { useEffect, useState, useCallback } from "react"
import { Card } from "../../components/ui/Card"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { AlertTriangle, RefreshCw, TrendingDown } from "lucide-react"

type ProblemCard = {
  id: string
  front_content: string
  back_content: string
  total_reviews: number
  again_count: number
  again_rate_pct: number
  avg_time_seconds: number
}

export function TeacherCardQualityPage() {
  const { showToast } = useToast()
  const [cards, setCards] = useState<ProblemCard[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ problem_cards: ProblemCard[] }>("/api/teacher/decks/quality-report")
      setCards(res.problem_cards)
    } catch {
      showToast("Failed to load quality report", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const getRateColor = (rate: number) => {
    if (rate >= 60) return "text-red-600 bg-red-50"
    if (rate >= 30) return "text-yellow-600 bg-yellow-50"
    return "text-green-600 bg-green-50"
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <TrendingDown className="w-6 h-6 text-red-500" />
        <h1 className="text-2xl font-bold">Card Quality Report</h1>
      </div>
      <p className="text-sm text-gray-500">Cards sorted by student failure rate (highest first). These cards may need editing or better hints.</p>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : cards.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No review data yet. Assign cards to students first.
        </Card>
      ) : (
        <div className="space-y-3">
          {cards.map(card => (
            <Card key={card.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm line-clamp-2">{card.front_content}</p>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-1">{card.back_content}</p>
                </div>
                <div className="flex gap-3 shrink-0 text-center">
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${getRateColor(card.again_rate_pct)}`}>
                    <p className="text-lg leading-none">{card.again_rate_pct}%</p>
                    <p className="text-xs font-normal">Again rate</p>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-gray-50 text-center text-sm">
                    <p className="text-lg leading-none font-semibold">{card.total_reviews}</p>
                    <p className="text-xs text-gray-500">Reviews</p>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-gray-50 text-center text-sm">
                    <p className="text-lg leading-none font-semibold">{card.avg_time_seconds}s</p>
                    <p className="text-xs text-gray-500">Avg time</p>
                  </div>
                </div>
              </div>
              {card.again_rate_pct >= 50 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Consider adding a clearer hint or editing the back content.
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
