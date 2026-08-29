import json
import os
from typing import Dict, List, Optional, Any

_TRANSFER_MATRIX_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "seeds", "transfer_matrix.json"
)

_transfer_matrix: Dict[str, Dict[str, Any]] = {}


def _load_transfer_matrix():
    global _transfer_matrix
    try:
        with open(_TRANSFER_MATRIX_PATH, "r") as f:
            data = json.load(f)
        for item in data:
            key = f"{item['source_skill']}::{item['target_skill']}"
            _transfer_matrix[key] = item
    except Exception as e:
        print(f"Warning: Could not load transfer matrix: {e}")


_load_transfer_matrix()


class TransferAnalyzer:
    """
    Computes how much existing skill mastery reduces learning effort for new skills.
    Transfer coefficient: 0 = no help, 1 = already know it.
    Supports both the static ML seed matrix and dynamic domain pack transfer maps.
    """

    def get_transfer_coefficient(
        self, source_skill: str, target_skill: str,
        transfer_map: Optional[Dict] = None,
    ) -> float:
        matrix = transfer_map if transfer_map is not None else _transfer_matrix
        key = f"{source_skill}::{target_skill}"
        entry = matrix.get(key)
        return entry["transfer_coefficient"] if entry else 0.0

    def get_transfer_explanation(
        self, source_skill: str, target_skill: str,
        transfer_map: Optional[Dict] = None,
    ) -> Optional[str]:
        matrix = transfer_map if transfer_map is not None else _transfer_matrix
        key = f"{source_skill}::{target_skill}"
        entry = matrix.get(key)
        return entry.get("explanation") if entry else None

    def compute_effective_prior(
        self,
        target_skill: str,
        learner_states: Dict[str, Dict],
        transfer_map: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """
        Given what the learner knows, compute their effective head-start on target_skill.
        Returns modified Beta prior and human-readable transfer sources.
        """
        total_transfer = 0.0
        transfer_sources = []

        for source_skill, state in learner_states.items():
            source_mastery = state.get("mastery_estimate", 0.0)
            if source_mastery < 0.3:
                continue

            coeff = self.get_transfer_coefficient(source_skill, target_skill, transfer_map)
            if coeff <= 0:
                continue

            effective = source_mastery * coeff
            total_transfer += effective
            explanation = self.get_transfer_explanation(source_skill, target_skill, transfer_map)

            transfer_sources.append(
                {
                    "source_skill": source_skill,
                    "transfer_coefficient": coeff,
                    "source_mastery": round(source_mastery, 3),
                    "effective_transfer": round(effective, 3),
                    "explanation": explanation
                    or f"{source_skill} knowledge transfers to {target_skill}",
                    "time_savings_percent": int(coeff * source_mastery * 70),
                }
            )

        total_transfer = min(total_transfer, 0.65)

        alpha_boost = 1.0 + total_transfer * 5.0
        beta_boost = 1.0 + (1.0 - total_transfer) * 1.5

        return {
            "effective_transfer": round(total_transfer, 3),
            "effective_transfer_percent": int(total_transfer * 100),
            "prior_alpha": round(alpha_boost, 2),
            "prior_beta": round(beta_boost, 2),
            "transfer_sources": sorted(
                transfer_sources,
                key=lambda x: x["effective_transfer"],
                reverse=True,
            ),
        }

    def get_skills_that_transfer_to(self, target_skill: str) -> List[Dict[str, Any]]:
        results = []
        for key, entry in _transfer_matrix.items():
            if entry["target_skill"] == target_skill:
                results.append(entry)
        return sorted(
            results, key=lambda x: x["transfer_coefficient"], reverse=True
        )


transfer_analyzer = TransferAnalyzer()
