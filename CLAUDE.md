# Core-Dashboard (portal.corecleaning.services)

Ops hub for Core Cleaning. Next.js 14 App Router + TypeScript + Tailwind + Supabase (auth, Postgres, storage). Deploys automatically on every push to `master` — always commit AND push when a change is done.

## Commands
- `npm run dev` — local dev server
- `npx tsc --noEmit` — type-check (run before committing)

## Layout (all app code under `src/`)
- `src/app/(app)` — admin/staff portal pages
- `src/app/(manager)`, `(cleaner)`, `(client)` — role-specific portals, each with a matching `(*-auth)` login group
- `src/app/api/` — route handlers. Claude API calls live ONLY in `parse-agreement/` and `upload-invoice/` (Haiku 4.5, structured outputs)
- `src/app/onboard`, `sign`, `survey`, `compliance`, `print` — public/standalone flows
- `src/components/<domain>/` — components grouped by domain (clients, leads, financial, inspections, portal, ui, ...)
- `src/lib/supabase/` — Supabase clients; `src/lib/validations/` — zod schemas; `src/lib/emails/`, `documents/`, `inspections/` — domain helpers
- `scripts/gen-splash.mjs`, `gen-logos.mjs` — one-time PWA asset generation (no AI calls); `public/manifest.json` — PWA config

## Conventions
- Model for extraction routes is `claude-haiku-4-5` — do not upgrade it (cost); JSON is enforced via `output_config.format` schemas
- Prompt caching is intentionally NOT used in the extraction routes (prompts are below Haiku's 4096-token cacheable minimum) — don't add it
- Australian formats throughout: GST 10%, `YYYY-MM-DD` dates, state abbreviations (QLD, NSW, ...), 4-digit postcodes

## Search hygiene
- Never search or read under `.next/`, `node_modules/`, `public/splash*` — scope searches to `src/`
