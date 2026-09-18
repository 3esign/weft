import { chromium } from 'playwright';
import fs from 'node:fs';
const [svgPath, pngPath] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.WEFT_CHROMIUM });
const p = await b.newPage({ viewport: { width: 1800, height: 1120 }, deviceScaleFactor: 1 });
await p.setContent(`<html><body style="margin:0;background:#070a12">${fs.readFileSync(svgPath, 'utf8').replace('<svg ', '<svg width="1800" height="1120" ')}</body></html>`);
await p.screenshot({ path: pngPath });
await b.close();
