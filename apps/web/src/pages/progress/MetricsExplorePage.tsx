import { useMemo, useState } from "react"
import { Card } from "../../components"
import { ProgressPageGuide } from "../../components/progress/ProgressPageGuide"
import { useProgressSignals } from "../../hooks/useProgressSignals"

type MetricKey = "Errors by Topic" | "Errors by Category" | "Weekly Activity"
type TableRow = { name: string; value: number }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function VisualSummary({
  rows,
  metric,
}: {
  rows: TableRow[]
  metric: MetricKey
}) {
  const max = Math.max(...rows.map((row) => row.value), 1)

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No data available for this metric.</p>
  }

  if (metric === "Weekly Activity") {
    return (
      <div className="grid grid-cols-7 gap-3">
        {rows.map((row) => (
          <div key={row.name} className="flex min-w-0 flex-col items-center gap-2">
            <div className="flex h-40 w-full items-end rounded-xl border bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900">
              <div
                className="w-full rounded-lg bg-emerald-500/85 dark:bg-emerald-400/85"
                style={{ height: `${clamp((row.value / max) * 100, row.value > 0 ? 14 : 4, 100)}%` }}
                title={`${row.name}: ${row.value}`}
              />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{row.value}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {new Date(row.name).toLocaleDateString([], { month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.slice(0, 8).map((row) => (
        <div key={row.name} className="grid grid-cols-[minmax(92px,180px)_minmax(0,1fr)_48px] items-center gap-3">
          <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100" title={row.name}>
            {row.name}
          </div>
          <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-900">
            <div
              className="h-3 rounded-full bg-emerald-500/85 dark:bg-emerald-400/85"
              style={{ width: `${clamp((row.value / max) * 100, 0, 100)}%` }}
            />
          </div>
          <div className="text-right text-sm font-semibold text-gray-900 dark:text-gray-100">{row.value}</div>
        </div>
      ))}
    </div>
  )
}

export function MetricsExplorePage() {
  const { loading, patterns } = useProgressSignals()
  const [metric, setMetric] = useState<MetricKey>("Errors by Topic")

  const rows = useMemo<TableRow[]>(() => {
    if (!patterns) return []
    if (metric === "Errors by Topic") {
      return patterns.by_topic.map((topic) => ({ name: topic.topic, value: topic.count }))
    }
    if (metric === "Errors by Category") {
      return patterns.by_category.map((category) => ({
        name: category.category_label || category.error_category,
        value: category.count,
      }))
    }
    return [...patterns.weekly].slice(-7).map((entry) => ({ name: entry.day, value: entry.count }))
  }, [patterns, metric])

  const valueLabel = metric === "Weekly Activity" ? "Count" : "Errors"
  const total = useMemo(() => rows.reduce((sum, row) => sum + row.value, 0), [rows])
  const topRow = rows[0] ?? null
  const average = rows.length > 0 ? Math.round((total / rows.length) * 10) / 10 : 0

  const guide = useMemo(() => {
    if (metric === "Errors by Topic") {
      return {
        title: "Use this page to decide which topic deserves your next study block.",
        description: "Topic view turns the raw pattern data into a ranked priority list.",
        steps: [
          "Pick topic view when you want to know where mistakes cluster most often.",
          "Use the visual summary to spot the dominant weak area fast.",
          "Read the breakdown table when you want exact counts."
        ]
      }
    }

    if (metric === "Errors by Category") {
      return {
        title: "Use this page to understand what kind of mistakes keep happening.",
        description: "Category view is better when the issue is not the topic itself, but the type of error you repeat.",
        steps: [
          "Switch here when you want to see concept, calculation, or procedural patterns.",
          "Read the highlights first to find the dominant mistake type.",
          "Use the table to confirm whether the problem is isolated or repeated."
        ]
      }
    }

    return {
      title: "Use this page to judge whether your study activity has been steady or patchy.",
      description: "Weekly activity is a pace check. It tells you whether review happened consistently, not whether the outcome was good.",
      steps: [
        "Pick weekly activity when you want to see rhythm, not topic detail.",
        "Use the bar chart to spot gaps or spikes in review volume.",
        "Compare the busiest day and average count to decide if momentum is stable."
      ]
    }
  }, [metric])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Explore metrics</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Inspect backend pattern data by topic, category, or recent weekly activity.
        </p>
      </div>

      <ProgressPageGuide
        title={guide.title}
        description={guide.description}
        steps={guide.steps}
      />

      <Card title="Controls" subtitle="Choose what to measure.">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Metric</div>
            <select
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950"
              value={metric}
              onChange={(event) => setMetric(event.target.value as MetricKey)}
            >
              {(["Errors by Topic", "Errors by Category", "Weekly Activity"] as MetricKey[]).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm text-gray-500 dark:text-gray-400">
          Loading metrics...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
            <Card title="Visual summary" subtitle={`Readable view for: ${metric}`}>
              <VisualSummary rows={rows} metric={metric} />
            </Card>

            <Card title="Highlights" subtitle="Quick interpretation of the current selection.">
              <div className="space-y-3">
                <div className="rounded-xl border bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Top item</p>
                  <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {topRow?.name || "No data"}
                  </p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {topRow ? `${topRow.value} ${valueLabel.toLowerCase()}` : "Nothing has been recorded yet."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-xl border bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{total}</p>
                  </div>
                  <div className="rounded-xl border bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Average per row</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{average}</p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {metric === "Weekly Activity"
                    ? "Use this to judge consistency. Large gaps mean your review rhythm is unstable."
                    : "Use this to decide where investigation or remediation should start first."}
                </p>
              </div>
            </Card>
          </div>

          <Card title="Breakdown table" subtitle={`Exact rows for: ${metric}`}>
            <div className="overflow-x-auto rounded-xl border dark:border-gray-800">
              <table className="min-w-[480px] w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">{valueLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name} className="border-t dark:border-gray-800">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.value}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr className="border-t dark:border-gray-800">
                      <td colSpan={2} className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                        No data to display.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
