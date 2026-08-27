from dotenv import load_dotenv
import os

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/skillpulse")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    DEMO_LEARNER_ID: str = os.getenv("DEMO_LEARNER_ID", "priya-demo-001")


settings = Settings()
