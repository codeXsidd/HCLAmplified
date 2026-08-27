import math
from datetime import datetime
from typing import Optional


class DecayCalculator:
    """
    Exponential forgetting curve: P(recall) = 2^(-t / h)
    t = days elapsed since last practice
    h = half-life in days (personalized per learner per skill)
    """

    def recall_probability(
        self, last_practiced_at: Optional[str], half_life_days: float
    ) -> float:
        """Probability the learner still recalls this skill right now."""
        if last_practiced_at is None:
            return 0.0

        try:
            if isinstance(last_practiced_at, str):
                last_dt = datetime.fromisoformat(
                    last_practiced_at.replace("Z", "+00:00")
                )
                last_dt = last_dt.replace(tzinfo=None)
            else:
                last_dt = last_practiced_at

            days_elapsed = (datetime.utcnow() - last_dt).total_seconds() / 86400
        except Exception:
            return 1.0

        days_elapsed = max(days_elapsed, 0.0)
        recall = math.pow(2, -days_elapsed / max(half_life_days, 0.1))
        return round(min(max(recall, 0.0), 1.0), 4)

    def effective_mastery(
        self,
        stored_mastery: float,
        last_practiced_at: Optional[str],
        half_life_days: float,
    ) -> float:
        """Actual mastery the learner has right now, accounting for forgetting."""
        recall = self.recall_probability(last_practiced_at, half_life_days)
        return round(stored_mastery * recall, 4)

    def decay_urgency(
        self,
        stored_mastery: float,
        last_practiced_at: Optional[str],
        half_life_days: float,
    ) -> float:
        """
        How urgently does this skill need refreshing? (0–1)
        Spikes when stored mastery is high but recall is dropping.
        """
        if stored_mastery < 0.4:
            return 0.0  # Not well-learned enough to worry about

        recall = self.recall_probability(last_practiced_at, half_life_days)
        mastery_at_risk = stored_mastery * (1.0 - recall)
        return round(min(mastery_at_risk, 1.0), 4)

    def days_since_practice(self, last_practiced_at: Optional[str]) -> Optional[float]:
        if last_practiced_at is None:
            return None
        try:
            if isinstance(last_practiced_at, str):
                last_dt = datetime.fromisoformat(
                    last_practiced_at.replace("Z", "+00:00")
                )
                last_dt = last_dt.replace(tzinfo=None)
            else:
                last_dt = last_practiced_at
            return round(
                (datetime.utcnow() - last_dt).total_seconds() / 86400, 1
            )
        except Exception:
            return None

    def state_label(
        self,
        effective_mastery: float,
        decay_urgency: float,
        self_assessed: Optional[float],
        stored_mastery: float,
        practice_count: int,
    ) -> str:
        """Classify the skill state for UI color-coding."""
        if (
            self_assessed is not None
            and self_assessed > 0.6
            and effective_mastery < 0.4
        ):
            return "overconfident"

        if decay_urgency > 0.3:
            return "decaying"

        if effective_mastery >= 0.7:
            return "solid"

        if effective_mastery >= 0.3 or practice_count > 0:
            return "learning"

        return "unknown"

    def state_color(self, label: str) -> str:
        colors = {
            "solid": "#22c55e",
            "decaying": "#ef4444",
            "overconfident": "#f59e0b",
            "learning": "#a855f7",
            "unknown": "#6b7280",
        }
        return colors.get(label, "#6b7280")


decay_calculator = DecayCalculator()
