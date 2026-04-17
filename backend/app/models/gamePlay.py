from typing import List, Optional, Any, Literal, Dict
from pydantic import BaseModel
from datetime import datetime


class OptionDTO(BaseModel):
    optionId: str
    content: str
    isCorrect: bool
    # nextSceneId: str
    feedback: str
    unlockClues: Optional[List[str]] = None
    showHint: Optional[str] = None

class SequencingItemDTO(BaseModel):
    itemId: str
    content: str

class LearnMoreDTO(BaseModel):
    knowledgeId: str
    buttonText: Optional[str] = None
    useAIPlaceholder: Optional[bool] = None

class HintDTO(BaseModel):
    hintId: str
    content: str
    unlockAfterAttempts: Optional[int] = 1

class QuestionDTO(BaseModel):
    questionId: str
    sceneId: str
    order: int
    type: Literal['multiple_choice', 'sequencing', 'sequence_check', 'fill_in_blank', 'short_answer']
    content: str
    knowledgeId: str
    relatedKnowledge: Optional[List[str]] = None
    difficulty: Optional[int] = None
    maxAttempts: int
    masteryReward: int
    hints: Optional[List[HintDTO]] = None
    options: Optional[List[OptionDTO]] = None
    items: Optional[List[SequencingItemDTO]] = None
    correctOrder: Optional[List[str]] = None
    correctAnswer: Optional[str] = None
    acceptableAnswers: Optional[List[str]] = None
    learnMore: LearnMoreDTO

class SceneDTO(BaseModel):
    sceneId: str
    act: int
    order: int
    title: str
    location: str
    description: str
    charactersPresent: List[str]
    clues: List[str]
    questions: List[str]

class CharacterDTO(BaseModel):
    characterId: str
    name: str
    role: str
    occupation: Optional[str] = None
    background: Optional[str] = None
    secret: Optional[str] = None
    knowledgePoints: List[str]
    goal: Optional[str] = None
    scenes: List[str]

class ClueDTO(BaseModel):
    clueId: str
    name: str
    type: Optional[Literal['physical', 'documentary', 'digital', 'testimonial']] = None
    description: str
    foundInScene: Optional[str] = None
    foundBy: Optional[str] = None
    reveals: Optional[str] = None
    relatedKnowledge: List[str]
    isInLearnLater: Optional[bool] = None  

class KnowledgeDTO(BaseModel):
    knowledgeId: str
    name: str
    description: str
    category: Optional[str] = None
    difficulty: Optional[int] = None
    appearsIn: Optional[List[str]] = None
    relatedKnowledge: Optional[List[str]] = None
    relatedChunksText: Optional[List[str]] = None

class EndingDTO(BaseModel):
    endingId: str
    type: Literal['truth', 'false', 'unresolved']
    title: str
    content: str
    debrief: str
    summary: str
    unlockConditions: dict


class EvidenceDTO(BaseModel):
    evidenceId: str
    name: str
    type: Literal['Physical', 'Documentary', 'Digital', 'Testimonial', 'physical', 'documentary', 'digital', 'testimonial']
    description: str
    foundLocation: str
    relatedKnowledge: List[str]
    clueIds: List[str]


class ScriptDTO(BaseModel):
    scriptId: str
    documentHash: Optional[str] = None  
    documentName: Optional[str] = None
    version: Optional[str] = None
    title: str
    moduleName: Optional[str] = None
    logline: Optional[str] = None
    educational_goals: Optional[List[str]] = None
    scenes: List[SceneDTO]
    questions: List[QuestionDTO]
    clues: List[ClueDTO]
    characters: List[CharacterDTO]
    knowledgeBase: List[KnowledgeDTO]
    evidence: Optional[List[EvidenceDTO]] = None
    endings: List[EndingDTO]
    timeLimit: Optional[int] = None
    hintPenalty: Optional[int] = None
    masteryRewardBase: Optional[int] = None
    maxAttemptsDefault: Optional[int] = None


class UserProgressDTO(BaseModel):
    userId: str
    scriptId: str
    currentSceneId: str
    completedScenes: List[str]
    unlockedClues: List[str]
    collectedEvidence: List[str]
    answeredQuestions: List[str]
    correctAnswers: List[str]
    wrongAnswers: List[str]
    studySessionId: Optional[str] = None
    lastUpdated: datetime


class UserLearnLaterItemDTO(BaseModel):
    knowledgeId: str
    addedAt: datetime
    sourceSceneId: str
    sourceQuestionId: str
    isLearned: bool
    learnedAt: Optional[datetime] = None

class UserLearnLaterDTO(BaseModel):
    userId: str
    learnLaterList: List[UserLearnLaterItemDTO]


class UserAnswerRecordDTO(BaseModel):
    questionId: str
    knowledgeId: str
    selectedOption: Optional[str] = None
    sequencingOrder: Optional[List[str]] = None
    isCorrect: bool
    timestamp: datetime
    sceneId: str
    attemptNumber: int
    hintsUsed: int
    masteryEarned: int

class UserAnswerDTO(BaseModel):
    userId: str
    answers: List[UserAnswerRecordDTO]


class ChunkDTO(BaseModel):
    id: str
    text: str
    mainConcepts: List[str]
    secondaryConcepts: List[str]
    summary: str
    pageNumber: Optional[int] = None
    sectionTitle: Optional[str] = None

class KnowledgeWithChunksDTO(KnowledgeDTO):
    chunks: List[ChunkDTO]

class QuestionSupportDTO(BaseModel):
    questionId: str
    supportingChunks: List[dict]
    extensionChunks: List[str]


class AIPlaceholderDTO(BaseModel):
    knowledgeId: str
    feature: Literal['explain', 'summary', 'quiz']
    status: Literal['coming_soon']
    message: str

class AskDetectiveRequestDTO(BaseModel):
    scriptId: str
    sceneId: str
    questionId: str
    wrongAnswers: Optional[List[str]] = None
    askCount: int = 1

class ReportIssueRequestDTO(BaseModel):
    questionId: str
    sceneId: str
    issueType: str
    userComment: str

class SubmitAnswerRequestDTO(BaseModel):
    questionId: str
    sceneId: str
    knowledgeId: str
    selectedOption: Optional[str] = None
    sequencingOrder: Optional[List[str]] = None
    answerText: Optional[str] = None
    attemptNumber: int
    hintsUsed: int

class AddToLearnLaterRequestDTO(BaseModel):
    knowledgeId: str
    scriptId: Optional[str] = None
    triggerType: Literal['clue', 'question', 'manual']
    triggerId: str
    wrongAnswer: Optional[str] = None

class MarkMasteredRequestDTO(BaseModel):
    knowledgeId: str

class ProgressInfo(BaseModel):
    cluesFound: int
    totalClues: int
    questionsAnswered: int
    totalQuestions: int

class AnswerProgressInfo(BaseModel):
    cluesFound: int
    questionsAnswered: int
    cluesUnlocked: Optional[List[str]] = None

class LearnLaterItemInfo(BaseModel):
    knowledgeId: str
    name: str
    description: str
    triggerType: Literal['clue', 'question', 'manual']
    triggerInfo: dict
    addedAt: datetime
    relatedChunks: List[dict]

class AutoAddedItem(BaseModel):
    knowledgeId: str
    name: str

class SceneResponseDTO(BaseModel):
    """Scene context with user-specific progress stats.
    Scene data (clues, questions, characters) should come from ScriptDTO on frontend."""
    sceneId: str
    progress: ProgressInfo
    learnLaterCount: int

class AnswerResultDTO(BaseModel):
    isCorrect: bool
    feedback: str
    autoAddedToLearnLater: Optional[List[AutoAddedItem]] = None
    progress: AnswerProgressInfo
    questionStatus: Optional[dict] = None


class LearnLaterListDTO(BaseModel):
    items: List[LearnLaterItemInfo]
    masteredCount: int
    totalCount: int

class SaveProgressRequestDTO(BaseModel):
    progress: Optional[Dict[str, Any]] = None
    currentAnswer: Optional[SubmitAnswerRequestDTO] = None


class ScriptReportStatsDTO(BaseModel):
    totalTimeMinutes: int
    completionRate: int
    sessions: int
    lastReviewed: str
    activity: List[int]
    totalMasteryScore: int = 0
    masteryRate: float = 0.0
    masteryTrend: float = 0.0
    learningProgressLabel: Optional[str] = None

class ConceptStatDTO(BaseModel):
    """Knowledge concept mastery and experience stats"""
    knowledgeId: str
    icon: str
    text: str
    isMastered: bool
    personalNotes: Optional[str] = None
    masteryLevel: int = 0  # 0-100 mastery degree
    correctCount: int = 0  # number of correct answers
    totalAttempts: int = 0  # total attempts
    hintsUsed: int = 0  # hints used
    lastAttemptDate: Optional[str] = None  # last attempt date
    totalMasteryScore: int = 0
    masteryRate: float = 0.0

class WrongAnswerConceptDTO(BaseModel):
    """Frequently Missed Concepts"""
    knowledgeId: str
    conceptName: str
    icon: str
    errorCount: int  # error count
    hintsUsedTotal: int  # total hints used
    lastErrorDate: str
    relatedQuestions: List[str] = []  # related question IDs
    personalNotes: Optional[str] = None

class PerformanceStatsDTO(BaseModel):
    """Answer Performance Statistics"""
    totalQuestions: int
    correctAnswers: int
    wrongAnswers: int
    accuracy: float  # accuracy 0-100
    firstAttemptAccuracy: float  # first attempt accuracy
    improvementRate: float  # improvement rate (final vs first)
    averageTimePerQuestion: float  # average time per question (seconds)
    hintsUsageRate: float  # hints usage rate 0-100
    totalMasteryScore: int = 0
    masteryRate: float = 0.0
    masteryTrend: float = 0.0

class ReviewRecommendationDTO(BaseModel):
    """Review Recommendations"""
    conceptId: str
    conceptName: str
    reason: str  # "high_error_rate" | "low_accuracy" | "hints_heavy"
    priority: int  # 1-5 priority level
    suggestedResources: List[dict] = []  # suggested resources

class ScriptReportDTO(BaseModel):
    scriptId: str
    name: str
    moduleName: Optional[str] = None
    documentName: Optional[str] = None
    stats: ScriptReportStatsDTO
    historyStats: Optional[ScriptReportStatsDTO] = None
    keyConcepts: List[ConceptStatDTO]
    # Stage 1: Answer Performance Analysis
    performance: PerformanceStatsDTO
    # Stage 2: Frequently Missed Concepts and Review Recommendations
    wrongAnswerConcepts: List[WrongAnswerConceptDTO] = []
    reviewRecommendations: List[ReviewRecommendationDTO] = []