from sqlalchemy import Column, String, Float, Integer, Boolean, Text, DateTime, JSON, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


# ── Domain-agnostic tables ────────────────────────────────────────────────────

class DomainPack(Base):
    """LLM-generated domain model for a learning goal. Cached and reusable."""
    __tablename__ = "domain_packs"

    id = Column(String, primary_key=True)           # e.g. "classical-guitar-beginner"
    goal_pattern = Column(Text, nullable=False)      # normalized goal text for matching
    domain_name = Column(String, nullable=False)     # "Classical Guitar"
    level = Column(String, default="general")
    pack_data = Column(JSON, nullable=False)         # full structure: competencies + edges
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    version = Column(Integer, default=1)
    usage_count = Column(Integer, default=0)


class Competency(Base):
    """Individual competency node within a domain pack."""
    __tablename__ = "competencies"

    id = Column(String, primary_key=True)            # e.g. "cg-right-hand-technique"
    domain_pack_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    difficulty = Column(Float, default=0.5)
    estimated_hours = Column(Float, default=3.0)
    is_goal_skill = Column(Boolean, default=False)
    metadata_ = Column("metadata", JSON, default=dict)


class CompetencyEdge(Base):
    """Prerequisite or transfer edge between competencies."""
    __tablename__ = "competency_edges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain_pack_id = Column(String, nullable=False)
    source_id = Column(String, nullable=False)
    target_id = Column(String, nullable=False)
    edge_type = Column(String, nullable=False)       # 'prerequisite' | 'transfer'
    strength = Column(Float, default=0.8)
    transfer_coefficient = Column(Float, nullable=True)
    explanation = Column(Text, nullable=True)
    __table_args__ = (
        UniqueConstraint("domain_pack_id", "source_id", "target_id", "edge_type"),
    )


class AssessmentItemDB(Base):
    """LLM-generated assessment item, cached per competency."""
    __tablename__ = "assessment_items_v2"

    id = Column(String, primary_key=True)
    competency_id = Column(String, nullable=True)
    domain_pack_id = Column(String, nullable=True)
    item_type = Column(String, default="mcq")
    difficulty = Column(Float, default=0.5)
    content = Column(JSON, nullable=False)           # {question, options, correct_answer, explanation}
    generated_at = Column(DateTime(timezone=True), server_default=func.now())


class LearnerGoalCompetency(Base):
    """Which competencies are goal-relevant for a specific learner."""
    __tablename__ = "learner_goal_competencies"

    learner_id = Column(String, primary_key=True)
    competency_id = Column(String, primary_key=True)


# ── Existing tables (preserved for backward compatibility) ────────────────────

class Learner(Base):
    __tablename__ = "learners"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    goal = Column(Text, nullable=True)
    background = Column(Text, nullable=True)
    domain_pack_id = Column(String, nullable=True)   # links to DomainPack
    onboarding_complete = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LearnerSkillState(Base):
    __tablename__ = "learner_skill_states"

    learner_id = Column(String, primary_key=True)
    skill_name = Column(String, primary_key=True)
    competency_id = Column(String, nullable=True)    # links to Competency (nullable for compat)
    alpha = Column(Float, default=1.0)
    beta_param = Column(Float, default=1.0)
    mastery_estimate = Column(Float, default=0.5)
    self_assessed_confidence = Column(Float, nullable=True)
    evidence_source = Column(String, default="none") # none|self_report|diagnostic|practice|inferred
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
