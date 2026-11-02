# Radar tools, keyboard shortcuts and presets

Get more out of the live radar: measure headings and distances, control what is drawn with the keyboard, compare several aircraft, and save layouts you use often.

## The default shortcuts

RadarThing has four keyboard shortcuts on [the radar](/radar):

- **F:** follow the selected aircraft.
- **U:** show or hide the radar interface.
- **L:** cycle the flight display.
- **T:** enter heading mode.

Shortcuts are ignored while you are typing in a search box or form, so searching for "FLT123" does not toggle Follow.

### Changing a shortcut

Open Configuration with the gear control, go to the **Misc** tab and find **Keybinds**. Click the binding you want to change, then press the new key. Letters, numbers and the function keys F1 to F12 can be used. Your bindings are saved in your browser, so set them once per device.

If someone tells you to "press T", remember they mean their own bindings. Check yours in Keybinds if a shortcut does nothing.

## Following an aircraft

Select an aircraft and press **F**, or use Follow in its flight panel. The map stays centred on the aircraft as it moves, and the button reads Following while the mode is on. Press F again to stop following.

Follow mode is the easiest way to watch a whole flight without touching the mouse, which makes it handy on a second monitor.

## Hiding the interface

Press **U** to hide every panel, menu and control, leaving just the map and traffic. Press U again to bring them back. Use it for screenshots, for streaming a clean radar picture, or for a calm "ATC scope" view on a spare screen.

## Cycling the flight display

Press **L** to cycle what is drawn for each flight:

1. **Default:** aircraft labels and route waypoints.
2. **Labels hidden:** route waypoints only.
3. **Waypoints hidden:** labels only.
4. **Minimal:** neither, just the aircraft symbols.

The Shortcuts menu has separate switches for labels and waypoints if you prefer to set them directly. Hiding labels is useful in busy areas, such as a big airport during an event, where overlapping text makes the map unreadable.

## Measuring heading and distance

Heading mode turns the mouse into a measuring tool, much like a controller's range-and-bearing line.

1. Press **T** to enter heading mode. The cursor changes.
2. Press and hold the mouse button on the starting point, for example an aircraft or an airport.
3. Drag to the end point. A dashed line follows the pointer, with a label showing the **heading** in degrees and the **distance** in kilometres and statute miles.
4. Release the mouse button to finish. Heading mode turns itself off.

The heading is a **true** bearing measured from true north, not a magnetic heading. In most of Europe and North America, magnetic variation is within about 20°, so allow for it if you use the number in GeoFS. For a rough conversion to nautical miles, divide the kilometres by 1.852.

Useful things to measure:

- The distance between two converging aircraft (see [Traffic conflict alerts](/guides/traffic-conflict-alerts)).
- How far an arriving aircraft is from the runway threshold, to judge its descent. A 3° glide path is about 300 feet per nautical mile.
- The heading to fly direct to an airport when planning a diversion.

## Comparing several aircraft

On desktop, hold **Ctrl** and click aircraft to add them to, or remove them from, the current selection. Their routes are drawn together, which is the best way to watch a group flight, compare two pilots flying the same route, or check whether two tracks really cross.

## Map layers and overlays

Configuration's **Map** tab controls what is drawn under and over the traffic:

- **Base layers:** OpenStreetMap for geographic context, OpenAIP for an aviation chart look with airspace and navaids, and Radar Mode (Pro) for a dark scope-style display.
- **Waypoints:** named navigation fixes, helpful when following SIDs and STARs from the [chart viewer](/guides/reading-airport-charts).
- **Precipitation:** live weather radar, available to everyone.
- **AIRMETs and SIGMETs (Pro):** advisories for hazardous weather such as icing, turbulence and thunderstorms.
- **Runway centerlines (Pro):** extended centrelines drawn out from each runway end when you are zoomed in. You can set how many nautical miles they extend. They make it easy to see whether an arriving aircraft is lined up with the runway.

In Radar Mode, Pro users also get **Radar Overlays** in the **Visibility** tab:

- **History trails:** fading dots behind each aircraft showing where it has been, like the afterglow on a real radar scope. You can choose the spacing by time or distance.
- **Track line:** a projected line ahead of each aircraft showing where it will be if it holds its heading.

## Saving layer presets

If you switch between layouts often, for example a weather-watching setup and a busy-airport setup, save them as presets. A preset stores your base layer, OpenAIP overlays, weather layers and conflict monitor state. Pick a preset from the Map tab to apply it in one click. The tab shows "Manual" when your current settings do not match a saved preset.

## Other useful panels

- **Airports:** live airport activity, including the busiest airports, airports with controllers online, and the city pairs with the most live flights right now. It is a quick way to find where the action is.
- **Filter:** show only flights whose callsigns start with a particular airline prefix.
- **Radar Tour:** replays the interactive introduction to the radar.

See [Using the radar](/guides/using-the-radar) for the basics of searching, selecting flights and reading the flight panel.
