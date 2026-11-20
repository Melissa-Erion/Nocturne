// Builds the Guides section (regimenfit.ca/guides/) from Markdown files in guides/.
// Each file starts with a front-matter block:
//   ---
//   title: Plan your meals to the gram
//   description: One sentence for search results and the card.
//   kind: Tutorial            (Tutorial or Article)
//   minutes: 4
//   image: /img/app/meals.webp (card thumbnail and social preview)
//   order: 3                  (position in the list)
//   ---
// Supported Markdown: ## and ### headings, paragraphs, - and 1. lists, **bold**, *italic*, [links](/url),
// ![caption](/img/app/x.webp) for an app screenshot in a phone frame, > a tip box, and `code`.
// Usage: called by build-landing.mjs, or `node scripts/build-guides.mjs <outDir>` to build on its own.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
}

/** Minimal Markdown → HTML for the guides (see the header for what's supported). */
export function markdown(src) {
  const out = []; const lines = src.replace(/\r/g, '').split('\n'); let i = 0;
  const para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para.length = 0; } };
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { flush(); i++; continue; }
    let m;
    if ((m = l.match(/^(#{2,3})\s+(.*)$/))) {
      flush(); const lvl = m[1].length; const id = m[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      out.push(`<h${lvl} id="${id}">${inline(m[2])}</h${lvl}>`); i++; continue;
    }
    if ((m = l.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/))) {
      flush();
      out.push(`<figure class="shot"><div class="phone"><img src="${m[2]}" width="600" height="1298" alt="${esc(m[1])}" loading="lazy"></div>${m[1] ? `<figcaption>${inline(m[1])}</figcaption>` : ''}</figure>`);
      i++; continue;
    }
    if (/^>\s?/.test(l)) {
      flush(); const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<aside class="tip">${inline(q.join(' '))}</aside>`); continue;
    }
    if (/^(-|\d+\.)\s+/.test(l)) {
      flush(); const ordered = /^\d+\./.test(l); const items = [];
      while (i < lines.length && /^(-|\d+\.)\s+/.test(lines[i])) {
        let t = lines[i].replace(/^(-|\d+\.)\s+/, ''); i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) { t += ' ' + lines[i].trim(); i++; }
        items.push(`<li>${inline(t)}</li>`);
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`); continue;
    }
    para.push(l.trim()); i++;
  }
  flush();
  return out.join('\n');
}

function parse(file, src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta = Object.fromEntries(m[1].split('\n').filter(Boolean).map(l => { const k = l.indexOf(':'); return [l.slice(0, k).trim(), l.slice(k + 1).trim()]; }));
  for (const k of ['title', 'description', 'kind', 'minutes', 'image', 'order']) if (!meta[k]) throw new Error(`${file}: missing "${k}"`);
  return { slug: file.replace(/\.md$/, ''), ...meta, order: Number(meta.order), body: m[2] };
}

const css = `
.crumbs { font-size: 14px; color: var(--dark-soft); }
.crumbs a { text-decoration: none; } .crumbs a:hover { text-decoration: underline; }
.g-head { padding: 56px 0 24px; }
.g-head h1 { font-size: clamp(42px, 6vw, 72px); margin-top: 14px; max-width: 900px; }
.g-head .lede { margin-top: 16px; }
.g-meta { margin-top: 16px; color: var(--dark-soft); font-size: 14px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.g-meta b { color: var(--deep); }
.article { max-width: 720px; padding: 8px 0 90px; font-size: 18px; line-height: 1.7; }
.article h2 { font-size: clamp(30px, 3.6vw, 40px); margin: 52px 0 14px; }
.article h3 { font-size: 24px; font-stretch: 85%; margin: 34px 0 10px; }
.article p { margin: 0 0 18px; }
.article ul, .article ol { margin: 0 0 20px; padding-left: 24px; }
.article li { margin: 6px 0; }
.article a { color: var(--deep); font-weight: 600; }
.article code { background: var(--paper2); border-radius: 6px; padding: 1px 6px; font-size: .92em; }
.article strong { font-weight: 700; }
.tip { margin: 24px 0; background: var(--card); border: 1px solid var(--paper3); border-left: 4px solid var(--deep); border-radius: 12px; padding: 16px 20px; font-size: 16.5px; }
.shot { margin: 28px 0 34px; display: grid; justify-items: center; gap: 12px; }
.shot .phone { width: 280px; }
.shot figcaption { font-size: 14.5px; color: var(--dark-soft); text-align: center; max-width: 420px; }
.g-cta { margin: 48px 0 0; background: var(--ink); color: var(--text); border-radius: var(--r); padding: 30px; display: grid; gap: 14px; }
.g-cta h2 { margin: 0; font-size: 34px; } .g-cta p { margin: 0; color: var(--soft); font-size: 17px; }
.g-cta .btn { justify-self: start; background: var(--purple); color: var(--ink); }
.g-next { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 28px; }
.g-next a { text-decoration: none; background: var(--card); border: 1px solid var(--paper3); border-radius: 14px; padding: 16px 18px; font-size: 16px; }
.g-next small { display: block; color: var(--dark-soft); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.g-list h2 { font-size: clamp(30px, 3.6vw, 40px); margin: 40px 0 0; }
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; margin: 24px 0 20px; }
.cards a { text-decoration: none; background: var(--card); border: 1px solid var(--paper3); border-radius: var(--r); overflow: hidden; display: flex; flex-direction: column; transition: transform .15s ease; }
.cards a:hover { transform: translateY(-3px); }
.cards .thumb { height: 180px; overflow: hidden; background: var(--ink); display: flex; justify-content: center; padding-top: 18px; }
.cards .thumb img { width: 180px; height: auto; align-self: flex-start; border-radius: 14px; }
.cards .copy { padding: 18px 20px 22px; }
.cards small { color: var(--deep); font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.cards h3 { font-size: 24px; font-stretch: 80%; line-height: 1.08; margin-top: 6px; }
.cards p { color: var(--dark-soft); font-size: 15px; margin-top: 8px; }
@media (max-width: 900px) { .cards { grid-template-columns: 1fr 1fr; } }
@media (max-width: 560px) { .cards, .g-next { grid-template-columns: 1fr; } .article { font-size: 17px; } .shot .phone { width: 250px; } }
@media (min-width: 901px) { .mnav { display: none !important; } }
`;

function page({ site, path, title, description, image, jsonld, body }) {
  return `<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${site}${path}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#f3efe7">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/icon.png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Regimen">
<meta property="og:url" content="${site}${path}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${site}/img/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site.css">
<style>${css}</style>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="wrap">
    <a class="brand" href="/" aria-label="Regimen home"><i></i>Regimen</a>
    <nav class="nav" aria-label="Main">
      <a href="/#adapts">How it works</a>
      <a href="/#pricing">Pricing</a>
      <a href="/guides/" aria-current="page">Guides</a>
    </nav>
    <div class="right">
      <a class="login" href="/app/">Log in</a>
      <a class="btn btn-primary btn-sm" href="/app/">Start free</a>
      <button class="menu-btn" id="menu-btn" type="button" aria-expanded="false" aria-controls="mnav" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
  </div>
  <nav class="mnav" id="mnav" aria-label="Menu" hidden>
    <a href="/#adapts">How it works</a><a href="/#pricing">Pricing</a><a href="/guides/">Guides</a><a href="/app/">Log in</a>
  </nav>
</header>
<main id="main">
${body}
</main>
<footer>
  <div class="wrap">
    <a class="brand" href="/"><i></i>Regimen</a>
    <span>© ${new Date().getFullYear()} Regimen</span>
    <nav aria-label="Footer"><a href="/app/">Open the app</a><a href="/guides/">Guides</a><a href="/#pricing">Pricing</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="mailto:support@regimenfit.ca">support@regimenfit.ca</a></nav>
    <p class="disclaimer">Regimen provides planning estimates, not medical advice. Consult a qualified professional before making large changes to your diet or training.</p>
  </div>
</footer>
<div class="sticky"><a class="btn btn-primary" href="/app/">Start free</a></div>
<script>
(function () {
  var btn = document.getElementById('menu-btn'), menu = document.getElementById('mnav'); if (!btn || !menu) return;
  var set = function (open) { btn.setAttribute('aria-expanded', String(open)); menu.hidden = !open; };
  btn.addEventListener('click', function (e) { e.stopPropagation(); set(menu.hidden); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { set(false); btn.focus(); } });
})();
</script>
</body>
</html>
`;
}

const card = g => `<a href="/guides/${g.slug}/"><div class="thumb"><img src="${g.image}" width="600" height="1298" alt="" loading="lazy"></div><div class="copy"><small>${esc(g.kind)} · ${g.minutes} min</small><h3>${esc(g.title)}</h3><p>${esc(g.description)}</p></div></a>`;

/** Write dist/guides/** and return the guide URLs (for the sitemap). */
export function buildGuides(outDir, site) {
  const srcDir = new URL('../guides/', import.meta.url).pathname;
  const guides = readdirSync(srcDir).filter(f => f.endsWith('.md')).map(f => parse(f, readFileSync(join(srcDir, f), 'utf8'))).sort((a, b) => a.order - b.order);
  const org = { '@type': 'Organization', name: 'Regimen', url: `${site}/` };
  guides.forEach((g, i) => {
    const prev = guides[i - 1], next = guides[i + 1];
    const body = `<div class="wrap">
  <div class="g-head">
    <div class="crumbs"><a href="/guides/">Guides</a> › ${esc(g.kind)}s</div>
    <h1>${esc(g.title)}</h1>
    <p class="lede">${esc(g.description)}</p>
    <div class="g-meta"><b>${esc(g.kind)}</b> · ${g.minutes} min read</div>
  </div>
  <article class="article">
${markdown(g.body)}
    <div class="g-cta"><h2>Try it in Regimen</h2><p>Free to start. Your plan is about two minutes away.</p><a class="btn" href="/app/">Start free</a></div>
    <nav class="g-next" aria-label="More guides">
      ${prev ? `<a href="/guides/${prev.slug}/"><small>Previous</small>${esc(prev.title)}</a>` : '<span></span>'}
      ${next ? `<a href="/guides/${next.slug}/" style="text-align:right"><small>Next</small>${esc(next.title)}</a>` : ''}
    </nav>
  </article>
</div>`;
    const jsonld = { '@context': 'https://schema.org', '@graph': [
      { '@type': 'Article', headline: g.title, description: g.description, image: `${site}${g.image}`, author: org, publisher: { ...org, logo: `${site}/icon.png` }, mainEntityOfPage: `${site}/guides/${g.slug}/`, inLanguage: 'en-CA' },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Guides', item: `${site}/guides/` }, { '@type': 'ListItem', position: 2, name: g.title, item: `${site}/guides/${g.slug}/` }] },
    ] };
    const dir = join(outDir, 'guides', g.slug); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), page({ site, path: `/guides/${g.slug}/`, title: `${g.title} | Regimen guides`, description: g.description, image: g.image, jsonld, body }));
  });
  const tut = guides.filter(g => g.kind === 'Tutorial'), art = guides.filter(g => g.kind !== 'Tutorial');
  const indexBody = `<div class="wrap g-list">
  <div class="g-head">
    <span class="eyebrow">Guides</span>
    <h1>Get the most out of Regimen.</h1>
    <p class="lede">Step-by-step tutorials with screenshots, plus straightforward answers about training and nutrition.</p>
  </div>
  <h2>Tutorials</h2>
  <div class="cards">${tut.map(card).join('')}</div>
  ${art.length ? `<h2>Training and nutrition</h2><div class="cards">${art.map(card).join('')}</div>` : ''}
  <div style="height:80px"></div>
</div>`;
  mkdirSync(join(outDir, 'guides'), { recursive: true });
  writeFileSync(join(outDir, 'guides', 'index.html'), page({ site, path: '/guides/', title: 'Regimen guides: tutorials and how-tos', description: 'Step-by-step tutorials for Regimen with screenshots, plus straightforward answers about training and nutrition.', image: '/img/app/today.webp',
    jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Regimen guides', url: `${site}/guides/`, hasPart: guides.map(g => ({ '@type': 'Article', headline: g.title, url: `${site}/guides/${g.slug}/` })) }, body: indexBody }));
  return ['/guides/', ...guides.map(g => `/guides/${g.slug}/`)];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] || new URL('../dist/', import.meta.url).pathname;
  const urls = buildGuides(out, (process.env.SITE_URL || 'https://regimenfit.ca').replace(/\/$/, ''));
  console.log(`Built ${urls.length - 1} guides into ${out}guides/`);
}
