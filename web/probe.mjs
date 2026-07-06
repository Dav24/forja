// Probe headless: reproduce el flujo del teléfono (carga por IP + click CTA).
// Uso: node probe.mjs [baseURL]
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://192.168.1.109:3000';
const UID = '11111111-1111-4111-8111-111111111111';
const URL = `${BASE}/?uid=${UID}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const issues = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    issues.push(`[console.${msg.type()}] ${msg.text()}`);
  }
});
page.on('pageerror', (err) => issues.push(`[pageerror] ${err.message}`));
page.on('requestfailed', (req) =>
  issues.push(`[requestfailed] ${req.method()} ${req.url()} — ${req.failure()?.errorText}`)
);
page.on('response', (res) => {
  if (res.status() >= 400) {
    issues.push(`[http ${res.status()}] ${res.url()}`);
  }
});

console.log(`→ Cargando ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 });
console.log('→ Página cargada (networkidle)');

const cta = page.getByText('Convertirme en Maestro').first();
const ctaVisible = await cta.isVisible().catch(() => false);
console.log(`→ CTA visible: ${ctaVisible}`);

let checkoutFired = false;
if (ctaVisible) {
  const waitCheckout = page
    .waitForRequest((req) => req.url().includes('/api/checkout'), { timeout: 10_000 })
    .then(() => { checkoutFired = true; })
    .catch(() => {});
  await cta.click();
  console.log('→ Click en CTA hecho, esperando /api/checkout (10s)…');
  await waitCheckout;
}

console.log(`\n=== RESULTADO ===`);
console.log(`/api/checkout disparado: ${checkoutFired ? 'SÍ ✓' : 'NO ✗'}`);
console.log(`Problemas capturados (${issues.length}):`);
for (const i of issues) console.log('  ' + i);

await browser.close();
process.exit(checkoutFired ? 0 : 1);
