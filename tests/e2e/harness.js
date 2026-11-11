// Shared setup for the browser tests: each test file starts its own server on
// a free port and drives headless Chromium (software WebGL).
// Run with `npm run test:e2e`; needs `npx playwright install chromium` once.
import { before, after } from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let server;
let browser;
let base;

before(async () => {
  server = spawn('python3', [path.join(ROOT, 'serve.py'), '--port', '0'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  base = await new Promise((resolve, reject) => {
    let out = '';
    server.stdout.on('data', (chunk) => {
      out += chunk;
      const m = out.match(/http:\/\/[\d.]+:(\d+)\//);
      if (m) resolve(`http://127.0.0.1:${m[1]}/`);
    });
    server.on('exit', (code) => reject(new Error(`test server exited with ${code}`)));
  });
  browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
});

after(async () => {
  await browser?.close();
  server?.kill();
});

// `offline` blocks every request that leaves the test server, as if the
// network (or a CDN) were down.
export async function open({
  viewport = { width: 1280, height: 720 },
  reducedMotion = 'no-preference',
  hash = 'sic',
  offline = false,
} = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (offline) await page.route((url) => !url.href.startsWith(base), (route) => route.abort());
  await page.goto(`${base}#${hash}`);
  await page.waitForFunction(() => window.__pageDebug?.viewer);
  return {
    page,
    errors,
    close: () => ctx.close(),
    state: () => page.evaluate(() => JSON.parse(JSON.stringify(window.__pageDebug.state))),
    step: () => page.evaluate(() => window.__pageDebug.tour.currentStep()),
    active: () => page.evaluate(() => window.__pageDebug.tour.isActive()),
    goTo: (n) => page.click(`#tour-progress [data-step="${n - 1}"]`),
  };
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
