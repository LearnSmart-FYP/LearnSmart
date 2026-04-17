import { useEffect, useState, useMemo, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Card, Button } from "../../components"
import { EditableNoteModal } from "../../components/shared/EditableNoteModal"
import * as api from "../../api/playGame"
import type { LearnLaterListDTO } from "../../types/game.dto"

export function ScriptLearningPage() {
  const [learnLater, setLearnLater] = useState<LearnLaterListDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'learned'>('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'name-asc' | 'name-desc'>('recent')
  const [selectedNote, setSelectedNote] = useState<{title: string, content: string, knowledgeId?: string, scriptId?: string} | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const searchParams = new URLSearchParams(location.search)
  const scriptIdFromQuery = searchParams.get('scriptId')
  const highlightedKnowledgeIdFromQuery = searchParams.get('knowledgeId')
  const scriptIdToFilter = (location.state as any)?.scriptId || scriptIdFromQuery
  const highlightedKnowledgeId = (location.state as any)?.knowledgeId || highlightedKnowledgeIdFromQuery
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
   
  const scriptTitle = (location.state as any)?.scriptTitle

  useEffect(() => {
    const fetchList = async () => {
      try {
        const data = await api.getLearnLaterList(scriptIdToFilter)
        setLearnLater(data)
      } catch (err) {
        console.error("Failed to load learn later list", err)
      } finally {
        setLoading(false)
      }
    }
    fetchList()
  }, [scriptIdToFilter])

  useEffect(() => {
    if (!highlightedKnowledgeId || !learnLater?.items?.length) return
    const element = itemRefs.current[highlightedKnowledgeId]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedKnowledgeId, learnLater])
 
  const items = useMemo(() => {
    if (!learnLater?.items) return []
    const search = searchTerm.trim().toLowerCase()
    const filtered = learnLater.items.filter(item => {
      const candidateFields = [
        item.name,
        item.description,
        item.scriptTitle ?? '',
        item.moduleName ?? '',
        item.subject_code ?? '',
        (item as any).documentName ?? ''
      ]
      return (filter === 'learned' ? item.isLearned : !item.isLearned)
        && (!search || candidateFields.some(field => field?.toLowerCase().includes(search)))
    })
    const sorted = filtered.sort((a, b) => {
      if (sortOrder === 'recent') return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      if (sortOrder === 'oldest') return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
      if (sortOrder === 'name-asc') return a.name.localeCompare(b.name)
      if (sortOrder === 'name-desc') return b.name.localeCompare(a.name)
      return 0
    })
    return sorted
  }, [learnLater, filter, searchTerm, sortOrder])

  // Group items by documentName + scriptTitle
  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof items> = {}
    items.forEach(item => {
      const moduleName = item.moduleName || item.scriptTitle || 'Unknown Script'
      const documentName = (item as any).documentName || (item as any).document || ''
      const subjectCode = item.subject_code?.trim()
      const title = documentName ? `${subjectCode ? `${subjectCode} - ` : ''}${documentName} - ${moduleName}` : (subjectCode ? `${subjectCode} - ${moduleName}` : moduleName)
      if (!groups[title]) {
        groups[title] = []
      }
      groups[title].push(item)
    })
    return groups
  }, [items])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500 animate-pulse">Loading your learning list...</div>
      </div>
    )
  }

  const handleMarkLearned = async (e: React.MouseEvent, knowledgeId: string, scriptId: string) => {
    e.stopPropagation()
    try {
      await api.markAsMastered({ knowledgeId, scriptId })
      const data = await api.getLearnLaterList(scriptIdToFilter)
      setLearnLater(data)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20 mt-4 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {scriptTitle ? `${scriptTitle} - Learn Later` : 'Learn More List'}
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {scriptTitle 
              ? 'Review the concepts, clues, and questions you saved from this script.' 
              : 'Review the concepts, clues, and questions you saved during gameplay.'}
          </p>
        </div>
        
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button 
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${filter === 'pending' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            onClick={() => setFilter('pending')}
          >
            To Learn ({(learnLater?.items || []).filter(i => !i.isLearned).length})
          </button>
          <button 
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${filter === 'learned' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            onClick={() => setFilter('learned')}
          >
            Learned ({(learnLater?.items || []).filter(i => i.isLearned).length})
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by concept, description, script title, module, subject code, or document name..."
          className="w-full md:max-w-xl rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/40"
        />
        <div className="flex items-center gap-2">
          <label htmlFor="sortOrder" className="text-sm text-gray-500 dark:text-gray-400">Sort:</label>
          <select
            id="sortOrder"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/40"
          >
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="text-4xl mb-4">📚</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {filter === 'pending' ? "You're all caught up!" : "No learned items yet"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {filter === 'pending' 
              ? "Your to-learn list is empty. Play some games and save concepts to review them here when you miss questions or want to dive deeper!"
              : "Items you mark as learned will appear here"}
          </p>
          {filter === 'pending' && (
            <Button variant="primary" className="mt-6" onClick={() => navigate("/game/my-scripts")}>
              Play Script Kill
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([title, items]) => (
            <div key={title} className="mb-8">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 mb-4 pb-2">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
                <Button 
                  variant="primary" 
                  className="text-sm px-4 py-1.5 shadow-sm"
                  onClick={() => navigate(`/game/play?scriptId=${items[0].scriptId}`, { state: { scriptId: items[0].scriptId } })}
                >
                  ▶ PLAY
                </Button>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
                 {items.map((item, index) => {
                   const isHighlighted = item.knowledgeId && item.knowledgeId === highlightedKnowledgeId
                    return (
                  <div
                    key={index}
                    ref={(el) => { if (item.knowledgeId) itemRefs.current[item.knowledgeId] = el }}
                    className={`relative h-full rounded-[1.5rem] transition duration-300 ${isHighlighted ? 'bg-amber-50/80 dark:bg-amber-500/10 shadow-[0_24px_60px_-40px_rgba(245,158,11,0.35)]' : ''}`}
                   >
                   <Card 
                     className={`h-full flex flex-col justify-between p-5 transition-all duration-300 cursor-pointer ${item.isLearned ? 'opacity-75' : 'hover:shadow-lg'} ${isHighlighted ? 'border-2 border-amber-300/80 bg-white dark:bg-slate-950 shadow-amber-300/20' : ''}`}
                       onClick={() => navigate(`/game/learn-more?id=${item.knowledgeId}`, { state: { isInLearnLater: true, scriptId: item.scriptId } })}
                   >
                     {isHighlighted && (
                       <span className="absolute right-4 top-4 z-10 inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-300/50 backdrop-blur-sm dark:bg-amber-300/10 dark:text-amber-200">
                         Current focus
                       </span>
                     )}
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          item.triggerType === 'question' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                          item.triggerType === 'clue' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {item.triggerType === 'question' ? 'Missed Question' : 
                           item.triggerType === 'clue' ? 'Saved from Clue' : 'Saved Manually'}
                        </span>
                        
                        <span className="text-xs text-gray-400">
                          {new Date(item.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
                        {item.name}
                      </h3>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
                        {item.description}
                      </p>

                      {item.triggerType === 'question' && item.triggerInfo?.wrongAnswer && (
                        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm dark:bg-red-900/20 border border-red-100 dark:border-red-900/30">
                          <div className="font-semibold text-red-800 dark:text-red-200 mb-1">You answered:</div>
                          <div className="text-red-600 dark:text-red-300 line-clamp-2">{item.triggerInfo.wrongAnswer}</div>
                        </div>
                      )}
                      
                      {item.triggerType === 'question' && item.triggerInfo?.questionContent && (
                        <div className="mb-4 text-xs bg-gray-50 dark:bg-gray-800/50 p-2 rounded text-gray-600 dark:text-gray-400 line-clamp-2 italic">
                          Q: {item.triggerInfo.questionContent}
                        </div>
                      )}

                      {item.triggerType === 'clue' && item.triggerInfo?.clueName && (
                        <div className="mb-4 text-xs bg-gray-50 dark:bg-gray-800/50 p-2 rounded text-gray-600 dark:text-gray-400 line-clamp-1 italic">
                          Clue: {item.triggerInfo.clueName}
                        </div>
                      )}

                      {item.personalNotes && (
                        <div className="mb-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.personalNotes) {
                                setSelectedNote({ title: item.name, content: item.personalNotes, knowledgeId: item.knowledgeId, scriptId: item.scriptId });
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            <span className="text-base leading-none">📝</span>
                            View My Notes
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                      {!item.isLearned && (
                        <Button
                          variant="secondary"
                          className="flex-1 text-sm bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-none dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40"
                          onClick={(e) => handleMarkLearned(e, item.knowledgeId, item.scriptId)}
                        >
                          ✓ Learned it!
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        className={`text-sm ${item.isLearned ? 'w-full' : 'flex-1'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/game/learn-more?id=${item.knowledgeId}`, { state: { isInLearnLater: true, scriptId: item.scriptId } })
                        }}
                      >
                        Learn More →
                      </Button>
                    </div>
                   </Card>
                  </div>
                 )})}
               </div>
            </div>
          ))}
        </div>
      )}

      <EditableNoteModal
        isOpen={!!selectedNote}
        onClose={() => setSelectedNote(null)}
        title={`My Notes: ${selectedNote?.title}`}
        initialContent={selectedNote?.content}
        onSave={async (newContent) => {
          if (selectedNote?.knowledgeId && selectedNote?.scriptId) {
            try {
              await api.updateLearningProgress({
                knowledgeId: selectedNote.knowledgeId,
                scriptId: selectedNote.scriptId,
                personalNotes: newContent,
              });
              
              // Optimistically update the list without requiring a manual refresh
              setLearnLater(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  items: prev.items.map(item => 
                    item.knowledgeId === selectedNote.knowledgeId && item.scriptId === selectedNote.scriptId
                      ? { ...item, personalNotes: newContent }
                      : item
                  )
                };
              });

              setSelectedNote({ ...selectedNote, content: newContent });
            } catch (err) {
              console.error("Failed to update personal note:", err);
            }
          }
        }}
      />
    </div>
  )
}
