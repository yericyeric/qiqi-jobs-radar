import { z } from "zod";
export const categories = [
  "Production",
  "Events",
  "Venue",
  "Stage",
  "Broadcast",
  "Media",
  "Content",
  "Experiential",
  "Cultural",
  "Programs",
] as const;
export const stages = [
  "Saved",
  "Planning to Apply",
  "Applied",
  "Follow-up Due",
  "Interview",
  "Rejected",
  "Offer",
  "Closed",
] as const;
export const actions = [
  ...stages,
  "Dismiss",
  "False Match",
  "Report Closed",
  "Expired",
] as const;
export type Action = (typeof actions)[number];
export type Stage = (typeof stages)[number];
export const safeUrl = z
  .string()
  .url()
  .max(2048)
  .refine((v) => /^https?:\/\//i.test(v), "Use an http or https URL");
const optionalUrl = z.union([safeUrl, z.literal("")]).default("");
const date = z.iso.datetime({ offset: true });
export const sourceSchema = z.object({
  name: z.string().min(1).max(120),
  url: safeUrl,
  kind: z.enum([
    "EMPLOYER",
    "ATS",
    "LINKEDIN",
    "BOARD",
    "AGGREGATOR",
    "MANUAL",
  ]),
  externalId: z.string().max(160).default(""),
  originalPostedAt: date.nullable().default(null),
  sourcePostedText: z.string().max(200).default(""),
  estimatedPostedAt: date.nullable().default(null),
  capturedAt: date,
  evidence: z.string().max(5000).default(""),
});
export const verificationSchema = z.object({
  checkedAt: date,
  sourceUrl: safeUrl,
  sourceKind: z.enum(["EMPLOYER", "ATS", "OTHER"]),
  pageLoads: z.boolean(),
  jobIdExists: z.boolean(),
  applyExists: z.boolean(),
  listedByEmployer: z.boolean(),
  httpStatus: z.number().int().min(100).max(599).nullable().default(null),
  closed: z.boolean().default(false),
  expired: z.boolean().default(false),
  method: z
    .enum(["MANUAL", "AUTOMATED_ATS", "AUTOMATED_BOARD"])
    .default("MANUAL"),
  notes: z.string().max(2000).default(""),
});
export const affiliationSchema = z.object({
  label: z.enum(["Chinese-affiliated", "China-related", "Asian-affiliated"]),
  evidence: z.string().min(15).max(3000),
  sourceUrl: safeUrl,
  publiclyExplicit: z.literal(true),
});
export const organizationSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(2).max(150),
    website: safeUrl,
    type: z.string().min(2).max(120),
    city: z.string().max(100),
    county: z.enum([
      "Miami-Dade",
      "Broward",
      "Palm Beach",
      "South Florida",
      "Charleston",
      "Remote",
      "Other",
    ]),
    careersUrl: optionalUrl,
    contactUrl: optionalUrl,
    publicEmail: z.union([z.email(), z.literal("")]).default(""),
    publicPhone: z.string().max(80).default(""),
    publicContactPerson: z.string().max(120).default(""),
    contactPersonTitle: z.string().max(120).default(""),
    contactSource: optionalUrl,
    size: z.enum(["Small", "Medium", "Large", "Unknown"]).default("Unknown"),
    sizeSource: optionalUrl,
    affiliations: z.array(affiliationSchema).max(10).default([]),
    notes: z.string().max(5000).default(""),
    isDemo: z.boolean().default(false),
    lastCheckedForJobs: date.nullable().default(null),
  })
  .superRefine((o, ctx) => {
    if (
      (o.publicEmail || o.publicPhone || o.publicContactPerson) &&
      !o.contactSource
    )
      ctx.addIssue({
        code: "custom",
        message: "Public contacts need a source URL",
        path: ["contactSource"],
      });
    if (o.size !== "Unknown" && !o.sizeSource)
      ctx.addIssue({
        code: "custom",
        message: "Known size needs a source URL",
        path: ["sizeSource"],
      });
  });
export const requirementSchema = z.object({
  text: z.string().min(1).max(1000),
  required: z.boolean(),
  assessment: z
    .enum(["MET", "GAP", "UNKNOWN", "IMPOSSIBLE"])
    .default("UNKNOWN"),
  sourceUrl: safeUrl,
});
export const jobInputSchema = z
  .object({
    title: z.string().min(3).max(180),
    organization: organizationSchema,
    location: z.string().min(2).max(180),
    category: z.enum(categories),
    employmentType: z.enum([
      "Full-time",
      "Part-time",
      "Temporary",
      "Seasonal",
      "Contract",
      "Internship",
      "Unknown",
    ]),
    description: z.string().min(30).max(50000),
    applyUrl: optionalUrl,
    salary: z.string().max(200).default(""),
    salarySource: optionalUrl,
    sources: z.array(sourceSchema).min(1).max(20),
    requirements: z.array(requirementSchema).max(50).default([]),
    verification: verificationSchema.nullable().default(null),
    isDemo: z.boolean().default(false),
  })
  .superRefine((j, ctx) => {
    if (j.salary && !j.salarySource)
      ctx.addIssue({
        code: "custom",
        message: "Salary needs a source URL",
        path: ["salarySource"],
      });
  });
export const profileSchema = z.object({
  name: z.string().min(2).max(120),
  headline: z.string().max(300),
  skills: z.array(z.string().min(1).max(120)).max(100),
  education: z.array(z.string().min(1).max(300)).max(20),
  experience: z.array(z.string().min(1).max(1000)).max(50),
  counties: z
    .array(z.enum(["Miami-Dade", "Broward", "Palm Beach", "Charleston"]))
    .min(1),
  locationVersion: z.literal(2).optional(),
  skillsVersion: z.union([z.literal(1), z.literal(2)]).optional(),
  remote: z.boolean(),
  notes: z.string().max(5000),
});
export type Profile = z.infer<typeof profileSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type JobInput = z.infer<typeof jobInputSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Verification = z.infer<typeof verificationSchema>;
export type Status =
  "ACTIVE" | "LIKELY_ACTIVE" | "REPOSTED" | "EXPIRED" | "CLOSED" | "UNKNOWN";
export type Score = {
  total: number;
  label: string;
  components: Record<string, number>;
  reasons: string[];
  rejection: string | null;
  requirementMatch: "MATCH" | "STRETCH" | "LONG_SHOT" | "NOT_ELIGIBLE";
};
export type Job = JobInput & {
  id: string;
  discoveredAt: string;
  lastSeenAt: string;
  status: Status;
  isRepost: boolean;
  score: Score;
  version: number;
};
export type History = {
  jobId: string;
  action: Action;
  at: string;
  version: number;
};
export type Application = {
  jobId: string;
  stage: Stage;
  dateApplied: string;
  resumeVersion: string;
  coverLetter: string;
  applicationUrl: string;
  contact: string;
  followUpDate: string;
  notes: string;
};
export type SearchRun = {
  id: string;
  at: string;
  source: string;
  query: string;
  found: number;
  accepted: number;
  duplicates: number;
  closed: number;
  fresh: number;
  highFit: number;
  rejections: { title: string; reason: string }[];
};
export type RadarState = {
  profile: Profile;
  jobs: Job[];
  organizations: Organization[];
  history: History[];
  applications: Application[];
  runs: SearchRun[];
};
export const applicationSchema = z.object({
  jobId: z.string().min(1),
  stage: z.enum(stages),
  dateApplied: z.union([z.iso.date(), z.literal("")]),
  resumeVersion: z.string().max(300),
  coverLetter: z.string().max(10000),
  applicationUrl: optionalUrl,
  contact: z.string().max(500),
  followUpDate: z.union([z.iso.date(), z.literal("")]),
  notes: z.string().max(10000),
});
