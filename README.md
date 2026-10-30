# Birth-Chart

![Birth Chart preview](images/preview.png)

Calculate your birth chart: planetary positions, ascendant, houses and aspects, with symbolic meanings.

Enter your date, time and place of birth to see an astrological map of the sky at the moment you were born, drawn as a classic chart wheel with the zodiac signs, houses, planets and the aspects between them.

**[🪐 Open Birth Chart](https://millaceedee.github.io/Birth-Chart/)**

## Features

- **Interactive chart wheel** with zodiac signs, houses, planets and aspect lines
- **Sun, Moon and planets** from Mercury to Pluto, plus the North Node
- **Chiron and the asteroids Ceres, Pallas, Juno and Vesta**, together with Lilith, the South Node, Part of Fortune and Vertex (switchable as "extra points")
- **Ascendant (ASC) and Midheaven (MC)** with Placidus, Koch, Whole Sign or Equal houses
- **Retrograde indicators** for planets, Chiron and the asteroids in apparent backward motion
- **Aspects** between the points, drawn inside the chart and listed in an aspect grid
- **Quick readings** that summarize the key placements in plain language
- **Full positions table** with sign, degree and house for every body
- **Unknown birth time mode**, which leaves out the ascendant and houses when the exact time isn't known
- **Place search** with a built-in list of cities by country, or enter your own coordinates and time zone
- **Save as SVG or PNG** to keep or share your chart
- **Bilingual support** (English and Finnish with a quick toggle)

## How It Works (Astronomical Calculations)

Birth Chart calculates everything entirely client-side in your browser. **No APIs, no servers, and no internet connection are required**, and your birth details never leave your device.

- **Planetary Positions:** Powered by [Astronomy Engine](https://github.com/cosinekitty/astronomy) by Don Cross (MIT License).
- **Chiron, Ceres, Pallas, Juno and Vesta:** Astronomy Engine does not include these bodies, so their orbits come from a small precomputed table, `js/ephemeris.js`, built from **[NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/)** data (see below).
- **Houses:** Placidus house system by default, with the ascendant and midheaven calculated from the time and place of birth.
- **Lunar Node:** The true North Node.
- **Time Zones:** Local birth time is converted to universal time using the selected IANA time zone.

This project does **not** use Swiss Ephemeris or any other external ephemeris library at runtime. Positions are accurate to well under one arcminute for the planets and for the minor bodies listed above.

### Chiron and asteroid data (NASA/JPL Horizons)

The positions of Chiron (2060), Ceres (1), Pallas (2), Juno (3) and Vesta (4) are taken from the JPL Horizons On-Line Ephemeris System, operated by the Solar System Dynamics group at NASA's Jet Propulsion Laboratory. The data is downloaded once, when the file is built, and stored in the repository, so the site works offline afterwards.

- **Coverage:** 1 January 1800 to early 2101, which also bounds the dates for which these five bodies are shown.
- **Contents:** heliocentric, geometric positions in the J2000 ecliptic frame (AU, UT), sampled every 16 days and stored as integers in units of 10⁻⁶ AU (base64). This keeps all five bodies to roughly 550 kB, compared with several megabytes for daily samples.
- **In the browser:** the position at the moment of birth is interpolated with 8-point Lagrange interpolation, combined with Earth's position from Astronomy Engine, corrected for light travel time and annual aberration, and converted to the true ecliptic of date, the same frame as the planets.
- **Rebuilding the file:** run `py tools/build_ephemeris.py` on a computer with an internet connection (Python 3, no extra packages). It queries the Horizons API and rewrites `js/ephemeris.js`.

Chiron, Ceres, Pallas, Juno and Vesta are not affiliated with or endorsed by NASA or JPL. NASA/JPL are credited as the source of the underlying orbital data only.

## About

Birth Chart is a personal project exploring astronomy, astrology and the symbolism people have attached to the sky for thousands of years.

The readings are symbolic and meant for reflection and curiosity, not as scientific or professional advice.

## Try it online

You can use the chart directly in your browser without installing anything.

## Source code

The source code is available in this repository. You are welcome to explore it, learn from it and build upon it under the terms of the MIT License.

## Tutorial

Want to learn how I built Birth Chart?

I've created a mini tutorial showing how I made this interactive birth chart. The tutorial is available on Patreon behind a paywall.

**[📖 Read the Birth Chart mini tutorial on Patreon](https://www.patreon.com/Millaceedee/posts/creating-birth-173683060)** 🔒

## Original creator

Created by **Millaceedee** in 2026.

If you share or redistribute this project, please retain the original copyright notice and the MIT License.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details, which also lists third-party notices for the NASA/JPL Horizons data and Astronomy Engine.
