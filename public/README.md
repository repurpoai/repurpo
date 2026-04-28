# Repurpo

Repurpo is a Next.js 15 SaaS app that turns one source into platform-ready content.

## What the app does

Repurpo takes one input source and repurposes it into output tailored for:

- LinkedIn
- X / Twitter
- Instagram
- Reddit
- Newsletter

Input modes:

- article / web URL
- YouTube URL
- raw pasted text

The app also includes:

- Supabase auth
- private per-user history
- admin tools
- billing via Dodo Payments
- image generation via Cloudflare AI
- extraction cache and generation cache via Redis / Supabase fallback
- generation rate limits and slot controls

## Latest generation flow

1. The user signs in with Supabase Auth.
2. The dashboard accepts a URL, YouTube link, or raw text.
3. The app extracts or sanitizes the source.
4. The user picks platforms and can set tone / length per platform.
5. The app checks cache per platform, not as one all-or-nothing bundle.
6. Gemini generates only the missing platform outputs.
7. Results are streamed to the UI through SSE.
8. The generation is saved in Supabase and cached in Redis.
9. The user can regenerate and bypass cache when needed.

## Current architecture

- **Frontend**: Next.js App Router + React 19 + Tailwind CSS
- **Auth / DB**: Supabase SSR + PostgreSQL + RLS
- **AI text**: Google Gemini
- **AI images**: Cloudflare AI
- **Cache**: Upstash Redis
- **Payments**: Dodo Payments
- **Validation**: Zod
- **Security**: middleware, headers, blocked-user redirects, rate limits

## Important env vars

See `.env.example` for the full list. The main ones are:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `DODO_*`
- `TURNSTILE_SECRET_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

## Key folders

- `app/` — routes, pages, API routes, server actions
- `components/` — reusable UI
- `lib/` — auth, cache, Gemini, billing, security, utilities
- `supabase/` — schema and SQL migrations
- `public/` — assets and public static files

## Important notes

- Files in the project root are **not** directly served by Vercel.
- To open a file in the browser, place it in `public/`.
- That is why `public/REPURPO_STRUCTURE.md` exists.
- `public/privacy-policy.html` is the browser-served privacy policy file.

## Main routes

- `/` homepage
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/dashboard`
- `/history`
- `/history/[id]`
- `/profile`
- `/pricing`
- `/admin`
- `/maintenance`
- `/blocked`
- `/checkout/success`
- `/checkout/cancel`

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Database and cache summary

- `profiles` stores user status, role, tier, billing, and block state.
- `generations` stores generation history.
- `drafts` stores autosaved dashboard state.
- `content_extraction_cache` stores article / transcript extraction.
- `generation_slots` and `generation_rate_limits` control concurrency and abuse.
- `user_logs` stores audit events.
- `billing_webhook_events` prevents duplicate webhook handling.

## What changed recently

- per-platform tone and length controls
- partial cache reuse per platform
- regenerate bypasses cache
- Instagram and newsletter do not use “Open in app”
- dashboard and generation flow are being cleaned up for stricter type safety
