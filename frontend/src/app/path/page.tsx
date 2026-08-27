"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { api, DEMO_LEARNER_ID, type Recommendation, type InsightsResponse } from "@/lib/api"
import AppNav from "@/components/shared/AppNav"

interface SkillStage {
  name: string
  status: "mastered" | "in_progress" | "next" | "locked"
  mastery: number
  reason?: string
  transferBoost?: number
  estimatedHours?: number
  urgencyLevel?: string
}

export default function PathPage() {
  const [stages, setStages] = useState<SkillStage[]>([])
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [goal, setGoal] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const [state, recs, ins] = await Promise.all([
          api.getKnowledgeState(DEMO_LEARNER_ID),
          api.getRecommendations(DEMO_LEARNER_ID, 12),
          api.getInsights(DEMO_LEARNER_ID),
        ])
        setInsights(ins)

        const skills = state.skills ?? {}

        // Build mastered stages from current knowledge state
        const mastered: SkillStage[] = Object.entries(skills)
          .filter(([, s]) => s.mastery_estimate >= 0.65)
          .sort((a, b) => b[1].mastery_estimate - a[1].mastery_estimate)
          .slice(0, 5)
          .map(([name, s]) => ({
            name,
            status: "mastered",
            mastery: s.mastery_estimate,
          }))

        // In-progress: partially known but not solid
        const inProgress: SkillStage[] = Object.entries(skills)
          .filter(([, s]) => s.mastery_estimate >= 0.2 && s.mastery_estimate < 0.65)
          .sort((a, b) => b[1].mastery_estimate - a[1].mastery_estimate)
          .slice(0, 3)
          .map(([name, s]) => ({
            name,
            status: "in_progress" as const,
            mastery: s.mastery_estimate,
            reason: s.state_label === "decaying" ? "Refresher needed" : "Building foundations",
          }))

        // Next recommendations
        const nextStages: SkillStage[] = recs.recommendations.slice(0, 6).map((r, i) => ({
          name: r.skill_name || r.skill_id,
          status: i === 0 ? ("next" as const) : ("locked" as const),
          mastery: 0,
          reason: r.primary_reason,
          transferBoost: r.transfer_sources?.reduce((sum, t) => sum + t.effective_transfer, 0) ?? 0,
          estimatedHours: r.estimated_time_hours,
          urgencyLevel: r.urgency_level,
        }))

        setStages([...mastered, ...inProgress, ...nextStages])
        setGoal("Become an ML Engineer")
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const masteredCount = stages.filter((s) => s.status === "mastered").length
  const inProgressCount = stages.filter((s) => s.status === "in_progress").length
  const totalGoalSkills = stages.length
  const progressPct = totalGoalSkills > 0
    ? Math.round(((masteredCount + inProgressCount * 0.4) / totalGoalSkills) * 100)
    : 0

  const statusConfig = {
    mastered: {
      dot: "bg-green-500 ring-4 ring-green-100",
      badge: "bg-green-50 text-green-700 border-green-200",
      badgeText: "Mastered",
      line: "bg-green-200",
    },
    in_progress: {
      dot: "bg-amber-500 ring-4 ring-amber-100",
      badge: "bg-amber-50 text-amber-700 border-amber-200",
      badgeText: "In Progress",
      line: "bg-amber-200",
    },
    next: {
      dot: "bg-indigo-600 ring-4 ring-indigo-100 animate-pulse",
      badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
      badgeText: "Up Next",
      line: "bg-indigo-200",
    },
    locked: {
      dot: "bg-slate-300 ring-4 ring-slate-100",
      badge: "bg-slate-50 text-slate-500 border-slate-200",
      badgeText: "Ahead",
      line: "bg-slate-200",
    },
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-1">Learning Path</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            {goal || "Your Path to ML Engineer"}
          </h1>
          <p className="text-sm text-slate-500">
            Personalized skill sequence based on your Bayesian knowledge model
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error} — make sure the backend is running.
          </div>
        )}

        {/* Goal progress */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-slate-800">Goal Progress</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {masteredCount} mastered · {inProgressCount} in progress · {totalGoalSkills - masteredCount - inProgressCount} ahead
              </div>
            </div>
            <div className={`text-2xl font-bold tabular-nums ${
              progressPct >= 60 ? "text-green-600" : progressPct >= 30 ? "text-amber-600" : "text-indigo-600"
            }`}>
              {loading ? "—" : `${progressPct}%`}
            </div>
          </div>
          {loading ? (
            <div className="h-2.5 bg-slate-100 rounded-full animate-pulse" />
          ) : (
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {/* Transfer summary */}
          {insights?.transfer_opportunities?.length ? (
            <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
              <span className="font-semibold">Transfer boost:</span>{" "}
              {insights.transfer_opportunities.length} skill{insights.transfer_opportunities.length !== 1 ? "s" : ""} can
              be learned faster using your existing knowledge.
            </div>
          ) : null}
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />

            <div className="space-y-3">
              {stages.map((stage, idx) => {
                const cfg = statusConfig[stage.status]
                const isNext = stage.status === "next"
                const isLocked = stage.status === "locked"
                return (
                  <div key={`${stage.name}-${idx}`} className="relative flex items-start gap-5">
                    {/* Timeline dot */}
                    <div className={`relative z-10 w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${cfg.dot}`}>
                      {stage.status === "mastered" && (
                        <span className="text-white text-sm font-bold">✓</span>
                      )}
                      {stage.status === "in_progress" && (
                        <span className="text-white text-xs font-bold">{Math.round(stage.mastery * 100)}%</span>
                      )}
                      {stage.status === "next" && (
                        <span className="text-white text-sm font-bold">→</span>
                      )}
                      {stage.status === "locked" && (
                        <span className="text-slate-400 text-sm">·</span>
                      )}
                    </div>

                    {/* Card */}
                    <div className={`flex-1 rounded-2xl border p-4 transition-all ${
                      isNext
                        ? "bg-white border-indigo-200 shadow-sm shadow-indigo-100"
                        : isLocked
                        ? "bg-slate-50 border-slate-100 opacity-70"
                        : "bg-white border-slate-200 shadow-sm"
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold text-sm ${isLocked ? "text-slate-500" : "text-slate-800"}`}>
                              {stage.name}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${cfg.badge}`}>
                              {cfg.badgeText}
                            </span>
                            {stage.urgencyLevel === "critical" && (
                              <span className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md font-medium">
                                Urgent
                              </span>
                            )}
                          </div>
                          {stage.reason && (
                            <p className="text-xs text-slate-500 mt-1">{stage.reason}</p>
                          )}
                        </div>

                        {stage.status === "mastered" && (
                          <div className="flex-shrink-0">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${Math.round(stage.mastery * 100)}%` }}
                              />
                            </div>
                            <div className="text-xs text-slate-400 text-right mt-0.5">
                              {Math.round(stage.mastery * 100)}%
                            </div>
                          </div>
                        )}

                        {isNext && (
                          <Link
                            href={`/learn?skill=${encodeURIComponent(stage.name)}`}
                            className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            Start
                          </Link>
                        )}
                      </div>

                      {/* Transfer + time */}
                      {(stage.transferBoost != null || stage.estimatedHours != null) && !isLocked && (
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {stage.transferBoost != null && stage.transferBoost > 0.05 && (
                            <span className="text-xs text-blue-600">
                              {Math.round(stage.transferBoost * 100)}% head start via transfer
                            </span>
                          )}
                          {stage.estimatedHours != null && (
                            <span className="text-xs text-slate-400">
                              ~{stage.estimatedHours}h estimated
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Goal milestone */}
              <div className="relative flex items-start gap-5">
                <div className="relative z-10 w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-indigo-100 ring-4 ring-indigo-50">
                  <span className="text-indigo-600 text-lg">🎯</span>
                </div>
                <div className="flex-1 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                  <span className="font-semibold text-indigo-800 text-sm">Goal: {goal || "ML Engineer"}</span>
                  <p className="text-xs text-indigo-500 mt-0.5">Complete the path above to reach your goal</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transfer opportunities section */}
        {insights?.transfer_opportunities?.length ? (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Transfer Shortcuts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {insights.transfer_opportunities.slice(0, 4).map((t) => (
                <div key={t.skill} className="bg-white border border-blue-200 rounded-xl p-3 shadow-sm">
                  <div className="text-sm font-semibold text-slate-800 mb-0.5">{t.skill}</div>
                  <div className="text-xs text-blue-600 font-medium mb-1">
                    {t.effective_transfer_percent}% already learned
                  </div>
                  <div className="text-xs text-slate-400">via: {t.sources.join(", ")}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
