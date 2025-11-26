## GeoFS Radar 
A Flightradar24-type radar display for the GeoFS. This is a fork of the original [GeoFS Radar](https://github.com/seabus0316/GeoFS-flightradar/) project. These are the things I have changed from the original project: 

- Originally, there were too many options to render the map which was, A, confusing and B, unnecessary.
- the original project made it a bit difficult to see flight's heading, its fixed on this project.
- There was no way to just pick a plane, you had to zoom in to see and choose a flight to track, this project makes it easy to just click on a flight and see every detail of it. 
- The original project uses MSL rather than AGL altitude, this project uses AGL. AGL is more accurate especially when ATCing. 
- Original did not have detailed Flight plan, this project does. By "detail" I mean, this project shows the speed and altitude at every waypoint. 

**Other Additions:**
- I added a "Heading Mode" that allows users to calculate heading from point A to point B. Making it easy for controllers to calculate headings. 
- Airports ~~are~~ can be highlighted with a marker.
- added search so you can directly search with the flights' or geofs' callsign
- Radar Mode - which has combined look and feel of VATSIM radar and actual radar screens.
- [GeoFS-Chart](https://github.com/mansoorbarri/geofs-charts) works on the radar screen 

## Installation 
- Install the mod: https://xyzmani.com/radar
- View the radar: https://radar.xyzmani.com/

## Usage
- Once you install the mod, you will see a popup on the right side of your screen 
- Enter the ICAO of departure/arrival aiports, Callsign and Squawk, and click "Save".
- You can close the popup by pressing "W" on your keyboard. 

**Note:** you will not be on the radar page until you save the settings. and vise-versa, if you don't want to be on the radar page, just clear the fields and click "Save". 

## Technicals 
This project uses [Leaflet](https://leafletjs.com/) and [OpenLayers](https://openlayers.org/) to render the map.

The original project uses the same technology but was written in Javascript and Express and was not very modular. This project is written in TypeScript, using the T3 stack. 

## Issues
If you find any issues, please report them on the [Issues](https://github.com/anar-anar/geofs-radar/issues) page.
