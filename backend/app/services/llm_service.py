"""
LLM service using Groq API (llama-3.3-70b-versatile).
All responses are cached to JSON file to ensure demo reliability.
If GROQ_API_KEY is missing or API fails, serves from cache or default.
"""
import json
import os
import hashlib
from typing import Optional
from app.config import settings

_CACHE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "seeds", "llm_cache.json")
_cache: dict = {}


def _load_cache():
    global _cache
    try:
        if os.path.exists(_CACHE_PATH):
            with open(_CACHE_PATH, "r", encoding="utf-8") as f:
                _cache = json.load(f)
    except Exception:
        _cache = {}


def _save_cache():
    try:
        with open(_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(_cache, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Cache save failed: {e}")


def _cache_key(prompt: str) -> str:
    return hashlib.md5(prompt.encode()).hexdigest()[:16]


_load_cache()


async def llm_call(prompt: str, default: str = "") -> str:
    """Call Groq API with cache. Returns cached result or default on failure."""
    key = _cache_key(prompt)
    if key in _cache:
        return _cache[key]

    if not settings.GROQ_API_KEY:
        return default

    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        msg = client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}]
        )
        result = msg.choices[0].message.content
        _cache[key] = result
        _save_cache()
        return result
    except Exception as e:
        print(f"LLM call failed: {e}")
        return default


async def explain_recommendation(
    skill_name: str,
    factors: dict,
    transfer_sources: list,
    urgency_level: str
) -> str:
    """Generate a natural language explanation for a recommendation."""
    transfer_str = ""
    if transfer_sources:
        t = transfer_sources[0]
        transfer_str = (
            f"The learner's {t.get('source_skill', '')} knowledge "
            f"transfers {t.get('time_savings_percent', 0)}% of the effort needed."
        )

    default_explanations = {
        "critical": (
            f"[URGENT] {skill_name} is actively decaying -- recall probability has dropped "
            f"below 50%. Every day of delay increases re-learning cost. "
            f"15 minutes now saves hours later. {transfer_str}"
        ),
        "high": (
            f"[HIGH IMPACT] {skill_name} is a high-impact next step -- unlocks "
            f"{int(factors.get('impact', 0) * 100)}% of your remaining path "
            f"with {int(factors.get('readiness', 0) * 100)}% prerequisites met. {transfer_str}"
        ),
        "medium": (
            f"[NEXT STEP] {skill_name} is logically next: prerequisites satisfied "
            f"and it moves you closer to your ML Engineer goal. {transfer_str}"
        ),
        "low": (
            f"[AVAILABLE] {skill_name} is available whenever you're ready -- "
            f"a solid addition to your path. {transfer_str}"
        ),
    }

    prompt = (
        f'You are an intelligent learning coach. Explain in 1-2 sentences (max 50 words) '
        f'why a learner should study "{skill_name}" next.\n\n'
        f"Factors (0-1 scale):\n"
        f"- Readiness (prerequisites met): {factors.get('readiness', 0):.2f}\n"
        f"- Urgency (decay + blocking): {factors.get('urgency', 0):.2f}\n"
        f"- Decay urgency specifically: {factors.get('decay_urgency', 0):.2f}\n"
        f"- Impact (goal skills unlocked): {factors.get('impact', 0):.2f}\n"
        f"- Transfer (existing knowledge helps): {factors.get('transfer', 0):.2f}\n"
        f"- Transfer details: {transfer_str}\n"
        f"- Urgency level: {urgency_level}\n\n"
        f"Be specific, not generic. Mention decay, transfer, or impact if relevant. "
        f"No bullet points."
    )

    return await llm_call(
        prompt,
        default_explanations.get(urgency_level, default_explanations["low"])
    )


async def generate_assessment_question(
    skill_name: str, difficulty: float = 0.5
) -> Optional[dict]:
    """Generate a diagnostic MCQ question for a skill. Returns None on failure."""
    difficulty_label = (
        "advanced" if difficulty > 0.7
        else "intermediate" if difficulty > 0.4
        else "foundational"
    )

    prompt = (
        f'Generate ONE {difficulty_label}-level multiple choice question that tests '
        f'UNDERSTANDING (not recall) of "{skill_name}".\n\n'
        f"The question should distinguish someone who truly understands from someone "
        f"who just memorized.\n\n"
        f"Return ONLY valid JSON (no markdown, no explanation):\n"
        f'{{"question": "...", "options": ["A", "B", "C", "D"], '
        f'"correct_answer": 0, "explanation": "Brief explanation."}}\n\n'
        f"correct_answer is the index (0-3) of the correct option."
    )

    result = await llm_call(prompt, "")
    if not result:
        return None
    try:
        text = result.strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())
    except Exception:
        return None


async def explain_calibration_gap(
    skill_name: str, self_assessed: float, actual: float
) -> str:
    """Generate insight text for a confidence calibration gap."""
    gap_pct = int((self_assessed - actual) * 100)
    prompt = (
        f'A learner rated themselves {int(self_assessed * 100)}% confident in '
        f'"{skill_name}" but diagnostic performance shows {int(actual * 100)}% actual '
        f"mastery — a gap of {gap_pct} percentage points.\n\n"
        f"Write ONE sentence (max 25 words) explaining why this matters and what to do. "
        f"Be direct and helpful."
    )
    default = (
        f"You're {gap_pct}% more confident than your actual performance on "
        f"{skill_name} — review the fundamentals before moving forward."
    )
    return await llm_call(prompt, default)
