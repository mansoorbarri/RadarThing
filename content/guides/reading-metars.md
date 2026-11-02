# How to read a METAR

Decode the airport weather reports shown on RadarThing, one group at a time, and use them to plan a better departure and arrival.

## What a METAR is

A METAR is a routine aviation weather observation for a single airport. Real airports publish one at least every hour, and more often when conditions change quickly. It is written in a compact code that looks intimidating at first but follows a fixed order, so once you know the pattern you can read most reports in a few seconds.

When you select an airport on [the radar](/radar), RadarThing shows its latest METAR in the airport panel when one is available. GeoFS can simulate real-world weather, so the METAR is a useful way to anticipate the wind and visibility you will meet when you fly in or out.

Here is an example we will decode throughout this guide:

`KJFK 021451Z 31012G22KT 10SM FEW045 BKN250 14/M02 A3012 RMK AO2 SLP199`

## 1. Station and time

`KJFK 021451Z`

- **KJFK** is the ICAO code of the airport: New York's John F. Kennedy International.
- **021451Z** is the observation time. The first two digits are the day of the month (the 2nd), followed by the time in hours and minutes (14:51). The **Z** means Zulu, which is Coordinated Universal Time (UTC).

Aviation uses UTC everywhere so that pilots and controllers in different time zones never have to convert. You can set RadarThing to show Zulu time under **Configuration → Misc → Time**.

## 2. Wind

`31012G22KT`

- **310** is the direction the wind is blowing *from*, in degrees true. 310 is from the north-west.
- **12** is the average speed.
- **G22** means gusts up to 22.
- **KT** means knots.

Other forms you will see:

- `00000KT`: calm.
- `VRB03KT`: variable direction at 3 knots, common in light winds.
- `27015KT 240V300`: wind from 270 at 15 knots, varying between 240 and 300 degrees.

### Why wind matters most

Aircraft take off and land into the wind whenever possible. A headwind lowers the ground speed for a given airspeed, which shortens the take-off and landing roll. Runways are numbered by their magnetic direction divided by ten, so runway 31 points roughly north-west. With a wind from 310, runway 31 gives almost a pure headwind, and runway 13 would mean a tailwind.

Before you choose a runway in GeoFS, check the wind and pick the runway whose number is closest to the wind direction. It is the single most useful habit you can take from a METAR. Remember that METAR winds are given in true degrees and runways in magnetic degrees, so they can differ by a few degrees depending on where you are.

**Crosswind** is the part of the wind blowing across the runway. If the wind is 40 degrees off the runway heading, roughly two-thirds of its speed is a crosswind. Gusts make crosswind landings harder, so add a few knots to your approach speed on gusty days.

## 3. Visibility

`10SM`

Visibility in statute miles, used in the United States. 10SM means ten miles or more, which is excellent. Most other countries report visibility in metres, as a four-digit number: `9999` means 10 kilometres or more, and `0800` means 800 metres.

You may also see runway visual range groups such as `R04R/2000FT`, which give the visibility along a specific runway when it is poor.

## 4. Weather

Our example has no weather group, because nothing was happening. When there is, it appears after visibility and uses two-letter codes:

- **RA** rain, **SN** snow, **DZ** drizzle, **TS** thunderstorm
- **BR** mist, **FG** fog, **HZ** haze
- A minus sign means light (`-RA`), no sign means moderate, and a plus sign means heavy (`+TSRA`, heavy thunderstorm with rain).
- **SH** means showers, so `SHRA` is rain showers.
- **VC** means in the vicinity, so `VCTS` is a thunderstorm nearby.

## 5. Clouds

`FEW045 BKN250`

Each group gives an amount and a height in hundreds of feet above the airport:

- **FEW**: 1 to 2 eighths of the sky covered.
- **SCT** (scattered): 3 to 4 eighths.
- **BKN** (broken): 5 to 7 eighths.
- **OVC** (overcast): fully covered.

So `FEW045` is a few clouds at 4,500 feet and `BKN250` is a broken layer at 25,000 feet. The lowest broken or overcast layer is called the *ceiling*. Here the ceiling is 25,000 feet, which is irrelevant for an approach.

You may also see `CB` after a group, for cumulonimbus (thunderstorm clouds), or `CAVOK`, which replaces visibility, weather, and clouds and means *ceiling and visibility OK*.

## 6. Temperature and dew point

`14/M02`

The temperature is 14 °C and the dew point is minus 2 °C. The **M** means minus. When the temperature and dew point are close together, the air is near saturation and fog or low cloud becomes likely, especially in the early morning.

## 7. Pressure

`A3012`

The altimeter setting: 30.12 inches of mercury, used in North America. Elsewhere it is given in hectopascals, such as `Q1013`. Pilots set this value on their altimeter so that it reads the correct height above sea level near the airport.

## 8. Remarks

`RMK AO2 SLP199`

Remarks hold extra information. `AO2` means an automated station with a precipitation sensor. `SLP199` is sea-level pressure in a coded form. You can usually ignore the remarks section in the simulator.

## Putting it together

Our example reads: *JFK, on the 2nd at 14:51 UTC. Wind from 310 at 12 knots gusting 22. Visibility 10 miles or more. A few clouds at 4,500 feet, broken at 25,000. Temperature 14, dew point minus 2. Altimeter 30.12.*

For a GeoFS flight, the practical takeaways are: use a runway close to 310 (31L or 31R at JFK), expect a gusty but manageable landing, and enjoy good visibility.

## Flight categories

Pilots often summarise a METAR into a category:

- **VFR**: ceiling above 3,000 feet and visibility over 5 miles.
- **MVFR** (marginal VFR): ceiling 1,000 to 3,000 feet or visibility 3 to 5 miles.
- **IFR**: ceiling 500 to under 1,000 feet or visibility 1 to under 3 miles.
- **LIFR** (low IFR): ceiling under 500 feet or visibility under 1 mile.

When the weather at your destination is IFR or worse, plan to fly an instrument approach. RadarThing's [airport charts](/guides/airport-charts) are the place to find one.

## More weather on RadarThing

Precipitation radar is available to everyone as a map overlay. Pro adds AIRMETs and SIGMETs, which outline areas of turbulence, icing, and other hazards, as well as D-ATIS for US airports and NOTAMs. See [pricing](/pricing) for current details.

Weather on RadarThing is provided for simulator use only. Never use it for real-world flight planning.
