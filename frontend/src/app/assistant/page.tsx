"use client"

import { useState, useRef, useEffect } from "react"
import { getLearnerID } from "@/lib/api"
import AppNav from "@/components/shared/AppNav"

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")

interface Message {
  role: "user" | "assistant"
  content: string
}

const SUGGESTED = [
  "What should I study next?",
  "Which skills am I at risk of forgetting?",
  "What's the fastest path to my goal?",
  "Where are my knowledge gaps?",
]

export default function AssistantPage() {
  const [goal, setGoal] = useState("")

  useEffect(() => {
    const saved = localStorage.getItem("skillpulse:goal")
    if (saved) setGoal(saved)
  }, [])

  const greeting = goal
    ? `Hi! I'm your SkillPulse learning coach. I can see you're working towards: "${goal}". I have full visibility into your knowledge state — what would you like to know?`
    : "Hi! I'm your SkillPulse learning coach. I can see your current knowledge state and help guide your learning path. What would you like to know?"

  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    if (greeting) setMessages([{ role: "assistant", content: greeting }])
  }, [greeting])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: "user", content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learner_id: getLearnerID(),
          message: text,
          history: newMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok) throw new Error("API error")
      const data = await res.json()
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }])
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "I'm having trouble connecting to the backend. Please make sure the server is running on port 8000.",
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppNav />

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-900">AI Learning Coach</h1>
          <p className="text-sm text-slate-500">Contextual guidance based on your knowledge state</p>
        </div>

        {/* Chat */}
        <div className="flex-1 card-elevated rounded-2xl flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ maxHeight: "calc(100vh - 300px)" }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 mr-2 mt-1 flex-shrink-0">
                    SP
                  </div>
                )}
                <div className={`max-w-sm px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-slate-100 text-slate-800 rounded-bl-sm"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 mr-2 flex-shrink-0">SP</div>
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested questions */}
          {messages.length === 1 && (
            <div className="px-5 pb-3">
              <p className="text-xs text-slate-400 mb-2">Suggested</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-slate-100 flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="Ask about your learning path..."
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium rounded-xl transition-all text-sm"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
