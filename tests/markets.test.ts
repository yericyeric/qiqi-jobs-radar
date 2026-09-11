import { describe, it, expect } from "vitest";
import { inMarket, compareRecentFit } from "../lib/markets";
import { makeSample, sampleProfile } from "../lib/sample";
import { scoreJob, ageHours, alertEligible } from "../lib/engine";
import { organizationSchema, profileSchema } from "../lib/contracts";
import { refresh, act, importJobs } from "../lib/state";
const now = Date.parse("2026-09-11T18:00:00Z");
describe("Miami and Charleston markets", () => {
  it("separates local jobs and allows related remote results in both views", () => {
    expect(inMarket({ county: "Miami-Dade" }, "charleston")).toBe(false);
    expect(inMarket({ county: "Broward" }, "miami")).toBe(true);
    expect(inMarket({ county: "Charleston" }, "charleston")).toBe(true);
    expect(inMarket({ county: "Charleston" }, "miami")).toBe(false);
    expect(inMarket({ county: "Other" }, "charleston")).toBe(false);
    expect(inMarket({ county: "Remote" }, "charleston")).toBe(true);
  });
  it("accepts Charleston in imports and gives relevant work the same local scoring", () => {
    const state = makeSample(now),
      miami = state.jobs[0],
      charleston = {
        ...miami,
        organization: {
          ...miami.organization,
          county: "Charleston" as const,
          city: "Charleston, SC",
        },
        location: "Charleston, SC",
      };
    expect(organizationSchema.safeParse(charleston.organization).success).toBe(
      true,
    );
    expect(profileSchema.parse(sampleProfile).counties).toContain("Charleston");
    expect(scoreJob(charleston, sampleProfile, now).total).toBe(
      scoreJob(miami, sampleProfile, now).total,
    );
    expect(
      scoreJob(charleston, { ...sampleProfile, counties: ["Miami-Dade"] }, now)
        .rejection,
    ).toBe("OUTSIDE_LOCATION");
  });
  it("upgrades older profiles without losing saved applications or re-enabling an explicitly removed county", () => {
    const state = act(makeSample(now), "demo-1", "Applied", now);
    state.profile = {
      ...state.profile,
      counties: ["Miami-Dade", "Broward"],
      locationVersion: undefined,
    };
    const next = refresh(state, now);
    expect(next.profile.counties).toContain("Charleston");
    expect(next.applications).toEqual(state.applications);
    expect(next.history).toEqual(state.history);
    next.profile.counties = ["Miami-Dade"];
    expect(refresh(next, now).profile.counties).toEqual(["Miami-Dade"]);
  });
  it("prioritizes the first 24 hours, then fit; keeps older dates out of the default window", () => {
    const state = makeSample(now),
      fresh = state.jobs[6],
      recent = state.jobs[7];
    fresh.score.total = 80;
    recent.score.total = 100;
    expect(
      [recent, fresh].sort((a, b) => compareRecentFit(a, b, now))[0].id,
    ).toBe(fresh.id);
    const old = structuredClone(recent);
    old.sources[0].originalPostedAt = new Date(
      now - 21 * 86400000,
    ).toISOString();
    expect([fresh, old].filter((j) => ageHours(j, now) <= 48)).toHaveLength(1);
    old.isDemo = false;
    expect(alertEligible(old, [], new Set(), now)).toBe(false);
  });
  it("imports and retains Charleston records and rejects industrial mismatches", () => {
    const state = makeSample(now),
      job = {
        ...state.jobs[6],
        title: "Production Associate",
        description:
          "Food factory manufacturing and assembly line work. Operate industrial packaging machinery.",
      };
    const next = importJobs(state, [job], now);
    expect(next.runs[0].rejections[0].reason).toBe("MANUFACTURING_PRODUCTION");
  });
});
