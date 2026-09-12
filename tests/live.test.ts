import { describe, it, expect } from "vitest";
import {
  countyFor,
  dateValue,
  reconcile,
  plain,
} from "../scripts/collect-jobs";
import {
  emptyLiveState,
  feedSchema,
  mergeLiveFeed,
  migrateLegacyState,
} from "../lib/live";
import { makeSample, updateQiqiSkills } from "../lib/sample";
import { ageHours, verify } from "../lib/engine";
const now = Date.parse("2026-09-11T12:00:00Z");
it("adds Qiqi's skills once while preserving personal edits and avoiding duplicates", () => {
  const original = { ...makeSample(now).profile, skillsVersion: undefined, skills: ["Stage management", "Custom skill"], experience: ["Personal experience"], notes: "Personal notes" };
  const updated = updateQiqiSkills(original);
  expect(updated.skills).toContain("Chinese Mandarin");
  expect(updated.skills.filter((s) => s === "Stage management")).toHaveLength(1);
  expect(updated.skills).toContain("Custom skill");
  expect(updated.experience).toContain("Teaching Assistant");
  expect(updated.experience).toContain("Personal experience");
  expect(updated.notes).toBe("Personal notes");
  expect(updateQiqiSkills(updated)).toBe(updated);
});
function record() {
  const input = structuredClone(makeSample(now).jobs[0]);
  input.isDemo = false;
  input.organization.isDemo = false;
  input.verification!.method = "AUTOMATED_ATS";
  return {
    id: "ats:test:1",
    board: "test",
    discoveredAt: new Date(now).toISOString(),
    input,
  };
}
describe("live job integrity", () => {
  it("keeps legacy profile edits without copying fictional jobs", () => {
    const legacy = makeSample(now);
    legacy.profile.notes = "Keep this note";
    const migrated = migrateLegacyState(legacy);
    expect(migrated.profile.notes).toBe("Keep this note");
    expect(migrated.jobs).toEqual([]);
    expect(legacy.jobs.length).toBeGreaterThan(0);
  });
  it("does not claim a still-listed job closed after its location or title changes", () => {
    const r = record();
    expect(reconcile([r], [], new Set(["test"]), now, new Set([r.id]))).toEqual(
      [],
    );
  });
  it("distinguishes Charleston SC from WV and maps nearby Johns Island", () => {
    expect(countyFor("Charleston, WV")).toBeNull();
    expect(countyFor("Charleston")).toBeNull();
    expect(countyFor("Johns Island, South Carolina, us")).toBe("Charleston");
    expect(countyFor("Miami, Ohio")).toBeNull();
    expect(countyFor("Miami, FL")).toBe("Miami-Dade");
  });
  it("does not invent dates and strips encoded HTML", () => {
    expect(dateValue(undefined, now)).toBeNull();
    expect(dateValue("2027-01-01", now)).toBeNull();
    expect(plain("&lt;p&gt;Stage &amp;amp; events&lt;/p&gt;")).toBe(
      "Stage & events",
    );
  });
  it("does not close jobs when a source fails; closes after a complete successful scan", () => {
    const r = record();
    expect(reconcile([r], [], new Set(), now)[0]).toEqual(r);
    expect(
      reconcile([r], [], new Set(["test"]), now)[0].input.verification?.closed,
    ).toBe(true);
  });
  it("preserves the original date when an ATS republishes the same ID", () => {
    const r = record(),
      updated = record();
    updated.input.sources[0].originalPostedAt = new Date(now).toISOString();
    const result = reconcile([r], [updated], new Set(["test"]), now);
    expect(result[0].input.sources[0].originalPostedAt).toBe(
      r.input.sources[0].originalPostedAt,
    );
    expect(ageHours(result[0].input, now)).toBe(5);
  });
  it("refreshes public data while keeping local profile, saved jobs and notes", () => {
    const state = emptyLiveState(),
      r = record();
    state.profile.notes = "private notes";
    state.history.push({
      jobId: r.id,
      action: "Saved",
      at: new Date(now).toISOString(),
      version: 1,
    });
    const feed = feedSchema.parse({
      version: 1,
      attemptedAt: new Date(now).toISOString(),
      lastSuccessfulAt: null,
      sources: [],
      jobs: [r],
    });
    const next = mergeLiveFeed(state, feed, now);
    expect(next.profile.notes).toBe("private notes");
    expect(next.history).toEqual(state.history);
    expect(next.jobs[0].id).toBe(r.id);
    expect(next.jobs[0].status).toBe("LIKELY_ACTIVE");
    expect(verify(next.jobs[0].verification, now + 25 * 3600000)).toBe(
      "UNKNOWN",
    );
    expect(mergeLiveFeed(next, { ...feed, jobs: [] }, now).jobs[0].status).toBe(
      "UNKNOWN",
    );
    r.input.isDemo = true;
    expect(feedSchema.safeParse({ ...feed, jobs: [r] }).success).toBe(false);
  });
});
