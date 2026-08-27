import type { Metadata } from "next"
import NextTopLoader from "nextjs-toploader"
import "./globals.css"

export const metadata: Metadata = {
  title: "SkillPulse — Living Learning Intelligence",
  description: "A living model of what you know, what you're forgetting, and how you learn best",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <NextTopLoader color="#6366f1" height={3} showSpinner={false} />
        {children}
      </body>
    </html>
  )
}
