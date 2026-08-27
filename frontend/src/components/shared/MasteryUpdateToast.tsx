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
    solid: "border-green-300 bg-green-50",
    decaying: "border-red-300 bg-red-50",
    overconfident: "border-amber-300 bg-amber-50",
    learning: "border-purple-300 bg-purple-50",
    unknown: "border-slate-200 bg-slate-50",
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 px-4 py-3 rounded-xl border bg-white shadow-lg transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${stateColors[stateLabel] ?? stateColors.unknown}`}
    >
      <div className="text-2xl">{improved ? "📈" : "📉"}</div>
      <div>
        <div className="text-sm font-semibold text-slate-800">{skillName}</div>
        <div className={`text-xs mt-0.5 font-medium ${improved ? "text-green-600" : "text-red-600"}`}>
          Knowledge state updated · {improved ? "+" : "-"}
          {delta}% mastery
        </div>
        <div className="text-xs text-slate-400 mt-1">
          New state: <span className="capitalize text-slate-600">{stateLabel}</span>
        </div>
      </div>
      <button onClick={onDismiss} className="text-slate-300 hover:text-slate-500 ml-2 text-lg leading-none">
        ×
      </button>
    </div>
  )
}
