interface Props {
  insights: any | null
  skills: Record<string, any>
}

export default function DecayTimeline({ skills }: Props) {
  const decayingSkills = Object.entries(skills)
    .filter(([, s]) => s.state_label === "decaying" || s.decay_urgency > 0.15)
    .sort((a, b) => b[1].decay_urgency - a[1].decay_urgency)
    .slice(0, 5)

  if (!decayingSkills.length) {
    return (
      <div className="text-xs text-slate-500 py-4 text-center bg-green-50 border border-green-200 rounded-xl">
        No skills currently decaying
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {decayingSkills.map(([name, s]) => {
        const recall = Math.round((s.recall_probability ?? 1) * 100)
        const daysSince = s.days_since_practice

        // High urgency (low recall) = red, low urgency (high recall) = green
        const barColor =
          recall > 70
            ? "bg-green-500"
            : recall > 50
            ? "bg-green-400"
            : recall > 30
            ? "bg-red-400"
            : "bg-red-600"

        const trackColor =
          recall > 50 ? "bg-green-100" : "bg-red-100"

        const cardBorder =
          recall > 50 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"

        const recallTextColor =
          recall > 50 ? "text-green-700" : "text-red-600"

        return (
          <div key={name} className={`p-3 rounded-xl border ${cardBorder}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-700">{name}</span>
              <span className={`text-xs font-semibold ${recallTextColor}`}>{recall}% recall</span>
            </div>
            <div className={`h-1.5 ${trackColor} rounded-full overflow-hidden`}>
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${recall}%` }}
              />
            </div>
            {daysSince != null && (
              <div className="text-xs text-slate-400 mt-1">
                {Math.round(daysSince)}d since last practice
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
