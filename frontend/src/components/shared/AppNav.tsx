"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/path", label: "Path" },
  { href: "/learn", label: "Practice" },
  { href: "/assistant", label: "AI Coach" },
  { href: "/insights", label: "Analytics" },
]

export default function AppNav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const name = localStorage.getItem("skillpulse:name") || ""
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

  const avatarChar = displayName ? displayName[0].toUpperCase() : "?"

  return (
    <>
      <nav className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-1.5 font-bold text-slate-900 text-lg flex-shrink-0">
            <span className="text-indigo-600">SP</span>
            <span className="hidden sm:inline">SkillPulse</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {editingName ? (
            <input
              ref={inputRef}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false) }}
              className="hidden sm:block px-2.5 py-1 text-xs border border-indigo-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-200 w-32"
              maxLength={40}
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="hidden sm:inline px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 text-xs font-medium rounded-full transition-colors"
              title="Click to edit your name"
            >
              {displayName || "Set name"}
            </button>
          )}
          <Link
            href="/profile"
            className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-700 hover:bg-indigo-200 transition-colors"
          >
            {avatarChar}
          </Link>
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden w-8 h-8 flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="5" x2="16" y2="5" />
              <line x1="2" y1="9" x2="16" y2="9" />
              <line x1="2" y1="13" x2="16" y2="13" />
            </svg>
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="md:hidden fixed top-[52px] left-0 right-0 z-30 bg-white border-b border-slate-200 shadow-lg">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center px-6 py-3 text-sm font-medium border-b border-slate-100 last:border-0 transition-colors ${
                  isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
