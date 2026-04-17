import { useMemo, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "../../components"
import { ProgressPageGuide } from "../../components/progress/ProgressPageGuide"
import { useProgressSignals } from "../../hooks/useProgressSignals"

function StatCard({
  title,
  value,
  note,
  onClick,
}: {
  title: string
  value: string
  note: string
  onClick?: () => void
}) {
  return (
    <div
      className={[
        "rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950",
        onClick ? "cursor-pointer transition-shadow hover:shadow-md" : "",
      ].join(" ")}
      onClick={onClick}
    >
      <div className="text-xs text-gray-500 dark:text-gray-400">{title}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
        {value}
      </div>
      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{note}</div>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
      {children}
    </div>
  )
}

export function ProgressModulePage() {
  const navigate = useNavigate()
  const {
    loading,
    allErrors,
    dueErrors,
    patterns,
    flashcards,
    questionCount,
    documentsTotal,
    learningPaths,
    classes,
    masteredCount
  } = useProgressSignals()

  const flashcardsDueToday = useMemo(() => {
    const todayISO = new Date().toISOString().split("T")[0]
    return flashcards.filter((flashcard) =>
      flashcard.status === "overdue" ||
      (flashcard.next_due && flashcard.next_due.startsWith(todayISO))
    ).length
  }, [flashcards])

  const streak = useMemo(() => {
    if (!patterns?.weekly) return 0
    const countMap = new Map(patterns.weekly.map((entry) => [entry.day, entry.count]))
    let currentStreak = 0

    for (let index = 0; index < 28; index++) {
      const date = new Date()
      date.setDate(date.getDate() - index)
      const key = date.toISOString().split("T")[0]
      if ((countMap.get(key) ?? 0) > 0) {
        currentStreak += 1
      } else {
        break
      }
    }

    return currentStreak
  }, [patterns])

  const topTopic = patterns?.by_topic[0]
  const loadingValue = loading ? "—" : undefined

  const progressItems = [
    {
      title: "Analytics dashboard",
      subtitle: "Activity heatmap, error trends by topic and category.",
      href: "/progress/analytics",
    },
    {
      title: "Explore metrics",
      subtitle: "Filter and compare errors by topic, category, or week.",
      href: "/progress/explore",
    },
    {
      title: "Learning pathway",
      subtitle: "Generate an AI study plan using your real progress signals.",
      href: "/progress/pathway",
    },
    {
      title: "Group analytics",
      subtitle: "Use real class data to generate anonymized cohort summaries.",
      href: "/progress/group",
    },
    {
      title: "Gap analysis",
      subtitle: "See which topics have the lowest mastery coverage.",
      href: "/progress/gap-analysis",
    },
    {
      title: "Integrations",
      subtitle: "Inspect which backend data sources are contributing progress signals.",
      href: "/progress/integrations",
    },
  ] as const

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Progress tracking</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Backend-backed summary of review activity, assessment data, and learning context.
          </p>
        </div>
      </div>

      <ProgressPageGuide
        title="Use this page as the front door for the progress section."
        description="Start here when you are not sure where to go. The top cards tell you what kind of progress data exists, and the lower cards tell you which page to open for the job you actually want done."
        steps={[
          "Scan the summary cards first to see whether the main issue is review load, weak topics, class data, or missing inputs.",
          "Open Analytics when you want patterns, Gap Analysis when you want weak areas, Learning Pathway when you want a next-session plan, and Group Analytics when you want class-level signals.",
          "Use Integrations only when you want to verify where the numbers are coming from."
        ]}
      />

      <div className="space-y-3">
        <SectionLabel>Memorization</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Scheduled flashcards"
            value={loadingValue ?? String(flashcards.length)}
            note="Cards returned by the review schedule API"
            onClick={() => navigate("/flashcards/manage")}
          />
          <StatCard
            title="Due today"
            value={loadingValue ?? String(flashcardsDueToday)}
            note={flashcardsDueToday > 0 ? "Review queue has items waiting" : "Nothing due right now"}
            onClick={() => navigate("/flashcards/review")}
          />
          <StatCard
            title="Review streak"
            value={loadingValue ?? (streak > 0 ? `${streak} day${streak !== 1 ? "s" : ""}` : "None yet")}
            note="Derived from error-book weekly activity"
          />
          <StatCard
            title="Knowledge documents"
            value={loadingValue ?? String(documentsTotal)}
            note="Completed documents available as study context"
            onClick={() => navigate("/knowledge/document-list")}
          />
        </div>
      </div>

      <div className="space-y-3">
        <SectionLabel>Assessment</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Errors tracked"
            value={loadingValue ?? String(allErrors.length)}
            note={`${masteredCount} mastered`}
            onClick={() => navigate("/application/error-log")}
          />
          <StatCard
            title="Errors due"
            value={loadingValue ?? String(dueErrors.length)}
            note={dueErrors.length > 0 ? "Review these now" : "Nothing due"}
            onClick={() => navigate("/application/schedule-review")}
          />
          <StatCard
            title="Weakest topic"
            value={loadingValue ?? (topTopic?.topic ?? "No data")}
            note={topTopic ? `${topTopic.count} error${topTopic.count !== 1 ? "s" : ""} logged` : "No errors yet"}
            onClick={() => navigate("/progress/gap-analysis")}
          />
          <StatCard
            title="Question bank"
            value={loadingValue ?? String(questionCount)}
            note="Past paper questions currently available"
            onClick={() => navigate("/application/past-paper-import")}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Learning paths" subtitle="Saved pathway records already in the database.">
          <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {loading ? "—" : learningPaths.length}
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {learningPaths[0]?.title || "No saved learning path records yet."}
          </p>
        </Card>

        <Card title="Classes" subtitle="Available classroom groups that can feed progress context.">
          <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {loading ? "—" : classes.length}
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {classes[0]?.name || "No classroom groups returned for this account."}
          </p>
        </Card>

        <Card title="Top topic coverage" subtitle="Quick view of the topic currently generating the most logged errors.">
          <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {loading ? "—" : topTopic?.count ?? 0}
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {topTopic?.topic || "No topic pattern data yet."}
          </p>
        </Card>
      </div>

      <div className="space-y-3">
        <SectionLabel>Progress pages</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          {progressItems.map((item) => (
            <Card
              key={item.href}
              title={item.title}
              subtitle={item.subtitle}
              onClick={() => navigate(item.href)}
              className="cursor-pointer transition-shadow hover:shadow-md"
            >
              <p className="text-sm text-gray-600 dark:text-gray-400">Click the card only if this is the task you want to do next.</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
