# How conflict alerts work

What RadarThing's conflict alerts predict, how the thresholds work, and how to use them to fly more safely in shared GeoFS airspace.

## What a conflict alert is

In real air traffic control, a *short-term conflict alert* warns a controller when two aircraft are predicted to come too close. The controller then issues instructions to keep them apart.

RadarThing has a similar tool for GeoFS. When **Conflict Alerts** is turned on, the radar looks at every pair of airborne aircraft, projects their movement a few minutes into the future, and highlights any pair predicted to pass closer than a set distance both horizontally and vertically. The alert shows where the closest point will be, how close the aircraft will get, and how long until it happens.

Conflict alerts are a Pro feature. Turn them on under **Configuration → Visibility → Conflict Alerts**.

## How the prediction works

For each pair of aircraft, RadarThing takes each aircraft's current position, ground speed, heading, and vertical speed, and assumes it keeps doing exactly that. It then finds the moment the two aircraft would be closest to each other, called the **closest point of approach (CPA)**, within a look-ahead window.

At that moment, it checks two things:

1. **Horizontal separation**: the distance between the two aircraft over the ground.
2. **Vertical separation**: the difference in their altitudes.

If both are below the thresholds, the pair is a conflict.

### En-route thresholds

For aircraft away from the airport environment:

- **Look-ahead**: up to 6 minutes.
- **Horizontal**: closer than 3 nautical miles.
- **Vertical**: closer than 1,200 feet.

### Terminal thresholds

Near airports, aircraft are slower, closer together, and manoeuvring, so the en-route rules would produce constant false alarms. When either aircraft is below 1,800 feet above ground or slower than 180 knots, RadarThing uses tighter terminal rules:

- **Look-ahead**: up to 3 minutes.
- **Horizontal**: closer than 1.5 nautical miles.
- **Vertical**: closer than 700 feet.

### What is ignored

- **Surface traffic**: aircraft below 150 feet above ground and slower than 70 knots are treated as on the ground and never generate alerts.
- **Aircraft far apart**: pairs more than 30 nautical miles apart are not checked, because they cannot meet within the look-ahead window.
- **Aircraft in the same flow**: two aircraft heading within 18 degrees of each other, both climbing, cruising, or descending, and closing slowly, are treated as following each other in a stream. They only alert if they are already very close. Aircraft heading for the same next waypoint in the same phase of flight are treated the same way.

These rules keep the display focused on genuinely converging traffic rather than an orderly line of arrivals.

## Reading an alert

Each alert has a severity based on how close the two aircraft are predicted to get at the closest point:

- **High**: within 1.2 nautical miles and 700 feet.
- **Medium**: within 2 nautical miles and 1,000 feet.
- **Low**: any other predicted conflict inside the thresholds.

Severity does not depend on how soon the conflict will happen, so always check the time to the closest point as well. A low-severity alert 30 seconds away may need attention sooner than a high-severity one five minutes out.

The radar marks the predicted meeting point between the two aircraft and labels the pair with both callsigns. The conflict monitor also keeps a short log of recent events, so you can review an alert after it has cleared. Use the review button in the monitor to look back at what happened.

## Why predictions can be wrong

The prediction is a straight-line projection. It does not know about:

- **Planned turns.** An aircraft about to turn onto a new leg of its route may never reach the predicted meeting point.
- **Level-offs.** An aircraft climbing at 2,000 feet per minute towards a cleared level will stop climbing, but the prediction assumes it keeps going.
- **Update gaps.** If a tracker misses a few updates, its position on the map is older than the real one.

That is why alerts are a prompt to look, not a definitive judgement. Real controllers use their alerts in exactly this way.

## Using conflict alerts as a pilot

Conflict alerts are not just for people watching the radar. Here are ways to use them while you fly:

- **Watch your departure.** Busy GeoFS airports often have several aircraft departing in different directions with no ATC. If an alert involves you, consider an early turn or a level-off.
- **Choose sensible cruise levels.** Using odd flight levels when heading east and even ones when heading west, as described in [Planning a realistic flight](/guides/planning-a-realistic-flight), dramatically reduces head-on conflicts.
- **Check the arrival.** Before you join an approach, look at the radar for traffic already established on final.
- **Replay and learn.** After a close encounter, replay your flight from your [flight history](/guides/flight-history-and-replay) and look at what both aircraft were doing.

## Using conflict alerts as a controller

If you control traffic for a community server:

1. Turn on Conflict Alerts along with **Track Line** in Radar Mode, so you can see where each aircraft is going.
2. Use **Ctrl + click** to select both aircraft in a conflict and compare their altitudes and vertical speeds side by side.
3. Resolve the conflict with an altitude or heading instruction early, rather than waiting until the alert is about to expire.
4. Review the conflict log after a busy session to see where conflicts tend to happen. Repeated conflicts at the same place usually mean a procedure or sequencing problem.

## Frequently asked questions

**Why didn't I get an alert when another aircraft flew close to me?** Either one of you was considered surface traffic, you were in the same flow, or the encounter was outside the vertical threshold.

**Why did an alert appear and then vanish?** One of the aircraft changed heading, altitude, or vertical speed, and the new prediction no longer met the thresholds.

**Does RadarThing tell the pilots?** No. Alerts are shown on the radar only. If you are controlling, it is up to you to pass on traffic information.

Conflict alerts on RadarThing are a simulator tool. They are not a real-world collision avoidance system and must never be relied on for real flight.
