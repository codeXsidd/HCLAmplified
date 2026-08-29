"""
LLM service using Groq API (qwen3.8-27b).
All responses are cached to avoid re-calling Groq during dev/demo.
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


def _cache_key(system: str, prompt: str) -> str:
    return hashlib.md5(f"{system}|||{prompt}".encode()).hexdigest()[:16]


_load_cache()


async def llm_call(
    prompt: str,
    default: str = "",
    max_tokens: int = 800,
    system: str = "",
    temperature: float = 0.4,
) -> str:
    """Call Groq API with cache. Returns cached result or default on failure."""
    key = _cache_key(system, prompt)
    if key in _cache:
        return _cache[key]

    if not settings.GROQ_API_KEY:
        return default

    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        msg = client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            max_tokens=max_tokens,
            temperature=temperature,
            messages=messages,
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
    urgency_level: str,
) -> str:
    transfer_str = ""
    if transfer_sources:
        t = transfer_sources[0]
        transfer_str = f" Your {t.get('source_skill','')} knowledge saves {t.get('time_savings_percent',0)}% of the effort."

    defaults = {
        "critical": f"[URGENT] {skill_name} is actively decaying — recall <50%. 15 min now saves hours later.{transfer_str}",
        "high": f"[HIGH IMPACT] {skill_name} unlocks {int(factors.get('impact',0)*100)}% of your remaining path with {int(factors.get('readiness',0)*100)}% prerequisites met.{transfer_str}",
        "medium": f"[NEXT STEP] {skill_name} prerequisites are satisfied and it moves you closer to your goal.{transfer_str}",
        "low": f"[AVAILABLE] {skill_name} is ready to learn — solid addition to your path.{transfer_str}",
    }

    r, u, im, tr = (
        factors.get("readiness", 0),
        factors.get("urgency", 0),
        factors.get("impact", 0),
        factors.get("transfer", 0),
    )
    prompt = (
        f'Why study "{skill_name}" next?\n'
        f"Readiness:{r:.2f} Urgency:{u:.2f} Impact:{im:.2f} Transfer:{tr:.2f} Level:{urgency_level}"
        f"{transfer_str}"
    )

    return await llm_call(
        prompt,
        default=defaults.get(urgency_level, defaults["low"]),
        max_tokens=80,
        system="You are a learning coach. In 1-2 sentences (≤40 words), explain why this skill is recommended. Be specific — mention decay, transfer, or prerequisites if high. No bullet points.",
        temperature=0.5,
    )


async def generate_assessment_question(
    skill_name: str, difficulty: float = 0.5
) -> Optional[dict]:
    """Generate a single MCQ that tests understanding. Returns None on failure."""
    level = "advanced" if difficulty > 0.7 else "intermediate" if difficulty > 0.4 else "foundational"
    prompt = (
        f'ONE {level}-level MCQ testing deep understanding (not recall) of "{skill_name}".\n'
        f'JSON only: {{"question":"...","options":["A","B","C","D"],"correct_answer":0,"explanation":"brief"}}\n'
        f"correct_answer = 0-based index."
    )
    result = await llm_call(
        prompt,
        default="",
        max_tokens=300,
        system="Output ONLY valid JSON. No markdown, no explanation outside the JSON.",
        temperature=0.3,
    )
    if not result:
        return None
    try:
        text = result.strip()
        if "```" in text:
            import re
            m = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
            text = m.group(1).strip() if m else text.split("```")[1]
        return json.loads(text.strip())
    except Exception:
        return None


async def generate_competency_questions(
    competency_name: str,
    competency_description: str = "",
    domain_name: str = "",
    n: int = 3,
) -> list[dict]:
    """Generate n MCQs for a competency. Cached per (competency, domain, n)."""
    desc = f" ({competency_description})" if competency_description else ""
    domain = domain_name or "this domain"
    prompt = (
        f'{n} MCQs testing understanding of "{competency_name}"{desc} in {domain}.\n'
        f"Vary difficulty across easy/medium/hard.\n"
        f'JSON array only: [{{"question":"...","options":["A","B","C","D"],"correct_answer":0,"difficulty":0.5,"explanation":"brief"}}]'
    )
    result = await llm_call(
        prompt,
        default="[]",
        max_tokens=1200,
        system="Output ONLY a valid JSON array. No markdown, no text outside the array.",
        temperature=0.3,
    )
    if not result or result == "[]":
        return []
    try:
        import re
        text = result.strip()
        if "```" in text:
            m = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
            text = m.group(1).strip() if m else text
        m = re.search(r"\[[\s\S]+\]", text)
        if m:
            text = m.group(0)
        questions = json.loads(text)
        return questions if isinstance(questions, list) else []
    except Exception:
        return []


async def explain_calibration_gap(
    skill_name: str, self_assessed: float, actual: float
) -> str:
    gap_pct = int((self_assessed - actual) * 100)
    prompt = (
        f'"{skill_name}": self-rated {int(self_assessed*100)}%, actual {int(actual*100)}% '
        f"(gap: {gap_pct}pp). One sentence — what this means and what to do."
    )
    default = (
        f"You're {gap_pct}% more confident than your actual performance on "
        f"{skill_name} — review the fundamentals before moving forward."
    )
    return await llm_call(
        prompt,
        default=default,
        max_tokens=50,
        system="You are a calibration coach. One sentence, ≤25 words. Direct and actionable.",
        temperature=0.4,
    )
