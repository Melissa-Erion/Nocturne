// Builds the web app twice for the browser tests and serves both builds with a single-page-app fallback.
//   full → http://localhost:4310  on-device storage, paywall off (everyone has full access)
//   free → http://localhost:4311  on-device storage, paywall preview on (a user with no subscription)
// The builds run one after the other (with --clear) so their settings can't leak through the shared build cache.
// The project's .env is ignored (EXPO_NO_DOTENV), so tests never touch the real backend or payments.
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const builds = [['full', 4310, '0'], ['free', 4311, '1']];
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

for (const [name, , preview] of builds) {
  execSync(`npx expo export --platform web --clear --output-dir .e2e/${name}`, {
    stdio: 'inherit',
    env: { ...process.env, EXPO_NO_DOTENV: '1', EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_KEY: '', EXPO_PUBLIC_BILLING: 'off', EXPO_PUBLIC_PAYWALL_PREVIEW: preview },
  });
}
for (const [name, port] of builds) {
  const out = join('.e2e', name);
  createServer((req, res) => {
    let f = join(out, decodeURIComponent((req.url || '/').split('?')[0]));
    if (!existsSync(f) || statSync(f).isDirectory()) f = existsSync(f + '.html') ? f + '.html' : join(out, 'index.html');
    res.writeHead(200, { 'Content-Type': types[extname(f)] || 'application/octet-stream' });
    createReadStream(f).pipe(res);
  }).listen(port, () => console.log(`e2e ${name} build on http://localhost:${port}`));
}
