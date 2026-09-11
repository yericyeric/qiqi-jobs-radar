import { writeFileSync, mkdirSync } from "node:fs";
import { makeSample, sampleProfile } from "../lib/sample";
mkdirSync("samples", { recursive: true });
const sample = makeSample(Date.parse("2026-09-05T18:00:00Z"));
writeFileSync(
  "samples/candidate.json",
  JSON.stringify(sampleProfile, null, 2) + "\n",
);
writeFileSync(
  "samples/jobs.demo.json",
  JSON.stringify(
    sample.jobs.map((j) => ({
      title: j.title,
      organization: j.organization,
      location: j.location,
      category: j.category,
      employmentType: j.employmentType,
      description: j.description,
      applyUrl: j.applyUrl,
      salary: j.salary,
      salarySource: j.salarySource,
      sources: j.sources,
      requirements: j.requirements,
      verification: j.verification,
      isDemo: true,
    })),
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "samples/organization.demo.json",
  JSON.stringify(sample.organizations.at(-1), null, 2) + "\n",
);
