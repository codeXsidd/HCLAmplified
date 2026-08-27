from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# In-memory store — primary read path for demo speed.
# Postgres is the write-through persistence layer.
_memory_store: dict = {
    "learners": {},
    "learner_skill_states": {},
    "learner_responses": [],
    "strategy_performance": {},
}


def get_memory_store() -> dict:
    return _memory_store
