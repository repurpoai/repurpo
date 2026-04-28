# REPURPO_STRUCTURE.md

> AI context anchor for the Repurpo codebase. This file is meant to give a new assistant the fastest possible understanding of the project, its structure, and its current working flow.

---

## 1. What Repurpo is

Repurpo is a **Next.js 15 SaaS app** that repurposes one source into content for multiple platforms. The source can be:

- a URL/article
- a YouTube link
- raw pasted text

The outputs are tailored for:

- LinkedIn
- X / Twitter
- Instagram
- Reddit
- Newsletter

The codebase also includes image generation, billing, admin tooling, auth, private history, Redis-based caching, and anti-abuse controls.

The current product direction is clear:

- different tone per platform
- different length per platform
- cache reuse per platform instead of all platforms as one bundle
- regenerate that bypasses cache
- remove platform-specific UI that does not fit the output

---

## 2. Stack overview

| Layer | Tech |
|---|---|
| Framework | Next.js 15 App Router |
| UI | React 19 + Tailwind CSS |
| Language | TypeScript |
| Auth / DB | Supabase Auth + PostgreSQL + RLS |
| AI text | Google Gemini |
| AI images | Cloudflare AI |
| Cache | Upstash Redis |
| Payments | Dodo Payments |
| Validation | Zod |
| Transcript extraction | `youtube-transcript` |
| Article extraction | `@mozilla/readability` + `jsdom` |

---

## 3. Main source files

### Pages and routes

- `app/page.tsx` — homepage
- `app/login/page.tsx`
- `app/signup/page.tsx`
- `app/forgot-password/page.tsx`
- `app/reset-password/page.tsx`
- `app/dashboard/page.tsx`
- `app/history/page.tsx`
- `app/history/[id]/page.tsx`
- `app/profile/page.tsx`
- `app/pricing/page.tsx`
- `app/admin/page.tsx`
- `app/maintenance/page.tsx`
- `app/blocked/page.tsx`
- `app/checkout/success/page.tsx`
- `app/checkout/cancel/page.tsx`

### Dashboard generation flow

- `app/dashboard/_components/dashboard-generator.tsx`
- `app/dashboard/_components/dashboard-content.tsx`
- `app/dashboard/actions.ts`
- `app/api/generate-content/route.ts`

### Core libraries

- `lib/gemini.ts`
- `lib/content-cache.ts`
- `lib/extract-article.ts`
- `lib/youtube.ts`
- `lib/generation-control.ts`
- `lib/viewer.ts`
- `lib/plans.ts`
- `lib/admin.ts`
- `lib/security.ts`
- `lib/http-security.ts`
- `lib/activity.ts`
- `lib/upstash.ts`
- `lib/supabase/*`

### Public files

- `public/privacy-policy.html`
- `public/terms-of-service.html`
- `public/refund-policy.html`
- `public/.well-known/breachme-verify.txt`

### Schema and migrations

- `supabase/schema.sql`
- `supabase/v2_upgrade.sql`
- `supabase/hotfix_slot_key_ambiguous.sql`

---

## 4. What the app does end to end

### 4.1 Authentication

The user signs in with Supabase Auth. Supported login methods include:

- email + password
- Google OAuth

Session handling uses Supabase SSR.

### 4.2 Middleware and route protection

`middleware.ts` / `lib/supabase/middleware.ts` handle:

- refreshing auth cookies
- checking admin metadata
- checking block state
- enforcing maintenance mode
- keeping anonymous users out of protected routes
- keeping logged-in users away from login / signup pages

### 4.3 Dashboard input

The user can generate content from:

- URL / article
- YouTube URL
- raw text

The dashboard also accepts:

- selected platforms
- global tone / length defaults
- per-platform tone / length overrides
- regenerate / force-generate controls

### 4.4 Extraction

If the source is a URL, the app extracts readable content.
If it is YouTube, the app fetches transcript text.
If it is pasted text, the app sanitizes and validates it.

### 4.5 Cache lookup

Before Gemini is called, the app checks the generation cache **per platform**.

That means:

- Instagram can come from cache
- Reddit can still be generated fresh
- X can be reused independently

The cache is not all-or-nothing anymore.

### 4.6 Gemini generation

The app sends only the missing platforms to Gemini.
Gemini returns structured JSON with platform outputs and an image prompt.

### 4.7 Save + display

The final generation is stored in Supabase, cached in Redis, and streamed back to the UI.
The generation also appears in history pages.

---

## 5. Generation workflow in detail

### 5.1 Input validation

Validation checks include:

- URL format
- minimum text length
- allowed tone values
- allowed length values
- allowed platform values
- plan permissions
- monthly limits

### 5.2 Per-platform preferences

Each selected platform can have its own:

- tone
- length preset

Example:

- Instagram → casual + short
- Reddit → professional + medium
- Newsletter → authority + long

The system keeps a global fallback tone / length, but the per-platform settings are the important source of truth.

### 5.3 Source fingerprint

The generation cache uses a fingerprint based on the source, so the same source can be detected even across different requests.

### 5.4 Cache key design

A platform cache key is based on:

- source fingerprint
- platform
- tone
- length preset

This is what makes partial reuse possible.

### 5.5 Regenerate behavior

Regenerate should bypass cache.
That is the only correct way to get a fresh model answer for the same source and same settings.

### 5.6 Streaming

`app/api/generate-content/route.ts` returns SSE events for:

- start
- platform_start
- platform_chunk
- platform_done
- complete
- error

The dashboard component consumes the stream and updates the UI in real time.

---

## 6. Cache architecture

### 6.1 Extraction cache

Used for article / YouTube extraction.
It prevents repeated scraping / transcript fetching for the same source.

### 6.2 Platform generation cache

Used for Gemini outputs.
It stores each platform separately and reuses only the matching platform output.

### 6.3 Redis / Supabase fallback behavior

- Redis is the primary cache layer.
- Supabase fallback exists for extraction cache.
- Platform generation cache is Redis-centric.

### 6.4 Why the cache is split

Because one request can contain multiple platforms, and those platforms may be reused independently later.

Example:

- first run: Instagram + Reddit + Newsletter
- second run: Instagram + Twitter
- result: Instagram reused, Twitter generated fresh

That is the correct behavior.

---

## 7. Data model summary

### `profiles`

Stores user identity and account status:

- role
- tier
- billing state
- block state
- monthly limits

### `generations`

Stores every generation result and history data.
It includes source info, platform outputs, source meta, selected platforms, and model name.

### `drafts`

Autosaved dashboard state.

### `content_extraction_cache`

Extraction cache for article / YouTube source text.

### `generation_slots`

Concurrency control table.

### `generation_rate_limits`

Generation abuse control.

### `auth_rate_limits`

Login abuse control.

### `app_settings`

Maintenance mode and global flags.

### `user_logs`

Audit log.

### `billing_webhook_events`

Webhook idempotency.

---

## 8. Billing and plan gating

The app uses Dodo Payments for billing.

Plan logic lives in `lib/plans.ts` and controls:

- allowed tones
- monthly generation limits
- image limits
- feature access

Free tier is intentionally restricted.
Paid tiers unlock more flexibility.

---

## 9. Image generation

Image generation is separate from text generation.

Main route:

- `app/api/generate-image/route.ts`

It uses Cloudflare AI and stores image generation metadata in Supabase.

---

## 10. Security and reliability

Key protections include:

- auth-based route protection
- block handling
- maintenance gating
- rate limits
- generation slot limiting
- same-origin / security header helpers
- service-role isolation for admin tasks

---

## 11. UI notes

Important client components:

- `components/sidebar.tsx`
- `components/site-header.tsx`
- `components/open-in-app-button.tsx`
- `components/copy-button.tsx`
- `components/export-button.tsx`
- `components/google-auth-button.tsx`
- `app/dashboard/_components/dashboard-generator.tsx`

The dashboard generator is the most important UI file.
It handles:

- form state
- per-platform preferences
- SSE progress
- cache-aware result rendering
- regenerate action
- error handling

---

## 12. Important deployment detail

Files at the project root are not browser-served by Vercel.
Only files inside `public/` are directly available by URL.

That matters for:

- `privacy-policy.html`
- `terms-of-service.html`
- `refund-policy.html`
- `REPURPO_STRUCTURE.md`

If you want a file opened at `/FILE_NAME.md`, it must exist under `public/`.

---

## 13. Known weak spots to watch

- Make sure `public/privacy-policy.html` is the source actually deployed.
- Do not keep duplicate cache helper files.
- Keep route payload types in sync with dashboard state types.
- Keep per-platform preferences consistent across UI, server actions, Gemini prompts, and cache keys.
- When the app changes flow, update both README and this structure file together.

---

## 14. When editing this codebase

Prioritize these files first:

1. `app/dashboard/_components/dashboard-generator.tsx`
2. `app/dashboard/actions.ts`
3. `app/api/generate-content/route.ts`
4. `lib/gemini.ts`
5. `lib/content-cache.ts`
6. `components/open-in-app-button.tsx`
7. `app/history/[id]/page.tsx`
8. `components/sidebar.tsx`

These files control the user-visible behavior of the latest generation flow.

---

## 15. Current product flow in one line

User logs in → extracts source → chooses platforms and per-platform tone/length → cache is checked per platform → Gemini fills missing outputs → results stream back → generation is saved → history and profile update.
