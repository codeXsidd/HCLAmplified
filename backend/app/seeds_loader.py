import json
import os
from typing import Dict, Any, List
from datetime import datetime, timedelta

_SEEDS_DIR = os.path.join(os.path.dirname(__file__), "..", "seeds")


def load_priya_state() -> Dict[str, Any]:
    """Load Priya's pre-seeded demo learner state, converting relative days to timestamps."""
    path = os.path.join(_SEEDS_DIR, "priya_state.json")
    with open(path, "r") as f:
        raw = json.load(f)

    now = datetime.utcnow()
    result = {}
    for skill_name, state in raw.items():
        # Pop days_ago so we don't store it as a field
        days_ago = state.get("days_ago", None)
        last_practiced = (
            (now - timedelta(days=days_ago)).isoformat() if days_ago is not None else None
        )

        alpha = state.get("alpha", 1.0)
        beta_p = state.get("beta_param", 1.0)
        mastery = alpha / (alpha + beta_p)

        result[skill_name] = {
            "learner_id": "priya-demo-001",
            "skill_name": skill_name,
            "alpha": alpha,
            "beta_param": beta_p,
            "mastery_estimate": round(mastery, 4),
            "self_assessed_confidence": state.get("self_assessed_confidence"),
            "half_life_days": state.get("half_life_days", 7.0),
            "last_practiced_at": last_practiced,
            "practice_count": state.get("practice_count", 3),
        }
    return result


def load_assessment_items() -> List[Dict[str, Any]]:
    """Load pre-built assessment items from seed file."""
    path = os.path.join(_SEEDS_DIR, "assessment_items.json")
    with open(path, "r") as f:
        return json.load(f)
