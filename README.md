# Echelon - Web Monitor

SERP & News Monitoring Platform con AI Analysis.

## Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Database**: Supabase (Postgres + Auth)
- **SERP Data**: DataForSEO API
- **AI Analysis**: Gemini 2.0 Flash
- **Charts**: Recharts + Nivo
- **Export**: ExcelJS
- **Hosting**: Vercel

## Setup

1. Copy `.env.example` to `.env.local` and fill in your credentials
2. Run the SQL migrations from `supabase/migrations/` on your Supabase project
3. Seed the admin user: `POST /api/auth/seed` with `{ "secret": "your-cron-secret" }`
4. `npm install && npm run dev`

## Environment Variables

See `.env.example` for required variables.
