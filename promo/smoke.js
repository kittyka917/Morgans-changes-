// Visual smoke test. Uses canvas.toDataURL rather than page.screenshot:
// the fx driver replaces requestAnimationFrame with a manual queue, and
// Playwright's screenshot waits for a compositor frame that never arrives.
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.js':'text/javascript','.webp':'image/webp'};
const srv=http.createServer((rq,rs)=>{
  const p=path.join(ROOT, decodeURIComponent(rq.url.split('?')[0]));
  if(!fs.existsSync(p)||fs.statSync(p).isDirectory()){rs.writeHead(404);return rs.end();}
  rs.writeHead(200,{'Content-Type':T[path.extname(p).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(p).pipe(rs);
});
srv.listen(0,'127.0.0.1',async()=>{
  const base='http://127.0.0.1:'+srv.address().port;
  const b=await chromium.launch({args:['--force-device-scale-factor=1','--hide-scrollbars','--disable-lcd-text']});
  const pg=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,reducedMotion:'no-preference'});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  pg.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text().slice(0,200));});
  await pg.goto(base+'/'+(process.env.PAGE||'promo.html'));
  await pg.evaluate(()=>window.ASSETS);
  console.log('fx engines:', JSON.stringify(await pg.evaluate(()=>window.FX ? window.FX.available : null)));
  for(const f of (process.env.PICKS||'105').split(',')){
    const n=parseInt(f);
    const process_png = !!process.env.PNG;
    const d=await pg.evaluate(async ([i, process_png])=>{
      if (window.prepFrame) await window.prepFrame(i);
      window.renderFrame(i);
      return document.getElementById('stage').toDataURL(process_png ? 'image/png' : 'image/jpeg', 0.95); }, [n, process_png]);
    fs.writeFileSync(path.join(ROOT,(process.env.PREFIX||'sm_')+String(n).padStart(4,'0')+(process.env.PNG?'.png':'.jpg')),
                     Buffer.from(d.slice(d.indexOf(',')+1),'base64'));
    process.stdout.write('frame '+n+' ok\n');
  }
  console.log(errs.length?errs.slice(0,5).join('\n'):'no js errors');
  await b.close(); srv.close();
});
