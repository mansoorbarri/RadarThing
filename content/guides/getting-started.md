# Getting started with RadarThing

Track your GeoFS flight, find other participating pilots, and open your flight details on the live map.

## Before you start

RadarThing tracks flights in the GeoFS simulator. You can [open the radar](/radar) to watch traffic without installing anything or creating a RadarThing account. To send your own position, you need GeoFS and the RadarThing userscript running in your simulator browser.

Use a browser that supports the Tampermonkey extension. Keep the GeoFS tab open while flying; the radar is a separate view of the position updates sent by the script.

## Install the script

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser. Follow its browser-specific setup instructions and make sure the extension is enabled.
2. Open the [RadarThing userscript](/userscript). Tampermonkey should display an installation page. Review it and choose Install.
3. Open [GeoFS](https://www.geo-fs.com/geofs.php) and sign into your GeoFS account before flying. Signed-out GeoFS sessions are not shown on RadarThing.
4. If GeoFS was already open when you installed the script, reload the simulator. Check Tampermonkey's menu on that tab to confirm the RadarThing script is enabled.

The installed script loads the current RadarThing runtime. You do not need to copy a new script for each flight.

## Start tracking your flight

When GeoFS loads, the RadarThing panel appears on the right of the simulator. The first time, it shows a short welcome card.

1. Enter your departure and arrival airports as 4-letter ICAO codes (for example EGLL and KJFK) and your callsign.
2. Press **Start tracking**. The status at the top of the panel changes to **Connecting…** and then **Live on radar** once RadarThing receives your position.
3. When you land, press **End flight** and then **Tap again to end**. The flight is saved to your history.

Press **W** to show or hide the panel and **Q** to open airport charts. You can change both keys under **Settings & shortcuts**. If the status shows **Connection issue · retrying**, RadarThing keeps trying in the background; see [Aircraft not appearing](/guides/aircraft-not-appearing) if it doesn't recover.

## Find your first flight

Once the panel says **Live on radar**, open [RadarThing](/radar) in another tab or window.

Search for your callsign or pilot name. Choose a flight result to locate the aircraft and open its details. You should see a marker on the map and a panel with the available aircraft, altitude, speed, and route information. Select Follow if you want the map to stay with that aircraft.

A pilot search result opens a profile, while a flight result selects live traffic. If you reach a profile when you expected the map, return to the radar and choose the flight result instead.

## Use the console loader as an alternative

The [homepage's installation section](/#install) also provides a console snippet. Open GeoFS, open your browser's developer tools, and run the snippet in the Console after reviewing it. This loads the same runtime used by the installed userscript.

The console method lasts for that page session. After a full GeoFS reload, run it again. Choose one installation method for your session so that you do not accidentally start multiple copies of the tracker.

## What to do next

If your flight does not appear, work through [Aircraft not appearing](/guides/aircraft-not-appearing). Once it is visible, [Using the radar](/guides/using-the-radar) explains selection, filters, map layers, and flight details.

RadarThing is for simulator use. Its traffic and community resources are not intended for real-world navigation.
