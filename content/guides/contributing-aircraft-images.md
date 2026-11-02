# Contributing aircraft images

Learn how RadarThing chooses the photo shown behind a selected flight, and how to submit an image that gets approved the first time.

## Where aircraft images appear

When you select a flight on [the radar](/radar), the top of the flight panel can show a photo of that aircraft in the airline's livery: a British Airways A320 shows a British Airways A320, and an Emirates B777 shows an Emirates B777. These photos come from the community. Pilots submit them, RadarThing reviews them, and approved images go into the public [aircraft image gallery](/aircraft-images).

Every approved image counts toward the contributor's total on the **Contribution** tab of the [leaderboard](/leaderboard).

## How an image is matched to a flight

RadarThing needs two pieces of information from a live flight to find a photo:

1. **The airline code**, taken from the start of the flight's callsign. `BAW123` gives the ICAO airline code `BAW`, and `BA123` gives the IATA code `BA`. RadarThing tries the two-letter IATA code first, then the three-letter ICAO code. [Callsigns and airline codes](/guides/callsigns-and-airline-codes) explains the difference.
2. **The aircraft type**, normalised to an ICAO type designator. GeoFS aircraft names such as "Airbus A320neo" or "Boeing 737-800" are reduced to the base model (`A320`, `B737`) so one image can cover the whole family.

If both match an approved image, it is shown. If the airline has no image for that type, RadarThing can fall back to a manufacturer house livery. Airbus, Boeing, Embraer and Bombardier types can show a factory image, which matches the way those manufacturers fly test aircraft under their own callsigns. Otherwise the panel simply has no photo.

That is why the codes on a submission matter so much: an image filed under the wrong airline code or a variant type will never be matched to a real flight.

## Before you upload

Open the [gallery](/aircraft-images) and search for the airline and aircraft. Only one approved image is kept for each combination of IATA code, ICAO code and aircraft type, so if a good one already exists there is nothing to add. You also cannot have two pending submissions for the same combination.

You need to be signed in to upload. If your Discord account is connected, your Discord username is shown as the contributor on the image.

## The upload rules

These are the rules reviewers check, along with what each one means in practice.

**Enter the base aircraft model, not a variant.** Use `B777`, not `B77W` or `777-300ER`. Use `A350`, not `A359`. Use `B737`, not `B738`. Matching works on the family, so a variant code splits images that should be shared.

**Use a high-quality image.** Sharp, well-exposed and reasonably high resolution. Avoid heavy filters, watermarks across the aircraft, or images upscaled from a thumbnail.

**Show the complete aircraft, uncropped, with the livery clearly visible.** A side or three-quarter view of the whole airframe works best. Close-ups of an engine or tail, cabin shots and aircraft mostly hidden behind another object are rejected.

**Make sure the ICAO, IATA and aircraft name match the aircraft in the photo.** The airline in the picture must be the airline whose codes you enter. A Lufthansa A320 photo filed as `LH` / `DLH` / `A320` is correct. The same photo filed under Eurowings is not.

**Check that the image is not already uploaded.** Search first, as described above.

**Use a real airline. Military uploads must name the correct air force.** For military aircraft, switch on the military option and enter the air force (for example `USAF`, `RAF` or `PAF`) along with the aircraft model (for example `F16` or `C130`). Airline codes are not used for military images.

**Only share images you have the right to share.** You must confirm this before uploading. Photos taken by someone else need the photographer's permission. See [copyright](/copyright) if you believe an image infringes your rights.

## Finding the right codes

- **IATA airline code:** two characters, for example `BA`, `EK` or `U2`. You will see it on boarding passes and flight numbers.
- **ICAO airline code:** three letters, for example `BAW`, `UAE` or `EZY`. It is used in ATC callsigns and flight plans.
- **ICAO aircraft type:** an up-to-four-character designator, for example `A320`, `B737`, `E190`, `CRJ9`, `AT76` or `DH8D`. For RadarThing, use the base family where one exists.

Airline websites, ICAO's published designators and many flight-tracking references list these codes. If you are unsure, compare with images of the same airline already in the gallery.

## What happens after you submit

Your image enters a review queue and does not appear publicly until it is approved. Reviewers may correct a code or reject the image if it breaks the rules above. Once approved, it shows in the gallery straight away and on the next matching flight you select on the radar.

Virtual airlines have a separate image system for their own liveries. See [Running a virtual airline](/guides/virtual-airlines).
