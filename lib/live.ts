import { z } from "zod";
import { aiReviewSchema, aiStateSchema, planSchema } from "./ai-review";
import {
  jobInputSchema,
  profileSchema,
  type RadarState,
  type Job,
} from "./contracts";
import { sampleProfile } from "./sample";
import { refresh } from "./state";
import { scoreJob, verify } from "./engine";

export const feedRecordSchema = z.object({
  id: z.string().min(1).max(160),
  board: z.string().min(1),
  discoveredAt: z.iso.datetime({ offset: true }),
  input: jobInputSchema.refine(
    (j) => !j.isDemo && !j.organization.isDemo,
    "Real jobs only",
  ),
});
export const feedSchema = z.object({
  version: z.literal(1),
  attemptedAt: z.iso.datetime({ offset: true }),
  lastSuccessfulAt: z.iso.datetime({ offset: true }).nullable(),
  sources: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      url: z.string().url(),
      ok: z.boolean(),
      count: z.number(),
      error: z.string(),
      lastSuccessfulAt: z.iso.datetime({ offset: true }).nullable(),
      mode: z
        .enum(["live", "cached", "needs_key", "error", "quota"])
        .optional(),
      checkedAt: z.iso.datetime({ offset: true }).nullable().optional(),
      nextCheckAt: z.iso.datetime({ offset: true }).nullable().optional(),
      examined: z.number().optional(),
      rejected: z.number().optional(),
      note: z.string().optional(),
    }),
  ),
  jobs: z.array(feedRecordSchema),
  aiReviews: z.array(aiReviewSchema).default([]),
  aiState: aiStateSchema.nullable().default(null),
  searchPlan: planSchema.nullable().default(null),
  searchState: z
    .object({
      windowStartedAt: z.iso.datetime({ offset: true }),
      used: z.number().int().min(0),
      queryIndex: z.number().int().min(0),
    })
    .nullable()
    .default(null),
  leads: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string(),
        snippet: z.string(),
        foundAt: z.iso.datetime({ offset: true }),
        market: z.enum(["miami", "charleston"]),
      }),
    )
    .default([]),
});
export type LiveFeed = z.infer<typeof feedSchema>;
export function emptyLiveState(): RadarState {
  return {
    profile: structuredClone(sampleProfile),
    jobs: [],
    organizations: [],
    history: [],
    applications: [],
    runs: [],
  };
}
export function migrateLegacyState(legacy: RadarState): RadarState {
  const profile = profileSchema.parse(legacy.profile);
  const jobs = legacy.jobs.filter((j) => !j.isDemo && !j.organization.isDemo);
  const ids = new Set(jobs.map((j) => j.id));
  return {
    profile,
    jobs,
    organizations: legacy.organizations.filter((o) => !o.isDemo),
    history: legacy.history.filter((h) => ids.has(h.jobId)),
    applications: legacy.applications.filter((a) => ids.has(a.jobId)),
    runs: [],
  };
}
// Only public job facts arrive from GitHub. Private notes and actions stay local.
export function mergeLiveFeed(
  state: RadarState,
  feed: LiveFeed,
  now = Date.now(),
): RadarState {
  const incoming = new Set(feed.jobs.map((r) => r.id));
  const jobs: Job[] = feed.jobs.map((r) => {
    const old = state.jobs.find((j) => j.id === r.id);
    const input = structuredClone(r.input);
    // Keep the earliest known publication for a stable ATS ID, even when re-released.
    if (old) {
      for (const source of input.sources) {
        const prior = old.sources.find(
          (s) => s.externalId === source.externalId && s.name === source.name,
        );
        if (
          prior?.originalPostedAt &&
          (!source.originalPostedAt ||
            Date.parse(prior.originalPostedAt) <
              Date.parse(source.originalPostedAt))
        )
          source.originalPostedAt = prior.originalPostedAt;
      }
    }
    return {
      ...input,
      id: r.id,
      discoveredAt: old?.discoveredAt || r.discoveredAt,
      lastSeenAt: input.verification?.checkedAt || r.discoveredAt,
      version: old?.version || 1,
      isRepost: false,
      status: verify(input.verification, now),
      score: scoreJob(input, state.profile, now),
      aiReview: feed.aiReviews.find(a => a.jobId === r.id),
    };
  });
  // A disappeared record is retained for the user's tracker, without claiming it is live.
  for (const old of state.jobs.filter((j) => !j.isDemo && !incoming.has(j.id)))
    jobs.push(
      old.id.startsWith("ats:") &&
        !old.verification?.closed &&
        !old.verification?.expired
        ? { ...old, verification: null }
        : old,
    );
  const organizations = [
    ...new Map(
      [
        ...state.organizations.filter((o) => !o.isDemo),
        ...jobs.map((j) => j.organization),
      ].map((o) => [o.id, o]),
    ).values(),
  ];
  return refresh({ ...state, jobs, organizations }, now);
}
