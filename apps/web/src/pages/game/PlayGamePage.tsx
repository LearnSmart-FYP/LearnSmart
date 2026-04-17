import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Card, Button } from "../../components"
import { TextField } from "../../components/form/TextField"
import TextAreaField from "../../components/form/TextAreaField"
import { ClueModal } from "../../components/game/ClueModal"
import { LearnMoreModal } from "../../components/game/LearnMoreModal"
import { WrongAnswerModal } from "../../components/game/WrongAnswerModal"
import { ReportIssueModal } from "../../components/game/ReportIssueModal"
import { ChunkModal } from "../../components/game/ChunkModal"
import { EditableNoteModal } from "../../components/shared/EditableNoteModal"
import { usePlayGame } from "../../hooks/usePlayGame"
import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import * as api from "../../api/playGame"

export function PlayGamePage() {
  const {
    script,
    progress,
    learnLater,
    loading,
    error,
    saving,
    currentQuestion,
    currentScene,
    sceneClues,
    sceneCharacters,
    unlockedClues,
    caseFiles,
    sceneContext,
    currentHint,
    detectiveIsThinking,
    canSubmit,
    canNext,
    showHint,
    feedback,
    selectedClue,
    knowledgeIndex,
    showWrongModal,
    showReportModal,
    selectedNote,
    lastWrongAnswer,
    wrongAnswerRationale,
    highlightedClues,
    showAchievement,
    knowledgeMap,
    setLearnLater,
    achievedEnding,
    selectedChunk,
    setSelectedChunk,
    wrongAnswerReviewData,
    scriptId,
    currentQuestionIndex,
    selectedOption,
    freeTextAnswer,
    sequencingItems,
    isInLearnLater,
    getPersonalNote,
    getCharacterTrust,
    handleSubmit,
    handleAskDetective,
    handleShowAnswer,
    handleNext,
    handlePlayAgain,
    handlePreNode,
    handleOpenLearnMore,
    handleDragEnd,
    handleSaveProgress,
    handleResetProgress,
    handleViewLearnLater,
    handleAddToLearnLater,
    handleMarkAsLearned,
    handleLearnMorePrev,
    handleLearnMoreNext,
    handleViewChunk,
    setSelectedClue,
    setKnowledgeIndex,
    setShowWrongModal,
    setShowReportModal,
    handleReportAndSkip,
    setSelectedNote,
    setFeedback,
    setSelectedOption,
    setFreeTextAnswer
  } = usePlayGame()
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (currentQuestion?.speaker) {
      const speakerCharacter = sceneCharacters.find(char => char.name === currentQuestion.speaker)
      if (speakerCharacter) {
        setSelectedCharacterId(speakerCharacter.characterId)
      }
    }
  }, [currentQuestion, sceneCharacters])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 dark:text-gray-400 text-lg">Loading investigation...</div>
        </div>
      </div>
    )
  }
  
  if (showAchievement && script && progress) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="max-w-xl w-full p-8 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">🎉 Investigation Complete!</h2>
          {achievedEnding ? (
            <>
              <h3 className="text-xl font-semibold text-indigo-700 dark:text-indigo-200">{achievedEnding.title}</h3>
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                <div className="font-medium">Character Trust Snapshot:</div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {script.characters.map(char => (
                    <div key={char.characterId} className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800">
                      <span className="font-medium">{char.name}</span>: {getCharacterTrust(char.characterId)}%
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-gray-700 dark:text-gray-300">{achievedEnding.content}</p>
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{achievedEnding.debrief}</p>
            </>
          ) : (
            <p className="text-gray-700 dark:text-gray-300">You finished all scenes. Great work collecting clues and solving the case!</p>
          )}

          <div className="mt-6 flex gap-3">
            <Button variant="primary" onClick={() => navigate(`/game/scripts/${scriptId}/report`)}>
              View Case Report
            </Button>
            <Button variant="secondary" onClick={handlePlayAgain}>
              Play Again
            </Button>
            <Button variant="secondary" onClick={() => navigate('/game/my-scripts')}>
              Back to Scripts
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (error || !script || !progress || !currentScene) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="text-red-500 text-2xl mb-4">🔍 Case files corrupted</div>
          <div className="text-gray-600 dark:text-gray-400 mb-6">{error || 'No case data available'}</div>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 relative">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
              🔍 {script.title} · Act {currentScene.act}: {currentScene.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Scene {currentScene.order}/{script.scenes.length} · {currentScene.location}
            </p>
            {script.logline && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 italic">
                {script.logline}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleSaveProgress}
              disabled={saving}
            >
              {saving ? 'Saving...' : '⏸️ Pause'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleResetProgress}
              disabled={saving}
            >
              🔄 Restart
            </Button>
            <Button variant="secondary" onClick={() => navigate('/game/my-scripts')}>
              🏠 Exit
            </Button>
          </div>
        </div>
        
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>� Questions Answered: {progress.answeredQuestions.length}/{script.questions.length}</span>
            <span>{script.questions.length > 0 ? Math.round((progress.answeredQuestions.length / script.questions.length) * 100) : 0}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${script.questions.length > 0 ? Math.round((progress.answeredQuestions.length / script.questions.length) * 100) : 0}%` }}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6" id="question-card-container">
            <div className="relative">
              <Card title="🎯 Current Investigation">
                <div className="absolute top-4 right-4 z-10">
                  {currentQuestion && (
                    <Button
                      variant="secondary"
                      onClick={handleShowAnswer}
                      disabled={!canSubmit}
                      className="text-xs py-1 px-3 bg-amber-50 h-7 text-amber-700 hover:bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 shadow-sm"
                    >
                      👀 Show Answer
                    </Button>
                  )}
                </div>

                {currentQuestion ? (
                  <div className="space-y-4 pt-2">
                    {currentQuestion.speaker && (
                      <div className="mb-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                        <div className="font-semibold">{currentQuestion.speaker}</div>
                        {currentQuestion.speakerEmotion && (
                          <div className="text-xs italic text-indigo-500 dark:text-indigo-300">Emotion: {currentQuestion.speakerEmotion}</div>
                        )}
                        {currentQuestion.speakerDialogue && (
                          <div className="mt-1 text-xs text-indigo-800 dark:text-indigo-100">“{currentQuestion.speakerDialogue}”</div>
                        )}
                      </div>
                    )}
                    <div className="text-base font-medium text-gray-900 dark:text-gray-50 flex-1 pr-4">
                      {currentQuestion.content}
                    </div>
                    
                  {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
                    <div className="space-y-2">
                      {currentQuestion.options.map(option => (
                        <label
                          key={option.optionId}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${selectedOption === option.optionId ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/30' : 'border-gray-200 bg-white hover:border-indigo-200 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-800'}`}
                        >
                          <input
                            type="radio"
                            name="question-option"
                            className="mt-1 h-4 w-4"
                            checked={selectedOption === option.optionId}
                            onChange={() => setSelectedOption(option.optionId)}
                            disabled={!canSubmit}
                          />
                          <span className="text-gray-900 dark:text-gray-100">{option.content}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  
                  {currentQuestion.type === 'sequencing' && (
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="sequencing">
                        {(provided) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-2"
                          >
                            {sequencingItems.map((item, index) => (
                              <Draggable key={item.itemId} draggableId={item.itemId} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`rounded-lg border px-4 py-3 text-sm bg-white dark:bg-gray-900 ${snapshot.isDragging ? 'border-indigo-300 shadow-lg dark:border-indigo-700' : 'border-gray-200 dark:border-gray-700'}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-gray-400">⋮⋮</span>
                                      <span className="text-gray-900 dark:text-gray-100">{item.content}</span>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  )}
                  
                  {currentQuestion.type === 'fill_in_blank' && (
                    <div className="space-y-2">
                      <TextField
                        label=""
                        value={freeTextAnswer}
                        onChange={e => setFreeTextAnswer(e.target.value)}
                        placeholder="Type your answer here"
                        disabled={!canSubmit}
                      />
                    </div>
                  )}

                  {currentQuestion.type === 'short_answer' && (
                    <div className="space-y-2">
                      <TextAreaField
                        value={freeTextAnswer}
                        onChange={e => setFreeTextAnswer(e.target.value)}
                        placeholder="Write your detailed response here"
                        disabled={!canSubmit}
                        minRows={4}
                      />
                    </div>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                      >
                        Submit Reasoning
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={handleAskDetective}
                        disabled={detectiveIsThinking || !canSubmit}
                      >
                        {detectiveIsThinking ? '🕵️‍♂️ Detective is thinking...' : '💡 Ask Detective'}
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={handleOpenLearnMore}
                        disabled={!currentQuestion?.knowledgeId}
                      >
                        📘 Learn More
                      </Button>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      {canNext && (
                        <Button variant="primary" onClick={handleNext}>
                          {currentQuestionIndex < script.questions.length - 1
                            ? (script.questions[currentQuestionIndex + 1].sceneId === currentScene.sceneId ? 'Next Question →' : 'Next Node →')
                            : 'Complete Adventure →'}
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        onClick={handlePreNode}
                        disabled={currentQuestionIndex === 0}
                      >
                        ⏮ Pre Node
                      </Button>
                    </div>
                  </div>

                  {showHint && currentHint && (
                    <div className="flex gap-4 p-4 rounded-xl border border-indigo-200 bg-indigo-50/80 dark:border-indigo-900/50 dark:bg-indigo-900/20">
                      <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-800 rounded-full shadow-sm text-2xl border border-indigo-100 dark:border-indigo-800">
                        🕵️‍♂️
                      </div>
                      <div>
                        <div className="font-semibold text-indigo-900 dark:text-indigo-300 mb-1">
                          Detective NPC says:
                        </div>
                        <div className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                          "{currentHint}"
                        </div>
                      </div>
                    </div>
                  )}

                  {feedback && (
                    <div
                      className={`rounded-lg border px-4 py-3 text-sm ${
                        feedback.type === 'success'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : feedback.type === 'error'
                          ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-900/40 dark:text-red-200'
                          : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-900/40 dark:text-blue-200'
                      }`}
                    >
                      {feedback.message}
                    </div>
                  )}
                </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No questions in this scene
                  </div>
                )}
              </Card>
            </div>

            <Card title="📚 Case Files (Click to learn more)">
              <div className="flex flex-wrap gap-2">
                {caseFiles.map(knowledge => {
                  const personalNote = getPersonalNote(knowledge.knowledgeId)
                  return (
                    <div key={knowledge.knowledgeId} className="inline-flex items-stretch gap-1">
                      <button
                        onClick={() => {
                          const idx = caseFiles.findIndex(k => k.knowledgeId === knowledge.knowledgeId)
                          if (idx >= 0) {
                            setKnowledgeIndex(idx)
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:border-indigo-200 dark:hover:border-indigo-700 transition"
                      >
                        <span>📄</span>
                        {knowledge.name}
                        {isInLearnLater(knowledge.knowledgeId) && (
                          <span className="text-emerald-600 dark:text-emerald-400 ml-1">✓</span>
                        )}
                      </button>
                      {personalNote && (
                        <button
                          onClick={() => setSelectedNote({ title: knowledge.name, content: personalNote, knowledgeId: knowledge.knowledgeId })}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-300 rounded-lg shadow-sm hover:bg-amber-200 hover:border-amber-400 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-800/60 transition-all"
                          title="View Note"
                        >
                          NOTE
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card title={`📌 Learn Later List (${(learnLater?.items?.filter(item => !item.isLearned && item.scriptId === scriptId).length) || 0})`}>
              {(() => {
                const currentScriptItems = learnLater?.items?.filter(item => !item.isLearned && item.scriptId === scriptId) || [];
                return currentScriptItems.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Your learn later list for this script is empty.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentScriptItems.map(item => {
                      const name = item.name || knowledgeMap.get(item.knowledgeId)?.name || item.knowledgeId;
                      return (
                        <div key={item.knowledgeId} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg group hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                          <div 
                            className="flex items-center cursor-pointer flex-1"
                            onClick={() => {
                              const knowledge = knowledgeMap.get(item.knowledgeId);
                              if (knowledge) {
                                navigate(`/game/learn-more?id=${item.knowledgeId}`, {
                                  state: {
                                    knowledge,
                                    isInLearnLater: true,
                                    scriptId
                                  }
                                });
                              }
                            }}
                          >
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              📄 {name}
                            </span>
                            {item.personalNotes && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedNote({ title: name, content: item.personalNotes!, knowledgeId: item.knowledgeId });
                                }}
                                className="ml-3 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-300 rounded shadow-sm hover:bg-amber-200 hover:border-amber-400 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-800/60 transition-all"
                                title="View Note"
                              >
                                NOTE
                              </button>
                            )}
                            <span className="ml-2 opacity-0 group-hover:opacity-100 text-xs text-indigo-500 transition-opacity whitespace-nowrap">
                              (Click to learn more ↗)
                            </span>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                await api.markAsMastered({ knowledgeId: item.knowledgeId, scriptId });
                                const updatedList = await api.getLearnLaterList(scriptId);
                                setLearnLater(updatedList);
                                setFeedback({ message: 'Removed from learn later list!', type: 'success' });
                              } catch {
                                setFeedback({ message: 'Failed to remove from list', type: 'error' });
                              }
                            }}
                            className="px-2 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="mt-4">
                <Button 
                  variant="secondary" 
                  className="w-full"
                  onClick={handleViewLearnLater}
                >
                  📋 View Full Details
                </Button>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title={`🔍 Clue Board (${unlockedClues.length}/${sceneClues.length})`}>
              {unlockedClues.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                  No clues discovered yet.<br />
                  Unlock clues by answering correctly!
                </div>
              ) : (
                <div className="space-y-3 relative">
                  {unlockedClues.map(clue => {
                    const isFocus = highlightedClues.includes(clue.clueId);
                    return (
                    <div
                      key={clue.clueId}
                      className={`rounded-lg border p-3 text-sm cursor-pointer transition-all duration-500 ${
                        isFocus 
                          ? 'border-amber-300 bg-amber-50/80 shadow-[0_0_12px_rgba(251,191,36,0.3)] dark:border-amber-600/80 dark:bg-amber-900/20' 
                          : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50'
                      }`}
                      onClick={() => setSelectedClue(clue)}
                    >
                      <div className={`font-medium flex items-center justify-between ${isFocus ? 'text-amber-900 dark:text-amber-100' : 'text-indigo-900 dark:text-indigo-100'}`}>
                        <span>📌 {clue.name}</span>
                        {isFocus && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 transition-colors uppercase tracking-wider">Key Clue</span>}
                      </div>
                      <div className={`mt-1 text-xs line-clamp-2 ${isFocus ? 'text-amber-800 dark:text-amber-200/90' : 'text-indigo-700 dark:text-indigo-200'}`}>
                        {clue.description}
                      </div>
                      {clue.relatedKnowledge.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className={`text-xs ${isFocus ? 'text-amber-700 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`}>Related:</span>
                          {clue.relatedKnowledge.map(kId => {
                            const knowledge = knowledgeMap.get(kId)
                            const personalNote = getPersonalNote(kId)
                            return knowledge ? (
                              <span key={kId} className="inline-flex items-center gap-1">
                              <span
                                className={`inline-block px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded text-xs border ${isFocus ? 'text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-700/50' : 'text-indigo-600 border-transparent dark:text-indigo-300'}`}
                              >
                                {knowledge.name}
                              </span>
                              {personalNote && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedNote({ title: knowledge.name, content: personalNote, knowledgeId: kId });
                                  }}
                                  className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 hover:border-amber-400 shadow-sm rounded dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-800/60 transition-all"
                                  title="View Note"
                                >
                                  NOTE
                                </button>
                              )}
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                    <div className="mt-2 flex justify-end">
                        {isInLearnLater(clue.relatedKnowledge[0]) ? (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">📌 Learn Later ✓</span>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400">📌 + Add to Learn Later</span>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </Card>

            <Card title="🎬 Scene Context">
              {sceneContext ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {sceneContext.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                      <span>📍</span>
                      <span>{sceneContext.location}</span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 leading-relaxed text-gray-700 dark:text-gray-300 shadow-inner">
                    {sceneContext.description.split('\n').map((paragraph, i) => (
                      <p key={i} className={i > 0 ? "mt-2" : ""}>{paragraph}</p>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-2 tracking-wider">
                      Characters Present
                    </div>
                    <div className="space-y-2">
                      {sceneCharacters.length > 0 ? (
                        sceneCharacters.map(char => {
                          const isSpeaker = currentQuestion?.speaker === char.name
                          const isSelected = selectedCharacterId === char.characterId
                          return (
                            <div
                              key={char.characterId}
                              className={`flex items-center justify-between px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 cursor-pointer ${isSpeaker ? 'border-indigo-400 ring-2 ring-indigo-300 dark:ring-indigo-600' : 'border-gray-200 dark:border-gray-700'} ${isSelected ? 'ring-2 ring-emerald-400 dark:ring-emerald-500' : ''}`}
                              onClick={() => setSelectedCharacterId(char.characterId)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span>{char.role === 'Detective' ? '🕵️' : char.role === 'Victim' ? '👤' : '👥'}</span>
                                <span className={`font-medium text-sm truncate ${isSpeaker ? 'text-indigo-800 dark:text-indigo-200' : 'text-gray-900 dark:text-gray-100'}`}>{char.name}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">({char.role})</span>
                              {isSpeaker && <span className="text-[10px] text-indigo-600 dark:text-indigo-300">speaker</span>}
                            </div>
                              <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${getCharacterTrust(char.characterId)}%` }} />
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <span className="text-sm text-gray-500 italic">No one else is here...</span>
                      )}
                    </div>

                    {selectedCharacterId && (
                      <div className="mt-3 p-3 border rounded-lg bg-gray-50 dark:bg-gray-900">
                        {(() => {
                          const selectedCharacter = sceneCharacters.find(c => c.characterId === selectedCharacterId)
                          if (!selectedCharacter) {
                            return <div className="text-sm text-gray-500 dark:text-gray-400">No selected character.</div>
                          }
                          return (
                            <div className="text-sm space-y-1">
                              <div className="font-bold text-gray-800 dark:text-gray-100">{selectedCharacter.name} ({selectedCharacter.role})</div>
                              {selectedCharacter.occupation && <div><span className="font-medium">Occupation:</span> {selectedCharacter.occupation}</div>}
                              {selectedCharacter.goal && <div><span className="font-medium">Goal:</span> {selectedCharacter.goal}</div>}
                              {selectedCharacter.personality && <div><span className="font-medium">Personality:</span> {selectedCharacter.personality}</div>}
                              {selectedCharacter.background && <div><span className="font-medium">Background:</span> {selectedCharacter.background}</div>}
                              {selectedCharacter.knowledgePoints?.length > 0 && <div><span className="font-medium">Related Knowledge:</span> {selectedCharacter.knowledgePoints.join(', ')}</div>}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  Loading scene details...
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      {/* Clue Modal */}
      {selectedClue && (
        <ClueModal
          clue={selectedClue}
          knowledgeMap={knowledgeMap}
          isInLearnLater={isInLearnLater}
          onAddToLearnLater={handleAddToLearnLater}
          onViewChunk={handleViewChunk}
          onClose={() => setSelectedClue(null)}
        />
      )}
      
      {/* Learn More Modal */}
      {knowledgeIndex !== null && caseFiles[knowledgeIndex] && (
        <LearnMoreModal
          knowledge={caseFiles[knowledgeIndex]}
          onClose={() => {
            setKnowledgeIndex(null)
          }}
          onAddToLearnLater={() => handleAddToLearnLater(caseFiles[knowledgeIndex].knowledgeId)}
          onMarkAsLearned={handleMarkAsLearned}
          isInLearnLater={isInLearnLater(caseFiles[knowledgeIndex].knowledgeId)}
          onPrev={handleLearnMorePrev}
          onNext={handleLearnMoreNext}
          onDeepDive={() => {
            setKnowledgeIndex(null)
            navigate(`/game/learn-more?id=${caseFiles[knowledgeIndex].knowledgeId}`, {
              state: {
                knowledge: caseFiles[knowledgeIndex],
                isInLearnLater: isInLearnLater(caseFiles[knowledgeIndex].knowledgeId),
                scriptId
              }
            })
          }}
          hasPrev={knowledgeIndex >  0}
          hasNext={knowledgeIndex < caseFiles.length - 1}
        />
      )}
      
      {/* Wrong Answer Modal */}
      {showWrongModal && currentQuestion && wrongAnswerReviewData && (
        <WrongAnswerModal
          selectedAnswer={lastWrongAnswer}
          rationale={wrongAnswerRationale}
          clues={wrongAnswerReviewData.clues}
          suggestedKnowledge={wrongAnswerReviewData.suggestedKnowledge}
          autoAddedItems={wrongAnswerReviewData.autoAddedItems}
          onContinue={() => setShowWrongModal(false)}
          onViewLearnLater={handleViewLearnLater}
          onReportIssue={() => setShowReportModal(true)}
        />
      )}

      {/* Report Issue & Skip Modal */}
      <ReportIssueModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReportAndSkip}
        isSubmitting={saving}
      />

      
      {/* Chunk Modal */}
      {selectedChunk && (
        <ChunkModal
          chunk={selectedChunk}
          onClose={() => setSelectedChunk(null)}
        />
      )}

      {/* Note Modal */}
      <EditableNoteModal
        isOpen={!!selectedNote}
        onClose={() => setSelectedNote(null)}
        title={`My Notes: ${selectedNote?.title}`}
        initialContent={selectedNote?.content}
        onSave={async (newContent) => {
          if (selectedNote?.knowledgeId) {
            try {
              await api.updateLearningProgress({
                knowledgeId: selectedNote.knowledgeId,
                scriptId: scriptId,
                personalNotes: newContent,
              });
              // Update local state by forcing a refetch or modifying local store
              const updatedItems = learnLater?.items.map(item =>
                item.knowledgeId === selectedNote.knowledgeId
                  ? { ...item, personalNotes: newContent }
                  : item
              );
              setLearnLater(learnLater ? { ...learnLater, items: updatedItems || [] } : null);
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

export default PlayGamePage
