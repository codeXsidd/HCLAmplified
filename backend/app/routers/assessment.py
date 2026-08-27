import random
import uuid
from datetime import datetime
from fastapi import APIRouter
from app.models.schemas import ResponseSubmit
from app.database import get_memory_store, SessionLocal
from app.core.bayesian_updater import bayesian_updater
from app.core.decay_calculator import decay_calculator
from app.seeds_loader import load_assessment_items
from app.services.llm_service import generate_assessment_question


def _persist_skill_state(state: dict) -> None:
    """Write-through: upsert skill state to Postgres (best-effort, never raises)."""
    try:
        from app.models.db_models import LearnerSkillState
        from datetime import timezone
        db = SessionLocal()
        row = db.get(LearnerSkillState, (state["learner_id"], state["skill_name"]))
        lp = state.get("last_practiced_at")
        lp_dt = datetime.fromisoformat(lp) if lp else None
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
        row.last_practiced_at = lp_dt
        row.practice_count = state["practice_count"]
        db.commit()
        db.close()
    except Exception as e:
        print(f"DB persist skill state failed (non-fatal): {e}")


def _persist_response(learner_id: str, item_id: str, skill_name: str,
                      response: object, score: float,
                      confidence_before: float | None, time_ms: int | None) -> None:
    """Write learner response to Postgres (best-effort)."""
    try:
        from app.models.db_models import LearnerResponse
        db = SessionLocal()
        db.add(LearnerResponse(
            learner_id=learner_id,
            assessment_item_id=item_id,
            skill_name=skill_name,
            response=response,
            score=score,
            confidence_before=confidence_before,
            response_time_ms=time_ms,
        ))
        db.commit()
        db.close()
    except Exception as e:
        print(f"DB persist response failed (non-fatal): {e}")

router = APIRouter()

_cached_items = None


def _get_items():
    global _cached_items
    if _cached_items is None:
        _cached_items = load_assessment_items()
    return _cached_items


@router.get("/diagnostic/{learner_id}")
async def get_diagnostic(learner_id: str, skill_names: str = ""):
    """Return diagnostic questions for specified comma-separated skill names.
    Tries LLM generation for skills not in seeds; falls back to seeds gracefully.
    """
    items = _get_items()
    targets = [s.strip() for s in skill_names.split(",") if s.strip()] if skill_names else []

    if targets:
        filtered = [item for item in items if item["skill_name"] in targets]

        # For skills not covered by seeds, attempt LLM generation
        covered = {item["skill_name"] for item in filtered}
        for skill in targets:
            if skill not in covered:
                generated = await generate_assessment_question(skill, 0.5)
                if generated:
                    filtered.append({
                        "id": f"llm-{uuid.uuid4().hex[:8]}",
                        "skill_name": skill,
                        "item_type": "mcq",
                        "difficulty": 0.5,
                        "content": generated,
                    })
    else:
        filtered = items

    n = min(5, len(filtered))
    selected = filtered[:n] if len(filtered) <= n else random.sample(filtered, n)
    return {"items": selected}


@router.post("/respond")
def submit_response(body: ResponseSubmit):
    """Score a response, update the Bayesian learner model, return updated state."""
    store = get_memory_store()
    items = _get_items()

    item = next((i for i in items if i["id"] == body.assessment_item_id), None)

    score = 0.0
    explanation = "Response recorded."
    if item:
        correct_answer = item["content"].get("correct_answer", "")
        if item["item_type"] == "mcq":
            resp = body.response
            if isinstance(resp, int):
                score = 1.0 if resp == correct_answer else 0.0
            else:
                score = (
                    1.0
                    if str(resp).strip().lower() == str(correct_answer).strip().lower()
                    else 0.0
                )
            explanation = item["content"].get("explanation", "")
        else:
            score = float(body.response) if isinstance(body.response, (int, float)) else 0.5

    if body.learner_id not in store["learner_skill_states"]:
        store["learner_skill_states"][body.learner_id] = {}

    current = store["learner_skill_states"][body.learner_id].get(
        body.skill_id,
        {
            "learner_id": body.learner_id,
            "skill_name": body.skill_id,
            "alpha": 1.0,
            "beta_param": 1.0,
            "mastery_estimate": 0.5,
            "self_assessed_confidence": body.confidence_before,
            "half_life_days": 7.0,
            "last_practiced_at": None,
            "practice_count": 0,
        },
    )

    difficulty = item["difficulty"] if item else 0.5
    updated_params = bayesian_updater.update(
        current["alpha"],
        current["beta_param"],
        score,
        difficulty,
        body.response_time_ms or 10000,
    )
    new_half_life = bayesian_updater.update_half_life(current["half_life_days"], score)
    new_alpha = updated_params["alpha"]
    new_beta = updated_params["beta_param"]
    new_mastery = new_alpha / (new_alpha + new_beta)

    now = datetime.utcnow().isoformat()
    new_state = {
        **current,
        "alpha": new_alpha,
        "beta_param": new_beta,
        "mastery_estimate": new_mastery,
        "half_life_days": new_half_life,
        "last_practiced_at": now,
        "practice_count": current.get("practice_count", 0) + 1,
    }
    store["learner_skill_states"][body.learner_id][body.skill_id] = new_state

    # Write-through to Postgres (best-effort, non-blocking)
    _persist_skill_state(new_state)
    _persist_response(
        body.learner_id, body.assessment_item_id, body.skill_id,
        body.response, score, body.confidence_before, body.response_time_ms
    )

    recall = decay_calculator.recall_probability(now, new_half_life)
    eff_mastery = new_mastery * recall
    d_urgency = decay_calculator.decay_urgency(new_mastery, now, new_half_life)
    label = decay_calculator.state_label(
        eff_mastery, d_urgency, body.confidence_before, new_mastery, new_state["practice_count"]
    )
    stats = bayesian_updater.get_mastery_stats(new_alpha, new_beta)

    calibration_gap = None
    if body.confidence_before is not None:
        calibration_gap = round(body.confidence_before - eff_mastery, 3)

    return {
        "score": score,
        "correct": score >= 0.7,
        "explanation": explanation,
        "updated_state": {
            "learner_id": body.learner_id,
            "skill_id": body.skill_id,
            "skill_name": body.skill_id,
            "alpha": new_alpha,
            "beta_param": new_beta,
            "mastery_estimate": round(new_mastery, 4),
            "effective_mastery": round(eff_mastery, 4),
            "recall_probability": recall,
            "confidence_interval_low": stats["ci_low"],
            "confidence_interval_high": stats["ci_high"],
            "self_assessed_confidence": body.confidence_before,
            "calibration_gap": calibration_gap,
            "last_practiced_at": now,
            "half_life_days": round(new_half_life, 2),
            "days_since_practice": 0.0,
            "decay_urgency": 0.0,
            "practice_count": new_state["practice_count"],
            "state_label": label,
        },
    }
