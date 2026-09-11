import type { Job, Organization } from "./contracts";
import { ageHours } from "./engine";
export type Market = "miami" | "charleston";
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
