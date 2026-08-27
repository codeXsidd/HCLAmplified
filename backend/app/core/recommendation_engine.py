from typing import List, Dict, Optional, Any
from app.core.decay_calculator import decay_calculator
from app.core.transfer_analyzer import transfer_analyzer
from app.core.skill_graph import skill_graph

ML_GOAL_SKILLS = [
    "Linear Regression",
    "Logistic Regression",
    "Decision Trees",
    "Random Forests",
    "Gradient Boosting",
    "Neural Network Basics",
    "Backpropagation",
    "Model Evaluation Metrics",
    "Feature Engineering",
    "ML Pipelines",
    "PyTorch Basics",
    "Model Deployment Basics",
]


class RecommendationEngine:
    """
    Priority Score = 0.30*Readiness + 0.25*Urgency + 0.25*Impact + 0.15*Transfer - 0.20*Redundancy
    """

    WEIGHTS = {
        "readiness": 0.30,
        "urgency": 0.25,
        "impact": 0.25,
        "transfer": 0.15,
        "redundancy": -0.20,
    }

    def compute_recommendations(
        self,
        learner_states: Dict[str, Dict],
        goal_skills: Optional[List[str]] = None,
        top_k: int = 5,
    ) -> List[Dict]:
        goal = goal_skills or ML_GOAL_SKILLS
        all_skills = skill_graph.get_all_skills()

        known_skills = set()
        for name, state in learner_states.items():
            eff = decay_calculator.effective_mastery(
                state.get("mastery_estimate", 0),
                state.get("last_practiced_at"),
                state.get("half_life_days", 7),
            )
            if eff >= 0.7:
                known_skills.add(name)

        all_successor_counts = [
            len(skill_graph.get_successors(s["name"])) for s in all_skills
        ]
        max_successors = max(all_successor_counts) if all_successor_counts else 1

        scored = []

        for skill in all_skills:
            name = skill["name"]
            state = learner_states.get(name, {})

            stored_mastery = state.get("mastery_estimate", 0.0)
            last_practiced = state.get("last_practiced_at")
            half_life = state.get("half_life_days", 7.0)

            eff_mastery = decay_calculator.effective_mastery(
                stored_mastery, last_practiced, half_life
            )

            # 1. READINESS
            prereqs = skill_graph.get_prerequisites(name)
            if prereqs:
                ready_count = 0
                for p in prereqs:
                    ps = learner_states.get(p, {})
                    p_eff = decay_calculator.effective_mastery(
                        ps.get("mastery_estimate", 0),
                        ps.get("last_practiced_at"),
                        ps.get("half_life_days", 7),
                    )
                    if p_eff >= 0.6:
                        ready_count += 1
                readiness = ready_count / len(prereqs)
            else:
                readiness = 1.0

            if readiness < 0.5 and stored_mastery < 0.2:
                continue

            # 2. URGENCY
            d_urgency = decay_calculator.decay_urgency(
                stored_mastery, last_practiced, half_life
            )
            successors = skill_graph.get_successors(name)
            blocking = len(successors) / max_successors
            urgency = 0.6 * d_urgency + 0.4 * blocking

            # 3. IMPACT
            reachable = skill_graph.get_reachable_skills(name)
            goal_overlap = len(reachable & set(goal))
            impact = goal_overlap / len(goal) if goal else 0.0
            if name in goal:
                impact = min(impact + 0.2, 1.0)

            # 4. TRANSFER
            transfer_data = transfer_analyzer.compute_effective_prior(
                name, learner_states
            )
            transfer_bonus = transfer_data["effective_transfer"]

            # 5. REDUNDANCY
            redundancy = eff_mastery

            score = (
                self.WEIGHTS["readiness"] * readiness
                + self.WEIGHTS["urgency"] * urgency
                + self.WEIGHTS["impact"] * impact
                + self.WEIGHTS["transfer"] * transfer_bonus
                + self.WEIGHTS["redundancy"] * redundancy
            )

            primary_reason = self._primary_reason(
                d_urgency, transfer_bonus, readiness, impact, eff_mastery
            )
            urgency_level = (
                "critical"
                if d_urgency > 0.4
                else "high"
                if d_urgency > 0.2
                else "medium"
                if urgency > 0.1
                else "low"
            )

            base_hours = skill.get("estimated_hours", 3.0)
            reduced_hours = base_hours * (1.0 - transfer_bonus * 0.65)

            scored.append(
                {
                    "skill_id": name,
                    "skill_name": name,
                    "score": round(score, 4),
                    "primary_reason": primary_reason,
                    "explanation": self._build_explanation(
                        name, d_urgency, transfer_data, readiness, impact, eff_mastery
                    ),
                    "factors": {
                        "readiness": round(readiness, 3),
                        "urgency": round(urgency, 3),
                        "decay_urgency": round(d_urgency, 3),
                        "impact": round(impact, 3),
                        "transfer": round(transfer_bonus, 3),
                        "redundancy": round(redundancy, 3),
                    },
                    "estimated_time_hours": round(reduced_hours, 1),
                    "transfer_sources": transfer_data["transfer_sources"],
                    "urgency_level": urgency_level,
                }
            )

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

    def _primary_reason(
        self,
        decay_urgency: float,
        transfer: float,
        readiness: float,
        impact: float,
        current_mastery: float,
    ) -> str:
        if decay_urgency > 0.35:
            return "URGENT: Skill is decaying — refresh now before it's lost"
        if transfer > 0.35:
            return "TRANSFER READY: You already know most of this via related skills"
        if 0.0 < current_mastery < 0.6:
            return "IN PROGRESS: Continue building this skill"
        if impact > 0.3:
            return "HIGH IMPACT: Unlocks many skills on your path"
        if readiness > 0.8:
            return "READY: All prerequisites satisfied"
        return "NEXT STEP: Logical progression on your learning path"

    def _build_explanation(
        self,
        skill_name: str,
        decay_urgency: float,
        transfer_data: Dict,
        readiness: float,
        impact: float,
        current_mastery: float,
    ) -> str:
        parts = []
        if decay_urgency > 0.3:
            parts.append(
                f"Your {skill_name} knowledge is fading. "
                f"A 15-minute refresh now preserves what took hours to learn."
            )
        if transfer_data["effective_transfer_percent"] > 20:
            sources = transfer_data["transfer_sources"][:2]
            src_names = [s["source_skill"] for s in sources]
            pct = transfer_data["effective_transfer_percent"]
            parts.append(
                f"Your {' and '.join(src_names)} knowledge gives you a "
                f"{pct}% head-start — you already understand the foundations."
            )
        if impact > 0.2:
            parts.append(
                f"Mastering this unlocks multiple skills on your ML Engineer path."
            )
        if not parts:
            parts.append(
                f"This is the natural next step given your current knowledge state."
            )
        return " ".join(parts)


recommendation_engine = RecommendationEngine()
