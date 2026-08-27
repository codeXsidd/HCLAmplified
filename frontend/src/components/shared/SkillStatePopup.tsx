"use client"

import { GraphNode } from "@/lib/api"

const STATE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  solid: { label: "Solid Mastery", color: "#22c55e", bg: "bg-green-500/10 border-green-500/20" },
  decaying: { label: "Decaying", color: "#ef4444", bg: "bg-red-500/10 border-red-500/20" },
  overconfident: { label: "Overconfident ⚠", color: "#f59e0b", bg: "bg-amber-500/10 border-amber-500/20" },
  learning: { label: "In Progress", color: "#a855f7", bg: "bg-purple-500/10 border-purple-500/20" },
  unknown: { label: "Not Started", color: "#6b7280", bg: "bg-gray-500/10 border-gray-500/20" },
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="glass rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg text-white">{node.name}</h3>
            <span
              className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full border ${cfg.bg}`}
              style={{ color: cfg.color }}
            >
              {cfg.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Mastery bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-white/50 mb-1">
            <span>Mastery</span>
            <span className="font-mono">{masteryPct}% ±{ci}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${masteryPct}%`, backgroundColor: cfg.color }}
            />
          </div>
        </div>

        {/* Effective mastery (after decay) */}
        {node.state_label !== "unknown" && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>Effective Mastery (after decay)</span>
              <span className="font-mono">{effectivePct}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-blue-500"
                style={{ width: `${effectivePct}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-white/40 mb-0.5">Recall Probability</div>
            <div
              className="text-xl font-bold"
              style={{ color: recallPct > 70 ? "#22c55e" : recallPct > 40 ? "#f59e0b" : "#ef4444" }}
            >
              {recallPct}%
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-white/40 mb-0.5">Half-Life</div>
            <div className="text-xl font-bold text-white/80">
              {node.size > 0 ? Math.round(node.size * 2) : "—"}d
            </div>
          </div>
        </div>

        {/* Alerts */}
        {node.state_label === "decaying" && (
          <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs mb-3">
            🔴 This skill has only {recallPct}% recall probability — refresh it now before it fades further.
          </div>
        )}

        {node.state_label === "overconfident" && node.calibration_gap !== undefined && (
          <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs mb-3">
            ⚠ You rated yourself{" "}
            {Math.round((node.self_assessed_confidence ?? 0) * 100)}% but your
            assessed mastery is {masteryPct}%. This gap ({Math.round(Math.abs(node.calibration_gap) * 100)}%)
            is dangerous — it means you&apos;ll skip prerequisites you actually need.
          </div>
        )}

        {/* Domain */}
        <div className="text-xs text-white/30 text-center mt-2">
          Domain: {node.domain.replace(/_/g, " ")}
        </div>
      </div>
    </div>
  )
}
