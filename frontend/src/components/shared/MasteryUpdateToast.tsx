"use client"
import { useEffect, useState } from "react"

interface Props {
  skillName: string
  prevMastery: number
  newMastery: number
  stateLabel: string
  onDismiss: () => void
}

export default function MasteryUpdateToast({ skillName, prevMastery, newMastery, stateLabel, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(true)
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  const improved = newMastery > prevMastery
  const delta = Math.round(Math.abs(newMastery - prevMastery) * 100)

  const stateColors: Record<string, string> = {
    solid: "border-green-500/40 bg-green-500/10",
    decaying: "border-red-500/40 bg-red-500/10",
    overconfident: "border-amber-500/40 bg-amber-500/10",
    learning: "border-purple-500/40 bg-purple-500/10",
    unknown: "border-white/10 bg-white/5",
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 px-4 py-3 rounded-xl border glass shadow-2xl transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${stateColors[stateLabel] ?? stateColors.unknown}`}
    >
      <div className="text-2xl">{improved ? "📈" : "📉"}</div>
      <div>
        <div className="text-sm font-semibold text-white">{skillName}</div>
        <div className="text-xs text-white/60 mt-0.5">
          Knowledge state updated · {improved ? "+" : "-"}
          {delta}% mastery
        </div>
        <div className="text-xs text-white/40 mt-1">
          New state: <span className="capitalize text-white/60">{stateLabel}</span>
        </div>
      </div>
      <button onClick={onDismiss} className="text-white/30 hover:text-white/60 ml-2 text-lg leading-none">
        ×
      </button>
    </div>
  )
}
