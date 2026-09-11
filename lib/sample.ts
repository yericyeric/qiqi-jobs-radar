import {
  jobInputSchema,
  organizationSchema,
  type Profile,
  type RadarState,
  type JobInput,
} from "./contracts";
import { scoreJob, verify } from "./engine";
export const sampleProfile: Profile = {
  name: "Qiqi Su",
  headline: "Live entertainment, events & media production",
  education: [
    "Master of Arts in Live Entertainment Management",
    "Bachelor of Arts in Broadcast Journalism",
  ],
  skills: [
    "Stage management",
    "Stagehand work",
    "Production assistance",
    "Live-event production support",
    "Event operations",
    "Show execution",
    "Production coordination",
    "Media production",
    "Broadcast journalism",
    "Video editing",
    "Coordination across teams",
    "Event logistics",
    "Backstage experience",
  ],
  experience: [
    "Stage management and live-event production support",
    "Production assistance, event operations and logistics",
    "Media/content production and video editing",
  ],
  counties: ["Miami-Dade", "Broward", "Charleston"],
  locationVersion: 2,
  remote: true,
  notes:
    "Employers, dates, software, certifications, languages and years of experience have not been provided.",
};
export function makeSample(now = Date.now()): RadarState {
  const ago = (h: number) => new Date(now - h * 3600000).toISOString();
  const org = (
    id: string,
    name: string,
    type: string,
    city: string,
    county: "Miami-Dade" | "Broward" | "Charleston",
    size: "Small" | "Medium" = "Small",
  ) =>
    organizationSchema.parse({
      id,
      name,
      type,
      city,
      county,
      size,
      sizeSource: `https://example.com/${id}/about`,
      website: `https://example.com/${id}`,
      contactUrl: `https://example.com/${id}/contact`,
      careersUrl: `https://example.com/${id}/careers`,
      isDemo: true,
    });
  const organizations = [
    org(
      "o1",
      "Daylight Live Studio",
      "Independent production company",
      "Miami",
      "Miami-Dade",
    ),
    org(
      "o2",
      "Parallel Experiences",
      "Experiential agency",
      "Fort Lauderdale",
      "Broward",
    ),
    org(
      "o3",
      "Harbor Performing Arts",
      "Independent venue",
      "Miami Beach",
      "Miami-Dade",
    ),
    org(
      "o4",
      "Coastline Media Lab",
      "Broadcast & media studio",
      "Hollywood",
      "Broward",
    ),
    org(
      "o5",
      "Southside Arts Collective",
      "Cultural nonprofit",
      "Miami",
      "Miami-Dade",
    ),
    org(
      "o6",
      "Open Stage Projects",
      "Live event production",
      "Dania Beach",
      "Broward",
    ),
  ];
  organizations.push(
    org(
      "o7",
      "Lowcountry Live Studio",
      "Independent production company",
      "Charleston, SC",
      "Charleston",
    ),
    org(
      "o8",
      "Harbor Arts Charleston",
      "Cultural nonprofit",
      "Charleston, SC",
      "Charleston",
    ),
  );
  const rows: [string, number, string, JobInput["category"], string][] = [
    [
      "Production Coordinator",
      0,
      "Miami, FL",
      "Production",
      "Coordinate live event production, crew scheduling and event logistics. Support run-of-show execution, backstage teams and vendors.",
    ],
    [
      "Event Operations Coordinator",
      1,
      "Fort Lauderdale, FL",
      "Experiential",
      "Support experiential brand activation and event operations. Coordinate teams, vendor scheduling, production support and event logistics.",
    ],
    [
      "Stage & Venue Assistant",
      2,
      "Miami Beach, FL",
      "Stage",
      "Support stage management, backstage coordination and venue operations. Assist crew scheduling, live event production and artist relations.",
    ],
    [
      "Content Production Coordinator",
      3,
      "Hollywood, FL",
      "Media",
      "Coordinate video and broadcast content production. Support production coordination, editing, crew scheduling and live event coverage.",
    ],
    [
      "Cultural Programs Coordinator",
      4,
      "Miami, FL",
      "Cultural",
      "Support cultural programs, performing arts and festival scheduling. Coordinate teams, event logistics and live event production.",
    ],
    [
      "Senior Event Producer",
      1,
      "Fort Lauderdale, FL",
      "Events",
      "Lead live event production, event logistics, vendor scheduling and experiential activations. Requires 8+ years of leadership experience.",
    ],
  ];
  rows.push(
    [
      "Live Production Coordinator",
      6,
      "Charleston, SC",
      "Production",
      "Coordinate live event production, crew scheduling and event logistics. Support backstage teams, vendors and run-of-show execution.",
    ],
    [
      "Arts Event Coordinator",
      7,
      "Charleston, SC",
      "Cultural",
      "Support cultural programs and performing arts, live event production and event logistics. Coordinate teams, vendors and festival scheduling.",
    ],
  );
  const jobs = rows.map(([title, oi, location, category, description], i) => {
    const url = `https://example.com/demo-jobs/${i + 1}`;
    const input = jobInputSchema.parse({
      title,
      organization: organizations[oi],
      location,
      category,
      employmentType: i === 2 ? "Part-time" : "Full-time",
      description,
      applyUrl: "",
      sources: [
        {
          name: "Fictional employer • sample data",
          url,
          kind: "EMPLOYER",
          originalPostedAt: ago([5, 10, 18, 31, 80, 200, 4, 28][i]),
          capturedAt: ago(1),
          evidence: "Fictional demonstration. This is not a real vacancy.",
        },
      ],
      requirements: [
        {
          text:
            i === 5
              ? "8+ years required"
              : "Relevant event or media coordination experience preferred",
          required: i === 5,
          assessment: i === 5 ? "GAP" : "MET",
          sourceUrl: url,
        },
      ],
      verification: {
        checkedAt: ago(1),
        sourceUrl: url,
        sourceKind: "EMPLOYER",
        pageLoads: true,
        jobIdExists: true,
        applyExists: true,
        listedByEmployer: true,
        httpStatus: 200,
        method: "MANUAL",
        notes: "Simulated evidence for demonstration only.",
      },
      isDemo: true,
    });
    return {
      ...input,
      id: `demo-${i + 1}`,
      discoveredAt: ago(1),
      lastSeenAt: ago(1),
      status: verify(input.verification, now),
      isRepost: false,
      score: scoreJob(input, sampleProfile, now),
      version: 1,
    };
  });
  return {
    profile: sampleProfile,
    jobs,
    organizations,
    history: [],
    applications: [],
    runs: [],
  };
}
