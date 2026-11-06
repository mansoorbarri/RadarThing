# Reading flight telemetry on the radar

Understand what altitude, speed, heading, and vertical speed are telling you, and how to read them the way a controller would.

## Why telemetry matters

A dot on a map tells you where an aircraft is. Telemetry tells you what it is doing. When you select a flight on [the radar](/radar), the flight panel shows the values sent by that pilot's tracker: altitude, ground speed, heading, vertical speed, and, when a flight plan is loaded, the route and next waypoint.

Learning to read those numbers together is the difference between watching traffic and understanding it. An aircraft at 4,000 feet, 210 knots, descending at 800 feet per minute, and pointing at an airport is almost certainly on an approach. The same aircraft at 4,000 feet climbing at 2,500 feet per minute has just departed. Nothing on the map itself changes between those two cases; only the telemetry does.

This guide explains each value, the units RadarThing can display it in, and some patterns that make traffic easier to interpret.

## Altitude: feet and flight levels

Altitude is shown above mean sea level. RadarThing can display it in three ways, which you choose under **Configuration → Misc → Altitude**:

- **Feet** shows the raw altitude, for example 7,500 ft.
- **FL** shows a flight level: the altitude in hundreds of feet. 35,000 feet becomes FL350.
- **Auto** switches between the two depending on how high the aircraft is, which mirrors how real-world controllers talk about lower and higher traffic.

In real aviation, flight levels are based on a standard pressure setting rather than the local altimeter setting, and the switch between feet and flight levels happens at the *transition altitude*, which varies by country. In the United States it is 18,000 feet; in much of Europe it is far lower. GeoFS does not simulate those pressure differences, so on RadarThing a flight level is simply a convenient way to read a high altitude. The Auto option is a good default if you are not sure which you prefer.

### Altitude colours on routes

When a selected flight's route is drawn, the line is coloured by altitude band:

- Below FL100 (under 10,000 feet)
- FL100 to FL199
- FL200 to FL299
- FL300 to FL399
- FL400 and above

Segments without usable altitude data are drawn in a neutral grey labelled *no telemetry*. The colour change makes a flight profile easy to read at a glance: a long-haul flight will show a short low-level segment near each airport and a long stretch of one cruise colour in the middle. A route that changes colour repeatedly in cruise usually means the pilot was stepping up or down between altitudes.

## Speed: knots and Mach

Speed is shown in knots by default. A knot is one nautical mile per hour, about 1.15 statute miles per hour or 1.85 kilometres per hour. Aviation uses nautical miles because one nautical mile corresponds to one minute of latitude, which makes distance on charts easy to measure.

You can switch to **Mach** under **Configuration → Misc → Speed**. Mach number is the aircraft's speed as a fraction of the speed of sound. Airliners typically cruise around Mach 0.78 to 0.85. Because the speed of sound falls as air gets colder, the same Mach number corresponds to a lower speed in knots at high altitude than near the ground. That is why real jets fly a target Mach number in cruise rather than a fixed number of knots.

### What the speed value represents

The speed reported by the tracker is closest to *ground speed*: how fast the aircraft is moving over the surface. In real aviation, pilots fly *indicated airspeed*, which is what the wings feel. At altitude these numbers differ substantially. An airliner cruising at 35,000 feet might indicate about 280 knots while covering ground at 480 knots or more, especially with a tailwind.

Keep this in mind when you compare traffic. An aircraft showing 250 knots at 8,000 feet is flying a normal climb or descent speed. An aircraft showing 250 knots at 37,000 feet is probably very slow for that altitude, or has a strong headwind.

## Heading and track

Heading is the direction the aircraft's nose is pointing, in degrees from 000 to 359, where 090 is east, 180 is south, and 270 is west. Track is the direction it is actually moving over the ground. With wind, the two can differ by several degrees.

On the radar, the aircraft marker is rotated to its heading. In Radar Mode, a Pro map layer, you can turn on **Track Line** to draw a short projected line ahead of each aircraft. That line is the quickest way to see where traffic is going in the next few minutes, and it helps you spot aircraft converging on the same point.

## Vertical speed

Vertical speed is the rate of climb or descent in feet per minute. Positive values mean climbing; negative values mean descending. Some useful reference points:

- **Level flight**: close to zero. Small fluctuations are normal.
- **Normal airliner climb**: roughly 1,500 to 3,000 ft/min early in the climb, dropping as the aircraft gets higher.
- **Normal descent**: roughly 1,000 to 2,500 ft/min.
- **Final approach**: about 700 to 800 ft/min for a typical 3-degree glide path at airliner approach speeds.

A very high descent rate close to the ground is the clearest sign that an approach is not stabilised. When you replay your own flights, watch this value on final; it is one of the best ways to improve your landings.

## Reading the numbers together

Here are some common combinations and what they usually mean:

- **Low altitude, low speed, near zero vertical speed, near an airport**: taxiing or holding. Surface traffic is excluded from conflict alerts for this reason.
- **Low altitude, increasing speed, high climb rate**: a departure.
- **Steady high altitude, steady speed, near zero vertical speed**: cruise.
- **Decreasing altitude, around 250 knots, descent of 1,500 to 2,500 ft/min**: descent towards the arrival.
- **Below 3,000 feet, 130 to 160 knots, descent around 700 ft/min, lined up with a runway**: final approach.

None of these are rules; GeoFS pilots fly everything from gliders to fighter jets. They are a starting point for interpreting what you see.

## When values look wrong

Telemetry comes from the pilot's simulator through the tracker. A few things can produce odd values:

- **Missing values** mean the tracker did not send that field. A missing value is not the same as zero.
- **Sudden jumps** in position or altitude can follow a simulator reload, a pause, or the pilot using GeoFS's slew or teleport features.
- **Very high speeds** usually come from accelerated simulation or slew. Flights recorded above 750 knots (or 1,333 knots for Concorde and recognised high-performance military aircraft) are kept in history but excluded from pilot statistics. See [Pilot stats, streaks, and leaderboards](/guides/pilot-stats-and-leaderboards) for the full rules.

## Choosing your units

Open **Configuration** from the gear control on the radar and use the **Misc** tab to choose:

- **Time**: Zulu (UTC) or local time.
- **Speed**: knots or Mach.
- **Altitude**: Auto, feet, or flight levels.

Your choices are saved in your browser. If you fly with friends or a virtual airline, agreeing to use Zulu time avoids confusion about departure and arrival times across time zones.

RadarThing data is for simulator use only and must never be used for real-world navigation or flight planning.
