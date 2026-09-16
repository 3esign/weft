/* core/weft_geom_ext4.js — fourth set of additions to the numeric kernel, needed by the ports of the
 * last three stdlib-only Level-2 generators: paired_sculpture_geometry.py (core/weft_paired_geometry.mjs),
 * aero_tower_geometry.py (core/weft_aero_geometry.mjs) and c1_calibration.py (core/weft_c1_calibration.mjs).
 * All three use Python's `math`, `json` / f-strings and argparse only, so core/weft_geom_ext.js
 * (math.hypot, round() keeping -0.0, repr(float), f"{x:.nf}", json.dumps) and core/weft_geom_ext2.js
 * (the libm names, a path-aware json.dumps) carry most of it. What they add:
 *
 *   - float ** 2 on a Python float is C pow(x, 2.0), and glibc's pow is NOT x*x: measured on 2,000,000
 *     sin() values in [0, 1], pow(x, 2.0) != x*x for 1805 of them (0.09%, one ulp each). V8's Math.pow(x, 2)
 *     IS x*x for every one of the same values. pySquare below is the port's single name for `x ** 2`; it
 *     goes through the swappable libmPow binding of core/weft_geom_ext2.js, so the parity tests can
 *     measure the port's sensitivity to that last bit the same way they do for sin / cos (a coordinate
 *     rounded to 3 decimals absorbs it unless the exact value sits within ~1e-15 of a rounding boundary).
 *   - str.rstrip() with no argument: Python's whitespace set is Py_UNICODE_ISSPACE, which is not
 *     JavaScript's trimEnd() set (Python strips U+001C..U+001F and U+0085, JavaScript strips U+FEFF).
 *   - open(path, encoding='utf-8').read(): text mode translates "\r\n" and a lone "\r" to "\n"
 *     (universal newlines) — the start / end blocks the calibration coupon wraps itself in are read that way.
 *   - float(str) as CPython parses it (whitespace stripped, underscores between digits, inf / nan), for
 *     argparse's type=float and for the coupon's comma-separated --widths.
 *   - pathlib.Path(...).stem (the last suffix removed, but a leading dot is not a suffix) and .with_name().
 *   - an argparse twin shared by the three ports: the same flags, defaults, types (float / int / str /
 *     float2 = nargs=2 / flag = store_true / choice = choices=(...)), required arguments, a Namespace in
 *     declaration order, and argparse's own error messages for the cases the ports can hit. The engine's
 *     makeArgParser (core/weft_discbody_engine.mjs) has no string choices and no required flags, which
 *     these scripts need (--variant, --lh, --bead, --plate, --out).
 *
 * Pure ES module, no dependencies beyond the earlier kernel files, which it does not touch.
 */
import { libmPow } from './weft_geom_ext2.js';

/* ------------------------------------------------------------------------------------------ */
/* libm                                                                                        */
/* ------------------------------------------------------------------------------------------ */

/** `x ** 2` on a Python float: float_pow converts the int 2 to 2.0 and calls C pow(x, 2.0). See the
 *  header for how glibc's pow and x*x part company; the port keeps the C-library name so the
 *  difference can be measured and, should a bit-exact glibc twin ever be needed, swapped in through
 *  weft_geom_ext2.setLibm({ pow }). */
export function pySquare(x){ return libmPow(x, 2); }

/* ------------------------------------------------------------------------------------------ */
/* Python str / io                                                                             */
/* ------------------------------------------------------------------------------------------ */

/** Py_UNICODE_ISSPACE: the code points str.strip()/rstrip()/split() treat as whitespace
 *  (Objects/unicodetype_db.h _PyUnicode_IsWhitespace plus the ASCII table in unicodeobject.c). */
export function pyIsSpace(c){
  return (c >= 0x09 && c <= 0x0d) || (c >= 0x1c && c <= 0x20) || c === 0x85 || c === 0xa0 || c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200a) || c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000;
}
/** str.rstrip() with no argument. */
export function pyRstrip(s){
  let i = s.length;
  while(i > 0 && pyIsSpace(s.charCodeAt(i - 1))) i--;
  return i === s.length ? s : s.slice(0, i);
}
/** str.strip() with no argument. */
export function pyStrip(s){
  let a = 0, b = s.length;
  while(a < b && pyIsSpace(s.charCodeAt(a))) a++;
  while(b > a && pyIsSpace(s.charCodeAt(b - 1))) b--;
  return s.slice(a, b);
}
/** What open(path, encoding='utf-8').read() returns for these bytes: universal newlines
 *  ("\r\n" -> "\n", then a lone "\r" -> "\n"; io.TextIOWrapper with newline=None). The UTF-8 BOM
 *  is NOT stripped (that is the 'utf-8-sig' codec, which the scripts do not use). */
export function pyReadText(buf){
  const s = typeof buf === 'string' ? buf : buf.toString('utf8');
  return s.indexOf('\r') < 0 ? s : s.replace(/\r\n?/g, '\n');
}

/** float(s) for a str, as CPython's PyOS_string_to_double behind float_new does it: surrounding
 *  whitespace (Py_UNICODE_ISSPACE) stripped, a single underscore allowed between two digits
 *  (PEP 515), "inf" / "infinity" / "nan" in any case with an optional sign, decimal notation only
 *  (no hex, no "0x", no trailing junk). Throws the ValueError text on anything else. */
export function pyFloat(s){
  if(typeof s === 'number') return s;
  const raw = String(s);
  const t = pyStrip(raw);
  if(/^[+-]?(inf|infinity|nan)$/i.test(t)){
    const neg = t[0] === '-';
    if(/nan$/i.test(t)) return NaN;
    return neg ? -Infinity : Infinity;
  }
  // underscores: only between two digits (the CPython _Py_string_to_number_with_underscores rule)
  if(t.includes('_') && /^_|_$|[^0-9]_|_[^0-9]/.test(t)) throw new Error(`could not convert string to float: '${raw}'`);
  const u = t.replace(/_/g, '');
  if(!/^[+-]?(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)$/.test(u)) throw new Error(`could not convert string to float: '${raw}'`);
  return Number(u);
}
/** int(s) for a str in base 10 (whitespace stripped, sign, digits, PEP 515 underscores). */
export function pyIntParse(s){
  if(typeof s === 'number'){ if(!Number.isInteger(s)) throw new Error(`invalid literal for int() with base 10: '${s}'`); return s; }
  const raw = String(s);
  const t = pyStrip(raw);
  if(!/^[+-]?\d+(?:_\d+)*$/.test(t)) throw new Error(`invalid literal for int() with base 10: '${raw}'`);
  return parseInt(t.replace(/_/g, ''), 10);
}

/* ------------------------------------------------------------------------------------------ */
/* pathlib                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** pathlib's separators on this platform: "/" on POSIX, "/" and "\" on Windows (Path() is the platform's
 *  flavour, so a backslash in --out is part of the file name on Linux and a separator on the Windows
 *  that built the specimens). */
const SEP_RE = process.platform === 'win32' ? /[\\/]+/ : /\/+/;
/** The final path component (PurePath.name): everything after the last separator; trailing
 *  separators are dropped first, as pathlib does ("dir/" -> "dir"). */
export function pyPathName(p){
  const parts = String(p).split(SEP_RE).filter(x => x !== '');
  return parts.length ? parts[parts.length - 1] : '';
}
/** PurePath.stem: the name without its last suffix, where a suffix is ".xyz" after a dot that is
 *  neither the first nor the last character of the name ("a.b.json" -> "a.b", ".hidden" -> ".hidden",
 *  "name." -> "name."). */
export function pyPathStem(p){
  const name = pyPathName(p);
  const i = name.lastIndexOf('.');
  return (i > 0 && i < name.length - 1) ? name.slice(0, i) : name;
}
/** str(Path(p).with_name(new)): pathlib normalises the path as it parses it — redundant separators
 *  and "." components vanish ("./rel/x.json" -> "rel/z.svg"), a trailing separator is dropped, ".." is
 *  kept — then the last component is replaced. This is the string the scripts print after "PREVIEW".
 *  (On Windows the drive / UNC anchor is not modelled beyond a leading separator.) */
export function pyPathWithName(p, newName){
  const s = String(p);
  const sep = process.platform === 'win32' ? '\\' : '/';
  const rooted = SEP_RE.test(s[0] || '') ? sep : '';
  const parts = s.split(SEP_RE).filter(x => x !== '' && x !== '.');
  parts.pop();
  parts.push(newName);
  return rooted + parts.join(sep);
}

/* ------------------------------------------------------------------------------------------ */
/* argparse                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/** An argparse twin. defs: [name, type, default, choices] rows in add_argument order (that is the
 *  Namespace order, i.e. the key order of the args object); type one of 'float' (type=float),
 *  'int' (type=int), 'str', 'float2' (type=float, nargs=2), 'flag' (action='store_true'), 'choice'
 *  (choices=(...) of strings). opts.required lists the required=True names.
 *  The returned parseArgs(input, { requireOut }) takes either an argv array (the command line, "--x v",
 *  "--x=v", dashes or underscores in the flag name) or a plain object (keys as flag names; a null value
 *  means "not given"). For the object form `out` is only required when requireOut is set, so a
 *  generator can be called in-process without a file name. Errors carry argparse's message text. */
export function makeArgparse(defs, opts = {}){
  const required = opts.required || [];
  const byName = new Map(defs.map(d => [d[0], d]));
  const conv = (def, v) => {
    const [name, type, , choices] = def;
    if(type === 'float') return pyFloat(v);
    if(type === 'int'){ try { return pyIntParse(v); } catch(e){ throw new Error(`argument --${name}: invalid int value: '${v}'`); } }
    if(type === 'float2'){ if(!Array.isArray(v) || v.length !== 2) throw new Error(`argument --${name}: expected 2 arguments`); return v.map(x => pyFloat(x)); }
    if(type === 'choice'){ if(!choices.includes(v)) throw new Error(`argument --${name}: invalid choice: '${v}' (choose from ${choices.map(c => `'${c}'`).join(', ')})`); return v; }
    if(type === 'flag') return !!v;
    return String(v);
  };
  const convOrArgparseError = (def, v) => {
    try { return conv(def, v); }
    catch(e){ if(def[1] === 'float' && /could not convert/.test(e.message)) throw new Error(`argument --${def[0]}: invalid float value: '${v}'`); throw e; }
  };
  return function parseArgs(input, { requireOut = false } = {}){
    const args = {};
    for(const [name, type, dflt] of defs) args[name] = type === 'float2' && Array.isArray(dflt) ? dflt.slice() : dflt;
    if(Array.isArray(input)){
      for(let i = 0; i < input.length; i++){
        let a = input[i];
        if(!a.startsWith('--')) throw new Error(`unrecognized arguments: ${a}`);
        let val; const eq = a.indexOf('=');
        if(eq >= 0){ val = a.slice(eq + 1); a = a.slice(0, eq); }
        const name = a.slice(2).replace(/-/g, '_');
        const def = byName.get(name);
        if(!def) throw new Error(`unrecognized arguments: ${a}`);
        if(def[1] === 'flag'){ if(eq >= 0) throw new Error(`argument ${a}: ignored explicit argument '${val}'`); args[name] = true; continue; }
        if(def[1] === 'float2'){
          const v2 = [];
          // argparse takes the next two tokens unless one looks like a flag; a negative number is a value
          while(v2.length < 2 && i + 1 < input.length && !(input[i + 1].startsWith('--') && Number.isNaN(Number(input[i + 1])))) v2.push(input[++i]);
          if(v2.length !== 2) throw new Error(`argument ${a}: expected 2 arguments`);
          args[name] = convOrArgparseError(def, v2); continue;
        }
        if(eq < 0){ val = input[++i]; if(val === undefined) throw new Error(`argument ${a}: expected one argument`); }
        args[name] = convOrArgparseError(def, val);
      }
      const missing = required.filter(n => args[n] === null || args[n] === undefined);
      if(missing.length) throw new Error(`the following arguments are required: ${missing.map(n => '--' + n).join(', ')}`);
    } else if(input && typeof input === 'object'){
      for(const [k0, v] of Object.entries(input)){
        const k = k0.replace(/-/g, '_');
        const def = byName.get(k);
        if(!def) throw new Error(`unknown argument ${k0}`);
        args[k] = (v === null || v === undefined) ? def[2] : convOrArgparseError(def, v);
      }
      const missing = required.filter(n => n !== 'out' && (args[n] === null || args[n] === undefined));
      if(missing.length) throw new Error(`the following arguments are required: ${missing.map(n => '--' + n).join(', ')}`);
      if(requireOut && required.includes('out') && (args.out === null || args.out === undefined)) throw new Error('the following arguments are required: --out');
    } else if(input !== undefined && input !== null) throw new Error('parseArgs: argv array or options object expected');
    return args;
  };
}
