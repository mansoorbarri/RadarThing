# Getting started with RadarThing

Install the tracker, put your first GeoFS flight on the live radar, and find it on the map.

## What you need

RadarThing is a live flight radar for the GeoFS flight simulator. Anyone can [open the radar](/radar) and watch traffic without installing anything or creating an account. To put your own flight on the radar, you need three things:

1. **A GeoFS account.** You must be signed in to GeoFS. Signed-out GeoFS sessions are not shown on RadarThing.
2. **The RadarThing userscript**, running in the browser tab where you fly GeoFS.
3. **A desktop browser that supports the Tampermonkey extension**, such as Chrome, Edge, Firefox, or Opera.

A RadarThing account is optional for tracking, but signing in with the same Google account you use in GeoFS unlocks extra features: your flight history on your dashboard, ACARS updates, and controlling your own aircraft from the radar.

## Step 1: Install Tampermonkey

[Tampermonkey](https://www.tampermonkey.net/) is a browser extension that runs small scripts, called userscripts, on the websites you choose. RadarThing uses it to run inside GeoFS.

Install it from your browser's extension store and make sure it is enabled.

In Chrome, Edge and other Chromium browsers you also need to let extensions run userscripts:

1. Open the extensions page (`chrome://extensions` or `edge://extensions`).
2. Choose **Details** under Tampermonkey.
3. Turn on **Allow User Scripts**. On older browser versions this switch doesn't exist; turn on **Developer mode** at the top right of the extensions page instead.

Firefox doesn't need this step.

## Step 2: Install the RadarThing userscript

Open the [RadarThing userscript](/userscript). Tampermonkey will show an installation page with the script's details. Review it and choose **Install**.

The installed script loads the latest RadarThing runtime each time you open GeoFS, so you get updates automatically. You never need to reinstall it for a new flight.

## Step 3: Open GeoFS and sign in

Open [GeoFS](https://www.geo-fs.com/geofs.php) and sign in to your GeoFS account. If GeoFS was already open when you installed the script, reload the page.

To confirm the script is running, open the Tampermonkey menu while on the GeoFS tab. The RadarThing script should be listed and enabled, with its own shortcuts underneath: **Show or hide the RadarThing panel**, **Open airport charts**, **Reset panel position** and **Open the RadarThing radar**. If you can see those, it's running.

## Step 4: Fill in the RadarThing panel and start tracking

This is the step most new pilots miss. The tracker does not send your position until you tell it about your flight.

1. In GeoFS, the RadarThing panel appears on the right of the simulator. The first time, it shows a short welcome card. If the panel is hidden, press **W** to show it.
2. Enter your **Departure** and **Arrival** airports as four-letter ICAO codes, for example **EGLL** and **KJFK**.
3. Enter your **Callsign**, such as **BAW117**. [Callsigns explained](/guides/callsigns-explained) covers the format.
4. Optionally enter a **Squawk** code. [Squawk codes explained](/guides/squawk-codes) explains what they mean.
5. If you are flying a military aircraft, tick **Military** and enter the air force name.
6. Press **Start tracking**.

The status at the top of the panel changes to **Connecting…** and then **Live on radar** once RadarThing receives your position. If the callsign is already in use by another pilot, the panel will tell you; add or change a digit and try again. If the status shows **Connection issue · retrying**, RadarThing keeps trying in the background.

While you are tracking, the panel folds into a one-line summary so it covers less of the simulator. To change your route, callsign or squawk mid-flight, press **Edit flight**, change the fields and press **Update flight**.

When you finish the flight, press **End flight**, then press it again to confirm (the button changes to **Click again to end**, or **Tap again to end** on a touch screen). RadarThing saves the flight. If you are signed in to RadarThing with the same Google account you use in GeoFS, it appears in your flight history on your dashboard. Most flights also count towards your statistics; [Pilot stats and leaderboards](/guides/pilot-stats-and-leaderboards) explains which ones are left out.

Press **W** to show or hide the panel and **Q** to open airport charts. You can change both keys under **Settings & shortcuts**.

## Step 5: Find your flight on the radar

Once the panel says **Live on radar**, open [the radar](/radar) in another tab, window, or device.

Search for your callsign. Choose the flight result to move the map to your aircraft and open its flight panel. You will see your altitude, speed, heading, route, and, if you have built a flight plan in GeoFS, your next waypoint. Press **F** or choose **Follow** to keep the map with your aircraft.

Search results are grouped by type: a flight result selects live traffic, a pilot result opens a profile, and an airport result moves the map to that airport. If you reach a profile when you expected the map, return to the radar and choose the flight result instead.

## Alternative: the console loader

The [homepage's installation section](/#install) also provides a console snippet for browsers where you cannot install extensions. Open GeoFS, open your browser's developer tools, and run the snippet in the Console after reviewing it. It loads the same runtime as the userscript.

The console method only lasts for that page session. After a full GeoFS reload, run it again. Use one method at a time so that you do not start two copies of the tracker.

## If your flight does not appear

Work through [Aircraft not appearing on the radar](/guides/aircraft-not-appearing). The most common causes are not pressing **Start tracking**, being signed out of GeoFS, and the script being disabled in Tampermonkey.

## Where to go next

- [Using the radar](/guides/using-the-radar): find flights, read the flight panel, and open airport charts.
- [Planning a realistic flight](/guides/planning-a-realistic-flight): a step-by-step method for an airline-style flight.
- [Flight history and replay](/guides/flight-history-and-replay): revisit and share your flights.
- [Radar settings and shortcuts](/guides/radar-settings-and-shortcuts): customise the map to suit you.

RadarThing is for simulator use only. Its traffic, weather, and charts are not intended for real-world navigation.
