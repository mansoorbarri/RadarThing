# Leaderboards, streaks and challenges

Find out how RadarThing turns your recorded GeoFS flights into stats, why a flight might not count, how streaks work across time zones, and how to complete community challenges.

## Where your stats come from

Every flight the tracker records is saved to your pilot profile. From those records RadarThing calculates:

- **Total flights:** the number of counted flights.
- **Total flight time:** the recorded duration of each counted flight, added together.
- **Total distance:** the length of the route actually flown, measured along the recorded track in nautical miles. It is not the straight-line distance between airports, so a flight with holds or a long detour counts the miles you really flew.
- **Streaks:** consecutive days with at least one counted flight.
- **Top aircraft, routes and airports:** the ones you fly most often.

These numbers appear on your public pilot profile and drive the [leaderboard](/leaderboard). Because they are built from recorded data, a flight that was never tracked, for example because the userscript was not running, cannot be added later. If your flights are missing, start with [Aircraft not appearing](/guides/aircraft-not-appearing).

## Why a flight might not count

Some flights stay in your history but are left out of the stats. The radar's **Stats Rules** menu item lists the rules:

- **Speed over the normal limit.** For most aircraft, a flight is excluded if the recorded maximum speed is above **750 knots**. That is well above what an airliner can do, so it usually means a glitch, a teleport or a time-acceleration jump.
- **Speed over the high-performance limit.** Concorde and recognised military or high-performance aircraft are allowed up to **1,333 knots** before they are excluded.
- **Excluded after review.** RadarThing can keep a flight in your history but remove it from stats if it looks invalid, for example a "flight" that jumps across an ocean in seconds.

An excluded flight does not count toward total flights, flight time, distance, streaks, your top aircraft, routes and airports, or leaderboard and challenge progress. You can still replay it.

The simplest way to keep every flight counting is to fly normally: no teleporting mid-flight, no slewing across the map, and no unrealistic speeds.

## The leaderboard tabs

The [leaderboard](/leaderboard) ranks pilots in several ways:

- **Flights:** most counted flights.
- **Distance:** most nautical miles flown.
- **Time:** most flight time.
- **Streak:** longest run of consecutive flying days.
- **Contribution:** most approved [aircraft images](/guides/contributing-aircraft-images). It recognises pilots who help the gallery, not just those who fly the most.
- **Challenges:** standings for community challenges.

Each tab rewards a different style of flying. Long-haul pilots tend to top Distance and Time, while pilots who do short regional hops often lead on Flights and Streak.

## How streaks work

A streak is the number of consecutive calendar days on which you started at least one counted flight. Days are measured in **UTC**, not your local time, so everyone in the world is on the same calendar.

A few consequences are worth knowing:

- **The day a flight counts for is the UTC day it started.** A flight that starts at 23:30 UTC and lands at 01:30 UTC counts for the first day only.
- **Your current streak survives until the end of the next UTC day.** If you last flew yesterday (UTC), your streak is still shown as current. If a whole UTC day passes with no counted flight, it resets.
- **Local evenings can cross the UTC boundary.** In the Americas, an evening flight may already be "tomorrow" in UTC. In Asia and Oceania, a morning flight may still be "yesterday". If you are protecting a streak, check the time in UTC. The radar can show times in Zulu (UTC) from the Configuration panel.
- **Excluded flights do not count.** A flight removed from stats will not keep a streak alive.

Your longest streak is kept separately, so a broken current streak does not erase your record.

## Challenges

Challenges are goals set for the community. Each one has one or more rules, and you complete it by flying counted flights that satisfy all of them. Rule types include:

- **Airports:** visit a specific airport, depart from or arrive at one, fly a specific route between two airports, visit a number of unique airports, or visit a set number from a list of target airports.
- **Aircraft:** use a specific aircraft type, or any aircraft in a category.
- **Volume:** complete a number of flights.
- **Duration and distance:** fly at least, or at most, a certain number of minutes or nautical miles.

Some rules apply to **each counted flight**. For example, "Each counted flight: fly at least 120 minutes" means short hops do not contribute at all. Others apply to the **challenge as a whole**, such as "Visit 10 unique airports" across any number of flights.

Most challenges are checked automatically against your recorded flights. Some are marked **manual review required**. For those, a submission is reviewed by RadarThing before it is marked completed or rejected.

You can see active challenges from the radar, and your progress on your pilot profile.

### Tips for completing challenges

- **Read every rule before you fly.** A route challenge needs both the departure and arrival airports to match, so a diversion will not count.
- **Make sure departure and arrival are recognisable.** Start and finish your flight at an airport, not in the middle of a field, so the recorded flight has a clear origin and destination.
- **Check the aircraft type.** If a challenge needs a specific type, fly the aircraft that matches that type in GeoFS.
- **Avoid exclusions.** A flight excluded from stats will not count toward any challenge.

## Privacy and your public stats

Your stats and recent flights appear on your public pilot profile. If you want to reduce what is shown, check your account options in the [dashboard](/dashboard) and the [privacy policy](/privacy) for what is collected and how to request changes.
