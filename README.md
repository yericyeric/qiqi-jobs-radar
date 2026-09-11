# Qiqi Job Radar

## Live GitHub Pages release — September 2026

The Pages workflow combines multi-employer job boards, optional Google Jobs/web discovery through SerpApi, and direct employer feeds. The collector runs every 15 minutes with independent per-source intervals. The default fit threshold is 30/100 with mandatory career relevance. It publishes real job facts while keeping private notes and actions in browser storage. GitHub may delay scheduled runs. Read **LIVE-DATA.md** for the current design and **LEEME.md** to activate it. No paid server is required; Google searches need a free SerpApi key. The historical Phase 1 details below describe the database edition and optional fictional demo.

## Miami ↔ Charleston

The location switch selects **Miami / South Florida** or **Charleston, South Carolina** for the radar, saved feed and organization directory. Each switch resets the feed to the past 48 hours, 30+ possible fit and freshness-first ranking: the past 24 hours first, then 24–48 hours, with better fit first within each group. Broader date/fit filters remain available for deliberate review. Matching remote roles may appear in either market. Applications remain together so location changes never hide application history.

Charleston imports use `organization.county: "Charleston"` and a location such as `Charleston, SC`. Existing profiles gain Charleston once without changing resume facts or deleting records. The profile screen can disable it afterward. Existing demo workspaces receive two clearly fictional Charleston examples without rewriting old posting dates. No automated search is enabled by this location update.

A personal job-discovery workspace for Qiqi Su, focused on live entertainment, events, production and media in Miami-Dade and Broward.

## What is implemented

Phase 1: responsive radar, score explanations, filters, candidate editing and rescoring, validated JSON job/organization imports, canonical duplicate merging, source and manual-verification details, save/dismiss/applied actions, immutable action history, application tracking, organization directory, outreach prospects and import diagnostics. The full app persists to PostgreSQL via Prisma and requires a private owner access key. Sample job records are fictional and cannot be mistaken for live search results in the UI.

The live Pages edition adds scheduled ATS discovery. The database edition continues to use manual imports. General web discovery, AI services, email and SMS delivery are not implemented.

## Deployment modes

| Mode             | Where                                                           | Data                         | Capabilities                                                                         |
| ---------------- | --------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| Demo             | GitHub Pages / any static host                                  | This browser's local storage | Fictional examples and interactive local workflows; no server or alerts              |
| Live Pages | GitHub Pages + GitHub Actions | Public job feed; private browser storage | Real listings and local tracker; no device synchronization |
| Private full app | Node host (Vercel, Render, Railway or your server) + PostgreSQL | Private PostgreSQL           | Authenticated imports, profile, jobs, organizations, action history and applications |

GitHub Pages cannot run the database or API. Keep credentials and private candidate/application information out of the repository. A purchased domain and external hosting/database services are separate from Pages.

## Run the private app

Requires Node 22+, pnpm 11.19 and PostgreSQL 16+. The lockfile pins the validated dependency set.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d postgres
```

Edit `.env`. Set `DATABASE_URL`, `APP_ORIGIN` to the exact website origin (no trailing slash), and independently generate `RADAR_ACCESS_KEY` and `SESSION_SECRET` using:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep both generated values server-side. On Windows use `Copy-Item .env.example .env` instead of `cp` if needed. Then:

```sh
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open the local address printed by Next.js and sign in with `RADAR_ACCESS_KEY`. The seed is idempotent: it preserves existing profile edits and inserts no fictional job records into the live database. If a secret or database is missing, the app fails closed with setup guidance.

## Publish live jobs on GitHub Pages

1. Create a GitHub repository and upload this folder's contents, including `.github/`. Do not upload `node_modules`, `.next`, `.env`, exported backups or private application data.
2. In repository Settings → Pages, select **GitHub Actions** as the source.
3. In Actions, run **Publish Qiqi live jobs**, or push the updated code to main. The schedule activates when the workflow is on the default branch.
4. Open the URL provided by the successful deployment. The workflow handles repository subpaths and user sites.

To build the live static app yourself:

```sh
pnpm collect:jobs
pnpm build:live
```

Upload `out/` to a static host. Set `NEXT_PUBLIC_BASE_PATH=/your-repository` before building for a repository subpath. The live script sets `RADAR_DEMO=true` to exclude API routes and `NEXT_PUBLIC_LIVE=true` for real feeds with local storage. `pnpm build:pages` still builds an optional fictional demo. Do not set static-mode flags for the database edition.

## Deploy the private app

Use the source repository on a Node-compatible host. Install dependencies, run `pnpm db:generate`, and build with `pnpm build`. Set the four server environment variables on that host; never in public workflow output. Connect a PostgreSQL instance, run `pnpm db:migrate` and `pnpm db:seed` from a trusted release environment before serving traffic. Start with `pnpm start`, or use the supplied Dockerfile (standalone server). Use HTTPS and set `APP_ORIGIN` accordingly so cookies are Secure. Vercel can deploy this Next.js repository directly; override the build command to include client generation if necessary.

Database schema/seed tools are intentionally outside the final minimal Docker runtime: run them as a release step from the build/source environment. Back up the database before production migrations. The Docker Compose database is for local development only.

## Importing jobs and organizations

Open **Import jobs**, upload a JSON array or paste JSON. Full records are documented in `lib/contracts.ts`, with complete examples in `samples/`. Sample files are demo-only; replace example organizations/URLs and remove `isDemo` flags only after entering real, sourced facts. Never remove a demo flag just to load fictional examples into the private database.

- Every job needs title, description, organization, location, category, work type and at least one source record.
- A missing date is unknown, not today's date. Prefer an employer or ATS original date. Aggregator estimates remain estimates.
- `verification` can be null. If provided, it is **manual evidence**. ACTIVE requires a reachable original application page, matching job ID, apply control, employer listing and check within 24h.
- Salary, public contacts, known organization size and explicit cultural affiliation need source URLs. No affiliation is derived from surnames.
- Duplicates become a canonical record retaining all source records. Reposts retain the earlier credible original date.
- Imports accept at most 100 jobs / 1 MB and run transactionally. Low-fit records stay available in diagnostics; set fit to 0 and any posting date to inspect them in the feed. Closed records remain in application history and cannot alert.
- Unknown requirements remain STRETCH. Record IMPOSSIBLE only for a hard requirement explicitly contradicted by candidate facts.

Organizations can be added separately without a vacancy. Hidden Market keeps prospects apart from advertised openings. Check the employer before outreach; no outreach message is sent by the app.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:pages
```

Domain tests cover the requested scoring, date, closed-job, duplicate and affiliation cases. Schema tests execute the migration in PGlite (embedded PostgreSQL) and inspect constraints. CI also provisions PostgreSQL 16 and applies/seed-checks migrations before builds. Native browser automation was not requested; no automated click/screenshot test is claimed.

Windows restricted-process environments use in-process TypeScript transforms and worker threads for validation. The normal commands still run the same tests, type check and optimized Next.js builds.

## Security and limits

One candidate / one owner. HMAC-signed 12-hour HttpOnly SameSite=Strict sessions, constant-time key comparison, exact Origin checks on writes, JSON validation and server-side scores. API responses use no-store. Login throttling is in-memory per process; put shared rate limiting at the edge before running multiple replicas. Imports do not fetch arbitrary URLs, so there is no server URL-fetch endpoint to abuse. Source claims are user-provided and should be checked; this phase does not certify live vacancies automatically.

Phase 1 loads the private workspace into memory and serializes mutations with a PostgreSQL advisory lock. This is intentional for one candidate; add pagination and narrower queries if the dataset grows beyond a few thousand records. Learned preferences adjust ranking by at most 3 points and do not modify candidate facts.

See `ARCHITECTURE.md` for the data model and the later adapter, verification and deduplication plan. `VALIDATION.md` records the checks actually performed for this delivery.

References: [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying), [static exports](https://nextjs.org/docs/pages/guides/static-exports), [Prisma 6 migrations](https://docs.prisma.io/docs/orm/v6/prisma-migrate/getting-started).
