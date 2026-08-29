"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import {
  api,
  DEMO_LEARNER_ID,
  getLearnerID,
  type GraphNode,
  type GraphLink,
  type InsightsResponse,
  type RecommendationsResponse,
  type DiagnosticResponse,
  type SubmitResponseResult,
  type AssessmentItem,
} from "@/lib/api"
import AppNav from "@/components/shared/AppNav"
import StatsRow from "@/components/dashboard/StatsRow"
import RecommendationCard from "@/components/dashboard/RecommendationCard"
import DecayTimeline from "@/components/dashboard/DecayTimeline"
import RecommendationExplanation from "@/components/dashboard/RecommendationExplanation"
import SkillStatePopup from "@/components/shared/SkillStatePopup"
import MasteryUpdateToast from "@/components/shared/MasteryUpdateToast"
import DiagnosticFlow from "@/components/assessment/DiagnosticFlow"

const KnowledgeGraph = dynamic(() => import("@/components/knowledge-graph/KnowledgeGraph"), { ssr: false })

function DashboardInner() {
  const searchParams = useSearchParams()
  const isDemo = searchParams.get("demo") === "true"

  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [diagnosticItems, setDiagnosticItems] = useState<AssessmentItem[]>([])
  const [showDiagnostic, setShowDiagnostic] = useState(false)
  const [toast, setToast] = useState<{ skillName: string; prevMastery: number; newMastery: number; stateLabel: string } | null>(null)
  const [selectedRecommendation, setSelectedRecommendation] = useState<any>(null)
  const [knowledgeSkills, setKnowledgeSkills] = useState<Record<string, any>>({})
  const [graphDims, setGraphDims] = useState({ width: 700, height: 520 })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const activeId = isDemo ? DEMO_LEARNER_ID : getLearnerID()
      if (isDemo) await api.loadDemo()
      const [graph, ins, recs, state] = await Promise.all([
        api.getKnowledgeGraph(activeId),
        api.getInsights(activeId),
        api.getRecommendations(activeId, 5),
        api.getKnowledgeState(activeId),
      ])
      setNodes(graph.nodes)
      setLinks(graph.links)
      setInsights(ins)
      setRecommendations(recs)
      setKnowledgeSkills(state.skills ?? {})
    } catch (e: any) {
      setError(e.message || "Failed to load data. Is the backend running?")
    } finally {
      setLoading(false)
    }
  }, [isDemo])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const update = () => {
      const mobile = window.innerWidth < 768
      setGraphDims(
        mobile
          ? { width: window.innerWidth - 24, height: 300 }
          : { width: Math.min(960, window.innerWidth * 0.62), height: window.innerHeight - 145 }
      )
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const handleDiagnosticRun = async () => {
    try {
      const activeId = isDemo ? DEMO_LEARNER_ID : getLearnerID()
      const overconfident = nodes
        .filter((n) => n.state_label === "overconfident" || n.state_label === "decaying")
        .slice(0, 4)
        .map((n) => n.name)
      const res = await api.getDiagnostic(activeId, overconfident)
      setDiagnosticItems(res.items)
      setShowDiagnostic(true)
    } catch {
      setError("Could not load diagnostic questions.")
    }
  }

  const handleSubmitResponse = async (
    itemId: string,
    skillId: string,
    response: number,
    confidenceBefore: number,
    timeMs: number
  ): Promise<SubmitResponseResult> => {
    return api.submitResponse({
      learner_id: isDemo ? DEMO_LEARNER_ID : getLearnerID(),
      assessment_item_id: itemId,
      skill_id: skillId,
      response,
      confidence_before: confidenceBefore,
      response_time_ms: timeMs,
    })
  }

  const handleDiagnosticComplete = async (results: any[]) => {
    setShowDiagnostic(false)
    if (results.length > 0) {
      const lastResult = results[results.length - 1]
      if (lastResult?.result?.updated_state) {
        const us = lastResult.result.updated_state
        setToast({
          skillName: us.skill_name || us.skill_id || "Skill",
          prevMastery: 0.5,
          newMastery: us.mastery_estimate ?? 0.5,
          stateLabel: us.state_label ?? "learning",
        })
      }
    }
    await loadData()
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppNav />

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <span className="text-red-400 text-xs ml-2">
            Start backend: cd backend && uvicorn app.main:app --reload
          </span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:h-[calc(100vh-57px)]">
        {/* Left: Knowledge Graph */}
        <div className="flex-1 p-3 md:p-4 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h2 className="font-semibold text-slate-800 text-sm md:text-base">Living Knowledge State</h2>
              <p className="text-xs text-slate-400 hidden sm:block">Click any node to inspect.</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap justify-end">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Solid</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Decay</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Overconf.</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 border-2 border-dashed border-blue-400 rounded-full" /> Transfer</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ height: graphDims.height }}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-slate-400">
                  <div className="text-3xl mb-2 animate-pulse text-indigo-300">◎</div>
                  <div className="text-sm">Building your knowledge model...</div>
                </div>
              </div>
            ) : nodes.length === 0 && !isDemo ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-xs px-6">
                  <div className="text-4xl mb-3">🎯</div>
                  <div className="font-semibold text-slate-700 mb-2">No knowledge graph yet</div>
                  <p className="text-sm text-slate-400 mb-5">Complete onboarding to generate your personalized competency graph.</p>
                  <a href="/onboard" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
                    Start Onboarding →
                  </a>
                </div>
              </div>
            ) : (
              <KnowledgeGraph
                nodes={nodes}
                links={links}
                onNodeClick={setSelectedNode}
                width={graphDims.width}
                height={graphDims.height}
              />
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-full md:w-80 md:flex-shrink-0 border-t md:border-t-0 md:border-l border-slate-200 bg-white p-4 md:overflow-y-auto space-y-5">
          {/* What to do next — hero recommendation */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">What to do next</h3>
            {loading ? (
              <div className="h-28 rounded-xl bg-slate-100 animate-pulse" />
            ) : recommendations?.recommendations[0] ? (() => {
              const top = recommendations.recommendations[0]
              return (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-semibold text-indigo-900 text-sm">{top.skill_name || top.skill_id}</div>
                      <div className="text-xs text-indigo-600 mt-0.5">{top.primary_reason}</div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-md font-medium border flex-shrink-0 ${
                      top.urgency_level === "critical"
                        ? "bg-red-50 border-red-200 text-red-700"
                        : top.urgency_level === "high"
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-indigo-100 border-indigo-200 text-indigo-700"
                    }`}>
                      {top.urgency_level}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/learn?skill=${encodeURIComponent(top.skill_name || top.skill_id)}`}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg text-center transition-colors"
                    >
                      Practice Now
                    </Link>
                    <button
                      onClick={() => setSelectedRecommendation(top)}
                      className="px-3 py-2 bg-white border border-indigo-200 text-indigo-600 text-xs font-medium rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      Why?
                    </button>
                  </div>
                </div>
              )
            })() : (
              <div className="text-xs text-slate-400 py-4 text-center bg-slate-50 rounded-xl border border-slate-100">
                No recommendations yet
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDiagnosticRun}
              className="flex-1 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-medium rounded-lg transition-colors"
            >
              Run Diagnostic
            </button>
            <button
              onClick={loadData}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs rounded-lg transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={async () => { await api.resetDemo(); await loadData() }}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs rounded-lg transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Stats */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Knowledge Summary</h3>
            <StatsRow insights={insights} loading={loading} />
          </div>

          {/* More recommendations */}
          {recommendations?.recommendations && recommendations.recommendations.length > 1 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Also Recommended</h3>
              <div className="space-y-3">
                {recommendations.recommendations.slice(1, 4).map((r, i) => (
                  <RecommendationCard
                    key={r.skill_id}
                    recommendation={r}
                    rank={i + 2}
                    onLearn={() => setSelectedRecommendation(r)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Critical decay alerts */}
          {insights?.critical_decays?.length ? (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Decay Alerts</h3>
              <div className="space-y-2">
                {insights.critical_decays.map((s) => (
                  <div key={s} className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                    {s}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Decay radar */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Decay Radar</h3>
            <DecayTimeline insights={insights} skills={knowledgeSkills} />
          </div>

          {/* Transfer opportunities */}
          {insights?.transfer_opportunities?.length ? (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Transfer Ready</h3>
              <div className="space-y-2">
                {insights.transfer_opportunities.slice(0, 3).map((t) => (
                  <div key={t.skill} className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="text-xs font-semibold text-blue-700">{t.skill}</div>
                    <div className="text-xs text-blue-600 mt-0.5">
                      {t.effective_transfer_percent}% already known via transfer
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">via: {t.sources.join(", ")}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Bottom links */}
          <div className="flex gap-2">
            <Link
              href="/path"
              className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl text-center transition-colors"
            >
              View Path →
            </Link>
            <Link
              href="/insights"
              className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-medium rounded-xl text-center transition-colors"
            >
              Analytics →
            </Link>
          </div>
        </div>
      </div>

      {selectedNode && (
        <SkillStatePopup node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}

      {showDiagnostic && diagnosticItems.length > 0 && (
        <DiagnosticFlow
          items={diagnosticItems}
          learnerId={isDemo ? DEMO_LEARNER_ID : getLearnerID()}
          onSubmit={handleSubmitResponse}
          onComplete={handleDiagnosticComplete}
          onClose={() => setShowDiagnostic(false)}
        />
      )}

      {toast && (
        <MasteryUpdateToast
          skillName={toast.skillName}
          prevMastery={toast.prevMastery}
          newMastery={toast.newMastery}
          stateLabel={toast.stateLabel}
          onDismiss={() => setToast(null)}
        />
      )}

      {selectedRecommendation && (
        <RecommendationExplanation
          recommendation={selectedRecommendation}
          onClose={() => setSelectedRecommendation(null)}
          learnerId={isDemo ? DEMO_LEARNER_ID : getLearnerID()}
        />
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-slate-400 text-center">
            <div className="text-3xl mb-2 animate-pulse text-indigo-300">◎</div>
            <div className="text-sm">Loading SkillPulse...</div>
          </div>
        </div>
      }
    >
      <DashboardInner />
    </Suspense>
  )
}
