# Flight history and replay

Use a pilot's recorded flights to revisit a route, inspect the available track, and share a replay.

## Find the pilot's records

From [the radar](/radar), search for a pilot and open their profile. You can also use the highlighted Pilot link in a selected aircraft's flight panel when a profile is available.

The profile's flight history panel lists recorded flights. Use the callsign, aircraft, route, and time to identify the session you want. History search can match details such as airport codes, callsigns, aircraft types, and dates.

Recording depends on the tracker sending information from GeoFS. A flight that never reached RadarThing will not become a complete recording just because you open its profile afterwards. If current flights are missing too, start with [the tracker troubleshooting guide](/guides/aircraft-not-appearing).

## Understand the access limits

Free access includes the most recent 10 flights on pilot profiles. Pro unlocks the full flight history. The live radar sidebar has a separate History tab whose past-flight list requires Pro; use the pilot profile for the free recent-flight view.

A restricted history view does not necessarily mean the record was deleted. Check the plan and the part of the site you are using before treating an unavailable older flight as a recording failure. See [pricing](/pricing) for the current plan details.

## Open a replay

Choose the replay action for a flight with recorded route data. RadarThing opens the radar with that flight selected for replay. The replay controls let you play or pause, move along the timeline, and change playback speed.

Start at normal speed to understand the departure or approach. Use a faster speed to cross a long cruise segment, then pause or move along the timeline to inspect a specific part of the route. Replay follows the recorded data; it does not control the live aircraft in GeoFS.

A record needs usable route points to replay. A flight entry can contain summary information even when it has too little route data for a meaningful replay. Gaps in updates also limit what can be reconstructed between recorded positions.

## Share a flight

Use the flight's share action to copy its replay link. The link opens RadarThing with that flight's replay identifier, so the recipient can go directly to the recording instead of searching for the pilot again.

If copying fails, check whether the browser allows clipboard access and try again. Sharing a link does not override access restrictions or restore a deleted record.

## When the replay looks incomplete

Confirm that you chose the correct session by checking the callsign and flight time. If the track starts late or ends early, consider whether the GeoFS tab was reloaded, closed, or disconnected during the flight.

For repeated problems, [contact support](/contact) with the replay link, approximate flight time, and the part of the route that appears missing. That makes it possible to investigate the specific record.
