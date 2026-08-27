"""AI Assistant router — contextual learning coach powered by Groq LLM."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import get_memory_store
from app.services.llm_service import llm_call
from app.core.recommendation_engine import recommendation_engine

router = APIRouter()


class ChatRequest(BaseModel):
    learner_id: str
    message: str
    history: list = []


@router.post("/chat")
async def chat(req: ChatRequest):
    store = get_memory_store()
    learner = store["learners"].get(req.learner_id)
    if not learner:
        raise HTTPException(404, "Learner not found")

    skill_states = store["learner_skill_states"].get(req.learner_id, {})

    # Build context summary
    decaying = [
        s for s, v in skill_states.items()
        if v.get("mastery_estimate", 0) < 0.5
    ]
    solid = [
        s for s, v in skill_states.items()
        if v.get("mastery_estimate", 0) >= 0.7
    ]

    recs = []
    try:
        recs_data = recommendation_engine.compute_recommendations(skill_states, top_k=3)
        recs = [r["skill_id"] for r in recs_data]
    except Exception:
        pass

    context = f"""You are SkillPulse, an intelligent learning coach.
Learner: {learner.get("name", "Learner")}
Goal: {learner.get("goal", "Not set")}
Solid skills (mastery >= 70%): {", ".join(solid[:5]) if solid else "none yet"}
Decaying skills (recall < 50%): {", ".join(decaying[:5]) if decaying else "none"}
Top recommended next skills: {", ".join(recs) if recs else "none"}

Answer the learner's question concisely (2-3 sentences max). Be specific to their current state, not generic.
If they ask what to study next, mention their top recommendations. If they ask about a skill, relate it to their goal."""

    history_str = ""
    for turn in req.history[-4:]:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        history_str += f"{role.capitalize()}: {content}\n"

    prompt = f"{context}\n\nConversation so far:\n{history_str}Learner: {req.message}\nCoach:"

    default = (
        f"Based on your goal to {learner.get('goal', 'grow as a learner')}, "
        f"I'd focus on {recs[0] if recs else 'your highest-priority skill'} next. "
        f"Your Bayesian knowledge model shows clear next steps in your path."
    )

    response = await llm_call(prompt, default)

    # Strip "Coach:" prefix if model echoes it
    if response.startswith("Coach:"):
        response = response[6:].strip()

    return {"response": response, "learner_id": req.learner_id}
