#!/usr/bin/env python3
"""Legacy WEFT packaging CLI; delegates to the canonical Node implementation.

All former --gcode/--template/--out/--name/--thumb/--layer-height/--density/
--accel-fudge arguments are forwarded. G-668: no second unguarded image writer.
"""
import pathlib
import subprocess
import sys

entry = pathlib.Path(__file__).resolve().parent / 'tools' / 'pack_bambu_3mf.mjs'
try:
    result = subprocess.run(['node', str(entry), *sys.argv[1:]], check=False)
except FileNotFoundError:
    sys.exit('WEFT packaging requires Node.js; no unvalidated Python fallback is allowed.')
sys.exit(result.returncode)
