import type { Profile } from "./contracts";

// Each family counts once, regardless of keyword repetition. Supporting skills
// improve an already career-related job; they never bypass the career gate.
const families = [
  { label: "Stage operations & rehearsals", pattern: /stage ?hand|stage manag|backstage|run.of.show|rehearsal|managing cues/i, roles: ["stagehand", "assistant stage manager"] },
  { label: "Concert & live production", pattern: /concert|live.event|live entertainment|show execution/i, roles: ["event coordinator", "concert production assistant"] },
  { label: "Production planning & logistics", pattern: /pre.production|production (?:assist|coordinat|planning|support)|event logistics|on.site operations/i, roles: ["production assistant", "production coordinator"] },
  { label: "Video editing & promotional content", pattern: /video editing|edit(?:ed|ing)?[^.!?]{0,35}video|promotional video|trailers?|post.production/i, roles: ["video editor", "content producer"] },
  { label: "Television, radio & broadcasting", pattern: /television|\btv\b|\bradio\b|broadcast|journalism/i, roles: ["broadcast production assistant", "radio production assistant"] },
  { label: "Content & media planning", pattern: /content planning|media planning|editorial calendar|promotional direction|content strategy/i, roles: ["content coordinator", "media planning assistant"] },
  { label: "Art direction", pattern: /art direction|artistic direction|creative direction/i, roles: ["creative production assistant"] },
  { label: "Dance & performing arts", pattern: /\bdance\b|performing arts|choreograph/i, roles: ["performing arts coordinator"] },
  { label: "Teaching support", pattern: /teaching assistant|classroom assistant|teaching support/i, roles: ["performing arts teaching assistant"] },
  { label: "Production meetings & team communication", pattern: /meeting facilitation|facilitat[^.!?]{0,35}meeting|production meetings|cross.functional|communication between/i, roles: [] },
  { label: "Budget planning & forecasting", pattern: /budget(?:ing|s| priorities)?|forecast(?:ing)?/i, roles: [] },
  { label: "Performance attribution", pattern: /performance attribution|campaign attribution|marketing attribution/i, roles: [] },
  { label: "Microsoft Office", pattern: /microsoft office|\bexcel\b|\bpowerpoint\b|\boutlook\b/i, roles: [] },
  { label: "Mandarin — proficiency needs confirmation", pattern: /mandarin/i, roles: [] },
  { label: "English — proficiency needs confirmation", pattern: /\benglish\b/i, roles: [] },
];

export function profileEvidence(profile: Profile) {
  return [...profile.skills, ...profile.experience, ...profile.education].join("\n");
}

export function skillMatches(description: string, profile: Profile) {
  const evidence = profileEvidence(profile);
  const duties = description.split(/[.!?\n]+/).filter(s =>
    !/\b(?:no|not)\s+(?:prior\s+)?[^,;]{0,45}(?:required|needed|necessary)\b/i.test(s),
  ).join("\n");
  return families.filter(f => f.pattern.test(evidence) && f.pattern.test(duties))
    .map(f => f.label);
}

export function searchRoles(profile: Profile): string[] {
  const evidence = profileEvidence(profile);
  const roles = families.filter(f => f.pattern.test(evidence)).flatMap(f => f.roles);
  return [...new Set(roles.length ? roles : ["production assistant"])];
}
