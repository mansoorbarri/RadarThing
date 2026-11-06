# Reading airport charts: ground, SID, STAR, and approach

Learn what each type of airport chart is for, how to read the key parts, and how to open charts on RadarThing.

## Why use charts in a simulator

You can fly GeoFS without ever opening a chart. But charts are how real pilots know which taxiway to follow, which way to turn after take-off, and how to line up with a runway in poor weather. Using them turns a free-form flight into a structured one, and makes it much easier to fly alongside other pilots and simulated controllers at busy airports.

RadarThing includes a curated chart library that you can open directly from the radar. This guide explains the four chart types you will find and how to get the most out of each.

## Opening charts on RadarThing

1. Open [the radar](/radar) and search for an airport by its ICAO code, for example **KLAX** or **EGLL**.
2. Select the airport result. The map moves to the airport and the selected-airport bar appears.
3. Choose **Charts**. The viewer opens with tabs for **Ground**, **SID**, **STAR**, **Approach**, and **All**.

The RadarThing userscript also has a charts panel inside GeoFS, so you can look up a chart without leaving the simulator. By default it opens with the **Q** key; you can change that key in the userscript's settings.

### Access

Free accounts can open charts for up to three US airports per UTC day. Opening a chart for an airport you have already viewed that day does not count again. Pro removes the daily limit and adds airports worldwide. Not every airport has every chart yet.

## Ground charts (airport diagrams)

A ground chart shows the airport from above: runways, taxiways, aprons, terminals, and sometimes parking stands.

What to look for:

- **Runways** are labelled at each end with their number, such as 09 and 27. The number is the runway's magnetic heading divided by ten. Parallel runways add L, C, or R for left, centre, and right.
- **Taxiways** are labelled with letters, sometimes with numbers (A, B, A1, A2). Real controllers give taxi instructions as a sequence of these letters: "taxi to runway 27 via A, B2".
- **Hold short lines** mark where you must stop before entering a runway.
- **Hot spots** are circled areas where pilots often make mistakes, such as complex intersections.

Before you push back in GeoFS, find your parking position and your departure runway on the ground chart, then trace a route between them. On a busy server, taxiing on the published taxiways instead of across the grass makes you predictable to everyone else.

## SIDs (standard instrument departures)

A SID is a published route from the runway to the en-route airway system. It tells you which way to turn, what altitudes to climb to, and which waypoint ends the procedure.

How to read one:

- **The name** identifies the procedure and its version. Most are named after a waypoint and a number, so a procedure called *ALPHA TWO* is usually written `ALPHA2` in a flight plan.
- **Runway applicability** tells you which runways the SID is valid for. Always check this first.
- **The route** is drawn as lines between waypoints, with headings and distances written along each leg.
- **Altitude restrictions** appear next to waypoints. A number with a line *under* it is a minimum ("at or above"); a line *over* it is a maximum ("at or below"); lines above and below mean "at exactly".
- **Speed restrictions** such as *250K* limit your speed at or before that point.
- **The initial climb altitude** is often written in a text box. This is where you level off unless cleared higher.

## STARs (standard terminal arrival routes)

A STAR is the mirror of a SID: it takes you from the en-route structure towards the airport, usually ending at a point where you either join an approach or receive radar vectors.

STARs contain the same elements as SIDs: named waypoints, altitude and speed restrictions, and runway or transition information. Many STARs have several *transitions*, which are entry points from different directions. Pick the transition that matches the direction you are arriving from.

Planning tip: STAR altitude restrictions are the best guide to when you should start your descent. If the first restriction is "at or below FL240", you need to have descended enough to meet it, which may mean leaving cruise earlier than you expect. See [Planning a realistic flight](/guides/planning-a-realistic-flight) for a simple descent rule.

## Approach charts

An approach chart shows how to fly from the end of the arrival to the runway threshold. It is the most detailed chart type.

The main sections are:

1. **The header**: airport, runway, procedure name (such as *ILS or LOC RWY 27L*), and key frequencies. The final approach course is written here too.
2. **The plan view**: a top-down drawing of the approach with initial, intermediate, and final segments, plus the missed approach path.
3. **The profile view**: a side view showing altitudes at each fix and the glide path down to the runway.
4. **The minimums section**: the lowest altitude you can descend to without seeing the runway, called the decision altitude (for precision approaches like ILS) or minimum descent altitude (for non-precision approaches).

### The missed approach

Every approach chart includes a missed approach procedure: what to do if you cannot land. It is usually a climb straight ahead to an altitude, then a turn to a holding fix. Read it before you start the approach. In GeoFS, flying a proper go-around instead of forcing a bad landing is one of the most realistic things you can do.

### Approach types you will see

- **ILS** (instrument landing system): gives lateral and vertical guidance down to a low decision altitude.
- **RNAV (GPS)**: uses satellite navigation. Some versions provide vertical guidance, others do not.
- **VOR** and **NDB**: older non-precision approaches based on ground beacons.
- **Visual**: flown by looking outside, often with a published route for noise abatement.

## Using charts with the radar

Charts work best alongside the radar:

- Use the **ground chart** with the radar's OpenStreetMap layer to check which taxiways connect.
- Compare your **live route** with the SID or STAR to see how closely you followed it.
- Replay a past flight from your [flight history](/guides/flight-history-and-replay) with the approach chart open, and check your altitude at each fix against the profile view.

## Missing a chart?

The chart library is curated by the RadarThing team and grows over time. If an airport you fly from regularly is missing a chart, [contact us](/contact) with its ICAO code and the procedure you need.

Charts on RadarThing are for flight simulation only. They may be outdated or incomplete and must never be used for real-world navigation.
