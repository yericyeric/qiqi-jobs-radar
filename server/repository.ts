import { Prisma } from "@prisma/client";
import { db } from "./db";
import type {
  RadarState,
  Profile,
  Job,
  Organization,
  Application,
  SearchRun,
  Action,
} from "../lib/contracts";
import { normalize, posting } from "../lib/engine";
import { refresh } from "../lib/state";
export const CANDIDATE_ID = "qiqi";
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
type Tx = Prisma.TransactionClient;
export async function readState(tx: Tx = db): Promise<RadarState> {
  const candidate = await tx.candidate.findUnique({
    where: { id: CANDIDATE_ID },
  });
  if (!candidate) throw new Error("DATABASE_NOT_SEEDED");
  const [jobs, organizations, history, applications, runs] = await Promise.all([
    tx.job.findMany({ orderBy: { discoveredAt: "desc" } }),
    tx.organization.findMany(),
    tx.userJobAction.findMany({
      where: { candidateId: CANDIDATE_ID },
      orderBy: [{ at: "asc" }, { id: "asc" }],
    }),
    tx.application.findMany({ where: { candidateId: CANDIDATE_ID } }),
    tx.searchRun.findMany({ orderBy: { at: "desc" }, take: 100 }),
  ]);
  return refresh({
    profile: candidate.profile as unknown as Profile,
    jobs: jobs.map((j) => j.details as unknown as Job),
    organizations: organizations.map(
      (o) => o.details as unknown as Organization,
    ),
    history: history.map((a) => ({
      jobId: a.jobId,
      action: a.action as Action,
      version: a.version,
      at: a.at.toISOString(),
    })),
    applications: applications.map((a) => a.details as unknown as Application),
    runs: runs.map((r) => r.details as unknown as SearchRun),
  });
}
export async function writeProfile(tx: Tx, profile: Profile) {
  await tx.candidate.upsert({
    where: { id: CANDIDATE_ID },
    create: { id: CANDIDATE_ID, name: profile.name, profile: json(profile) },
    update: { name: profile.name, profile: json(profile) },
  });
  await tx.candidateSkill.deleteMany({ where: { candidateId: CANDIDATE_ID } });
  await tx.candidateExperience.deleteMany({
    where: { candidateId: CANDIDATE_ID },
  });
  await tx.candidateEducation.deleteMany({
    where: { candidateId: CANDIDATE_ID },
  });
  await tx.candidateSkill.createMany({
    data: [...new Set(profile.skills)].map((name) => ({
      candidateId: CANDIDATE_ID,
      name,
    })),
  });
  await tx.candidateExperience.createMany({
    data: profile.experience.map((description) => ({
      candidateId: CANDIDATE_ID,
      description,
    })),
  });
  await tx.candidateEducation.createMany({
    data: profile.education.map((description) => ({
      candidateId: CANDIDATE_ID,
      description,
    })),
  });
}
export async function persist(tx: Tx, before: RadarState, next: RadarState) {
  if (JSON.stringify(before.profile) !== JSON.stringify(next.profile))
    await writeProfile(tx, next.profile);
  for (const o of next.organizations) {
    if (
      JSON.stringify(before.organizations.find((x) => x.id === o.id)) ===
      JSON.stringify(o)
    )
      continue;
    const data = {
      name: o.name,
      normalizedName: normalize(o.name),
      website: o.website,
      organizationType: o.type,
      city: o.city,
      county: o.county,
      lastCheckedForJobs: o.lastCheckedForJobs
        ? new Date(o.lastCheckedForJobs)
        : null,
      details: json(o),
    };
    await tx.organization.upsert({
      where: { id: o.id },
      create: { id: o.id, ...data },
      update: data,
    });
    await tx.organizationContact.deleteMany({
      where: { organizationId: o.id },
    });
    await tx.organizationAffiliation.deleteMany({
      where: { organizationId: o.id },
    });
    await tx.organizationSource.deleteMany({ where: { organizationId: o.id } });
    if (o.contactSource)
      await tx.organizationContact.create({
        data: {
          organizationId: o.id,
          details: json({
            email: o.publicEmail,
            phone: o.publicPhone,
            name: o.publicContactPerson,
            title: o.contactPersonTitle,
          }),
          sourceUrl: o.contactSource,
        },
      });
    if (o.affiliations.length)
      await tx.organizationAffiliation.createMany({
        data: o.affiliations.map((a) => ({ ...a, organizationId: o.id })),
      });
    await tx.organizationSource.createMany({
      data: [
        ...new Set(
          [
            o.website,
            o.contactSource,
            o.sizeSource,
            ...o.affiliations.map((a) => a.sourceUrl),
          ].filter(Boolean),
        ),
      ].map((url) => ({ organizationId: o.id, url })),
    });
  }
  for (const j of next.jobs) {
    if (
      JSON.stringify(before.jobs.find((x) => x.id === j.id)) ===
      JSON.stringify(j)
    )
      continue;
    const p = posting(j);
    const data = {
      companyId: j.organization.id,
      title: j.title,
      canonicalUrl: j.applyUrl || j.sources[0].url,
      location: j.location,
      county: j.organization.county,
      category: j.category,
      employmentType: j.employmentType,
      description: j.description,
      originalPostedAt: p && !p.estimated ? new Date(p.at) : null,
      estimatedPostedAt: p?.estimated ? new Date(p.at) : null,
      discoveredAt: new Date(j.discoveredAt),
      lastSeenAt: new Date(j.lastSeenAt),
      lastVerifiedAt: j.verification
        ? new Date(j.verification.checkedAt)
        : null,
      activeStatus: j.status,
      freshnessConfidence: p?.confidence || "Unknown",
      fitScore: j.score.total,
      requirementMatch: j.score.requirementMatch,
      isRepost: j.isRepost,
      version: j.version,
      details: json(j),
    };
    await tx.job.upsert({
      where: { id: j.id },
      create: { id: j.id, ...data },
      update: data,
    });
    await tx.jobSource.deleteMany({ where: { jobId: j.id } });
    await tx.jobRequirement.deleteMany({ where: { jobId: j.id } });
    await tx.jobSource.createMany({
      data: j.sources.map((s) => ({
        jobId: j.id,
        url: s.url,
        kind: s.kind,
        externalId: s.externalId || null,
        details: json(s),
      })),
    });
    await tx.jobRequirement.createMany({
      data: j.requirements.map((r) => ({ jobId: j.id, details: json(r) })),
    });
    await tx.jobScore.create({
      data: { jobId: j.id, total: j.score.total, details: json(j.score) },
    });
    const old = before.jobs.find((x) => x.id === j.id);
    if (
      j.verification &&
      JSON.stringify(old?.verification) !== JSON.stringify(j.verification)
    )
      await tx.jobVerification.create({
        data: {
          jobId: j.id,
          status: j.status,
          checkedAt: new Date(j.verification.checkedAt),
          details: json(j.verification),
        },
      });
  }
  for (const a of next.history.slice(before.history.length))
    await tx.userJobAction.create({
      data: {
        candidateId: CANDIDATE_ID,
        jobId: a.jobId,
        action: a.action,
        version: a.version,
        at: new Date(a.at),
      },
    });
  for (const a of next.applications) {
    if (
      JSON.stringify(before.applications.find((x) => x.jobId === a.jobId)) ===
      JSON.stringify(a)
    )
      continue;
    await tx.application.upsert({
      where: {
        candidateId_jobId: { candidateId: CANDIDATE_ID, jobId: a.jobId },
      },
      create: {
        candidateId: CANDIDATE_ID,
        jobId: a.jobId,
        stage: a.stage,
        details: json(a),
      },
      update: { stage: a.stage, details: json(a) },
    });
  }
  for (const r of next.runs.filter(
    (r) => !before.runs.some((x) => x.id === r.id),
  ))
    await tx.searchRun.create({
      data: {
        id: r.id,
        source: r.source,
        query: r.query,
        at: new Date(r.at),
        details: json(r),
      },
    });
}
export async function mutate(
  fn: (s: RadarState) => RadarState,
): Promise<RadarState> {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(719248)::text`;
      const before = await readState(tx),
        next = fn(structuredClone(before));
      await persist(tx, before, next);
      return next;
    },
    { maxWait: 10000, timeout: 30000 },
  );
}
