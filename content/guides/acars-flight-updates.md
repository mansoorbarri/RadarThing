# ACARS flight updates

Publish short text updates from the cockpit so people watching your flight on the radar know what you are doing, and learn how to read and report updates from other pilots.

## What ACARS is

In real airliners, ACARS (Aircraft Communications Addressing and Reporting System) is a datalink that sends short text messages between the aircraft and the ground. Crews use it for things like departure clearances, weather requests, gate assignments, and position or delay reports to their airline's operations centre. It exists so that routine information doesn't have to compete with voice traffic on a busy radio frequency.

RadarThing borrows the name for a simpler idea: a short log of updates that a pilot writes during a flight and that anyone watching the aircraft on the radar can read. It is one-way, from the pilot to viewers. It is not a chat system, and it does not send anything back into the cockpit.

## Before you can publish

ACARS posting lives in the RadarThing panel inside GeoFS, which the userscript adds. You need:

1. The RadarThing tracker installed and running. See [Getting started](/guides/getting-started).
2. To be signed into GeoFS. ACARS is tied to your GeoFS account, so signed-out sessions cannot publish.
3. An active flight. The ACARS Updates section turns on once your flight is being tracked. The text box and Publish ACARS button stay disabled until then.

The first time you use ACARS on a browser, the script registers that browser as an ACARS device for your pilot account. This happens automatically. It stops other people from posting under your name from a different machine.

## Writing an update

Open the ACARS Updates section of the panel, type your message, and choose **Publish ACARS**. Each update:

- Can be **1 to 500 characters** long.
- Can be published **once every 30 seconds**. If you try sooner, you will be asked to wait.
- Belongs to the current flight. When you start a new flight, a new ACARS session begins, and updates from your previous flight stay behind.

Your most recent **20 updates** are kept. Publishing a 21st removes the oldest, so the log always shows the latest part of the story. You can also remove any of your own updates from the list in the panel.

## What to write

Good ACARS updates are short and useful to someone who has just clicked on your aircraft. Some ideas, in roughly the order a flight happens:

- **Before departure:** "EGLL–LIRF, BAW548, A320. Departing 27R via CPT, cruise FL360."
- **Climb or cruise:** "Level FL360, light chop over the Alps, ETA 1540Z."
- **Changes:** "Holding at ROKUM for 10 min, arrival traffic at KJFK."
- **Abnormal or training scenarios:** "Simulated hydraulic failure, diverting to EDDM." This pairs well with an [emergency squawk](/guides/emergency-squawk-codes) so viewers know it is a scenario.
- **Arrival:** "Landed 16R, taxiing to gate. Thanks for watching."

Times in Zulu (UTC) are a good habit because viewers are spread across time zones. Use real airport ICAO codes so people can search for them on the radar.

## Content rules

ACARS updates are public, so every update is screened before it is published. Updates containing profanity, slurs or hate speech are rejected with the message "This ACARS entry could not be published under the content rules", and the attempt is logged for moderators. The filter matches whole words and common letter substitutions, so ordinary aviation words such as "cockpit" or "pass" are not caught by accident.

Repeated abuse can lead to ACARS posting being switched off for a pilot. In that case you will see "ACARS posting is unavailable for this pilot". The wider rules in the [terms](/terms) apply to ACARS like everything else on RadarThing.

## Reading updates on the radar

Select an aircraft on [the radar](/radar). If the pilot has published updates for the current flight, the flight panel shows a **Pilot ACARS** section. Expand it to see the updates, latest first.

ACARS is especially useful when:

- An aircraft is doing something unusual, such as holding, circling or diverting, and you want to know why.
- You are following a friend or a virtual airline group flight and want to keep up without a separate chat.
- You are watching an event and want to know which runway or procedure a pilot is using.

## Reporting an update

If you see an update that breaks the rules, use the report action next to it. You need to be signed in to report, you cannot report your own entries, and each entry can only be reported once per person. Add a short reason (up to 2,000 characters) explaining the problem. Reports go to RadarThing moderators, who can remove the update and restrict the pilot's posting.

## Troubleshooting

- **The text box is greyed out.** Your flight is not active yet. Make sure the tracker shows you as tracked, then wait a moment.
- **"Sign in to GeoFS to publish ACARS".** You are flying signed out. Sign into GeoFS and reload the simulator.
- **"ACARS flight session is no longer active".** Your flight ended or restarted, for example after a GeoFS reload. Wait for the tracker to pick the new flight up, then publish again.
- **Updates do not appear on the radar.** Check that you are looking at the right aircraft and the current flight. Updates from earlier flights are not shown with a new session.

If none of that helps, work through [Aircraft not appearing](/guides/aircraft-not-appearing), since ACARS depends on the tracker working.
