#!/usr/bin/env python3
"""
node_check.py - compares the app's osculating lunar node (longitude + speed) with the
Swiss Ephemeris TRUE node, tests direction changes, and measures numerical noise of the
app's 0.02 d central difference. The app's JavaScript files are only READ, never changed.

Usage:
    python3 node_check.py --src /path/to/project            # project dir with js/app.js etc.
    python3 node_check.py --src . --birth "1990-05-17 14:30" --utc-offset 3
    python3 node_check.py --src . --ephe-path /path/to/sweph  # use real Swiss files (optional)

Dependencies:
    - Python >= 3.8, `pip install pyswisseph`
    - Node.js >= 16 (runs the app's own code through app_node.js, same folder)
    No numpy needed. Default Swiss mode is the built-in Moshier ephemeris (no data files needed).
"""
import argparse, csv, datetime as dt, json, math, os, random, statistics, subprocess, sys, tempfile

try:
    import swisseph as swe
except ImportError:
    sys.exit("pyswisseph missing: pip install pyswisseph")

HERE = os.path.dirname(os.path.abspath(__file__))
GRID = 0.02          # days between grid points around each direction change (grid is +-1.0 d)


# ---------------------------------------------------------------- helpers
def wrap180(x):
    return (x + 540.0) % 360.0 - 180.0


def rms(v):
    return math.sqrt(sum(x * x for x in v) / len(v)) if v else float("nan")


def mx(v):
    return max((abs(x) for x in v), default=float("nan"))


def zero_cross(ts, vs):
    """linear-interpolated zero crossing of vs(ts) nearest the middle of the series; None if none"""
    best = None
    mid = (ts[0] + ts[-1]) / 2
    for i in range(len(ts) - 1):
        if vs[i] == 0:
            c = ts[i]
        elif vs[i] * vs[i + 1] < 0:
            c = ts[i] + (ts[i + 1] - ts[i]) * vs[i] / (vs[i] - vs[i + 1])
        else:
            continue
        if best is None or abs(c - mid) < abs(best - mid):
            best = c
    return best


# ---------------------------------------------------------------- Swiss side
class Swiss:
    def __init__(self, ephe_path=None):
        if ephe_path:
            swe.set_ephe_path(ephe_path)
            self.base = swe.FLG_SWIEPH
        else:
            self.base = swe.FLG_MOSEPH

    @staticmethod
    def _xx(r):
        return r[0] if isinstance(r[0], (tuple, list)) else r

    def true_node(self, jd):
        r = swe.calc_ut(jd, swe.TRUE_NODE, self.base | swe.FLG_SPEED)
        xx = self._xx(r)
        return xx[0], xx[3]                      # lon, speed(deg/day) as reported by Swiss

    def true_node_lon(self, jd):
        return self._xx(swe.calc_ut(jd, swe.TRUE_NODE, self.base))[0]

    def fd_speed(self, jd, h=0.01):
        return wrap180(self.true_node_lon(jd + h) - self.true_node_lon(jd - h)) / (2 * h)

    def moon_state(self, jd, truepos, nonut):
        f = self.base | swe.FLG_SPEED | swe.FLG_XYZ
        if truepos: f |= swe.FLG_TRUEPOS
        if nonut: f |= swe.FLG_NONUT
        return self._xx(swe.calc_ut(jd, swe.MOON, f))

    def osc_lon(self, jd, truepos, nonut):
        x, y, z, vx, vy, vz = self.moon_state(jd, truepos, nonut)[:6]
        hx = y * vz - z * vy
        hy = z * vx - x * vz
        return math.degrees(math.atan2(hx, -hy)) % 360.0     # same formula as app.js

    def osc_speed(self, jd, truepos, nonut, h=0.01):
        return wrap180(self.osc_lon(jd + h, truepos, nonut) - self.osc_lon(jd - h, truepos, nonut)) / (2 * h)


# ---------------------------------------------------------------- build date list
def build_dates(sw, args):
    dates = []
    # (a) fixed, easy-to-read dates
    for y, m, d, h in [(1900, 1, 1, 0), (1950, 6, 15, 12), (1969, 7, 20, 20.3), (1985, 3, 1, 6), (2000, 1, 1, 12),
                       (2010, 12, 21, 8.5), (2024, 2, 29, 23.9), (2050, 7, 1, 0), (2099, 12, 31, 12)]:
        dates.append(dict(jd=swe.julday(y, m, d, h), group="fixed", label=f"{y:04d}-{m:02d}-{d:02d} {h:05.2f}h UT"))
    # (b) the user's own birth moment (identical JD goes to both libraries)
    if args.birth:
        t = dt.datetime.strptime(args.birth, "%Y-%m-%d %H:%M") - dt.timedelta(hours=args.utc_offset)
        jd = swe.julday(t.year, t.month, t.day, t.hour + t.minute / 60.0)
        dates.append(dict(jd=jd, group="birth", label=f"birth {args.birth} (UTC{args.utc_offset:+g}) -> {t:%Y-%m-%d %H:%M} UT"))
    # (c) seeded random dates 1900..2100
    rnd = random.Random(args.seed)
    for i in range(args.n_random):
        dates.append(dict(jd=rnd.uniform(2415020.5, 2488069.5), group="random", label=f"random#{i}"))
    # (d) direction changes: find zeros of Swiss' reported node speed, refine, then a fine grid +-0.2 d
    jd0 = swe.julday(args.station_start, 1, 1, 12.0)
    ts = [jd0 + 0.25 * i for i in range(int(args.station_days / 0.25) + 1)]
    sp = [sw.true_node(t)[1] for t in ts]
    stations = []
    for i in range(len(ts) - 1):
        if sp[i] * sp[i + 1] < 0:
            lo, hi = ts[i], ts[i + 1]
            for _ in range(60):
                mid = (lo + hi) / 2
                if sw.true_node(lo)[1] * sw.true_node(mid)[1] <= 0: hi = mid
                else: lo = mid
            stations.append(((lo + hi) / 2, "retro->direct" if sp[i] < 0 else "direct->retro"))
    stations = stations[: args.max_stations]
    for k, (tz, kind) in enumerate(stations):
        for j in range(-50, 51):
            dates.append(dict(jd=tz + j * GRID, group=f"station{k}", label=f"station{k} {kind} {j * GRID:+.2f}d",
                              st=k, off=j * GRID, kind=kind, jd_station=tz))
    return dates, stations


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", required=True, help="project dir containing js/app.js, js/astronomy.js, js/ephemeris.js")
    ap.add_argument("--node", default="node", help="node executable")
    ap.add_argument("--ephe-path", help="Swiss Ephemeris data files dir (optional; default Moshier built-in)")
    ap.add_argument("--birth", help='your birth moment local time "YYYY-MM-DD HH:MM"')
    ap.add_argument("--utc-offset", type=float, default=0.0, help="hours of local offset from UTC used with --birth (e.g. 3 for EEST)")
    ap.add_argument("--n-random", type=int, default=120)
    ap.add_argument("--seed", type=int, default=12345)
    ap.add_argument("--station-start", type=int, default=2000, help="year to start scanning for direction changes")
    ap.add_argument("--station-days", type=float, default=400.0)
    ap.add_argument("--max-stations", type=int, default=10)
    # verdict thresholds (decided before looking at results; change only with a reason)
    ap.add_argument("--thr-noise", type=float, default=1e-4, help="max acceptable numerical speed noise, deg/day")
    ap.add_argument("--thr-band", type=float, default=0.002, help="|ref speed| above which a sign mismatch is not tolerated, deg/day")
    ap.add_argument("--thr-minutes", type=float, default=30.0, help="max acceptable station timing error, minutes")
    ap.add_argument("--csv", help="write all rows to this CSV file")
    args = ap.parse_args()

    sw = Swiss(args.ephe_path)
    r = swe.calc_ut(swe.julday(2000, 1, 1, 12.0), swe.TRUE_NODE, sw.base | swe.FLG_SPEED)
    used = r[1] if isinstance(r[0], (tuple, list)) else None
    eph_name = "?"
    if used is not None:
        eph_name = "Moshier" if used & swe.FLG_MOSEPH else "SWIEPH files" if used & swe.FLG_SWIEPH else "JPL" if used & swe.FLG_JPLEPH else "?"
    print(f"Swiss Ephemeris (pyswisseph {getattr(swe, 'version', '?')}), ephemeris used: {eph_name}")

    dates, stations = build_dates(sw, args)
    jds = [d["jd"] for d in dates]
    print(f"{len(dates)} dates ({sum(1 for d in dates if d['group']=='random')} random, {len(stations)} direction changes x 101 grid points, "
          f"{sum(1 for d in dates if d['group'] in ('fixed','birth'))} fixed/birth)")

    # --- run the app's own code through Node
    with tempfile.TemporaryDirectory() as tmp:
        fin, fout = os.path.join(tmp, "in.json"), os.path.join(tmp, "out.json")
        json.dump({"jds": jds}, open(fin, "w"))
        p = subprocess.run([args.node, os.path.join(HERE, "app_node.js"), "--src", args.src, "--in", fin, "--out", fout],
                           capture_output=True, text=True)
        if p.returncode != 0:
            sys.exit(f"app_node.js failed (rc={p.returncode}):\n{p.stderr}")
        app = json.load(open(fout))
    print(f"app.js replica check: max lon diff {app['replicaMaxLonDiff']:.1e} deg, max speed diff {app['replicaMaxSpeedDiff']:.1e} deg/day (must be ~0)")

    # --- Swiss values at identical JDs
    for d, a in zip(dates, app["rows"]):
        assert d["jd"] == a["jd"]
        d["app_lon"], d["app_sp"] = a["lon"], a["speed"]
        d["lon_noise"], d["variants"] = a["lonNoise"], a["variants"]
        d["sw_lon"], d["sw_sp"] = sw.true_node(d["jd"])
        d["sw_fd"] = sw.fd_speed(d["jd"])
        mx_ = sw._xx(swe.calc_ut(d["jd"], swe.MOON, sw.base | swe.FLG_SPEED | swe.FLG_TRUEPOS))
        d["sw_mlat"], d["sw_mlat_rate"] = mx_[1], mx_[4]
        d["app_mlat"], d["app_mlat_rate"] = a["moonLat"], a["moonLatRate"]
    VAR = {"apparent+nutation": (False, False), "apparent, mean ecl.(NONUT)": (False, True),
           "true pos+nutation": (True, False), "true pos, mean ecl.(NONUT)": (True, True)}
    for d in dates:
        for name, (tp, nn) in VAR.items():
            d["c_lon_" + name] = sw.osc_lon(d["jd"], tp, nn)

    # =============================================================== 1. definitions
    reg = [d for d in dates if d["group"] in ("fixed", "random", "birth")]
    print("\n=== 1. DEFINITION CHECK (before interpreting anything) ===")
    print("Swiss TRUE_NODE is an osculating node. Here it is rebuilt from Swiss' own Moon position+velocity with the same")
    print("cross-product formula the app uses, in 4 frame variants. The variant that matches Swiss TRUE_NODE shows which")
    print("definition Swiss uses; the app is then compared against that same definition as well.")
    print(f"{'quantity compared to Swiss TRUE_NODE longitude':<50}{'RMS (arcsec)':>14}{'max (arcsec)':>14}")
    best_name, best_rms = None, 1e99
    for name in VAR:
        diffs = [wrap180(d["c_lon_" + name] - d["sw_lon"]) * 3600 for d in reg]
        print(f"  Swiss Moon vectors, {name:<30}{rms(diffs):>14.3f}{mx(diffs):>14.3f}")
        if rms(diffs) < best_rms: best_name, best_rms = name, rms(diffs)
    diffs = [wrap180(d["app_lon"] - d["sw_lon"]) * 3600 for d in reg]
    print(f"  APP (Astronomy Engine Moon)               {'':<12}{rms(diffs):>14.3f}{mx(diffs):>14.3f}")
    diffs_b = [wrap180(d["app_lon"] - d["c_lon_" + best_name]) * 3600 for d in reg]
    print(f"  APP vs best-matching Swiss-Moon variant   {'':<12}{rms(diffs_b):>14.3f}{mx(diffs_b):>14.3f}   (best = '{best_name}')")
    print(f"  -> best variant matches Swiss TRUE_NODE to {best_rms:.3f}\" RMS. Any larger app-vs-Swiss gap is ephemeris/numerics, not definition.")

    # --- 1b: why app and Swiss differ even though the definition/frame is the same
    dlat = [(d["app_mlat"] - d["sw_mlat"]) * 3600 for d in reg]
    drate = [(d["app_mlat_rate"] - d["sw_mlat_rate"]) * 3600 for d in reg]
    dnode = [wrap180(d["app_lon"] - d["sw_lon"]) * 3600 for d in reg]
    amp = 1.0 / math.tan(math.radians(5.145))
    print("\n  1b. Amplification check. The osculating node is where the Moon's orbit plane cuts the ecliptic, so a small error")
    print(f"      in the Moon's latitude is magnified roughly 1/tan(5.145 deg) = {amp:.1f} times in the node longitude.")
    print(f"      Moon latitude  app - Swiss(true pos): RMS {rms(dlat):.2f}\"  max {mx(dlat):.2f}\"")
    print(f"      Moon lat. rate app - Swiss          : RMS {rms(drate):.2f}\"/day  max {mx(drate):.2f}\"/day")
    print(f"      node longitude app - Swiss          : RMS {rms(dnode):.2f}\"   (ratio node/lat = {rms(dnode)/rms(dlat):.1f})")
    print("      -> A ~1-2\" Moon latitude difference between the two Moon theories is enough to explain the node gap. This is")
    print("         consistent with 'ephemeris difference, amplified', not proof of which Moon theory is closer to the truth.")

    # =============================================================== 2. lon & speed comparison
    def block(title, items):
        print(f"\n--- {title} (n={len(items)}) ---")
        dl = [wrap180(d["app_lon"] - d["sw_lon"]) * 3600 for d in items]
        print(f"  longitude  app - Swiss     : mean {statistics.fmean(dl):+8.3f}\"  RMS {rms(dl):7.3f}\"  max {mx(dl):7.3f}\"")
        for lab, key in (("Swiss reported speed", "sw_sp"), ("Swiss node, fine diff   ", "sw_fd")):
            ds = [d["app_sp"] - d[key] for d in items]
            print(f"  speed      app - {lab}: mean {statistics.fmean(ds):+9.6f}  RMS {rms(ds):9.6f}  max {mx(ds):9.6f}  deg/day")
        dsb = [d["app_sp"] - sw.osc_speed(d["jd"], *VAR[best_name]) for d in items]
        print(f"  speed      app - same-definition rebuild: mean {statistics.fmean(dsb):+9.6f}  RMS {rms(dsb):9.6f}  max {mx(dsb):9.6f}  deg/day")
    print("\n=== 2. APP vs SWISS: longitude (arcsec) and speed (deg/day) ===")
    block("fixed + birth + random dates", reg)
    block("grid around direction changes", [d for d in dates if d["group"].startswith("station")])
    print("\n  Examples (jd, app lon, swiss lon, app speed, swiss speed, swiss fine-diff speed):")
    for d in [x for x in dates if x["group"] in ("fixed", "birth")]:
        print(f"   {d['label']:<44} {d['app_lon']:10.5f} {d['sw_lon']:10.5f} {d['app_sp']:+10.6f} {d['sw_sp']:+10.6f} {d['sw_fd']:+10.6f}")

    # =============================================================== 3. direction changes
    print("\n=== 3. DIRECTION CHANGES (zero of node speed; grid +-1.0 d, 0.02 d spacing) ===")
    print("  Columns app-X: time by which the app's speed crosses zero later(+)/earlier(-) than reference X, in minutes.")
    print(f"  'window' = total time inside the grid in which the app's ℞ flag differs from Swiss' (flag = speed<0).")
    print(f"  {'#':<3}{'kind':<15}{'swiss jd':>14}{'accel':>8}{'app-swiss':>11}{'app-fine':>10}{'app-rebuild':>12}{'window':>10}{'sign err':>9}")
    timing, windows, missing, nb = [], [], 0, 0
    for k, (tz, kind) in enumerate(stations):
        g = [d for d in dates if d.get("st") == k]
        ts = [d["jd"] for d in g]
        rebuild = [sw.osc_speed(d["jd"], *VAR[best_name]) for d in g]
        t_sw = zero_cross(ts, [d["sw_sp"] for d in g])
        t_fd = zero_cross(ts, [d["sw_fd"] for d in g])
        t_rb = zero_cross(ts, rebuild)
        t_app = zero_cross(ts, [d["app_sp"] for d in g])
        i0 = min(range(len(g) - 1), key=lambda i: abs(ts[i] - tz))
        acc = (g[i0 + 1]["sw_sp"] - g[i0]["sw_sp"]) / GRID
        cells = []
        for ref in (t_sw, t_fd, t_rb):
            if t_app is None or ref is None:
                cells.append("none")
            else:
                cells.append(f"{(t_app - ref) * 1440.0:+.1f}m"); timing.append((t_app - ref) * 1440.0)
        if t_app is None and t_sw is not None: missing += 1
        win = sum(1 for d in g if (d["app_sp"] < 0) != (d["sw_sp"] < 0)) * GRID * 1440.0
        windows.append(win)
        bad = sum(1 for d in g if (d["app_sp"] < 0) != (d["sw_sp"] < 0) and abs(d["sw_sp"]) > args.thr_band)
        nb += bad
        print(f"  {k:<3}{kind:<15}{tz:>14.5f}{acc:>8.3f}{cells[0]:>11}{cells[1]:>10}{cells[2]:>12}{win:>8.0f}m{bad:>9d}")
    print("  ('none' = the speed does not cross zero within +-1 d of Swiss' crossing. accel in deg/day^2: small accel = shallow,")
    print("   ill-conditioned turning point, where tiny speed errors move the crossing by hours.)")

    rnd = [d for d in dates if d["group"] in ("random", "fixed", "birth")]
    mis = [d for d in rnd if (d["app_sp"] < 0) != (d["sw_sp"] < 0)]
    speed_values = ', '.join('{:.4f}'.format(abs(d["sw_sp"])) for d in mis)
    print(f"  ℞ flag app vs Swiss on {len(rnd)} non-grid dates: {len(mis)} mismatches"
      + (f" (|Swiss speed| of those: {speed_values} deg/day)" if mis else ""))

    # =============================================================== 4. numerical noise
    print("\n=== 4. NUMERICAL NOISE of the app's differences ===")
    noises = [d["lon_noise"] for d in dates]
    eps = statistics.median(noises)
    pred = max(noises) / (0.005 * math.sqrt(2))
    print("  The node longitude uses an inner central difference of the Moon (d=0.02 d) and the speed an outer central")
    print("  difference of the node (h=0.005 d). Rounding noise e in longitude becomes speed noise ~ e/(h*sqrt2).")
    print(f"  longitude noise (cubic-fit residual, 41 samples/0.0005 d): median {eps:.2e} deg, max {max(noises):.2e} deg")
    print(f"  -> predicted speed noise (worst case) {pred:.2e} deg/day   [threshold {args.thr_noise:g}]")
    print("  Sensitivity of speed to the step sizes (max over all dates), relative to the app's d=0.02, h=0.005:")
    keys = app["rows"][0]["variants"].keys()
    base = "d0.02_h0.005"
    print(f"   {'variant':<18}{'max |speed - app speed|':>26}")
    for kname in keys:
        if kname == base: continue
        e = max(abs(d["variants"][kname] - d["variants"][base]) for d in dates)
        print(f"   {kname:<18}{e:>26.2e}")
    d_only = max(abs(d["variants"][f"d{dd}_h0.005"] - d["variants"][base]) for d in dates for dd in app["dList"])
    h_only = max(abs(d["variants"][f"d0.02_h{hh}"] - d["variants"][base]) for d in dates for hh in app["hList"])
    print(f"  => changing only the inner step d (0.0025 ... 0.04) moves speed by at most {d_only:.2e} deg/day")
    print(f"  => changing only the outer step h (0.005 ... 0.05)  moves speed by at most {h_only:.2e} deg/day")

    # =============================================================== 5. verdict
    print("\n=== 5. VERDICT: is the speed reliable enough for the ℞ marker? ===")
    worst_min = max((abs(x) for x in timing), default=float("nan"))
    freq = len(stations) / args.station_days                      # direction changes per day
    mean_win = statistics.fmean(windows) if windows else float("nan")
    p_wrong = freq * mean_win / 1440.0
    ok_noise = pred < args.thr_noise
    ok_sign = nb == 0
    ok_time = missing == 0 and worst_min <= args.thr_minutes
    print(f"  numerical noise (predicted worst case) : {pred:.2e} deg/day            -> {'OK' if ok_noise else 'TOO HIGH'} (limit {args.thr_noise:g})")
    print(f"  ℞ sign mismatches where |Swiss v|>{args.thr_band:g}  : {nb}                          -> {'OK' if ok_sign else 'PROBLEM'}")
    print(f"  direction changes without app crossing : {missing} of {len(stations)}                    -> {'OK' if missing == 0 else 'PROBLEM'}")
    print(f"  worst timing error where both cross    : {worst_min:.1f} min                -> {'OK' if worst_min <= args.thr_minutes else 'TOO LARGE'} (limit {args.thr_minutes:g})")
    print(f"  expected share of birth moments with a different ℞ flag than Swiss: ~{100 * p_wrong:.2f}%"
          f"  ({len(stations)} direction changes in {args.station_days:g} d, mean disagreement window {mean_win:.0f} min)")
    verdict = ok_noise and ok_sign and ok_time
    print("\n  VERDICT:", "RELIABLE for the ℞ marker." if verdict else
          "NUMERICALLY CLEAN, BUT NOT RELIABLE NEAR DIRECTION CHANGES (see failed lines).")
    print("  Reading guide: noise tests the 0.02 d / 0.005 d differences themselves (independent of any reference).")
    print("  Timing / sign tests measure the app's Moon vs Swiss' Moon, amplified by the node's sensitivity (section 1b).")
    print("  They cannot say which Moon theory is closer to the truth; for that rerun with --ephe-path (Swiss data files).")

    if args.csv:
        with open(args.csv, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["label", "jd", "app_lon", "swiss_lon", "dlon_arcsec", "app_speed", "swiss_speed", "swiss_fd_speed", "lon_noise_deg"])
            for d in dates:
                w.writerow([d["label"], f"{d['jd']:.8f}", d["app_lon"], d["sw_lon"], wrap180(d["app_lon"] - d["sw_lon"]) * 3600,
                            d["app_sp"], d["sw_sp"], d["sw_fd"], d["lon_noise"]])
        print(f"\nCSV written: {args.csv}")


if __name__ == "__main__":
    main()
