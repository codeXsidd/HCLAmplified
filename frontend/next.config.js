/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Override in Vercel dashboard for production (set to your Render backend URL)
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    NEXT_PUBLIC_DEMO_LEARNER_ID: process.env.NEXT_PUBLIC_DEMO_LEARNER_ID || "priya-demo-001",
  },
};

module.exports = nextConfig;
