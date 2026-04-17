import json
import re
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError, BaseModel

from app.core.database import get_postgres
from app.core.dependencies import get_current_user
from app.models.feynman import (
    TeachBackAnalysis,
    TeachBackHistoryItem,
    TeachBackHistoryResponse,
    TeachBackRequest,
    TeachBackResponse,
)
from app.repositories import ConceptRepository, TeachBackRepository
from app.services.infrastructure.task_queue_manager import task_queue_manager, QueueType
from app.core.enums import UserPriority

logger = logging.getLogger(__name__)
from app.services.ai.provider import AIProvider, AIProviderError

router = APIRouter(prefix="/feynman", tags=["Application & Assessment"])

SYSTEM_PROMPT_TEMPLATE = (
    "You are an interactive tutor and student-coach. When evaluating a learner's explanation, analyze it from the perspective of whether the learner is actually TEACHING the concept to another student. Respond with ONLY valid JSON using the fields described below.\n\n"
    "Required JSON fields: missing_terms (array of key terms the explanation omitted), logical_gaps (array of specific gaps in reasoning), unclear_reasoning (array of unclear sentences or claims), analogies (array of short suggested analogies), follow_up_questions (array of direct questions the AI should ask the user to clarify or probe deeper), revised_explanation (a clarified/rewritten explanation in the requested language), summary (short evaluation sentence), score (numeric 0-100).\n\n"
    "SCORING GUIDE — apply based on the target level in the user prompt:\n"
    "- beginner: Be very generous and encouraging. The student only needs to show they grasp the core idea in their own words — technical vocabulary is NOT required. Score 85-100 if the main idea is correct, even if vague or imprecise. Score 70-84 if there is a partial understanding. Only score below 60 for completely wrong or empty explanations. Default to high scores for beginners — when in doubt, score higher.\n"
    "- intermediate: Expect correct terminology and a clear explanation with at least one example. Score 65-85 for solid explanations with minor gaps.\n"
    "- advanced: Expect precise terminology, edge cases, and deep reasoning. Score strictly.\n\n"
    "If you identify unclear or ambiguous parts, include specific, actionable follow-up questions in 'follow_up_questions' that the AI should ask the user (phrase them as questions directed at the user). If you need more information to evaluate or to produce a clear rewritten explanation, put those prompts into 'follow_up_questions'.\n\n"
    "Language handling: respect the 'Language' field supplied in the user prompt - produce 'revised_explanation', 'summary', and 'follow_up_questions' in that language (for example, produce Chinese when Language is 'zh' or 'zh-CN').\n\n"
    "Example input: 'HTTP is for web pages'\n"
    "Example output:\n"
    "{\n"
    '  "missing_terms": ["protocol", "request/response"],\n'
    '  "logical_gaps": ["How does it work?"],\n'
    '  "unclear_reasoning": ["Too vague"],\n'
    '  "analogies": ["Like mail delivery"],\n'
    '  "follow_up_questions": ["Can you show the sequence of request and response?"],\n'
    '  "revised_explanation": "HTTP is a protocol...",\n'
    '  "summary": "Basic but incomplete",\n'
    '  "score": 45\n'
    "}\n\n"
    "CRITICAL: Return ONLY the JSON object. No explanatory text before or after."
)

_json_block = re.compile(r"\{[\s\S]*\}")


def _parse_llm_json(raw_text: str) -> dict:
    """Parse LLM response and fix common formatting issues."""
    logger.info(f"LLM raw response (first 500 chars): {raw_text[:500]}")
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        match = _json_block.search(raw_text)
        if match:
            json_str = match.group(0)
            try:
                parsed = json.loads(json_str)
                # Fix: Convert string values to arrays for list fields
                list_fields = ["missing_terms", "logical_gaps", "unclear_reasoning", 
                              "analogies", "follow_up_questions"]
                for field in list_fields:
                    if field in parsed and isinstance(parsed[field], str):
                        # Convert single string to array
                        parsed[field] = [parsed[field]] if parsed[field].strip() else []
                logger.info("Successfully parsed JSON from LLM response")
                return parsed
            except json.JSONDecodeError:
                logger.warning("Failed to parse extracted JSON block")
                pass
    
    logger.warning("Using fallback response due to JSON parsing failure")
    # Fallback: Create a default response if parsing fails completely
    return {
        "missing_terms": ["More technical details needed"],
        "logical_gaps": ["Explanation could be more detailed"],
        "unclear_reasoning": [],
        "analogies": ["Think of it like a question and answer between client and server"],
        "follow_up_questions": ["What are the other HTTP methods?", "What is the difference between GET and POST?"],
        "revised_explanation": "HTTP GET is a request method used by clients to retrieve data from a web server. It's like asking a question - you request information and the server responds with it.",
        "summary": "Basic understanding demonstrated. Could expand on protocol details and use cases.",
        "score": 65
    }


@router.post("/analyze", response_model=TeachBackResponse)
async def analyze_teachback(
    payload: TeachBackRequest,
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):
    repo = TeachBackRepository(db)
    concept_title = payload.concept_title

    if payload.concept_id and concept_title is None:
        concept_repo = ConceptRepository(db)
        concept = await concept_repo.get_with_translation(payload.concept_id, payload.language)
        if concept:
            concept_title = concept.get("title")

    ai = AIProvider()
    user_prompt = (
        f"Concept: {concept_title or 'Unspecified'}\n"
        f"Target level: {payload.target_level}\n"
        f"Language: {payload.language}\n"
        "Evaluate the student's explanation."
        "\n\nStudent explanation:\n"
        f"{payload.explanation.strip()}"
    )

    # If a follow-up answer is provided, include it as additional context for re-evaluation
    if getattr(payload, "follow_up", None):
        fq = payload.follow_up
        try:
            q_text = fq.get("question")
            a_text = fq.get("answer")
            user_prompt += f"\n\nFollow-up question: {q_text}\nStudent answer: {a_text}\n\nPlease re-evaluate the explanation in light of this follow-up."
        except Exception:
            logger.debug("Malformed follow_up payload")

    async def _ai_analyze():
        async with ai.session(system_prompt=SYSTEM_PROMPT_TEMPLATE) as s:
            return await ai.generate(
                prompt=user_prompt,
                session=s,
                temperature=0.2,
                max_tokens=512
            )

    try:
        llm_raw = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_analyze, UserPriority.REGULAR
        )
    except AIProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc)
        )

    analysis_dict = _parse_llm_json(llm_raw)

    # Apply beginner score floor: if level is beginner and explanation is non-empty, score >= 65
    if payload.target_level == "beginner" and payload.explanation.strip():
        raw_score = analysis_dict.get("score")
        if isinstance(raw_score, (int, float)) and raw_score < 65:
            analysis_dict["score"] = 65

    try:
        analysis = TeachBackAnalysis.model_validate(analysis_dict)
    except ValidationError as exc:
        logger.warning(f"TeachBackAnalysis validation failed: {exc}")
        # Be tolerant: build a best-effort analysis object. Ensure list fields exist.
        list_fields = ["missing_terms", "logical_gaps", "unclear_reasoning", "analogies", "follow_up_questions"]
        for f in list_fields:
            if f not in analysis_dict or not isinstance(analysis_dict.get(f), list):
                analysis_dict[f] = analysis_dict.get(f) or []

        # Ensure summary and score exist
        analysis_dict.setdefault("summary", analysis_dict.get("summary") or "Partial analysis generated")
        analysis_dict.setdefault("score", analysis_dict.get("score") or 0)

        # If revised_explanation is missing or empty, ask the AI for a plain-text rewrite focused on clarity
        if not analysis_dict.get("revised_explanation"):
            try:
                rewrite_prompt = (
                    f"You are a helpful tutor and student-coach. Produce a longer, thorough explanation that helps a learner understand the following concept, written in the requested language. If parts of the student's explanation are ambiguous or missing, include clear short follow-up questions (as separate lines) that the AI should ask the user before or while teaching.\n\n"
                    "Aim for 3–6 short paragraphs (roughly 250–500 words) that progressively build understanding: start with an intuitive overview, then explain core mechanics, and finish with a concrete example or analogy. "
                    "Prioritize clarity and teachability: you may use simple analogies or small simplifications even if technically imprecise, if that helps the learner. "
                    "If you omit advanced technical details, append a single short caveat sentence starting with 'Caveat:' noting what was simplified. "
                    "Return only the rewritten explanation text (and the optional caveat) with no extra commentary.\n\n"
                    f"Language: {payload.language}\n"
                    f"Concept: {concept_title or 'Unspecified'}\n"
                    f"Student explanation:\n{payload.explanation.strip()}"
                )

                async def _ai_rewrite():
                    async with ai.session(system_prompt="You are a helpful tutor focused on clarity and teaching. If follow-up questions are needed, produce them as separate short questions in the requested language.") as s:
                        return await ai.generate(
                            prompt=rewrite_prompt,
                            session=s,
                            temperature=0.2,
                            max_tokens=800
                        )

                rewrite_raw = await task_queue_manager.submit_and_wait(
                    QueueType.AI_GENERATION, _ai_rewrite, UserPriority.REGULAR
                )
                # Use the full text as the revised explanation
                analysis_dict["revised_explanation"] = rewrite_raw.strip()
            except AIProviderError:
                # Fall back to a minimal explanatory string
                analysis_dict["revised_explanation"] = analysis_dict.get("revised_explanation") or "(No revised explanation available)"

        try:
            analysis = TeachBackAnalysis.model_validate(analysis_dict)
        except ValidationError:
            # As a last resort use a safe default TeachBackAnalysis
            logger.warning("Falling back to safe default TeachBackAnalysis")
            analysis = TeachBackAnalysis(
                missing_terms=analysis_dict.get("missing_terms", []),
                logical_gaps=analysis_dict.get("logical_gaps", []),
                unclear_reasoning=analysis_dict.get("unclear_reasoning", []),
                analogies=analysis_dict.get("analogies", []),
                follow_up_questions=analysis_dict.get("follow_up_questions", []),
                revised_explanation=analysis_dict.get("revised_explanation"),
                summary=analysis_dict.get("summary"),
                score=analysis_dict.get("score")
            )

    session = await repo.create_session(
        user_id=current_user["id"],
        concept_id=payload.concept_id,
        concept_title=concept_title,
        explanation=payload.explanation,
        target_level=payload.target_level,
        language=payload.language,
        analysis=analysis.model_dump()
    )

    return TeachBackResponse(
        session_id=session["id"],
        concept_title=session["concept_title"],
        analysis=analysis,
        created_at=session["created_at"],
    )


class GenerateExplanationRequest(BaseModel):
    concept_title: str | None = None
    target_level: str = "beginner"
    language: str = "en"


class GenerateExplanationResponse(BaseModel):
    explanation: str


@router.post("/generate-explanation", response_model=GenerateExplanationResponse)
async def generate_explanation(payload: GenerateExplanationRequest):
    """Generate a clear, teachable explanation for the given concept."""
    ai = AIProvider()
    concept_title = payload.concept_title or "Unspecified"
    prompt = (
        f"You are a helpful tutor and student-coach. Write a longer, detailed explanation to help a learner understand the concept '{concept_title}'. If you identify unclear areas or missing details, include short follow-up questions the AI can ask the user (format follow-up questions as separate short questions). "
        "Aim for 3–6 short paragraphs (about 250–500 words): begin with an intuitive overview, then expand on the key ideas, and finish with a concrete example or analogy. "
        "Prioritize clarity and teachability: you may use simple analogies or small simplifications even if technically imprecise, if that helps the learner. "
        "If you omit advanced technical details, append a single short caveat sentence starting with 'Caveat:' noting what was simplified. "
        f"Adjust language for the target level: {payload.target_level}."
        f"Language: {payload.language}. Return only the explanation text (and optional caveat and any short follow-up questions) in that language with no extra commentary."
    )

    async def _ai_explain():
        async with ai.session(system_prompt="You are a helpful tutor focused on clarity and teaching.") as s:
            return await ai.generate(
                prompt=prompt,
                session=s,
                temperature=0.2,
                max_tokens=800,
            )

    try:
        text = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_explain, UserPriority.REGULAR
        )
    except AIProviderError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return GenerateExplanationResponse(explanation=text.strip())


@router.get("/history", response_model=TeachBackHistoryResponse)
async def list_history(
    limit: int = Query(10, ge=1, le=50),
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):
    repo = TeachBackRepository(db)
    rows = await repo.list_recent_by_user(current_user["id"], limit=limit)
    items = [
        TeachBackHistoryItem(
            session_id=row["id"],
            concept_title=row["concept_title"],
            created_at=row["created_at"],
            score=row["score"],
        )
        for row in rows
    ]
    return TeachBackHistoryResponse(items=items)
