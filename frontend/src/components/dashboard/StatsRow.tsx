import type { InsightsResponse } from "@/lib/api"

interface Props {
  insights: InsightsResponse | null
  loading?: boolean
}

const stats = [
  { key: "solid_skills", label: "Solid", color: "#22c55e", bg: "bg-green-500/10 border-green-500/20", icon: "●" },
  { key: "decaying_skills", label: "Decaying", color: "#ef4444", bg: "bg-red-500/10 border-red-500/20", icon: "◉" },
  { key: "overconfident_skills", label: "Overconfident", color: "#f59e0b", bg: "bg-amber-500/10 border-amber-500/20", icon: "⚠" },
  { key: "learning_skills", label: "Learning", color: "#a855f7", bg: "bg-purple-500/10 border-purple-500/20", icon: "◌" },
]

export default function StatsRow({ insights, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => {
        const count = insights ? (insights as any)[s.key] ?? 0 : 0
        return (
          <div
            key={s.key}
            className={`rounded-xl border p-3 ${s.bg} transition-all hover:scale-105`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/50">{s.label}</span>
              <span style={{ color: s.color }} className="text-sm">
                {s.icon}
              </span>
            </div>
            <div className="text-3xl font-bold" style={{ color: s.color }}>
              {count}
            </div>
            <div className="text-xs text-white/30 mt-0.5">skills</div>
          </div>
        )
      })}
    </div>
  )
}
