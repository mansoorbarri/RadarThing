import {
  AIRCRAFT_CATEGORY_LABELS,
  type AircraftCategory,
} from "~/lib/aircraftCategories";

export type ChallengeRuleType =
  | "visit_airport"
  | "visit_airport_count"
  | "visit_airport_list"
  | "depart_airport"
  | "arrive_airport"
  | "route"
  | "aircraft_type"
  | "flight_count"
  | "min_duration"
  | "min_distance"
  | "max_duration"
  | "max_distance"
  | "aircraft_category"
  | "manual";
export type ChallengeRuleScope = "challenge" | "each_flight";

export interface ChallengeRuleSummaryRule {
  ruleType: ChallengeRuleType;
  scope?: ChallengeRuleScope | null;
  targetAirport: string | null;
  targetAirports?: string[] | null;
  targetDepartureAirport: string | null;
  targetArrivalAirport: string | null;
  targetAircraftType: string | null;
  targetAircraftCategories?: AircraftCategory[] | null;
  requiredAirportCount: number | null;
  requiredFlightCount: number | null;
  minDurationMinutes: number | null;
  minDistanceNm: number | null;
  maxDurationMinutes?: number | null;
  maxDistanceNm?: number | null;
}

export interface ChallengeRuleSummaryChallenge extends ChallengeRuleSummaryRule {
  mode: "auto" | "manual";
  rules?: ChallengeRuleSummaryRule[];
}

export function getRuleSummary(challenge: ChallengeRuleSummaryChallenge) {
  if (challenge.mode === "manual") return "Manual review required";

  const rules =
    challenge.rules && challenge.rules.length > 0
      ? challenge.rules
      : [challenge];

  return rules.map((rule) => getSingleRuleSummary(rule)).join(" + ");
}

function getSingleRuleSummary(rule: ChallengeRuleSummaryRule) {
  const prefix = rule.scope === "each_flight" ? "Each counted flight: " : "";
  switch (rule.ruleType) {
    case "visit_airport":
      return `${prefix}Visit ${rule.targetAirport}`;
    case "visit_airport_count":
      return `${prefix}Visit ${rule.requiredAirportCount} unique airports`;
    case "visit_airport_list":
      return `${prefix}Visit ${rule.requiredAirportCount} of ${rule.targetAirports?.length ?? 0} target airports`;
    case "depart_airport":
      return `${prefix}Depart ${rule.targetAirport}`;
    case "arrive_airport":
      return `${prefix}Arrive at ${rule.targetAirport}`;
    case "route":
      return `${prefix}Fly ${rule.targetDepartureAirport} to ${rule.targetArrivalAirport}`;
    case "aircraft_type":
      return `${prefix}Use ${rule.targetAircraftType}`;
    case "aircraft_category":
      return `${prefix}Use ${(rule.targetAircraftCategories ?? [])
        .map((category) => AIRCRAFT_CATEGORY_LABELS[category])
        .join(" or ")}`;
    case "flight_count":
      return `${prefix}Complete ${rule.requiredFlightCount} flights`;
    case "min_duration":
      return `${prefix}Fly at least ${rule.minDurationMinutes} minutes`;
    case "min_distance":
      return `${prefix}Fly at least ${rule.minDistanceNm} nm`;
    case "max_duration":
      return `${prefix}Fly at most ${rule.maxDurationMinutes} minutes`;
    case "max_distance":
      return `${prefix}Fly at most ${rule.maxDistanceNm} nm`;
    case "manual":
      return "Manual review required";
  }
}
