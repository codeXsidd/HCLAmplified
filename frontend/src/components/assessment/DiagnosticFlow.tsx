"use client"

import { useState, useEffect, useRef } from "react"
import type { AssessmentItem, SubmitResponseResult } from "@/lib/api"

interface Props {
  items: AssessmentItem[]
  learnerId: string
  onSubmit: (itemId: string, skillId: string, response: number, confidenceBefore: number, timeMs: number) => Promise<SubmitResponseResult>
  onComplete: (results: { item: AssessmentItem; result: SubmitResponseResult; confidence: number }[]) => void
  onClose: () => void
}

export default function DiagnosticFlow({ items, learnerId, onSubmit, onComplete, onClose }: Props) {
  const [step, setStep] = useState<"confidence" | "question" | "result">("confidence")
  const [currentIdx, setCurrentIdx] = useState(0)
  const [confidence, setConfidence] = useState(50)
  const [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<SubmitResponseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [allResults, setAllResults] = useState<{ item: AssessmentItem; result: SubmitResponseResult; confidence: number }[]>([])
  const startTime = useRef(Date.now())

  const current = items[currentIdx]
  const total = items.length

  const handleAnswer = async (optionIdx: number) => {
    if (loading || step !== "question") return
    setSelected(optionIdx)
    setLoading(true)
    const timeMs = Date.now() - startTime.current
    try {
      const res = await onSubmit(current.id, current.skill_name, optionIdx, confidence / 100, timeMs)
      setResult(res)
      setStep("result")
    } catch {
      setResult({ score: optionIdx === current.content.correct_answer ? 1 : 0, correct: optionIdx === current.content.correct_answer, explanation: "Could not connect to server — scoring locally.", updated_state: {} as any })
      setStep("result")
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (!result) return
    const newResults = [...allResults, { item: current, result, confidence }]
    setAllResults(newResults)
    if (currentIdx + 1 >= total) {
      onComplete(newResults)
      return
    }
    setCurrentIdx((i) => i + 1)
    setStep("confidence")
    setConfidence(50)
    setSelected(null)
    setResult(null)
    startTime.current = Date.now()
  }

  useEffect(() => {
    startTime.current = Date.now()
  }, [currentIdx])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Diagnostic</div>
            <div className="font-semibold text-slate-800">{current.skill_name}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400">{currentIdx + 1} / {total}</div>
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-slate-600 text-xl leading-none transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100 rounded-full mb-6">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${((currentIdx) / total) * 100}%` }}
          />
        </div>

        {/* Step: Confidence */}
        {step === "confidence" && (
          <div className="animate-fadeIn">
            <p className="text-sm text-slate-500 mb-1">
              Before answering — how confident are you in{" "}
              <span className="text-slate-800 font-medium">{current.skill_name}</span>?
            </p>
            <div className="text-center my-6">
              <span
                className={`text-5xl font-bold tabular-nums ${
                  confidence >= 80
                    ? "text-green-600"
                    : confidence >= 50
                    ? "text-amber-500"
                    : "text-slate-400"
                }`}
              >
                {confidence}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="w-full accent-indigo-600 mb-6"
            />
            <div className="flex justify-between text-xs text-slate-400 mb-8">
              <span>Not confident at all</span>
              <span>Completely confident</span>
            </div>
            <button
              onClick={() => { setStep("question"); startTime.current = Date.now() }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl transition-colors shadow-sm"
            >
              Show Question →
            </button>
          </div>
        )}

        {/* Step: Question */}
        {step === "question" && (
          <div className="animate-fadeIn">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-md border border-slate-200">
                Difficulty: {Math.round(current.difficulty * 100)}%
              </span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-md border border-slate-200">
                Your confidence: {confidence}%
              </span>
            </div>
            <p className="text-slate-800 font-medium mb-5 leading-relaxed">{current.content.question}</p>
            <div className="space-y-2">
              {current.content.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={loading}
                  className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-sm text-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-slate-400 mr-2 font-medium">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Result */}
        {step === "result" && result && (
          <div className="animate-fadeIn">
            <div
              className={`flex items-center gap-3 p-4 rounded-xl mb-4 ${
                result.correct
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <span className={`text-2xl font-bold ${result.correct ? "text-green-600" : "text-red-500"}`}>
                {result.correct ? "✓" : "✗"}
              </span>
              <div>
                <div className={`font-semibold ${result.correct ? "text-green-700" : "text-red-600"}`}>
                  {result.correct ? "Correct!" : "Incorrect"}
                </div>
                {!result.correct && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    Correct: {current.content.options[current.content.correct_answer]}
                  </div>
                )}
              </div>
            </div>

            {/* Calibration warning */}
            {!result.correct && confidence >= 70 && (
              <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs">
                <span className="font-semibold">Calibration notice:</span> You rated {confidence}% confidence but answered incorrectly. This is logged as an overconfidence signal.
              </div>
            )}

            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              {result.explanation || current.content.explanation}
            </p>

            {/* Updated mastery preview */}
            {result.updated_state?.mastery_estimate != null && (
              <div className="mb-5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-400 mb-1">Knowledge state updated</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.round(result.updated_state.mastery_estimate * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-600 tabular-nums font-medium">
                    {Math.round(result.updated_state.mastery_estimate * 100)}%
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleNext}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl transition-colors shadow-sm"
            >
              {currentIdx + 1 >= total ? "See Results →" : "Next Question →"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
