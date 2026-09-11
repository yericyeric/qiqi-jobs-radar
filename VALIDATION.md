# Live release validation — 2026-09-11

The live Pages implementation passes lint, TypeScript and 41 tests across seven files. The optimized static export passes with `/qiqi-jobs-radar` as base path and omits API routes. Tests cover source-failure retention, genuine closure vs changed filters, stable publication dates, Charleston geography, unknown dates, legacy profile migration, local action preservation and stale verification, alongside the existing scoring/auth/database cases.

The collector was executed against all seven configured public employer boards without credentials. Its first successful snapshot contained four relevant local postings, all in Miami; one source posting date was within 48 hours. These are source/title-filter results, not a claim that all four meet the default fit threshold or that Charleston has no jobs. Source timestamps and results change over time. The normalized JSON was validated using the same schema consumed by the app.

Public APIs were read; no job applications, contacts or emails were sent. The GitHub repository is public, but the available browser is signed out. Changes have not been pushed and the new workflow has not been executed on GitHub. Activation instructions and exact workflow text are included. No browser click/screenshot QA is claimed.

Existing PostgreSQL integration tests execute the migration and transactions against PGlite using the PostgreSQL wire protocol. No live database or paid hosting account is required by the new Pages mode. Earlier database edition verification is described in ARCHITECTURE.md.
