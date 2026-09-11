import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  jobInputSchema,
  organizationSchema,
  type Organization,
  type JobInput,
} from "../lib/contracts";
import { feedSchema, type LiveFeed } from "../lib/live";
import configs from "./sources.json";
import { careerRelated } from "../lib/career";
import { scoreJob } from "../lib/engine";
import { sampleProfile } from "../lib/sample";
import { broadSearch, deduplicateFeed } from "./broad-search";

type Board = (typeof configs)[number];
// ATS responses are untrusted. Narrow individual fields; validate the normalized output.
type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export function plain(v: unknown): string {
  let s = str(v);
  for (let n = 0; n < 3; n++)
    s = s
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#(?:39|x27);/gi, "'")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&");
  return s
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function countyFor(location: string): Organization["county"] | null {
  if (/west virginia|\bWV\b|ohio|\bOH\b|united kingdom/i.test(location))
    return null;
  if (
    /\b(?:north charleston|charleston|johns island|kiawah island|mount pleasant)\b/i.test(
      location,
    ) &&
    /south carolina|\bSC\b/i.test(location)
  )
    return "Charleston";
  if (/\b(miami|doral|aventura|coral gables|hialeah)\b/i.test(location))
    return "Miami-Dade";
  if (
    /fort lauderdale|hollywood,?\s+(?:fl|florida)|pompano beach|sunrise,?\s+(?:fl|florida)/i.test(
      location,
    )
  )
    return "Broward";
  if (/west palm beach|boca raton|delray beach/i.test(location))
    return "Palm Beach";
  return null;
}
export function dateValue(v: unknown, now: number): string | null {
  const ms = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(ms) && ms <= now ? new Date(ms).toISOString() : null;
}
function categoryFor(title: string): JobInput["category"] {
  if (/stage|backstage|stagehand/i.test(title)) return "Stage";
  if (/broadcast|news|journalis/i.test(title)) return "Broadcast";
  if (/video|content|studio|editor/i.test(title)) return "Content";
  if (/production|producer/i.test(title)) return "Production";
  if (/venue/i.test(title)) return "Venue";
  return "Events";
}
function relevant(title: string) {
  return (
    /event|production|producer|stage|broadcast|video|media|content|studio|editor|venue|programming|experiential|activation|banquet|conference|communications|publicity|journalis|reporter|audiovisual/i.test(
      title,
    ) &&
    !/software|engineer|accountant|cook|chef|bartender|server|sales director/i.test(
      title,
    )
  );
}
async function get(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: {
      Accept: "application/json",
      "User-Agent": "QiqiJobRadar/1.0 (public job listings)",
    },
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  return response.json();
}
const boardId = (b: Board) => `${b.kind}:${b.slug}`;
function boardUrl(b: Board) {
  if (b.kind === "greenhouse")
    return `https://job-boards.greenhouse.io/${b.slug}`;
  if (b.kind === "lever") return `https://jobs.lever.co/${b.slug}`;
  return `https://careers.smartrecruiters.com/${b.slug}`;
}
function normalize(b: Board, raw: Raw, now: number): JobInput | null {
  const gh = b.kind === "greenhouse",
    sr = b.kind === "smartrecruiters";
  const loc = obj(raw.location),
    cats = obj(raw.categories);
  const location = gh
    ? str(loc.name)
    : sr
      ? [loc.city, loc.region, loc.country].filter(Boolean).join(", ")
      : str(cats.location);
  const county = countyFor(location);
  const title = str(gh ? raw.title : sr ? raw.name : raw.text);
  if (!county) return null;
  const sections = obj(obj(raw.jobAd).sections);
  const description = plain(
    gh
      ? raw.content
      : sr
        ? [
            obj(sections.jobDescription).text,
            obj(sections.qualifications).text,
            obj(sections.additionalInformation).text,
          ]
            .filter(Boolean)
            .join(" ")
        : [
            raw.descriptionPlain,
            ...arr(raw.lists).map(
              (x) => `${str(obj(x).text)} ${str(obj(x).content)}`,
            ),
          ].join(" "),
  );
  if (description.length < 30)
    throw new Error("Source returned an incomplete job description");
  if (!careerRelated({ title, description }, sampleProfile)) return null;
  const url = str(gh ? raw.absolute_url : sr ? raw.postingUrl : raw.hostedUrl);
  const applyUrl =
    str(sr ? raw.applyUrl : gh ? raw.absolute_url : raw.applyUrl) || url;
  const id = String(raw.id);
  const apiUrl = gh
    ? `https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs/${id}`
    : sr
      ? `https://api.smartrecruiters.com/v1/companies/${b.slug}/postings/${id}`
      : `https://api.lever.co/v0/postings/${b.slug}/${id}`;
  const posted = dateValue(
    gh ? raw.first_published : sr ? raw.releasedDate : null,
    now,
  );
  const time = new Date(now).toISOString();
  const employment = plain(
    sr ? obj(raw.typeOfEmployment).label : gh ? "" : cats.commitment,
  );
  const employmentType =
    [
      "Full-time",
      "Part-time",
      "Temporary",
      "Seasonal",
      "Contract",
      "Internship",
    ].find((t) => t.toLowerCase() === employment.toLowerCase()) || "Unknown";
  return jobInputSchema.parse({
    title,
    location,
    description: description.slice(0, 50000),
    category: categoryFor(title),
    employmentType,
    applyUrl,
    organization: organizationSchema.parse({
      id: `${boardId(b)}:${county.replace(/\s/g, "-")}`,
      name: b.name,
      website: b.website,
      type: b.type,
      city: sr ? str(loc.city) : location.slice(0, 100),
      county,
      careersUrl: boardUrl(b),
      lastCheckedForJobs: time,
    }),
    sources: [
      {
        name: boardId(b),
        kind: "ATS",
        url: apiUrl,
        externalId: id,
        capturedAt: time,
        originalPostedAt: posted,
        sourcePostedText: posted
          ? `${gh ? "first_published" : "releasedDate"}: ${posted}`
          : "Publication date not supplied; discovery and modification times are not posting dates",
        evidence: `Public employer ATS posting: ${url}`,
      },
    ],
    requirements: [
      {
        text: "Review the employer's full qualifications, language and work authorization requirements. These have not been confirmed against Qiqi's profile.",
        required: true,
        assessment: "UNKNOWN",
        sourceUrl: url,
      },
    ],
    verification: {
      checkedAt: time,
      sourceUrl: apiUrl,
      sourceKind: "ATS",
      pageLoads: true,
      jobIdExists: true,
      listedByEmployer: true,
      applyExists: Boolean(applyUrl),
      httpStatus: 200,
      method: "AUTOMATED_ATS",
      expired: !!dateValue(raw.application_deadline, now),
      notes:
        "Public ATS returned this posting and an application link. The external application form has not been tested.",
    },
  });
}
export function reconcile(
  previous: LiveFeed["jobs"],
  current: LiveFeed["jobs"],
  successful: Set<string>,
  now: number,
  listedIds: Set<string> = new Set(current.map((j) => j.id)),
): LiveFeed["jobs"] {
  const old = new Map(previous.map((j) => [j.id, j]));
  const next = current.map((j) => {
    const prior = old.get(j.id);
    if (!prior) return j;
    const dates = [...prior.input.sources, ...j.input.sources]
      .map((s) => s.originalPostedAt)
      .filter((s): s is string => !!s)
      .sort();
    return {
      ...j,
      discoveredAt: prior.discoveredAt,
      input: {
        ...j.input,
        sources: j.input.sources.map((s) => ({
          ...s,
          originalPostedAt: dates[0] || null,
        })),
      },
    };
  });
  const ids = new Set(next.map((j) => j.id));
  for (const prior of previous) {
    if (ids.has(prior.id)) continue;
    if (!successful.has(prior.board)) {
      next.push(prior);
      continue;
    }
    // A role moved outside our filters is not evidence of a closed vacancy.
    if (listedIds.has(prior.id)) continue;
    const v = prior.input.verification;
    if (v && (!v.closed || now - Date.parse(v.checkedAt) <= 30 * 86400000))
      next.push({
        ...prior,
        input: {
          ...prior.input,
          verification: {
            ...v,
            closed: true,
            listedByEmployer: false,
            checkedAt: v.closed ? v.checkedAt : new Date(now).toISOString(),
            notes:
              "No longer returned by a complete successful scan of this employer's public postings.",
          },
        },
      });
  }
  return next;
}
async function discover(
  b: Board,
  now: number,
): Promise<{ records: LiveFeed["jobs"]; listedIds: string[] }> {
  const rawJobs: Raw[] = [];
  if (b.kind === "greenhouse") {
    const data = obj(
      await get(
        `https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs?content=true`,
      ),
    );
    if (!Array.isArray(data.jobs))
      throw new Error("Invalid Greenhouse response");
    rawJobs.push(...data.jobs.map(obj));
  } else if (b.kind === "lever") {
    for (let skip = 0; ; skip += 100) {
      if (skip >= 10000)
        throw new Error("Pagination limit reached; scan incomplete");
      const data = await get(
        `https://api.lever.co/v0/postings/${b.slug}?mode=json&limit=100&skip=${skip}`,
      );
      if (!Array.isArray(data)) throw new Error("Invalid Lever response");
      rawJobs.push(...data.map(obj));
      if (data.length < 100) break;
    }
  } else {
    for (let offset = 0; ; offset += 100) {
      if (offset >= 10000)
        throw new Error("Pagination limit reached; scan incomplete");
      const data = obj(
        await get(
          `https://api.smartrecruiters.com/v1/companies/${b.slug}/postings?limit=100&offset=${offset}&country=us`,
        ),
      );
      if (!Array.isArray(data.content) || typeof data.totalFound !== "number")
        throw new Error("Invalid SmartRecruiters response");
      rawJobs.push(...data.content.map(obj));
      if (offset + data.content.length >= data.totalFound) break;
      if (!data.content.length) throw new Error("Incomplete pagination");
    }
  }
  const records: LiveFeed["jobs"] = [];
  for (let raw of rawJobs) {
    const loc = obj(raw.location);
    const location =
      b.kind === "greenhouse"
        ? str(loc.name)
        : b.kind === "lever"
          ? str(obj(raw.categories).location)
          : [loc.city, loc.region, loc.country].join(", ");
    if (
      !countyFor(location) ||
      !relevant(str(raw.title || raw.name || raw.text))
    )
      continue;
    if (b.kind === "smartrecruiters")
      raw = obj(
        await get(
          `https://api.smartrecruiters.com/v1/companies/${b.slug}/postings/${String(raw.id)}`,
        ),
      );
    if (b.kind === "greenhouse" && !raw.first_published)
      raw = obj(
        await get(
          `https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs/${String(raw.id)}`,
        ),
      );
    if (!raw.id) throw new Error("Posting ID missing");
    const input = normalize(b, raw, now);
    if (
      input &&
      scoreJob(input, sampleProfile, now).total >= 30 &&
      !scoreJob(input, sampleProfile, now).rejection
    )
      records.push({
        id: `ats:${boardId(b)}:${String(raw.id)}`,
        board: boardId(b),
        discoveredAt: new Date(now).toISOString(),
        input,
      });
  }
  return {
    records,
    listedIds: rawJobs.map((raw) => `ats:${boardId(b)}:${String(raw.id)}`),
  };
}
export async function collect(
  output = "public/data/jobs.json",
  priorPath = output,
): Promise<LiveFeed> {
  const now = Date.now(),
    time = new Date(now).toISOString();
  let previous: LiveFeed | null = null;
  try {
    previous = feedSchema.parse(JSON.parse(await readFile(priorPath, "utf8")));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const current: LiveFeed["jobs"] = [],
    sources: LiveFeed["sources"] = [],
    successful = new Set<string>(),
    listedIds = new Set<string>();
  // Sequential boards avoid bursts; errors retain the previous source snapshot.
  for (const b of configs) {
    const id = boardId(b);
    try {
      const found = await discover(b, now);
      const records = found.records;
      found.listedIds.forEach((id) => listedIds.add(id));
      current.push(...records);
      successful.add(id);
      sources.push({
        id,
        name: b.name,
        url: boardUrl(b),
        ok: true,
        count: records.length,
        error: "",
        lastSuccessfulAt: time,
      });
      console.log(`${b.name}: ${records.length} relevant local postings`);
    } catch (e) {
      const error = e instanceof Error ? e.message : "Source unavailable";
      sources.push({
        id,
        name: b.name,
        url: boardUrl(b),
        ok: false,
        count: 0,
        error: error.slice(0, 300),
        lastSuccessfulAt:
          previous?.sources.find((s) => s.id === id)?.lastSuccessfulAt || null,
      });
      console.error(`${b.name}: ${error}`);
    }
  }
  const broad = await broadSearch(previous, now, {
    plain,
    countyFor,
    dateValue,
    categoryFor,
    get,
  });
  const feed = feedSchema.parse({
    version: 1,
    attemptedAt: time,
    lastSuccessfulAt:
      successful.size === configs.length
        ? time
        : previous?.lastSuccessfulAt || null,
    sources: [...sources, ...broad.sources],
    searchState: broad.searchState,
    leads: broad.leads,
    jobs: deduplicateFeed([
      ...reconcile(
        previous?.jobs.filter((j) => !j.id.startsWith("web:")) || [],
        current,
        successful,
        now,
        listedIds,
      ),
      ...broad.jobs,
    ]),
  });
  await mkdir("public/data", { recursive: true });
  await writeFile(output, JSON.stringify(feed));
  return feed;
}
