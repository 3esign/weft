/* core/weft_geom_ext2.js — second set of additions to the numeric kernel, needed by the port of
 * sculpture_geometry.py (core/weft_sculpture_geometry.mjs). That script is stdlib-only (math + json)
 * like limit16_geometry.py, so everything in core/weft_geom_ext.js applies; what it adds is heavy
 * use of the C library's transcendental functions, Python's list repr in f-strings, and two
 * json.dumps calls on the same tree where one key name ("paths") holds an int in one place and
 * float coordinates in another.
 *
 *   - libm: CPython's math.sin / cos / atan2 / atan / pow call the C library. On this platform that
 *     is glibc 2.39 on an x86-64 with FMA, which dispatches to the FMA-compiled variants of the IBM
 *     Accurate Mathematical Library (~0.55 ulp, NOT correctly rounded). V8's Math.sin/cos/atan2/pow
 *     are fdlibm ports (also < 1 ulp, not correctly rounded). The two disagree by one ulp in about
 *     3% of arguments (measured 151 / 4855 for cos). The generator rounds every coordinate to 2-4
 *     decimals, so a one-ulp disagreement reaches the JSON only when the exact value sits within
 *     ~1e-14 of a rounding boundary; tests/sculpture_geom_parity.test.mjs measures whether that
 *     happens. The names below (libmSin, ...) are the single place to swap in a bit-exact twin.
 *   - pyListRepr: Python's repr of a list of floats, "[20.0, 30.0, 40.0]" (f'{LINTELS}').
 *   - pyJsonDumpsPath: json.dumps whose int/float decision sees the whole key path, not just the
 *     nearest key (summary.foundation.paths is an int, foundation.paths[i][j][k] are floats).
 *   - pySum: the builtin sum() of a float list as CPython 3.11 computes it (left-to-right double
 *     accumulation). NOTE: CPython 3.12+ changed sum() of floats to Neumaier compensated summation;
 *     the Python script's own output would then differ in the last bits. The reference here is 3.11.
 *
 * Pure ES module, no dependencies. Nothing here touches core/weft_geom.js or core/weft_geom_ext.js.
 */
import { pyFloatRepr, pyJsonString } from './weft_geom_ext.js';

/* ------------------------------------------------------------------------------------------ */
/* libm                                                                                        */
/* ------------------------------------------------------------------------------------------ */

/** C library sin/cos/atan2/atan/pow as the port sees them. V8's implementations (fdlibm) are used;
 *  see the header for the measured disagreement with glibc. */
export let libmSin = Math.sin;
export let libmCos = Math.cos;
export let libmAtan2 = Math.atan2;
export let libmAtan = Math.atan;
export let libmPow = Math.pow;
export const libmSqrt = Math.sqrt;        // correctly rounded everywhere: identical by IEEE 754
/** Swap the libm bindings (live ES-module bindings: importers see the change). Used by the parity
 *  test to measure the port's sensitivity to one-ulp libm differences, and the hook for a
 *  bit-exact glibc twin should one ever be needed. Returns the previous set. */
export function setLibm(fns = {}){
  const prev = { sin: libmSin, cos: libmCos, atan2: libmAtan2, atan: libmAtan, pow: libmPow };
  if(fns.sin) libmSin = fns.sin;
  if(fns.cos) libmCos = fns.cos;
  if(fns.atan2) libmAtan2 = fns.atan2;
  if(fns.atan) libmAtan = fns.atan;
  if(fns.pow) libmPow = fns.pow;
  return prev;
}

/** math.radians(x) = x * (pi / 180.0) with the quotient a compile-time constant (mathmodule.c
 *  degToRad); math.degrees(x) = x * (180.0 / pi). Not x * pi / 180. */
const DEG_TO_RAD = Math.PI / 180.0, RAD_TO_DEG = 180.0 / Math.PI;
export function pyRadians(x){ return x * DEG_TO_RAD; }
export function pyDegrees(x){ return x * RAD_TO_DEG; }

/** builtin sum() of floats, CPython 3.11: a double accumulator starting at int 0, left to right. */
export function pySum(a){ let s = 0.0; for(let i = 0; i < a.length; i++) s += a[i]; return s; }

/* ------------------------------------------------------------------------------------------ */
/* Python repr / json                                                                          */
/* ------------------------------------------------------------------------------------------ */

/** repr() of a Python list of floats: "[20.0, 30.0]", "[]". */
export function pyListRepr(a){ return '[' + a.map(pyFloatRepr).join(', ') + ']'; }

/** json.dumps(obj, separators=(",", ":")) / json.dumps(obj, indent=n) like weft_geom_ext.pyJsonDumps,
 *  but the int decision receives the full key path of the number: opts.isInt(path) where path is
 *  the list of object keys from the root to the number (array indices are not part of it, so
 *  "summary.nodeDensity.ladder" covers every element of that list). Strings, booleans, null,
 *  NaN/Infinity and key order as in pyJsonDumps. */
export function pyJsonDumpsPath(obj, opts = {}){
  const isInt = opts.isInt || (() => false);
  const indent = opts.indent == null ? null : opts.indent;
  const keySep = indent == null ? ':' : ': ';
  const pad = (lvl) => indent == null ? '' : '\n' + ' '.repeat(indent * lvl);
  const path = (opts.rootPath || []).slice();     // where obj sits in the larger tree (for a sub-tree dump)
  function enc(v, lvl){
    if(v === null || v === undefined) return 'null';
    if(v === true) return 'true';
    if(v === false) return 'false';
    if(typeof v === 'number'){
      if(Number.isNaN(v)) return 'NaN';
      if(v === Infinity) return 'Infinity';
      if(v === -Infinity) return '-Infinity';
      if(isInt(path)) return String(v);
      return pyFloatRepr(v);
    }
    if(typeof v === 'string') return pyJsonString(v);
    if(Array.isArray(v)){
      if(v.length === 0) return '[]';
      const parts = v.map(x => enc(x, lvl + 1));
      if(indent == null) return '[' + parts.join(',') + ']';
      return '[' + pad(lvl + 1) + parts.join(',' + pad(lvl + 1)) + pad(lvl) + ']';
    }
    if(typeof v === 'object'){
      const keys = Object.keys(v);
      if(keys.length === 0) return '{}';
      const parts = keys.map(k => { path.push(k); const s = pyJsonString(k) + keySep + enc(v[k], lvl + 1); path.pop(); return s; });
      if(indent == null) return '{' + parts.join(',') + '}';
      return '{' + pad(lvl + 1) + parts.join(',' + pad(lvl + 1)) + pad(lvl) + '}';
    }
    throw new TypeError(`Object of type ${typeof v} is not JSON serializable`);
  }
  return enc(obj, 0);
}
