import { z } from "zod";
export const planSchema = z.object({
  attemptedAt: z.iso.datetime({offset:true}), city: z.enum(["miami", "charleston"]),
  query: z.string().max(100), history: z.array(z.string().max(100)).max(20),
  day: z.string(), used: z.number().int().nonnegative(),
});
export type SearchPlan = z.infer<typeof planSchema>;

export const aiOpinionSchema = z.object({
  summary: z.string().min(10).max(700),
  strengths: z.array(z.string().min(5).max(350)).max(4),
  questions: z.array(z.string().min(5).max(350)).min(1).max(4),
  nextStep: z.string().min(5).max(400),
}).strict();
export const aiReviewSchema = aiOpinionSchema.extend({
  jobId: z.string(), fingerprint: z.string(), model: z.string(),
  reviewedAt: z.iso.datetime({ offset: true }),
});
export type AiReview = z.infer<typeof aiReviewSchema>;
export const aiStateSchema = z.object({
  revision: z.string().optional(),
  day: z.string(), used: z.number().int().nonnegative(),
  retryAfter: z.iso.datetime({ offset: true }).nullable(),
  status: z.enum(["ready", "needs_key", "quota", "error"]),
  message: z.string().max(200),
});

// Deliberately curated instead of copying profile fields. Browser notes, actions,
// names, employers, dates, education and distinctive audience metrics never enter.
export const anonymousCareer = {
  skills: ["Stage management", "Stagehand work", "Event operations", "Concert production", "Pre-production planning", "Production coordination", "Event logistics", "Video editing", "Television", "Radio", "Broadcasting", "Content planning", "Media planning", "Art direction", "Dance", "Entertainment management", "Meeting facilitation", "Budget planning and forecasting", "Program budgeting", "Performance attribution", "Microsoft Office", "English", "Mandarin"],
  experience: [
    "Supported concert planning, logistics and on-site operations.",
    "Facilitated production meetings and communication across creative, technical and administrative teams.",
    "Coordinated artistic, marketing and budget priorities with other departments.",
    "Supported stage management during rehearsals and live shows, including cues and transitions.",
    "Worked as stagehand, stage manager and teaching assistant.",
    "Planned, produced and edited promotional videos and trailers for television during production and broadcast.",
  ],
  targets: ["Events", "Live entertainment", "Production support", "Broadcasting", "Media and content", "Related performing arts support"],
  unknown: "Language proficiency, years of experience, certifications, software proficiency and work authorization are not established. Do not infer them.",
};
