# Qiqi Job Radar — Phase 1

## Scope and deployment

The repository was empty. Phase 1 is a single-candidate application: manual job and organization import, editable profile, deterministic scoring, filters, source details and application history. No automated search or email is claimed. Next.js Pages Router serves the interface and an authenticated API; PostgreSQL/Prisma persist server data. A static-export build omits API routes and runs an explicitly labeled fictional, device-local demo on GitHub Pages. The full build runs on any Node host with PostgreSQL. Secrets and personal records never belong in a public repository.

## Implementation plan

1. Define typed input contracts, SQL schema, scoring, freshness, status and canonicalization.
2. Build dashboard, filters, detail panel, profile, manual imports, organizations and tracker.
3. Connect authenticated transactional API with PostgreSQL and idempotent seed.
4. Validate domain cases, schema constraints, lint, types and both deployment builds.
5. Deliver source, migration, sample imports and deployment workflows. Actual account provisioning is a separate deployment step.

## Data model

Candidate -> skills / experience / education. Organization -> contacts / affiliations / sources / jobs. Job -> sources / requirements / scores / verifications. Candidate + job -> immutable user actions, one application and alerts. SearchRun stores import counts and rejection diagnostics. Important source-derived values live with structured provenance on the source rows. JobScore snapshots retain component points and reasons. Learned preferences are separate from profile facts and bounded to +/- 3 points.

## Scoring

35 career relevance + 25 responsibility overlap + 15 level + 10 freshness + 5 organization relevance + 5 actionability + 5 local/small. Responsibilities determine relevance; titles provide a smaller fallback. Manufacturing and disguised sales are excluded unless manufacturing duties explicitly describe media/event work. Senior roles lose career-level points. Unknown candidate requirements remain unresolved (STRETCH), never invented eligibility. NOT_ELIGIBLE requires a user-recorded contradiction of a hard requirement. Freshness uses the highest-trust dated original source, not ingestion time. Unknown dates earn no freshness points. 48–72 hours belong to the 3–7 day display bucket to avoid a gap.

## Source adapter boundary

SourceAdapter has id, cadence, discover(context) and verify(job). Outputs conform to JobInput with source provenance. ManualImportAdapter is the working Phase 1 adapter. Future Greenhouse/Lever adapters must respect published access rules, caching, backoff, timeouts and source limits. No arbitrary server URL fetching is exposed by manual import. NLP has a classification-only interface and cannot create factual fields.

## Verification

HTTP 404/410 or explicit closure -> CLOSED. Expiry evidence -> EXPIRED. ACTIVE requires an employer/ATS source, reachable application page, job ID, application control and employer listing, with an evidence timestamp. Partial reachability -> LIKELY_ACTIVE; missing/ambiguous evidence -> UNKNOWN. Evidence is operator-provided in Phase 1, visibly identified as such, not an automated browser check. Alerts additionally require verification in the last 24h. All date math accepts an explicit clock for tests.

## Deduplication

Within an organization: exact canonical URL or source/job-ID identity; otherwise normalized title + location + description token Jaccard >= 0.8. One canonical record retains all source rows and earliest credible original date. Later dated near-identical sources mark reposts. Dismissals remain until description similarity falls below 0.8; scores or aggregator dates alone never reset dismissal. Serialized PostgreSQL imports avoid concurrent duplicate insertion.

## Security and later phases

Single-owner access-key login creates an HMAC-signed expiring HttpOnly SameSite=Strict cookie. Mutations require an exact configured Origin, size/schema validation and server recomputation. HTTPS enables Secure cookies. Access keys use timing-safe comparison. Rate limiting is per process for the MVP; use shared edge limits for multiple replicas. No scraper, scheduler or message delivery runs in Phase 1. Phase 2 adds two permitted ATS integrations and workers; Phase 3 discovery and documented affiliations; Phase 4 alert delivery. Private database backups and deployment credentials are operator responsibilities.
