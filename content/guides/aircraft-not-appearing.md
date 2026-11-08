# Aircraft not appearing on the radar

Check the simulator, tracker, and radar separately to narrow down why your flight is missing.

## First, check what is missing

Open [the radar](/radar) and look for other aircraft. If other flights are updating but yours is absent, begin with the GeoFS and script checks below. If the whole radar is empty or disconnected, also check your connection and filters.

RadarThing receives updates from participating pilots. An aircraft being visible in GeoFS does not by itself mean that its pilot is sending data to RadarThing.

## Confirm your GeoFS sign-in

Sign into your GeoFS account in the simulator tab. A RadarThing sign-in alone is not sufficient: signed-out GeoFS sessions are not displayed on the radar.

Let the simulator finish loading and start your flight. Keep this tab open during the checks. Closing the radar tab and closing the simulator tab have different effects: the tracker runs inside GeoFS, so closing GeoFS stops that session from sending updates.

## Check that your flight is live

The tracker only sends your position after you enter your flight details and press **Start tracking**. This is the most common reason a new pilot's aircraft is missing.

1. In GeoFS, find the RadarThing panel on the right of the simulator. If it is hidden, press **W** to show it.
2. Check that **Departure**, **Arrival**, and **Callsign** are filled in. All three are required.
3. Press **Start tracking**.
4. Check the status at the top of the panel. It should change from **Connecting…** to **Live on radar**, with the time since the last update next to it (for example *· 3s ago*).

What the other statuses mean:

| Status | What it means | What to do |
|---|---|---|
| **Not tracking** | Your flight isn't being sent. | Fill in the panel and press **Start tracking**. |
| **Waiting for your aircraft…** | GeoFS hasn't placed your aircraft yet. | Wait for the simulator to finish loading. |
| **Connection issue · retrying** | Updates aren't reaching RadarThing. | It keeps retrying by itself. Press **Retry now** to try straight away. |
| **Can't reach RadarThing · retrying** | Several attempts in a row have failed. | Check your connection, then press **Retry now**. |
| **Offline · waiting for network** | Your browser has no network. | Tracking resumes as soon as you're back online. **Retry now** is hidden until then, because it can't help without a connection. |
| **RadarThing is busy · retrying** | The server asked for fewer updates for a moment. | Nothing; it slows down and carries on. |
| **Update rejected · check your flight info** | The server refused the flight details. | Check the airports and callsign, then press **Edit flight** and **Update flight**. |
| **Route too long · remove waypoints** | Your GeoFS flight plan has too many waypoints. | Remove some waypoints in GeoFS. |

If the panel reports *Callsign already in use*, another pilot is flying with that callsign. Change a digit and press **Start tracking** again. If it reports that the squawk is invalid, the squawk must be four digits, each 0–7, or left empty.

If GeoFS disconnected unexpectedly, the panel may offer to resume your previous flight when you reload. Accept it to continue the same recording.

## Check that the tracker is running

For a Tampermonkey installation:

1. Open the extension menu while you are on the GeoFS tab.
2. Confirm that both Tampermonkey and the RadarThing script are enabled for that page. The Tampermonkey menu also has RadarThing shortcuts: **Show or hide the RadarThing panel**, **Open airport charts**, **Reset panel position** and **Open the RadarThing radar**. If you can see these, the script is running.
3. If you just installed or enabled the script, reload GeoFS and let it load again.
4. In Chrome, Edge and other Chromium browsers, open the extensions page, choose **Details** under Tampermonkey and make sure **Allow User Scripts** is on. Without it, Tampermonkey shows the script as enabled but never runs it.
5. If the script is missing, install it from the [official installation link](/userscript), then repeat the check.

For a console installation, run the snippet from the [homepage](/#install) again after a full simulator page reload. A snippet run in the radar tab will not start tracking your GeoFS session; it needs to run in the simulator tab.

Avoid repeatedly installing extra copies of the script. Check the existing installation first.

## Clear filters and search again

A filtered map can hide an otherwise connected flight. Clear any callsign or airline filters you enabled, then search by your current callsign or pilot name. Check that you selected a live flight result rather than an airport or pilot profile result.

If search finds your aircraft away from the area you were viewing, select the result to locate it. A map centred on another airport does not mean your tracker has failed.

## Check the connection

Look at the radar's connection indicator. If traffic is not updating, confirm that both GeoFS and RadarThing can load on your network, then refresh the radar. Give it time to reconnect before testing again.

If a browser extension reports that it blocked a RadarThing request, inspect that specific rule. You do not need to disable all browser protection to diagnose a blocked request. A useful comparison is another browser profile with the required userscript extension enabled.

## Ask for help with useful details

If the flight is still missing, [contact support](/contact) with your browser, installation method, callsign, what the status at the top of the panel said (for example **Live on radar** or **Connection issue · retrying**), approximate time of the problem, whether GeoFS was signed in, and whether other flights were visible. Include the exact error text if the browser Console shows a failed RadarThing request.

Do not share cookies, account tokens, or an unreviewed full console dump. A short description of the failed step is more useful than repeatedly reinstalling the tracker.

After the aircraft appears, continue with [Using the radar](/guides/using-the-radar).
