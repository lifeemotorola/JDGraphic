import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
p.on('console', m=>{ if(m.type()==='error' && !/WebSocket|vite/i.test(m.text())) errs.push(m.text()); });
await p.goto('http://localhost:5173/#/', { waitUntil: 'load' });
await p.waitForTimeout(6000);
await p.screenshot({ path: '/home/user/shots/home-top.png' });
for (const [n,y] of [[2,1150],[3,2350],[4,3450],[5,4600]]) {
  await p.evaluate(y => window.scrollTo(0,y), y); await p.waitForTimeout(2500);
  await p.screenshot({ path: `/home/user/shots/home-${n}.png` });
}
await p.evaluate(() => window.scrollTo(0,99999)); await p.waitForTimeout(1500);
await p.screenshot({ path: '/home/user/shots/home-6.png' });
console.log('ERR', JSON.stringify(errs.slice(0,6)));
await b.close();
