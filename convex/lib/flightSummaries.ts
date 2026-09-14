import {
  calculateRouteDistanceNm,
  hasRecordedRouteDistance,
} from "./challengeRules";

export async function collectFlightSummaries<
  Flight extends { routeData?: unknown },
>(flights: AsyncIterable<Flight>, includeDistance = true) {
  const summaries = [];
  for await (const flight of flights) {
    const { routeData, ...summary } = flight;
    summaries.push({
      ...summary,
      distanceNm: includeDistance ? calculateRouteDistanceNm(routeData) : 0,
      hasRecordedDistance:
        includeDistance && hasRecordedRouteDistance(routeData),
      hasRouteData: Array.isArray(routeData) && routeData.length > 1,
    });
  }
  return summaries;
}
