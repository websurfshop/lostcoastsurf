# Deadman's Surf Report

Build a clean, mobile-friendly static web app that shows a surf report for Shelter Cove, CA, Deadman's surf break in Southern Humboldt.  I have the domain lostcoastsurf.com and could call it Lost Coast Surf Monitor, or something like that.  Fetch real-time wave height, period, direction, wind, and swell data from NOAA NDBC buoys and/or marine forecasts via public APIs, but only fetch the data every 30 minutes so as to not require a live api and maintain the current report in cache on a static page. Display current conditions + next 24–48h forecast in a nice card layout with Tailwind. Pure frontend (Vite + React), no backend, ready to deploy as static files to cloudfare pages.

Fields I would like, but don't necessarily have to have all in the report:

Conditions rating or score

Swell Period

Swell Direction

Wind

Swell Height

Wave Height

Tide high and low

Buoy 46022 — Eel River

Water Temp

Air Temp

Pressure

Break Profile — Shelter Cove / Deadman's

Break Type

Reef

Facing

SW (225°)

Best Wind

Best Tide

Rideable Windows — Next 5 Days

Full tide table on NOAA

Weather Forecast

link to NWS Marine Forecast (Eureka)

link to live webcams of Shelter Cove from local area, https://weathercams.faa.gov/map/-122.751060625,40.02549,9/cameraSite/1044/details/camera

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a166e781-37bb-402f-9042-451c43e57160).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
