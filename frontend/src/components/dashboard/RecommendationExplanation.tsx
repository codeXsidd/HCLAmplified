"use client"
import { useEffect, useState } from "react"
import type { Recommendation, TransferSource } from "@/lib/api"
import { api, DEMO_LEARNER_ID } from "@/lib/api"

interface Props {
  recommendation: Recommendation | null
  onClose: () => void
}

const urgencyColors: Record<string, string> = {
  critical: "text-red-600 bg-red-50 border-red-200",
  high:     "text-orange-600 bg-orange-50 border-orange-200",
  medium:   "text-amber-600 bg-amber-50 border-amber-200",
  low:      "text-green-600 bg-green-50 border-green-200",
}

const FACTORS = [
  { label: "Readiness", key: "readiness", color: "#22c55e", desc: "Prerequisites met" },
  { label: "Urgency",   key: "urgency",   color: "#ef4444", desc: "Decay + blocking" },
  { label: "Impact",    key: "impact",    color: "#6366f1", desc: "Goal skills unlocked" },
  { label: "Transfer",  key: "transfer",  color: "#a855f7", desc: "Free knowledge" },
] as const

export default function RecommendationExplanation({ recommendation, onClose }: Props) {
  const [explanation, setExplanation] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!recommendation) return
    if (recommendation.explanation) {
      setExplanation(recommendation.explanation)
      return
    }
    setLoading(true)
    api
      .getRecommendationExplanation(DEMO_LEARNER_ID, recommendation.skill_name)
      .then((r) => setExplanation(r.explanation ?? ""))
      .catch(() => setExplanation("Explanation unavailable."))
      .finally(() => setLoading(false))
  }, [recommendation])

  if (!recommendation) return null

  const factors = recommendation.factors ?? {}

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div
        className="w-96 h-full bg-white border-l border-slate-200 p-6 overflow-y-auto shadow-2xl animate-slideIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-slate-800">Why this recommendation?</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Title + urgency */}
        <div className="mb-4">
          <div className="text-xl font-bold text-slate-900 mb-2">{recommendation.skill_name}</div>
          <div
            className={`inline-flex items-center px-2.5 py-0.5 rounded border text-xs font-medium ${
              urgencyColors[recommendation.urgency_level] ?? urgencyColors.low
            }`}
          >
            {recommendation.urgency_level.toUpperCase()}
          </div>
        </div>

        {/* Explanation text */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-5">
          {loading ? (
            <div className="text-xs text-slate-400 animate-pulse">Generating explanation…</div>
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed">
              {explanation || recommendation.primary_reason}
            </p>
          )}
        </div>

        {/* Factor breakdown */}
        <div className="mb-5">
          <div className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-medium">
            Factor Breakdown
          </div>
          <div className="space-y-3">
            {FACTORS.map((f) => (
              <div key={f.key}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-700">{f.label}</span>
                  <span className="text-slate-400">{f.desc}</span>
                  <span className="font-semibold text-slate-800">
                    {Math.round((factors[f.key] ?? 0) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(factors[f.key] ?? 0) * 100}%`, backgroundColor: f.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transfer sources */}
        {recommendation.transfer_sources?.length > 0 && (
          <div className="mb-5">
            <div className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-medium">
              Transfer Intelligence
            </div>
            <div className="space-y-2">
              {recommendation.transfer_sources.slice(0, 3).map((t: TransferSource) => (
                <div
                  key={t.source_skill}
                  className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl"
                >
                  <div className="text-xs font-semibold text-indigo-700">
                    {t.source_skill} → {recommendation.skill_name}
                  </div>
                  <div className="text-xs text-indigo-500 mt-0.5">{t.explanation}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {t.time_savings_percent}% time savings · {Math.round(t.effective_transfer * 100)}% transferred
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estimated time */}
        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
          <div className="text-xs text-slate-400 mb-1 font-medium">Estimated time to learn</div>
          <div className="text-2xl font-bold text-indigo-700">{recommendation.estimated_time_hours}h</div>
          {recommendation.transfer_sources?.length > 0 && (
            <div className="text-xs text-indigo-400 mt-1">
              Reduced from standard estimate via transfer
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
