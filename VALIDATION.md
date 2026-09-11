# Delivery validation

Location update (2026-09-11): 34 tests pass, including Charleston import/scoring, region isolation, legacy profile upgrade, preserved application history, freshness-first ordering and manufacturing rejection. No PostgreSQL schema migration is needed: county columns are text and candidate preferences are JSON. Existing schema and repository integration tests remain passing.

Validated locally on Windows with Node 24.19, Next.js 16.3.4, Prisma 6.19.3 and the included pnpm lockfile.

- ESLint: passes with zero warnings (`--max-warnings=0`).
- TypeScript: passes with `tsc --noEmit`.
- Vitest: 29 tests pass across five files.
- PostgreSQL: migration creates 17 tables in PGlite 0.5.8; valid affiliation accepted, unsupported affiliation and score outside 0–100 rejected.
- Prisma integration: genuine PostgreSQL wire connection to isolated PGlite socket server. Imports, candidate children, application history, canonical source merging, score records and transaction rollback checked through Prisma.
- API: unauthenticated access rejected; cross-origin writes rejected; owner login issues secure HttpOnly cookie; invalid imports rejected; logout clears cookie.
- Full Next.js server build: passes, including dynamic API route.
- GitHub Pages static-export build: passes; API route excluded.
- Local static preview: HTTP 200, opened in Codex. No browser click/screenshot testing was requested or performed.

No hosted database account, live ATS connection, external email service, scheduled search or GitHub publication was configured. GitHub workflow and Docker files are supplied but have not been run on those external services. Tests use isolated fictional fixtures; they do not claim that real employers are hiring.

The Windows runtime restricts child-process spawning. Validation uses supported in-process TypeScript loading, thread workers and webpack compilation; no type checks were disabled. The Prisma migration was created from the schema and executed through PostgreSQL/PGlite; the local Prisma CLI migration-diff subprocess could not run. CI also runs Prisma migrate deploy and seed against a PostgreSQL 16 service.
