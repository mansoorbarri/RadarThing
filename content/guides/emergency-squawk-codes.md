# Emergency squawk codes: 7500, 7600 and 7700

Understand what the three emergency transponder codes mean, how RadarThing highlights them, and how to use them responsibly in GeoFS.

## What a squawk code is

A transponder replies to radar interrogations with a four-digit code, known as a squawk. Each digit runs from 0 to 7 because the code is octal, so there are 4,096 possible combinations. In real-world flying, air traffic control usually assigns a discrete code to each flight so that one aircraft can be told apart from another on a radar screen. Pilots set it on the transponder panel and keep it until ATC asks them to change it.

A small number of codes have fixed meanings everywhere. Some vary by country, such as 1200 for VFR flights in the United States and 7000 for VFR in much of Europe. Three are reserved worldwide for emergencies, and those are the ones RadarThing treats specially.

## The three emergency codes

**7700: general emergency.** This is the catch-all distress code: an engine failure, fire, a medical problem on board, structural damage, or any other situation where the aircraft needs priority. In the real world, setting 7700 sets off an alarm on every radar display that can see the aircraft, not only the controller working the flight.

**7600: loss of communications.** The pilot cannot talk to ATC, usually because of a radio failure. Controllers who see 7600 expect the aircraft to follow published lost-communication procedures. Broadly, that means flying the last assigned route and altitude and continuing to the destination, so they keep other traffic clear of its predictable path.

**7500: unlawful interference.** This code means a hijacking. It is the most serious of the three and is handled as a security event, not a technical problem. A common memory aid is "75: taken alive, 76: radio fix, 77: going to heaven". It is blunt, but it helps people remember which is which.

## Setting your squawk in GeoFS

RadarThing reads your squawk from the RadarThing panel that the userscript adds to GeoFS. Enter the four digits in the **Squawk** field alongside your departure, arrival and callsign, then choose **Transmit**. The radar picks up the new code on your next position update. Only the digits 0–7 are valid in a real transponder code, so a value such as 7800 does not exist.

## How RadarThing shows an emergency

When an aircraft on the radar transmits 7500, 7600 or 7700, RadarThing changes how it is drawn:

- The aircraft marker pulses so it stands out against normal traffic.
- Its map label switches from the usual cyan to red and gains a flashing exclamation mark.
- In the flight panel, hovering over or focusing the squawk value shows a short tooltip with its meaning, for example "7600: Loss of communications (radio failure)".

Any other squawk value is shown as plain data with no special styling. The radar reads the code exactly as the pilot's tracker reports it, so a pilot who switches back to a normal code returns to the normal display on the next position update.

In Radar Mode, the aircraft's track line is also drawn in red instead of the usual colour, so you can still pick out the emergency when labels are hidden.

## Watching an emergency as a radar viewer

Seeing a red, pulsing target is a good time to slow down and watch, not to jump to conclusions. Select the aircraft to open its panel and check:

- **Altitude and speed trend.** A steady descent toward a nearby airport suggests a diversion. A sudden loss of speed may mean an engine-out exercise.
- **Route and destination.** Pilots practising a 7700 scenario often divert to the closest suitable airport. Search for airports nearby to see where they might be heading.
- **ACARS updates.** If the pilot publishes [ACARS updates](/guides/acars-flight-updates), they may explain the scenario, for example "Simulated engine fire, diverting to EGCC".

Use Follow in the flight panel if you want the map to stay with the aircraft while the situation develops.

## Using emergency codes in GeoFS

Simulators are a good place to practise abnormal procedures, and squawking 7700 during a realistic emergency scenario is part of that. A few habits keep the shared radar useful for everyone:

1. **Only squawk an emergency code when you are flying an emergency scenario.** Leaving 7700 on for a whole flight teaches viewers to ignore red targets.
2. **Pick the code that matches the scenario.** A radio failure is 7600, not 7700. If an aircraft has both a radio failure and another emergency, pilots in the real world generally use 7700.
3. **Avoid 7500 unless you have a specific reason.** In the real world, unlawful interference brings an armed response, and in a community setting it is easily mistaken for trolling. Practising lost-communication or general emergencies is far more useful for learning procedures.
4. **Switch back when the scenario ends.** Once you have landed or the scenario is over, set a normal code in the Squawk field, such as 1200 or 7000 (whichever matches the region you are flying in), or 2000 when flying oceanic.
5. **Tell people what is going on.** A short ACARS update explaining the scenario saves viewers from guessing.

## Practising the procedure properly

If you want the scenario to feel realistic, fly the procedure, not just the code:

- For **7700**, pick the nearest suitable airport, consider the runway length your aircraft needs, and plan a descent that does not overspeed the airframe.
- For **7600**, keep flying the route you were cleared for. Real lost-communication rules have pilots fly the last assigned or expected altitude and route, then begin the approach close to the time they had planned. It is a good exercise in flight-plan discipline.
- After landing, take a look at your [flight history replay](/guides/flight-history-and-replay). It shows exactly how your descent and approach looked from the outside.

## A reminder about real-world use

RadarThing shows simulator traffic from GeoFS only. The codes and procedures above are explained for learning and simulator use, and the radar must never be used for real-world flight planning, navigation or emergency handling.
