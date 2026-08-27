"""
Seed Neon PostgreSQL with Priya's demo state and verify the writes.
Run from backend/: python seed_neon.py
"""
import os, sys, json
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("[ERROR] DATABASE_URL not set in .env"); sys.exit(1)

from sqlalchemy import (
    create_engine, Column, String, Float, Integer, Boolean,
    DateTime, Text, MetaData, Table, inspect, text
)
from sqlalchemy.orm import declarative_base, Session

engine = create_engine(DATABASE_URL)
Base = declarative_base()

# ── Models ────────────────────────────────────────────────────────────────────

class Learner(Base):
    __tablename__ = "learners"
    id                  = Column(String, primary_key=True)
    name                = Column(String, nullable=False)
    goal                = Column(Text, default="")
    background          = Column(Text, default="")
    onboarding_complete = Column(Boolean, default=False)
    created_at          = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at          = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class LearnerSkillState(Base):
    __tablename__ = "learner_skill_states"
    id                      = Column(Integer, primary_key=True, autoincrement=True)
    learner_id              = Column(String, nullable=False)
    skill_name              = Column(String, nullable=False)
    alpha                   = Column(Float, default=1.0)
    beta_param              = Column(Float, default=1.0)
    mastery_estimate        = Column(Float, default=0.5)
    self_assessed_confidence= Column(Float, nullable=True)
    half_life_days          = Column(Float, default=7.0)
    last_practiced_at       = Column(DateTime(timezone=True), nullable=True)
    practice_count          = Column(Integer, default=0)
    created_at              = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at              = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

# ── Priya's seed data ─────────────────────────────────────────────────────────

PRIYA_SKILLS = [
    # (skill_name, alpha, beta, mastery, self_confidence, half_life, days_ago)
    ("Python Basics",         18.0, 2.0,  0.90, 0.92, 45.0, 3),
    ("Data Structures",       12.0, 3.0,  0.80, 0.82, 35.0, 7),
    ("NumPy Arrays",           8.0, 4.0,  0.67, 0.70, 20.0, 14),
    ("SQL Queries",            6.0, 5.0,  0.55, 0.70, 15.0, 60),   # decaying
    ("Linear Algebra Basics",  3.0, 7.0,  0.30, 0.80, 10.0, 30),   # overconfident
    ("Probability Theory",     4.0, 6.0,  0.40, 0.45, 12.0, 20),
    ("Pandas DataFrames",      2.0, 8.0,  0.20, 0.25,  7.0, 90),   # not started / decaying
    ("Machine Learning Basics",1.0, 9.0,  0.10, 0.15,  7.0, None),
    ("Deep Learning Basics",   1.0, 9.0,  0.10, 0.10,  7.0, None),
    ("Statistics",             5.0, 5.0,  0.50, 0.55, 14.0, 25),
    ("Data Visualization",     3.0, 7.0,  0.30, 0.35,  10.0, 45),
    ("Feature Engineering",    1.0, 9.0,  0.10, 0.10,   7.0, None),
    ("Model Evaluation",       1.0, 9.0,  0.10, 0.10,   7.0, None),
]

def run():
    print("\n[1/4] Creating tables in Neon...")
    Base.metadata.create_all(bind=engine)
    print("      Tables: learners, learner_skill_states — OK")

    now = datetime.now(timezone.utc)

    with Session(engine) as db:
        print("\n[2/4] Upserting Priya (priya-demo-001)...")
        existing = db.get(Learner, "priya-demo-001")
        if existing:
            existing.goal = "Become an ML Engineer"
            existing.onboarding_complete = True
            existing.updated_at = now
            print("      Updated existing Priya row")
        else:
            db.add(Learner(
                id="priya-demo-001",
                name="Priya",
                goal="Become an ML Engineer",
                background="2 years Python dev, some SQL, basic stats",
                onboarding_complete=True,
            ))
            print("      Inserted new Priya row")

        print(f"\n[3/4] Writing {len(PRIYA_SKILLS)} skill states...")
        for skill_name, alpha, beta, mastery, confidence, half_life, days_ago in PRIYA_SKILLS:
            # Delete existing row if any
            db.execute(
                text("DELETE FROM learner_skill_states WHERE learner_id=:lid AND skill_name=:sk"),
                {"lid": "priya-demo-001", "sk": skill_name}
            )
            from datetime import timedelta
            practiced_at = (now - timedelta(days=days_ago)) if days_ago is not None else None
            db.add(LearnerSkillState(
                learner_id="priya-demo-001",
                skill_name=skill_name,
                alpha=alpha,
                beta_param=beta,
                mastery_estimate=mastery,
                self_assessed_confidence=confidence,
                half_life_days=half_life,
                last_practiced_at=practiced_at,
                practice_count=max(1, int(alpha + beta - 2)),
            ))
            print(f"      {skill_name:<30} mastery={mastery:.0%}  conf={confidence:.0%}")

        db.commit()
        print("\n      Committed all changes.")

        # ── Verify ────────────────────────────────────────────────────────────
        print("\n[4/4] Verifying — reading back from Neon...")

        learner = db.get(Learner, "priya-demo-001")
        print(f"\n      Learner : {learner.id}")
        print(f"      Name    : {learner.name}")
        print(f"      Goal    : {learner.goal}")
        print(f"      Onboard : {learner.onboarding_complete}")

        rows = db.execute(
            text("SELECT skill_name, mastery_estimate, self_assessed_confidence, half_life_days "
                 "FROM learner_skill_states WHERE learner_id='priya-demo-001' "
                 "ORDER BY mastery_estimate DESC")
        ).fetchall()

        print(f"\n      Skills in DB ({len(rows)}):")
        print(f"      {'Skill':<30} {'Mastery':>8} {'Conf':>6} {'Half-life':>10}")
        print(f"      {'-'*58}")
        for row in rows:
            print(f"      {row.skill_name:<30} {row.mastery_estimate:>7.0%} {row.self_assessed_confidence:>6.0%} {row.half_life_days:>8.0f}d")

        assert len(rows) == len(PRIYA_SKILLS), f"Expected {len(PRIYA_SKILLS)} rows, got {len(rows)}"

    print(f"\n[OK] All {len(PRIYA_SKILLS)} skill states confirmed in Neon PostgreSQL.")
    print("[OK] Database is live and ready for deployment.\n")

if __name__ == "__main__":
    run()
