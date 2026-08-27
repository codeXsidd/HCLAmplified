import uuid
from fastapi import APIRouter
from app.models.schemas import LearnerCreate, LearnerOut
from app.database import get_memory_store

router = APIRouter()


@router.post("", response_model=LearnerOut)
def create_learner(body: LearnerCreate):
    store = get_memory_store()
    learner_id = str(uuid.uuid4())
    learner = {
        "id": learner_id,
        "name": body.name,
        "goal": body.goal,
        "onboarding_complete": False,
    }
    store["learners"][learner_id] = learner
    return learner


@router.get("/{learner_id}", response_model=LearnerOut)
def get_learner(learner_id: str):
    store = get_memory_store()
    learner = store["learners"].get(learner_id)
    if not learner:
        return {
            "id": learner_id,
            "name": "Priya",
            "goal": "Become an ML Engineer",
            "onboarding_complete": True,
        }
    return learner
