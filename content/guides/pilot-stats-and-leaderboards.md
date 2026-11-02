# Pilot stats, streaks, and leaderboards

How RadarThing calculates your flight totals and streaks, why some flights do not count, and how the leaderboards rank pilots.

## Where your stats come from

Every flight you transmit with the RadarThing userscript is recorded against your pilot profile. When the flight ends, RadarThing adds it to your statistics: total flights, total flight time, total distance, your streak, and your most-flown aircraft, routes, and airports.

You can see your statistics in two places:

- **Your dashboard**, which shows your own profile and lets you manage your flights.
- **Your public pilot page**, which other pilots can open from the radar or the leaderboard.

Statistics only include flights that reached RadarThing. A flight flown with the tracker disabled, or with the RadarThing panel never transmitted, cannot be added afterwards. If your flights are not being recorded, start with [Aircraft not appearing on the radar](/guides/aircraft-not-appearing).

## What counts as a flight

A flight begins when you press **Transmit** in the RadarThing panel and ends when you clear or disconnect it, or when RadarThing stops receiving updates. If the simulator disconnects unexpectedly, the userscript will offer to resume your previous flight the next time you load GeoFS, so a short interruption does not have to split one journey into two records.

Distance is measured along the route you actually flew, not as a straight line between airports. Flight time is the time between the start and end of the recording.

## Why a flight might not count

Some flights remain in your history but are excluded from statistics. This keeps the leaderboards fair: GeoFS makes it possible to accelerate time or teleport, and a single unrealistic flight could otherwise dominate the rankings.

A flight is excluded from statistics when:

- **Its maximum recorded speed is above 750 knots.** This catches accelerated simulation and slew in most aircraft.
- **It is a Concorde or a recognised military or high-performance aircraft and its maximum speed is above 1,333 knots.** These aircraft can legitimately fly faster than 750 knots, so they have a higher limit.
- **It has been reviewed and judged invalid.** RadarThing may exclude a flight that is clearly unrealistic, such as one with impossible jumps in position.

An excluded flight still appears in your flight history and can still be replayed. It is simply skipped when your totals are calculated. You can read the same rules at any time from **Stats Rules** in the radar's control dock.

Excluded flights affect:

- Total flights, flight time, and distance.
- Current and longest streaks.
- Top aircraft, routes, and airports.
- Leaderboard positions and challenge progress that depend on counted flights.

## How streaks work

Your streak counts consecutive days on which you completed at least one counted flight.

- Days are measured in **UTC**, not your local time zone. A flight that starts at 23:30 UTC counts for that UTC day, even if it is already the next day where you live.
- A flight counts towards the day on which it **started**.
- Your **current streak** stays alive as long as your most recent counted flight was today or yesterday (UTC). If you miss a full UTC day, it resets to zero.
- Your **longest streak** is the longest run of consecutive days in your whole history.

If you are trying to keep a streak going, it is worth switching the radar to Zulu time under **Configuration → Misc → Time** so that you always know which UTC day it is.

## The leaderboards

The [leaderboard](/leaderboard) ranks pilots across several tabs:

- **Flights**: the number of counted flights.
- **Distance**: the total distance flown in counted flights.
- **Time**: the total flight time in counted flights.
- **Streak**: current flying streaks.
- **Contribution**: the number of approved aircraft images a pilot has contributed to the gallery. See [Contributing aircraft images](/guides/contributing-aircraft-images).
- **Challenges**: the top pilots in each active pilot challenge. See [Pilot challenges](/guides/pilot-challenges).

Select a pilot's name to open their public page and see how they got there.

## Making the most of your stats

Statistics are more fun when they tell you something about your flying. A few ideas:

- **Fly a new aircraft each week.** Your top aircraft list will show how varied your flying has become.
- **Visit new airports.** Many challenges reward visiting unique airports, and it is the best way to see more of the world in GeoFS.
- **Fly regular routes.** A route you fly often appears in your top routes, and comparing replays shows how your technique improves.
- **Aim for realistic flights.** Long flights at realistic speeds add up quickly in the Time and Distance rankings, and they never risk being excluded.

## Flight history and access

Free accounts can view their 10 most recent flights on pilot profiles. Pro unlocks the full flight history, and also lets you create shareable flight card images summarising a flight. [Flight history and replay](/guides/flight-history-and-replay) explains how to browse and replay your flights, and [pricing](/pricing) has current plan details.

## Managing your flights

From your dashboard you can delete your own flights. Deleting a flight removes it from your history and your statistics. This cannot be undone, so only delete flights you are sure you no longer want, such as an accidental test.

Your dashboard also lets you export your account data, and hide personal details such as your name and email when you are sharing your screen.

## Frequently asked questions

**My flight is in my history but my totals did not change.** It was probably excluded by one of the rules above. Check its maximum speed.

**My streak reset even though I flew yesterday.** Check the UTC date of the flight. A late-evening flight in the Americas, or an early-morning flight in Asia, may fall on a different UTC day than you expect.

**Can I appeal an excluded flight?** If you believe a flight was excluded by mistake, [contact support](/contact) with the flight's replay link.
