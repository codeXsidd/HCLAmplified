const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
export const DEMO_LEARNER_ID = process.env.NEXT_PUBLIC_DEMO_LEARNER_ID || "priya-demo-001"

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${path} failed: ${res.status} ${text}`)
  }
  return res.json()
}

export const api = {
  loadDemo: () =>
    apiFetch<{ success: boolean }>(`/api/onboarding/load-demo?learner_id=${DEMO_LEARNER_ID}`, {
      method: "POST",
    }),

  getKnowledgeGraph: (learnerId: string) =>
    apiFetch<KnowledgeGraphResponse>(`/api/knowledge-state/${learnerId}/graph`),

  getKnowledgeState: (learnerId: string) =>
    apiFetch<KnowledgeStateResponse>(`/api/knowledge-state/${learnerId}`),

  getInsights: (learnerId: string) =>
    apiFetch<InsightsResponse>(`/api/knowledge-state/${learnerId}/insights`),

  getRecommendations: (learnerId: string, topK = 5) =>
    apiFetch<RecommendationsResponse>(`/api/recommendations/${learnerId}?top_k=${topK}`),

  getDiagnostic: (learnerId: string, skillNames: string[]) =>
    apiFetch<DiagnosticResponse>(
      `/api/assessment/diagnostic/${learnerId}?skill_names=${skillNames.join(",")}`
    ),

  submitResponse: (body: SubmitResponseBody) =>
    apiFetch<SubmitResponseResult>("/api/assessment/respond", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  setGoal: (learnerId: string, goal: string, background?: string) =>
    apiFetch<{ success: boolean }>("/api/onboarding/goal", {
      method: "POST",
      body: JSON.stringify({ learner_id: learnerId, goal, background }),
    }),

  selfAssess: (
    learnerId: string,
    assessments: { skill_name: string; confidence: number }[]
  ) =>
    apiFetch<{ success: boolean }>("/api/onboarding/self-assess", {
      method: "POST",
      body: JSON.stringify({ learner_id: learnerId, assessments }),
    }),

  getRecommendationExplanation: (learnerId: string, skillName: string) =>
    apiFetch<{
      skill_name: string
      explanation: string
      factors: Record<string, number>
      urgency_level: string
      transfer_sources: TransferSource[]
    }>(`/api/recommendations/${learnerId}/${encodeURIComponent(skillName)}/explain`),

  resetDemo: (learnerId: string = DEMO_LEARNER_ID) =>
    apiFetch<{ message: string }>(
      `/api/onboarding/reset-demo?learner_id=${learnerId}`,
      { method: "POST" }
    ),
}

// ---- Types ----

export interface GraphNode {
  id: string
  name: string
  domain: string
  mastery_estimate: number
  effective_mastery: number
  recall_probability: number
  decay_urgency: number
  state_label: "solid" | "decaying" | "overconfident" | "learning" | "unknown"
  color: string
  size: number
  self_assessed_confidence?: number
  calibration_gap?: number
  x?: number
  y?: number
}

export interface GraphLink {
  source: string
  target: string
  link_type: "prerequisite" | "transfer"
  strength: number
  color: string
  transfer_coefficient?: number
  explanation?: string
}

export interface KnowledgeGraphResponse {
  nodes: GraphNode[]
  links: GraphLink[]
}

export interface KnowledgeStateResponse {
  learner_id: string
  skills: Record<string, SkillState>
}

export interface SkillState {
  skill_name: string
  alpha: number
  beta_param: number
  mastery_estimate: number
  effective_mastery: number
  recall_probability: number
  decay_urgency: number
  state_label: string
  color: string
  self_assessed_confidence?: number
  calibration_gap?: number
  last_practiced_at?: string
  half_life_days: number
  days_since_practice?: number
  practice_count: number
}

export interface InsightsResponse {
  total_skills_started: number
  solid_skills: number
  decaying_skills: number
  overconfident_skills: number
  learning_skills: number
  calibration_data: CalibrationPoint[]
  critical_decays: string[]
  transfer_opportunities: TransferOpportunity[]
}

export interface CalibrationPoint {
  skill_name: string
  self_assessed: number
  actual_mastery: number
  gap: number
  state_label: string
}

export interface TransferOpportunity {
  skill: string
  effective_transfer_percent: number
  sources: string[]
}

export interface Recommendation {
  skill_id: string
  skill_name: string
  score: number
  primary_reason: string
  explanation: string
  factors: Record<string, number>
  estimated_time_hours: number
  transfer_sources: TransferSource[]
  urgency_level: "critical" | "high" | "medium" | "low"
}

export interface TransferSource {
  source_skill: string
  transfer_coefficient: number
  effective_transfer: number
  explanation: string
  time_savings_percent: number
}

export interface RecommendationsResponse {
  learner_id: string
  recommendations: Recommendation[]
}

export interface DiagnosticResponse {
  items: AssessmentItem[]
}

export interface AssessmentItem {
  id: string
  skill_name: string
  item_type: string
  difficulty: number
  content: {
    question: string
    options: string[]
    correct_answer: number
    explanation: string
  }
}

export interface SubmitResponseBody {
  learner_id: string
  assessment_item_id: string
  skill_id: string
  response: number | string
  confidence_before?: number
  response_time_ms?: number
}

export interface SubmitResponseResult {
  score: number
  correct: boolean
  explanation: string
  updated_state: SkillState
}
