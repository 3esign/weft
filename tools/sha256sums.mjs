#!/usr/bin/env node
/* Write SHA256SUMS.txt for one or more specimen folders (every regular file except SHA256SUMS.txt itself),
   in the `sha256sum -c` format, so a printed file can be matched to the record on any machine.
   usage: node tools/sha256sums.mjs specimens/2026-09-25_PRAG_A2L_X1_experimental [more folders...] */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
for(const dir of process.argv.slice(2)){
  const names = fs.readdirSync(dir).filter(n => n !== 'SHA256SUMS.txt' && fs.statSync(path.join(dir, n)).isFile()).sort();
  const lines = names.map(n => `${createHash('sha256').update(fs.readFileSync(path.join(dir, n))).digest('hex')}  ${n}`);
  fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
  console.log(`${dir}: ${names.length} files`);
}
