"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { api, DEMO_LEARNER_ID } from "@/lib/api"
import AppNav from "@/components/shared/AppNav"

function LearnInner() {
  const searchParams = useSearchParams()
  const skill = searchParams.get("skill") || "Python Basics"
  const [question, setQuestion] = useState<any>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [confidence, setConfidence] = useState(50)
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    api.getDiagnostic(DEMO_LEARNER_ID, [skill])
      .then((res) => {
        if (res.items && res.items.length > 0) setQuestion(res.items[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [skill])

  const handleSubmit = async () => {
    if (selected === null || !question) return
    try {
      const res = await api.submitResponse({
        learner_id: DEMO_LEARNER_ID,
        assessment_item_id: question.id,
        skill_id: question.skill_name || skill,
        response: selected,
        confidence_before: confidence / 100,
        response_time_ms: 5000,
      })
      setResult(res)
      setSubmitted(true)
    } catch {
      setSubmitted(true)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav />
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-8">
          <Link href="/dashboard?demo=true" className="hover:text-indigo-600">Dashboard</Link>
          <span>/</span>
          <span className="text-slate-700 font-medium">{skill}</span>
        </div>

        <div className="card-elevated rounded-2xl p-8">
          <div className="mb-6">
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Practice Session</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{skill}</h1>
          </div>

          {loading ? (
            <div className="space-y-3">
              <div className="h-6 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
            </div>
          ) : question ? (
            <>
              {/* Confidence slider */}
              {!submitted && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm font-medium text-amber-800 mb-3">
                    Before answering — how confident are you in {skill}?
                  </p>
                  <div className="flex items-center gap-4">
                    <input
                      type="range" min={0} max={100} value={confidence}
                      onChange={(e) => setConfidence(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm font-bold text-amber-700 w-10 text-right">{confidence}%</span>
                  </div>
                  <div className="flex justify-between text-xs text-amber-600/60 mt-1">
                    <span>Not confident</span>
                    <span>Very confident</span>
                  </div>
                </div>
              )}

              {/* Question */}
              <div className="mb-6">
                <p className="text-slate-800 font-medium leading-relaxed mb-4">{question.content.question}</p>
                <div className="space-y-2">
                  {question.content.options?.map((opt: string, idx: number) => {
                    let style = "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    if (submitted) {
                      if (idx === question.content.correct_answer) style = "border-green-400 bg-green-50 text-green-800 font-medium"
                      else if (idx === selected) style = "border-red-300 bg-red-50 text-red-700"
                      else style = "border-slate-100 bg-slate-50 text-slate-400"
                    } else if (selected === idx) {
                      style = "border-indigo-400 bg-indigo-50 text-indigo-800"
                    }
                    return (
                      <button
                        key={idx}
                        onClick={() => !submitted && setSelected(idx)}
                        className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${style}`}
                      >
                        <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Explanation after submit */}
              {submitted && question.content.explanation && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Explanation</p>
                  <p className="text-sm text-blue-800">{question.content.explanation}</p>
                  {result?.updated_state && (
                    <p className="text-xs text-blue-600 mt-2">
                      Mastery updated to {Math.round((result.updated_state.mastery_estimate ?? 0) * 100)}%
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                {!submitted ? (
                  <button
                    onClick={handleSubmit}
                    disabled={selected === null}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-all text-sm"
                  >
                    Submit Answer
                  </button>
                ) : (
                  <Link
                    href="/dashboard?demo=true"
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all text-sm text-center"
                  >
                    Back to Dashboard
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm mb-4">No practice question available for this skill.</p>
              <Link href="/dashboard?demo=true" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                Back to Dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="text-slate-400">Loading...</div></div>}>
      <LearnInner />
    </Suspense>
  )
}
