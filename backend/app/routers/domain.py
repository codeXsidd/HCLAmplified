"""
Domain discovery API.
POST /api/domain/discover  — generate or retrieve a domain pack from a goal
GET  /api/domain/{pack_id} — retrieve a cached domain pack by ID
"""
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.domain_service import discover_domain, get_pack_by_id

router = APIRouter()


class DomainDiscoverRequest(BaseModel):
    goal: str
    background: str = ""
    learner_id: str = ""


@router.post("/discover")
async def discover(body: DomainDiscoverRequest):
    """
    Generate a domain pack for the given goal.
    Returns cached pack if one already exists for this goal pattern.
    """
    if not body.goal.strip():
        raise HTTPException(status_code=422, detail="goal must not be empty")

    result = await discover_domain(body.goal, body.background, body.learner_id)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    pack_data = result.get("pack_data", {})
    competencies = pack_data.get("competencies", [])
    return {
        "pack_id": result["id"],
        "domain_name": result["domain_name"],
        "competency_count": len(competencies),
        "goal_skills": [c["name"] for c in competencies if c.get("is_goal_skill")],
        "competencies": [
            {
                "name": c.get("name"),
                "difficulty": c.get("difficulty", 0.5),
                "estimated_hours": c.get("estimated_hours", 3.0),
                "is_goal_skill": c.get("is_goal_skill", False),
            }
            for c in competencies
        ],
        "prerequisite_edge_count": len(pack_data.get("prerequisite_edges", [])),
        "transfer_edge_count": len(pack_data.get("transfer_edges", [])),
    }


@router.get("/{pack_id}")
def get_pack(pack_id: str):
    """Retrieve a cached domain pack in full."""
    pack = get_pack_by_id(pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail=f"Domain pack '{pack_id}' not found")
    return pack
