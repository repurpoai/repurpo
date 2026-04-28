# REPURPO_STRUCTURE.md
> **AI Context Anchor** — Drop this file into any new chat to give an AI assistant immediate architectural context for the Repurpo codebase.

---

## 1. What Is Repurpo?

Repurpo is a **Next.js 15 SaaS app** that repurposes content (articles, YouTube transcripts, or raw text) into platform-specific posts — LinkedIn, X/Twitter, Instagram, Reddit, and Newsletter — using Google Gemini. It also generates matching social images via Cloudflare AI. Users subscribe via Dodo Payments (Stripe-like).

**Vibe:** Modern dark-glassmorphism UI. Production-quality server-side auth. SSE streaming for AI output. Multi-tier plan gating. No third-party CMS.

---

## 2. Core Tech Stack

| Layer | Tech | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.14 |
| React | React | 19.x |
| Language | TypeScript | 5.8.x |
| Database + Auth | Supabase (PostgreSQL + Auth + RLS) | `@supabase/supabase-js` ^2.99.3 |
| Supabase SSR | `@supabase/ssr` | ^0.9.0 |
| AI (text) | Google GenAI SDK | `@google/genai` ^1.46.0 |
| AI (image) | Cloudflare AI (Workers AI REST) | `stable-diffusion-xl-base-1.0` |
| Payments | Dodo Payments | `lib/dodo.ts` (custom REST client) |
| Rate limiting / Cache | Upstash Redis | `@upstash/redis` latest |
| Validation | Zod | ^3.25 |
| Styling | Tailwind CSS | ^3.4 |
| Article extraction | `@mozilla/readability` + `jsdom` | ^0.6 / ^26 |
| YouTube transcripts | `youtube-transcript` | ^1.3.0 |
| Bot protection | Cloudflare Turnstile | via env |
| Analytics | Vercel Analytics + Speed Insights | latest |

---

## 3. Environment Variables

See `.env.example` for the full list. Key variables:

```
NEXT_PUBLIC_SUPABASE_URL              Supabase project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  Supabase anon key (renamed from ANON_KEY)
SUPABASE_SERVICE_ROLE_KEY             Admin bypass key — server-only
GEMINI_API_KEY                        Google AI Studio key
GEMINI_MODEL                          Primary model (gemini-2.5-flash)
GEMINI_FALLBACK_MODELS                Comma-separated fallbacks (gemini-2.0-flash,...)
UPSTASH_REDIS_REST_URL / TOKEN        Redis for rate limiting + generation cache
CLOUDFLARE_ACCOUNT_ID / API_TOKEN     Cloudflare AI for image generation
DODO_PAYMENTS_*                       Payment keys, webhook secret, product IDs
NEXT_PUBLIC_TURNSTILE_SITE_KEY        Bot protection (public)
TURNSTILE_SECRET_KEY                  Bot protection (server)
```

> ⚠️ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is what most projects call `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Both `lib/supabase/client.ts` and `lib/supabase/server.ts` use this name.

---

## 4. Database Schema (Supabase / PostgreSQL)

All tables live in `public` schema. Schema file: `supabase/schema.sql`. Migration: `supabase/v2_upgrade.sql`.

### Tables

#### `profiles`
Created automatically on sign-up via `handle_new_user()` trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | FK → `auth.users.id` |
| `email` | text | Synced from auth |
| `full_name` | text | Optional |
| `role` | text | `'user'` or `'admin'` |
| `tier` | text | `'free'`, `'plus'`, `'pro'` |
| `monthly_generation_limit` | integer | Override for free tier (default 5) |
| `billing_status` | text | `'inactive'`, `'active'`, `'past_due'`, `'canceled'` |
| `billing_customer_id` | text | Dodo Payments customer ID |
| `billing_subscription_id` | text | Dodo subscription ID |
| `billing_current_period_end` | timestamptz | Billing period end |
| `is_blocked` | boolean | Manual block flag |
| `block_reason` | text | Admin-set reason |
| `blocked_until` | timestamptz | Null = permanent block |

#### `generations`
One row per successful content generation.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid | FK → `auth.users` |
| `input_mode` | text | `'link'`, `'text'`, `'youtube'` |
| `tone` | text | `'professional'`, `'casual'`, `'viral'`, `'authority'` |
| `length_preset` | text | `'short'`, `'medium'`, `'long'` |
| `source_url` | text | Original URL if applicable |
| `source_title` | text | |
| `source_text` | text | The full extracted/pasted text |
| `source_meta` | jsonb | `{ kind, platformPreferences, ... }` |
| `selected_platforms` | text[] | e.g. `['linkedin','x','newsletter']` |
| `outputs` | jsonb | `{ linkedin: "...", x: "...", ... }` |
| `linkedin_post` | text | Denormalized for quick reads |
| `twitter_thread` | text | Denormalized |
| `newsletter` | text | Denormalized |
| `model_name` | text | Which Gemini model was used (or `'cache'`) |

#### `image_generations`
One row per image generated.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid | |
| `prompt` | text | |
| `aspect_ratio` | text | `'1:1'`, `'3:4'`, `'4:3'`, `'9:16'`, `'16:9'` |
| `model_name` | text | Cloudflare model name |

#### `drafts`
One row per user — upserted on every autosave (5-second debounce). `user_id` is UNIQUE.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid (unique FK) | |
| `input_type` | text | `'link'`, `'text'`, `'youtube'` |
| `raw_content` | text | URL or pasted text |
| `settings_json` | jsonb | Mode, tone, length, platforms, platformPreferences, imageAspectRatio, etc. |

#### `content_extraction_cache`
Caches article/YouTube extraction results. Primary store is Upstash Redis; Supabase is the fallback.

| Column | Type | Notes |
|---|---|---|
| `cache_key` | text (PK) | `SHA256(kind:normalizedUrl)` |
| `source_kind` | text | `'article'` or `'youtube'` |
| `source_url` / `source_title` / `source_text` | text | |
| `source_meta` | jsonb | |
| `expires_at` | timestamptz | TTL = 30 days |

#### `generation_slots`
4 rows (slot-1 through slot-4). Controls concurrent generation limits. Redis is primary; DB is fallback.

#### `generation_rate_limits`
Per-user and per-IP generation rate limiting windows. Redis is primary; DB is fallback.

#### `auth_rate_limits`
Per-IP and per-email login rate limiting.

#### `app_settings`
Single-row table (id=1). Controls `maintenance_mode`, `maintenance_message`, `allow_admin`.

#### `user_logs`
Append-only activity log. Written by `lib/activity.ts → logActivity()`.

#### `billing_webhook_events`
Idempotency log for Dodo Payments webhook events.

### RLS Summary

All user-facing tables use `auth.uid() = user_id` policies (select/insert/update/delete own rows only). Admin actions bypass RLS via the **service role key** in `lib/supabase/admin.ts → createAdminClient()`.

Tables with no user-facing RLS (admin-only via service role): `app_settings`, `auth_rate_limits`, `generation_rate_limits`, `generation_slots`, `billing_webhook_events`, `content_extraction_cache`, `user_logs`.

---

## 5. Auth Flow

### Session Lifecycle
- Auth is handled entirely by **Supabase Auth** (email/password + Google OAuth).
- Server clients use `@supabase/ssr` with cookie-based sessions (`lib/supabase/server.ts`).
- Browser client uses `createBrowserClient` (`lib/supabase/client.ts`).

### Middleware (`middleware.ts` → `lib/supabase/middleware.ts`)
Every non-static request runs through `updateSession()` which:
1. **Refreshes the Supabase session** cookie.
2. **Reads JWT app_metadata** for `is_admin`, `is_blocked`, `blocked_until`, `role`.
3. Falls back to the `profiles` table if JWT metadata is missing (e.g. first login before a token refresh).
4. Enforces **maintenance mode** (redirects to `/maintenance`, admins may be allowed through based on `app_settings.allow_admin`).
5. Redirects **blocked users** to `/blocked`.
6. Redirects **unauthenticated users** away from protected routes.
7. Redirects **authenticated users** away from login/signup pages.

### Admin Detection
A user is admin if ANY of these is true:
- `JWT.app_metadata.is_admin === true`
- `JWT.app_metadata.role === 'admin'`
- `profiles.role === 'admin'`

### Block Detection (`lib/account-status.ts → isBlockActive()`)
- Checks `is_blocked === true` AND either `blocked_until` is null (permanent) OR `blocked_until` is in the future.

### ViewerContext (`lib/viewer.ts → getViewerContext()`)
Used in every server action and API route to get the full logged-in user state. Runs 4 parallel Supabase queries: profile, latest draft, generation count (this month), image count (this month). Returns a typed `ViewerContext` object with tier, limits, billing, draft, and block state.

---

## 6. Plan System (`lib/plans.ts`)

### Tiers
- `free` — 5 generations/month, 1 image/month, professional tone only
- `plus` — unlimited generations, 5 images/month, all tones
- `pro` — unlimited generations, unlimited images, all tones

### Tone Gating
`canUseTone(tier, tone)` — free tier can only use `'professional'`.

### Platforms
`CONTENT_PLATFORMS = ['linkedin', 'x', 'instagram', 'reddit', 'newsletter']`

### Per-platform Preferences
Each platform can have its own tone + length override. The UI lets users configure this per-platform in a grid. These are passed as `platformPreferences: Partial<Record<ContentPlatform, { tone, lengthPreset }>>`.

---

## 7. Generation Pipeline

### Input Modes
- **link** → `lib/extract-article.ts` → `@mozilla/readability` + `jsdom` → extracts title + body text
- **youtube** → `lib/youtube.ts` → `youtube-transcript` library → concatenated transcript + title
- **text** → pasted directly by user (minimum 50 words)

### Cache Layer (before Gemini)
`lib/content-cache.ts` wraps two caches:
1. **Extraction cache** — stores article/YouTube extraction results keyed by `SHA256(kind:url)`. Redis primary, Supabase fallback. TTL = 30 days.
2. **Platform generation cache** — stores per-platform Gemini outputs keyed by `SHA256({ sourceFingerprint, platform, tone, lengthPreset })`. Redis only. TTL = 30 days.

The source fingerprint is `SHA256({ kind, url, text })` — so same source + different platforms/tones = different cache keys.

### Rate Limiting + Slot System
Before Gemini is called:
1. `recordGenerationAttempt(userId, ip)` — sliding window rate limit (12 attempts/10 min per user, 30/10 min per IP). Redis primary, Supabase fallback.
2. `acquireGenerationSlot(ownerKey, userId)` — tries to claim one of 4 concurrency slots (Redis primary). Returns `{ skipped: true }` if slot system is unavailable (graceful degradation).

### Gemini Call (`lib/gemini.ts`)
- **Model selection**: `GEMINI_MODEL` env (default `gemini-2.5-flash`), with `GEMINI_FALLBACK_MODELS` for failover.
- **Source compression**: If source text > 18,000 chars or > 3,200 words, it is chunked → each chunk summarized → master summary merged. This reduces token usage for long articles.
- **Structured output**: Uses `responseMimeType: 'application/json'` + `responseJsonSchema` to enforce JSON shape.
- **Output shape**: `{ outputs: { [platform]: string }, imagePrompt: string }`
- **Retry logic**: On transient errors (429, 5xx), retries the same model with `retryMode: true` (lower temperature), then falls back to the next model in the list.

### SSE Streaming (`app/api/generate-content/route.ts`)
The generation API route streams progress as Server-Sent Events:

| Event | Payload | Meaning |
|---|---|---|
| `start` | `{ inputMode, tone, lengthPreset, sourceTitle, sourceUrl, selectedPlatforms }` | Generation has begun |
| `platform_start` | `{ platform }` | Starting a platform's output |
| `platform_chunk` | `{ platform, chunk }` | Streaming word chunks (10 words at a time, 8ms delay) |
| `platform_done` | `{ platform, text }` | Final authoritative text for that platform |
| `complete` | Full result + usage counters | All platforms done |
| `error` | `{ error }` | Something went wrong |

The client (`dashboard-generator.tsx`) reads this stream with a `ReadableStream` reader and updates React state in real time.

### Post-generation
After Gemini responds:
1. Cache results in Upstash Redis (`storePlatformGenerationCache`).
2. Insert a row into `generations` table via the user's Supabase client (subject to RLS).
3. `revalidatePath('/history')`, `revalidatePath('/dashboard')`, `revalidatePath('/profile')`.
4. Log activity via `logActivity()`.

---

## 8. Server Action vs API Route

There are **two generation paths**:

| Path | File | Used by |
|---|---|---|
| API route (primary) | `app/api/generate-content/route.ts` | `DashboardGenerator` component (fetch + SSE) |
| Server action (legacy) | `app/dashboard/actions.ts → generateContentAction` | Type export only in current UI |

The component (`app/dashboard/_components/dashboard-generator.tsx`) calls the API route directly via `fetch` for streaming. The server action is kept as a correct fallback and exports the `GenerationFormState` type used throughout the UI.

---

## 9. State Management

### Where State Lives

| State | Where | How |
|---|---|---|
| User session | Supabase cookie | Managed by `@supabase/ssr` + middleware |
| Draft (form inputs) | `drafts` table (DB) | Autosaved every 5 seconds via `POST /api/drafts` |
| Draft (in-memory) | React `useState` in `DashboardGenerator` | Hydrated on mount from `initialDraft` prop |
| Generation result | React `useState` in `DashboardGenerator` | Set from SSE stream events |
| Image output | React `useState` (`imageUrl`) | Stored as base64 data URL — **ephemeral, not persisted** |
| Image usage counters | React `useState` (`imageUsage`) | Updated from API responses |
| Generation history | `generations` table (DB) | Fetched server-side on `/history` page |
| Per-platform prefs | React `useState` (`platformPreferences`) | Saved into draft `settings_json` |

### Draft Autosave Flow
1. User edits any field in the generator.
2. `useEffect` debounces 5 seconds.
3. `POST /api/drafts` with `{ inputType, rawContent, settingsJson }`.
4. Supabase upserts the `drafts` table row (one row per user, unique on `user_id`).
5. On next page load, `getViewerContext()` fetches the latest draft and passes it as `initialDraft` prop.

---

## 10. Key File Map

```
app/
  layout.tsx                        Root layout (Analytics, SpeedInsights)
  page.tsx                          Landing page
  dashboard/
    page.tsx                        Server component — calls getViewerContext(), passes to DashboardGenerator
    actions.ts                      Server action + GenerationFormState type
    _components/
      dashboard-generator.tsx       Main UI client component — 1000+ lines, handles all state + SSE
      dashboard-content.tsx         Thin wrapper that loads the generator
      dashboard-skeleton.tsx        Loading skeleton
  history/
    page.tsx                        Lists user's past generations
    [id]/page.tsx                   Single generation view
  profile/page.tsx                  Billing, usage, account info
  admin/
    page.tsx                        Admin dashboard (user management, logs)
    actions.ts                      Admin server actions (block, upgrade, etc.)
  api/
    generate-content/route.ts       PRIMARY: SSE generation pipeline (POST)
    generate-image/route.ts         Cloudflare AI image generation (POST)
    drafts/route.ts                 Draft autosave (POST)
    checkout/route.ts               Dodo Payments checkout session
    customer-portal/route.ts        Dodo billing portal
    dodo/webhook/route.ts           Payment webhook handler (upgrades tier)
    auth/
      signup/route.ts               Custom signup with Turnstile + Brevo email
      login/route.ts                Login with rate limiting
  auth/actions.ts                   signOut server action

lib/
  viewer.ts                         getViewerContext() — central auth + usage context
  plans.ts                          Tier definitions, tone/platform/length metadata
  gemini.ts                         All Gemini logic: compress → prompt → parse → fallback
  content-cache.ts                  Extraction + generation cache (Redis primary, Supabase fallback)
  generation-control.ts             Rate limiting + generation slot management
  extract-article.ts                Article extraction via Readability + jsdom
  youtube.ts                        YouTube transcript extraction (via Supadata API + youtube-transcript)
  supabase/
    client.ts                       Browser Supabase client
    server.ts                       Server Supabase client (SSR + cookies)
    admin.ts                        Admin client (service role key, bypasses RLS)
    middleware.ts                   Session refresh + route guards
  dodo.ts                           Dodo Payments REST client
  admin.ts                          Admin helper functions
  security.ts                       Input validation, IP utilities
  activity.ts                       logActivity() — writes to user_logs
  account-status.ts                 isBlockActive() helper
  app-settings.ts                   getAppSettings() — reads maintenance mode
  upstash.ts                        getRedisClient() — singleton Redis client
  brevo.ts                          Transactional email (welcome, etc.)
  cloudflare-image.ts               Cloudflare AI image generation REST client
  utils.ts                          cn(), sanitizeSourceText(), countWords(), limitCharacters()

middleware.ts                       Next.js middleware — delegates to lib/supabase/middleware.ts

supabase/
  schema.sql                        Full DB schema + RLS policies + triggers
  v2_upgrade.sql                    Migration for v2 additions

components/
  sidebar.tsx                       Navigation sidebar
  checkout-button.tsx               Triggers checkout API
  export-button.tsx                 Download text as file
  copy-button.tsx                   Clipboard copy
  open-in-app-button.tsx            Deep-link to LinkedIn/X apps
  flash-banner.tsx                  Dismissible info banner
  plan-badge.tsx                    Tier badge display
  turnstile-widget.tsx              Cloudflare Turnstile bot protection
  site-header.tsx                   Top nav
  ui/                               Shadcn-style button, card, input, textarea
```

---

## 11. Bug Fixes Applied (v2 Refactor)

The following bugs were corrected during the refactor. Do NOT revert them:

| File | Bug | Fix |
|---|---|---|
| `lib/viewer.ts` | `latestDraftRow.input_type` (string) assigned directly to `ViewerDraft.inputType` ("link" \| "text" \| "youtube") — type mismatch | Added `normalizeInputType(value: unknown)` helper |
| `app/dashboard/actions.ts` | `textSchema` used `value.length >= 400` (character count) as minimum — should be word count | Changed to `countWords(value) >= 50` |
| `app/dashboard/actions.ts` | `generateRepurposedContent` called without `platformPreferences` — per-platform settings were ignored | Now builds `platformPreferences` from form fields and passes it; also returned in success state |
| `app/api/generate-content/route.ts` | `let slotLease` declared without initializer — potential use-before-assignment TS error in strict mode | Initialized to `null` |
| `lib/gemini.ts` | `extractResponseText` handled `text` as `string \| (() => string)` — the `@google/genai` v1 SDK always returns a `string`; the function-call branch was dead code causing type confusion | Simplified to handle `string` directly, with clean candidate fallback |
| `lib/content-cache.ts` | `isMissingTableError` used `PGRST202` (not a real PostgREST error code) | Changed to `PGRST116` |
| `lib/generation-control.ts` | Same `PGRST202` incorrect code | Changed to `PGRST116` |

---

## 12. Key Conventions

- **No Prisma / ORMs** — raw Supabase client queries everywhere.
- **Server actions** are `"use server"` files that use `getViewerContext()` for auth — never trust client-provided user IDs.
- **API routes** are `app/api/.../route.ts` files — same auth via `getViewerContext()`.
- **Admin actions** use `createAdminClient()` (service role) — never exposed to the browser.
- **Zod** validates all external inputs (form data, API request bodies, Gemini JSON responses).
- **Upstash Redis** is always attempted first for cache/rate limiting; Supabase is a silent fallback when Redis is unavailable. The app degrades gracefully if neither Redis nor cache tables exist.
- **All monetary / billing operations** go through Dodo Payments webhook (`app/api/dodo/webhook/route.ts`) — never trust client-side payment confirmation.
- **Image generation results are ephemeral** — stored as base64 in React state only; not persisted to DB. Users must download before navigating away.
