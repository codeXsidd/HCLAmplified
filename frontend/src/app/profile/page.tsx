"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import AppNav from "@/components/shared/AppNav"
import { api, getLearnerID } from "@/lib/api"

export default function ProfilePage() {
  const [learnerId, setLearnerId] = useState("")
  const [goal, setGoal] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [nameInput, setNameInput] = useState("")
  const [editingName, setEditingName] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLearnerId(getLearnerID())
    setGoal(localStorage.getItem("skillpulse:goal") ?? "")
    const name = localStorage.getItem("skillpulse:name") ?? ""
    setDisplayName(name)
    setNameInput(name)
  }, [])

  useEffect(() => {
    if (editingName) inputRef.current?.focus()
  }, [editingName])

  const saveName = () => {
    const trimmed = nameInput.trim()
    if (trimmed) {
      localStorage.setItem("skillpulse:name", trimmed)
      setDisplayName(trimmed)
    }
    setEditingName(false)
  }

  const handleReset = async () => {
    if (!confirm("Reset your learning data? This will clear your progress.")) return
    setResetting(true)
    try {
      await api.clearProgress(learnerId)
      localStorage.removeItem("skillpulse:goal")
      localStorage.removeItem("skillpulse:learner_id")
      localStorage.removeItem("skillpulse:name")
      setGoal("")
      setDisplayName("")
      setNameInput("")
      setResetDone(true)
    } catch {}
    setResetting(false)
  }

  const avatarChar = displayName ? displayName[0].toUpperCase() : (goal ? goal[0].toUpperCase() : "?")

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-8">Profile & Settings</h1>

        {/* Learner card */}
        <div className="card-elevated rounded-2xl p-6 mb-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-700 flex-shrink-0">
              {avatarChar}
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <input
                  ref={inputRef}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName()
                    if (e.key === "Escape") setEditingName(false)
                  }}
                  className="w-full px-3 py-1.5 text-base font-bold border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-slate-900"
                  placeholder="Enter your name"
                  maxLength={40}
                />
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="group flex items-center gap-2 text-left"
                  title="Click to edit name"
                >
                  <span className="font-bold text-slate-900 text-lg">
                    {displayName || <span className="text-slate-400 font-normal italic">Set your name</span>}
                  </span>
                  <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                  </svg>
                </button>
              )}
              <p className="text-sm text-slate-500 font-mono truncate">{learnerId || "—"}</p>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Current Goal</span>
              <span className="font-medium text-slate-800 max-w-xs text-right">
                {goal || <span className="text-slate-400 italic">No goal set</span>}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation shortcuts */}
        <div className="card-elevated rounded-2xl p-6 mb-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Quick Navigation</h3>
          <div className="space-y-2">
            {[
              { href: "/dashboard", label: "Dashboard", desc: "Knowledge graph & recommendations" },
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

        {/* Reset */}
        <div className="card-elevated rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Reset Progress</h3>
          <p className="text-xs text-slate-500 mb-4">Clear all your learning data and start fresh with a new goal.</p>

          {resetDone && (
            <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              Progress cleared. <Link href="/onboard" className="underline font-medium">Start over →</Link>
            </div>
          )}

          <button
            onClick={handleReset}
            disabled={resetting}
            className="w-full py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-medium rounded-xl transition-all text-sm disabled:opacity-50"
          >
            {resetting ? "Clearing..." : "Clear My Progress"}
          </button>
        </div>
      </div>
    </div>
  )
}
