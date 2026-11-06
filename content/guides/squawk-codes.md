# Squawk codes and transponders explained

What a four-digit squawk code means, which codes signal an emergency, and how RadarThing highlights them.

## What a transponder does

In real aviation, most aircraft carry a transponder. When a ground radar sweeps over the aircraft, the transponder replies with a short signal. That reply lets controllers see a labelled target with the aircraft's identity and altitude, instead of an anonymous blip.

The identity part of the reply is a four-digit code called a *squawk*. Controllers assign a squawk to each flight so that they can match a target on their screen with a flight plan. The word comes from early military identification systems, and it survives in everyday radio phraseology: "Speedbird 12, squawk 4521."

GeoFS lets pilots set a squawk code, and the RadarThing tracker sends it along with the rest of the flight's telemetry. When you select an aircraft on [the radar](/radar), its current squawk appears in the flight panel.

## How the codes are built

A squawk is four digits, and each digit runs from 0 to 7. There are no 8s or 9s. That is because each digit is an octal number, a historical consequence of how transponder replies are encoded. The full range is therefore 0000 to 7777, giving 4,096 possible codes.

If you ever see a code containing an 8 or a 9, it is not a valid transponder code.

## Codes worth knowing

Most codes are assigned by a controller for one flight and have no meaning on their own. A handful are reserved for specific situations worldwide.

### Emergency codes

- **7700: general emergency.** The pilot is declaring an emergency, such as an engine failure, a medical problem, or a fire. Real controllers prioritise this aircraft immediately.
- **7600: loss of communications.** The aircraft's radio has failed. The pilot can still hear nothing or transmit nothing, so the transponder becomes the only way to tell ATC there is a problem.
- **7500: unlawful interference.** This is the hijack code. In real aviation it triggers a serious security response.

A useful way to remember them: *seven-five, taken alive; seven-six, radio fix; seven-seven, going to heaven.* It is a grim rhyme, but pilots have used it for decades because it sticks.

### Common non-emergency codes

These conventions vary by country, so treat them as examples rather than universal rules:

- **1200** is the standard code for flights under visual flight rules (VFR) in the United States and Canada when no other code has been assigned.
- **7000** serves the same purpose in much of Europe and in many other countries.
- **2000** is often used for flights under instrument flight rules (IFR) entering an area without an assigned code.

In GeoFS, many pilots leave their transponder on its default value. If you fly with a group that runs simulated ATC, they may assign you a code at the start of your flight; set it as soon as you receive it.

## How RadarThing shows emergencies

When an aircraft is squawking 7500, 7600, or 7700, RadarThing treats it as an emergency squawk. The marker is drawn so that it stands out from normal traffic, and the selected-flight panel shows the meaning of the code next to the number. Hover over the squawk to see the explanation: *general emergency*, *loss of communications (radio failure)*, or *unlawful interference (hijack)*.

This makes emergencies easy to find on a busy map, and it means a simulated emergency is visible to anyone watching the radar, including community controllers.

## Squawk etiquette in a shared simulator

GeoFS is a shared space, and the radar is public. A few habits keep it useful for everyone:

1. **Only squawk an emergency code when you are flying an emergency scenario.** Practising an engine failure and a diversion is a great use of 7700. Setting 7500 as a joke clutters the radar and distracts anyone controlling traffic.
2. **If you are flying with simulated ATC, tell the controller.** Declaring the emergency on frequency or in the group's chat is good practice, just as in the real world. A squawk alone is easy to miss.
3. **Return to a normal code once the scenario is over.** If you landed after a simulated emergency, switch back to your assigned or default code before your next flight.
4. **Avoid emergency codes during community events.** Event organisers and controllers rely on the radar to manage busy airspace.

## Practising an emergency properly

If you want to practise a realistic emergency in GeoFS, try this sequence:

1. Pick a failure: an engine fire shortly after take-off is a classic.
2. Set **7700** and fly the aircraft first. In real aviation the priority order is *aviate, navigate, communicate*.
3. Choose a suitable diversion airport. Use the [radar's airport search](/guides/using-the-radar) to find one nearby with a long enough runway.
4. Plan a safe return: level off, run through what you would check, and set up for an approach.
5. Land, clear the runway, and set your normal code again.

Afterwards, open the flight in [your flight history](/guides/flight-history-and-replay) and replay it. Watching your altitude and vertical speed on the way back in is a good way to judge whether the approach was stable.

## Frequently asked questions

**Does RadarThing assign squawk codes?** No. The code is whatever the pilot has set in GeoFS.

**Why does an aircraft show no squawk?** The tracker only shows what the simulator reports. A missing value means no code was sent, not that the aircraft is in trouble.

**Can I find aircraft by squawk?** Yes. Radar search matches squawk codes as well as callsigns and airports, so searching for `7700` lists any aircraft currently squawking it. Emergency squawks are also highlighted on the map.

Squawk information on RadarThing comes from a flight simulator. It is never a real-world emergency report.
