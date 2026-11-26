// Percorre o app (build web de captura) como um motorista e grava as telas do README.
// Uso: node tour.mjs <url> <pasta-de-saída> <stills|video>
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [url, out, mode = 'stills'] = process.argv.slice(2);
const video = mode === 'video';
const W = 390;
const H = 844;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({
  viewport: { width: W, height: H },
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
  deviceScaleFactor: 2,
  ...(video ? { recordVideo: { dir: out, size: { width: W, height: H } } } : {}),
});
await context.addInitScript(() => {
  // Relógio fixo às 13h52, para a viagem cair na janela das 14h às 16h.
  const target = new Date('2026-11-25T13:52:00-03:00').getTime();
  const RealDate = Date;
  const offset = target - RealDate.now();
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(RealDate.now() + offset);
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  window.Date = FixedDate;
  // O recebedor do modo Mock é sorteado: com valores entre 0,1 e 0,6 ele confirma a doca
  // e a rede simulada não perde envios. Os IDs continuam únicos.
  const random = Math.random.bind(Math);
  Math.random = () => 0.1 + random() * 0.5;
});

const page = await context.newPage();
page.on('pageerror', (e) => console.error('erro na página:', e.message));

const wait = (ms) => page.waitForTimeout(ms);
const pause = (ms) => wait(video ? ms : Math.min(ms, 1200));

async function visible(text) {
  const all = page.getByText(text, { exact: true });
  for (let i = (await all.count()) - 1; i >= 0; i--) {
    const el = all.nth(i);
    if (!(await el.isVisible())) continue;
    const box = await el.boundingBox();
    if (box && box.x >= 0 && box.x < W) return el;
  }
  throw new Error(`texto não visível: ${text}`);
}
async function tap(text, after = 1500) {
  await (await visible(text)).click();
  await wait(after);
}
async function until(text, timeoutMs = 20000) {
  for (let t = 0; t < timeoutMs; t += 500) {
    if (await page.getByText(text, { exact: true }).count()) return;
    await wait(500);
  }
  throw new Error(`não apareceu: ${text}`);
}
async function shot(name) {
  if (video) return;
  await wait(800);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('tela', name);
}
// Toques por posição: botões só com ícone (ajustes, voltar, esfera) e itens do painel Demo.
const at = async (x, y, after = 1200) => {
  await page.mouse.click(x, y);
  await wait(after);
};
const SETTINGS = [352, 46];
const BACK = [36, 44];
const ORB = [340, 715];
const CONVERSATION_BACK = [48, 68];
const SETTINGS_CLOSE = [351, 151];
const DEMO_CLOSE = [324, 153];
const DEMO_CCO_RESPONDS = [325, 640];
const DEMO_PLUS_HOUR = [60, 779];

await page.goto(url, { waitUntil: 'networkidle' });
await wait(2500);
await shot('login');
await pause(2000);

await tap('Entrar como Carlos', 2500);
await shot('home');
await pause(1500);

await at(...SETTINGS, 1500);
await shot('settings');
await at(...SETTINGS_CLOSE, 1200);

await tap('Iniciar viagem', 2500);
await shot('trip-agent');
await pause(2000);

await at(...ORB, 1500);
await shot('avisai');
await pause(1500);
await tap('“Peguei a carga, caminhão ok”', 1000);
await tap('Abrir conversa em tela cheia', 2500);
await shot('conversation');
await pause(1500);
await at(...CONVERSATION_BACK);

await tap('Mapa');
await shot('map');
await pause(2500);

await tap('Início', 1200);
await until('Recebedor confirmou doca!', 30000);
await wait(600);
await shot('receiver-confirmed');
await pause(2500);

await until('Cheguei', 30000);
await wait(9000); // o caminhão chega ao destino
await tap('Cheguei', 3000);
await shot('checkin');
await pause(1500);

// Adianta 6 h no painel Demo; com o CCO respondendo, a doca confirmada não é trocada.
await tap('Mapa', 1000);
await tap('Demo', 1000);
await at(...DEMO_CCO_RESPONDS, 400);
for (let i = 0; i < 6; i++) await at(...DEMO_PLUS_HOUR, video ? 500 : 700);
await at(...DEMO_CLOSE, 1000);
await tap('Início', 1000);

await tap('Fila no recebedor', 2000);
await shot('queue');
await pause(2500);
await at(...BACK);

await tap('Documentos');
await shot('documents');
await pause(1200);
await tap('NF-e 000.482.913', 2200);
await shot('document-viewer');
await pause(2000);
await at(...BACK);

await tap('Mensagens');
await shot('messages');
await pause(2000);

await tap('Mapa', 1000);
await tap('Demo', 1000);
await tap('Sem rede', 600);
await at(...DEMO_CLOSE, 1000);
await tap('Início');
await shot('offline');
await pause(2500);

await context.close();
await browser.close();
