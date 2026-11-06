import { FREE_RECENT_FLIGHTS_LIMIT } from "~/lib/flightHistory";
import { FREE_DAILY_ALLOWANCE } from "~/lib/freeAllowance";

/** "—" means the plan doesn't include the feature. */
export const NOT_INCLUDED = "—";

export interface PlanRow {
  feature: string;
  free: string;
  pro: string;
  /** Wording for the Pro card when it differs from `feature`. */
  proLabel?: string;
}

/**
 * The single list of what Free and Pro include. The home page plan cards and
 * the pricing comparison both read from it, so they can't disagree.
 */
export const planRows: PlanRow[] = [
  {
    feature: "Live radar and flight tracking",
    free: "Included",
    pro: "Included",
  },
  {
    feature: "Search, filters and follow mode",
    free: "Included",
    pro: "Included",
  },
  {
    feature: "Remote autopilot commands",
    free: "Included",
    pro: "Included",
  },
  { feature: "Live ATC audio", free: "Included", pro: "Included" },
  {
    feature: "Flight replay and share links",
    free: "Included",
    pro: "Included",
  },
  {
    feature: "Airport METARs and precipitation",
    free: "Included",
    pro: "Included",
  },
  { feature: "Aircraft image uploads", free: "Included", pro: "Included" },
  {
    feature: "Flight history on pilot profiles",
    free: `Last ${FREE_RECENT_FLIGHTS_LIMIT} flights`,
    pro: "Full archive",
  },
  {
    feature: "Pilot stats",
    free: "Basic totals",
    pro: "Top routes, airports and total flight time",
  },
  {
    feature: "Airport charts",
    free: `${FREE_DAILY_ALLOWANCE.charts} US airports per day`,
    pro: "Unlimited, worldwide",
  },
  {
    feature: "AIRMETs, SIGMETs, NOTAMs and D-ATIS",
    free: NOT_INCLUDED,
    pro: "Included",
  },
  {
    feature: "Radar mode, trails and track lines",
    free: NOT_INCLUDED,
    pro: "Included",
  },
  { feature: "Conflict alerts", free: NOT_INCLUDED, pro: "Included" },
  {
    feature: "Shareable flight card images",
    free: NOT_INCLUDED,
    pro: "Included",
  },
  {
    feature: "Advertising",
    free: "Shown on some pages",
    pro: "None",
    proLabel: "No ads",
  },
];

// "Last 10 flights" -> "last 10 flights", but "US airports" stays as is.
function lowerFirst(value: string) {
  return /^[A-Z][a-z]/.test(value)
    ? value.charAt(0).toLowerCase() + value.slice(1)
    : value;
}

export interface PlanCardItem {
  label: string;
  included: boolean;
}

/** Free card: every feature, with the limit where there is one. */
export function freePlanItems(): PlanCardItem[] {
  return planRows
    .filter((row) => row.feature !== "Advertising")
    .map((row) => ({
      label:
        row.free === "Included" || row.free === NOT_INCLUDED
          ? row.feature
          : `${row.feature}: ${lowerFirst(row.free)}`,
      included: row.free !== NOT_INCLUDED,
    }));
}

/** Pro card: only what Pro adds or improves on top of Free. */
export function proPlanItems(): PlanCardItem[] {
  return planRows
    .filter((row) => row.free !== row.pro)
    .map((row) => ({
      label:
        row.proLabel ??
        (row.pro === "Included"
          ? row.feature
          : `${row.feature}: ${lowerFirst(row.pro)}`),
      included: true,
    }));
}
