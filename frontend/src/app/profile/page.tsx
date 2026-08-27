"use client"

import { useState } from "react"
import Link from "next/link"
import AppNav from "@/components/shared/AppNav"
import { api, DEMO_LEARNER_ID } from "@/lib/api"

export default function ProfilePage() {
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  const handleReset = async () => {
    if (!confirm("Reset demo to Priya's initial state? This cannot be undone.")) return
    setResetting(true)
    try {
      await api.resetDemo()
      setResetDone(true)
    } catch {}
    setResetting(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-8">Profile & Settings</h1>

        {/* Learner card */}
        <div className="card-elevated rounded-2xl p-6 mb-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-700">P</div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Priya</h2>
              <p className="text-sm text-slate-500">Demo Learner — {DEMO_LEARNER_ID}</p>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Current Goal</span>
              <span className="font-medium text-slate-800">Become an ML Engineer</span>
            </div>
          </div>
        </div>

        {/* Navigation shortcuts */}
        <div className="card-elevated rounded-2xl p-6 mb-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Quick Navigation</h3>
          <div className="space-y-2">
            {[
              { href: "/dashboard?demo=true", label: "Dashboard", desc: "Knowledge graph & recommendations" },
              { href: "/goals", label: "Goals", desc: "Update your learning goal" },
              { href: "/assistant", label: "AI Assistant", desc: "Contextual learning coach" },
              { href: "/insights", label: "Analytics", desc: "Calibration & decay analysis" },
              { href: "/learn", label: "Practice", desc: "Run a skill diagnostic" },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                <div>
                  <span className="font-medium text-slate-800 text-sm">{item.label}</span>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
                <span className="text-slate-400 text-sm">→</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Demo controls */}
        <div className="card-elevated rounded-2xl p-6 border-red-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Demo Controls</h3>
          <p className="text-xs text-slate-500 mb-4">Reset the demo to Priya&apos;s initial state (13 skills, day 0 of ML Engineer journey).</p>

          {resetDone && (
            <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              Demo reset successfully.
            </div>
          )}

          <button
            onClick={handleReset}
            disabled={resetting}
            className="w-full py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-medium rounded-xl transition-all text-sm disabled:opacity-50"
          >
            {resetting ? "Resetting..." : "Reset Demo State"}
          </button>
        </div>
      </div>
    </div>
  )
}
