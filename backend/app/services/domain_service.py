"""
Domain discovery service.
Given a learner goal (free text), generates a structured domain pack via LLM,
caches it in PostgreSQL, and returns it for reuse across learners.
"""
import json
import re
import uuid
from typing import Optional
from app.database import SessionLocal
from app.services.llm_service import llm_call


def _normalize_goal(goal: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace for cache key matching."""
    goal = goal.lower().strip()
    goal = re.sub(r"[^\w\s]", "", goal)
    return re.sub(r"\s+", " ", goal)


def _validate_pack(pack: dict) -> list[str]:
    """Return list of validation errors, empty if pack is valid."""
    errors = []
    competencies = pack.get("competencies", [])
    if len(competencies) < 5:
        errors.append(f"Too few competencies: {len(competencies)} (need ≥ 5)")

    ids = {c.get("id") for c in competencies}
    for edge in pack.get("prerequisite_edges", []):
        if edge.get("source") not in ids:
            errors.append(f"Edge source '{edge.get('source')}' not in competencies")
            break
        if edge.get("target") not in ids:
            errors.append(f"Edge target '{edge.get('target')}' not in competencies")
            break

    # Check for cycles (simple DFS)
    adj: dict[str, list[str]] = {c_id: [] for c_id in ids}
    for edge in pack.get("prerequisite_edges", []):
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        if src in adj:
            adj[src].append(tgt)

    visited: set[str] = set()
    in_stack: set[str] = set()

    def has_cycle(node: str) -> bool:
        visited.add(node)
        in_stack.add(node)
        for neighbor in adj.get(node, []):
            if neighbor not in visited:
                if has_cycle(neighbor):
                    return True
            elif neighbor in in_stack:
                return True
        in_stack.discard(node)
        return False

    for node in ids:
        if node not in visited:
            if has_cycle(node):
                errors.append("Prerequisite edges contain a cycle")
                break

    return errors


async def _generate_domain_pack(goal: str, background: str = "") -> Optional[dict]:
    """Call LLM to generate a domain pack. Returns parsed dict or None on failure."""
    prompt = (
        f"You are a learning domain expert. Given a learner's goal, generate a structured competency model.\n\n"
        f"Goal: \"{goal}\"\n"
        f"Background: \"{background or 'not specified'}\"\n\n"
        f"Generate a JSON object with exactly these keys:\n"
        f"1. \"domain_name\": short human-readable name for this domain (e.g. \"Classical Guitar\")\n"
        f"2. \"level\": one of beginner, intermediate, advanced, general\n"
        f"3. \"competencies\": array of 25-40 competencies, each with:\n"
        f"   - \"id\": short kebab-case unique identifier (e.g. \"right-hand-technique\")\n"
        f"   - \"name\": human-readable name\n"
        f"   - \"description\": one sentence\n"
        f"   - \"difficulty\": float 0.0-1.0\n"
        f"   - \"estimated_hours\": typical hours to learn\n"
        f"   - \"is_goal_skill\": true if directly required to achieve the stated goal\n"
        f"4. \"prerequisite_edges\": array of {{\"source\": id, \"target\": id, \"strength\": 0.0-1.0}}\n"
        f"   meaning: you need source before you can learn target\n"
        f"5. \"transfer_edges\": array of {{\"source\": id, \"target\": id, \"coefficient\": 0.0-0.6, \"explanation\": \"one sentence\"}}\n"
        f"   meaning: knowing source meaningfully accelerates learning target\n\n"
        f"Rules:\n"
        f"- Competency ids must be unique kebab-case strings\n"
        f"- Prerequisite edges must form a DAG (no cycles)\n"
        f"- Transfer coefficient max 0.6 (never 1.0 — it just helps, not replaces)\n"
        f"- Include foundational skills even if learner may already know them\n"
        f"- Return ONLY valid JSON, no markdown, no explanation text"
    )

    default_pack = {
        "domain_name": "Learning Path",
        "level": "general",
        "competencies": [
            {"id": "foundations", "name": "Foundations", "description": "Core foundational concepts.",
             "difficulty": 0.3, "estimated_hours": 5, "is_goal_skill": True},
            {"id": "intermediate", "name": "Intermediate Skills", "description": "Building on foundations.",
             "difficulty": 0.5, "estimated_hours": 10, "is_goal_skill": True},
            {"id": "advanced", "name": "Advanced Application", "description": "Applying skills in context.",
             "difficulty": 0.7, "estimated_hours": 15, "is_goal_skill": True},
        ],
        "prerequisite_edges": [
            {"source": "foundations", "target": "intermediate", "strength": 0.9},
            {"source": "intermediate", "target": "advanced", "strength": 0.9},
        ],
        "transfer_edges": [],
    }

    result = await llm_call(prompt, json.dumps(default_pack), max_tokens=3000)
    if not result:
        return default_pack

    pack = _try_parse_json(result)
    if pack:
        return pack

    # Retry with a stricter, more concise prompt
    print("[domain_service] Retrying with concise prompt due to parse failure")
    retry_prompt = (
        f"Return ONLY a valid JSON object (no markdown, no explanation) for this learning goal: \"{goal}\"\n\n"
        f"Required structure:\n"
        f'{{"domain_name":"...","level":"beginner","competencies":['
        f'{{"id":"skill-1","name":"Skill Name","description":"One sentence.","difficulty":0.3,"estimated_hours":5,"is_goal_skill":true}},'
        f"... 15-25 total competencies ...],"
        f'"prerequisite_edges":[{{"source":"skill-1","target":"skill-2","strength":0.8}}],'
        f'"transfer_edges":[]}}\n\n'
        f"IMPORTANT: Return valid JSON only. Start with {{ and end with }}."
    )
    result2 = await llm_call(retry_prompt, json.dumps(default_pack), max_tokens=2000)
    if result2:
        pack = _try_parse_json(result2)
        if pack:
            return pack

    print("[domain_service] Both attempts failed, using default pack")
    return default_pack


def _try_parse_json(text: str) -> Optional[dict]:
    """Try to parse JSON from LLM output with multiple recovery strategies."""
    text = text.strip()

    # Strip markdown code fences
    if "```" in text:
        match = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
        if match:
            text = match.group(1).strip()

    # Extract the outermost JSON object
    start = text.find("{")
    if start == -1:
        return None
    text = text[start:]

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try truncating to last valid complete array item or object close
    # Walk backwards from end to find a valid JSON substring
    for end in range(len(text), max(len(text) - 200, 0), -1):
        candidate = text[:end]
        # Try closing any open structures
        for suffix in ["", "}", "]}", "}]}", "}]}}"]:
            try:
                return json.loads(candidate + suffix)
            except json.JSONDecodeError:
                continue

    return None


def _pack_id_from_goal(goal_normalized: str) -> str:
    """Generate a URL-safe ID from normalized goal text."""
    slug = re.sub(r"\s+", "-", goal_normalized)[:50]
    slug = re.sub(r"[^\w-]", "", slug)
    return slug or f"domain-{uuid.uuid4().hex[:8]}"


def _find_existing_pack(goal_normalized: str) -> Optional[dict]:
    """Check if a domain pack already exists for this goal (exact or close match)."""
    try:
        from app.models.db_models import DomainPack
        db = SessionLocal()
        rows = db.query(DomainPack).all()
        db.close()
        for row in rows:
            # Exact normalized match
            if _normalize_goal(row.goal_pattern) == goal_normalized:
                return {"id": row.id, "domain_name": row.domain_name, "pack_data": row.pack_data}
            # Substring match (e.g. "guitarist" matches "become a classical guitarist")
            stored_words = set(_normalize_goal(row.goal_pattern).split())
            goal_words = set(goal_normalized.split())
            overlap = len(stored_words & goal_words) / max(len(goal_words), 1)
            if overlap >= 0.6:
                return {"id": row.id, "domain_name": row.domain_name, "pack_data": row.pack_data}
    except Exception as e:
        print(f"[domain_service] DB lookup failed: {e}")
    return None


def _save_pack_to_db(pack_id: str, goal: str, goal_normalized: str, pack: dict) -> None:
    """Persist domain pack and its competencies/edges to PostgreSQL."""
    try:
        from app.models.db_models import DomainPack, Competency, CompetencyEdge
        db = SessionLocal()

        # Save domain pack row
        row = DomainPack(
            id=pack_id,
            goal_pattern=goal_normalized,
            domain_name=pack.get("domain_name", "Learning Domain"),
            level=pack.get("level", "general"),
            pack_data=pack,
        )
        db.merge(row)

        # Save competencies
        for c in pack.get("competencies", []):
            comp_id = f"{pack_id}::{c['id']}"
            comp = Competency(
                id=comp_id,
                domain_pack_id=pack_id,
                name=c.get("name", c["id"]),
                description=c.get("description"),
                difficulty=c.get("difficulty", 0.5),
                estimated_hours=c.get("estimated_hours", 3.0),
                is_goal_skill=c.get("is_goal_skill", False),
            )
            db.merge(comp)

        # Save edges
        for edge in pack.get("prerequisite_edges", []):
            e = CompetencyEdge(
                domain_pack_id=pack_id,
                source_id=f"{pack_id}::{edge['source']}",
                target_id=f"{pack_id}::{edge['target']}",
                edge_type="prerequisite",
                strength=edge.get("strength", 0.8),
            )
            db.add(e)

        for edge in pack.get("transfer_edges", []):
            e = CompetencyEdge(
                domain_pack_id=pack_id,
                source_id=f"{pack_id}::{edge['source']}",
                target_id=f"{pack_id}::{edge['target']}",
                edge_type="transfer",
                strength=edge.get("coefficient", 0.3),
                transfer_coefficient=edge.get("coefficient", 0.3),
                explanation=edge.get("explanation"),
            )
            db.add(e)

        db.commit()
        db.close()
        print(f"[domain_service] Saved domain pack '{pack_id}' with "
              f"{len(pack.get('competencies', []))} competencies")
    except Exception as e:
        print(f"[domain_service] Failed to save pack to DB: {e}")


async def discover_domain(goal: str, background: str = "", learner_id: str = "") -> dict:
    """
    Main entry point. Given a goal string, return a domain pack.
    Uses cache if available; otherwise generates via LLM.
    """
    goal_normalized = _normalize_goal(goal)

    # Try cache first
    existing = _find_existing_pack(goal_normalized)
    if existing:
        print(f"[domain_service] Cache hit for goal: '{goal}'")
        return existing

    # Generate new domain pack
    print(f"[domain_service] Generating domain pack for: '{goal}'")
    pack = await _generate_domain_pack(goal, background)
    if not pack:
        return {"error": "Failed to generate domain pack"}

    # Validate
    errors = _validate_pack(pack)
    if errors:
        print(f"[domain_service] Validation errors (proceeding anyway): {errors}")

    pack_id = _pack_id_from_goal(goal_normalized)

    # Attach pack_id to competency IDs for namespacing
    for c in pack.get("competencies", []):
        c["_qualified_id"] = f"{pack_id}::{c['id']}"

    # Persist to DB
    _save_pack_to_db(pack_id, goal, goal_normalized, pack)

    return {
        "id": pack_id,
        "domain_name": pack.get("domain_name", "Learning Domain"),
        "pack_data": pack,
    }


def get_pack_by_id(pack_id: str) -> Optional[dict]:
    """Retrieve a cached domain pack by ID."""
    try:
        from app.models.db_models import DomainPack
        db = SessionLocal()
        row = db.get(DomainPack, pack_id)
        db.close()
        if row:
            return {"id": row.id, "domain_name": row.domain_name, "pack_data": row.pack_data}
    except Exception as e:
        print(f"[domain_service] get_pack_by_id failed: {e}")
    return None


def get_goal_competencies(pack: dict) -> list[str]:
    """Return list of competency names that are goal skills in this domain pack."""
    competencies = pack.get("pack_data", {}).get("competencies", [])
    return [c["name"] for c in competencies if c.get("is_goal_skill")]
