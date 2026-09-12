import type {
  Job,
  JobInput,
  Profile,
  Source,
  Verification,
  Status,
  Score,
  Organization,
  History,
} from "./contracts";
const HOUR = 3600000;
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const trust: Record<Source["kind"], number> = {
  EMPLOYER: 0,
  ATS: 1,
  LINKEDIN: 2,
  BOARD: 3,
  AGGREGATOR: 4,
  MANUAL: 5,
};
export function posting(j: Pick<JobInput, "sources">, now = Date.now()) {
  const original = j.sources.filter(
    (s) => s.originalPostedAt && Date.parse(s.originalPostedAt) <= now,
  );
  original.sort(
    (a, b) =>
      trust[a.kind] - trust[b.kind] ||
      Date.parse(a.originalPostedAt!) - Date.parse(b.originalPostedAt!),
  );
  const s = original[0];
  if (s)
    return {
      at: s.originalPostedAt!,
      confidence: trust[s.kind] < 2 ? "High" : "Medium",
      source: s.url,
      estimated: false,
    };
  const e = j.sources
    .filter(
      (s) => s.estimatedPostedAt && Date.parse(s.estimatedPostedAt) <= now,
    )
    .sort((a, b) => trust[a.kind] - trust[b.kind])[0];
  return e
    ? {
        at: e.estimatedPostedAt!,
        confidence: "Low",
        source: e.url,
        estimated: true,
      }
    : null;
}
export function ageHours(j: Pick<JobInput, "sources">, now = Date.now()) {
  const p = posting(j, now);
  return p ? (now - Date.parse(p.at)) / HOUR : Infinity;
}
export function freshness(j: Pick<JobInput, "sources">, now = Date.now()) {
  const a = ageHours(j, now);
  return !Number.isFinite(a)
    ? "Date unknown"
    : a < 12
      ? "Just posted"
      : a < 24
        ? "New"
        : a <= 48
          ? "Recent"
          : a <= 168
            ? "Still worth applying"
            : "Older";
}
export function verify(v: Verification | null, now = Date.now()): Status {
  if (!v || Date.parse(v.checkedAt) > now) return "UNKNOWN";
  if (v.closed || v.httpStatus === 404 || v.httpStatus === 410) return "CLOSED";
  if (v.expired) return "EXPIRED";
  if (now - Date.parse(v.checkedAt) > 24 * HOUR) return "UNKNOWN";
  if (!v.pageLoads || v.httpStatus === null || v.httpStatus >= 400)
    return "UNKNOWN";
  // An API listing and link do not prove the external application form works.
  if (v.method === "AUTOMATED_ATS")
    return v.jobIdExists && v.listedByEmployer && v.applyExists
      ? "LIKELY_ACTIVE"
      : "UNKNOWN";
  if (
    v.sourceKind !== "OTHER" &&
    v.jobIdExists &&
    v.applyExists &&
    v.listedByEmployer
  )
    return "ACTIVE";
  return v.applyExists ? "LIKELY_ACTIVE" : "UNKNOWN";
}
import { careerRelated } from "./career";
import { skillMatches } from "./fit-skills";
const signals = [
  {
    pattern:
      /live event|live entertainment|show execution|concert|backstage|stagehand|stage management/i,
    skills: /stage|live.event|show|backstage/i,
    label: "Live entertainment & stage experience",
  },
  {
    pattern:
      /event operations|event logistics|event production|registration|conference|venue operations/i,
    skills: /event|logistics|venue/i,
    label: "Event operations & logistics",
  },
  {
    pattern:
      /production coordinat|production support|production assistant|production office|crew|run.of.show/i,
    skills: /production|coordination/i,
    label: "Production coordination",
  },
  {
    pattern:
      /video|broadcast|media production|content production|editing|journalism/i,
    skills: /video|broadcast|media|content|editing|journalism/i,
    label: "Broadcast & media background",
  },
  {
    pattern:
      /cross.functional|team coordination|coordinate.*teams|scheduling|vendor|artist relations/i,
    skills: /coordination|teams|logistics|production/i,
    label: "Coordination across teams",
  },
  {
    pattern:
      /cultural program|performing arts|festival|arts program|museum program|brand activation|experiential/i,
    skills: /event|entertainment|production/i,
    label: "Live programming & event support",
  },
];
export function scoreJob(
  j: JobInput,
  profile: Profile,
  now = Date.now(),
  preferences: Record<string, number> = {},
): Score {
  const desc = j.description,
    title = j.title,
    text = title + " " + desc;
  let rejection: string | null = careerRelated(j, profile)
    ? null
    : "CAREER_UNRELATED";
  const meaningful = signals.filter((x) => x.pattern.test(desc));
  if (
    /manufactur|food factory|warehouse production|industrial production|pharmaceutical|assembly line/i.test(
      text,
    ) &&
    !/live event|event operations|event logistics|video production|broadcast|media production|content production|stage management/i.test(
      desc,
    )
  )
    rejection = "MANUFACTURING_PRODUCTION";
  if (
    /door.to.door|commission.only|multi.level marketing|pay.*(?:application|training)|street sales|applicant.*(?:fee|payment)/i.test(
      text,
    )
  )
    rejection = "SALES_DISGUISED_AS_EVENT_ROLE";
  const local = profile.counties.includes(
    j.organization.county as Profile["counties"][number],
  );
  const remote =
    j.organization.county === "Remote" &&
    profile.remote &&
    /media|content production|entertainment|event operations|production coordinat|broadcast|video/i.test(
      desc,
    );
  if (
    !local &&
    !remote &&
    !(j.organization.county === "South Florida" && meaningful.length >= 2)
  )
    rejection = "OUTSIDE_LOCATION";
  const senior =
    /senior|director|\bvp\b|head of/i.test(title) ||
    /\b(?:[8-9]|[1-9]\d)\+?\s*years/i.test(desc);
  const profileText = [
    ...profile.skills,
    ...profile.experience,
    ...profile.education,
  ].join(" ");
  const overlap = meaningful.filter((x) => x.skills.test(profileText));
  const specific = skillMatches(desc, profile);
  const components: Record<string, number> = {
    "Career relevance": meaningful.length
      ? Math.min(35, 15 + meaningful.length * 7)
      : careerRelated(j, profile)
        ? 10
        : 0,
    "Responsibility overlap": Math.min(25, overlap.length * 4 + specific.length * 3),
    "Career level": senior
      ? 0
      : /assistant|coordinator|associate|junior|stagehand|technician|specialist/i.test(
            title,
          )
        ? 15
        : 7,
    Freshness:
      ageHours(j, now) <= 24
        ? 10
        : ageHours(j, now) <= 48
          ? 8
          : ageHours(j, now) <= 168
            ? 4
            : 0,
    "Organization fit":
      /event|production|cultur|media|experiential|venue|theat|museum|entertainment|arts/i.test(
        j.organization.type,
      )
        ? 5
        : 0,
    Actionability: j.applyUrl
      ? 5
      : j.organization.careersUrl
        ? 3
        : j.organization.publicEmail
          ? 2
          : 0,
    "Local opportunity": local ? (j.organization.size === "Small" ? 5 : 3) : 0,
  };
  const impossible = j.requirements.some(
    (r) => r.required && r.assessment === "IMPOSSIBLE",
  );
  if (impossible) rejection = "NOT_ELIGIBLE";
  const assessment = impossible
    ? "NOT_ELIGIBLE"
    : senior
      ? "LONG_SHOT"
      : !j.requirements.length ||
          j.requirements.some(
            (r) => r.assessment === "GAP" || r.assessment === "UNKNOWN",
          )
        ? "STRETCH"
        : "MATCH";
  const learned = Math.max(-3, Math.min(3, preferences[j.category] || 0));
  let total = Math.max(
    0,
    Math.min(
      100,
      Object.values(components).reduce((a, b) => a + b, 0) + learned,
    ),
  );
  if (!meaningful.length) total = Math.min(total, specific.length ? 60 : 45);
  // A seniority gap cannot produce a reassuring Strong/Exceptional label.
  if (senior) total = Math.min(total, 69);
  if (rejection) total = Math.min(total, 15);
  if (!rejection && total < 15) rejection = "LOW_FIT";
  return {
    total,
    label:
      total >= 90
        ? "Exceptional Match"
        : total >= 80
          ? "Strong Match"
          : total >= 70
            ? "Good Match"
            : total >= 15
              ? "Possible fit"
              : "Low fit",
    components,
    reasons: [...specific, ...overlap.map((x) => x.label)],
    rejection,
    requirementMatch: assessment,
  };
}
export function canonicalUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const k of [...u.searchParams.keys()])
      if (/^(utm_|ref$|source$|tracking)/i.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    return u.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}
export function similarity(a: string, b: string) {
  const x = new Set(normalize(a).split(" ")),
    y = new Set(normalize(b).split(" "));
  return [...x].filter((v) => y.has(v)).length / new Set([...x, ...y]).size;
}
export function duplicate(a: JobInput, b: JobInput) {
  if (normalize(a.organization.name) !== normalize(b.organization.name))
    return false;
  if (
    a.applyUrl &&
    b.applyUrl &&
    canonicalUrl(a.applyUrl) === canonicalUrl(b.applyUrl)
  )
    return true;
  if (
    a.sources.some(
      (s) =>
        s.externalId &&
        b.sources.some(
          (t) => s.externalId === t.externalId && s.name === t.name,
        ),
    )
  )
    return true;
  return (
    normalize(a.title) === normalize(b.title) &&
    normalize(a.location) === normalize(b.location) &&
    similarity(a.description, b.description) >= 0.8
  );
}
export function mergeJob(
  old: Job,
  input: JobInput,
  profile: Profile,
  now = Date.now(),
): Job {
  const sources = [...old.sources];
  for (const s of input.sources)
    if (
      !sources.some(
        (t) =>
          t.url === s.url &&
          t.originalPostedAt === s.originalPostedAt &&
          t.estimatedPostedAt === s.estimatedPostedAt,
      )
    )
      sources.push(s);
  const before = posting(old, now),
    after = posting(input, now);
  const material = similarity(old.description, input.description) < 0.8;
  const repost =
    !material &&
    !!before &&
    !!after &&
    Date.parse(after.at) - Date.parse(before.at) > 24 * HOUR;
  const merged = {
    ...old,
    ...input,
    id: old.id,
    discoveredAt: old.discoveredAt,
    sources,
    verification: input.verification || old.verification,
    version: old.version + (material ? 1 : 0),
    isRepost: material ? false : old.isRepost || repost,
    lastSeenAt: new Date(now).toISOString(),
  };
  const status = verify(merged.verification, now);
  return {
    ...merged,
    status:
      merged.isRepost && ["ACTIVE", "LIKELY_ACTIVE", "UNKNOWN"].includes(status)
        ? "REPOSTED"
        : status,
    score: scoreJob(merged, profile, now),
  };
}
export function latestAction(history: History[], j: Job) {
  return [...history]
    .reverse()
    .find((a) => a.jobId === j.id && a.version === j.version);
}
export function dismissed(history: History[], j: Job) {
  const a = latestAction(history, j);
  return !!a && ["Dismiss", "False Match"].includes(a.action);
}
export function learnedPreferences(history: History[], jobs: Job[]) {
  const weights: Record<string, number> = {};
  for (const a of history) {
    const j = jobs.find((j) => j.id === a.jobId);
    if (j)
      weights[j.category] =
        (weights[j.category] || 0) +
        (["Saved", "Applied"].includes(a.action)
          ? 0.5
          : ["Dismiss", "False Match"].includes(a.action)
            ? -0.5
            : 0);
  }
  return weights;
}
export function alertEligible(
  j: Job,
  history: History[],
  alerted: Set<string>,
  now = Date.now(),
) {
  return (
    !j.isDemo &&
    j.score.total >= 75 &&
    ageHours(j, now) <= 48 &&
    !posting(j, now)?.estimated &&
    ["ACTIVE", "LIKELY_ACTIVE"].includes(j.status) &&
    ["ACTIVE", "LIKELY_ACTIVE"].includes(verify(j.verification, now)) &&
    !j.isRepost &&
    !dismissed(history, j) &&
    !alerted.has(j.id) &&
    !!j.applyUrl
  );
}
export function affiliation(o: Organization) {
  return o.affiliations.filter(
    (a) =>
      a.publiclyExplicit &&
      a.evidence.length >= 15 &&
      /^https?:/.test(a.sourceUrl),
  );
}
export function outreachScore(o: Organization) {
  return Math.min(
    100,
    (/event|production|arts|cultural|media|venue/i.test(o.type) ? 45 : 15) +
      (o.size === "Small" ? 15 : 5) +
      (o.publicEmail ? 15 : o.contactUrl ? 10 : 0) +
      (affiliation(o).length ? 10 : 0) +
      (["Miami-Dade", "Broward", "Charleston"].includes(o.county) ? 15 : 0),
  );
}
