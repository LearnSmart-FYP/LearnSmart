import React, { useEffect, useState } from "react"
import { Button } from "../index"
import { ChunkCard } from "./ChunkCard"
import type { ClueDTO, KnowledgeDTO } from "../../types/game.dto"

export interface ClueModalProps {
  clue: ClueDTO
  knowledgeMap: Map<string, KnowledgeDTO>
  isInLearnLater: (knowledgeId: string) => boolean
  onAddToLearnLater: (knowledgeId: string) => void
  onViewChunk: (chunkId: string) => void
  onClose: () => void
}

export const ClueModal: React.FC<ClueModalProps> = ({ 
  clue, 
  knowledgeMap,
  isInLearnLater,
  onAddToLearnLater,
  onViewChunk,
  onClose 
}) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  return (
    <div className="fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className={`bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full mx-4 border border-gray-200 dark:border-gray-700 shadow-xl transform transition-all duration-300 ease-out flex flex-col max-h-[85vh] ${
          mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
              📌 {clue.name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg font-mono text-sm mb-4">
            <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {clue.description}
            </p>
          </div>

          {/* Related Knowledge */}
          {clue.relatedKnowledge.length > 0 && (
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🔗 Related Knowledge:
              </div>
              <div className="flex flex-wrap gap-2">
                {clue.relatedKnowledge.map(kId => {
                  const knowledge = knowledgeMap.get(kId)
                  return (
                    <span
                      key={kId}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded text-xs text-indigo-700 dark:text-indigo-300"
                    >
                      {knowledge?.name || kId}
                      {isInLearnLater(kId) && <span className="text-emerald-600 dark:text-emerald-400 ml-1">✓</span>}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Related Chunks */}
          <div className="mb-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
              <span className="mr-2">📄</span> Origin Context
            </div>
            <div className="space-y-4">
              {clue.relatedChunks && clue.relatedChunks.length > 0 ? (
                clue.relatedChunks.map((chunk, idx) => (
                  <ChunkCard
                    key={chunk.id}
                    chunk={{
                      id: chunk.id,
                      text: chunk.text || "",
                      mainConcepts: [],
                      secondaryConcepts: [],
                      summary: "",
                      pageNumber: undefined,
                      sectionTitle: chunk.title || `Part ${idx + 1}`,
                    }}
                    onViewChunk={onViewChunk}
                  />
                ))
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                  No related files available
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              variant="secondary" 
              onClick={() => onAddToLearnLater(clue.relatedKnowledge[0])}
            >
              📌 Add to Learn Later
            </Button>
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}