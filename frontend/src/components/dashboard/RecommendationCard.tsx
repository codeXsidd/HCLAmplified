import type { Recommendation } from "@/lib/api"
import Link from "next/link"

interface Props {
  recommendation: Recommendation
  rank: number
  onLearn?: () => void
}

const URGENCY = {
  critical: { border: "border-l-red-500", badge: "bg-red-50 text-red-700 border-red-200" },
  high: { border: "border-l-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  medium: { border: "border-l-indigo-400", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  low: { border: "border-l-slate-400", badge: "bg-slate-100 text-slate-600 border-slate-200" },
}

function FactorBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.round(value * 100))
  const barColor =
    pct >= 70 ? "bg-indigo-300" : pct >= 40 ? "bg-slate-400" : "bg-slate-200"
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  )
}

export default function RecommendationCard({ recommendation: r, rank, onLearn }: Props) {
  const urgency = URGENCY[r.urgency_level] ?? URGENCY.low

  return (
    <div
      className={`bg-white rounded-xl p-4 border border-slate-200 border-l-4 ${urgency.border} transition-all hover:shadow-sm hover:border-slate-300`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-slate-400 tabular-nums shrink-0">#{rank}</span>
          <h4 className="font-semibold text-slate-700 text-sm truncate">{r.skill_name}</h4>
        </div>
        <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full border font-medium capitalize ${urgency.badge}`}>
          {r.urgency_level}
        </span>
      </div>

      <p className="text-xs text-slate-500 mb-1 font-medium truncate">{r.primary_reason}</p>
      <p className="text-xs text-slate-400 mb-3 leading-relaxed line-clamp-2">{r.explanation}</p>

      {r.transfer_sources.length > 0 && (
        <div className="mb-3 space-y-1">
          {r.transfer_sources.slice(0, 2).map((ts) => (
            <div key={ts.source_skill} className="flex items-center gap-1.5 text-xs text-indigo-600">
              <span className="text-indigo-400">+</span>
              via {ts.source_skill}: {ts.time_savings_percent}% faster
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5 mb-3">
        <FactorBar label="Readiness" value={r.factors.readiness ?? 0} />
        <FactorBar label="Urgency" value={r.factors.urgency ?? 0} />
        <FactorBar label="Impact" value={r.factors.impact ?? 0} />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">~{r.estimated_time_hours}h estimated</span>
        <div className="flex gap-2">
          <Link
            href={`/learn?skill=${encodeURIComponent(r.skill_name)}`}
            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs text-indigo-700 font-medium transition-all"
          >
            Practice
          </Link>
          <button
            onClick={onLearn}
            className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-600 font-medium transition-all"
          >
            Why?
          </button>
        </div>
      </div>
    </div>
  )
}
