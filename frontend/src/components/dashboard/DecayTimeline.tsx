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
      <div className="text-xs text-white/30 py-4 text-center">
        No skills currently decaying ✓
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {decayingSkills.map(([name, s]) => {
        const recall = Math.round((s.recall_probability ?? 1) * 100)
        const daysSince = s.days_since_practice

        return (
          <div key={name} className="p-3 rounded-xl bg-red-500/5 border border-red-500/15">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-white/80">{name}</span>
              <span className="text-xs text-red-400">{recall}% recall</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${recall}%`,
                  backgroundColor: recall > 60 ? "#f59e0b" : recall > 30 ? "#ef4444" : "#7f1d1d",
                }}
              />
            </div>
            {daysSince != null && (
              <div className="text-xs text-white/30 mt-1">
                {Math.round(daysSince)} days since last practice
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
