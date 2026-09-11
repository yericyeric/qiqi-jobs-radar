# Real jobs on GitHub Pages

The live workflow must be uploaded and complete successfully before the public site changes. Local validation is not proof of deployment. See LEEME.md for activation.

## How it works

GitHub Actions checks seven configured employer boards every 15 minutes, at minutes 7, 22, 37 and 52 UTC. Runs may be delayed or dropped. The collector publishes validated job facts in `public/data/jobs.json`, retaining the previous snapshot in the `radar-data` branch with the automatic workflow token. No paid server, database, ATS account or manually created API key is required.

Pages serves the app and JSON. The open app downloads the latest snapshot every minute; this does not initiate another employer search. Profile edits, notes, saves and applications stay in this browser. Existing real imports and profile edits migrate from the demo store; fictional jobs and their actions remain only in the old demo store. Export backups before clearing browser data. Devices do not synchronize.

The compiled frontend is cached by source commit. Scheduled runs reuse it. `main` contains source code; `radar-data` holds public feed history. Do not merge the data branch into main. Standard GitHub-hosted runners are free in public repositories. GitHub can disable schedules after 60 days without repository activity; check Actions and re-enable the workflow if necessary.

## Coverage and evidence

Configured employers: Fever, Comfrt, CAMP, Guardz, Feld Entertainment, NBCUniversal and Auberge Collection, including The Dunlin in Johns Island near Charleston. Add verified boards in `scripts/sources.json`. This is a limited employer watchlist, not all internet jobs, LinkedIn or Indeed. Remote-only jobs are not collected in this release; imported remote records still work.

The collector filters local locations and role titles, then the browser scorer evaluates responsibilities against Qiqi's profile. Charleston requires SC/South Carolina evidence and excludes WV. The default radar shows postings within 48 hours and fit 70+, prioritizing the past 24 hours. Broaden filters for older postings. No result means no available record passes the filters, not that the city has no jobs. Employer qualifications remain UNKNOWN and need review before applying.

Greenhouse uses `first_published`, never `updated_at`. SmartRecruiters uses `releasedDate`. Lever does not consistently supply a documented publication date, so it stays unknown and cannot pass the recent filter. Each stable posting ID retains its earliest observed publication date across runs. A changed employer job ID can evade repost detection and needs review.

ATS records are LIKELY_ACTIVE: the public API returned a posting and application link, but the external application form was not tested or submitted. No restricted-page scraping, login bypass or automatic applications occur. Missing employment types are Unknown. Salary/contact/affiliation facts are not fabricated.

Complete pagination is required for source success. Source failures preserve previous jobs and verification times. Records absent from a complete successful source scan are marked closed and retained publicly for 30 days; local trackers keep them afterward. Verification older than 24 hours becomes UNKNOWN. The banner warns after 45 minutes without a scan, with separate per-source errors. Repeated failures need review in Actions.

## Commands and remaining scope

`pnpm collect:jobs` refreshes the public snapshot. `pnpm build:live` exports the live app. `pnpm build:pages` retains the fictional demo. `pnpm build` builds the separate database edition, which still uses manual imports. Email/SMS, automatic applications and general web discovery are not implemented.

## References

- [GitHub runner billing](https://docs.github.com/en/actions/concepts/billing-and-usage)
- [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [Greenhouse API](https://docs.greenhouse.io/job-board.html)
- [Lever API](https://github.com/lever/postings-api)
- [SmartRecruiters endpoints](https://developers.smartrecruiters.com/docs/endpoints)
