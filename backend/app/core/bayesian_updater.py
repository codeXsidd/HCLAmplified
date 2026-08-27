import math
from typing import Dict


class BayesianUpdater:
    """
    Models learner mastery as Beta(alpha, beta) distribution.
    - Prior: Beta(1, 1) = uniform (no information)
    - Correct answer: alpha += weight
    - Incorrect answer: beta += weight
    - Weight = difficulty_factor * time_factor
    """

    def update(
        self,
        alpha: float,
        beta_param: float,
        score: float,
        item_difficulty: float = 0.5,
        response_time_ms: int = 10000,
    ) -> Dict[str, float]:
        """Update Beta distribution parameters based on a new response."""
        difficulty_weight = 0.5 + item_difficulty  # [0.5, 1.5]

        expected_time_ms = 30000
        time_ratio = expected_time_ms / max(response_time_ms, 1000)
        time_factor = min(max(time_ratio, 0.5), 1.5)

        evidence_weight = difficulty_weight * time_factor

        new_alpha = alpha + score * evidence_weight
        new_beta = beta_param + (1.0 - score) * evidence_weight

        return {"alpha": new_alpha, "beta_param": new_beta}

    def get_mastery_stats(self, alpha: float, beta_param: float) -> Dict[str, float]:
        """Compute mastery estimate and 90% credible interval from Beta parameters."""
        total = alpha + beta_param
        mean = alpha / total

        variance = (alpha * beta_param) / (total * total * (total + 1))
        std = math.sqrt(max(variance, 0.0))

        ci_low = max(0.0, mean - 1.645 * std)
        ci_high = min(1.0, mean + 1.645 * std)

        interval_width = ci_high - ci_low
        confidence = max(0.0, 1.0 - interval_width)

        return {
            "mastery_estimate": round(mean, 4),
            "ci_low": round(ci_low, 4),
            "ci_high": round(ci_high, 4),
            "confidence": round(confidence, 4),
            "n_observations": max(0, int(total - 2)),
        }

    def update_half_life(self, current_half_life: float, score: float) -> float:
        """Successful practice strengthens memory (longer half-life); failure shrinks it."""
        if score >= 0.8:
            return min(current_half_life * (1.0 + 0.5 * score), 180.0)
        elif score >= 0.5:
            return current_half_life * 1.1
        else:
            return max(current_half_life * 0.6, 1.0)


bayesian_updater = BayesianUpdater()
