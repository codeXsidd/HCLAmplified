"""
Adaptive question selector.
Picks the next assessment item that maximises information gain given current
learner state — without full IRT, using a practical weighted formula.
"""
from typing import List, Dict, Optional
import math


def select_next_question(
    available_items: List[Dict],
    learner_states: Dict[str, Dict],
    already_tested: set,
) -> Optional[Dict]:
    """
    Score each available item and return the highest-value one.

    info_value = 0.40 × uncertainty
               + 0.25 × evidence_gap
               + 0.20 × difficulty_match
               + 0.15 × coverage_bonus

    Parameters
    ----------
    available_items   : list of assessment item dicts with 'skill_name', 'difficulty', 'id'
    learner_states    : {skill_name: state_dict} with 'mastery_estimate', 'confidence',
                        'evidence_source' (defaults fine if missing)
    already_tested    : set of skill_names tested this session
    """
    if not available_items:
        return None

    best_item = None
    best_score = -1.0

    for item in available_items:
        skill = item.get("skill_name", "")
        state = learner_states.get(skill, {})

        mastery = state.get("mastery_estimate", 0.5)
        confidence = state.get("confidence", 0.5)
        evidence_source = state.get("evidence_source", "none")

        # Uncertainty: high when confidence interval is wide (low observations)
        alpha = state.get("alpha", 1.0)
        beta = state.get("beta_param", 1.0)
        total = alpha + beta
        variance = (alpha * beta) / (total * total * (total + 1))
        uncertainty = min(math.sqrt(max(variance, 0.0)) * 4.0, 1.0)

        # Evidence gap: how much we don't know from reliable sources
        evidence_weight = {
            "none": 1.0,
            "self_report": 0.7,
            "inferred": 0.5,
            "diagnostic": 0.2,
            "practice": 0.1,
        }
        evidence_gap = evidence_weight.get(evidence_source, 0.5)

        # Difficulty match: best if item difficulty ≈ current mastery (zone of proximal dev)
        item_difficulty = item.get("difficulty", 0.5)
        difficulty_match = 1.0 - abs(item_difficulty - mastery)

        # Coverage bonus: prefer skills not yet tested this session
        coverage = 0.3 if skill in already_tested else 1.0

        info_value = (
            0.40 * uncertainty
            + 0.25 * evidence_gap
            + 0.20 * difficulty_match
            + 0.15 * coverage
        )

        if info_value > best_score:
            best_score = info_value
            best_item = item

    return best_item


def select_diagnostic_set(
    available_items: List[Dict],
    learner_states: Dict[str, Dict],
    n_questions: int = 8,
) -> List[Dict]:
    """
    Select a diverse set of n_questions for a diagnostic session.
    Uses greedy sequential selection so each pick accounts for the previous ones.
    """
    selected = []
    tested: set = set()
    pool = list(available_items)

    for _ in range(n_questions):
        if not pool:
            break
        item = select_next_question(pool, learner_states, tested)
        if not item:
            break
        selected.append(item)
        tested.add(item.get("skill_name", ""))
        pool.remove(item)

    return selected
