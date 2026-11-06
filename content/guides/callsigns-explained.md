# Callsigns explained

How airline callsigns are built, why ICAO and IATA codes differ, and how to choose a callsign that works well on RadarThing.

## What a callsign is

A callsign identifies a flight on the radio and on radar screens. When a controller says "Speedbird one-one-seven, climb flight level three-five-zero", every pilot on the frequency knows exactly which aircraft is being addressed.

On RadarThing, your callsign is what other pilots search for, what appears on your aircraft label, and what identifies the flight in your history. Choosing a clear, realistic callsign makes your flights easier to find and more fun to follow.

## The three common formats

### Airline callsigns

Scheduled flights use a three-letter airline code followed by a flight number:

- `BAW117`: British Airways flight 117
- `DAL404`: Delta flight 404
- `UAE5`: Emirates flight 5

The three-letter code is the airline's **ICAO designator**. On the radio, it is replaced by the airline's **telephony designator**, a spoken word chosen to be clear even on a poor connection. British Airways is *Speedbird*, Emirates is *Emirates*, and Delta is *Delta*. Some telephony names are not obvious at all: Aer Lingus is *Shamrock*, and EasyJet is *Easy*.

When RadarThing recognises an airline's ICAO code in a callsign, the flight panel shows its radio callsign as well, so you can see how the flight would be addressed by a controller.

### Registration callsigns

Private and general aviation flights often use the aircraft's registration instead. In the United States, registrations start with N, such as `N172SP`; in the United Kingdom they start with G, such as `G-ABCD`. On the radio, registrations are read with the phonetic alphabet: *November one-seven-two Sierra Papa*.

### Military callsigns

Military flights use a word followed by a number, such as `REACH123` or `ASCOT45`. In the RadarThing userscript, tick **Military** to enter an air force name; military aircraft are then shown with a distinct marker on the radar.

## ICAO versus IATA codes

Airlines have two sets of codes, and it is easy to mix them up.

- **ICAO codes** have three letters (`BAW`, `DAL`, `UAE`). Pilots and controllers use them. They appear in flight plans and on radar screens.
- **IATA codes** have two characters (`BA`, `DL`, `EK`). Passengers see them on tickets and departure boards.

So the same flight is *BA117* on a ticket and *BAW117* on the radar. For a realistic callsign on RadarThing, use the ICAO format.

The same split exists for airports. `KJFK` is JFK's four-letter ICAO code; `JFK` is its three-letter IATA code. RadarThing's departure and arrival fields expect ICAO codes.

## Choosing a good callsign

1. **Use the ICAO format.** Three letters and a number reads correctly on the radar and helps RadarThing find the radio callsign.
2. **Keep it short.** Flight numbers of one to four digits are realistic. The userscript accepts up to eight characters.
3. **Make it unique.** The userscript checks whether your callsign is already in use when you press **Start tracking**. If it is, add or change a digit.
4. **Be consistent.** Using the same callsign for a regular route makes it easy for friends to find you and for you to find the flight in your history.
5. **Use your virtual airline's code** if you fly for one. See [Virtual airlines](/guides/virtual-airlines).
6. **Avoid misleading or offensive callsigns.** Callsigns are public, and misuse can lead to moderation action.

## Flight numbers that tell a story

Real airlines often follow conventions you can borrow:

- Low numbers for flagship routes: Emirates uses `UAE1` and `UAE2` for its Dubai–London flights.
- Odd numbers in one direction and even numbers in the return direction.
- Four-digit numbers for regional or codeshare flights.

If you fly a regular out-and-back route, try an odd number on the way out and the next even number on the way home.

## Speaking your callsign

If you fly with simulated ATC, say your callsign the way a real pilot would:

- Use the telephony designator, not the letters: *Speedbird*, not *B-A-W*.
- Read the flight number as individual digits in most regions: *Speedbird one-one-seven*. Some airlines and regions use group form, such as *one-seventeen*.
- Use the phonetic alphabet for letters in the flight number: `BAW11K` is *Speedbird one-one Kilo*.

[ATC and radio phraseology](/guides/atc-and-phraseology) covers the rest of a standard radio call.

## Searching for callsigns on the radar

On [the radar](/radar), search matches any part of a callsign or flight number, as well as pilot names, departure and arrival airports, and airport codes. Searching for an airline's ICAO code alone, such as `BAW`, is a quick way to list every flight using that code. Choose a flight result to jump to the aircraft.
