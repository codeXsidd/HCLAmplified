"use client"
import { useEffect, useState } from "react"
import type { Recommendation, TransferSource } from "@/lib/api"
import { api, DEMO_LEARNER_ID } from "@/lib/api"

interface Props {
  recommendation: Recommendation | null
  onClose: () => void
}

const urgencyColors: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-green-400 bg-green-500/10 border-green-500/20",
}

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
        className="w-96 h-full bg-[#0d1326] border-l border-white/10 p-6 overflow-y-auto shadow-2xl animate-slideIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-white">Why this recommendation?</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl">
            ×
          </button>
        </div>

        {/* Title + urgency */}
        <div className="mb-4">
          <div className="text-xl font-bold text-white mb-1">{recommendation.skill_name}</div>
          <div
            className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${
              urgencyColors[recommendation.urgency_level] ?? urgencyColors.low
            }`}
          >
            {recommendation.urgency_level.toUpperCase()}
          </div>
        </div>

        {/* Explanation text */}
        <div className="p-4 glass rounded-xl mb-5">
          {loading ? (
            <div className="text-xs text-white/30 animate-pulse">Generating explanation…</div>
          ) : (
            <p className="text-sm text-white/70 leading-relaxed">
              {explanation || recommendation.primary_reason}
            </p>
          )}
        </div>

        {/* Factor breakdown */}
        <div className="mb-5">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-3">Factor Breakdown</div>
          <div className="space-y-3">
            {[
              { label: "Readiness", key: "readiness", color: "#22c55e", desc: "Prerequisites met" },
              { label: "Urgency",   key: "urgency",   color: "#ef4444", desc: "Decay + blocking" },
              { label: "Impact",    key: "impact",    color: "#3b82f6", desc: "Goal skills unlocked" },
              { label: "Transfer",  key: "transfer",  color: "#a855f7", desc: "Free knowledge" },
            ].map((f) => (
              <div key={f.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/60">{f.label}</span>
                  <span className="text-white/40">{f.desc}</span>
                  <span className="text-white/80">{Math.round((factors[f.key] ?? 0) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
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
            <div className="text-xs text-white/40 uppercase tracking-widest mb-3">Transfer Intelligence</div>
            <div className="space-y-2">
              {recommendation.transfer_sources.slice(0, 3).map((t: TransferSource) => (
                <div key={t.source_skill} className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                  <div className="text-xs font-medium text-blue-300">
                    {t.source_skill} → {recommendation.skill_name}
                  </div>
                  <div className="text-xs text-blue-400/70 mt-0.5">{t.explanation}</div>
                  <div className="text-xs text-white/30 mt-1">
                    {t.time_savings_percent}% time savings · {Math.round(t.effective_transfer * 100)}% transferred
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estimated time */}
        <div className="p-3 glass rounded-xl">
          <div className="text-xs text-white/40 mb-1">Estimated time to learn</div>
          <div className="text-2xl font-bold text-white">{recommendation.estimated_time_hours}h</div>
          {recommendation.transfer_sources?.length > 0 && (
            <div className="text-xs text-blue-400/70 mt-1">
              Reduced from standard estimate via transfer
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
