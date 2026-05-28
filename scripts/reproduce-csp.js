import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const app = express();

  // Serve dist with a strict CSP that disallows eval
  app.use((req, res, next) => {
    // Allow external scripts/styles/connect but disallow string-eval (no 'unsafe-eval')
    res.setHeader('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' https:; connect-src 'self' https:; style-src 'self' https: 'unsafe-inline'; font-src 'self' https: data:; object-src 'none';");
    next();
  });

  app.use(express.static(path.join(__dirname, '..', 'dist')));
  // SPA fallback to index.html for client-side routes
  app.use((req, res) => res.sendFile(path.join(__dirname, '..', 'dist', 'index.html')));

  const server = app.listen(3001);
  console.log('Serving dist on http://localhost:3001 with CSP header');

  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const page = await browser.newPage();

  // Attach a listener in the page to capture SecurityPolicyViolationEvent
  await page.evaluateOnNewDocument(() => {
    window.addEventListener('securitypolicyviolation', (ev) => {
      // Use console.error so Puppeteer picks it up in page.on('console')
      // eslint-disable-next-line no-console
      console.error('CSP-VIOLATION', ev.violatedDirective, ev.effectiveDirective, ev.blockedURI, ev.sourceFile, ev.originalPolicy);
    });
  });

  page.on('console', msg => {
    try {
      console.log('[PAGE CONSOLE]', msg.type(), msg.text());
    } catch (e) { console.log('[PAGE CONSOLE] (could not stringify)'); }
  });
  page.on('pageerror', err => console.log('[PAGE ERROR]', err && err.message));
  page.on('requestfailed', req => { const f = req.failure && req.failure(); console.log('[REQUEST FAILED]', req.url(), f && f.errorText); });

  try {
    await page.goto('http://localhost:3001/tree', { waitUntil: 'networkidle2', timeout: 30000 });
    // wait a bit for runtime logs
    await new Promise((r) => setTimeout(r, 6000));
  } catch (err) {
    console.error('Navigation error:', err && err.message);
  }

  await browser.close();
  server.close();
}

run().catch(err => { console.error(err); process.exit(1); });
