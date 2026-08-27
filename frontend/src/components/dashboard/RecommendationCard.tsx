import type { Recommendation } from "@/lib/api"

interface Props {
  recommendation: Recommendation
  rank: number
  onLearn?: () => void
}

const URGENCY = {
  critical: { color: "#ef4444", bg: "border-l-red-500", badge: "bg-red-500/20 text-red-400 border-red-500/30" },
  high: { color: "#f97316", bg: "border-l-orange-500", badge: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  medium: { color: "#eab308", bg: "border-l-yellow-500", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  low: { color: "#22c55e", bg: "border-l-green-500", badge: "bg-green-500/20 text-green-400 border-green-500/30" },
}

function FactorBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/40 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-white/40 rounded-full"
          style={{ width: `${Math.min(100, Math.round(value * 100))}%` }}
        />
      </div>
      <span className="text-xs text-white/30 tabular-nums w-8 text-right">
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}

export default function RecommendationCard({ recommendation: r, rank, onLearn }: Props) {
  const urgency = URGENCY[r.urgency_level] ?? URGENCY.low

  return (
    <div
      className={`glass rounded-xl p-4 border-l-4 ${urgency.bg} transition-all hover:bg-white/8`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white/30 tabular-nums">#{rank}</span>
          <h4 className="font-semibold text-white text-sm">{r.skill_name}</h4>
        </div>
        <span
          className={`shrink-0 px-2 py-0.5 text-xs rounded-full border ${urgency.badge}`}
        >
          {r.primary_reason}
        </span>
      </div>

      {/* Explanation */}
      <p className="text-xs text-white/50 mb-3 leading-relaxed">{r.explanation}</p>

      {/* Transfer sources */}
      {r.transfer_sources.length > 0 && (
        <div className="mb-3 space-y-1">
          {r.transfer_sources.slice(0, 2).map((ts) => (
            <div
              key={ts.source_skill}
              className="flex items-center gap-2 text-xs text-blue-400/70"
            >
              <span className="text-blue-500">⚡</span>
              via {ts.source_skill}: {ts.time_savings_percent}% faster
            </div>
          ))}
        </div>
      )}

      {/* Factor bars */}
      <div className="space-y-1 mb-3">
        <FactorBar label="Readiness" value={r.factors.readiness ?? 0} />
        <FactorBar label="Urgency" value={r.factors.urgency ?? 0} />
        <FactorBar label="Impact" value={r.factors.impact ?? 0} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/30">
          ⏱ ~{r.estimated_time_hours}h estimated
        </span>
        <button
          onClick={onLearn}
          className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-xs text-blue-400 hover:text-blue-300 transition-all"
        >
          Why? →
        </button>
      </div>
    </div>
  )
}
