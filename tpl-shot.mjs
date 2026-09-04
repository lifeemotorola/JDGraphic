import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
const errs=[]; p.on('pageerror', e=>{ if(!/WebSocket/.test(e.message)) errs.push(e.message); });
await p.goto('http://localhost:5173/#/editor', { waitUntil: 'load' });
await p.waitForTimeout(4000);
await p.click('button:has-text("Templates")');
await p.waitForTimeout(4000);
for (const [cat, file] of [['Food & Bev','food'],['Tech','tech'],['Kids','kids'],['Outdoor','outdoor'],['Beauty','beauty'],['Media','media'],['Home','home'],['Pet','pet'],['Health','health'],['E-commerce','ecom']]) {
  await p.click(`.chip-btn:has-text("${cat}")`);
  await p.waitForTimeout(2600);
  await p.screenshot({ path: `/home/user/shots/cat-${file}.png`, clip: { x: 250, y: 130, width: 940, height: 760 } });
}
console.log('ERR', JSON.stringify(errs.slice(0,5)));
await b.close();
