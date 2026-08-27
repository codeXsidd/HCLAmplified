"use client"

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from "recharts"
import type { CalibrationPoint } from "@/lib/api"

interface Props {
  data: CalibrationPoint[]
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as CalibrationPoint
  const gap = Math.round(Math.abs(d.gap) * 100)
  const isOverconfident = d.self_assessed > d.actual_mastery
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-md p-3 text-xs">
      <div className="font-semibold text-slate-800 mb-1">{d.skill_name}</div>
      <div className="text-slate-500">Self-assessed: {Math.round(d.self_assessed * 100)}%</div>
      <div className="text-slate-500">Actual: {Math.round(d.actual_mastery * 100)}%</div>
      <div className={`mt-1 font-medium ${isOverconfident ? "text-orange-500" : "text-indigo-500"}`}>
        {isOverconfident ? `⚠ Overconfident by ${gap}%` : `Underconfident by ${gap}%`}
      </div>
    </div>
  )
}

export default function CalibrationChart({ data }: Props) {
  if (!data.length) return null

  const chartData = data.map((d) => ({
    ...d,
    x: d.self_assessed,
    y: d.actual_mastery,
  }))

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
      <h3 className="font-semibold text-slate-800 mb-1">Confidence Calibration</h3>
      <p className="text-xs text-slate-400 mb-4">
        Where are you fooling yourself? Points below the diagonal = overconfident.
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 1]}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            label={{ value: "Self-Assessed Confidence", position: "bottom", fill: "#94a3b8", fontSize: 11 }}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            stroke="#cbd5e1"
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 1]}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            label={{ value: "Actual Mastery", angle: -90, position: "left", fill: "#94a3b8", fontSize: 11 }}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            stroke="#cbd5e1"
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Perfect calibration diagonal */}
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
            stroke="#cbd5e1"
            strokeDasharray="6 3"
            label={{ value: "Perfect calibration", fill: "#94a3b8", fontSize: 9 }}
          />
          <Scatter data={chartData} r={6}>
            {chartData.map((d, i) => {
              const isOver = d.self_assessed > d.actual_mastery
              return (
                <Cell
                  key={i}
                  fill={isOver ? "#f97316" : "#6366f1"}
                  fillOpacity={0.85}
                />
              )
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex gap-4 justify-center mt-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
          Overconfident (dangerous)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
          Underconfident (safe)
        </div>
      </div>
    </div>
  )
}
