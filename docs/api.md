# SkillPulse API Reference

Base URL: `http://localhost:8000` (local) · set `NEXT_PUBLIC_API_URL` for production

Interactive docs: `GET /docs` (Swagger UI) · `GET /redoc`

---

## System

### `GET /`
Health + version.
```json
{ "status": "ok", "app": "SkillPulse API", "version": "1.0.0" }
```

### `GET /health`
```json
{ "status": "healthy" }
```

---

## Onboarding `/api/onboarding`

### `POST /api/onboarding/goal`
Set learner goal and receive suggested self-assessment skills.

**Body**
```json
{
  "learner_id": "priya-demo-001",
  "goal": "Become an ML Engineer",
  "background": "2 years Python, some SQL"
}
```
**Response**
```json
{
  "message": "Goal set",
  "learner_id": "priya-demo-001",
  "self_assessment_skills": [
    { "name": "Python Basics", "domain": "python_foundations" }
  ]
}
```

---

### `POST /api/onboarding/self-assess`
Record self-assessed confidence levels per skill (0–1 scale).

**Body**
```json
{
  "learner_id": "priya-demo-001",
  "assessments": [
    { "skill_name": "Python Basics", "confidence": 0.9 },
    { "skill_name": "SQL Queries",   "confidence": 0.6 }
  ]
}
```
**Response**
```json
{ "message": "Self-assessment recorded", "skills_assessed": 2 }
```

---

### `POST /api/onboarding/load-demo?learner_id=priya-demo-001`
Load the pre-seeded Priya demo state (13 skills, day-0 ML Engineer journey).

**Response**
```json
{ "message": "Demo state loaded", "learner_id": "priya-demo-001", "skills_loaded": 13 }
```

---

### `POST /api/onboarding/reset-demo?learner_id=priya-demo-001`
Reset demo back to Priya's initial state. Safe to call anytime.

**Response**
```json
{ "message": "Demo state reset to original", "learner_id": "priya-demo-001" }
```

---

## Knowledge State `/api/knowledge-state`

### `GET /api/knowledge-state/{learner_id}`
Full Bayesian knowledge state — one entry per skill with mastery, decay, calibration.

**Response** (abbreviated)
```json
{
  "learner_id": "priya-demo-001",
  "skills": {
    "Python Basics": {
      "skill_name": "Python Basics",
      "alpha": 18.0,
      "beta_param": 2.0,
      "mastery_estimate": 0.9,
      "effective_mastery": 0.87,
      "recall_probability": 0.97,
      "decay_urgency": 0.03,
      "state_label": "solid",
      "color": "#22c55e",
      "self_assessed_confidence": 0.92,
      "calibration_gap": -0.02,
      "half_life_days": 45.0,
      "days_since_practice": 3,
      "practice_count": 18
    }
  }
}
```

**`state_label` values**

| Value | Meaning |
|---|---|
| `solid` | mastery ≥ 70%, recall ≥ 80% |
| `decaying` | recall probability dropping below threshold |
| `overconfident` | self-assessed confidence >> actual mastery |
| `learning` | in-progress, mastery 20–70% |
| `unknown` | not yet assessed |

---

### `GET /api/knowledge-state/{learner_id}/graph`
Node + link data for the knowledge graph visualization.

**Response**
```json
{
  "nodes": [
    {
      "id": "python-basics",
      "name": "Python Basics",
      "domain": "python_foundations",
      "mastery_estimate": 0.9,
      "effective_mastery": 0.87,
      "recall_probability": 0.97,
      "decay_urgency": 0.03,
      "state_label": "solid",
      "color": "#22c55e",
      "size": 12
    }
  ],
  "links": [
    {
      "source": "python-basics",
      "target": "numpy-arrays",
      "link_type": "prerequisite",
      "strength": 0.8,
      "color": "rgba(107,114,128,0.4)"
    },
    {
      "source": "sql-queries",
      "target": "pandas-dataframes",
      "link_type": "transfer",
      "transfer_coefficient": 0.45,
      "explanation": "SQL JOIN logic maps directly to pd.merge()",
      "color": "rgba(59,130,246,0.6)"
    }
  ]
}
```

---

### `GET /api/knowledge-state/{learner_id}/insights`
Aggregate analytics: calibration data, decay alerts, transfer opportunities.

**Response**
```json
{
  "total_skills_started": 13,
  "solid_skills": 4,
  "decaying_skills": 5,
  "overconfident_skills": 2,
  "learning_skills": 2,
  "critical_decays": ["SQL Queries", "Hypothesis Testing"],
  "calibration_data": [
    {
      "skill_name": "Linear Algebra Basics",
      "self_assessed": 0.8,
      "actual_mastery": 0.3,
      "gap": 0.5,
      "state_label": "overconfident"
    }
  ],
  "transfer_opportunities": [
    {
      "skill": "Pandas DataFrames",
      "effective_transfer_percent": 45,
      "sources": ["SQL Queries"]
    }
  ]
}
```

---

## Recommendations `/api/recommendations`

### `GET /api/recommendations/{learner_id}?top_k=5`
Multi-factor ranked recommendations. Algorithm: `0.30×Readiness + 0.25×Urgency + 0.25×Impact + 0.15×Transfer − 0.20×Redundancy`

**Query params**
| Param | Default | Description |
|---|---|---|
| `top_k` | `5` | Number of recommendations to return |

**Response**
```json
{
  "learner_id": "priya-demo-001",
  "recommendations": [
    {
      "skill_id": "pandas-dataframes",
      "skill_name": "Pandas DataFrames",
      "score": 0.537,
      "primary_reason": "HIGH IMPACT: Unlocks many skills downstream",
      "explanation": "With full readiness and SQL transfer advantage...",
      "factors": {
        "readiness": 1.0,
        "urgency": 0.07,
        "impact": 0.75,
        "transfer": 0.45,
        "redundancy": 0.2
      },
      "estimated_time_hours": 4,
      "urgency_level": "medium",
      "transfer_sources": [
        {
          "source_skill": "SQL Queries",
          "transfer_coefficient": 0.45,
          "effective_transfer": 0.45,
          "explanation": "SQL JOIN logic maps directly to pd.merge()",
          "time_savings_percent": 45
        }
      ]
    }
  ]
}
```

**`urgency_level` values:** `critical` · `high` · `medium` · `low`

---

### `GET /api/recommendations/{learner_id}/{skill_name}/explain`
LLM-generated explanation for why a specific skill is recommended.

**Response**
```json
{
  "skill_name": "SQL Queries",
  "explanation": "SQL is actively decaying — recall has dropped below 50%...",
  "factors": { "readiness": 1.0, "urgency": 0.72, "impact": 0.6, "transfer": 0.0 },
  "urgency_level": "critical",
  "transfer_sources": []
}
```

---

## Assessment `/api/assessment`

### `GET /api/assessment/diagnostic/{learner_id}?skill_names=SQL+Queries,Python+Basics`
Fetch diagnostic MCQ items for specified skills. Questions generated by LLM (cached).

**Query params**
| Param | Required | Description |
|---|---|---|
| `skill_names` | Yes | Comma-separated skill names |

**Response**
```json
{
  "items": [
    {
      "id": "sql-001",
      "skill_name": "SQL Queries",
      "item_type": "mcq",
      "difficulty": 0.5,
      "content": {
        "question": "What does SELECT DISTINCT do?",
        "options": ["Returns all rows", "Returns unique rows", "Sorts rows", "Filters nulls"],
        "correct_answer": 1,
        "explanation": "DISTINCT removes duplicate rows from the result set."
      }
    }
  ]
}
```

---

### `POST /api/assessment/respond`
Submit a learner's answer. Triggers Bayesian knowledge state update.

**Body**
```json
{
  "learner_id": "priya-demo-001",
  "assessment_item_id": "sql-001",
  "skill_id": "SQL Queries",
  "response": 1,
  "confidence_before": 0.7,
  "response_time_ms": 4200
}
```

**Response**
```json
{
  "score": 1.0,
  "correct": true,
  "explanation": "DISTINCT removes duplicate rows from the result set.",
  "updated_state": {
    "skill_name": "SQL Queries",
    "mastery_estimate": 0.61,
    "effective_mastery": 0.53,
    "recall_probability": 0.87,
    "state_label": "learning",
    "half_life_days": 17.0
  }
}
```

> **How Bayesian update works:** correct answer → `alpha += difficulty_weight`, incorrect → `beta += difficulty_weight`. `mastery_estimate = alpha / (alpha + beta)`. Response time adjusts the weight (faster = higher confidence in signal).

---

## AI Assistant `/api/assistant`

### `POST /api/assistant/chat`
Contextual AI learning coach grounded in the learner's current knowledge state.

**Body**
```json
{
  "learner_id": "priya-demo-001",
  "message": "What should I study next?",
  "history": [
    { "role": "user",      "content": "Hi" },
    { "role": "assistant", "content": "Hi Priya! How can I help?" }
  ]
}
```

**Response**
```json
{
  "response": "Given your SQL is decaying and transfers 45% to Pandas, I'd refresh SQL first (15 min) then move to Pandas DataFrames — you're already 45% there.",
  "learner_id": "priya-demo-001"
}
```

> Uses Groq (`qwen/qwen3.8-27b`). Context includes solid skills, decaying skills, and top 3 recommendations. Responses are cached in `seeds/llm_cache.json`.

---

## Error Responses

All errors return standard HTTP status codes with a detail message:

```json
{ "detail": "Learner not found" }
```

| Code | Meaning |
|---|---|
| `404` | Learner or skill not found |
| `422` | Validation error (missing/invalid field) |
| `500` | Internal server error |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Groq API key for LLM calls |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DEMO_LEARNER_ID` | No | Default `priya-demo-001` |

---

## Running Locally

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# API available at http://localhost:8000
# Swagger UI at http://localhost:8000/docs
```
