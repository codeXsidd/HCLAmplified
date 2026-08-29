# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SkillPulse** — a Bayesian adaptive learning system that works for any domain. A learner types any goal ("become a classical guitarist", "learn quantum physics"), and the system generates a domain-specific competency graph via LLM, then uses deterministic Bayesian math to model knowledge state, decay, and transfer.

## Commands

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend (Next.js 14)
```bash
cd frontend
pnpm install        # or npm install
pnpm dev            # dev server on :3000
pnpm build          # production build
```

### Type / Lint Checks (no commits for verification)
```bash
cd frontend && npx tsc --noEmit          # TypeScript check
cd frontend && npx eslint src            # ESLint
python -c "import ast, sys; [ast.parse(open(f).read()) for f in sys.argv[1:]]" backend/app/**/*.py
```

## Architecture

### Dual-Store Pattern
State lives in two places simultaneously:
- **In-memory** (`app/main.py` → `_learner_states` dict): fast lookups during a session
- **PostgreSQL** (Neon): persisted across restarts via SQLAlchemy

`_sync_db_to_memory()` runs at startup to hydrate the in-memory store from DB.

### Domain Pack Pipeline
1. User sets a goal → `POST /api/onboarding/goal` → calls `domain_service.discover_domain()`
2. `domain_service` checks cache (normalized goal text fuzzy-match) in `domain_packs` table
3. Cache miss → LLM generates structured JSON (competencies + prerequisite DAG + transfer edges)
4. `_try_parse_json()` attempts multi-strategy recovery if LLM output is malformed
5. Falls back to a stripped-down retry prompt (2000 tokens, 15-25 competencies), then a generic 3-node `default_pack`
6. Pack saved to DB (`domain_packs`, `competencies`, `competency_edges` tables); `learner.domain_pack_id` updated

### Bayesian Knowledge State (`backend/app/core/`)
- Every competency: `Beta(α, β)` — mastery estimate = `α / (α + β)`
- `bayesian_updater.py`: pure math, no domain coupling
- `decay_calculator.py`: `P(recall) = 2^(-t / half_life)`, produces state labels (fresh/consolidating/fading/decaying)
- `transfer_analyzer.py`: propagates mastery across transfer edges with coefficient as multiplier
- Evidence provenance levels: `none → self_report → diagnostic → practice → inferred` (weight multipliers: 0.3×, 1.0×, 1.0×, 0.5×)

### Graph Routing (`_get_active_graph`)
In `routers/knowledge_state.py` and `routers/recommendations.py`:
- If `learner.domain_pack_id` is set → construct `DomainGraph` from DB (`domain_graph.py`)
- Otherwise → fall back to static `skill_graph.json` (ML demo data)
- This is a silent try/except fallback — if the column is missing or DB fails, it returns the static graph

### Schema Migrations
`_run_schema_migrations()` in `app/main.py` runs idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on every startup. SQLAlchemy's `create_all()` only creates new tables, not new columns — new columns must be added here.

### Demo Mode
- `DEMO_LEARNER_ID = "priya-demo-001"` — static ML seed state; `/dashboard?demo=true` resets to it via `api.loadDemo()`
- All other learners use `getLearnerID()` (from `lib/api.ts`) — generates a UUID on first visit, stored as `skillpulse:learner_id`
- `_get_active_graph()` and recommendations router only fall back to static ML data for `priya-demo-001`; all others return empty graph/empty list until domain pack is generated

### localStorage Keys
| Key | Set by | Read by |
|-----|--------|---------|
| `skillpulse:learner_id` | `getLearnerID()` auto-generates | Every page via `getLearnerID()` |
| `skillpulse:goal` | onboard step 3, goals page | path page, landing page, assistant page |
| `skillpulse:name` | onboard step 1 + goals page (from `domain_name` in API response) | AppNav (editable label + avatar initial) |

## Key Files

| File | Role |
|------|------|
| `backend/app/main.py` | Startup: migrations → `create_all` → sync DB → mount routers |
| `backend/app/services/domain_service.py` | LLM domain generation, caching, `_try_parse_json` recovery |
| `backend/app/core/domain_graph.py` | DB-backed graph (replaces static skill_graph for dynamic goals) |
| `backend/app/core/recommendation_engine.py` | Scoring: 0.30×Readiness + 0.25×Urgency + 0.25×Impact + 0.15×Transfer − 0.20×Redundancy |
| `backend/seeds/llm_cache.json` | Cached LLM responses to avoid re-calling Groq during dev |
| `frontend/src/lib/api.ts` | All frontend API calls; `DEMO_LEARNER_ID` defined here |
| `frontend/src/app/onboard/page.tsx` | 3-step onboard: goal → background → self-assessment |

## Environment

`backend/.env` (never commit):
```
GROQ_API_KEY=...
DATABASE_URL=postgresql://...  # Neon connection string
```
