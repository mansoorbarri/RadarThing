# Radar settings, layers, and keyboard shortcuts

A tour of every section of the radar's Configuration panel, the default keyboard shortcuts, and how to save a setup you like as a preset.

## Opening Configuration

On [the radar](/radar), select the gear control to open **Configuration**. It has three tabs:

- **Map**: base map layers, layer presets, and map overlays such as weather.
- **Visibility**: traffic tools and Radar Mode overlays.
- **Misc**: display units and keyboard bindings.

Settings are saved in your browser, so they will still be there next time you open the radar on the same device. They do not follow your account to another browser.

## Base map layers

RadarThing offers several base maps. Choose the one that suits what you are doing:

- **OpenStreetMap** gives detailed geographic context: roads, towns, coastlines, and airport layouts. It is the best choice when you are watching a departure or taxi.
- **OpenAIP** is an aviation map with airspace, navigation aids, and airports. It is the best choice for following traffic en route.
- **Radar Mode** is a dark, controller-style display designed for busy airspace. It is a Pro layer, and it unlocks the Radar Overlays described below.

## Map overlays

The **Map Layers** section on the Map tab controls what is drawn on top of the base map:

- **Waypoints** shows route waypoints for the selected flight.
- **Precipitation** draws a live weather radar overlay, available to everyone. It is a quick way to see whether rain or storms are near your route.
- **AIRMETs** and **SIGMETs** outline areas of significant weather hazards such as turbulence, icing, and convective activity. These are Pro overlays.
- **Runway Centerlines** extends a line out from each runway end, making it much easier to judge whether an aircraft is lined up for final. This is a Pro overlay, and you can set how far the lines extend.

Turning an overlay off only changes your own view. It does not affect what pilots send or what anyone else sees.

## Traffic tools

The **Traffic** section on the Visibility tab contains **Conflict Alerts**, a Pro feature that predicts when two aircraft are about to pass too close. [How conflict alerts work](/guides/conflict-alerts) explains the thresholds in detail.

To narrow the map to specific traffic, open **Filter** from the control dock and filter by callsign or airline. If a flight you expect to see is missing, check this filter first.

## Radar Overlays

When you are using Radar Mode, two extra overlays become available:

- **History Trails** draws a series of dots behind each aircraft, showing where it has been. You can choose how frequently the dots are placed. Trails make it easy to see turns and holding patterns.
- **Track Line** draws a projected line ahead of each aircraft along its current heading. You can choose how long the line is. Track lines are the fastest way to spot converging traffic.

Together, trails and track lines give you the same picture a real radar controller works with: where each aircraft has been and where it is going.

## Display units

The **Display** section on the Misc tab controls units:

- **Time**: Zulu (UTC) or local. Zulu is standard in aviation and avoids time-zone confusion when you share times with other pilots.
- **Speed**: knots or Mach.
- **Altitude**: Auto, feet, or flight levels (FL).

[Reading flight telemetry](/guides/reading-flight-telemetry) explains what each unit means.

## Keyboard shortcuts

These are the default radar shortcuts:

- **F**: follow the selected aircraft. Press again to stop following.
- **L**: cycle the flight label display mode, from minimal to detailed.
- **T**: toggle Heading Mode, for measuring headings and distances by dragging on the map.
- **U**: show or hide the radar interface, for a clean view of the map.
- **Ctrl + click**: add or remove an aircraft from the current selection, so you can compare several flights.

You can change the four letter shortcuts in the **Keybinds** section of the Misc tab. Select the action and press the new key. Letters, digits, and F1 to F12 are supported. Shortcuts are ignored while you are typing in a search box or text field.

**Shortcuts** in the control dock shows a reference card with your current bindings. It is worth opening once you have customised them.

### On mobile

Touch devices do not have a keyboard, so the radar provides quick toggles instead. Open the controls menu to switch following, aircraft labels, route waypoints, Heading Mode, and the radar UI.

### In GeoFS

The RadarThing userscript has its own keys inside the simulator:

- **W** opens and closes the RadarThing flight panel.
- **Q** opens and closes the airport charts panel.

Both keys can be changed from the userscript's settings if they clash with a GeoFS control you use.

## Layer presets

Once you have a setup you like, save it as a preset. The **Layer Presets** section at the top of the Map tab stores your base layer and overlays under a name of your choice.

Some preset ideas:

- **Departure watch**: OpenStreetMap, Runway Centerlines, labels on, Precipitation off.
- **En route**: OpenAIP, Waypoints, SIGMETs, Precipitation.
- **Controller**: Radar Mode, History Trails, Track Line, Conflict Alerts.

Select a preset to apply it instantly. The badge next to the section title shows the active preset, or *Manual* if you have changed something since applying one.

## Other dock tools

The control dock gives you quick access to the rest of the radar:

- **Flights**: a departures and arrivals board for live traffic.
- **Airports**: the airport activity board, with live traffic rankings, staffed airports, and the busiest routes.
- **Import Plan**: preview a route from a JSON file. See [Flight plans and navigation](/guides/flight-plans-and-navigation).
- **Leaderboard**: pilot rankings. See [Pilot stats and leaderboards](/guides/pilot-stats-and-leaderboards).
- **Radar Tour**: replay the guided tour of the radar.
- **Stats Rules**: the rules that decide whether a flight counts towards your statistics.

## Resetting your setup

If the map looks wrong and you are not sure why, work through this list:

1. Clear any callsign or airline filter.
2. Switch back to a base layer you know, such as OpenStreetMap.
3. Turn overlays off one at a time to find the one that is causing the problem.
4. Press **U** in case the interface is hidden.

Everything on the radar is for flight simulation and must not be used for real-world navigation.
