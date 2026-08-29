from fastapi import APIRouter
from app.database import get_memory_store
from app.core.recommendation_engine import recommendation_engine
from app.core.decay_calculator import decay_calculator
from app.services.llm_service import explain_recommendation
from app.services.domain_service import get_pack_by_id, get_goal_competencies

router = APIRouter()


def _get_domain_context(learner_id: str):
    """Return (domain_graph, goal_skills, transfer_map) for a learner, or (None, None, None)."""
    try:
        from app.models.db_models import Learner
        from app.database import SessionLocal
        from app.core.domain_graph import DomainGraph
        db = SessionLocal()
        learner_row = db.get(Learner, learner_id)
        db.close()
        if learner_row and learner_row.domain_pack_id:
            pack = get_pack_by_id(learner_row.domain_pack_id)
            if pack:
                dg = DomainGraph(pack["pack_data"])
                goal_skills = get_goal_competencies(pack)
                transfer_map = dg.build_transfer_map()
                return dg, goal_skills, transfer_map
    except Exception as e:
        print(f"[recommendations] domain context lookup failed: {e}")
    return None, None, None


@router.get("/{learner_id}")
async def get_recommendations(learner_id: str, top_k: int = 5):
    store = get_memory_store()
    raw_states = store["learner_skill_states"].get(learner_id, {})

    learner_states = {}
    for name, state in raw_states.items():
        stored_mastery = state.get("mastery_estimate", 0.0)
        last_practiced = state.get("last_practiced_at")
        half_life = state.get("half_life_days", 7.0)
        eff_mastery = decay_calculator.effective_mastery(stored_mastery, last_practiced, half_life)
        learner_states[name] = {**state, "effective_mastery": eff_mastery}

    domain_graph, goal_skills, transfer_map = _get_domain_context(learner_id)

    # Non-demo learners with no domain pack get no recommendations (not ML fallback)
    if domain_graph is None and learner_id != "priya-demo-001":
        return {"learner_id": learner_id, "recommendations": []}

    recs = recommendation_engine.compute_recommendations(
        learner_states, goal_skills=goal_skills, top_k=top_k,
        graph=domain_graph, transfer_map=transfer_map,
    )

    for rec in recs:
        rec["explanation"] = await explain_recommendation(
            rec["skill_name"],
            rec["factors"],
            rec["transfer_sources"],
            rec["urgency_level"],
        )

    return {"learner_id": learner_id, "recommendations": recs}


@router.get("/{learner_id}/{skill_name}/explain")
async def explain_single_recommendation(learner_id: str, skill_name: str):
    """Get a detailed explanation for why a specific skill is recommended."""
    store = get_memory_store()
    raw_states = store["learner_skill_states"].get(learner_id, {})

    learner_states = {}
    for name, state in raw_states.items():
        stored_mastery = state.get("mastery_estimate", 0.0)
        last_practiced = state.get("last_practiced_at")
        half_life = state.get("half_life_days", 7.0)
        eff_mastery = decay_calculator.effective_mastery(stored_mastery, last_practiced, half_life)
        learner_states[name] = {**state, "effective_mastery": eff_mastery}

    domain_graph2, goal_skills2, transfer_map2 = _get_domain_context(learner_id)
    recs = recommendation_engine.compute_recommendations(
        learner_states, goal_skills=goal_skills2, top_k=20,
        graph=domain_graph2, transfer_map=transfer_map2,
    )
    rec = next((r for r in recs if r["skill_name"] == skill_name), None)

    if not rec:
        return {
            "skill_name": skill_name,
            "explanation": f"{skill_name} is on your path to the goal.",
        }

    explanation = await explain_recommendation(
        rec["skill_name"], rec["factors"], rec["transfer_sources"], rec["urgency_level"]
    )

    return {
        "skill_name": skill_name,
        "explanation": explanation,
        "factors": rec["factors"],
        "urgency_level": rec["urgency_level"],
        "transfer_sources": rec["transfer_sources"],
        "estimated_time_hours": rec["estimated_time_hours"],
    }
