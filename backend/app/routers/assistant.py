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

    decaying = [s for s, v in skill_states.items() if v.get("mastery_estimate", 0) < 0.5]
    solid = [s for s, v in skill_states.items() if v.get("mastery_estimate", 0) >= 0.7]

    recs = []
    try:
        from app.routers.recommendations import _get_domain_context
        domain_graph, goal_skills, transfer_map = _get_domain_context(req.learner_id)
        recs_data = recommendation_engine.compute_recommendations(
            skill_states, goal_skills=goal_skills, top_k=3,
            graph=domain_graph, transfer_map=transfer_map,
        )
        recs = [r["skill_name"] for r in recs_data]
    except Exception as e:
        print(f"[assistant] recommendations failed: {e}")

    system = (
        f"You are SkillPulse, an expert learning coach. Be concise — 2-3 sentences max.\n"
        f"Learner goal: {learner.get('goal', 'not set')}\n"
        f"Solid skills (≥70%): {', '.join(solid[:5]) or 'none yet'}\n"
        f"Decaying skills (<50%): {', '.join(decaying[:5]) or 'none'}\n"
        f"Top recommended next: {', '.join(recs) or 'none'}\n"
        f"Be specific to their state. If asked what to study, cite recommendations. "
        f"If asked about a skill, relate it to their goal."
    )

    history_str = ""
    for turn in req.history[-4:]:
        role = turn.get("role", "user").capitalize()
        history_str += f"{role}: {turn.get('content', '')}\n"

    prompt = f"{history_str}Learner: {req.message}\nCoach:"

    default = (
        f"Based on your goal to {learner.get('goal', 'grow as a learner')}, "
        f"I'd focus on {recs[0] if recs else 'your highest-priority skill'} next."
    )

    response = await llm_call(prompt, default, max_tokens=150, system=system, temperature=0.6)

    if response.startswith("Coach:"):
        response = response[6:].strip()

    return {"response": response, "learner_id": req.learner_id}
