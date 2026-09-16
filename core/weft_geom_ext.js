/* core/weft_geom_ext.js — additions to the numeric kernel (core/weft_geom.js) needed by the
 * stdlib-only Level-2 generators (limit16_geometry.py, plate_geometry.py). Those two scripts use
 * Python's `math` module and `json.dumps` rather than numpy, and the two differ from the kernel's
 * numpy twins in ways that matter for bit parity:
 *
 *   - math.hypot is NOT the C library's hypot (which numpy.hypot calls and weft_geom.hypot mirrors):
 *     CPython 3.8+ has its own `vector_norm` (Modules/mathmodule.c), scaled Dekker double-length
 *     arithmetic with one Newton correction. The two disagree by one ulp in roughly one pair in 160
 *     (measured: 253 of 40000 random mm-range pairs). pyHypot below is vector_norm for two arguments,
 *     checked bit for bit against math.hypot on those 40000 pairs.
 *   - round(x, n) on a value like -0.0004 returns -0.0 and json.dumps writes "-0.0"; the kernel's
 *     pyRoundN deliberately squashes that to +0. pyRoundNSigned keeps the sign.
 *   - json.dumps writes floats with repr() ("23.0", "1e-05") and ints without a point, escapes every
 *     non-ASCII character as \uXXXX and uses (",", ":") separators or an indent. JSON.stringify does
 *     none of that, so pyJsonDumps re-implements the encoder; which numbers are Python floats is
 *     decided by the caller (JavaScript has one number type).
 *
 * Pure ES module, no dependencies. Nothing here touches core/weft_geom.js.
 */

/* ------------------------------------------------------------------------------------------ */
/* CPython math.hypot                                                                          */
/* ------------------------------------------------------------------------------------------ */

/** Dekker (1971) splitting: x = hi + lo exactly, hi with 26 significant bits. */
function dlSplit(x){ const t = x * 134217729.0; /* 2^27 + 1 */ const hi = t - (t - x); return [hi, x - hi]; }
/** Exact product as a double-double (CPython dl_mul, the Dekker branch; the fma branch gives the
 *  same pair because both are exact). */
function dlMul(x, y){
  const [xh, xl] = dlSplit(x), [yh, yl] = dlSplit(y);
  const p = xh * yh;
  const q = xh * yl + xl * yh;
  const z = p + q;
  const zz = p - z + q + xl * yl;
  return [z, zz];
}
/** CPython dl_fast_sum: requires |a| >= |b|. */
function dlFastSum(a, b){ const hi = a + b; const lo = (a - hi) + b; return [hi, lo]; }
/** C frexp exponent: e with x = m * 2^e and 0.5 <= |m| < 1 (x finite, non-zero). */
function frexpExp(x){
  x = Math.abs(x);
  let e = Math.floor(Math.log2(x)) + 1;
  let m = x / Math.pow(2, e);
  while(m >= 1){ m /= 2; e++; }
  while(m < 0.5){ m *= 2; e--; }
  return e;
}
/** math.hypot(x, y) as CPython 3.8+ computes it (mathmodule.c vector_norm with n = 2): both
 *  coordinates are scaled by 2^-e so the larger lies in [0.5, 1), squared exactly into (hi, lo)
 *  pairs, summed against a running csum that starts at 1.0, then sqrt and one differential
 *  correction h += (csum - 1 + fracs - h*h) / (2h). The sub-normal rescaling branch (max_e < -1023)
 *  is omitted: nothing in the generators is that small. */
export function pyHypot(x, y){
  x = Math.abs(x); y = Math.abs(y);
  const max = x > y ? x : y;
  if(!Number.isFinite(max)) return Number.isNaN(x) || Number.isNaN(y) ? NaN : Infinity;
  if(max === 0.0) return max;
  const scale = Math.pow(2, -frexpExp(max));
  let csum = 1.0, frac1 = 0.0, frac2 = 0.0;
  for(const v of [x, y]){
    const s = v * scale;                       // lossless scaling
    const pr = dlMul(s, s);                    // lossless squaring
    const sm = dlFastSum(csum, pr[0]);         // lossless addition
    csum = sm[0]; frac1 += pr[1]; frac2 += sm[1];   // lossy additions, as in C
  }
  let h = Math.sqrt(csum - 1.0 + (frac1 + frac2));
  const pr = dlMul(-h, h);
  const sm = dlFastSum(csum, pr[0]);
  csum = sm[0]; frac1 += pr[1]; frac2 += sm[1];
  const corr = csum - 1.0 + (frac1 + frac2);
  h += corr / (2.0 * h);                       // differential correction
  return h / scale;
}

/* ------------------------------------------------------------------------------------------ */
/* Python rounding / formatting                                                                 */
/* ------------------------------------------------------------------------------------------ */

/** The correctly rounded n-decimal string of x (ties to even on the EXACT binary value, as
 *  CPython's round() and format() both do), sign included ("-0.000" for -0.0004). toFixed rounds
 *  the exact value too but sends ties away from zero; an exact tie is detected from the full
 *  decimal expansion and pushed back onto the even neighbour on the decimal string, which never
 *  borrows and therefore also holds where 10^-n is below the ulp of x. Valid for |x| < 1e21. */
export function pyFixedString(x, n){
  const s = x.toFixed(n);
  const full = x.toFixed(Math.min(100, n + 30));
  const tail = full.slice(full.indexOf('.') + 1 + n);
  if(tail[0] === '5' && /^5(0*)$/.test(tail) && (+s[s.length - 1]) % 2 === 1)
    return s.slice(0, -1) + String((+s[s.length - 1]) - 1);
  return s;
}

/** Python's round(x, n), n > 0, keeping a negative zero: round(-0.0004, 3) is -0.0 in Python and
 *  json.dumps writes it as "-0.0". Same decimal rounding as weft_geom.pyRoundN (which squashes -0). */
export function pyRoundNSigned(x, n){
  if(!Number.isFinite(x)) return x;
  if(x === 0) return x;                                   // keeps -0
  const v = Number(pyFixedString(x, n));
  if(v === 0) return x < 0 ? -0.0 : 0.0;
  return v;
}

/** repr(float) — CPython's shortest round-trip representation (PyOS_double_to_string mode 'r'):
 *  fixed notation with at least one digit after the point when the decimal exponent is in
 *  [-4, 15], otherwise d.ddde±XX with a signed two-digit-minimum exponent ("1e-05", "1e+16").
 *  JavaScript's toExponential() with no argument yields the same shortest digit string. */
export function pyFloatRepr(x){
  if(Number.isNaN(x)) return 'nan';
  if(x === Infinity) return 'inf';
  if(x === -Infinity) return '-inf';
  if(x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
  const neg = x < 0; const ax = Math.abs(x);
  const ex = ax.toExponential();                          // "d.ddde+N" with shortest digits
  const m = /^(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(ex);
  const digits = m[1] + (m[2] || ''), e = parseInt(m[3], 10);
  let s;
  if(e >= -4 && e < 16){
    if(e >= 0){
      const intLen = e + 1;
      const intPart = digits.length >= intLen ? digits.slice(0, intLen) : digits + '0'.repeat(intLen - digits.length);
      const frac = digits.length > intLen ? digits.slice(intLen) : '0';
      s = intPart + '.' + frac;
    } else {
      s = '0.' + '0'.repeat(-e - 1) + digits;
    }
  } else {
    const mant = digits.length > 1 ? digits[0] + '.' + digits.slice(1) : digits;
    const ae = Math.abs(e);
    s = mant + 'e' + (e < 0 ? '-' : '+') + (ae < 10 ? '0' + ae : String(ae));
  }
  return neg ? '-' + s : s;
}

/** f"{x:.nf}" — fixed notation with correctly rounded (ties-to-even on the exact binary value)
 *  decimals, the sign of a negative zero kept ("-0.00"). */
export function pyFormatFixed(x, n){
  if(!Number.isFinite(x)) return pyFloatRepr(x);
  let s = pyFixedString(x, n);
  if((x < 0 || Object.is(x, -0)) && s[0] !== '-') s = '-' + s;   // toFixed drops the sign of -0
  return s;
}

/** Python's int(x) for a finite float: truncation towards zero. */
export function pyInt(x){ return Math.trunc(x); }

/* ------------------------------------------------------------------------------------------ */
/* json.dumps                                                                                  */
/* ------------------------------------------------------------------------------------------ */

/** String escaping of json.dumps with ensure_ascii=True (encoder.py ESCAPE_ASCII / py_encode_basestring_ascii):
 *  \" \\ \b \f \n \r \t, every other character outside 0x20..0x7E as \uXXXX (lower-case hex,
 *  surrogate pairs for astral code points). */
export function pyJsonString(s){
  let out = '"';
  for(let i = 0; i < s.length; i++){
    const ch = s[i], c = s.charCodeAt(i);
    if(ch === '"') out += '\\"';
    else if(ch === '\\') out += '\\\\';
    else if(ch === '\n') out += '\\n';
    else if(ch === '\r') out += '\\r';
    else if(ch === '\t') out += '\\t';
    else if(ch === '\b') out += '\\b';
    else if(ch === '\f') out += '\\f';
    else if(c < 0x20 || c > 0x7e) out += '\\u' + c.toString(16).padStart(4, '0');   // UTF-16 units = Python's surrogate pairs
    else out += ch;
  }
  return out + '"';
}

/** json.dumps(obj, separators=(",", ":")) or json.dumps(obj, indent=n) for plain data.
 *  Python has ints and floats; JavaScript has numbers, so the caller says which numbers are ints:
 *  opts.isInt(key) receives the nearest enclosing object key of the number (arrays are looked
 *  through) and returns true for a Python int. Integer-valued numbers under any other key are
 *  written as floats ("23.0"), non-integer numbers are written with repr() either way. Booleans,
 *  null and strings follow the Python encoder; NaN/Infinity are written as Python does with
 *  allow_nan=True. Key order is the object's own (dict insertion order in the Python). */
export function pyJsonDumps(obj, opts = {}){
  const isInt = opts.isInt || (() => false);
  const indent = opts.indent == null ? null : opts.indent;
  const itemSep = indent == null ? ',' : ',';
  const keySep = indent == null ? ':' : ': ';
  const pad = (lvl) => indent == null ? '' : '\n' + ' '.repeat(indent * lvl);
  function enc(v, key, lvl){
    if(v === null || v === undefined) return 'null';
    if(v === true) return 'true';
    if(v === false) return 'false';
    if(typeof v === 'number'){
      if(Number.isNaN(v)) return 'NaN';
      if(v === Infinity) return 'Infinity';
      if(v === -Infinity) return '-Infinity';
      if(isInt(key)) return String(v);
      return pyFloatRepr(v);
    }
    if(typeof v === 'string') return pyJsonString(v);
    if(Array.isArray(v)){
      if(v.length === 0) return '[]';
      const parts = v.map(x => enc(x, key, lvl + 1));
      if(indent == null) return '[' + parts.join(itemSep) + ']';
      return '[' + pad(lvl + 1) + parts.join(itemSep + pad(lvl + 1)) + pad(lvl) + ']';
    }
    if(typeof v === 'object'){
      const keys = Object.keys(v);
      if(keys.length === 0) return '{}';
      const parts = keys.map(k => pyJsonString(k) + keySep + enc(v[k], k, lvl + 1));
      if(indent == null) return '{' + parts.join(itemSep) + '}';
      return '{' + pad(lvl + 1) + parts.join(itemSep + pad(lvl + 1)) + pad(lvl) + '}';
    }
    throw new TypeError(`Object of type ${typeof v} is not JSON serializable`);
  }
  return enc(obj, null, 0);
}
