import React, { useState, useEffect } from "react"

type Props = {
  questions?: string[]
  onSubmit: (question: string, answer: string) => Promise<void>
  onClose?: () => void
}

export function FollowupChat({ questions = [], onSubmit, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState("")
  const [history, setHistory] = useState<Array<{ sender: "ai" | "user"; text: string }>>([])

  useEffect(() => {
    // initialize AI questions into history
    setHistory(questions.map(q => ({ sender: "ai", text: q })))
    setCurrentIndex(0)
    setAnswer("")
  }, [questions.join("||")])

  const handleSubmit = async () => {
    const q = questions[currentIndex]
    if (!q || !answer.trim()) return
    // optimistic update
    setHistory(prev => [...prev, { sender: "user", text: answer.trim() }])
    const userAnswer = answer.trim()
    setAnswer("")
    try {
      await onSubmit(q, userAnswer)
      // advance to next question if present
      const nextIndex = currentIndex + 1
      if (nextIndex < questions.length) {
        setCurrentIndex(nextIndex)
      } else {
        // no more questions — optionally close
        setCurrentIndex(nextIndex)
      }
    } catch (err) {
      // on error, show a brief user-visible history entry indicating failure
      setHistory(prev => [...prev, { sender: "ai", text: "(Failed to submit answer)" }])
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Follow-up questions</h4>
        {onClose && (
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-300">Close</button>
        )}
      </div>

      <div className="max-h-60 overflow-y-auto space-y-3 pb-2">
        {history.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-300">No follow-up questions.</p>}
        {history.map((m, i) => (
          <div key={i} className={`flex ${m.sender === "ai" ? "justify-start" : "justify-end"}`}>
            <div className={`rounded-lg px-3 py-2 text-sm ${m.sender === "ai" ? "bg-gray-100 text-gray-900 dark:bg-gray-700/30 dark:text-gray-100" : "bg-purple-50 text-purple-900 dark:bg-purple-900/30 dark:text-purple-200"}`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {currentIndex < questions.length ? (
        <div className="mt-3">
          <p className="mb-2 text-xs text-gray-600 dark:text-gray-300">Question: <span className="font-medium text-gray-800 dark:text-gray-100">{questions[currentIndex]}</span></p>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Type your answer to the AI's question"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={handleSubmit} className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700">Send</button>
            {onClose && <button onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">Close</button>}
          </div>
        </div>
      ) : (
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">No more follow-up questions.</div>
      )}
    </div>
  )
}

export default FollowupChat
