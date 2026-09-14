# Aircraft not appearing on the radar

Check the simulator, tracker, and radar separately to narrow down why your flight is missing.

## First, check what is missing

Open [the radar](/radar) and look for other aircraft. If other flights are updating but yours is absent, begin with the GeoFS and script checks below. If the whole radar is empty or disconnected, also check your connection and filters.

RadarThing receives updates from participating pilots. An aircraft being visible in GeoFS does not by itself mean that its pilot is sending data to RadarThing.

## Confirm your GeoFS sign-in

Sign into your GeoFS account in the simulator tab. A RadarThing sign-in alone is not sufficient: signed-out GeoFS sessions are not displayed on the radar.

Let the simulator finish loading and start your flight. Keep this tab open during the checks. Closing the radar tab and closing the simulator tab have different effects: the tracker runs inside GeoFS, so closing GeoFS stops that session from sending updates.

## Check that the tracker is running

For a Tampermonkey installation:

1. Open the extension menu while you are on the GeoFS tab.
2. Confirm that both Tampermonkey and the RadarThing script are enabled for that page.
3. If you just installed or enabled the script, reload GeoFS and let it load again.
4. If the script is missing, install it from the [official installation link](/userscript), then repeat the check.

For a console installation, run the snippet from the [homepage](/#install) again after a full simulator page reload. A snippet run in the radar tab will not start tracking your GeoFS session; it needs to run in the simulator tab.

Avoid repeatedly installing extra copies of the script. Check the existing installation first.

## Clear filters and search again

A filtered map can hide an otherwise connected flight. Clear any callsign or airline filters you enabled, then search by your current callsign or pilot name. Check that you selected a live flight result rather than an airport or pilot profile result.

If search finds your aircraft away from the area you were viewing, select the result to locate it. A map centred on another airport does not mean your tracker has failed.

## Check the connection

Look at the radar's connection indicator. If traffic is not updating, confirm that both GeoFS and RadarThing can load on your network, then refresh the radar. Give it time to reconnect before testing again.

If a browser extension reports that it blocked a RadarThing request, inspect that specific rule. You do not need to disable all browser protection to diagnose a blocked request. A useful comparison is another browser profile with the required userscript extension enabled.

## Ask for help with useful details

If the flight is still missing, [contact support](/contact) with your browser, installation method, callsign, approximate time of the problem, whether GeoFS was signed in, and whether other flights were visible. Include the exact error text if the browser Console shows a failed RadarThing request.

Do not share cookies, account tokens, or an unreviewed full console dump. A short description of the failed step is more useful than repeatedly reinstalling the tracker.

After the aircraft appears, continue with [Using the radar](/guides/using-the-radar).
