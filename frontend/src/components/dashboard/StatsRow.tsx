import type { InsightsResponse } from "@/lib/api"

interface Props {
  insights: InsightsResponse | null
  loading?: boolean
}

const stats = [
  { key: "solid_skills", label: "Solid", color: "text-green-700", bg: "bg-green-50 border-green-200", dot: "bg-green-500" },
  { key: "decaying_skills", label: "Decaying", color: "text-red-700", bg: "bg-red-50 border-red-200", dot: "bg-red-500" },
  { key: "overconfident_skills", label: "Overconfident", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  { key: "learning_skills", label: "Learning", color: "text-violet-700", bg: "bg-violet-50 border-violet-200", dot: "bg-violet-500" },
]

export default function StatsRow({ insights, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => {
        const count = insights ? (insights as any)[s.key] ?? 0 : 0
        return (
          <div key={s.key} className={`rounded-xl border p-3 ${s.bg} transition-all hover:shadow-sm`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500">{s.label}</span>
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            </div>
            <div className={`text-2xl font-bold ${s.color}`}>{count}</div>
            <div className="text-xs text-slate-400 mt-0.5">skills</div>
          </div>
        )
      })}
    </div>
  )
}
