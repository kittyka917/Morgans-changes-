// Renders promo.html to frames/*.jpg through headless Chromium.
//
// Served over localhost HTTP rather than file:// — file:// images taint the
// canvas and make toDataURL throw SecurityError, which kills frame export.
//
// Before rendering it ingests anything in media/ (see media/README.md):
// clips are cut to their slot length and extracted to frames, stills are
// cover-fitted. Slots with no media fall back to their designed graphics.

const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname, OUT = path.join(ROOT, process.env.OUTDIR || 'frames');
const PAGE = process.env.PAGE || 'promo.html';
const MEDIA = path.join(ROOT,'media'), CACHE = path.join(MEDIA,'_cache');
const WORKERS = parseInt(process.env.WORKERS || '4', 10);
const QUALITY = parseFloat(process.env.QUALITY || '0.96');
const FMT = process.env.FMT === 'png' ? 'png' : 'jpg';   // FMT=png: lossless frames
const FPS = 30;

// slot -> seconds on screen, matching the SCENES table in promo.html
const SLOTS = { hero:4, hook:4, identity:4, crew:4, events:4, care:4, montage:4, end:6 };
const VID = new Set(['.mp4','.mov','.webm','.mkv','.m4v']);
const STILL = new Set(['.jpg','.jpeg','.png','.webp']);
const COVER = 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080';

const CLIPS = path.join(MEDIA,'clips');
const CLIP_DAYS = parseFloat(process.env.CLIP_DAYS || '35');
// Slots in the order loose clips get handed out — strongest spots first.
const AUTO_ORDER = ['end','hero','events','crew','hook','montage','identity','care'];

function probeDuration(f){
  try {
    return parseFloat(execFileSync('ffprobe', ['-v','error','-show_entries','format=duration',
      '-of','default=noprint_wrappers=1:nokey=1', f]).toString().trim()) || 0;
  } catch(e){ return 0; }
}

/* Loose clips in media/clips/ are auto-assigned: newest first, within the last
   CLIP_DAYS days. Audio is never read — only JPEG frames are extracted — so
   clip audio can never reach the film. */
function autoAssign(){
  if (!fs.existsSync(CLIPS)) return {};
  const cutoff = Date.now() - CLIP_DAYS*86400000;
  const picks = fs.readdirSync(CLIPS)
    .filter(f => !f.startsWith('.') && VID.has(path.extname(f).toLowerCase()))
    .map(f => ({ f, p: path.join(CLIPS,f), m: fs.statSync(path.join(CLIPS,f)).mtimeMs }))
    .filter(o => o.m >= cutoff)
    .sort((a,b) => b.m - a.m);
  const skipped = fs.readdirSync(CLIPS).filter(f => !f.startsWith('.') && VID.has(path.extname(f).toLowerCase())).length - picks.length;
  if (skipped > 0) console.log('  (' + skipped + ' clip(s) older than ' + CLIP_DAYS + ' days, skipped)');
  const map = {};
  for (let i = 0; i < picks.length && i < AUTO_ORDER.length; i++) map[AUTO_ORDER[i]] = picks[i];
  return map;
}

function ingest(){
  if (!fs.existsSync(MEDIA)) return [];
  const files = fs.readdirSync(MEDIA).filter(f => !f.startsWith('_') && !f.startsWith('.'));
  const auto = autoAssign();
  const manifest = [];
  for (const slot of Object.keys(SLOTS)){
    const named = files.find(f => f.toLowerCase().startsWith(slot + '-') || f.toLowerCase() === slot + path.extname(f).toLowerCase());
    const hit = named || (auto[slot] && auto[slot].f);
    if (!hit) continue;
    const ext = path.extname(hit).toLowerCase();
    const src = named ? path.join(MEDIA, hit) : auto[slot].p;
    const dir = path.join(CACHE, slot);
    const stamp = path.join(dir, '.src');
    const want = hit + ':' + fs.statSync(src).size;
    if (fs.existsSync(stamp) && fs.readFileSync(stamp,'utf8') === want){
      const fr = fs.readdirSync(dir).filter(f=>f.endsWith('.jpg')).sort();
      if (fr.length){
        manifest.push({ slot, kind: VID.has(ext)?'video':'still',
                        frames: fr.map(f => 'media/_cache/'+slot+'/'+f) });
        console.log('  ' + slot + ': cached (' + fr.length + ' frames)');
        continue;
      }
    }
    fs.rmSync(dir, {recursive:true, force:true}); fs.mkdirSync(dir, {recursive:true});
    try {
      if (VID.has(ext)){
        // Skip the opening seconds — Medal clips usually start mid-action or on
        // a loading frame — and take the slot's length from inside the clip.
        const dur = probeDuration(src), need = SLOTS[slot];
        const seek = dur > need + 3 ? Math.min(3, (dur - need) * 0.25) : 0;
        execFileSync('ffmpeg', ['-y','-loglevel','error','-ss',String(seek.toFixed(2)),
          '-i',src,'-t',String(need),'-an',
          '-vf','fps='+FPS+','+COVER, '-q:v','4', path.join(dir,'f%04d.jpg')]);
      } else if (STILL.has(ext)){
        execFileSync('ffmpeg', ['-y','-loglevel','error','-i',src,'-vf',COVER,'-q:v','3',
          path.join(dir,'f0001.jpg')]);
      } else { console.log('  ' + slot + ': skipped ' + hit + ' (unsupported type)'); continue; }
    } catch (e) {
      console.log('  ' + slot + ': FAILED to ingest ' + hit + ' — ' + (e.message||'').split('\n')[0]);
      continue;
    }
    const fr = fs.readdirSync(dir).filter(f=>f.endsWith('.jpg')).sort();
    if (!fr.length){ console.log('  ' + slot + ': ' + hit + ' produced no frames'); continue; }
    fs.writeFileSync(stamp, want);
    manifest.push({ slot, kind: VID.has(ext)?'video':'still',
                    frames: fr.map(f => 'media/_cache/'+slot+'/'+f) });
    console.log('  ' + slot + ': ' + hit + (named?'':' (auto)') + ' -> ' + fr.length + ' frame' + (fr.length>1?'s':''));
  }
  return manifest;
}

const TYPES = {'.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
               '.webp':'image/webp','.js':'text/javascript','.mjs':'text/javascript'};
function serve(){
  return new Promise(res => {
    const s = http.createServer((req, rs) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ rs.writeHead(404); return rs.end(); }
      rs.writeHead(200, {'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream'});
      fs.createReadStream(p).pipe(rs);
    });
    s.listen(0,'127.0.0.1',()=>res(s));
  });
}
async function openPage(b, base, manifest){
  const pg = await b.newPage({ viewport:{width:1920,height:1080}, deviceScaleFactor:1,
                               reducedMotion:'no-preference' });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(m => { window.MEDIA_MANIFEST = m; }, manifest);
  await pg.goto(base + '/' + PAGE);
  await pg.evaluate(() => window.ASSETS);   // resolves after fx engines load too
  await pg.waitForTimeout(200);
  return { pg, errs };
}
async function worker(id, from, to, base, manifest){
  const b = await chromium.launch({ args:['--force-device-scale-factor=1','--hide-scrollbars','--disable-lcd-text'] });
  const { pg, errs } = await openPage(b, base, manifest);
  for (let n = from; n < to; n++){
    const d = await pg.evaluate(async ([i,q,png]) => {
      if (window.prepFrame) await window.prepFrame(i);   // lazy source frames (glock.html)
      window.renderFrame(i);
      return png ? document.getElementById('stage').toDataURL('image/png')
                 : document.getElementById('stage').toDataURL('image/jpeg', q);
    }, [n, QUALITY, FMT === 'png']);
    fs.writeFileSync(path.join(OUT,'f'+String(n).padStart(5,'0')+'.'+FMT),
                     Buffer.from(d.slice(d.indexOf(',')+1),'base64'));
    if (id===0 && (n-from)%50===0) process.stdout.write('  w0 '+n+'/'+to+'\n');
  }
  await b.close(); return errs;
}

(async () => {
  console.log('media:');
  const manifest = ingest();
  if (!manifest.length) console.log('  (none — using graphic fallbacks; see media/README.md)');

  fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
  const srv = await serve(), base = 'http://127.0.0.1:'+srv.address().port;
  const b0 = await chromium.launch();
  const { pg } = await openPage(b0, base, manifest);
  const total = await pg.evaluate(() => window.TOTAL_FRAMES);
  const exportOk = await pg.evaluate(() => {
    try { document.getElementById('stage').toDataURL('image/jpeg',0.5); return 'ok'; }
    catch(e){ return 'TAINTED: '+e.message; }
  });
  console.log('frames', total, '| export:', exportOk, '|', WORKERS, 'workers');
  await b0.close();
  if (exportOk !== 'ok'){ srv.close(); process.exit(1); }

  const chunk = Math.ceil(total/WORKERS), t0 = Date.now();
  const errs = (await Promise.all(Array.from({length:WORKERS},(_,i)=>
    worker(i, i*chunk, Math.min(total,(i+1)*chunk), base, manifest)))).flat();
  srv.close();
  if (errs.length) console.log('JS ERRORS:', errs.slice(0,5).join(' | '));
  const got = fs.readdirSync(OUT).filter(f=>f.endsWith('.'+FMT)).length;
  console.log('done in', ((Date.now()-t0)/1000).toFixed(0)+'s;', got, 'of', total);
  if (got !== total){ console.error('FRAME COUNT MISMATCH'); process.exit(1); }
})();
