"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { api, DEMO_LEARNER_ID } from "@/lib/api"
import AppNav from "@/components/shared/AppNav"

const PRESET_GOALS = [
  { label: "ML Engineer", desc: "Python, NumPy, Pandas, Sklearn, Deep Learning", icon: "ML" },
  { label: "Data Scientist", desc: "Statistics, SQL, Visualization, Hypothesis Testing", icon: "DS" },
  { label: "Backend Engineer", desc: "Python, APIs, Databases, System Design", icon: "BE" },
  { label: "AI Researcher", desc: "Linear Algebra, Probability, Deep Learning, Papers", icon: "AI" },
]

export default function GoalsPage() {
  const router = useRouter()
  const [goal, setGoal] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    if (!goal.trim()) return
    setSaving(true)
    setError("")
    try {
      await api.setGoal(DEMO_LEARNER_ID, goal, "")
      setSaved(true)
      setTimeout(() => router.push("/path"), 1500)
    } catch {
      setError("Could not save goal. Please check that the backend is running.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Goal Management</h1>
          <p className="text-slate-500 text-sm mt-1">Change your learning goal to recalculate your skill path</p>
        </div>

        {/* Preset goals */}
        <div className="card-elevated rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Quick Start — Common Goals</h2>
          <div className="grid grid-cols-2 gap-3">
            {PRESET_GOALS.map((pg) => (
              <button
                key={pg.label}
                onClick={() => setGoal(`Become a ${pg.label}`)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  goal === `Become a ${pg.label}`
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">{pg.icon}</span>
                  <span className="font-semibold text-slate-800 text-sm">{pg.label}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{pg.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Custom goal */}
        <div className="card-elevated rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Custom Goal</h2>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Become an ML Engineer at a product company within 6 months"
            className="w-full h-28 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none transition-all text-sm mb-4"
          />

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {saved && (
            <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              Goal saved! Recalculating your learning path...
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!goal.trim() || saving || saved}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-all text-sm"
          >
            {saving ? "Saving..." : saved ? "Saved!" : "Save Goal & Recalculate Path"}
          </button>
        </div>
      </div>
    </div>
  )
}
