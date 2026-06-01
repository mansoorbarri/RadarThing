export type ChallengeRuleType =
  | "visit_airport"
  | "visit_airport_count"
  | "depart_airport"
  | "arrive_airport"
  | "route"
  | "aircraft_type"
  | "flight_count"
  | "min_duration"
  | "min_distance"
  | "manual";

export interface ChallengeRuleSummaryRule {
  ruleType: ChallengeRuleType;
  targetAirport: string | null;
  targetDepartureAirport: string | null;
  targetArrivalAirport: string | null;
  targetAircraftType: string | null;
  requiredAirportCount: number | null;
  requiredFlightCount: number | null;
  minDurationMinutes: number | null;
  minDistanceNm: number | null;
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
  switch (rule.ruleType) {
    case "visit_airport":
      return `Visit ${rule.targetAirport}`;
    case "visit_airport_count":
      return `Visit ${rule.requiredAirportCount} unique airports`;
    case "depart_airport":
      return `Depart ${rule.targetAirport}`;
    case "arrive_airport":
      return `Arrive at ${rule.targetAirport}`;
    case "route":
      return `Fly ${rule.targetDepartureAirport} to ${rule.targetArrivalAirport}`;
    case "aircraft_type":
      return `Use ${rule.targetAircraftType}`;
    case "flight_count":
      return `Complete ${rule.requiredFlightCount} flights`;
    case "min_duration":
      return `Fly at least ${rule.minDurationMinutes} minutes`;
    case "min_distance":
      return `Fly at least ${rule.minDistanceNm} nm`;
    case "manual":
      return "Manual review required";
  }
}
