"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import {
  api,
  DEMO_LEARNER_ID,
  type GraphNode,
  type GraphLink,
  type InsightsResponse,
  type RecommendationsResponse,
  type DiagnosticResponse,
  type SubmitResponseResult,
  type AssessmentItem,
} from "@/lib/api"
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

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      if (isDemo) {
        await api.loadDemo()
      }
      const [graph, ins, recs, state] = await Promise.all([
        api.getKnowledgeGraph(DEMO_LEARNER_ID),
        api.getInsights(DEMO_LEARNER_ID),
        api.getRecommendations(DEMO_LEARNER_ID, 5),
        api.getKnowledgeState(DEMO_LEARNER_ID),
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

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDiagnosticRun = async () => {
    try {
      const overconfident = nodes
        .filter((n) => n.state_label === "overconfident" || n.state_label === "decaying")
        .slice(0, 4)
        .map((n) => n.name)
      const res = await api.getDiagnostic(DEMO_LEARNER_ID, overconfident)
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
      learner_id: DEMO_LEARNER_ID,
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
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Top bar */}
      <div className="border-b border-white/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-bold bg-gradient-to-r from-white to-white/50 bg-clip-text text-transparent">
            ⚡ SkillPulse
          </Link>
          {isDemo && (
            <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-full">
              Demo: Priya — ML Engineer Goal
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDiagnosticRun}
            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-400 text-xs rounded-lg transition-all"
          >
            Run Diagnostic
          </button>
          <button
            onClick={loadData}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 text-xs rounded-lg transition-all"
          >
            Refresh
          </button>
          <button
            onClick={async () => { await api.resetDemo(); await loadData() }}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 text-xs rounded-lg transition-all"
          >
            Reset Demo
          </button>
          <Link
            href="/insights"
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 text-xs rounded-lg transition-all"
          >
            Full Insights →
          </Link>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
          <span className="ml-2 text-red-300/60 text-xs">
            (Start backend: cd backend && uvicorn app.main:app --reload)
          </span>
        </div>
      )}

      <div className="flex h-[calc(100vh-57px)]">
        {/* Left: Knowledge Graph */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="font-semibold text-white">Living Knowledge State</h2>
              <p className="text-xs text-white/40">Click any node to inspect. Red pulse = decaying, amber = overconfident.</p>
            </div>
            <div className="flex gap-3 text-xs text-white/40">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" /> Solid
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" /> Decaying
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Overconfident
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 border-2 border-dashed border-blue-400 rounded-full" /> Transfer
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-[calc(100%-40px)] glass rounded-2xl">
              <div className="text-center text-white/30">
                <div className="text-4xl mb-2 animate-pulse">🧠</div>
                <div className="text-sm">Building your knowledge model…</div>
              </div>
            </div>
          ) : (
            <KnowledgeGraph
              nodes={nodes}
              links={links}
              onNodeClick={setSelectedNode}
              width={Math.min(900, typeof window !== "undefined" ? window.innerWidth * 0.58 : 700)}
              height={typeof window !== "undefined" ? window.innerHeight - 120 : 560}
            />
          )}
        </div>

        {/* Right panel */}
        <div className="w-80 flex-shrink-0 border-l border-white/5 p-4 overflow-y-auto space-y-4">
          {/* Stats */}
          <div>
            <h3 className="text-xs text-white/40 uppercase tracking-widest mb-3">Knowledge Summary</h3>
            <StatsRow insights={insights} loading={loading} />
          </div>

          {/* Recommendations */}
          <div>
            <h3 className="text-xs text-white/40 uppercase tracking-widest mb-3">Next Actions</h3>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : recommendations?.recommendations.length ? (
              <div className="space-y-3">
                {recommendations.recommendations.slice(0, 4).map((r, i) => (
                  <RecommendationCard key={r.skill_id} recommendation={r} rank={i + 1} onLearn={() => setSelectedRecommendation(r)} />
                ))}
              </div>
            ) : (
              <div className="text-xs text-white/30 py-4 text-center">No recommendations yet</div>
            )}
          </div>

          {/* Critical decay alerts */}
          {insights?.critical_decays?.length ? (
            <div>
              <h3 className="text-xs text-white/40 uppercase tracking-widest mb-3">⚠ Decay Alerts</h3>
              <div className="space-y-2">
                {insights.critical_decays.map((s) => (
                  <div key={s} className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                    {s}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Decay radar */}
          <div>
            <h3 className="text-xs text-white/40 uppercase tracking-widest mb-3">📡 Decay Radar</h3>
            <DecayTimeline insights={insights} skills={knowledgeSkills} />
          </div>

          {/* Transfer opportunities */}
          {insights?.transfer_opportunities?.length ? (
            <div>
              <h3 className="text-xs text-white/40 uppercase tracking-widest mb-3">⚡ Transfer Ready</h3>
              <div className="space-y-2">
                {insights.transfer_opportunities.slice(0, 3).map((t) => (
                  <div key={t.skill} className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <div className="text-xs font-medium text-blue-300">{t.skill}</div>
                    <div className="text-xs text-blue-400/70 mt-0.5">
                      {t.effective_transfer_percent}% already known via transfer
                    </div>
                    <div className="text-xs text-white/30">via: {t.sources.join(", ")}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Node popup */}
      {selectedNode && (
        <SkillStatePopup node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}

      {/* Diagnostic modal */}
      {showDiagnostic && diagnosticItems.length > 0 && (
        <DiagnosticFlow
          items={diagnosticItems}
          learnerId={DEMO_LEARNER_ID}
          onSubmit={handleSubmitResponse}
          onComplete={handleDiagnosticComplete}
          onClose={() => setShowDiagnostic(false)}
        />
      )}

      {/* Mastery update toast */}
      {toast && (
        <MasteryUpdateToast
          skillName={toast.skillName}
          prevMastery={toast.prevMastery}
          newMastery={toast.newMastery}
          stateLabel={toast.stateLabel}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Recommendation explanation panel */}
      {selectedRecommendation && (
        <RecommendationExplanation
          recommendation={selectedRecommendation}
          onClose={() => setSelectedRecommendation(null)}
        />
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="text-white/30 text-center">
          <div className="text-4xl mb-2 animate-pulse">⚡</div>
          <div>Loading SkillPulse…</div>
        </div>
      </div>
    }>
      <DashboardInner />
    </Suspense>
  )
}
