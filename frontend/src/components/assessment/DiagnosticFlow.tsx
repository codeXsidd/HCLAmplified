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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-xs text-white/40 uppercase tracking-widest mb-1">Diagnostic</div>
            <div className="font-semibold text-white">{current.skill_name}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-white/40">{currentIdx + 1} / {total}</div>
            <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl leading-none">×</button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/10 rounded-full mb-6">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${((currentIdx) / total) * 100}%` }} />
        </div>

        {/* Step: Confidence */}
        {step === "confidence" && (
          <div className="animate-fadeIn">
            <p className="text-sm text-white/60 mb-1">Before answering — how confident are you in <span className="text-white font-medium">{current.skill_name}</span>?</p>
            <div className="text-center my-6">
              <span className={`text-5xl font-bold tabular-nums ${confidence >= 80 ? "text-green-400" : confidence >= 50 ? "text-amber-400" : "text-white/40"}`}>{confidence}%</span>
            </div>
            <input type="range" min={0} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full accent-green-500 mb-6" />
            <div className="flex justify-between text-xs text-white/30 mb-8">
              <span>Not confident at all</span>
              <span>Completely confident</span>
            </div>
            <button onClick={() => { setStep("question"); startTime.current = Date.now() }} className="w-full py-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-xl transition-all">
              Show Question →
            </button>
          </div>
        )}

        {/* Step: Question */}
        {step === "question" && (
          <div className="animate-fadeIn">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-0.5 bg-white/5 text-white/40 text-xs rounded">
                Difficulty: {Math.round(current.difficulty * 100)}%
              </span>
              <span className="px-2 py-0.5 bg-white/5 text-white/40 text-xs rounded">
                Your confidence: {confidence}%
              </span>
            </div>
            <p className="text-white font-medium mb-5 leading-relaxed">{current.content.question}</p>
            <div className="space-y-2">
              {current.content.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={loading}
                  className="w-full text-left px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/80 transition-all disabled:opacity-50"
                >
                  <span className="text-white/40 mr-2">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Result */}
        {step === "result" && result && (
          <div className="animate-fadeIn">
            <div className={`flex items-center gap-3 p-4 rounded-xl mb-4 ${result.correct ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
              <span className="text-2xl">{result.correct ? "✓" : "✗"}</span>
              <div>
                <div className={`font-semibold ${result.correct ? "text-green-400" : "text-red-400"}`}>
                  {result.correct ? "Correct!" : "Incorrect"}
                </div>
                {!result.correct && (
                  <div className="text-xs text-white/50 mt-0.5">
                    Correct: {current.content.options[current.content.correct_answer]}
                  </div>
                )}
              </div>
            </div>

            {/* Calibration insight */}
            {!result.correct && confidence >= 70 && (
              <div className="mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs">
                ⚠ You rated {confidence}% confidence but answered incorrectly. This is logged as an overconfidence signal.
              </div>
            )}

            <p className="text-xs text-white/50 mb-5 leading-relaxed">{result.explanation || current.content.explanation}</p>

            {/* Updated mastery preview */}
            {result.updated_state?.mastery_estimate != null && (
              <div className="mb-5 p-3 bg-white/5 rounded-xl">
                <div className="text-xs text-white/40 mb-1">Knowledge state updated</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.round(result.updated_state.mastery_estimate * 100)}%` }} />
                  </div>
                  <span className="text-xs text-white/60 tabular-nums">{Math.round(result.updated_state.mastery_estimate * 100)}%</span>
                </div>
              </div>
            )}

            <button onClick={handleNext} className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl transition-all">
              {currentIdx + 1 >= total ? "See Results →" : "Next Question →"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
