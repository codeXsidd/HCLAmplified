import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "skill-solid": "#22c55e",
        "skill-decaying": "#ef4444",
        "skill-overconfident": "#f59e0b",
        "skill-learning": "#a855f7",
        "skill-unknown": "#6b7280",
        "skill-transfer": "#3b82f6",
      },
      keyframes: {
        pulse_decay: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(1.15)" },
        },
        glow_solid: {
          "0%, 100%": { boxShadow: "0 0 5px #22c55e" },
          "50%": { boxShadow: "0 0 20px #22c55e, 0 0 40px #22c55e" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulse_decay: "pulse_decay 1.5s ease-in-out infinite",
        glow_solid: "glow_solid 2s ease-in-out infinite",
        fadeIn: "fadeIn 0.5s ease-out forwards",
      },
    },
  },
  plugins: [],
}
export default config
