# Reading airport charts in RadarThing

Find the right chart for each phase of a GeoFS flight, from taxi to approach, and learn what the main chart types actually tell you.

## Why charts matter in a simulator

GeoFS gives you the runways and the scenery, but it does not tell you which taxiway leads to which runway, which way to turn after take-off, or what altitude to be at ten miles out on final. Real pilots get that from charts. Flying with them turns a free-form hop into something close to an actual procedure, and it makes your flight easier for others to read on the radar because you will be where they expect you to be.

RadarThing's chart viewer collects reviewed charts for many airports so you can open them next to the live map instead of hunting through PDFs in another tab.

## Opening charts

1. On [the radar](/radar), search for the airport by its ICAO code (for example `KSFO` or `EGLL`) and choose the airport result.
2. In the selected-airport bar, choose **Charts**.
3. Use the chart list to pick a chart. Search by name if the airport has many. The list can be hidden to give the chart more room.

The chart opens in a panel beside the map, so you can keep watching traffic while you read it. Use the rotate control to turn a chart by 90° at a time. Some charts are easier to read rotated to match your direction of travel, and RadarThing remembers the rotation you chose for each chart on that browser.

## Who can open which charts

- **Airports in the United States and its territories** (ICAO codes beginning with K, PA, PF, PH, PJ, PO, PP and TJ, plus a few others such as PGUM and TIST) are free. Free accounts need to sign in with Google and can open charts for **3 different airports per UTC day**. Opening another chart at an airport you have already used today does not count again.
- **Airports everywhere else**, and unlimited US airports, are part of RadarThing Pro.

The daily allowance resets at 00:00 UTC. See [pricing](/pricing) for current plan details.

## The four chart types

Charts are grouped into four types. Knowing which one you need saves a lot of scrolling.

### Ground (airport diagram)

The airport diagram is a plan view of the airport: runways with their numbers and lengths, taxiways with their letter names, aprons, terminals and hold-short lines. Use it before you start moving:

- Find your parking position and the runway you want.
- Trace a route along named taxiways, for example "A, then B, hold short of runway 28L".
- Note **hot spots**, which are marked areas where taxiing aircraft commonly take a wrong turn or enter a runway by mistake.

Runway numbers are the magnetic heading divided by ten and rounded. Runway 28 points roughly 280°, and the other end of the same strip is runway 10. Parallel runways add L, C or R for left, centre and right.

### SID (departure)

A Standard Instrument Departure is a published route from the runway into the en-route airspace. A SID chart shows:

- Which runways it applies to.
- The initial heading or track to fly after take-off and any turn altitude ("climb runway heading to 1,500 ft, then turn left").
- Waypoints in sequence, with altitude restrictions such as "at or above 5,000" and sometimes speed limits.
- The transition or exit point where the SID ends and your route continues.

SIDs are named after their final fix with a version number, for example "CPT 5J". If you load a SID's waypoints into your GeoFS flight plan, viewers will see you follow it on the radar.

### STAR (arrival)

A Standard Terminal Arrival Route is the reverse: it takes you from the en-route structure toward the airport. Look for:

- The entry fix where the STAR begins.
- Altitude and speed restrictions. A STAR is mostly a descent plan, so these are often "at FL150" or "250 knots below FL100".
- Holding patterns, drawn as racetrack shapes, where arrivals may be held during busy periods.
- The point where the STAR ends, usually where an approach or radar vectors begin.

### Approach

Approach charts take you from the end of the arrival to the runway. The most common are **ILS** approaches, which give both lateral and vertical guidance, and **RNAV (GPS)** approaches. Key items:

- **Initial and final approach fixes.** The final approach fix (FAF) is where the final descent begins.
- **The profile view.** This is the side-on drawing at the bottom of the chart. It shows the altitude you should be at each fix, which is the single most useful thing on the chart for a stable approach.
- **Minimums.** The decision altitude or minimum descent altitude below which you must not descend without the runway in sight.
- **Missed approach procedure.** What to do if you cannot land, usually a climb to a set altitude and a turn to a hold.

A good rule of thumb: aim for a 3° glide path, which is about 300 feet of descent per nautical mile, or roughly five times your ground speed in feet per minute.

## Putting it together on a flight

1. Before departure, open the **ground** chart to plan your taxi and the **SID** for your runway.
2. In cruise, check the **STAR** for your destination and expected runway, so you can plan your top of descent.
3. As you near the airport, switch to the **approach** chart and brief the profile view and the missed approach.

Afterwards, replay your flight from your profile (see [Flight history and replay](/guides/flight-history-and-replay)) and compare your track with the procedure you flew.

## When a chart is missing or out of date

Charts are reviewed before they appear, and coverage grows over time, so a particular airport or procedure may not be available yet. If a chart is missing, clearly wrong or out of date, [contact support](/contact) with the ICAO code and chart name.

Real charts are revised on a regular cycle. RadarThing's charts are provided for simulator flying only and must never be used for real-world flight planning or navigation.
