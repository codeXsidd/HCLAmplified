from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class LearnerCreate(BaseModel):
    name: str
    goal: Optional[str] = None


class LearnerOut(BaseModel):
    id: str
    name: str
    goal: Optional[str] = None
    onboarding_complete: bool = False


class SkillOut(BaseModel):
    id: str
    name: str
    domain: str
    description: Optional[str] = None
    difficulty_level: float = 0.5
    estimated_hours: float = 3.0


class LearnerSkillStateOut(BaseModel):
    learner_id: str
    skill_id: str
    skill_name: str
    alpha: float
    beta_param: float
    mastery_estimate: float
    effective_mastery: float
    recall_probability: float
    confidence_interval_low: float
    confidence_interval_high: float
    self_assessed_confidence: Optional[float] = None
    calibration_gap: Optional[float] = None
    last_practiced_at: Optional[str] = None
    half_life_days: float
    days_since_practice: Optional[float] = None
    decay_urgency: float
    practice_count: int
    state_label: str


class OnboardingGoalRequest(BaseModel):
    learner_id: str
    goal: str
    background: Optional[str] = None


class SelfAssessmentItem(BaseModel):
    skill_name: str
    confidence: float


class SelfAssessmentRequest(BaseModel):
    learner_id: str
    assessments: List[SelfAssessmentItem]


class AssessmentItemOut(BaseModel):
    id: str
    skill_id: str
    skill_name: str
    item_type: str
    difficulty: float
    content: Dict[str, Any]


class ResponseSubmit(BaseModel):
    learner_id: str
    assessment_item_id: str
    skill_id: str
    response: Any
    confidence_before: Optional[float] = None
    response_time_ms: Optional[int] = 10000


class ResponseResult(BaseModel):
    score: float
    correct: bool
    explanation: str
    updated_state: LearnerSkillStateOut


class RecommendationOut(BaseModel):
    skill_id: str
    skill_name: str
    score: float
    primary_reason: str
    explanation: str
    factors: Dict[str, float]
    estimated_time_hours: float
    transfer_sources: List[Dict[str, Any]] = []
    urgency_level: str


class KnowledgeGraphNode(BaseModel):
    id: str
    name: str
    domain: str
    mastery_estimate: float
    effective_mastery: float
    recall_probability: float
    decay_urgency: float
    state_label: str
    color: str
    size: float
    self_assessed_confidence: Optional[float] = None
    calibration_gap: Optional[float] = None


class KnowledgeGraphLink(BaseModel):
    source: str
    target: str
    link_type: str
    strength: float
    color: str
    transfer_coefficient: Optional[float] = None
    explanation: Optional[str] = None


class KnowledgeGraphOut(BaseModel):
    nodes: List[KnowledgeGraphNode]
    links: List[KnowledgeGraphLink]


class CalibrationDataPoint(BaseModel):
    skill_name: str
    self_assessed: float
    actual_mastery: float
    gap: float
    state_label: str


class LearnerInsightsOut(BaseModel):
    total_skills_started: int
    solid_skills: int
    decaying_skills: int
    overconfident_skills: int
    learning_skills: int
    calibration_data: List[CalibrationDataPoint]
    critical_decays: List[str]
    transfer_opportunities: List[Dict[str, Any]]
