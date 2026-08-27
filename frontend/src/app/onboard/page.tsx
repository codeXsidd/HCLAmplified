"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { api, DEMO_LEARNER_ID } from "@/lib/api"

const SKILLS = [
  "Python Basics",
  "Data Structures",
  "NumPy Arrays",
  "SQL Queries",
  "Linear Algebra Basics",
  "Probability Theory",
  "Pandas DataFrames",
  "Machine Learning Basics",
  "Deep Learning Basics",
  "Statistics",
]

const EXPERIENCE_LEVELS = ["Beginner (< 1 year coding)", "Intermediate (1-3 years)", "Senior (3+ years)"]

export default function OnboardPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [goal, setGoal] = useState("")
  const [background, setBackground] = useState("")
  const [experience, setExperience] = useState("")
  const [confidences, setConfidences] = useState<Record<string, number>>(
    Object.fromEntries(SKILLS.map((s) => [s, 50]))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    setLoading(true)
    setError("")
    try {
      await api.setGoal(DEMO_LEARNER_ID, goal, `${background} | Experience: ${experience}`)
      await api.selfAssess(
        DEMO_LEARNER_ID,
        SKILLS.map((s) => ({ skill_name: s, confidence: confidences[s] / 100 }))
      )
      router.push("/dashboard")
    } catch (e) {
      setError("Could not connect to backend. Please start the server.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col items-center justify-start pt-16 px-4">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-10">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step === n
                  ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
                  : step > n
                  ? "bg-green-500/30 text-green-400"
                  : "bg-white/5 text-white/30"
              }`}
            >
              {step > n ? "✓" : n}
            </div>
            {n < 3 && (
              <div className={`w-12 h-0.5 ${step > n ? "bg-green-500/50" : "bg-white/10"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="w-full max-w-xl">
        {/* Step 1: Goal */}
        {step === 1 && (
          <div className="animate-fadeIn">
            <h1 className="text-3xl font-bold mb-2">What&apos;s your learning goal?</h1>
            <p className="text-white/40 mb-8">
              Describe what you want to achieve. Be specific — it helps us build a better model.
            </p>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. I want to become an ML Engineer and work at a product company within 6 months"
              className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-green-500/50 focus:bg-white/8 resize-none transition-all"
            />
            <button
              onClick={() => goal.trim() && setStep(2)}
              disabled={!goal.trim()}
              className="mt-4 w-full py-3 bg-green-500 hover:bg-green-400 disabled:bg-white/10 disabled:text-white/30 text-white font-semibold rounded-xl transition-all"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: Background */}
        {step === 2 && (
          <div className="animate-fadeIn">
            <h1 className="text-3xl font-bold mb-2">Tell us about your background</h1>
            <p className="text-white/40 mb-8">
              This helps calibrate your starting knowledge state.
            </p>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="e.g. 2 years of Python development, built REST APIs, done some SQL but nothing advanced..."
              className="w-full h-28 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-green-500/50 resize-none transition-all mb-6"
            />
            <p className="text-sm text-white/50 mb-3">Overall experience level</p>
            <div className="flex flex-col gap-2 mb-6">
              {EXPERIENCE_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setExperience(lvl)}
                  className={`px-4 py-3 rounded-xl text-left text-sm transition-all border ${
                    experience === lvl
                      ? "border-green-500/50 bg-green-500/10 text-green-300"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/8"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!background.trim() || !experience}
                className="flex-1 py-3 bg-green-500 hover:bg-green-400 disabled:bg-white/10 disabled:text-white/30 text-white font-semibold rounded-xl transition-all"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Self-Assessment */}
        {step === 3 && (
          <div className="animate-fadeIn">
            <h1 className="text-3xl font-bold mb-2">Self-assess your skills</h1>
            <p className="text-white/40 mb-2">
              Rate your confidence for each skill. Be honest — we&apos;ll validate it with
              diagnostics.
            </p>
            <p className="text-xs text-amber-400/60 mb-8">
              ⚠ Overconfident ratings will be caught in the diagnostic phase.
            </p>

            <div className="space-y-4 mb-8">
              {SKILLS.map((skill) => (
                <div key={skill} className="glass rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">{skill}</span>
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        confidences[skill] >= 80
                          ? "text-green-400"
                          : confidences[skill] >= 50
                          ? "text-amber-400"
                          : "text-white/40"
                      }`}
                    >
                      {confidences[skill]}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={confidences[skill]}
                    onChange={(e) =>
                      setConfidences((prev) => ({ ...prev, [skill]: Number(e.target.value) }))
                    }
                    className="w-full accent-green-500"
                  />
                  <div className="flex justify-between text-xs text-white/20 mt-1">
                    <span>Never heard of it</span>
                    <span>Could teach it</span>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-green-500 hover:bg-green-400 disabled:bg-white/10 disabled:text-white/30 text-white font-semibold rounded-xl transition-all"
              >
                {loading ? "Building your knowledge model…" : "Build My Knowledge Model →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
