from fastapi import APIRouter
from app.models.schemas import OnboardingGoalRequest, SelfAssessmentRequest
from app.database import get_memory_store, SessionLocal
from app.core.skill_graph import skill_graph
from app.seeds_loader import load_priya_state

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
        row.half_life_days = state["half_life_days"]
        lp = state.get("last_practiced_at")
        row.last_practiced_at = datetime.fromisoformat(lp) if lp else None
        row.practice_count = state["practice_count"]
        db.commit()
        db.close()
    except Exception as e:
        print(f"DB persist skill state failed (non-fatal): {e}")


@router.post("/goal")
def set_goal(body: OnboardingGoalRequest):
    store = get_memory_store()
    if body.learner_id not in store["learners"]:
        store["learners"][body.learner_id] = {
            "id": body.learner_id,
            "name": "Learner",
            "goal": body.goal,
            "onboarding_complete": False,
        }
    else:
        store["learners"][body.learner_id]["goal"] = body.goal

    _persist_learner(store["learners"][body.learner_id])

    skills = skill_graph.get_all_skills()
    top_skills = [s for s in skills if s.get("difficulty_level", 0.5) <= 0.5][:12]

    return {
        "message": "Goal set",
        "learner_id": body.learner_id,
        "self_assessment_skills": [
            {"name": s["name"], "domain": s["domain"]} for s in top_skills
        ],
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
            "half_life_days": 30.0,
            "last_practiced_at": None,
            "practice_count": 0,
        }
        store["learner_skill_states"][body.learner_id][item.skill_name] = state
        _persist_skill_state(state)

    return {
        "message": "Self-assessment recorded",
        "skills_assessed": len(body.assessments),
    }


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
