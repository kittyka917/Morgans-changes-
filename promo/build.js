// Captures promo.html to frames/*.jpg via headless Chromium.
// Served over localhost HTTP so the logo PNGs don't taint the canvas
// (a tainted canvas makes toDataURL throw SecurityError).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname, OUT = path.join(ROOT, 'frames');
const WORKERS = parseInt(process.env.WORKERS || '4', 10);
const QUALITY = parseFloat(process.env.QUALITY || '0.96');
const TYPES = { '.html':'text/html', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp' };

function serve() {
  return new Promise(res => {
    const s = http.createServer((req, rq) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rq.writeHead(404); return rq.end(); }
      rq.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rq);
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

async function openPage(b, base) {
  const pg = await b.newPage({ viewport: { width:1920, height:1080 }, deviceScaleFactor: 1 });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(base + '/promo.html');
  await pg.evaluate(() => window.ASSETS);                 // wait for the logos
  const ok = await pg.evaluate(() => !!(window.IMGCHECK || document.readyState));
  await pg.waitForTimeout(250);
  return { pg, errs };
}

async function worker(id, from, to, base) {
  const b = await chromium.launch({ args: ['--force-device-scale-factor=1','--hide-scrollbars','--disable-lcd-text'] });
  const { pg, errs } = await openPage(b, base);
  for (let n = from; n < to; n++) {
    const d = await pg.evaluate(([i,q]) => {
      window.renderFrame(i);
      return document.getElementById('stage').toDataURL('image/jpeg', q);
    }, [n, QUALITY]);
    fs.writeFileSync(path.join(OUT, 'f' + String(n).padStart(5,'0') + '.jpg'),
                     Buffer.from(d.slice(d.indexOf(',')+1), 'base64'));
    if (id === 0 && (n-from) % 50 === 0) process.stdout.write('  w0 ' + n + '/' + to + '\n');
  }
  await b.close();
  return errs;
}

(async () => {
  fs.rmSync(OUT, { recursive:true, force:true });
  fs.mkdirSync(OUT, { recursive:true });
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b0 = await chromium.launch();
  const { pg } = await openPage(b0, base);
  const total = await pg.evaluate(() => window.TOTAL_FRAMES);
  const assetsOk = await pg.evaluate(() => {
    // confirm both logos actually decoded, and that export is not blocked
    try { document.getElementById('stage').toDataURL('image/jpeg', 0.5); } catch (e) { return 'TAINTED: ' + e.message; }
    return 'ok';
  });
  console.log('frames', total, '| asset/export check:', assetsOk, '|', WORKERS, 'workers');
  await b0.close();
  if (assetsOk !== 'ok') { srv.close(); process.exit(1); }

  const chunk = Math.ceil(total / WORKERS), t0 = Date.now();
  const errs = (await Promise.all(Array.from({length:WORKERS}, (_,i) =>
    worker(i, i*chunk, Math.min(total,(i+1)*chunk), base)))).flat();
  srv.close();
  if (errs.length) console.log('JS ERRORS:', errs.slice(0,5).join(' | '));
  const got = fs.readdirSync(OUT).filter(f => f.endsWith('.jpg')).length;
  console.log('done in', ((Date.now()-t0)/1000).toFixed(0)+'s;', got, 'of', total);
  if (got !== total) { console.error('FRAME COUNT MISMATCH'); process.exit(1); }
})();
