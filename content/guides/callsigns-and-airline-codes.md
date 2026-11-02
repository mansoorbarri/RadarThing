# Callsigns and airline codes explained

Choose a callsign that makes your GeoFS flight easy to identify, and learn how RadarThing uses airline codes to show radio callsigns, liveries and virtual airline branding.

## Three ways to name the same flight

A single real-world flight usually has three identities:

- **The flight number on your ticket**, which uses the two-character **IATA** airline code. For example, `BA117`.
- **The ATC callsign in the flight plan**, which uses the three-letter **ICAO** airline code. The same flight is `BAW117`.
- **The spoken radio callsign**, which uses the airline's **telephony designator**. Controllers and pilots say "Speedbird one-one-seven".

IATA codes are mostly a commercial system for tickets, schedules and baggage tags. ICAO codes are what air traffic control systems use, and they are unique worldwide, so they are the better choice in a flight-tracking context.

Some telephony designators are obvious, such as "Lufthansa" for `DLH`, "United" for `UAL` or "Qantas" for `QFA`. Others are historical or chosen to avoid confusion on the radio: "Speedbird" for British Airways (`BAW`), "Shamrock" for Aer Lingus (`EIN`), "Springbok" for South African Airways (`SAA`), and "Cactus" for the old US Airways (`AWE`). Low-cost carriers often have distinctive ones too, such as "Easy" for easyJet (`EZY`) and "Ryanair" for `RYR`.

## Setting your callsign

In GeoFS, open the RadarThing panel that the userscript adds and fill in the **Callsign** field along with your departure and arrival airports, then choose **Transmit**. Whatever you enter is what other people see and search for on [the radar](/radar).

For airline-style flying, use the ICAO airline code followed by a flight number: `BAW117`, `DLH400`, `UAE1`. RadarThing reads the letters at the start of the callsign to work out the airline. Three letters followed by a digit are treated as an ICAO code, and two characters followed by a digit as an IATA code. That means:

- `BAW117` → airline `BAW`.
- `BA117` → airline `BA`.
- `BAW-117` or `SPEEDBIRD117` do not follow the pattern, so no airline is recognised.

For general aviation flying, a registration-style callsign such as `N172SP`, `G-ABCD` or `DEABC` is realistic. It will not be matched to an airline, which is correct for a private aircraft.

## What RadarThing does with the airline code

When RadarThing recognises an airline code in your callsign, several things happen in the flight panel for anyone who selects your aircraft:

1. **Radio callsign.** If the airline is in RadarThing's reference data, its telephony designator is shown under the flight number, so viewers know that `EIN105` is "Shamrock 105".
2. **Livery photo.** The airline code and your aircraft type are used to look up a community aircraft image. A `DLH` callsign in an A320 shows a Lufthansa A320 if one has been approved. See [Contributing aircraft images](/guides/contributing-aircraft-images).
3. **Callsign filters.** Viewers who filter the radar by an airline's callsign prefix will find you alongside other flights of the same airline.

If the code is not recognised, none of this is shown, but your flight is tracked exactly the same way.

## Virtual airline callsigns

Virtual airlines (VAs) registered with RadarThing get a callsign prefix of 2 to 8 letters or numbers, for example `EVA` or `SKYV`. When a member flies with a callsign that begins with their VA's prefix, the flight panel shows the VA's branding and can use the VA's own livery images instead of a real airline's. If two VA prefixes could both match, the longest one wins.

That has a practical consequence: pick a VA prefix that does not collide with a real ICAO airline code you also want to fly as. See [Running a virtual airline](/guides/virtual-airlines).

## Factory and test callsigns

Aircraft manufacturers fly test and delivery flights under their own ICAO codes: `AIB` for Airbus, `BOE` for Boeing, `EMB` for Embraer and `BBA` for Bombardier. RadarThing knows these, and when there is no airline-specific image it can show a manufacturer's house-colour photo for Airbus, Boeing, Embraer and Bombardier types. Flying a brand-new aircraft "off the line" as `AIB01` in an A350 is a fun way to use this.

## Military callsigns

Military flights use tactical callsigns, usually a word plus a number such as `REACH123` or `RCH123` for US Air Mobility Command transports, or squadron-specific names. In the RadarThing panel, tick **Military** and enter the air force (for example `USAF`, `RAF`, `PAF`), so that viewers and the image lookup treat your flight as military, not as an airline.

## Good callsign etiquette

- **Use real codes realistically.** Fly `BAW` in an aircraft British Airways actually operates on a route it would plausibly fly. That is what makes the radar fun to watch.
- **Do not impersonate other pilots or VAs.** Using another VA's prefix confuses their members and their stats.
- **Keep it searchable.** Avoid spaces, punctuation and very long strings. Other pilots should be able to type your callsign into the radar search.
- **Do not use offensive callsigns.** Callsigns are public and are covered by the [terms](/terms).

Real airline codes and names belong to their owners and are used on RadarThing for simulator identification only.
