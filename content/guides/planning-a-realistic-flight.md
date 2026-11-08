# Planning a realistic flight in GeoFS

A practical, phase-by-phase method for planning and flying a GeoFS flight that looks and feels like a real airline operation.

## Why plan at all

GeoFS makes it easy to spawn at any airport and take off in seconds, and there is nothing wrong with that. But a planned flight is more satisfying, it looks better on the radar, and it gives you something to measure yourself against when you replay it afterwards. This guide walks through a simple planning routine that works for anything from a short regional hop to a long-haul flight.

You do not need real-world software or a paid subscription to follow it. Everything here can be done with GeoFS, RadarThing, and a little arithmetic.

## 1. Choose a route and aircraft

Start with a realistic pairing. Real airlines fly aircraft that suit the distance:

- **Under 500 nm**: turboprops and regional jets, such as the Dash 8 or CRJ family.
- **500 to 3,000 nm**: narrow-bodies such as the A320 family or the 737.
- **Over 3,000 nm**: wide-bodies such as the 777, 787, or A350.

If you want inspiration, open **Airports** in the radar's control dock to see which city pairs are busiest right now, or look at your own [flight history](/guides/flight-history-and-replay) for a route you have not flown in a while. Flying into a busy airport is more fun, and flying from a quiet one is more relaxing.

## 2. Pick a callsign

Use a callsign in the real format: a three-letter ICAO airline code followed by a flight number, such as `BAW117` or `DAL404`. If you fly for a [virtual airline](/guides/virtual-airlines), use its code. Avoid callsigns that are already in use on the radar; the RadarThing userscript will tell you if yours is taken when you press **Start tracking**.

[Callsigns explained](/guides/callsigns-explained) covers the format in more detail.

## 3. Check the weather

Open both airports on the radar and read their METARs. You are looking for:

- **The wind direction**, which decides your likely departure and arrival runways.
- **Visibility and cloud**, which decide whether you need an instrument approach.
- **Gusts and crosswind**, which affect your approach speed.

If METARs are new to you, [How to read a METAR](/guides/reading-metars) explains each group.

## 4. Choose runways and procedures

With the wind known, pick runways that give you a headwind. Then open the [airport charts](/guides/airport-charts) and choose:

- **A SID** valid for your departure runway and heading towards your destination.
- **A STAR** that starts from the direction you will arrive.
- **An approach** for your arrival runway. If the weather is good, a visual approach is fine; if not, choose an ILS or RNAV approach.

Write down the first altitude restriction of the SID and the first one of the STAR. They are the two numbers most likely to catch you out.

## 5. Choose a cruise altitude

A simple rule of thumb: the longer the flight, the higher you can usefully go.

- Short flights of under 150 nm rarely benefit from going above FL200, because you would spend the whole flight climbing and descending.
- Medium flights commonly cruise between FL300 and FL370.
- Long flights often start around FL330 to FL350 and step higher as the aircraft burns fuel and becomes lighter.

Real-world airspace also has *semicircular rules*: in many countries, eastbound flights (headings 000 to 179) use odd flight levels like FL350 and westbound flights use even ones like FL360. GeoFS will not enforce this, but following it reduces head-on encounters with other pilots and keeps [conflict alerts](/guides/conflict-alerts) quieter.

## 6. Build the flight plan

Enter your route into GeoFS's flight plan. When the RadarThing userscript detects a flight plan it shows a *Flight plan detected* message, and your route and next waypoint will appear for anyone viewing your flight on the radar.

If you prepare routes outside GeoFS, RadarThing can also preview a flight plan from a JSON file, showing the full route, leg distances, and estimated time. See [Flight plans and navigation](/guides/flight-plans-and-navigation).

## 7. Start tracking

In GeoFS, open the RadarThing panel and enter your departure and arrival ICAO codes, your callsign, and a squawk if you have one. Press **Start tracking**. When the panel status says **Live on radar**, your flight is on the radar, and RadarThing will start recording your route for your history and statistics.

## 8. Fly the departure

- Taxi on the published taxiways shown on the ground chart.
- Line up, check your flaps and trim, and take off into the wind.
- Follow the SID. Respect any speed limits; 250 knots below 10,000 feet is a common real-world rule.
- Retract flaps on schedule as you accelerate.

## 9. Cruise

Once at your cruise altitude, let the autopilot do the work. This is a good time to:

- Check the weather at your destination again.
- Brief the STAR and approach.
- Calculate your top of descent (next section).

## 10. Plan the descent with the 3-to-1 rule

A widely used rule of thumb is that it takes about **3 nautical miles of distance for every 1,000 feet of descent**. To find where to start descending:

1. Take the altitude you need to lose, in thousands of feet.
2. Multiply by three.
3. Add a few miles to slow down.

Example: cruising at FL360 to an airport near sea level, you need to lose 36,000 feet. 36 × 3 = 108 nm. Add about 10 nm for deceleration, and begin your descent roughly 120 nm from the airport.

To check your descent rate, multiply your ground speed by five. At 300 knots ground speed you need about 1,500 feet per minute to stay on a 3-degree path.

## 11. Approach and landing

- Slow to 250 knots or less by 10,000 feet.
- Configure early: it is easier to fly a stable approach if you are slowed down and configured before the final approach fix.
- On final, aim for a steady descent of about 700 to 800 feet per minute at typical airliner approach speeds.
- If the approach is not stable by about 1,000 feet above the runway, go around. A missed approach is part of flying, not a failure.

## 12. Review the flight

After landing and parking, end the flight from the RadarThing panel. Then open your pilot profile and [replay the flight](/guides/flight-history-and-replay). Things worth checking:

- Did you meet the SID and STAR restrictions?
- Where did your descent actually start, compared with your plan?
- Was your vertical speed stable on final?

[Reading flight telemetry](/guides/reading-flight-telemetry) explains what to look for in each value.

## A one-page checklist

1. Route and aircraft that suit each other
2. Realistic callsign that is not already in use
3. METARs for both airports
4. Runways chosen from the wind
5. SID, STAR, and approach selected
6. Cruise altitude chosen
7. Flight plan entered in GeoFS
8. RadarThing panel filled in and showing **Live on radar**
9. Top of descent calculated
10. Flight reviewed in replay

Everything in this guide is for flight simulation. Never use RadarThing or these methods for real-world flight planning.
