"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { api, getLearnerID, type DomainDiscoverResponse } from "@/lib/api"

const EXPERIENCE_LEVELS = ["Beginner (< 1 year)", "Intermediate (1-3 years)", "Senior (3+ years)"]

export default function OnboardPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  // Redirect already-onboarded users — they must reset from Profile to re-onboard
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasGoal = localStorage.getItem("skillpulse:goal")
      if (hasGoal) router.replace("/dashboard")
    }
  }, [router])
  const [goal, setGoal] = useState("")
  const [background, setBackground] = useState("")
  const [experience, setExperience] = useState("")

  // Domain-discovery state
  const [discovering, setDiscovering] = useState(false)
  const [domainPack, setDomainPack] = useState<DomainDiscoverResponse | null>(null)
  const [domainError, setDomainError] = useState("")

  // Dynamic skills for self-assessment (populated after domain discovery)
  const [skills, setSkills] = useState<string[]>([])
  const [confidences, setConfidences] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Step 1 → 2: discover domain and advance
  const handleGoalNext = async () => {
    if (!goal.trim()) return
    setDiscovering(true)
    setDomainError("")
    try {
      // Trigger domain discovery — result is used in step 3
      const result = await api.setGoal(getLearnerID(), goal, background)
      const fetchedSkills = (result.self_assessment_skills ?? []).map((s) => s.name)
      if (fetchedSkills.length > 0) {
        setSkills(fetchedSkills)
        setConfidences(Object.fromEntries(fetchedSkills.map((s) => [s, 50])))
      }
      // Save LLM-derived domain name (e.g. "Classical Guitar") for display in nav
      if (result.domain_name) {
        localStorage.setItem("skillpulse:name", result.domain_name)
      }
      setStep(2)
    } catch {
      setDomainError("Could not connect to backend. Make sure the server is running.")
    } finally {
      setDiscovering(false)
    }
  }

  // Step 2 → 3
  const handleBackgroundNext = () => {
    if (!background.trim() || !experience) return
    setStep(3)
  }

  // Step 3: submit self-assessment
  const handleSubmit = async () => {
    setLoading(true)
    setError("")
    try {
      if (skills.length > 0) {
        await api.selfAssess(
          getLearnerID(),
          skills.map((s) => ({ skill_name: s, confidence: confidences[s] / 100 }))
        )
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("skillpulse:goal", goal)
      }
      router.push("/dashboard")
    } catch {
      setError("Could not save your assessment. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <span className="font-bold text-slate-900">
          <span className="text-indigo-600">SP</span> SkillPulse
        </span>
        <span className="text-sm text-slate-500">Onboarding — Step {step} of 3</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start pt-12 px-4">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-10">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step === n
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                  : step > n
                  ? "bg-green-500 text-white"
                  : "bg-slate-200 text-slate-400"
              }`}>
                {step > n ? "✓" : n}
              </div>
              {n < 3 && (
                <div className={`w-16 h-0.5 ${step > n ? "bg-green-400" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="w-full max-w-xl">
          {/* Step 1: Goal */}
          {step === 1 && (
            <div className="animate-fadeIn card-elevated rounded-2xl p-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">What do you want to learn?</h1>
              <p className="text-slate-500 text-sm mb-6">
                Any goal works — from &quot;become an ML engineer&quot; to &quot;master classical guitar.&quot; Be specific.
              </p>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. I want to become a data scientist and work on NLP models"
                className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none transition-all text-sm"
              />
              {domainError && (
                <p className="mt-2 text-red-600 text-xs">{domainError}</p>
              )}
              <button
                onClick={handleGoalNext}
                disabled={!goal.trim() || discovering}
                className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-all text-sm"
              >
                {discovering ? "Discovering your domain…" : "Continue"}
              </button>
              {discovering && (
                <p className="mt-3 text-center text-xs text-slate-400">
                  SkillPulse is building a competency model for your goal…
                </p>
              )}
            </div>
          )}

          {/* Step 2: Background */}
          {step === 2 && (
            <div className="animate-fadeIn card-elevated rounded-2xl p-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Tell us about your background</h1>
              <p className="text-slate-500 text-sm mb-6">This helps calibrate your starting knowledge state.</p>
              <textarea
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                placeholder="e.g. 2 years of Python development, some SQL, basic probability from college…"
                className="w-full h-28 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none transition-all text-sm mb-5"
              />
              <p className="text-sm font-medium text-slate-700 mb-3">Overall experience level</p>
              <div className="flex flex-col gap-2 mb-6">
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setExperience(lvl)}
                    className={`px-4 py-3 rounded-xl text-left text-sm transition-all border ${
                      experience === lvl
                        ? "border-indigo-400 bg-indigo-50 text-indigo-800 font-medium"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-sm font-medium transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleBackgroundNext}
                  disabled={!background.trim() || !experience}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-all text-sm"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Self-Assessment */}
          {step === 3 && (
            <div className="animate-fadeIn">
              <div className="card-elevated rounded-2xl p-8 mb-4">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Rate your current knowledge</h1>
                <p className="text-slate-500 text-sm mb-1">
                  Be honest — overconfidence will be caught in the diagnostic phase.
                </p>
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                  Self-assessments are treated as weak signals. Diagnostic questions will verify and correct them.
                </p>
              </div>

              {skills.length > 0 ? (
                <div className="space-y-3 mb-4">
                  {skills.map((skill) => (
                    <div key={skill} className="card-elevated rounded-xl p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-800">{skill}</span>
                        <span className={`text-sm font-bold tabular-nums ${
                          (confidences[skill] ?? 50) >= 80
                            ? "text-green-600"
                            : (confidences[skill] ?? 50) >= 50
                            ? "text-amber-600"
                            : "text-slate-400"
                        }`}>
                          {confidences[skill] ?? 50}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={confidences[skill] ?? 50}
                        onChange={(e) =>
                          setConfidences((prev) => ({ ...prev, [skill]: Number(e.target.value) }))
                        }
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>Never heard of it</span>
                        <span>Could teach it</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card-elevated rounded-xl p-6 mb-4 text-center text-slate-500 text-sm">
                  No skills to rate — we&apos;ll calibrate from the diagnostic assessment.
                </div>
              )}

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-sm font-medium transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-all text-sm"
                >
                  {loading ? "Building your knowledge model…" : "Build My Knowledge Model"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
