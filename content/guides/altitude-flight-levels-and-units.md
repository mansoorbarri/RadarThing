# Altitude, flight levels, speed and time on the radar

Understand the numbers in a RadarThing flight panel, including feet versus flight levels, why Mach is an estimate, and when to use Zulu time, and choose the units that suit you.

## Changing units

Open Configuration with the gear control on [the radar](/radar) and go to the **Misc** tab. You can set:

- **Time:** Zulu or Local.
- **Speed:** Knots or Mach.
- **Altitude:** Auto, Feet or FL.

Your choices are saved in your browser and apply to every aircraft you select. If you share a screenshot with someone, mention your units, because their radar may be set up differently.

## Altitude: feet and flight levels

Aircraft altimeters measure air pressure and convert it to an altitude. Because air pressure changes with the weather, pilots set the altimeter to the local pressure (QNH) when they are low down, so that the reading matches the real height above sea level. Near the ground, that accuracy matters for terrain and obstacle clearance.

Higher up, terrain is no longer the concern, and what matters is that every aircraft uses the **same** reference so they can be separated vertically. Above the **transition altitude**, pilots switch to the standard pressure setting of 1013.25 hPa (29.92 inHg). Altitudes are then called **flight levels**: the altitude in hundreds of feet on the standard setting. 35,000 feet becomes **FL350**, and 8,000 feet becomes FL080.

The transition altitude varies by country. In the United States and Canada it is 18,000 feet. In much of Europe it is between 3,000 and 7,000 feet, and each airport publishes its own.

### RadarThing's altitude modes

- **Auto (default):** shows feet below 18,000 feet and flight levels from 18,000 feet upward. 12,500 feet shows as "12,500", and 36,000 feet as "FL360". This follows the North American convention, and it is a good general-purpose default.
- **Feet:** always shows feet, for example "36,000".
- **FL:** always shows a three-digit flight level, for example "FL360" or "FL085". This is useful if you fly in Europe and are used to low transition altitudes.

Altitudes in the flight panel are above mean sea level (MSL), as the label underneath says. The simulator's altitude is used as reported. RadarThing does not model a local pressure setting, so treat feet and flight levels as two views of the same number, not as a pressure-corrected conversion.

## Altitude colours on routes

When you select an aircraft, its route is drawn in colours that show how high it was along the way:

- **Light blue:** below FL100.
- **Cyan:** FL100 to FL199.
- **Green:** FL200 to FL299.
- **Amber:** FL300 to FL399.
- **Red:** FL400 and above.
- **Grey:** parts of the route with no altitude telemetry.

This makes it easy to see where a flight reached cruise, where it started descending, and whether a climb was smooth or stepped. It works in [flight replays](/guides/flight-history-and-replay) too, which makes it a good tool for reviewing your own descents.

## Speed: knots and Mach

RadarThing receives **indicated airspeed in knots (KIAS)** from GeoFS. Indicated airspeed is what the airspeed indicator shows, and it is what pilots fly by: stall speeds, flap limits and approach speeds are all given in indicated airspeed.

It is not the same as **ground speed**, the speed over the ground. As an aircraft climbs, the air gets thinner, so the same indicated airspeed means a higher true airspeed. An airliner cruising at FL370 may show about 260 knots indicated while actually travelling at roughly 450 knots true airspeed, plus or minus the wind.

**Mach** is speed as a fraction of the speed of sound. Jets cruise by Mach because the speed of sound falls as the air gets colder with altitude, and the aircraft's high-speed limits are set by Mach. Typical cruise numbers are around Mach 0.78 to 0.80 for an A320 or B737, and about 0.84 to 0.86 for a B777 or A350.

When you pick Mach, RadarThing **estimates** it from the indicated airspeed and altitude using the International Standard Atmosphere, and labels it "MACH EST". It is usually close, but it will not exactly match what the simulator's own Mach display shows, because real temperatures and pressures differ from the standard model.

A good habit is to use knots below about FL250 (climb, approach and general aviation) and Mach for jets in the cruise.

## Time: Zulu or local

Aviation runs on **Coordinated Universal Time**, written with a "Z" and spoken as "Zulu". Flight plans, weather reports (METARs and TAFs), and NOTAMs all use it, because a flight from New York to London crosses five time zones and a single clock avoids confusion.

- **Zulu:** best when you are coordinating with pilots elsewhere, reading weather, or keeping a [streak](/guides/leaderboards-streaks-and-challenges) alive, since RadarThing's streak days are UTC days.
- **Local:** easier for casual viewing when everyone you fly with is in your time zone.

To convert, remember your offset from UTC, and that it usually changes when daylight saving time starts and ends. London is UTC+0 in winter and UTC+1 in summer. New York is UTC−5 in winter and UTC−4 in summer.

## Common questions

**Why does an aircraft show 0 or no altitude?** Either the aircraft is on the ground or the tracker has not sent altitude data yet. Missing telemetry is shown in grey on routes and should not be read as a real value.

**Why is the speed lower than I expected at cruise?** You are looking at indicated airspeed. Switch to Mach for a more representative number at high altitude.

**Why does my altitude switch from feet to FL during the climb?** That is the Auto mode crossing 18,000 feet. Choose Feet or FL if you prefer a fixed format.
