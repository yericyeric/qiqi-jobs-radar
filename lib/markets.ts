import type { Job, Organization } from "./contracts";
import { ageHours } from "./engine";
export type Market = "miami" | "charleston";
/** Only individual vacancy URLs; never a portal's results/category pages. */
export function directJobPortal(link: string): string | null {
  try {
    const u = new URL(link), host = u.hostname.replace(/^www\./, ""), path = u.pathname;
    if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
    if (host === "linkedin.com" && /^\/jobs\/view\/[^/]+/.test(path)) return "LinkedIn";
    if (host === "indeed.com" && path === "/viewjob" && u.searchParams.has("jk")) return "Indeed";
    if (host === "glassdoor.com" && (/^\/job-listing\//i.test(path) || (path === "/partner/jobListing.htm" && u.searchParams.has("jobListingId")))) return "Glassdoor";
    if (host === "ziprecruiter.com" && (/^\/c\/[^/]+\/Job\//i.test(path) || /^\/jobs\/[^/]+\/[^/]+/.test(path))) return "ZipRecruiter";
    if (host === "productionhub.com" && /^\/job\/\d+/.test(path)) return "ProductionHUB";
    if (host === "entertainmentcareers.net" && /\/job\/\d+/i.test(path)) return "EntertainmentCareers";
    if (host === "staffmeup.com" && /^\/jobs\/.+-\d+/.test(path)) return "Staff Me Up";
    if (host === "teamworkonline.com" && /-\d{5,}\/?$/.test(path)) return "TeamWork Online";
    if (host === "monster.com" && /^\/job-openings\//.test(path)) return "Monster";
    if (host === "simplyhired.com" && /^\/job\/[^/]+/.test(path)) return "SimplyHired";
    return null;
  } catch { return null; }
}
export const marketLabels: Record<Market, string> = {
  miami: "Miami / South Florida",
  charleston: "Charleston, South Carolina",
};
export function inMarket(o: Pick<Organization, "county">, market: Market) {
  return (
    o.county === "Remote" ||
    (market === "charleston"
      ? o.county === "Charleston"
      : ["Miami-Dade", "Broward", "Palm Beach", "South Florida"].includes(
          o.county,
        ))
  );
}
/** Within each freshness band, prefer fit. Undated jobs cannot lead a fresh feed. */
export function compareRecentFit(a: Job, b: Job, now = Date.now()) {
  const band = (j: Job) => {
    const age = ageHours(j, now);
    return age <= 24 ? 0 : age <= 48 ? 1 : age <= 168 ? 2 : 3;
  };
  return (
    band(a) - band(b) ||
    b.score.total - a.score.total ||
    ageHours(a, now) - ageHours(b, now)
  );
}
