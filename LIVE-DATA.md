# Broad job discovery on GitHub Pages

## Current scope

The default is 30/100 possible fit, with a mandatory career-relevance gate. Generic coordination alone cannot qualify an unrelated job. The gate runs in both collection and the browser; existing cached data is rescored. Explicit manufacturing/software/insurance roles and disguised commission-only sales are rejected. Unknown requirements remain unresolved. The recent filter remains 48 hours with the past 24 hours first.

Sources include Remotive (six-hour cadence, its public data has a 24-hour delay), Jobicy (six hours, up to 200 listings), Himalayas (daily, up to 1,000 recent listings), plus the existing Greenhouse/Lever/SmartRecruiters employer watchlist. Public portal listings are filtered for explicit US/worldwide remote eligibility and career relevance. They are not a complete index of every job. The local Google Jobs search is activated by the GitHub secret SERPAPI_API_KEY.

Google Jobs runs one rotating query every eight hours for each city, using the job description for the same scoring pipeline. General Google web discovery runs every 48 hours, alternating cities; relevant snippets become clearly separated unverified leads. No arbitrary external job page is fetched and no general search snippet is presented as a confirmed vacancy. Search results can include listings from other boards; no direct scraping of LinkedIn or Indeed is implemented.

## Budget and scheduling

The GitHub workflow runs every 15 minutes; individual sources respect their own intervals. Persisted nextCheckAt timestamps prevent repeated queries, including on most failures. Source errors retain previous records and are displayed. The SerpApi integration shares a maximum of 210 attempted requests in a persisted 31-day window; it pauses at that limit. This is below the documented Free plan's 250 monthly searches. Quotas also depend on other uses of the same key and the provider's billing cycle; use a Free account, without paid renewal. This code never purchases credits. A killed process before persistence may lose its last request count; the provider's free-plan limit remains authoritative.

The public feed and schedule state live on radar-data; only static code is on main. The workflow token writes public job facts, never browser notes/profile/history. Keys are supplied only to the collector and are never included in source URLs, logs or the public bundle. GitHub's raw-content response is used when a feed is too large for base64 contents responses. Standard public runners avoid a paid server. GitHub may delay, drop or disable scheduled runs; the UI reports scan and per-source times.

## Provenance and retention

Greenhouse uses first_published, SmartRecruiters releasedDate, and Lever dates remain unknown when absent. Board publication dates are attributed to the board. Remotive's timezone-less publication strings are interpreted as UTC and that assumption is recorded. Relative Google dates are estimates, using the older end of the rounded interval. Discovery time never becomes an original publication date. Stable IDs retain earlier dates across runs. Canonical duplicates share source attribution; employer-created new IDs can evade repost detection.

ATS and board records are LIKELY_ACTIVE based on returned records and links, never proof the employer's external application form works. Checks expire to UNKNOWN after 24 hours. A missing result in a partial or rotating broad search never marks a job closed. Broad records age out after 30 days without being seen. Complete successful ATS scans can mark absent jobs closed; changes outside filters alone do not prove closure. Local trackers retain removed records. Source attribution and backlinks are shown on cards and details.

## Verification and deployment

Run pnpm collect:jobs, pnpm lint, pnpm typecheck, pnpm test and pnpm build:live. build:pages remains an optional fictional demo; build remains the database edition. Google adapters are tested with mocked provider responses until the user supplies a real key through GitHub. Local success does not activate the workflow remotely; see LEEME.md for upload and activation steps.

References: [SerpApi Google Jobs](https://serpapi.com/google-jobs-api), [SerpApi free quota](https://serpapi.com/pricing), [Remotive API](https://github.com/remotive-com/remote-jobs-api), [Jobicy API](https://jobicy.com/jobs-rss-feed), [Himalayas API](https://himalayas.app/api), [GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
