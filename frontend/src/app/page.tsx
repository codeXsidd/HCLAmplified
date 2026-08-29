"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

const features = [
  {
    title: "Living Knowledge State",
    description: "Bayesian probability model per skill — not binary completed/not, but a living estimate with confidence intervals that updates every time you interact.",
    accent: "border-green-200 bg-green-50",
    dot: "bg-green-500",
    tag: "Bayesian Inference",
  },
  {
    title: "Skill Decay Detection",
    description: "Exponential forgetting curves reveal which skills you learned weeks ago are silently fading. Get maintenance refreshes before decay costs you in interviews.",
    accent: "border-red-200 bg-red-50",
    dot: "bg-red-500",
    tag: "Decay Modeling",
  },
  {
    title: "Transfer Intelligence",
    description: "Your SQL knowledge = 45% of Pandas already learned. Detect existing skill transfer and collapse your learning time — stop starting from zero.",
    accent: "border-blue-200 bg-blue-50",
    dot: "bg-blue-500",
    tag: "Graph Algorithms",
  },
  {
    title: "Confidence Calibration",
    description: "Catch Dunning-Kruger gaps before they hurt you. We ask your confidence before each question, then reveal where you think you know something but don't.",
    accent: "border-amber-200 bg-amber-50",
    dot: "bg-amber-500",
    tag: "Metacognition",
  },
]

const nodeShowcase = [
  { color: "#22c55e", label: "Solid Mastery", desc: "Well-known, fresh" },
  { color: "#ef4444", label: "Decaying", desc: "Fading from disuse" },
  { color: "#f59e0b", label: "Overconfident", desc: "Dunning-Kruger risk" },
  { color: "#3b82f6", label: "Transfer Ready", desc: "Existing skill helps" },
  { color: "#94a3b8", label: "Not Started", desc: "Path forward" },
]

export default function LandingPage() {
  const [returningUser, setReturningUser] = useState(false)
  const [savedGoal, setSavedGoal] = useState("")

  useEffect(() => {
    const id = localStorage.getItem("skillpulse:learner_id")
    const goal = localStorage.getItem("skillpulse:goal")
    if (id && goal) {
      setReturningUser(true)
      setSavedGoal(goal)
    }
  }, [])

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-indigo-600">SP</span>
          <span className="text-xl font-bold text-slate-900">SkillPulse</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/onboard" className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">
            Get Started
          </Link>
          <Link href="/dashboard?demo=true" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
            View Demo
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-8 pt-20 pb-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6 text-slate-900">
          A living model of
          <br />
          <span className="text-indigo-600">what you know</span>
        </h1>

        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-4 leading-relaxed">
          SkillPulse maintains a <span className="text-slate-800 font-medium">probabilistic model</span> of your knowledge —
          catching what you&apos;re forgetting, revealing dangerous gaps, and showing how your existing skills shortcut your path.
        </p>

        <p className="text-sm text-slate-400 mb-12 max-w-xl mx-auto">
          Real Bayesian inference · Exponential decay modeling · Transfer intelligence · Graph algorithms
        </p>

        {returningUser && (
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Welcome back — continuing: <span className="font-semibold ml-1 truncate max-w-xs">{savedGoal}</span>
          </div>
        )}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {returningUser ? (
            <Link
              href="/dashboard"
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-sm shadow-indigo-200 text-lg"
            >
              Continue Learning →
            </Link>
          ) : (
            <Link
              href="/onboard"
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-sm shadow-indigo-200 text-lg"
            >
              Start Learning
            </Link>
          )}
          <Link
            href="/dashboard?demo=true"
            className="px-8 py-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium rounded-xl transition-all text-lg"
          >
            View Demo
          </Link>
        </div>
      </section>

      {/* Node legend */}
      <section className="max-w-3xl mx-auto px-8 mb-16">
        <div className="card-elevated rounded-2xl p-6">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-5 text-center font-semibold">
            Knowledge State Legend
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {nodeShowcase.map((n) => (
              <div key={n.label} className="flex items-center gap-2.5">
                <div
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: n.color }}
                />
                <div>
                  <div className="text-xs font-semibold text-slate-700">{n.label}</div>
                  <div className="text-xs text-slate-400">{n.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-8 pb-20 bg-slate-50 rounded-3xl py-16 mb-16">
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-3">What makes it different</h2>
        <p className="text-center text-slate-500 mb-12 text-sm">Four capabilities that traditional learning platforms don&apos;t have</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f) => (
            <div key={f.title} className={`p-6 rounded-2xl border ${f.accent} transition-all hover:shadow-md`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${f.dot}`} />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{f.tag}</span>
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="text-center pb-20 px-8">
        <p className="text-slate-400 text-sm mb-4">
          Bayesian inference + Graph intelligence + LLM reasoning
        </p>
        <Link href="/dashboard?demo=true" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium underline underline-offset-4">
          Launch the live demo
        </Link>
      </section>
    </div>
  )
}
