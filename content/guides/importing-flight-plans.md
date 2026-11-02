# Importing and planning flight plans

Load a flight plan file onto the radar to preview your route before you fly, read the leg-by-leg distance and time estimates, and file flights for events.

## Why preview a plan on the radar

A flight plan is just a list of points, so it is easy to make a mistake: a waypoint typed with the wrong identifier, a fix that turns out to be on another continent, or a route that doubles back on itself. Seeing the route drawn on a map before departure catches those problems, and it shows you how your route fits around weather, busy airports and other traffic.

RadarThing can import a plan file, draw it on the map, and give you an estimate of the distance and flight time for each leg.

## Importing a plan

1. Open [the radar](/radar) and choose **Import Plan** from the radar menu.
2. Pick a flight plan file (`.json`) from your computer.
3. RadarThing draws the route, opens the plan panel, and confirms how many waypoints it imported.

Importing a plan clears any selected aircraft, airport, history or replay so the route is shown on its own. Use **Plan Details** to reopen the panel, **Replace Plan** to load a different file, and **Clear Plan** to remove it.

The plan stays in your browser. It is not shared with anyone, and it does not change what your GeoFS aircraft is doing.

## The file format

RadarThing reads a JSON file containing an array of waypoints, where each waypoint is an object with a position and, optionally, a name, type, altitude and speed. For example:

```json
[
  { "ident": "EGLL", "type": "DPT", "lat": 51.4706, "lon": -0.4619, "alt": null, "spd": null },
  { "ident": "CPT", "type": "VOR", "lat": 51.4922, "lon": -1.2194, "alt": 6000, "spd": 250 },
  { "ident": "LIRF", "type": "DST", "lat": 41.8003, "lon": 12.2389, "alt": null, "spd": null }
]
```

The fields are:

- **lat and lon (required):** the position in decimal degrees. Waypoints without valid coordinates are skipped.
- **ident:** the waypoint name. Unnamed points are labelled WP1, WP2 and so on.
- **type:** for example `DPT` for departure, `DST` for destination, or a fix type such as `VOR` or `WPT`. If the plan has a `DPT` and a `DST`, RadarThing names it after them, for example "EGLL -> LIRF". Otherwise it uses the file name.
- **alt:** a planned altitude in feet, optional.
- **spd:** a planned speed in knots, optional.

A plan needs at least two waypoints with coordinates. If the file is not valid JSON, or is not an array, RadarThing tells you what is wrong instead of drawing a partial route.

## Reading the estimates

The plan panel lists every leg with its distance in nautical miles and an estimated time, plus totals in nautical miles, kilometres and hours and minutes.

Distances are **great-circle** distances, the shortest path over the Earth's surface between consecutive waypoints. That is why a long-haul leg drawn on a flat map looks curved.

Times are estimated leg by leg:

1. If a waypoint has a planned speed, it is used.
2. If not, the last known planned speed from earlier in the plan is carried forward.
3. If the plan has no speeds yet, RadarThing guesses from the planned altitude: about 220 knots below 10,000 feet, 300 knots between 10,000 and 18,000 feet, 380 knots between 18,000 and 32,000 feet, and 460 knots at 32,000 feet and above.

These are **planning estimates in still air**. Real flight time depends on winds, your actual speed, climb and descent, and any holding or vectoring, so expect your flown time to differ, sometimes by a lot on long flights with strong jet streams.

## Using a plan well

- **Check the shape first.** Zigzags, sudden doubling-back, or a waypoint far off the route almost always mean a wrong fix.
- **Overlay the weather.** Turn on Precipitation (and AIRMETs and SIGMETs with Pro) in Configuration to see what your route crosses. See [Radar tools, keyboard shortcuts and presets](/guides/radar-tools-and-shortcuts).
- **Compare with the charts.** Open the departure and arrival [airport charts](/guides/reading-airport-charts) and check that the first and last fixes match the SID and STAR you intend to fly.
- **Compare plan with reality.** After the flight, replay it from your profile and compare the flown track with the plan. See [Flight history and replay](/guides/flight-history-and-replay).

## Filing a flight for an event

Some community events use flight strips, so controllers know who is coming and when. When an event is running, **File Flight** in the radar menu opens a short form. Sign in, then enter your callsign, name, aircraft, departure airport and route (for example `DCT VOR VOR STAR`), and submit. If no event is active, the form tells you so and there is nothing to file.

Filing a flight only registers your intent for the event. It does not import a plan into the radar or into GeoFS, so you may want to do both.

Flight plans on RadarThing exist for simulator flying only and must never be used for real-world flight planning or navigation.
