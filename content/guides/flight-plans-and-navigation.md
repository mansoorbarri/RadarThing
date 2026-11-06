# Flight plans, waypoints, and navigation

How your GeoFS flight plan appears on RadarThing, how to preview a route from a file, and how to use the radar's navigation tools.

## Why share a flight plan

A flight on the radar without a flight plan is a dot moving in a direction. A flight with a plan has a story: where it is going, how it will get there, and what comes next. Viewers can see your route drawn ahead of you, controllers can anticipate your turns, and you get a more useful replay afterwards.

This guide covers the three ways RadarThing works with routes: the plan you build in GeoFS, an imported route file, and the radar's own measurement and control tools.

## Your GeoFS flight plan on the radar

GeoFS includes a flight plan editor in its navigation panel. When you build a route there while the RadarThing userscript is running, the userscript detects it and shows a *Flight plan detected* message. From that point:

- Your route is drawn on the radar when someone selects your flight.
- The flight panel shows your **next waypoint**, so viewers can see where you are heading.
- Waypoints can be shown or hidden with **Show route waypoints** in the radar's quick controls or **Waypoints** in Configuration.

If you change your plan mid-flight, the update is picked up automatically. There is no need to re-transmit your flight.

### Tips for a clean route

- **Start and end at airports.** Begin the plan at your departure airport and finish at your arrival airport, matching the ICAO codes you entered in the RadarThing panel.
- **Use real waypoints.** Following the waypoints from a [SID or STAR](/guides/airport-charts) makes your route look like a real one.
- **Add altitudes** where your procedures have restrictions. They help you plan the descent and are visible in a preview.
- **Avoid zig-zags.** Two waypoints in the wrong order produce a sharp reversal that is obvious on the radar.

## Previewing a route from a file

If you prepare your route outside GeoFS, you can preview it on the radar before you fly. Choose **Import Plan** in the Radar section of the control dock and select a JSON file. Use **Plan Details** to reopen the summary and **Clear Plan** to remove it.

The file must be a JSON array of waypoints. Each entry needs a latitude and longitude; an identifier, type, altitude, and speed are optional:

```json
[
  { "ident": "EGLL", "type": "APT", "lat": 51.4706, "lon": -0.4619, "alt": null, "spd": null },
  { "ident": "WPT01", "type": "FIX", "lat": 51.9, "lon": -1.2, "alt": 12000, "spd": 280 },
  { "ident": "EGPH", "type": "APT", "lat": 55.95, "lon": -3.3725, "alt": null, "spd": null }
]
```

Once loaded, RadarThing draws the full route and shows a summary panel with:

- The waypoints in order, with their altitudes and speeds.
- The distance of each leg and the total distance in nautical miles and kilometres.
- An estimated time for each leg and for the whole flight, based on the speeds in the file.

Entries without coordinates are skipped. If a waypoint has no identifier, RadarThing labels it by its position in the list. The preview is local to your browser and does not change what other pilots see.

## Measuring headings and distances

Heading Mode turns the map into a measuring tool. Press **T** (or use the heading mode control) and then drag from one point to another on the map. RadarThing draws a line and shows:

- The **heading** from the start point to the end point, in degrees.
- The **distance** in kilometres and statute miles.

This is the quickest way to answer questions like "what heading takes me direct to that airport?" or "how far am I from the coast?". Press **T** again to leave Heading Mode. You can change the key under **Configuration → Misc**.

## Controlling your own aircraft from the radar

When you are signed in to RadarThing with the same Google account you use in GeoFS, selecting your own aircraft opens an extra control panel. From there you can send autopilot targets to your simulator:

- **Speed**, in knots or Mach.
- **Altitude**.
- **Heading**, in **HDG** mode.
- **NAV** mode, which follows your flight plan and can target a specific waypoint from it.

This is useful when you are watching your flight on a second screen or a tablet. Commands are delivered with your next position update, so allow a moment for the aircraft to respond. The panel also lets you disconnect the flight from RadarThing.

Only you can control your own aircraft. The panel does not appear on other pilots' flights.

## Following a route in flight

Some habits that make navigation easier:

1. **Check the next waypoint** in the flight panel before each turn, especially when you are close to a SID or STAR restriction.
2. **Use Follow** (press **F**) to keep the map centred on your aircraft during busy phases of flight.
3. **Cycle the label display** with **L** to show more or less information next to each aircraft.
4. **Turn on Track Line** in Radar Mode to see where your current heading takes you.

## Waypoint reminders on Discord

If you have connected Discord to your RadarThing account, the RadarThing Discord bot can remind you about your live flight. Schedule a reminder for a waypoint and the bot will ping you at your chosen interval once you pass it. It is handy on long flights when you step away from the screen.

## When a route looks wrong

- **No route shown**: make sure a flight plan is active in GeoFS and that the userscript showed *Flight plan detected*.
- **Old route shown**: if you rebuilt the plan, give the next update a few seconds to arrive.
- **Import error**: the file must be valid JSON and must be an array. Check for trailing commas and missing brackets.

Routes on RadarThing are for flight simulation only and must never be used for real-world navigation.
