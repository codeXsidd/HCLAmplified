"use client"

import { useState, useEffect } from "react"
import { api, DEMO_LEARNER_ID, type InsightsResponse, type RecommendationsResponse, type Recommendation } from "@/lib/api"
import AppNav from "@/components/shared/AppNav"
import CalibrationChart from "@/components/dashboard/CalibrationChart"
import RecommendationCard from "@/components/dashboard/RecommendationCard"
import RecommendationExplanation from "@/components/dashboard/RecommendationExplanation"
import DecayTimeline from "@/components/dashboard/DecayTimeline"
import StatsRow from "@/components/dashboard/StatsRow"

export default function InsightsPage() {
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null)
  const [knowledgeSkills, setKnowledgeSkills] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [ins, recs, state] = await Promise.all([
          api.getInsights(DEMO_LEARNER_ID),
          api.getRecommendations(DEMO_LEARNER_ID, 10),
          api.getKnowledgeState(DEMO_LEARNER_ID),
        ])
        setInsights(ins)
        setRecommendations(recs)
        setKnowledgeSkills(state.skills ?? {})
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppNav />

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Stats overview */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Knowledge Overview</h2>
          <div className="max-w-sm">
            <StatsRow insights={insights} loading={loading} />
          </div>
        </section>

        {/* Calibration chart */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Confidence Calibration</h2>
          <p className="text-sm text-slate-500 mb-4">
            Where you&apos;re overconfident (dangerous) vs. underconfident (safe but slow).
          </p>
          {loading ? (
            <div className="h-80 rounded-2xl bg-slate-200 animate-pulse" />
          ) : insights?.calibration_data.length ? (
            <CalibrationChart data={insights.calibration_data} />
          ) : (
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8 text-center text-slate-400 text-sm">
              No calibration data yet — run the diagnostic to generate this chart.
            </div>
          )}
        </section>

        {/* Decay timeline */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">📡 Decay Radar</h2>
          <p className="text-sm text-slate-500 mb-4">
            Skills you learned that are silently fading — ranked by how much mastery is at risk.
          </p>
          {loading ? (
            <div className="h-32 rounded-2xl bg-slate-200 animate-pulse" />
          ) : (
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4">
              <DecayTimeline insights={insights} skills={knowledgeSkills} />
            </div>
          )}
        </section>

        {/* Transfer opportunities */}
        {insights?.transfer_opportunities?.length ? (
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Transfer Opportunities</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {insights.transfer_opportunities.map((t) => (
                <div key={t.skill} className="px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <div className="font-medium text-indigo-700 text-sm mb-1">{t.skill}</div>
                  <div className="text-xs text-indigo-500 mb-1">
                    {t.effective_transfer_percent}% already learned via transfer
                  </div>
                  <div className="text-xs text-slate-400">From: {t.sources.join(", ")}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Full recommendation list */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">All Recommendations</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-slate-200 animate-pulse" />)}
            </div>
          ) : recommendations?.recommendations.length ? (
            <div className="space-y-3">
              {recommendations.recommendations.map((r, i) => (
                <RecommendationCard key={r.skill_id} recommendation={r} rank={i + 1} onLearn={() => setSelectedRec(r)} />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8 text-center text-slate-400 text-sm">
              No recommendations yet.
            </div>
          )}
        </section>
      </div>

      {selectedRec && (
        <RecommendationExplanation
          recommendation={selectedRec}
          onClose={() => setSelectedRec(null)}
        />
      )}
    </div>
  )
}
