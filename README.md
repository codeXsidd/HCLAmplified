# SkillPulse — HCL Amplified

An intelligent learning platform that models learner knowledge as a **living Bayesian system** — not a static checklist. SkillPulse tracks skill mastery, detects decay, identifies transfer opportunities between skills, and delivers personalized learning recommendations.

## Key Features

- **Living Knowledge State** — Bayesian probability model per skill with confidence intervals that updates on every interaction
- **Skill Decay Detection** — Exponential forgetting curves reveal which skills are silently fading over time
- **Transfer Intelligence** — Detects cross-skill transfer (e.g., SQL knowledge = 45% of Pandas already learned) to collapse learning time
- **Confidence Calibration** — Catches Dunning-Kruger gaps by comparing self-assessed confidence to actual mastery
- **AI Learning Coach** — Contextual assistant grounded in the learner's current knowledge state (powered by Groq/Qwen)
- **Smart Recommendations** — Multi-factor ranking algorithm: Readiness + Urgency + Impact + Transfer - Redundancy

## Architecture

```
HCLAmplified/
├── frontend/          Next.js 14 + TypeScript + Tailwind CSS + Radix UI
├── backend/           FastAPI + SQLAlchemy + PostgreSQL (Neon)
└── docs/              API reference
```

### Backend (`/backend`)

| Layer | Purpose |
|-------|---------|
| `app/core/bayesian_updater.py` | Bayesian alpha/beta updates on assessment responses |
| `app/core/decay_calculator.py` | Exponential forgetting curves and half-life tracking |
| `app/core/transfer_analyzer.py` | Cross-skill transfer coefficient detection |
| `app/core/recommendation_engine.py` | Multi-factor recommendation scoring |
| `app/core/skill_graph.py` | Prerequisite and transfer graph (NetworkX) |
| `app/services/llm_service.py` | Groq LLM integration for explanations and diagnostics |
| `app/routers/` | REST API endpoints (onboarding, assessment, knowledge-state, recommendations, assistant) |

### Frontend (`/frontend`)

Next.js app with pages for:
- Dashboard — overview of learner progress
- Knowledge Graph — interactive force-directed skill visualization (react-force-graph-2d)
- Insights — calibration data, decay alerts, transfer opportunities
- Assessment — diagnostic MCQ items with Bayesian state updates
- Learning Path — personalized recommendations
- AI Assistant — contextual learning coach chat

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- pnpm
- PostgreSQL (or a Neon database URL)
- Groq API key

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=postgresql://user:pass@host/dbname
GROQ_API_KEY=your-groq-api-key
```

Create a `.env.local` file in the `frontend/` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# API: http://localhost:8000
# Swagger UI: http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
# App: http://localhost:3000
```

### Seed Data

The app comes pre-loaded with a demo learner (`priya-demo-001`) — an ML Engineer journey with 13 skills at various mastery/decay states. The demo state loads automatically on server startup.

To reset the demo:
```
POST /api/onboarding/reset-demo?learner_id=priya-demo-001
```

## API Reference

Full API documentation is available at:
- **Interactive**: `http://localhost:8000/docs` (Swagger UI)
- **Static**: [docs/api.md](docs/api.md)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, Radix UI, Recharts, Framer Motion |
| Backend | FastAPI, SQLAlchemy, Pydantic, NetworkX, SciPy/NumPy |
| Database | PostgreSQL (Neon) |
| LLM | Groq (Qwen 3.8-27B) |
| Data Fetching | SWR |
| Visualization | react-force-graph-2d, Recharts |

## How It Works

1. **Onboarding** — Learner sets a goal and self-assesses confidence on suggested skills
2. **Knowledge Modeling** — Each skill is modeled with Bayesian alpha/beta parameters; mastery = alpha / (alpha + beta)
3. **Decay Tracking** — Half-life based forgetting curves track recall probability over time
4. **Assessment** — LLM-generated diagnostic questions update the Bayesian model on each response
5. **Transfer Detection** — Graph analysis identifies how mastery in one skill accelerates learning another
6. **Recommendations** — Scored by: `0.30×Readiness + 0.25×Urgency + 0.25×Impact + 0.15×Transfer − 0.20×Redundancy`
