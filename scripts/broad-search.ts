import { createHash } from "node:crypto";
import {
  jobInputSchema,
  organizationSchema,
  type JobInput,
  type Organization,
} from "../lib/contracts";
import type { LiveFeed } from "../lib/live";
import { careerRelated } from "../lib/career";
import { scoreJob, canonicalUrl, duplicate } from "../lib/engine";
import { sampleProfile } from "../lib/sample";

type Raw = Record<string, unknown>;
const obj = (x: unknown): Raw =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Raw) : {};
const str = (x: unknown) => (typeof x === "string" ? x : "");
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
type Helpers = {
  plain: (x: unknown) => string;
  countyFor: (s: string) => Organization["county"] | null;
  dateValue: (v: unknown, now: number) => string | null;
  categoryFor: (title: string) => JobInput["category"];
  get: (url: string) => Promise<unknown>;
};
type FeedRecord = LiveFeed["jobs"][number];
type Status = LiveFeed["sources"][number];
const HOUR = 3600000;
const WINDOW = 31 * 24 * HOUR;
export const SEARCH_LIMIT = 210;
export function budget(
  previous: LiveFeed["searchState"],
  now: number,
): NonNullable<LiveFeed["searchState"]> {
  return !previous || now - Date.parse(previous.windowStartedAt) >= WINDOW
    ? {
        windowStartedAt: new Date(now).toISOString(),
        used: 0,
        queryIndex: previous?.queryIndex || 0,
      }
    : { ...previous };
}
export function remoteEligible(location: string): boolean {
  return (
    /^(?:worldwide|anywhere|global)$/i.test(location.trim()) ||
    /\b(?:united states|USA|US)\b/i.test(location)
  );
}
export function estimatedDate(text: string, now: number): string | null {
  const m = text.match(/^(\d+)\s+(minute|hour|day|week)s?\s+ago$/i);
  if (!m) return null;
  // Use the older end of a rounded interval to avoid overstating freshness.
  const unit = { minute: 60000, hour: HOUR, day: 24 * HOUR, week: 168 * HOUR }[
    m[2].toLowerCase()
  ]!;
  return new Date(now - (Number(m[1]) + 1) * unit).toISOString();
}
function hashed(s: string) {
  return createHash("sha256").update(s).digest("hex").slice(0, 28);
}
function employment(s: string): JobInput["employmentType"] {
  const value = s.toLowerCase().replace(/[_ -]/g, "");
  return (
    (
      {
        fulltime: "Full-time",
        parttime: "Part-time",
        contract: "Contract",
        contractor: "Contract",
        freelance: "Contract",
        internship: "Internship",
        intern: "Internship",
        temporary: "Temporary",
        seasonal: "Seasonal",
      } as const
    )[value as "fulltime"] || "Unknown"
  );
}
export function keepBroadRecords(
  prior: FeedRecord[],
  incoming: FeedRecord[],
  now: number,
): FeedRecord[] {
  const records = new Map(prior.map((j) => [j.id, j]));
  for (let record of incoming) {
    const old = records.get(record.id);
    if (old) {
      record = structuredClone(record);
      record.discoveredAt = old.discoveredAt;
      for (const source of record.input.sources) {
        const before = old.input.sources.find((s) => s.name === source.name);
        for (const key of ["originalPostedAt", "estimatedPostedAt"] as const) {
          const date = before?.[key];
          if (
            date &&
            (!source[key] || Date.parse(date) < Date.parse(source[key]!))
          )
            source[key] = date;
        }
      }
    }
    records.set(record.id, record);
  }
  // Search result absence never proves closure; let verification age naturally.
  return [...records.values()].filter(
    (j) =>
      now -
        Date.parse(
          j.input.verification?.checkedAt || j.input.sources[0].capturedAt,
        ) <
      30 * 24 * HOUR,
  );
}
export function deduplicateFeed(records: FeedRecord[]): FeedRecord[] {
  const result: FeedRecord[] = [];
  for (const record of records) {
    const existing = result.find((r) => duplicate(r.input, record.input));
    if (!existing) result.push(record);
    else {
      const signatures = new Set(
        existing.input.sources.map((s) => `${s.name}:${s.externalId}`),
      );
      existing.input.sources.push(
        ...record.input.sources.filter(
          (s) => !signatures.has(`${s.name}:${s.externalId}`),
        ),
      );
      existing.input.sources = existing.input.sources.slice(0, 20);
    }
  }
  return result;
}
function makeRecord(
  source: { id: string; name: string; url: string },
  raw: {
    id: string;
    title: string;
    description: string;
    company: string;
    url: string;
    location: string;
    posted?: string | null;
    estimated?: string | null;
    dateText?: string;
    remote?: boolean;
    employment?: string;
    expiry?: string | null;
  },
  helpers: Helpers,
  now: number,
): FeedRecord | null {
  const title = helpers.plain(raw.title),
    description = helpers.plain(raw.description);
  if (!careerRelated({ title, description }, sampleProfile)) return null;
  const county = raw.remote
    ? remoteEligible(raw.location)
      ? "Remote"
      : null
    : helpers.countyFor(raw.location);
  if (
    !county ||
    description.length < 30 ||
    !raw.company ||
    !/^https:\/\//i.test(raw.url)
  )
    return null;
  const time = new Date(now).toISOString();
  const parsed = jobInputSchema.safeParse({
    title: title.slice(0, 180),
    description: description.slice(0, 50000),
    location: raw.remote
      ? `Remote · ${raw.location}`.slice(0, 180)
      : raw.location.slice(0, 180),
    category: helpers.categoryFor(title),
    employmentType: employment(raw.employment || ""),
    applyUrl: raw.url,
    organization: organizationSchema.parse({
      id: `board-company:${hashed(raw.company + county)}`,
      name: raw.company.slice(0, 150),
      website: raw.url,
      careersUrl: raw.url,
      type: "Employer from job listing",
      city: raw.remote ? "Remote" : raw.location.slice(0, 100),
      county,
      notes:
        "Company website not supplied. Links open the source listing; confirm all requirements with the employer.",
    }),
    sources: [
      {
        name: source.name,
        url: raw.url,
        kind: source.id.startsWith("google") ? "AGGREGATOR" : "BOARD",
        externalId: hashed(raw.id),
        capturedAt: time,
        originalPostedAt: raw.posted || null,
        estimatedPostedAt: raw.estimated || null,
        sourcePostedText: raw.dateText || "Source publication date",
        evidence: `Found through ${source.name}. This is a third-party listing, not confirmation by the employer.`,
      },
    ],
    requirements: [
      {
        text: "Full eligibility, experience, language, location restrictions and work authorization need review against Qiqi's profile.",
        required: true,
        assessment: "UNKNOWN",
        sourceUrl: raw.url,
      },
    ],
    verification: {
      checkedAt: time,
      sourceUrl: raw.url,
      sourceKind: "OTHER",
      pageLoads: true,
      jobIdExists: true,
      listedByEmployer: false,
      applyExists: true,
      httpStatus: 200,
      method: "AUTOMATED_BOARD",
      expired: !!raw.expiry && Date.parse(raw.expiry) <= now,
      notes:
        "The job board returned this listing. The employer and application form have not been checked. Review before applying.",
    },
  });
  if (
    !parsed.success ||
    scoreJob(parsed.data, sampleProfile, now).total < 15 ||
    scoreJob(parsed.data, sampleProfile, now).rejection
  )
    return null;
  return {
    id: `web:${source.id}:${hashed(raw.id)}`,
    board: source.id,
    discoveredAt: time,
    input: parsed.data,
  };
}
export async function broadSearch(
  previous: LiveFeed | null,
  now: number,
  helpers: Helpers,
  env: Record<string, string | undefined> = process.env,
) {
  const jobs: FeedRecord[] = [],
    sources: Status[] = [];
  const state = budget(previous?.searchState || null, now);
  let leads = (previous?.leads || []).filter(
    (l) => now - Date.parse(l.foundAt) < 14 * 24 * HOUR,
  );
  async function run(
    id: string,
    name: string,
    url: string,
    hours: number,
    note: string,
    search: () => Promise<{ records: FeedRecord[]; examined: number }>,
    keyRequired = false,
  ) {
    const priorStatus = previous?.sources.find((s) => s.id === id);
    const priorJobs = previous?.jobs.filter((j) => j.board === id) || [];
    const base: Status = {
      id,
      name,
      url,
      ok: false,
      count: priorJobs.length,
      error: "",
      lastSuccessfulAt: priorStatus?.lastSuccessfulAt || null,
      checkedAt: priorStatus?.checkedAt || null,
      nextCheckAt: priorStatus?.nextCheckAt || null,
      note,
    };
    if (keyRequired && !env.SERPAPI_API_KEY) {
      sources.push({
        ...base,
        mode: "needs_key",
        note: "Add the free SerpApi key as the GitHub secret SERPAPI_API_KEY to activate this broad search.",
      });
      jobs.push(...priorJobs);
      return;
    }
    const legacySearchError = keyRequired && priorStatus?.mode === "error" &&
      priorStatus.error === "Source unavailable or response invalid. Previous records retained; credentials are never logged.";
    if (!legacySearchError && priorStatus?.nextCheckAt && Date.parse(priorStatus.nextCheckAt) > now) {
      sources.push({
        ...priorStatus,
        mode: priorStatus.ok ? "cached" : priorStatus.mode,
        note,
      });
      jobs.push(...priorJobs);
      return;
    }
    if (keyRequired && state.used >= SEARCH_LIMIT) {
      sources.push({
        ...base,
        mode: "quota",
        note: "Free search budget reached. No more requests until the 31-day window resets.",
        nextCheckAt: new Date(
          Date.parse(state.windowStartedAt) + WINDOW,
        ).toISOString(),
      });
      jobs.push(...priorJobs);
      return;
    }
    const nextCheckAt = new Date(now + hours * HOUR).toISOString();
    try {
      if (keyRequired) state.used++;
      const result = await search();
      const kept = keepBroadRecords(priorJobs, result.records, now);
      jobs.push(...kept);
      sources.push({
        ...base,
        ok: true,
        mode: "live",
        lastSuccessfulAt: new Date(now).toISOString(),
        checkedAt: new Date(now).toISOString(),
        nextCheckAt,
        count: result.records.length,
        examined: result.examined,
        rejected: result.examined - result.records.length,
      });
      console.log(
        `${name}: ${result.examined} examined, ${result.records.length} career-related possible fits`,
      );
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError"
        ? "Request timed out"
        : error instanceof Error && /^Source returned HTTP \d{3}$/.test(error.message)
          ? error.message
          : "Network error or invalid response";
      jobs.push(...priorJobs);
      sources.push({
        ...base,
        mode: "error",
        error: `${reason}. Previous records retained; credentials are never logged.`,
        checkedAt: new Date(now).toISOString(),
        nextCheckAt,
      });
      console.error(`${name}: ${reason}; retaining previous records`);
    }
  }
  const remotive = {
    id: "remotive",
    name: "Remotive",
    url: "https://remotive.com",
  };
  await run(
    remotive.id,
    remotive.name,
    remotive.url,
    6,
    "Remote roles across employers. Public feed is delayed by 24 hours; checked at most four times daily.",
    async () => {
      const data = obj(
        await helpers.get("https://remotive.com/api/remote-jobs"),
      );
      if (!Array.isArray(data.jobs)) throw new Error("Invalid response");
      const records = data.jobs
        .map((v) => {
          const r = obj(v),
            date = str(r.publication_date);
          return makeRecord(
            remotive,
            {
              id: String(r.id),
              title: str(r.title),
              description: str(r.description),
              company: str(r.company_name),
              url: str(r.url),
              location: str(r.candidate_required_location),
              remote: true,
              posted: helpers.dateValue(
                date.endsWith("Z") || /[+-]\d\d:\d\d$/.test(date)
                  ? date
                  : `${date}Z`,
                now,
              ),
              dateText: `Remotive publication: ${date} (UTC assumed if timezone omitted)`,
              employment: str(r.job_type),
            },
            helpers,
            now,
          );
        })
        .filter((r): r is FeedRecord => !!r);
      return { records, examined: data.jobs.length };
    },
  );
  const jobicy = { id: "jobicy", name: "Jobicy", url: "https://jobicy.com" };
  await run(
    jobicy.id,
    jobicy.name,
    jobicy.url,
    6,
    "Up to 200 recent remote listings across employers, checked every six hours.",
    async () => {
      const data = obj(
        await helpers.get("https://jobicy.com/api/v2/remote-jobs?count=200"),
      );
      if (!Array.isArray(data.jobs)) throw new Error("Invalid response");
      const records = data.jobs
        .map((v) => {
          const r = obj(v);
          return makeRecord(
            jobicy,
            {
              id: String(r.id),
              title: str(r.jobTitle),
              description: str(r.jobDescription),
              company: str(r.companyName),
              url: str(r.url),
              location: str(r.jobGeo),
              remote: true,
              posted: helpers.dateValue(r.pubDate, now),
              dateText: `Jobicy publication: ${str(r.pubDate)}`,
              employment: str(arr(r.jobType)[0]),
            },
            helpers,
            now,
          );
        })
        .filter((r): r is FeedRecord => !!r);
      return { records, examined: data.jobs.length };
    },
  );
  const himalayas = {
    id: "himalayas",
    name: "Himalayas",
    url: "https://himalayas.app",
  };
  await run(
    himalayas.id,
    himalayas.name,
    himalayas.url,
    24,
    "Daily public remote feed. Up to 1,000 listings per pass; US/worldwide eligibility and career fit checked locally.",
    async () => {
      const records: FeedRecord[] = [];
      let examined = 0,
        cursor = "";
      const cursors = new Set<string>(),
        ids = new Set<string>();
      for (let page = 0; page < 50; page++) {
        const data = obj(
          await helpers.get(
            `https://himalayas.app/jobs/api?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
          ),
        );
        if (!Array.isArray(data.jobs)) throw new Error("Invalid response");
        let added = 0;
        for (const v of data.jobs) {
          const r = obj(v),
            id = str(r.guid);
          if (!id || ids.has(id)) continue;
          ids.add(id);
          examined++;
          added++;
          const locations = arr(r.locationRestrictions).map(str);
          const publication =
            typeof r.pubDate === "number"
              ? new Date(r.pubDate * 1000).toISOString()
              : null;
          const expiry =
            typeof r.expiryDate === "number"
              ? new Date(r.expiryDate * 1000).toISOString()
              : null;
          const record = makeRecord(
            himalayas,
            {
              id,
              title: str(r.title),
              description: str(r.description),
              company: str(r.companyName),
              url: str(r.applicationLink) || id,
              location: locations.length ? locations.join(", ") : "Worldwide",
              remote: true,
              posted: helpers.dateValue(publication, now),
              dateText: `Himalayas publication: ${publication || "unknown"}`,
              expiry,
              employment: str(r.employmentType),
            },
            helpers,
            now,
          );
          if (record) records.push(record);
        }
        const next = str(data.nextCursor);
        if (!next || cursors.has(next) || !added) break;
        cursors.add(next);
        cursor = next;
      }
      return { records, examined };
    },
  );
  const terms = [
    "event coordinator",
    "production assistant",
    "video editor",
    "stagehand",
    "production coordinator",
    "content producer",
  ];
  const cities = [
    { id: "miami", name: "Miami, Florida" },
    { id: "charleston", name: "Charleston, South Carolina" },
  ] as const;
  for (const city of cities) {
    const source = {
      id: `google-jobs-v2:${city.id}`,
      name: `Google Jobs · ${city.name} (SerpApi)`,
      url:
        "https://www.google.com/search?ibp=htl;jobs&q=" +
        encodeURIComponent(`jobs in ${city.name}`),
    };
    await run(
      source.id,
      source.name,
      source.url,
      12,
      "Broad job search across employers and job boards. One rotating query every twelve hours per city; 210 shared requests per 31 days maximum.",
      async () => {
        const q = `${terms[Math.floor(state.queryIndex / 2) % terms.length]} jobs in ${city.name}`;
        state.queryIndex++;
        const params = new URLSearchParams({
          engine: "google_jobs",
          q,
          location: city.name + ", United States",
          hl: "en",
          gl: "us",
          api_key: env.SERPAPI_API_KEY!,
        });
        const data = obj(
          await helpers.get(`https://serpapi.com/search.json?${params}`),
        );
        if (
          (data.error && !/hasn.t returned any results|no results/i.test(str(data.error))) ||
          (!data.error && !Array.isArray(data.jobs_results) && !data.search_information)
        )
          throw new Error("Search unavailable");
        const rows = arr(data.jobs_results);
        const records = rows
          .map((v) => {
            const r = obj(v),
              detected = obj(r.detected_extensions),
              link =
                arr(r.apply_options)
                  .map((x) => str(obj(x).link))
                  .find((u) => /^https:\/\//.test(u)) || str(r.share_link);
            return makeRecord(
              source,
              {
                id: str(r.job_id) || canonicalUrl(link),
                title: str(r.title),
                company: str(r.company_name),
                location: str(r.location),
                description: str(r.description),
                url: link,
                estimated: estimatedDate(str(detected.posted_at), now),
                dateText: `Google Jobs via ${str(r.via)}: ${str(detected.posted_at) || "date unknown"} (estimate; confirm original posting)`,
                employment: str(detected.schedule_type),
              },
              helpers,
              now,
            );
          })
          .filter((r): r is FeedRecord => !!r);
        return { records, examined: rows.length };
      },
      true,
    );
  }
  for (const city of cities) {
  await run(
    `google-web-v2:${city.id}`,
    `Job boards · ${city.name} (Google search)`,
    "https://www.google.com",
    24,
    "Daily indexed search of Indeed, LinkedIn, Glassdoor, ZipRecruiter, Monster, SimplyHired, EntertainmentCareers, ProductionHUB, Staff Me Up and TeamWork Online. Results require review; this is not direct access to those platforms.",
    async () => {
      const portals = "(site:indeed.com OR site:linkedin.com/jobs OR site:glassdoor.com OR site:ziprecruiter.com OR site:monster.com OR site:simplyhired.com OR site:entertainmentcareers.net OR site:productionhub.com OR site:staffmeup.com OR site:teamworkonline.com)";
      const query = `("event coordinator" OR "production assistant" OR "video editor" OR stagehand OR "content producer") jobs "${city.name.split(",")[0]}" ${portals}`;
      const params = new URLSearchParams({
        engine: "google",
        q: query,
        hl: "en",
        gl: "us",
        tbs: "qdr:w",
        api_key: env.SERPAPI_API_KEY!,
      });
      const data = obj(
        await helpers.get(`https://serpapi.com/search.json?${params}`),
      );
      if (data.error || !Array.isArray(data.organic_results))
        throw new Error("Search unavailable");
      const found = data.organic_results
        .map(obj)
        .filter(
          (r) =>
            /^https:\/\//.test(str(r.link)) &&
            careerRelated(
              { title: str(r.title), description: str(r.snippet) },
              sampleProfile,
            ),
        );
      leads = [
        ...new Map(
          [
            ...leads,
            ...found.map((r) => ({
              url: str(r.link),
              title: helpers.plain(r.title),
              snippet: helpers.plain(r.snippet),
              foundAt: new Date(now).toISOString(),
              market: city.id,
            })),
          ].map((l) => [l.market + ":" + canonicalUrl(l.url), l]),
        ).values(),
      ].slice(-80);
      return { records: [], examined: data.organic_results.length };
    },
    true,
  );
  }
  return { jobs, sources, searchState: state, leads };
}
