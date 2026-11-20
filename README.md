# Opscore frontend

Enterprise deduplication dashboard — Next.js 16 (App Router) + TypeScript +
Tailwind CSS v4 + TanStack React Query. Talks to the FastAPI backend only
through a same-origin BFF (`src/app/api/*`): access/refresh JWTs live in
httpOnly `SameSite=Lax` cookies and never reach browser JavaScript.

## Setup

```bash
npm install              # add --legacy-peer-deps if npm errors on peer chains
npm run dev              # http://localhost:3000
```

Requires the backend on `http://localhost:8000` (see `backend/README.md`:
docker compose, `alembic upgrade head`, `python -m scripts.seed`, uvicorn,
celery worker). Override with `OPSCORE_API_URL` / `OPSCORE_SECURE_COOKIES`
(see `.env.example`).

Seed logins: `admin@opscore.dev / admin123` (super_admin),
`reviewer@opscore.dev / reviewer123` (reviewer).

## Verify

```bash
npm run typecheck        # tsc --noEmit
npm run build            # production build
npm test                 # Vitest unit tests (src/**/*.test.*)
npm run test:e2e         # Playwright vs the running stack (seed first)
```

## Architecture

- `src/app/(auth)/login` — public sign-in; `(platform)/*` — guarded app.
- `src/proxy.ts` — route guard (Next 16's renamed middleware).
- `src/app/api/backend/[...path]` — streaming proxy to `/api/v1/*`: injects
  the Bearer token from the cookie, dedupes refresh rotation, enforces a
  CSRF header, and clears cookies on 401.
- `src/features/*` — one folder per screen; `src/components/*` — shared UI.
- All large lists use server-side cursor (`keyset`) pagination — nothing is
  bulk-loaded into the browser.
- Role permissions + dataset ACL drive navigation and controls; the backend
  remains authoritative.
