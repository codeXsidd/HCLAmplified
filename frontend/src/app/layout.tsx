import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "SkillPulse — Living Learning Intelligence",
  description: "A living model of what you know, what you're forgetting, and how you learn best",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0f1e] text-white antialiased">
        {children}
      </body>
    </html>
  )
}
