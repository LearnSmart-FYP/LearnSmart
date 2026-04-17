import { useMemo, useState } from "react"
import { Button, Card } from "../../components"
import { ProgressPageGuide } from "../../components/progress/ProgressPageGuide"
import { callAiJson } from "../../lib/aiCall"
import { useProgressSignals } from "../../hooks/useProgressSignals"

type CoverageLevel = "High" | "Medium" | "Low"

type GapRow = {
  skill: string
  coverageLevel: CoverageLevel
  coveragePct: number
  masteredCount: number
  totalCount: number
  evidence: string
}

type GapAnalysisResult = {
  summary: string
  priority_topics: string[]
  study_actions: string[]
  confidence: string
}

function coverageLevelFromPct(pct: number): CoverageLevel {
  if (pct >= 70) return "High"
  if (pct >= 40) return "Medium"
  return "Low"
}

function coverageBadgeClass(level: CoverageLevel): string {
  if (level === "High") return "text-green-700 dark:text-green-400"
  if (level === "Medium") return "text-yellow-700 dark:text-yellow-400"
  return "text-red-700 dark:text-red-400"
}

function buildGapPrompt(threshold: number, rows: GapRow[]) {
  return [
    "You are an expert learning coach.",
    "Return JSON with `summary`, `priority_topics`, `study_actions`, and `confidence`.",
    "Focus on remediation steps grounded in the supplied gap analysis.",
    "Do not include markdown fences.",
    "",
    `Coverage alert threshold: ${threshold}%`,
    "Gap rows:",
    JSON.stringify(rows, null, 2)
  ].join("\n")
}

export function GapAnalysisPage() {
  const { loading, patterns, allErrors } = useProgressSignals()
  const [threshold, setThreshold] = useState<number>(60)
  const [isGenerating, setIsGenerating] = useState(false)
  const [analysis, setAnalysis] = useState<GapAnalysisResult | null>(null)

  const gapRows = useMemo<GapRow[]>(() => {
    if (!patterns) return []

    return patterns.by_topic
      .map((topicEntry) => {
        const total = topicEntry.count
        const mastered = allErrors.filter(
          (error) => error.topic === topicEntry.topic && error.is_mastered
        ).length
        const pct = total > 0 ? Math.round((mastered / total) * 100) : 0
        const level = coverageLevelFromPct(pct)
        const evidence = `${mastered} of ${total} error${total !== 1 ? "s" : ""} mastered (${pct}%).`
        return {
          skill: topicEntry.topic,
          coverageLevel: level,
          coveragePct: pct,
          masteredCount: mastered,
          totalCount: total,
          evidence
        }
      })
      .filter((row) => row.coveragePct < threshold)
      .sort((a, b) => a.coveragePct - b.coveragePct)
  }, [patterns, allErrors, threshold])

  const generateAnalysis = async () => {
    if (gapRows.length === 0) return

    setIsGenerating(true)
    try {
      const data = await callAiJson<Partial<GapAnalysisResult>>({
        prompt: buildGapPrompt(threshold, gapRows.slice(0, 10)),
        temperature: 0.3,
        max_tokens: 1000
      })

      setAnalysis({
        summary: data.summary?.trim() || "No summary returned.",
        priority_topics: Array.isArray(data.priority_topics)
          ? data.priority_topics.filter(Boolean).map((item) => String(item))
          : [],
        study_actions: Array.isArray(data.study_actions)
          ? data.study_actions.filter(Boolean).map((item) => String(item))
          : [],
        confidence: data.confidence?.trim() || "Not provided"
      })
    } catch (error) {
      console.error(error)
      setAnalysis(null)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gap analysis</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Identify topics where mastery falls below your selected coverage threshold.
        </p>
      </div>

      <ProgressPageGuide
        title="Use this page when you want to identify what is still weak enough to deserve remediation."
        description="This page is for ranking under-mastered topics. It is most useful after you already have enough error-book entries to show a pattern."
        steps={[
          "Set the coverage threshold to decide how strict the page should be about calling something a gap.",
          "Read the findings table first because it shows the actual weak topics and evidence.",
          "Generate the AI brief only after the weak-topic list looks correct, because the AI summary is based entirely on those rows."
        ]}
      />

      <Card title="Settings" subtitle="Adjust the coverage threshold before ranking low-mastery topics.">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Alert threshold (%)</div>
            <input
              type="number"
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950"
              value={threshold}
              onChange={(event) => setThreshold(parseInt(event.target.value || "0", 10))}
              min={0}
              max={100}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Show topics with mastery coverage below {threshold}%.
            </div>
          </label>

          <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Data source</div>
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              Coverage is computed as mastered errors divided by total logged errors per topic.
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm text-gray-500 dark:text-gray-400">
          Loading gap analysis...
        </div>
      ) : (
        <>
          <Card title="Findings" subtitle="Topics with low mastery coverage, sorted by biggest gap first.">
            <div className="overflow-x-auto rounded-xl border dark:border-gray-800">
              <table className="min-w-[560px] w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Skill / Topic</th>
                    <th className="px-4 py-3">Coverage</th>
                    <th className="px-4 py-3">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {gapRows.map((row) => (
                    <tr key={row.skill} className="border-t dark:border-gray-800">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {row.skill}
                      </td>
                      <td className={`px-4 py-3 font-medium ${coverageBadgeClass(row.coverageLevel)}`}>
                        {row.coverageLevel} ({row.coveragePct}%)
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {row.evidence}
                      </td>
                    </tr>
                  ))}
                  {gapRows.length === 0 && (
                    <tr className="border-t dark:border-gray-800">
                      <td colSpan={3} className="px-4 py-6 text-sm text-gray-600 dark:text-gray-400">
                        No gaps found. All topics meet or exceed the {threshold}% coverage threshold.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={generateAnalysis}
                disabled={gapRows.length === 0 || isGenerating}
                className="w-full sm:w-auto"
              >
                {isGenerating ? "Generating..." : "Generate AI brief"}
              </Button>
            </div>
          </Card>

          <Card title="AI remediation brief" subtitle="Generated from the live gap rows shown above.">
            {analysis ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
                  <p className="text-sm text-emerald-950 dark:text-emerald-100">{analysis.summary}</p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                      Priority topics
                    </p>
                    <div className="mt-2 space-y-2">
                      {analysis.priority_topics.length > 0 ? analysis.priority_topics.map((topic) => (
                        <div key={topic} className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                          {topic}
                        </div>
                      )) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No priority topics returned.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                      Suggested actions
                    </p>
                    <div className="mt-2 space-y-2">
                      {analysis.study_actions.length > 0 ? analysis.study_actions.map((action, index) => (
                        <div key={`${action}-${index}`} className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                          {action}
                        </div>
                      )) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No study actions returned.</p>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">Confidence: {analysis.confidence}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Generate an AI brief when you want the weakest topics turned into a remediation plan.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
