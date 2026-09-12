import { describe, it, expect } from "vitest";
import { sampleProfile, makeSample, updateQiqiSkills } from "../lib/sample";
import { skillMatches, searchRoles } from "../lib/fit-skills";
import { scoreJob } from "../lib/engine";
import { careerRelated } from "../lib/career";

const now = Date.parse("2026-09-05T18:00:00Z");
describe("Qiqi-specific evidence and discovery", () => {
  it("adds English once to existing profiles without restoring previously removed skills", () => {
    const old = { ...sampleProfile, skillsVersion: 1 as const, skills: ["Custom skill"] };
    const updated = updateQiqiSkills(old);
    expect(updated.skills).toEqual(["Custom skill", "English"]);
    expect(updateQiqiSkills(updated)).toBe(updated);
    expect(skillMatches("English required", sampleProfile)).toContain("English — proficiency needs confirmation");
    expect(skillMatches("Spanish required", sampleProfile)).toEqual([]);
  });
  it("scores new supporting skills only when both profile and vacancy contain evidence", () => {
    const job = { ...makeSample(now).jobs[0], title: "Production Assistant", requirements: [], description: "Support production planning for television. Manage budgets, forecasting and Microsoft Office. Mandarin preferred." };
    const reduced = { ...sampleProfile, skills: ["Production assistance"], experience: [], education: [] };
    const full = scoreJob(job, sampleProfile, now);
    expect(full.total).toBeGreaterThan(scoreJob(job, reduced, now).total);
    expect(full.reasons).toContain("Budget planning & forecasting");
    expect(full.reasons).toContain("Mandarin — proficiency needs confirmation");
    expect(full.requirementMatch).toBe("STRETCH");
  });
  it("does not multiply points for repeated words or missing requirements", () => {
    expect(skillMatches("Mandarin Mandarin Mandarin", sampleProfile)).toHaveLength(1);
    expect(skillMatches("No Mandarin required.", sampleProfile)).toHaveLength(0);
    expect(skillMatches("Certified in Adobe Premiere and fluent Spanish", sampleProfile)).toHaveLength(0);
  });
  it("admits arts teaching support, not an unrelated classroom role", () => {
    expect(careerRelated({ title: "Teaching Assistant", description: "Assist students with dance and performing arts rehearsals." }, sampleProfile)).toBe(true);
    expect(careerRelated({ title: "Teaching Assistant", description: "Support students with mathematics and chemistry." }, sampleProfile)).toBe(false);
  });
  it("generic transferable skills cannot bypass career or geography gates", () => {
    const job = { ...makeSample(now).jobs[0], title: "Office Assistant", description: "Microsoft Office, budgets, Mandarin and meeting facilitation." };
    expect(scoreJob(job, sampleProfile, now).rejection).toBeTruthy();
    job.title = "Production Assistant";
    job.organization.county = "Other";
    expect(scoreJob(job, sampleProfile, now).rejection).toBe("OUTSIDE_LOCATION");
  });
  it("keeps experienced director roles below a reassuring match label", () => {
    const job = { ...makeSample(now).jobs[0], title: "Senior Production Director" };
    expect(scoreJob(job, sampleProfile, now).total).toBeLessThan(70);
    expect(scoreJob(job, sampleProfile, now).requirementMatch).toBe("LONG_SHOT");
  });
  it("turns actual profile evidence into related searches", () => {
    expect(searchRoles(sampleProfile)).toContain("radio production assistant");
    expect(searchRoles(sampleProfile)).toContain("performing arts teaching assistant");
    const limited = { ...sampleProfile, skills: ["Video editing"], experience: [], education: [] };
    expect(searchRoles(limited)).toContain("video editor");
    expect(searchRoles(limited)).not.toContain("stagehand");
  });
});
