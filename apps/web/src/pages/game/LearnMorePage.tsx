import { normalizeChunkText } from "../../lib/text"
import { useEffect, useState, useRef, useCallback } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { Card, Button } from "../../components"
import { ChunkCard } from "../../components/game/ChunkCard"
import { AITutorPanel } from "../../components/game/AITutorPanel"
import { LearningProgressPanel } from "../../components/game/LearningProgressPanel"
import * as api from "../../api/playGame"
import type { KnowledgeDTO, UpdateLearningProgressRequestDTO } from "../../types/game.dto"

export function LearnMorePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const knowledgeId = searchParams.get('id')
  const scriptIdFromQuery = searchParams.get('scriptId')
  
  const [knowledge, setKnowledge] = useState<KnowledgeDTO | null>(
    (location.state as { knowledge?: KnowledgeDTO })?.knowledge || null
  )
  const [loading, setLoading] = useState(!knowledge)
  const [error, setError] = useState<string | null>(null)
  
  // Learning progress states
  const [quizAttempts, setQuizAttempts] = useState(0)
  const [quizPassed, setQuizPassed] = useState(false)
  const [aiContentViewed, setAiContentViewed] = useState<Record<string, boolean>>({})
  const [masteryLevel, setMasteryLevel] = useState<'unfamiliar' | 'familiar' | 'proficient' | 'mastered'>('unfamiliar')
  const [notes, setNotes] = useState('')
  const [timeSpentMinutes, setTimeSpentMinutes] = useState(0)

  // Status states
  const [isInLearnLater, setIsInLearnLater] = useState(
    (location.state as { isInLearnLater?: boolean })?.isInLearnLater || false
  )
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const scriptIdFromState = (location.state as { scriptId?: string })?.scriptId
  const scriptId = scriptIdFromState || scriptIdFromQuery || knowledge?.scriptId || ''
  const resolvedScriptId = scriptId || undefined

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const accumulatedTimeRef = useRef(0)
  // const aiPanelRef = useRef<HTMLDivElement | null>(null)

  const learningStepComplete = {
    reviewedCore: !!knowledge,
    generatedAI: Object.keys(aiContentViewed).length > 0,
    quizPassed: quizPassed
  }

  const learningProgressPercent = Math.round(
    (Number(learningStepComplete.reviewedCore) + Number(learningStepComplete.generatedAI) + Number(learningStepComplete.quizPassed)) / 3 * 100
  )

  const [hasFetchedChunks, setHasFetchedChunks] = useState(false)

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 2800)
    return () => clearTimeout(timer)
  }, [feedback])

  // Fetch logic
  useEffect(() => {
    const loadKnowledge = async () => {
      if (hasFetchedChunks) return;
      let currentKnowledge = knowledge
      if (!currentKnowledge && knowledgeId) {
        try {
          if (scriptIdFromState) {
            const scriptData = await api.getScript(scriptIdFromState)
            const foundKnowledge = scriptData.knowledgeBase.find(k => k.knowledgeId === knowledgeId)
            if (!foundKnowledge) throw new Error("Knowledge not found")
            currentKnowledge = { ...foundKnowledge, scriptId: scriptIdFromState }
            if (scriptData.documentHash) {
              const chunks = await api.getParsedDocumentChunks(scriptData.documentHash)
              const matchedChunks = chunks.filter(c => c.mainConcepts?.includes(currentKnowledge!.name) || c.secondaryConcepts?.includes(currentKnowledge!.name))
              if (matchedChunks.length > 0) currentKnowledge.relatedChunksText = matchedChunks.map(c => normalizeChunkText(c.text))
            }
          } else {
            currentKnowledge = await api.getKnowledge(knowledgeId)
          }
          setKnowledge(currentKnowledge)
        } catch (fetchError) {
          setError(`Failed to load knowledge details. ${fetchError instanceof Error ? fetchError.message : ''}`)
          setLoading(false)
          return
        }
      } else if (!knowledgeId && !currentKnowledge) {
        setError("No knowledge ID provided.")
        setLoading(false)
        return
      }
      setHasFetchedChunks(true)
      setLoading(false)
    }
    loadKnowledge()
  }, [knowledgeId, knowledge, hasFetchedChunks, scriptIdFromState])

  useEffect(() => {
    if (!resolvedScriptId) {
      setError('Missing scriptId for Learn More tracking.')
      setLoading(false)
      return
    }

    const loadProgress = async () => {
      if (!knowledgeId) return
      try {
        const progress = await api.getLearningProgress(knowledgeId, resolvedScriptId)
        setQuizAttempts(progress.quizAttempts || 0)
        setQuizPassed(Boolean(progress.quizPassedAt))
        setAiContentViewed(progress.aiContentViewed || {})
        setMasteryLevel(progress.masteryLevel || 'unfamiliar')
        setNotes(progress.personalNotes || '')
        setTimeSpentMinutes(progress.timeSpentMinutes || 0)
      } catch (err) {
        console.log('Learning progress not found for first visit', err)
      }
    }
    loadProgress()
  }, [knowledgeId, resolvedScriptId])

  const updateProgressAsync = useCallback(async (updates: Partial<UpdateLearningProgressRequestDTO>) => {
    if (!knowledgeId || !resolvedScriptId) return
    try {
      await api.updateLearningProgress({
        knowledgeId,
        scriptId: resolvedScriptId,
        ...updates
      })
    } catch (err) {
      console.error('Failed to update progress:', err)
      setFeedback({ message: 'Failed to save your notes, please try again.', type: 'error' })
    }
  }, [knowledgeId, resolvedScriptId])

  // Timer
  useEffect(() => {
    if (!knowledgeId) return
    timerIntervalRef.current = setInterval(() => {
      accumulatedTimeRef.current += 1
      setTimeSpentMinutes(prev => prev + 1)
      if (accumulatedTimeRef.current % 5 === 0) {
        updateProgressAsync({ timeSpentMinutes: accumulatedTimeRef.current })
      }
    }, 60000)
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (accumulatedTimeRef.current > 0) {
        updateProgressAsync({ timeSpentMinutes: accumulatedTimeRef.current })
      }
    }
  }, [knowledgeId, updateProgressAsync])

  const handleMarkAsLearned = async () => {
    if (!knowledge) return
    try {
      await api.markAsMastered({ knowledgeId: knowledge.knowledgeId, scriptId: knowledge.scriptId })
      setIsInLearnLater(false)
      setMasteryLevel('mastered')
      setFeedback({ message: 'Great job! Marked as learned.', type: 'success' })
      updateProgressAsync({ masteryLevel: 'mastered', quizPassed: true })
    } catch {
      setFeedback({ message: 'Failed to update status', type: 'error' })
    }
  }

  const handleAddToLearnLater = async () => {
    if (!knowledge) return
    try {
      await api.addToLearnLater({
        knowledgeId: knowledge.knowledgeId,
        scriptId: knowledge.scriptId,
        triggerType: 'manual',
        triggerId: 'custom-learn-more'
      })
      setIsInLearnLater(true)
      setFeedback({ message: 'Added to learn later list!', type: 'success' })
    } catch {
      setFeedback({ message: 'Failed to add to list', type: 'error' })
    }
  }

  const handleScrollToAITutor = () => {
    navigate('/game/my-scripts')
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 flex items-center justify-center">
      <div className="space-y-2 text-center">
        <div className="h-4 w-48 bg-gray-300 animate-pulse rounded" />
        <div className="h-4 w-32 bg-gray-300 animate-pulse rounded" />
        <div className="h-4 w-24 bg-gray-300 animate-pulse rounded" />
      </div>
    </div>
  )

  if (error || !knowledge) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Oops! Something went wrong</h2>
        <p className="text-sm text-gray-500 dark:text-gray-300 mb-6">{error || 'Knowledge content is not available right now.'}</p>
        <Button variant="primary" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 pb-16 relative">
      {feedback && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] transition-all duration-300 shadow-xl rounded-full"
             role="status" aria-live="polite">
          <div className={`px-6 py-3 rounded-full text-sm font-semibold border ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            {feedback.message}
          </div>
        </div>
      )}

      {/* Top Nav */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-gray-900/80 backdrop-blur-md border-b border-slate-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white">← Back</button>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight text-gray-900 dark:text-white truncate max-w-xs">{knowledge.name}</h1>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isInLearnLater ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-800'}`}>{isInLearnLater ? 'In Learn Later List' : 'Active Learning'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleScrollToAITutor}>⬅ Back to My Scripts</Button>
            {isInLearnLater ? (
              <Button variant="secondary" onClick={handleMarkAsLearned}>✅ Mark as Learned</Button>
            ) : (
              <Button variant="secondary" onClick={handleAddToLearnLater}>📌 Add to Learn Later</Button>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-3">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${learningProgressPercent}%` }}
            />
          </div>
          <div className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Progress: {learningProgressPercent}% complete</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Mastery: {masteryLevel} · {timeSpentMinutes} min studied</div>
          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
            <span className={learningStepComplete.reviewedCore ? 'text-emerald-700 font-semibold' : 'text-gray-500'}>1. Core</span>
            <span className={learningStepComplete.generatedAI ? 'text-emerald-700 font-semibold' : 'text-gray-500'}>2. AI</span>
            <span className={learningStepComplete.quizPassed ? 'text-emerald-700 font-semibold' : 'text-gray-500'}>3. Quiz</span>
          </div>
        </div>

      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
          {/* Left Column: AI Tutor and Progress (Primary) */}
          <div className="space-y-6">
            <AITutorPanel 
              knowledgeId={knowledge.knowledgeId}
              scriptId={knowledge.scriptId}
              knowledgeName={knowledge.name}
              contextChunks={knowledge.relatedChunksText || []}
              onInteractionUpdate={(type) => {
                if (type === 'AI_INTERACTED' && !learningStepComplete.generatedAI) {
                  const next = { ...aiContentViewed, chatted: true }
                  setAiContentViewed(next)
                  updateProgressAsync({ aiContentViewed: next })
                } else if (type === 'QUIZ_PASSED') {
                  setQuizPassed(true)
                  setQuizAttempts(prev => prev + 1)
                  setMasteryLevel('familiar')
                  updateProgressAsync({ quizPassed: true, quizAttempts: quizAttempts + 1, masteryLevel: 'familiar' })
                }
              }}
            />

            <LearningProgressPanel 
              knowledgeId={knowledge.knowledgeId}
              scriptId={resolvedScriptId}
              learningStepComplete={learningStepComplete}
              notesInit={notes}
              onProgressUpdate={(val) => setNotes(val)}
            />
          </div>

          {/* Right Column: Core knowledge and document excerpts (Secondary) */}
          <div className="space-y-6">
            <Card title="📚 Core knowledge" className="bg-amber-50/70 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-700">
              <div className="prose prose-base text-slate-800 dark:text-slate-100 max-w-none">
                {knowledge.description.split(/\n\s*\n/).map((para, i) => (
                  <p key={i} className="mb-4 leading-7">{para.trim()}</p>
                ))}
              </div>
            </Card>

            {knowledge.relatedChunksText && knowledge.relatedChunksText.length > 0 && (
              <Card title="📄 Origin Context (Document Excerpts)" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                <div className="space-y-4">
                  {knowledge.relatedChunksText.map((chunkText, idx) => (
                    <ChunkCard 
                      key={idx}
                      chunk={{ id: String(idx), text: normalizeChunkText(chunkText), mainConcepts: [], secondaryConcepts: [], summary: "", sectionTitle: `Excerpt ${idx + 1}` }}
                      showFullText={false}
                    />
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default LearnMorePage
