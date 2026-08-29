import random
import uuid
from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel
from app.models.schemas import ResponseSubmit
from app.database import get_memory_store, SessionLocal
from app.core.bayesian_updater import bayesian_updater
from app.core.decay_calculator import decay_calculator
from app.core.adaptive_selector import select_diagnostic_set
from app.seeds_loader import load_assessment_items
from app.services.llm_service import generate_assessment_question, generate_competency_questions


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
_ephemeral_items: dict[str, dict] = {}  # LLM-generated items, keyed by id


def _get_items():
    global _cached_items
    if _cached_items is None:
        _cached_items = load_assessment_items()
    return _cached_items


def _find_item(item_id: str) -> dict | None:
    """Look up an item in seeds first, then ephemeral LLM-generated cache."""
    seed_item = next((i for i in _get_items() if i["id"] == item_id), None)
    return seed_item or _ephemeral_items.get(item_id)


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
                    item = {
                        "id": f"llm-{uuid.uuid4().hex[:8]}",
                        "skill_name": skill,
                        "item_type": "mcq",
                        "difficulty": 0.5,
                        "content": generated,
                    }
                    _ephemeral_items[item["id"]] = item
                    filtered.append(item)
    else:
        filtered = items

    n = min(5, len(filtered))
    selected = filtered[:n] if len(filtered) <= n else random.sample(filtered, n)
    return {"items": selected}


@router.get("/adaptive/{learner_id}")
async def get_adaptive_questions(learner_id: str, n: int = 8):
    """
    Return n adaptively-selected assessment questions for this learner.
    Prioritises competencies with high uncertainty, evidence gaps, or low coverage.
    Generates questions via LLM for domain-pack competencies; falls back to seed items.
    """
    store = get_memory_store()
    raw_states = store["learner_skill_states"].get(learner_id, {})

    # Build learner state map for adaptive selector
    learner_states = {}
    for name, state in raw_states.items():
        stats = bayesian_updater.get_mastery_stats(state.get("alpha", 1.0), state.get("beta_param", 1.0))
        learner_states[name] = {
            **state,
            "confidence": stats["confidence"],
        }

    # Try domain pack items first
    items = []
    try:
        from app.models.db_models import Learner
        db = SessionLocal()
        learner_row = db.get(Learner, learner_id)
        db.close()
        if learner_row and learner_row.domain_pack_id:
            from app.services.domain_service import get_pack_by_id
            pack = get_pack_by_id(learner_row.domain_pack_id)
            if pack:
                competencies = pack["pack_data"].get("competencies", [])
                domain_name = pack.get("domain_name", "")
                for c in competencies:
                    comp_name = c.get("name", "")
                    # Generate (or fetch cached) questions for this competency
                    questions = await generate_competency_questions(
                        comp_name, c.get("description", ""), domain_name, n=2
                    )
                    for i, q in enumerate(questions):
                        gen_item = {
                            "id": f"gen-{uuid.uuid4().hex[:8]}",
                            "skill_name": comp_name,
                            "item_type": "mcq",
                            "difficulty": q.get("difficulty", c.get("difficulty", 0.5)),
                            "content": {
                                "question": q.get("question", ""),
                                "options": q.get("options", []),
                                "correct_answer": q.get("correct_answer", 0),
                                "explanation": q.get("explanation", ""),
                            },
                        }
                        _ephemeral_items[gen_item["id"]] = gen_item
                        items.append(gen_item)
    except Exception as e:
        print(f"[assessment/adaptive] domain pack question gen failed: {e}")

    # Fall back to seed items if no domain items
    if not items:
        items = _get_items()

    # Use adaptive selector
    selected = select_diagnostic_set(items, learner_states, n_questions=n)
    return {"items": selected, "learner_id": learner_id, "adaptive": True}


@router.post("/respond")
def submit_response(body: ResponseSubmit):
    """Score a response, update the Bayesian learner model, return updated state."""
    store = get_memory_store()

    item = _find_item(body.assessment_item_id)

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
    # Determine evidence source: first assessment = diagnostic; subsequent = practice
    prior_source = current.get("evidence_source", "none")
    evidence_source = "practice" if prior_source in ("diagnostic", "practice") else "diagnostic"

    new_state = {
        **current,
        "alpha": new_alpha,
        "beta_param": new_beta,
        "mastery_estimate": new_mastery,
        "half_life_days": new_half_life,
        "last_practiced_at": now,
        "practice_count": current.get("practice_count", 0) + 1,
        "evidence_source": evidence_source,
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
