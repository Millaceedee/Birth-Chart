#!/usr/bin/env node
/*
 * app_node.js - runs the *unmodified* app code for the osculating lunar node (body 10)
 * and some numerical-noise experiments. Called by node_check.py, but can be run alone:
 *
 *   node app_node.js --src /path/to/project --in jds.json --out result.json
 *
 * --src  directory containing js/astronomy.js, js/ephemeris.js, js/app.js (not modified, only read)
 * --in   JSON: {"jds":[...]}   (Julian days, UT - the same numbers that Swiss Ephemeris gets)
 * --out  JSON result
 *
 * No npm packages needed. Node.js >= 16.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
const src = arg('src'), inFile = arg('in'), outFile = arg('out');
if (!src || !inFile) {
  console.error('usage: node app_node.js --src PROJECT_DIR --in jds.json [--out result.json]');
  process.exit(2);
}

// ---- load the app's own code (read-only) -------------------------------------------------
const ctx = { console, Math, Date, Float64Array, Int32Array, Uint8Array, ArrayBuffer, DataView, Object, Array, Number, String, JSON, Error };
ctx.window = ctx;
ctx.atob = (s) => Buffer.from(s, 'base64').toString('binary');
vm.createContext(ctx);
const read = (p) => fs.readFileSync(path.join(src, p), 'utf8');
vm.runInContext(read('js/astronomy.js'), ctx, { filename: 'astronomy.js' });
if (!ctx.Astronomy) { console.error('Astronomy Engine did not load into the sandbox'); process.exit(3); }
try { vm.runInContext(read('js/ephemeris.js'), ctx, { filename: 'ephemeris.js' }); } catch (e) { /* not needed for body 10 */ }

const appText = read('js/app.js');
const a = appText.indexOf('class AstroCalc');
const b = appText.indexOf('const ast = new AstroCalc();');
if (a < 0 || b < 0) { console.error('Could not find class AstroCalc in app.js'); process.exit(4); }
const AstroCalc = vm.runInContext('(' + appText.slice(a, b).trim().replace(/;\s*$/, '') + ')', ctx, { filename: 'app.js(AstroCalc)' });
const ast = new AstroCalc();
const AE = ctx.Astronomy;

// ---- replica of the node longitude with adjustable inner step d ----------------------------
// This mirrors app.js lines 14-19 (pl === 10). It is VALIDATED against the real class below
// (if the app code changes and the replica drifts, the script stops instead of lying).
const toDate = (jd) => new Date((jd - 2440587.5) * 864e5);
const nm = (x) => ((x % 360) + 360) % 360;
function nodeLon(jd, d) {
  const ec = (j) => AE.Ecliptic(AE.GeoMoon(toDate(j))).vec;
  const r1 = ec(jd - d), r = ec(jd), r2 = ec(jd + d);
  const v = { x: (r2.x - r1.x) / (2 * d), y: (r2.y - r1.y) / (2 * d), z: (r2.z - r1.z) / (2 * d) };
  const hx = r.y * v.z - r.z * v.y, hy = r.z * v.x - r.x * v.z;
  return nm(Math.atan2(hx, -hy) * 180 / Math.PI);
}
const wrap180 = (x) => ((x + 540) % 360) - 180;
function nodeSpeed(jd, d, h) {
  return wrap180(nodeLon(jd + 0.01, d) - nodeLon(jd, d)) / 0.01;
}

// ---- tiny least-squares polynomial fit (for the noise estimate) -----------------------------
function polyfitResidualRMS(xs, ys, deg) {
  const n = xs.length, m = deg + 1;
  const A = Array.from({ length: m }, () => new Array(m + 1).fill(0));
  for (let k = 0; k < n; k++) {
    const pw = [1];
    for (let i = 1; i < 2 * m; i++) pw.push(pw[i - 1] * xs[k]);
    for (let i = 0; i < m; i++) { for (let j = 0; j < m; j++) A[i][j] += pw[i + j]; A[i][m] += pw[i] * ys[k]; }
  }
  for (let i = 0; i < m; i++) {                       // Gaussian elimination with pivoting
    let p = i;
    for (let r = i + 1; r < m; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    for (let r = i + 1; r < m; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c <= m; c++) A[r][c] -= f * A[i][c]; }
  }
  const co = new Array(m).fill(0);
  for (let i = m - 1; i >= 0; i--) { let s = A[i][m]; for (let j = i + 1; j < m; j++) s -= A[i][j] * co[j]; co[i] = s / A[i][i]; }
  let ss = 0;
  for (let k = 0; k < n; k++) { let y = 0, xp = 1; for (let i = 0; i < m; i++) { y += co[i] * xp; xp *= xs[k]; } ss += (ys[k] - y) ** 2; }
  return Math.sqrt(ss / Math.max(1, n - m));
}
// Longitude noise of the node function: sample 41 points 0.0005 d apart (+-0.01 d), unwrap,
// fit a cubic, take the RMS residual. Pure rounding/truncation noise shows up here;
// the smooth physical motion does not.
function lonNoiseDeg(jd, d) {
  const xs = [], ys = [];
  let prev = null, off = 0;
  for (let k = -20; k <= 20; k++) {
    const t = k * 0.0005;
    let l = nodeLon(jd + t, d);
    if (prev !== null) { const dl = l + off - prev; if (dl > 180) off -= 360; else if (dl < -180) off += 360; }
    l += off; prev = l; xs.push(t); ys.push(l);
  }
  return polyfitResidualRMS(xs, ys, 3);
}

// ---- main --------------------------------------------------------------------------------------
const jds = JSON.parse(fs.readFileSync(inFile, 'utf8')).jds;
const D_LIST = [0.0025, 0.005, 0.01, 0.02, 0.04];     // inner step (Moon velocity for the cross product); app uses 0.02
const H_LIST = [0.005, 0.01, 0.05];                   // outer step (speed of the node); app uses 0.005

const rows = [];
let maxReplicaLon = 0, maxReplicaSp = 0;
for (const jd of jds) {
  const r = ast.calc_ut(jd, 10);                      // exactly what app.js uses: [lon, 0, 1, speed, 0, 0]
  const rep = nodeLon(jd, 0.02);
  const repSp = nodeSpeed(jd, 0.02, 0.005);
  maxReplicaLon = Math.max(maxReplicaLon, Math.abs(wrap180(rep - r[0])));
  maxReplicaSp = Math.max(maxReplicaSp, Math.abs(repSp - r[3]));
  const variants = {};
  for (const d of D_LIST) for (const h of H_LIST) variants[`d${d}_h${h}`] = nodeSpeed(jd, d, h);
  const mlat = (j) => AE.Ecliptic(AE.GeoMoon(toDate(j))).elat;      // Moon ecliptic latitude (deg), for the amplification check
  rows.push({ jd, lon: r[0], speed: r[3], lonNoise: lonNoiseDeg(jd, 0.02), variants,
              moonLat: mlat(jd), moonLatRate: (mlat(jd + 0.005) - mlat(jd - 0.005)) / 0.01 });
}
if (maxReplicaLon > 1e-9 || maxReplicaSp > 1e-7) {
  console.error(`REPLICA MISMATCH vs app.js (lon ${maxReplicaLon}, speed ${maxReplicaSp}). app.js changed? Update nodeLon() here.`);
  process.exit(5);
}
const out = { dList: D_LIST, hList: H_LIST, appStepInner: 0.02, appStepOuter: 0.005, replicaMaxLonDiff: maxReplicaLon, replicaMaxSpeedDiff: maxReplicaSp, rows };
if (outFile) fs.writeFileSync(outFile, JSON.stringify(out));
else console.log(JSON.stringify(out).slice(0, 2000) + ' ...');
