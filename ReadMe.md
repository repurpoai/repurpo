# Repurpo

Repurpo is a Next.js 15 app that turns one source into platform-ready content.

## What it does

- Article URL extraction
- YouTube transcript input
- Raw text input
- Gemini-powered repurposing for LinkedIn, X, Instagram, Reddit, and newsletters
- Private generation history per user
- Billing via Dodo Payments
- Image generation via Cloudflare AI
- Admin tools for maintenance, roles, and user blocks

## Core flow

1. User signs up or logs in with Supabase auth.
2. The dashboard accepts a link, YouTube URL, or raw text.
3. Source content is cleaned and normalized.
4. Gemini generates platform-specific outputs.
5. The generation is saved to Supabase and shown in history.
6. Paid plans unlock higher limits and image tools.

## Required environment variables

See `.env.example` for the full list. The main ones are:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `SUPADATA_API_KEY`
- `SERPAPI_API_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `DODO_PAYMENTS_API_KEY`
- `DODO_PAYMENTS_WEBHOOK_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

## Development

```bash
npm install
npm run dev
```

## Notes

- Keep the Google AI Studio key in `GEMINI_API_KEY`.
- Keep the Dodo webhook secret in `DODO_PAYMENTS_WEBHOOK_KEY`.
- The app relies on Supabase row-level security for user data isolation.
