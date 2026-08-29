from fastapi import APIRouter
from app.models.schemas import OnboardingGoalRequest, SelfAssessmentRequest
from app.database import get_memory_store, SessionLocal
from app.core.skill_graph import skill_graph
from app.seeds_loader import load_priya_state
from app.services.domain_service import discover_domain, get_goal_competencies

router = APIRouter()


def _persist_learner(learner: dict) -> None:
    """Upsert learner row to Postgres (best-effort, never raises)."""
    try:
        from app.models.db_models import Learner
        db = SessionLocal()
        row = db.get(Learner, learner["id"])
        if row is None:
            row = Learner(id=learner["id"])
            db.add(row)
        row.name = learner.get("name", "Learner")
        row.goal = learner.get("goal")
        row.background = learner.get("background")
        row.domain_pack_id = learner.get("domain_pack_id")
        row.onboarding_complete = learner.get("onboarding_complete", False)
        db.commit()
        db.close()
    except Exception as e:
        print(f"DB persist learner failed (non-fatal): {e}")


def _persist_skill_state(state: dict) -> None:
    """Upsert skill state row to Postgres (best-effort, never raises)."""
    try:
        from app.models.db_models import LearnerSkillState
        from datetime import datetime
        db = SessionLocal()
        row = db.get(LearnerSkillState, (state["learner_id"], state["skill_name"]))
        if row is None:
            row = LearnerSkillState(
                learner_id=state["learner_id"],
                skill_name=state["skill_name"],
            )
            db.add(row)
        row.alpha = state["alpha"]
        row.beta_param = state["beta_param"]
        row.mastery_estimate = state["mastery_estimate"]
        row.self_assessed_confidence = state.get("self_assessed_confidence")
        row.evidence_source = state.get("evidence_source", "none")
        row.half_life_days = state["half_life_days"]
        lp = state.get("last_practiced_at")
        row.last_practiced_at = datetime.fromisoformat(lp) if lp else None
        row.practice_count = state["practice_count"]
        db.commit()
        db.close()
    except Exception as e:
        print(f"DB persist skill state failed (non-fatal): {e}")


@router.post("/goal")
async def set_goal(body: OnboardingGoalRequest):
    store = get_memory_store()

    # Discover domain pack for this goal (LLM-generated, cached)
    domain_result = await discover_domain(
        body.goal,
        getattr(body, "background", ""),
        body.learner_id,
    )
    pack_id = domain_result.get("id") if "error" not in domain_result else None
    pack_competencies = domain_result.get("pack_data", {}).get("competencies", []) if pack_id else []

    learner = store["learners"].get(body.learner_id, {
        "id": body.learner_id,
        "name": "Learner",
        "onboarding_complete": False,
    })
    learner["goal"] = body.goal
    learner["background"] = getattr(body, "background", "")
    learner["domain_pack_id"] = pack_id
    store["learners"][body.learner_id] = learner

    _persist_learner(learner)

    # Return domain competencies for self-assessment if available; else fall back to static graph
    if pack_competencies:
        # Prioritise goal skills, then pick foundational ones, limit to 12
        goal_skills = [c for c in pack_competencies if c.get("is_goal_skill")]
        other_skills = [c for c in pack_competencies if not c.get("is_goal_skill")]
        top = (goal_skills + other_skills)[:12]
        assessment_skills = [
            {"name": c["name"], "domain": domain_result.get("domain_name", "general")}
            for c in top
        ]
    else:
        skills = skill_graph.get_all_skills()
        top = [s for s in skills if s.get("difficulty_level", 0.5) <= 0.5][:12]
        assessment_skills = [{"name": s["name"], "domain": s.get("domain", "general")} for s in top]

    return {
        "message": "Goal set",
        "learner_id": body.learner_id,
        "domain_pack_id": pack_id,
        "domain_name": domain_result.get("domain_name"),
        "self_assessment_skills": assessment_skills,
    }


@router.post("/self-assess")
def self_assess(body: SelfAssessmentRequest):
    store = get_memory_store()
    if body.learner_id not in store["learner_skill_states"]:
        store["learner_skill_states"][body.learner_id] = {}

    for item in body.assessments:
        confidence = item.confidence
        alpha = 1.0 + confidence * 3.0
        beta_p = 1.0 + (1.0 - confidence) * 3.0

        state = {
            "learner_id": body.learner_id,
            "skill_name": item.skill_name,
            "alpha": alpha,
            "beta_param": beta_p,
            "mastery_estimate": alpha / (alpha + beta_p),
            "self_assessed_confidence": confidence,
            "evidence_source": "self_report",
            "half_life_days": 30.0,
            "last_practiced_at": None,
            "practice_count": 0,
        }
        store["learner_skill_states"][body.learner_id][item.skill_name] = state
        _persist_skill_state(state)

    # Mark onboarding complete
    learner = store["learners"].get(body.learner_id, {})
    learner["onboarding_complete"] = True
    store["learners"][body.learner_id] = learner
    _persist_learner(learner)

    return {
        "message": "Self-assessment recorded",
        "skills_assessed": len(body.assessments),
    }


@router.post("/clear-progress")
def clear_progress(learner_id: str):
    """Clear all learning data for a learner so they can re-onboard fresh."""
    store = get_memory_store()

    # Clear in-memory state
    store["learner_skill_states"].pop(learner_id, None)
    learner = store["learners"].get(learner_id, {})
    learner["domain_pack_id"] = None
    learner["goal"] = None
    learner["onboarding_complete"] = False
    store["learners"][learner_id] = learner

    # Clear from DB
    try:
        from app.models.db_models import LearnerSkillState, Learner
        db = SessionLocal()
        db.query(LearnerSkillState).filter(
            LearnerSkillState.learner_id == learner_id
        ).delete()
        row = db.get(Learner, learner_id)
        if row:
            row.domain_pack_id = None
            row.goal = None
            row.onboarding_complete = False
        db.commit()
        db.close()
    except Exception as e:
        print(f"[onboarding] clear_progress DB failed: {e}")

    return {"message": "Progress cleared", "learner_id": learner_id}


def _persist_demo_state(learner_id: str, learner: dict, skill_states: dict) -> None:
    _persist_learner(learner)
    for state in skill_states.values():
        _persist_skill_state(state)


@router.post("/load-demo")
def load_demo(learner_id: str = "priya-demo-001"):
    """Load Priya's pre-seeded demo state for instant demo readiness."""
    store = get_memory_store()
    priya_data = load_priya_state()

    learner = {
        "id": learner_id,
        "name": "Priya",
        "goal": "Become an ML Engineer",
        "onboarding_complete": True,
    }
    store["learners"][learner_id] = learner
    store["learner_skill_states"][learner_id] = priya_data
    _persist_demo_state(learner_id, learner, priya_data)

    return {
        "message": "Demo state loaded",
        "learner_id": learner_id,
        "skills_loaded": len(priya_data),
    }


@router.post("/reset-demo")
def reset_demo(learner_id: str = "priya-demo-001"):
    """Reset demo learner to original seed state — reliable for repeated presentations."""
    store = get_memory_store()
    priya_data = load_priya_state()
    learner = {
        "id": learner_id,
        "name": "Priya",
        "goal": "Become an ML Engineer",
        "onboarding_complete": True,
    }
    store["learner_skill_states"][learner_id] = priya_data
    store["learners"][learner_id] = learner
    _persist_demo_state(learner_id, learner, priya_data)
    return {"message": "Demo state reset to original", "learner_id": learner_id}
