// Copies the static landing site (landing/) into dist/ next to the app (dist/app/), filling in the site address.
// SITE_URL (default https://regimenfit.ca) is used for canonical links, the sitemap, social previews and llms.txt.
import { cpSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildGuides } from './build-guides.mjs';

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
// Guides (regimenfit.ca/guides/) from guides/*.md, added to the sitemap.
const guideUrls = buildGuides(out, SITE);
const sm = join(out, 'sitemap.xml');
writeFileSync(sm, readFileSync(sm, 'utf8').replace('</urlset>', guideUrls.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${DATE}</lastmod><changefreq>monthly</changefreq><priority>${u === '/guides/' ? '0.8' : '0.6'}</priority></url>\n`).join('') + '</urlset>'));
// Custom domain for GitHub Pages.
const host = new URL(SITE).host;
if (!host.endsWith('github.io')) writeFileSync(join(out, 'CNAME'), host + '\n');
console.log(`Landing site built for ${SITE}`);
