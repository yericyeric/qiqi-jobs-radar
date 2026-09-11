import { describe, it, expect, vi } from "vitest";
import { careerRelated } from "../lib/career";
import { scoreJob, ageHours } from "../lib/engine";
import { sampleProfile, makeSample } from "../lib/sample";
import {
  broadSearch,
  budget,
  SEARCH_LIMIT,
  remoteEligible,
  estimatedDate,
  keepBroadRecords,
  deduplicateFeed,
} from "../scripts/broad-search";
import { plain, countyFor, dateValue } from "../scripts/collect-jobs";
import { feedSchema } from "../lib/live";
import { directJobPortal } from "../lib/markets";
import { jobPostingFromHtml } from "../scripts/broad-search";
const now = Date.parse("2026-09-11T12:00:00Z");
const description =
  "Support live event production and stage management. Coordinate crew scheduling, event logistics, backstage operations and video production.";
const makeFeed = () =>
  feedSchema.parse({
    version: 1,
    attemptedAt: new Date(now).toISOString(),
    lastSuccessfulAt: null,
    sources: [],
    jobs: [],
  });
describe("broad discovery and 15-point career gate", () => {
  it("rejects search pages and accepts individual vacancy URLs", () => {
    expect(directJobPortal("https://www.indeed.com/q-events-l-miami-jobs.html")).toBeNull();
    expect(directJobPortal("https://www.glassdoor.com/Job/miami-jobs.htm")).toBeNull();
    expect(directJobPortal("https://www.linkedin.com/jobs/search/?keywords=events")).toBeNull();
    expect(directJobPortal("https://www.ziprecruiter.com/Jobs/Events/-in-Miami,FL")).toBeNull();
    expect(directJobPortal("https://www.indeed.com/viewjob?jk=abc123")).toBe("Indeed");
    expect(directJobPortal("https://www.linkedin.com/jobs/view/event-coordinator-12345")).toBe("LinkedIn");
    expect(directJobPortal("https://linkedin.com.attacker.test/jobs/view/12345")).toBeNull();
    expect(jobPostingFromHtml('<script type="application/ld+json">{"@type":"ItemList"}</script>')).toBeNull();
  });
  it("promotes readable local JobPosting pages into scored jobs, retaining blocked direct links separately", async () => {
    const get = async (url: string): Promise<unknown> => {
      if (!url.includes("serpapi.com")) return { jobs: [] };
      if (url.includes("engine=google_jobs")) return { jobs_results: [] };
      const city = url.includes("Charleston") ? "Charleston" : "Miami";
      return { organic_results: [{ title: `Production Assistant ${city}`, snippet: description, link: `https://www.linkedin.com/jobs/view/${city}-12345` }, { title: `Production Assistant ${city}`, snippet: description, link: "https://www.indeed.com/q-production-jobs.html" }] };
    };
    const getPage = async (url: string) => {
      if (url.includes("Charleston")) throw new Error("Access denied");
      return `<script type="application/ld+json">${JSON.stringify({ "@graph": [{ "@type": "JobPosting", title: "Production Assistant", description, hiringOrganization: { name: "Fixture Venue" }, datePosted: "2026-09-11T10:00:00Z", jobLocation: { address: { addressLocality: "Miami", addressRegion: "FL", addressCountry: "US" } } }] })}</script>`;
    };
    const result = await broadSearch(null, now, { plain, countyFor, dateValue, categoryFor: () => "Production", get, getPage }, { SERPAPI_API_KEY: "fixture-key" });
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].input.organization.county).toBe("Miami-Dade");
    expect(result.jobs[0].input.sources[0].name).toBe("LinkedIn");
    expect(result.jobs[0].input.sources[0].originalPostedAt).toBe("2026-09-11T10:00:00.000Z");
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].market).toBe("charleston");
  });
  it("keeps a career-related long shot between 15 and 29 without admitting unrelated video roles", () => {
    const job = makeSample(now).jobs[0];
    job.title = "Senior Studio Assistant";
    job.description = "Organize props and prepare the studio for the creative team.";
    job.organization.type = "Creative team";
    job.sources.forEach((source) => {
      source.originalPostedAt = "2020-01-01T00:00:00.000Z";
      source.estimatedPostedAt = null;
    });
    const score = scoreJob(job, sampleProfile, now);
    expect(score.total).toBeGreaterThanOrEqual(15);
    expect(score.total).toBeLessThan(30);
    expect(score.rejection).toBeNull();
    expect(score.requirementMatch).toBe("LONG_SHOT");
    expect(careerRelated({ title: "Video Medical Interpreter", description }, sampleProfile)).toBe(false);
  });
  it("allows a related partial fit below 70 but rejects generic transferable skills", () => {
    const job = makeSample(now).jobs[0];
    job.title = "Studio Assistant";
    job.description =
      "Organize props and prepare the studio for the creative team each morning.";
    const score = scoreJob(job, sampleProfile, now);
    expect(score.total).toBeGreaterThanOrEqual(30);
    expect(score.total).toBeLessThan(70);
    expect(score.rejection).toBeNull();
    expect(score.label).toBe("Possible fit");
    expect(
      careerRelated(
        {
          title: "Office Coordinator",
          description:
            "Coordinate vendor scheduling and cross-functional teams.",
        },
        sampleProfile,
      ),
    ).toBe(false);
    expect(
      careerRelated(
        { title: "Insurance Producer", description },
        sampleProfile,
      ),
    ).toBe(false);
    expect(
      careerRelated(
        {
          title: "Software Engineer",
          description: "Develop event-driven video streaming software.",
        },
        sampleProfile,
      ),
    ).toBe(false);
    expect(
      careerRelated(
        { title: "Marketing Coordinator", description },
        sampleProfile,
      ),
    ).toBe(true);
  });
  it("honors remote restrictions and avoids treating search dates as exact", () => {
    expect(remoteEligible("United States")).toBe(true);
    expect(remoteEligible("Worldwide")).toBe(true);
    expect(remoteEligible("United Kingdom")).toBe(false);
    expect(remoteEligible("Europe only")).toBe(false);
    expect(estimatedDate("1 day ago", now)).toBe(
      new Date(now - 48 * 3600000).toISOString(),
    );
    expect(estimatedDate("recently", now)).toBeNull();
    expect(
      budget(
        {
          windowStartedAt: new Date(now - 86400000).toISOString(),
          used: SEARCH_LIMIT,
          queryIndex: 5,
        },
        now,
      ).used,
    ).toBe(SEARCH_LIMIT);
  });
  it("runs public portals without keys and clearly leaves Google inactive", async () => {
    const get = vi.fn(async () => ({ jobs: [] }));
    const result = await broadSearch(
      null,
      now,
      { plain, countyFor, dateValue, categoryFor: () => "Production", get },
      {},
    );
    expect(get).toHaveBeenCalledTimes(3);
    expect(result.sources.filter((s) => s.mode === "needs_key")).toHaveLength(
      4,
    );
    expect(result.searchState.used).toBe(0);
  });
  it("analyzes Google Jobs, preserves relative date provenance, and observes independent source cadence", async () => {
    const get = vi.fn(async (url: string): Promise<unknown> => {
      if (!url.includes("serpapi.com")) return { jobs: [] };
      if (url.includes("engine=google_jobs")) {
        const city = url.includes("Charleston")
          ? "Charleston, SC"
          : "Miami, FL";
        return {
          jobs_results: [
            {
              title: "Production Assistant",
              company_name: "Fixture Arts",
              location: city,
              description,
              job_id: city,
              via: "Fixture board",
              detected_extensions: { posted_at: "3 hours ago" },
              apply_options: [
                {
                  title: "Employer",
                  link: `https://example.com/${city.startsWith("Miami") ? "miami" : "charleston"}`,
                },
              ],
            },
          ],
        };
      }
      return {
        organic_results: [
          {
            title: `Event Coordinator ${url.includes("Charleston") ? "Charleston" : "Miami"}`,
            snippet: description,
            link: `https://www.linkedin.com/jobs/view/${url.includes("Charleston") ? "charleston" : "miami"}-12345`,
          },
        ],
      };
    });
    const result = await broadSearch(
      null,
      now,
      { plain, countyFor, dateValue, categoryFor: () => "Production", get },
      { SERPAPI_API_KEY: "fixture-key" },
    );
    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0].input.sources[0].originalPostedAt).toBeNull();
    expect(ageHours(result.jobs[0].input, now)).toBe(4);
    expect(result.leads).toHaveLength(2);
    expect(result.searchState.used).toBe(4);
    const feed = { ...makeFeed(), ...result };
    get.mockClear();
    const repeated = await broadSearch(
      feed,
      now + 15 * 60000,
      { plain, countyFor, dateValue, categoryFor: () => "Production", get },
      { SERPAPI_API_KEY: "fixture-key" },
    );
    expect(get).not.toHaveBeenCalled();
    expect(repeated.jobs).toHaveLength(2);
    expect(repeated.sources.every((s) => s.mode === "cached")).toBe(true);
    const budgetFeed = {
      ...makeFeed(),
      searchState: {
        windowStartedAt: new Date(now).toISOString(),
        used: SEARCH_LIMIT,
        queryIndex: 0,
      },
    };
    get.mockClear();
    const paused = await broadSearch(
      budgetFeed,
      now,
      { plain, countyFor, dateValue, categoryFor: () => "Production", get },
      { SERPAPI_API_KEY: "fixture-key" },
    );
    expect(get).toHaveBeenCalledTimes(3);
    expect(paused.sources.filter((s) => s.mode === "quota")).toHaveLength(4);
    const first = result.jobs[0],
      changed = structuredClone(first);
    changed.input.sources[0].estimatedPostedAt = new Date(now).toISOString();
    expect(
      keepBroadRecords([first], [changed], now)[0].input.sources[0]
        .estimatedPostedAt,
    ).toBe(first.input.sources[0].estimatedPostedAt);
    expect(keepBroadRecords([first], [], now)).toHaveLength(1);
    const same = structuredClone(first);
    same.id = "another-source";
    same.input.sources[0].name = "Another portal";
    expect(deduplicateFeed([first, same])).toHaveLength(1);
    expect(first.input.sources).toHaveLength(2);
  });
});
