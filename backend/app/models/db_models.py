from sqlalchemy import Column, String, Float, Integer, Boolean, Text, DateTime, JSON
from sqlalchemy.sql import func
from app.database import Base


class Learner(Base):
    __tablename__ = "learners"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    goal = Column(Text, nullable=True)
    onboarding_complete = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LearnerSkillState(Base):
    __tablename__ = "learner_skill_states"

    learner_id = Column(String, primary_key=True)
    skill_name = Column(String, primary_key=True)
    alpha = Column(Float, default=1.0)
    beta_param = Column(Float, default=1.0)
    mastery_estimate = Column(Float, default=0.5)
    self_assessed_confidence = Column(Float, nullable=True)
    half_life_days = Column(Float, default=7.0)
    last_practiced_at = Column(DateTime(timezone=True), nullable=True)
    practice_count = Column(Integer, default=0)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class LearnerResponse(Base):
    __tablename__ = "learner_responses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    learner_id = Column(String, nullable=False)
    assessment_item_id = Column(String, nullable=False)
    skill_name = Column(String, nullable=False)
    response = Column(JSON, nullable=True)
    score = Column(Float, nullable=False)
    confidence_before = Column(Float, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
