// HTML → PNG with a headless browser. Order: $BTC_TA_CHROME, Playwright's chrome-headless-shell, system Chrome/Chromium, Firefox.
import { execFile } from 'node:child_process';
import { readdir, access, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const exists = p => access(p).then(() => true, () => false);

async function which(bin) {
  for (const dir of (process.env.PATH || '').split(':')) if (dir && await exists(join(dir, bin))) return join(dir, bin);
  return null;
}

async function findBrowser() {
  if (process.env.BTC_TA_CHROME) return { kind: 'chrome', bin: process.env.BTC_TA_CHROME };
  const pw = join(homedir(), '.cache', 'ms-playwright');
  const dirs = (await readdir(pw).catch(() => [])).sort().reverse();
  for (const d of dirs.filter(d => d.startsWith('chromium_headless_shell-'))) {
    const bin = join(pw, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
    if (await exists(bin)) return { kind: 'chrome', bin };
  }
  for (const d of dirs.filter(d => /^chromium-\d+$/.test(d))) {
    const bin = join(pw, d, 'chrome-linux64', 'chrome');
    if (await exists(bin)) return { kind: 'chrome', bin };
  }
  for (const b of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const bin = await which(b); if (bin) return { kind: 'chrome', bin };
  }
  const ff = await which('firefox');
  if (ff) return { kind: 'firefox', bin: ff };
  throw new Error('nessun browser headless trovato (imposta BTC_TA_CHROME)');
}

export async function screenshot(htmlPath, pngPath, { width = 1600, height = 1200 } = {}) {
  const { kind, bin } = await findBrowser();
  const url = pathToFileURL(resolve(htmlPath)).href, out = resolve(pngPath);
  const argv = kind === 'chrome'
    ? ['--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
       `--window-size=${width},${height}`, '--virtual-time-budget=4000', `--screenshot=${out}`, url]
    : ['--headless', '--screenshot', out, `--window-size=${width},${height}`, url];
  await run(bin, argv, { timeout: 60000 });
  if (!(await stat(out)).size) throw new Error('screenshot vuoto');
  return out;
}

// CLI: node screenshot.mjs page.html out.png [width] [height]
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [html, png, w, h] = process.argv.slice(2);
  console.log(await screenshot(html, png, { width: +w || 1600, height: +h || 1200 }));
}
