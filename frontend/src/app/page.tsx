"use client"

import Link from "next/link"

const features = [
  {
    icon: "🧠",
    title: "Living Knowledge State",
    description:
      "Bayesian probability model per skill — not binary completed/not, but a living estimate with confidence intervals that updates every time you interact.",
    color: "border-green-500/30 bg-green-500/5",
    glow: "group-hover:shadow-green-500/20",
  },
  {
    icon: "📡",
    title: "Skill Decay Detection",
    description:
      "Exponential forgetting curves reveal which skills you learned weeks ago are silently fading. Get maintenance refreshes before decay costs you in interviews.",
    color: "border-red-500/30 bg-red-500/5",
    glow: "group-hover:shadow-red-500/20",
  },
  {
    icon: "⚡",
    title: "Transfer Intelligence",
    description:
      "Your SQL knowledge = 45% of Pandas already learned. Detect existing skill transfer and collapse your learning time — stop starting from zero.",
    color: "border-blue-500/30 bg-blue-500/5",
    glow: "group-hover:shadow-blue-500/20",
  },
  {
    icon: "🎯",
    title: "Confidence Calibration",
    description:
      "Catch Dunning-Kruger gaps before they hurt you. We ask your confidence before each question, then reveal where you think you know something but don't.",
    color: "border-amber-500/30 bg-amber-500/5",
    glow: "group-hover:shadow-amber-500/20",
  },
]

const nodeShowcase = [
  { color: "#22c55e", label: "Solid Mastery", desc: "Well-known, fresh" },
  { color: "#ef4444", label: "Decaying", desc: "Fading from disuse" },
  { color: "#f59e0b", label: "Overconfident", desc: "You think you know it" },
  { color: "#3b82f6", label: "Transfer Ready", desc: "Existing skill helps" },
  { color: "#6b7280", label: "Not Started", desc: "Path forward" },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/3 rounded-full blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="text-xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            SkillPulse
          </span>
        </div>
        <div className="flex gap-4">
          <Link
            href="/onboard"
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            Onboard
          </Link>
          <Link
            href="/dashboard?demo=true"
            className="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
          >
            View Demo
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-8 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          HCLTech Amplified Hackathon
        </div>

        <h1 className="text-6xl font-bold leading-tight mb-6">
          <span className="bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">
            A living model of
          </span>
          <br />
          <span className="bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            what you know
          </span>
        </h1>

        <p className="text-xl text-white/50 max-w-2xl mx-auto mb-4 leading-relaxed">
          SkillPulse doesn&apos;t recommend courses. It maintains a{" "}
          <span className="text-white/80">probabilistic model</span> of your knowledge — catching
          what you&apos;re forgetting, revealing dangerous gaps, and showing how your existing skills
          shortcut your path.
        </p>

        <p className="text-sm text-white/30 mb-12 max-w-xl mx-auto">
          Not a ChatGPT wrapper. Real Bayesian inference · Exponential decay modeling · Transfer
          intelligence · Graph algorithms
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/dashboard?demo=true"
            className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/25 hover:shadow-green-500/40 text-lg"
          >
            ▶ Start Demo — Meet Priya
          </Link>
          <Link
            href="/onboard"
            className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all text-lg"
          >
            Onboard Yourself
          </Link>
        </div>
      </section>

      {/* Node legend */}
      <section className="relative z-10 max-w-3xl mx-auto px-8 mb-20">
        <div className="glass rounded-2xl p-6">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-4 text-center">
            Knowledge State Legend
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {nodeShowcase.map((n) => (
              <div key={n.label} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: n.color,
                    boxShadow: `0 0 8px ${n.color}`,
                  }}
                />
                <div>
                  <div className="text-xs font-medium text-white/80">{n.label}</div>
                  <div className="text-xs text-white/40">{n.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-5xl mx-auto px-8 pb-24">
        <h2 className="text-2xl font-semibold text-center text-white/70 mb-12">
          What makes it different
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className={`group p-6 rounded-2xl border ${f.color} transition-all hover:shadow-xl ${f.glow}`}
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative z-10 text-center pb-20">
        <p className="text-white/30 text-sm mb-4">
          Built for HCLTech Amplified · Bayesian inference + Graph intelligence + LLM reasoning
        </p>
        <Link
          href="/dashboard?demo=true"
          className="text-green-400 hover:text-green-300 text-sm underline underline-offset-4"
        >
          Launch the live demo →
        </Link>
      </section>
    </div>
  )
}
