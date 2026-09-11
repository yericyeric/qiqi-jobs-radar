import { describe, it, expect } from "vitest";
import { makeSample, sampleProfile } from "../lib/sample";
import {
  scoreJob,
  posting,
  ageHours,
  verify,
  duplicate,
  affiliation,
  alertEligible,
  freshness,
  mergeJob,
} from "../lib/engine";
import { organizationSchema, jobInputSchema } from "../lib/contracts";
import { act, importJobs, refresh } from "../lib/state";
const now = Date.parse("2026-09-05T18:00:00Z");
const sample = () => makeSample(now);
const base = () => sample().jobs[0];
describe("responsibility-first scoring", () => {
  it("Live Nation production assistant scores high", () => {
    const j = base();
    j.title = "Production Assistant — Live Nation";
    j.organization.name = "Live Nation";
    expect(scoreJob(j, sampleProfile, now).total).toBeGreaterThanOrEqual(85);
  });
  it("food factory production is excluded", () => {
    const j = base();
    j.title = "Production Associate — Food Factory";
    j.description =
      "Manufacturing food on an assembly line, packaging food and operating factory equipment.";
    const s = scoreJob(j, sampleProfile, now);
    expect(s.total).toBeLessThan(20);
    expect(s.rejection).toBe("MANUFACTURING_PRODUCTION");
  });
  it("experiential event coordinator scores high", () => {
    const j = sample().jobs[1];
    expect(scoreJob(j, sampleProfile, now).total).toBeGreaterThanOrEqual(85);
  });
  it("senior producer with 8+ years gets seniority penalty", () => {
    const j = base(),
      senior = {
        ...j,
        title: "Senior Event Producer",
        description: j.description + " Requires 8+ years.",
      };
    expect(
      scoreJob(senior, sampleProfile, now).components["Career level"],
    ).toBe(0);
    expect(scoreJob(senior, sampleProfile, now).total).toBeLessThan(
      scoreJob(j, sampleProfile, now).total,
    );
    expect(scoreJob(senior, sampleProfile, now).requirementMatch).toBe(
      "LONG_SHOT",
    );
  });
  it("70% event marketing coordinator scores well despite title", () => {
    const j = base();
    j.title = "Marketing Coordinator";
    j.description =
      "70% event operations and live event production. Coordinate vendor scheduling, event logistics and run-of-show execution.";
    expect(scoreJob(j, sampleProfile, now).total).toBeGreaterThanOrEqual(80);
  });
  it("SEO and email only scores low", () => {
    const j = base();
    j.title = "Marketing Coordinator";
    j.description =
      "Manage SEO, email campaigns and search rankings. Optimize click-through rate and organic traffic.";
    expect(scoreJob(j, sampleProfile, now).total).toBeLessThan(60);
  });
  it("excludes disguised commission sales and outside locations", () => {
    expect(
      scoreJob(
        {
          ...base(),
          description:
            "Door-to-door commission-only sales advertised as event operations.",
        },
        sampleProfile,
        now,
      ).rejection,
    ).toBe("SALES_DISGUISED_AS_EVENT_ROLE");
    const j = base();
    j.organization.county = "Other";
    expect(scoreJob(j, sampleProfile, now).rejection).toBe("OUTSIDE_LOCATION");
  });
  it("does not invent years or make unknown requirements ineligible", () => {
    const j = base();
    j.requirements = [
      {
        text: "2 years preferred",
        required: false,
        assessment: "UNKNOWN",
        sourceUrl: "https://example.com",
      },
    ];
    expect(scoreJob(j, sampleProfile, now).requirementMatch).toBe("STRETCH");
  });
  it("hard unmet requirement is ineligible only when explicitly recorded", () => {
    const j = base();
    j.requirements = [
      {
        text: "Required qualification",
        required: true,
        assessment: "IMPOSSIBLE",
        sourceUrl: "https://example.com",
      },
    ];
    expect(scoreJob(j, sampleProfile, now).requirementMatch).toBe(
      "NOT_ELIGIBLE",
    );
  });
});
describe("freshness, evidence and alerts", () => {
  it("employer 21-day date beats Indeed today", () => {
    const j = base();
    j.sources[0].originalPostedAt = new Date(now - 21 * 86400000).toISOString();
    j.sources.push({
      ...j.sources[0],
      name: "Indeed",
      kind: "AGGREGATOR",
      url: "https://example.com/indeed",
      originalPostedAt: new Date(now - 3600000).toISOString(),
      sourcePostedText: "Today",
    });
    expect(ageHours(j, now)).toBe(504);
    expect(freshness(j, now)).toBe("Older");
  });
  it("unknown and future dates never become just posted", () => {
    const j = base();
    j.sources[0].originalPostedAt = new Date(now + 86400000).toISOString();
    expect(posting(j, now)).toBeNull();
    expect(freshness(j, now)).toBe("Date unknown");
  });
  it("keeps the 48–72 hour gap covered", () => {
    const j = base();
    j.sources[0].originalPostedAt = new Date(now - 60 * 3600000).toISOString();
    expect(freshness(j, now)).toBe("Still worth applying");
  });
  it("dead apply URL never alerts", () => {
    const j = base();
    j.isDemo = false;
    j.applyUrl = "https://example.com/apply";
    j.verification!.httpStatus = 404;
    expect(verify(j.verification, now)).toBe("CLOSED");
    expect(alertEligible(j, [], new Set(), now)).toBe(false);
  });
  it("ACTIVE requires complete, recent original-source evidence", () => {
    const v = base().verification!;
    expect(verify(v, now)).toBe("ACTIVE");
    expect(verify({ ...v, listedByEmployer: false }, now)).toBe(
      "LIKELY_ACTIVE",
    );
    expect(verify({ ...v, pageLoads: false }, now)).toBe("UNKNOWN");
    expect(
      verify(
        { ...v, checkedAt: new Date(now - 25 * 3600000).toISOString() },
        now,
      ),
    ).toBe("UNKNOWN");
  });
  it("closed or expired jobs stay blocked when stale", () => {
    const v = base().verification!;
    expect(
      verify(
        {
          ...v,
          expired: true,
          checkedAt: new Date(now - 200 * 3600000).toISOString(),
        },
        now,
      ),
    ).toBe("EXPIRED");
  });
  it("alerts require fresh verified, non-demo, not-dismissed, not-alerted records", () => {
    const j = base();
    j.isDemo = false;
    j.applyUrl = "https://example.com/apply";
    expect(alertEligible(j, [], new Set(), now)).toBe(true);
    expect(alertEligible(j, [], new Set([j.id]), now)).toBe(false);
    expect(
      alertEligible(
        j,
        [
          {
            jobId: j.id,
            action: "Dismiss",
            at: new Date(now).toISOString(),
            version: 1,
          },
        ],
        new Set(),
        now,
      ),
    ).toBe(false);
    expect(alertEligible({ ...j, isRepost: true }, [], new Set(), now)).toBe(
      false,
    );
  });
});
describe("canonical records, feedback and provenance", () => {
  it("LinkedIn and employer copies become one canonical record", () => {
    const state = sample();
    const copy = {
      ...base(),
      sources: [
        {
          ...base().sources[0],
          kind: "LINKEDIN" as const,
          url: "https://example.com/linkedin",
          name: "LinkedIn",
        },
      ],
    };
    expect(duplicate(base(), copy)).toBe(true);
    const next = importJobs(state, [copy], now);
    expect(next.jobs).toHaveLength(state.jobs.length);
    expect(next.jobs[0].sources).toHaveLength(2);
    expect(next.runs[0].duplicates).toBe(1);
  });
  it("reposts keep the earlier employer date and do not reappear after dismissal", () => {
    const state = act(sample(), base().id, "Dismiss", now);
    const copy = base();
    copy.sources[0].originalPostedAt = new Date(now).toISOString();
    const merged = mergeJob(state.jobs[0], copy, sampleProfile, now);
    expect(posting(merged, now)?.at).toBe(base().sources[0].originalPostedAt);
    expect(merged.version).toBe(1);
  });
  it("materially changed descriptions bump version", () => {
    const copy = base();
    copy.description =
      "Broadcast video editing, digital media production and camera assistance for television news.";
    expect(mergeJob(base(), copy, sampleProfile, now).version).toBe(2);
  });
  it("Applied persists application and action timestamp; closed report prevents alerts", () => {
    const next = act(sample(), base().id, "Applied", now);
    expect(next.applications[0].dateApplied).toBe("2026-09-05");
    expect(next.history[0].action).toBe("Applied");
    const closed = act(next, base().id, "Report Closed", now);
    expect(refresh(closed, now).jobs[0].status).toBe("CLOSED");
  });
  it("surname alone never establishes affiliation", () => {
    const o = base().organization;
    o.name = "Chen Productions";
    o.notes = "Founder surname Chen";
    expect(affiliation(o)).toEqual([]);
    expect(
      organizationSchema.safeParse({
        ...o,
        affiliations: [
          {
            label: "Chinese-affiliated",
            evidence: "Surname Chen",
            sourceUrl: o.website,
            publiclyExplicit: false,
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("documented China-US mission supports China-related affiliation", () => {
    const o = base().organization;
    o.affiliations = [
      {
        label: "China-related",
        evidence:
          "Official mission: promote China-US cultural exchange through performing arts.",
        sourceUrl: o.website + "/mission",
        publiclyExplicit: true,
      },
    ];
    expect(affiliation(organizationSchema.parse(o))).toHaveLength(1);
  });
  it("rejects unsupported salary, unsafe links and sourceless contacts", () => {
    expect(
      jobInputSchema.safeParse({
        ...base(),
        salary: "$70,000",
        salarySource: "",
      }).success,
    ).toBe(false);
    expect(
      jobInputSchema.safeParse({ ...base(), applyUrl: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(
      organizationSchema.safeParse({
        ...base().organization,
        publicEmail: "info@example.com",
        contactSource: "",
      }).success,
    ).toBe(false);
  });
  it("separates profile facts from learned preference weights", () => {
    const state = sample();
    const next = act(state, base().id, "Saved", now);
    expect(next.profile).toEqual(state.profile);
    expect(next.history).toHaveLength(1);
  });
});
