# Traffic conflict alerts

Learn how RadarThing predicts when two GeoFS aircraft are heading for a loss of separation, what the alert colours mean, and why some close encounters are deliberately ignored.

## What separation means

In controlled airspace, real-world controllers keep aircraft apart using two numbers at the same time: a horizontal distance and a vertical distance. A common en-route standard is 5 nautical miles laterally or 1,000 feet vertically. Near airports, radar separation is often reduced to 3 nautical miles. Two aircraft are only in conflict when they are too close in **both** dimensions. A jet passing 2 miles directly above another, with 2,000 feet between them, is perfectly safe.

RadarThing's conflict monitor uses the same idea, with thresholds tuned for a simulator community where traffic is lighter and position updates arrive less often than on a real radar.

## Turning conflict alerts on

Open Configuration with the gear control on [the radar](/radar), go to the Visibility tab, and switch on **Conflict Alerts**. The monitor is part of RadarThing Pro. Free accounts see the switch with a Pro badge. See [pricing](/pricing) for details.

The setting is saved with your other radar preferences and can be stored in a layer preset, so you can keep a "busy airspace" preset with conflicts on and a "sightseeing" preset with them off.

## How a conflict is predicted

Every time traffic updates, RadarThing compares pairs of airborne aircraft that are reasonably close to each other. Aircraft more than 30 nautical miles apart are not compared. For each pair it:

1. Projects both aircraft forward along their current heading at their current ground speed.
2. Works out the closest point of approach within a lookahead window: **6 minutes** for en-route traffic and **3 minutes** when at least one aircraft is in the terminal area.
3. Checks whether, at that closest point, the pair would be inside both the horizontal and vertical thresholds.

The thresholds are:

- **En-route:** within 3 nautical miles horizontally and 1,200 feet vertically.
- **Terminal:** within 1.5 nautical miles horizontally and 700 feet vertically. An aircraft counts as terminal traffic when it is below 1,800 feet or slower than 180 knots, which covers aircraft on approach, departure or in a traffic pattern.

The projection assumes both aircraft hold their heading and speed. A turn, climb or descent changes the outcome, which is exactly what happens in real air traffic control: an alert is a prompt to look, not a certainty.

## Reading the alert colours

Each predicted conflict is drawn between the two aircraft and coloured by how close the closest approach would be:

- **Red (high):** 1.2 nautical miles or less and 700 feet or less vertically. That is very close in both dimensions.
- **Amber (medium):** within 2 nautical miles and 1,000 feet.
- **Yellow (low):** inside the alert thresholds but outside the two tighter bands above.

Up to 40 conflicts are drawn at a time so the map stays readable during big group flights.

RadarThing also keeps a list of recent conflict events, so an encounter you missed is still there after the aircraft have separated. Choose an event to review it: RadarThing selects the aircraft involved and draws their routes together, so you can see whether the paths actually cross or only run side by side for a moment. If one of the aircraft has since left the radar, the event can no longer be tied to live traffic, and RadarThing will say so.

## What the monitor deliberately ignores

A conflict monitor that fires constantly is worse than none, so several situations are filtered out:

- **Surface traffic.** Aircraft below 150 feet and slower than 70 knots are treated as on the ground. Taxiing aircraft at a busy airport are close together by design.
- **Formation and in-trail flying.** Two aircraft heading the same way, within about 18 degrees of each other and closing at less than 2 nautical miles per minute, are not flagged unless they are already inside the terminal horizontal threshold. Group flights in a loose line astern stay quiet. Genuinely close formation still shows up.
- **Distant pairs.** Anything more than 30 nautical miles apart is skipped before any prediction happens.

## Using alerts well

Conflict alerts are most useful when you are watching a busy area such as a fly-in, an airport event, or a virtual airline's hub at peak time:

- **Combine them with altitude colours.** Selected routes are coloured by altitude band, so two selected aircraft whose tracks are the same colour where they cross are flying at similar levels. See [altitude, flight levels and units](/guides/altitude-flight-levels-and-units).
- **Check the vertical trend.** An aircraft descending through another's level may clear the conflict in seconds.
- **Use heading mode to measure.** Press the heading-mode key (T by default) and drag between two aircraft to read the exact distance and bearing. See [radar tools and shortcuts](/guides/radar-tools-and-shortcuts).

## Limits to keep in mind

RadarThing only sees aircraft whose pilots run the tracker, and positions arrive in periodic updates, not continuously. An aircraft without the tracker is invisible to the monitor, and a pilot whose connection drops will freeze in place until it recovers. Treat alerts as a teaching and spectating aid.

Conflict alerts exist for simulator use only. They are not certified collision avoidance, and RadarThing must never be used for real-world navigation or traffic separation.
