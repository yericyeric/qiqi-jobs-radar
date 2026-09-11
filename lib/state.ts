import {
  type RadarState,
  type JobInput,
  type Job,
  type Action,
  type Application,
  stages,
} from "./contracts";
import {
  duplicate,
  mergeJob,
  scoreJob,
  verify,
  learnedPreferences,
  ageHours,
  normalize,
} from "./engine";
export function refresh(state: RadarState, now = Date.now()): RadarState {
  // One-time upgrade: retain existing profile facts and local records.
  if (state.profile.locationVersion !== 2) {
    state = {
      ...state,
      profile: {
        ...state.profile,
        locationVersion: 2,
        counties: [
          ...new Set([...state.profile.counties, "Charleston" as const]),
        ],
      },
    };
  }
  state = {
    ...state,
    jobs: state.jobs.map((j) => ({
      ...j,
      organization:
        state.organizations.find((o) => o.id === j.organization.id) ||
        j.organization,
    })),
  };
  const prefs = learnedPreferences(state.history, state.jobs);
  return {
    ...state,
    jobs: state.jobs.map((j) => {
      const last = [...state.history]
        .reverse()
        .find(
          (a) =>
            a.jobId === j.id &&
            a.version === j.version &&
            ["Report Closed", "Expired"].includes(a.action),
        );
      const status = last
        ? last.action === "Expired"
          ? "EXPIRED"
          : "CLOSED"
        : verify(j.verification, now);
      return {
        ...j,
        status:
          j.isRepost && !["CLOSED", "EXPIRED"].includes(status)
            ? "REPOSTED"
            : status,
        score: scoreJob(j, state.profile, now, prefs),
      };
    }),
  };
}
export function importJobs(
  state: RadarState,
  inputs: JobInput[],
  now = Date.now(),
): RadarState {
  const next: RadarState = structuredClone(state);
  let duplicates = 0;
  for (const input of inputs) {
    const oi = next.organizations.findIndex(
      (o) => normalize(o.name) === normalize(input.organization.name),
    );
    const organization =
      oi >= 0
        ? { ...input.organization, id: next.organizations[oi].id }
        : input.organization;
    if (oi >= 0) next.organizations[oi] = organization;
    else next.organizations.push(organization);
    const record = { ...input, organization };
    const index = next.jobs.findIndex((j) => duplicate(j, record));
    if (index >= 0) {
      next.jobs[index] = mergeJob(next.jobs[index], record, next.profile, now);
      duplicates++;
    } else
      next.jobs.push({
        ...record,
        id: crypto.randomUUID(),
        discoveredAt: new Date(now).toISOString(),
        lastSeenAt: new Date(now).toISOString(),
        status: verify(record.verification, now),
        isRepost: false,
        score: scoreJob(record, next.profile, now),
        version: 1,
      });
  }
  const evaluated = inputs.map((j) => ({
    j,
    score: scoreJob(j, next.profile, now),
  }));
  next.runs.unshift({
    id: crypto.randomUUID(),
    at: new Date(now).toISOString(),
    source: "Manual import",
    query: "User-provided source records",
    found: inputs.length,
    accepted: evaluated.filter((x) => !x.score.rejection).length,
    duplicates,
    closed: inputs.filter((j) =>
      ["CLOSED", "EXPIRED"].includes(verify(j.verification, now)),
    ).length,
    fresh: inputs.filter((j) => ageHours(j, now) <= 48).length,
    highFit: evaluated.filter((x) => x.score.total >= 80).length,
    rejections: evaluated
      .filter((x) => x.score.rejection)
      .map((x) => ({ title: x.j.title, reason: x.score.rejection! })),
  });
  return refresh(next, now);
}
export function emptyApplication(
  j: Job,
  stage: Application["stage"],
): Application {
  return {
    jobId: j.id,
    stage,
    dateApplied: "",
    resumeVersion: "",
    coverLetter: "",
    applicationUrl: j.applyUrl,
    contact: "",
    followUpDate: "",
    notes: "",
  };
}
export function act(
  state: RadarState,
  jobId: string,
  action: Action,
  now = Date.now(),
): RadarState {
  const j = state.jobs.find((j) => j.id === jobId);
  if (!j) throw new Error("Job not found");
  const next = structuredClone(state);
  next.history.push({
    jobId,
    action,
    at: new Date(now).toISOString(),
    version: j.version,
  });
  if ((stages as readonly string[]).includes(action)) {
    const stage = action as Application["stage"];
    const index = next.applications.findIndex((a) => a.jobId === jobId);
    const app =
      index >= 0
        ? { ...next.applications[index], stage }
        : emptyApplication(j, stage);
    if (action === "Applied" && !app.dateApplied)
      app.dateApplied = new Date(now).toISOString().slice(0, 10);
    if (index >= 0) next.applications[index] = app;
    else next.applications.push(app);
  }
  return refresh(next, now);
}
