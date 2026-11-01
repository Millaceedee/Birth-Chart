# node_check – osculating lunar node: app vs Swiss Ephemeris

Compares the node longitude and speed computed by the app (Astronomy Engine, `js/app.js` class `AstroCalc`, body 10)
with Swiss Ephemeris `TRUE_NODE`, tests direction changes, and measures the numerical noise of the 0.02 d / 0.005 d
central differences. The app's JavaScript files are only read, never modified.

## Requirements
- Python >= 3.8 and `pip install pyswisseph` (no numpy). 
- Node.js >= 16 (no npm packages).
- The project folder with `js/app.js`, `js/astronomy.js`, `js/ephemeris.js` (unzip `Birth-Chart-korjattu.zip`).
- Optional: Swiss Ephemeris data files (`sepl_*.se1`, `semo_*.se1`) for `--ephe-path`. Without them Swiss runs in
  its built-in Moshier mode (a few arc seconds for the Moon, so "app - Swiss" is NOT "app error").

## Run
    python3 node_check.py --src /path/to/Birth-Chart
    python3 node_check.py --src . --birth "1990-05-17 14:30" --utc-offset 3     # add your own birth moment
    python3 node_check.py --src . --ephe-path /path/to/sweph --csv rows.csv     # real Swiss files, CSV dump

`--utc-offset` is the local offset from UTC at birth (e.g. 2 for Finnish winter, 3 for summer time). Both libraries
get the identical Julian day number (computed once in Python and passed to Node).

## What it does
1. Definition check: rebuilds the osculating node from Swiss' own Moon position+velocity (4 frame variants) and shows
   which variant equals Swiss TRUE_NODE; compares the app to Swiss and to that rebuild. Also an amplification check
   (Moon latitude difference x ~1/tan(5.145 deg)).
2. Longitude (arcsec) and speed (deg/day) differences on fixed dates, your birth moment and 120 seeded random dates.
3. Direction changes: finds zeros of Swiss' node speed (default: 10 of them from year 2000), grid +-1 d every 0.02 d,
   gives zero-crossing time differences (minutes), ℞-flag disagreement windows and sign errors.
4. Numerical noise: longitude noise (cubic-fit residual), predicted speed noise, and sensitivity to inner step d
   (0.0025..0.04) and outer step h (0.005..0.05).
5. Verdict with thresholds fixed in advance (`--thr-noise`, `--thr-band`, `--thr-minutes`).

`app_node.js` stops with an error if its replica of the node formula no longer equals the real app code
(so the numerical-noise experiments cannot silently drift from the app).

`example_output.txt` is the output of one run (pyswisseph 2.10.03, Moshier).
