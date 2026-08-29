from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import learners, knowledge_state, assessment, recommendations, onboarding, assistant, domain
from app.database import engine, Base, get_memory_store, SessionLocal
from app.seeds_loader import load_priya_state


def _run_schema_migrations():
    """Add new columns to existing tables that were created before the v2 schema.
    Uses ADD COLUMN IF NOT EXISTS so it's idempotent and safe to run every startup.
    """
    migrations = [
        "ALTER TABLE learners ADD COLUMN IF NOT EXISTS background TEXT",
        "ALTER TABLE learners ADD COLUMN IF NOT EXISTS domain_pack_id VARCHAR",
        "ALTER TABLE learners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()",
        "ALTER TABLE learner_skill_states ADD COLUMN IF NOT EXISTS evidence_source VARCHAR DEFAULT 'none'",
        "ALTER TABLE learner_skill_states ADD COLUMN IF NOT EXISTS competency_id VARCHAR",
        "ALTER TABLE learner_skill_states ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()",
    ]
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            for sql in migrations:
                conn.execute(text(sql))
            conn.commit()
        print("[OK] Schema migrations applied")
    except Exception as e:
        print(f"[WARN] Schema migration failed (non-fatal): {e}")


def _sync_db_to_memory():
    """Load persisted learners and skill states from Postgres into in-memory store."""
    from app.models.db_models import Learner, LearnerSkillState
    store = get_memory_store()
    try:
        db = SessionLocal()
        for row in db.query(Learner).all():
            store["learners"][row.id] = {
                "id": row.id,
                "name": row.name,
                "goal": row.goal,
                "onboarding_complete": row.onboarding_complete,
            }
        for row in db.query(LearnerSkillState).all():
            if row.learner_id not in store["learner_skill_states"]:
                store["learner_skill_states"][row.learner_id] = {}
            store["learner_skill_states"][row.learner_id][row.skill_name] = {
                "learner_id": row.learner_id,
                "skill_name": row.skill_name,
                "alpha": row.alpha,
                "beta_param": row.beta_param,
                "mastery_estimate": row.mastery_estimate,
                "self_assessed_confidence": row.self_assessed_confidence,
                "half_life_days": row.half_life_days,
                "last_practiced_at": row.last_practiced_at.isoformat() if row.last_practiced_at else None,
                "practice_count": row.practice_count,
            }
        db.close()
        print(f"[OK] Loaded {len(store['learners'])} learners from Postgres")
    except Exception as e:
        print(f"[WARN] Could not load from Postgres (tables may not exist yet): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if they don't exist
    try:
        from app.models import db_models  # noqa: ensure models are registered
        Base.metadata.create_all(bind=engine)
        print("[OK] Database tables ready")
    except Exception as e:
        print(f"[WARN] Could not create tables: {e}")

    # Add new columns to existing tables (idempotent)
    _run_schema_migrations()

    # Load persisted data from Postgres into memory
    _sync_db_to_memory()

    # Always ensure demo learner is available
    store = get_memory_store()
    if "priya-demo-001" not in store["learner_skill_states"]:
        store["learners"]["priya-demo-001"] = {
            "id": "priya-demo-001",
            "name": "Priya",
            "goal": "Become an ML Engineer",
            "onboarding_complete": True,
        }
        store["learner_skill_states"]["priya-demo-001"] = load_priya_state()
        print("[OK] Demo state pre-loaded for priya-demo-001")
    else:
        print("[OK] Demo state restored from Postgres")

    yield


app = FastAPI(
    title="SkillPulse API",
    version="1.0.0",
    description="Living learner knowledge model -- Bayesian inference, decay, transfer intelligence",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(learners.router, prefix="/api/learners", tags=["learners"])
app.include_router(knowledge_state.router, prefix="/api/knowledge-state", tags=["knowledge-state"])
app.include_router(assessment.router, prefix="/api/assessment", tags=["assessment"])
app.include_router(recommendations.router, prefix="/api/recommendations", tags=["recommendations"])
app.include_router(onboarding.router, prefix="/api/onboarding", tags=["onboarding"])
app.include_router(assistant.router, prefix="/api/assistant", tags=["assistant"])
app.include_router(domain.router, prefix="/api/domain", tags=["domain"])


@app.get("/")
def root():
    return {"status": "ok", "app": "SkillPulse API", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}
