import { useMemo, useState } from "react"
import { Card } from "../../components"
import { ProgressPageGuide } from "../../components/progress/ProgressPageGuide"
import { useProgressSignals } from "../../hooks/useProgressSignals"

type IntegrationRow = {
  name: string
  source: string
  status: "Available" | "No records yet"
  records: number
  detail: string
}

function StatusDot({ status }: { status: IntegrationRow["status"] }) {
  const cls = status === "Available" ? "bg-green-500" : "bg-gray-400"
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />
}

export function IntegrationsPage() {
  const {
    loading,
    allErrors,
    flashcards,
    questionCount,
    documentsTotal,
    learningPaths,
    classes
  } = useProgressSignals()

  const [includeDocuments, setIncludeDocuments] = useState(true)
  const [includeFlashcards, setIncludeFlashcards] = useState(true)
  const [includeAssessments, setIncludeAssessments] = useState(true)
  const [includeClassroom, setIncludeClassroom] = useState(true)
  const [includePathways, setIncludePathways] = useState(true)

  const integrations = useMemo<IntegrationRow[]>(() => {
    const rows: IntegrationRow[] = [
      {
        name: "Knowledge documents",
        source: "/api/documents",
        status: documentsTotal > 0 ? "Available" : "No records yet",
        records: documentsTotal,
        detail: "Completed documents that can anchor comprehension requests."
      },
      {
        name: "Flashcard schedule",
        source: "/api/flashcards/schedule",
        status: flashcards.length > 0 ? "Available" : "No records yet",
        records: flashcards.length,
        detail: "Scheduled flashcards returned by spaced-repetition tracking."
      },
      {
        name: "Assessment bank",
        source: "/api/quiz/questions",
        status: questionCount > 0 ? "Available" : "No records yet",
        records: questionCount,
        detail: "Question-bank items contributing assessment context."
      },
      {
        name: "Error book",
        source: "/api/error-book",
        status: allErrors.length > 0 ? "Available" : "No records yet",
        records: allErrors.length,
        detail: "Mistake and review records used throughout progress analysis."
      },
      {
        name: "Learning paths",
        source: "/api/learning-paths",
        status: learningPaths.length > 0 ? "Available" : "No records yet",
        records: learningPaths.length,
        detail: "Saved pathway rows currently available in the database."
      },
      {
        name: "Classroom groups",
        source: "/api/classroom/my-classes",
        status: classes.length > 0 ? "Available" : "No records yet",
        records: classes.length,
        detail: "Classes that can feed cohort and classroom progress views."
      }
    ]

    return rows.filter((row) => {
      if (row.name === "Knowledge documents") return includeDocuments
      if (row.name === "Flashcard schedule") return includeFlashcards
      if (row.name === "Assessment bank" || row.name === "Error book") return includeAssessments
      if (row.name === "Classroom groups") return includeClassroom
      if (row.name === "Learning paths") return includePathways
      return true
    })
  }, [
    documentsTotal,
    flashcards.length,
    questionCount,
    allErrors.length,
    learningPaths.length,
    classes.length,
    includeDocuments,
    includeFlashcards,
    includeAssessments,
    includeClassroom,
    includePathways
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Real backend data sources contributing to the progress module.
        </p>
      </div>

      <ProgressPageGuide
        title="Use this page when the progress screens feel empty or suspicious and you want to inspect the raw source coverage."
        description="This is a diagnostics page. It tells you which backend sources are feeding the progress section and whether those sources currently have enough records to be useful."
        steps={[
          "Toggle source groups to focus on the data family you care about.",
          "Check status and record counts to see whether a page is empty because there is no data or because a connection is failing.",
          "Use the endpoint column to trace where each progress signal is coming from."
        ]}
      />

      <Card title="Included data sources" subtitle="Choose which live sources to inspect in this view.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900">
            <input type="checkbox" checked={includeDocuments} onChange={(event) => setIncludeDocuments(event.target.checked)} />
            <span className="text-gray-700 dark:text-gray-300">Documents</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900">
            <input type="checkbox" checked={includeFlashcards} onChange={(event) => setIncludeFlashcards(event.target.checked)} />
            <span className="text-gray-700 dark:text-gray-300">Flashcards</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900">
            <input type="checkbox" checked={includeAssessments} onChange={(event) => setIncludeAssessments(event.target.checked)} />
            <span className="text-gray-700 dark:text-gray-300">Assessments</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900">
            <input type="checkbox" checked={includeClassroom} onChange={(event) => setIncludeClassroom(event.target.checked)} />
            <span className="text-gray-700 dark:text-gray-300">Classroom</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900">
            <input type="checkbox" checked={includePathways} onChange={(event) => setIncludePathways(event.target.checked)} />
            <span className="text-gray-700 dark:text-gray-300">Learning paths</span>
          </label>
        </div>
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          These rows are populated from live API reads, not seeded placeholders.
        </div>
      </Card>

      <Card title="Connections" subtitle="Current progress data sources and their record counts.">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading integrations...</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border dark:border-gray-800">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Integration</th>
                  <th className="px-4 py-3">Endpoint</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Records</th>
                  <th className="px-4 py-3">Detail</th>
                </tr>
              </thead>
              <tbody>
                {integrations.map((integration) => (
                  <tr key={integration.name} className="border-t dark:border-gray-800">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{integration.name}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{integration.source}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      <span className="inline-flex items-center gap-2">
                        <StatusDot status={integration.status} />
                        {integration.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{integration.records}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{integration.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
