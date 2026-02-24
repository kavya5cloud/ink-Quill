<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Ink & Quill

## Run locally

1. Install dependencies: `npm install`
2. Create `.env` from `.env.example` and set values.
3. Start app + API server: `npm run dev`

## Deploy to Vercel

This project uses:
- Vite static frontend (`dist`)
- Vercel serverless API routes in `/api/*`
- Vercel Postgres for auth/posts persistence

Set these environment variables in Vercel:
- `POSTGRES_URL` (from Vercel Postgres integration)
- `VITE_ADSENSE_CLIENT_ID`
- `VITE_ADSENSE_SLOT_LEFT`
- `VITE_ADSENSE_SLOT_RIGHT`
- `GEMINI_API_KEY` (if using AI features in production)

Then redeploy.
