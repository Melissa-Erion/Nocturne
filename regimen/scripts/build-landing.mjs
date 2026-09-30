// Copies the static landing site (landing/) into dist/ next to the app (dist/app/), filling in the site address.
// SITE_URL (default https://regimenfit.ca) is used for canonical links, the sitemap, social previews and llms.txt.
import { cpSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = (process.env.SITE_URL || 'https://regimenfit.ca').replace(/\/$/, '');
const DATE = new Date().toISOString().slice(0, 10);
const src = new URL('../landing/', import.meta.url).pathname;
const out = new URL('../dist/', import.meta.url).pathname;

cpSync(src, out, { recursive: true });
const fill = dir => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== 'app') fill(p); continue; }
    if (!/\.(html|txt|xml)$/.test(f)) continue;
    writeFileSync(p, readFileSync(p, 'utf8').replaceAll('{{SITE}}', SITE).replaceAll('{{DATE}}', DATE));
  }
};
fill(out);
// Custom domain for GitHub Pages.
const host = new URL(SITE).host;
if (!host.endsWith('github.io')) writeFileSync(join(out, 'CNAME'), host + '\n');
console.log(`Landing site built for ${SITE}`);
