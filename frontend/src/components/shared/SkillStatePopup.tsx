"use client"

import { GraphNode } from "@/lib/api"

const STATE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  solid: { label: "Solid Mastery", color: "#16a34a", bg: "bg-green-100 border-green-300" },
  decaying: { label: "Decaying", color: "#dc2626", bg: "bg-red-100 border-red-300" },
  overconfident: { label: "Overconfident ⚠", color: "#d97706", bg: "bg-amber-100 border-amber-300" },
  learning: { label: "In Progress", color: "#7c3aed", bg: "bg-purple-100 border-purple-300" },
  unknown: { label: "Not Started", color: "#475569", bg: "bg-slate-100 border-slate-300" },
}

interface Props {
  node: GraphNode | null
  onClose: () => void
}

export default function SkillStatePopup({ node, onClose }: Props) {
  if (!node) return null

  const cfg = STATE_CONFIG[node.state_label] ?? STATE_CONFIG.unknown
  const masteryPct = Math.round(node.mastery_estimate * 100)
  const effectivePct = Math.round(node.effective_mastery * 100)
  const recallPct = Math.round(node.recall_probability * 100)
  const ci = Math.round((1 - node.mastery_estimate) * node.mastery_estimate * 50)

  const recallColor =
    recallPct > 70 ? "#16a34a" : recallPct > 40 ? "#d97706" : "#dc2626"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg text-slate-800">{node.name}</h3>
            <span
              className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full border ${cfg.bg}`}
              style={{ color: cfg.color }}
            >
              {cfg.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-slate-500 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Mastery bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Mastery</span>
            <span className="font-mono">{masteryPct}% ±{ci}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${masteryPct}%`, backgroundColor: cfg.color }}
            />
          </div>
        </div>

        {/* Effective mastery (after decay) */}
        {node.state_label !== "unknown" && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Effective Mastery (after decay)</span>
              <span className="font-mono">{effectivePct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-blue-500"
                style={{ width: `${effectivePct}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="text-xs text-slate-400 mb-0.5">Recall Probability</div>
            <div
              className="text-xl font-bold"
              style={{ color: recallColor }}
            >
              {recallPct}%
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="text-xs text-slate-400 mb-0.5">Half-Life</div>
            <div className="text-xl font-bold text-slate-700">
              {node.size > 0 ? Math.round(node.size * 2) : "—"}d
            </div>
          </div>
        </div>

        {/* Alerts */}
        {node.state_label === "decaying" && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs mb-3">
            This skill has only {recallPct}% recall probability — refresh it now before it fades further.
          </div>
        )}

        {node.state_label === "overconfident" && node.calibration_gap !== undefined && (
          <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs mb-3">
            You rated yourself{" "}
            {Math.round((node.self_assessed_confidence ?? 0) * 100)}% but your
            assessed mastery is {masteryPct}%. This gap ({Math.round(Math.abs(node.calibration_gap) * 100)}%)
            is dangerous — it means you&apos;ll skip prerequisites you actually need.
          </div>
        )}

        {/* Domain */}
        <div className="text-xs text-slate-400 text-center mt-2">
          Domain: {node.domain.replace(/_/g, " ")}
        </div>
      </div>
    </div>
  )
}
