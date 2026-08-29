from fastapi import APIRouter
from app.database import get_memory_store
from app.core.decay_calculator import decay_calculator
from app.core.bayesian_updater import bayesian_updater
from app.core.transfer_analyzer import transfer_analyzer
from app.core.skill_graph import skill_graph
from app.models.schemas import (
    KnowledgeGraphOut,
    KnowledgeGraphNode,
    KnowledgeGraphLink,
    LearnerInsightsOut,
    CalibrationDataPoint,
)

router = APIRouter()


def _enrich_state(skill_name: str, state: dict) -> dict:
    stored_mastery = state.get("mastery_estimate", 0.0)
    last_practiced = state.get("last_practiced_at")
    half_life = state.get("half_life_days", 7.0)
    self_assessed = state.get("self_assessed_confidence")
    practice_count = state.get("practice_count", 0)

    recall_prob = decay_calculator.recall_probability(last_practiced, half_life)
    eff_mastery = decay_calculator.effective_mastery(stored_mastery, last_practiced, half_life)
    d_urgency = decay_calculator.decay_urgency(stored_mastery, last_practiced, half_life)
    days_since = decay_calculator.days_since_practice(last_practiced)
    label = decay_calculator.state_label(
        eff_mastery, d_urgency, self_assessed, stored_mastery, practice_count
    )
    color = decay_calculator.state_color(label)

    calibration_gap = None
    if self_assessed is not None:
        calibration_gap = round(self_assessed - eff_mastery, 3)

    stats = bayesian_updater.get_mastery_stats(
        state.get("alpha", 1.0), state.get("beta_param", 1.0)
    )

    return {
        **state,
        "skill_name": skill_name,
        "effective_mastery": eff_mastery,
        "recall_probability": recall_prob,
        "confidence_interval_low": stats["ci_low"],
        "confidence_interval_high": stats["ci_high"],
        "decay_urgency": d_urgency,
        "days_since_practice": days_since,
        "state_label": label,
        "color": color,
        "calibration_gap": calibration_gap,
    }


@router.get("/{learner_id}")
def get_knowledge_state(learner_id: str):
    store = get_memory_store()
    raw_states = store["learner_skill_states"].get(learner_id, {})

    if learner_id != _DEMO_LEARNER_ID:
        active_graph = _get_active_graph(learner_id)
        if active_graph is None:
            return {"learner_id": learner_id, "skills": {}}
        # Filter to skills in current domain pack — removes stale data from old domains
        pack_names = {s["name"] for s in active_graph.get_all_skills()}
        raw_states = {k: v for k, v in raw_states.items() if k in pack_names}

    enriched = {
        name: _enrich_state(name, state) for name, state in raw_states.items()
    }
    return {"learner_id": learner_id, "skills": enriched}


_DEMO_LEARNER_ID = "priya-demo-001"


def _get_active_graph(learner_id: str):
    """Return DomainGraph if learner has a domain pack; static graph only for demo learner; None otherwise."""
    try:
        from app.models.db_models import Learner
        from app.database import SessionLocal
        from app.core.domain_graph import DomainGraph
        from app.services.domain_service import get_pack_by_id
        db = SessionLocal()
        row = db.get(Learner, learner_id)
        if row and row.domain_pack_id:
            pack = get_pack_by_id(row.domain_pack_id)
            if pack:
                db.close()
                return DomainGraph(pack["pack_data"])
            # Orphaned domain_pack_id — pack was never saved to DB; clear it so
            # the learner is prompted to re-onboard rather than stuck on an empty graph
            print(f"[knowledge_state] Orphaned domain_pack_id '{row.domain_pack_id}' for {learner_id} — clearing")
            row.domain_pack_id = None
            db.commit()
            store = get_memory_store()
            learner = store["learners"].get(learner_id, {})
            learner["domain_pack_id"] = None
            store["learners"][learner_id] = learner
        db.close()
    except Exception as e:
        print(f"[knowledge_state] _get_active_graph failed for {learner_id}: {e}")
    return skill_graph if learner_id == _DEMO_LEARNER_ID else None


@router.get("/{learner_id}/graph", response_model=KnowledgeGraphOut)
def get_knowledge_graph(learner_id: str):
    store = get_memory_store()
    raw_states = store["learner_skill_states"].get(learner_id, {})
    active_graph = _get_active_graph(learner_id)

    if active_graph is None:
        return {"nodes": [], "links": []}

    nodes = []
    for skill in active_graph.get_all_skills():
        name = skill["name"]
        state = raw_states.get(name)
        if state:
            enriched = _enrich_state(name, state)
        else:
            enriched = {
                "skill_name": name,
                "mastery_estimate": 0.0,
                "effective_mastery": 0.0,
                "recall_probability": 0.0,
                "decay_urgency": 0.0,
                "state_label": "unknown",
                "color": "#6b7280",
                "confidence_interval_low": 0.0,
                "confidence_interval_high": 1.0,
                "self_assessed_confidence": None,
                "calibration_gap": None,
                "practice_count": 0,
                "half_life_days": 7.0,
                "last_practiced_at": None,
                "days_since_practice": None,
            }

        nodes.append(
            KnowledgeGraphNode(
                id=name,
                name=name,
                domain=skill.get("domain", "general"),
                mastery_estimate=enriched.get("mastery_estimate", 0.0),
                effective_mastery=enriched["effective_mastery"],
                recall_probability=enriched["recall_probability"],
                decay_urgency=enriched["decay_urgency"],
                state_label=enriched["state_label"],
                color=enriched["color"],
                size=10 + enriched["effective_mastery"] * 20,
                self_assessed_confidence=enriched.get("self_assessed_confidence"),
                calibration_gap=enriched.get("calibration_gap"),
            )
        )

    links = []
    for edge in active_graph.get_all_edges():
        link_type = edge.get("link_type", "prerequisite")
        color = "#3b82f6" if link_type == "transfer" else "#4b5563"
        links.append(
            KnowledgeGraphLink(
                source=edge["source"],
                target=edge["target"],
                link_type=link_type,
                strength=edge.get("strength", 1.0),
                color=color,
                transfer_coefficient=edge.get("transfer_coefficient"),
                explanation=edge.get("explanation"),
            )
        )

    return KnowledgeGraphOut(nodes=nodes, links=links)


@router.get("/{learner_id}/insights", response_model=LearnerInsightsOut)
def get_insights(learner_id: str):
    insights_graph = _get_active_graph(learner_id)

    if learner_id != _DEMO_LEARNER_ID and insights_graph is None:
        return LearnerInsightsOut(
            total_skills_started=0, solid_skills=0, decaying_skills=0,
            overconfident_skills=0, learning_skills=0,
            calibration_data=[], critical_decays=[], transfer_opportunities=[],
        )

    store = get_memory_store()
    raw_states = store["learner_skill_states"].get(learner_id, {})

    # Filter to current domain pack skills only
    if learner_id != _DEMO_LEARNER_ID and insights_graph:
        pack_names = {s["name"] for s in insights_graph.get_all_skills()}
        raw_states = {k: v for k, v in raw_states.items() if k in pack_names}

    enriched_list = [_enrich_state(name, state) for name, state in raw_states.items()]

    solid = [s for s in enriched_list if s["state_label"] == "solid"]
    decaying = [s for s in enriched_list if s["state_label"] == "decaying"]
    overconfident = [s for s in enriched_list if s["state_label"] == "overconfident"]
    learning = [s for s in enriched_list if s["state_label"] == "learning"]

    calibration_data = [
        CalibrationDataPoint(
            skill_name=s["skill_name"],
            self_assessed=s.get("self_assessed_confidence") or 0.0,
            actual_mastery=s["effective_mastery"],
            gap=s.get("calibration_gap") or 0.0,
            state_label=s["state_label"],
        )
        for s in enriched_list
        if s.get("self_assessed_confidence") is not None
    ]

    critical_decays = [
        s["skill_name"]
        for s in sorted(decaying, key=lambda x: x["decay_urgency"], reverse=True)[:3]
    ]

    learner_state_map = {
        name: {"mastery_estimate": s.get("mastery_estimate", 0)}
        for name, s in raw_states.items()
    }
    transfer_opportunities = []
    for skill in (insights_graph.get_all_skills() if insights_graph else []):
        if skill["name"] not in raw_states:
            t = transfer_analyzer.compute_effective_prior(skill["name"], learner_state_map)
            if t["effective_transfer"] > 0.2:
                transfer_opportunities.append(
                    {
                        "skill": skill["name"],
                        "effective_transfer_percent": t["effective_transfer_percent"],
                        "sources": [s["source_skill"] for s in t["transfer_sources"][:2]],
                    }
                )

    return LearnerInsightsOut(
        total_skills_started=len(raw_states),
        solid_skills=len(solid),
        decaying_skills=len(decaying),
        overconfident_skills=len(overconfident),
        learning_skills=len(learning),
        calibration_data=calibration_data,
        critical_decays=critical_decays,
        transfer_opportunities=sorted(
            transfer_opportunities,
            key=lambda x: x["effective_transfer_percent"],
            reverse=True,
        )[:5],
    )
