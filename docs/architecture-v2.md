# SkillPulse v2: Domain-Agnostic Architecture

## Introduction

This document describes the architectural refactor of SkillPulse from a static, ML-locked system to a fully domain-agnostic, assessment-first, evidence-driven platform. The mathematical core (Bayesian inference, skill decay, transfer intelligence) was always domain-agnostic; this refactor lifts the data layer to match.

**Target:** Any learning goal input → adaptive assessment → knowledge state → personalized graph + recommendations. Zero domain-specific code required.

---

## Why Refactor

The current system is hardcoded to "become an ML engineer":

| Layer | Current (v1) | Target (v2) |
|---|---|---|
| Skills | 51 ML skills in static JSON | Dynamic, LLM-generated per goal |
| Prerequisite edges | 48 hardcoded edges | LLM-generated, stored in DB |
| Transfer coefficients | 17 ML-specific coefficients | LLM-generated, domain-agnostic |
| Assessment questions | 22 ML-specific MCQs | LLM-generated per competency |
| Goal support | "ML engineer" only | Any goal string |

The math engine (Beta distribution updates, exponential decay, transfer propagation) operates on abstract parameters and is already domain-agnostic. Only the data layer needs to change.

**Database verdict: PostgreSQL is sufficient.** 20-80 competencies per domain fit comfortably in JSONB + adjacency list tables. Neo4j is not required.

---

## Pipeline

```
Goal input
  → Domain Discovery (LLM, cached)
  → Diagnostic Assessment (adaptive MCQ)
  → Knowledge State (Bayesian math)
  → Graph + Recommendations (graph math)
  → Adaptation Loop (decay + practice events)
```

---

## Key Concepts

### Domain Pack

A cached, reusable competency model generated once per goal type by the LLM and stored in PostgreSQL.

- **Contents:** 25-50 competencies, prerequisite edges, transfer edges with coefficients and explanations
- **Cache key:** Normalized goal text (lowercased, stripped)
- **Lifecycle:** Generated on first request for a goal type; all subsequent learners with the same goal reuse it instantly

### Evidence Provenance

Every mastery estimate tracks how it was established. Evidence source determines the weight applied during Bayesian update:

| Source | Description | Weight |
|---|---|---|
| `none` | No data yet — prior only | — |
| `self_report` | Learner claimed familiarity | 0.3× |
| `diagnostic` | Verified by assessment question | 1.0× |
| `practice` | Ongoing practice events | 1.0× |
| `inferred` | Transfer from related competencies | 0.5× |

### Adaptive Question Selection

Questions are scored by information value and the highest-scoring question is presented next:

```
info_value = 0.40 × uncertainty
           + 0.25 × evidence_gap
           + 0.20 × difficulty_match
           + 0.15 × coverage
```

- **uncertainty** — variance in current Beta(α, β) estimate
- **evidence_gap** — distance from desired evidence quality
- **difficulty_match** — how well question difficulty matches current mastery estimate
- **coverage** — priority for competencies not yet assessed in this session

---

## Database Schema Changes

### New Tables

```sql
-- One row per unique normalized goal string
CREATE TABLE domain_packs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_text   TEXT NOT NULL UNIQUE,
    goal_slug   TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT now(),
    metadata    JSONB
);

-- Competencies within a domain pack
CREATE TABLE competencies (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_pack_id UUID REFERENCES domain_packs(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    description    TEXT,
    difficulty     FLOAT CHECK (difficulty BETWEEN 0 AND 1),
    decay_half_life_days INTEGER DEFAULT 90
);

-- Prerequisite and transfer edges between competencies
CREATE TABLE competency_edges (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_pack_id UUID REFERENCES domain_packs(id) ON DELETE CASCADE,
    source_id      UUID REFERENCES competencies(id),
    target_id      UUID REFERENCES competencies(id),
    edge_type      TEXT CHECK (edge_type IN ('prerequisite', 'transfer')),
    coefficient    FLOAT,  -- transfer weight (transfer edges only)
    explanation    TEXT
);

-- LLM-generated assessment items per competency
CREATE TABLE assessment_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competency_id  UUID REFERENCES competencies(id) ON DELETE CASCADE,
    question_text  TEXT NOT NULL,
    options        JSONB NOT NULL,   -- array of answer choices
    correct_index  INTEGER NOT NULL,
    difficulty     FLOAT CHECK (difficulty BETWEEN 0 AND 1),
    explanation    TEXT
);

-- Per-learner, per-goal competency state
CREATE TABLE learner_goal_competencies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id      UUID REFERENCES learners(id),
    domain_pack_id  UUID REFERENCES domain_packs(id),
    competency_id   UUID REFERENCES competencies(id),
    alpha           FLOAT NOT NULL DEFAULT 1.0,
    beta            FLOAT NOT NULL DEFAULT 1.0,
    evidence_source TEXT CHECK (evidence_source IN ('none','self_report','diagnostic','practice','inferred')),
    last_updated    TIMESTAMPTZ DEFAULT now()
);
```

### Modified Tables

```sql
-- learners: add domain pack linkage and background context
ALTER TABLE learners ADD COLUMN domain_pack_id UUID REFERENCES domain_packs(id);
ALTER TABLE learners ADD COLUMN background JSONB;

-- learner_skill_states: add evidence provenance and competency foreign key
ALTER TABLE learner_skill_states ADD COLUMN evidence_source TEXT;
ALTER TABLE learner_skill_states ADD COLUMN competency_id UUID REFERENCES competencies(id);
```

---

## API Changes

### New Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/domain/discover` | Trigger domain discovery for a goal string; returns pack_id (cached if exists) |
| `GET` | `/api/domain/{pack_id}` | Retrieve full domain pack (competencies + edges) |
| `GET` | `/api/assessment/adaptive/{learner_id}` | Return next best question using info_value scoring |

### Modified Endpoints

| Endpoint | Change |
|---|---|
| `POST /api/onboarding/goal` | Triggers domain discovery; stores domain_pack_id on learner record |
| `GET /api/recommendations/{id}` | Reads competencies dynamically from learner's domain pack instead of `ML_GOAL_SKILLS` constant |

### Preserved Endpoints

- `POST /api/demo/load-demo` — unchanged
- `POST /api/demo/reset-demo` — unchanged

---

## LLM Calls

Four LLM call types are used. All except AI Coach Chat are cached in the database.

| Call Type | Trigger | Cached | Output |
|---|---|---|---|
| Domain Discovery | New goal string seen for first time | Yes (domain_packs table) | Full competency graph JSON |
| Assessment Generation | New competency with no questions | Yes (assessment_items table) | MCQ questions + answers |
| Explanation Generation | Recommendation render | Yes (competency metadata) | Natural language explanation |
| AI Coach Chat | Every user message | No | Contextual coaching response |

**Domain Discovery prompt contract:**

```
Input:  goal_text (string)
Output: {
  competencies: [{ name, description, difficulty, decay_half_life_days }],
  prerequisite_edges: [{ source, target }],
  transfer_edges: [{ source, target, coefficient, explanation }]
}
```

---

## File Changes

### New Files

| File | Purpose |
|---|---|
| `backend/app/services/domain_service.py` | Domain discovery orchestration + DB caching |
| `backend/app/core/domain_graph.py` | DB-backed graph loader, replaces static JSON loading |
| `backend/app/core/adaptive_selector.py` | Info-value scoring and question selection logic |
| `backend/app/routers/domain.py` | `/api/domain/*` endpoint handlers |

### Modified Files

| File | Change |
|---|---|
| `backend/app/models/db_models.py` | Add new ORM models for domain_packs, competencies, edges, assessment_items |
| `backend/app/core/recommendation_engine.py` | Remove `ML_GOAL_SKILLS` constant; accept dynamic competency list as parameter |
| `backend/app/services/llm_service.py` | Add domain discovery prompt + assessment question generation prompts |
| `backend/app/routers/onboarding.py` | Call domain_service on goal submission |
| `frontend/src/app/onboard/page.tsx` | Remove hardcoded `SKILLS` array; fetch from `/api/domain/{pack_id}` |

### Unchanged (Already Domain-Agnostic)

| File | Reason |
|---|---|
| `backend/app/core/bayesian_updater.py` | Operates on Beta(α, β) parameters only |
| `backend/app/core/decay_calculator.py` | Operates on decay half-life float only |
| `frontend/src/components/knowledge-graph/KnowledgeGraph.tsx` | Renders any competency graph |
| `frontend/src/components/assessment/DiagnosticFlow.tsx` | Renders any question payload |

---

## Migration Plan

5 phases, estimated 14 hours total.

| Phase | Work | Est. Time |
|---|---|---|
| 1 | Schema migrations + seed existing ML content as first domain pack | 2-3h |
| 2 | Domain discovery service: LLM prompt, parsing, DB caching | 3-4h |
| 3 | Dynamic graph loading: replace static JSON reads with DB queries | 2-3h |
| 4 | Adaptive assessment: implement info_value scoring + new endpoints | 3-4h |
| 5 | Frontend dynamic onboarding: remove hardcoded arrays, fetch domain pack | 2-3h |

Phase 1 ensures existing ML demo continues working throughout the migration. Each phase is independently deployable.

---

## Domain Generalization

The engine works for any domain because all core math operates on abstract parameters:

- **Bayesian updater** — Beta(α, β) parameters, evidence weight scalars
- **Decay calculator** — half-life float, elapsed time
- **Transfer propagation** — edge coefficient floats, graph traversal
- **Recommendation ranking** — mastery estimates, prerequisite completion booleans

Domain intelligence (what competencies exist, how they relate, how hard they are) is fully delegated to the LLM at goal-creation time and cached. After that, all runtime computation is pure math with no domain awareness.

**Demo scenario:** A learner types "become a magician" → system calls LLM once → generates competencies (misdirection, sleight of hand, card mechanics, stage presence, patter) + prerequisite graph → stores in domain_packs → same Bayesian engine runs → same decay logic applies → same recommendation algorithm fires. Zero domain-specific code paths involved.
