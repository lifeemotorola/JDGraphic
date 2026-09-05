/**
 * Photo Editions — 50 complex, photography-led templates built on the
 * bundled art library (`src/lib/art.ts`). Each spec is run through one of
 * eight structure-aware layout systems (hero scrim, diptych, capsule window,
 * twin band, medallion, duotone poster, rail, framed print) that dress every
 * face of the carton — front, back, sides and lid — and some carry one of
 * the three QR options on the back panel.
 *
 * Every object remains a normal editable DesignObject, so these are starting
 * points, not stickers.
 */
import type { BoxTypeId, Net } from './geometry';
import { newObject, type DesignObject } from './store';
import { artSrc } from './art';
import { QR_DEFAULTS, qrDataURL, type QRStyle } from './qr';
import type { Template } from './templates';

/* ------------------------------ local helpers ---------------------------- */

const on = (net: Net, panelId: string, rx: number, ry: number, rw: number, rh: number) => {
  const p = net.byId[panelId] ?? net.root;
  return { x: p.x + p.w * rx, y: p.y + p.h * ry, w: p.w * rw, h: p.h * rh };
};

const pw = (net: Net, id: string, frac = 1) => (net.byId[id]?.w ?? net.root.w) * frac;

const fit = (text: string, w: number, tracking = 0, cap = 40, factor = 0.62) => {
  const n = Math.max(1, ...text.split('\n').map((l) => l.length));
  return Math.max(2, Math.min(cap, (w - tracking * n) / (n * factor)));
};

const T = (patch: Partial<DesignObject>) => newObject('text', patch);
const R = (patch: Partial<DesignObject>) => newObject('rect', patch);
const El = (patch: Partial<DesignObject>) => newObject('ellipse', patch);
const Im = (patch: Partial<DesignObject>) => newObject('image', patch);

const SERIF = 'Georgia, "Times New Roman", serif';

const TOP_IDS = ['lid-top', 'ft', 'lid'];
const BOT_IDS = ['lid-bot', 'bt', 'base'];
const topId = (net: Net) => TOP_IDS.find((i) => net.byId[i]);
const botId = (net: Net) => BOT_IDS.find((i) => net.byId[i]);

const mark = (brand: string) => brand
  .split(/\s+/).map((w) => w.replace(/[^A-Z0-9]/gi, '').charAt(0)).join('').slice(0, 2) || brand.charAt(0);

/* --------------------------------- spec ---------------------------------- */

interface PSpec {
  id: string; name: string; category: string; blurb: string;
  box: BoxTypeId; dims: [number, number, number]; mat: string;
  /** [paper, ink, accent, soft] */
  pal: [string, string, string, string];
  art: string; lay: number;
  brand: string; product: string; tag: string; note: string;
  qr?: QRStyle;
}

const S = (s: PSpec) => s;

const SPECS: PSpec[] = [
  S({ id: 'ph-ember-midnight', name: 'Ember Roast · Midnight Blend', category: 'Food & Bev', blurb: 'Full-bleed bean macro under a dusk scrim, QR recipe card on the back.', box: 'ste', dims: [90, 60, 140], mat: 'kraft', pal: ['#f4e8d6', '#201a16', '#e4572e', '#6b4a33'], art: 'coffee-beans', lay: 0, brand: 'Ember Roast', product: 'MIDNIGHT BLEND', tag: 'DARK ROAST · WHOLE BEAN · 250 g', note: 'Brew 18 g per 300 ml at 94°C. Rest 7 days off roast.', qr: 'classic' }),
  S({ id: 'ph-ember-morning', name: 'Ember Roast · Morning Light', category: 'Food & Bev', blurb: 'Duotone poster cut of the roast macro with outlined display type.', box: 'rte', dims: [85, 55, 130], mat: 'sbs', pal: ['#fdf6ec', '#2b211b', '#f2a03d', '#8a5a3b'], art: 'coffee-macro', lay: 5, brand: 'Ember Roast', product: 'MORNING LIGHT', tag: 'FILTER ROAST · 250 g', note: 'Honey process, washed lot. Notes of apricot and malt.' }),
  S({ id: 'ph-drift-shipper', name: 'Driftwood · Subscription Shipper', category: 'E-commerce', blurb: 'Kraft mailer with a photo rail and route-note typography.', box: 'mailer', dims: [220, 160, 90], mat: 'eflute', pal: ['#efe4d2', '#27201a', '#2f6f6a', '#8a6a4c'], art: 'coffee-bag', lay: 6, brand: 'Driftwood Coffee', product: 'SUBSCRIPTION №12', tag: 'ROASTED · SHIPPED · REPEATED', note: 'This month: two single origins and a house espresso.', qr: 'rounded' }),
  S({ id: 'ph-ember-autumn', name: 'Ember Roast · Autumn Lot', category: 'Food & Bev', blurb: 'Framed still-life print with a gallery caption block.', box: 'seal', dims: [110, 70, 160], mat: 'sbs', pal: ['#f6ead8', '#33241c', '#c65a2e', '#7d5a41'], art: 'coffee-scene', lay: 7, brand: 'Ember Roast', product: 'AUTUMN LOT №9', tag: 'SEASONAL · LIMITED PRESS', note: 'A maple-dried experimental lot. 400 boxes only.' }),
  S({ id: 'ph-noir-cacao', name: 'Noir Cacao · 85% Tablet', category: 'Food & Bev', blurb: 'Melted-chocolate hero with gold foil accents on black board.', box: 'ste', dims: [150, 12, 70], mat: 'black', pal: ['#171310', '#f3e5c9', '#c9a227', '#5c4326'], art: 'chocolate-swirl', lay: 0, brand: 'Noir Cacao', product: '85% SINGLE ESTATE', tag: 'STONE-GROUND · 70 g', note: 'Conched 72 hours. Ecuadorian arriba nacional.', qr: 'branded' }),
  S({ id: 'ph-noir-bar', name: 'Noir Cacao · Bar No. 4', category: 'Food & Bev', blurb: 'Diptych split — glossy bar macro against cream stock.', box: 'ste', dims: [160, 12, 80], mat: 'sbs', pal: ['#f7efe2', '#241a12', '#8c5a2b', '#a98963'], art: 'chocolate-bar', lay: 1, brand: 'Noir Cacao', product: 'BAR №4', tag: '70% · SEA SALT · 70 g', note: 'Flakey, snappy, lightly smoked over beechwood.' }),
  S({ id: 'ph-gelato-swirl', name: 'Casa Gelato · Stracciatella', category: 'Food & Bev', blurb: 'Capsule window over pistachio paper for a gelato kit.', box: 'rte', dims: [120, 80, 90], mat: 'sbs', pal: ['#f2efe4', '#31261d', '#b7d0a1', '#8a6a4c'], art: 'chocolate-cream', lay: 2, brand: 'Casa Gelato', product: 'STRACCIATELLA KIT', tag: 'MAKES 1 L · KEEP FROZEN', note: 'Churn 20 minutes. Ripple in the chocolate shard.' }),
  S({ id: 'ph-sol-citrus', name: 'Sol Pressed · Blood Orange', category: 'Food & Bev', blurb: 'Citrus grid twin-band with sunrise palette.', box: 'ste', dims: [70, 70, 150], mat: 'sbs', pal: ['#fff4e4', '#402318', '#e4572e', '#f2a03d'], art: 'citrus-grid', lay: 3, brand: 'Sol Pressed', product: 'BLOOD ORANGE', tag: 'COLD-PRESSED · 330 ml', note: 'Pressed within 6 hours of harvest. No added sugar.', qr: 'classic' }),
  S({ id: 'ph-sol-morning', name: 'Sol Pressed · Morning Slice', category: 'Food & Bev', blurb: 'Medallion of orange slices ringed in cream.', box: 'rte', dims: [65, 65, 140], mat: 'sbs', pal: ['#fff8ec', '#3a2a1c', '#ef7d3a', '#e9b44c'], art: 'citrus-slice', lay: 4, brand: 'Sol Pressed', product: 'MORNING SLICE', tag: 'SPARKLING CITRUS · 250 ml', note: 'Lightly sparkling, bitter-sweet, best over ice.' }),
  S({ id: 'ph-verdant-leaf', name: 'Verdant · Shade Leaf Tea', category: 'Food & Bev', blurb: 'Dark botanical hero for a shade-grown leaf tea.', box: 'ste', dims: [95, 45, 130], mat: 'grey', pal: ['#e9efe4', '#1d2b23', '#3ddc97', '#5f7a63'], art: 'leaves-dark', lay: 0, brand: 'Verdant', product: 'SHADE LEAF', tag: 'LOOSE LEAF · 80 g', note: 'Steep 3 min at 80°C. Second infusion sweeter.', qr: 'rounded' }),
  S({ id: 'ph-verdant-sage', name: 'Verdant · Sage Ritual', category: 'Food & Bev', blurb: 'Matte foliage duotone poster in sage and bone.', box: 'sleeve', dims: [140, 90, 40], mat: 'sbs', pal: ['#eef0e6', '#26332b', '#7fa08c', '#9db4a0'], art: 'leaves-matte', lay: 5, brand: 'Verdant', product: 'SAGE RITUAL', tag: 'EVENING BLEND · 20 SACHETS', note: 'Sage, lemon balm and a whisper of smoke.' }),
  S({ id: 'ph-tide-swell', name: 'Tide & Swell · Reef Wax', category: 'Outdoor', blurb: 'Aerial wave hero on a surf-wax twin pack.', box: 'rte', dims: [90, 30, 90], mat: 'sbs', pal: ['#eaf6f4', '#0f3d40', '#128f8b', '#67b7b0'], art: 'ocean-aerial', lay: 0, brand: 'Tide & Swell', product: 'REEF WAX', tag: 'COOL WATER · 2 × 80 g', note: 'Plant-based wax. Safe for reefs and wetsuits.' }),
  S({ id: 'ph-tide-foam', name: 'Tide & Swell · Foam Bath Salts', category: 'Home', blurb: 'Sea-foam capsule window over deep teal stock.', box: 'ste', dims: [100, 60, 140], mat: 'sbs', pal: ['#eef7f5', '#123c3f', '#2fa39a', '#8fcac3'], art: 'ocean-foam', lay: 2, brand: 'Tide & Swell', product: 'FOAM BATH SALTS', tag: 'DEAD SEA · 400 g', note: 'Two caps per bath. Breathe in for four counts.', qr: 'classic' }),
  S({ id: 'ph-tide-salt', name: 'Tide & Swell · Swell Salt', category: 'Food & Bev', blurb: 'Framed swell print labelled like a tide chart.', box: 'seal', dims: [80, 80, 110], mat: 'sbs', pal: ['#eff5f2', '#1c3a36', '#3f8f86', '#79aca5'], art: 'ocean-swell', lay: 7, brand: 'Tide & Swell', product: 'SWELL SALT', tag: 'HAND-Raked · 250 g', note: 'Harvested at spring tide, sun-dried on the saltpan.' }),
  S({ id: 'ph-ridge-cloud', name: 'Ridgeline · Cloud Camp Blend', category: 'Outdoor', blurb: 'Cloud-line ridge diptych for a trail coffee blend.', box: 'rsc', dims: [180, 120, 260], mat: 'bflute', pal: ['#e8eef2', '#1b2733', '#4f7ea9', '#8aa8c0'], art: 'mountain-mist', lay: 1, brand: 'Ridgeline', product: 'CLOUD CAMP BLEND', tag: 'HIGH-ALTITUDE FUEL · 1 kg', note: 'Dark, forgiving, tastes good from a dented pot.', qr: 'branded' }),
  S({ id: 'ph-ridge-pine', name: 'Ridgeline · Pine Smoke Candle', category: 'Home', blurb: 'Foggy pine medallion on charcoal board.', box: 'ste', dims: [80, 80, 100], mat: 'black', pal: ['#141a17', '#e6efe8', '#7fa08c', '#44584c'], art: 'forest-fog', lay: 4, brand: 'Ridgeline', product: 'PINE SMOKE', tag: '45 HR BURN · SOY', note: 'Cut pine, rain on stone, a distant campfire.' }),
  S({ id: 'ph-ridge-cliff', name: 'Ridgeline · Cliff Line Journal', category: 'Stationery', blurb: 'Cliff-above-fog framed print for a field journal box.', box: 'ste', dims: [160, 110, 40], mat: 'grey', pal: ['#eef1f4', '#22303c', '#5b7f9c', '#93a9bb'], art: 'cliff-fog', lay: 7, brand: 'Ridgeline', product: 'CLIFF LINE JOURNAL', tag: '192 PAGES · DOT GRID', note: 'Lies flat at 180°. Paper takes fountain ink.' }),
  S({ id: 'ph-aurum-vein', name: 'Aurum · Vein Serum', category: 'Beauty', blurb: 'White marble hero with gold keyline and serif display.', box: 'ste', dims: [60, 60, 120], mat: 'sbs', pal: ['#faf7f0', '#23201a', '#c9a227', '#a8a094'], art: 'marble-white', lay: 0, brand: 'Aurum', product: 'VEIN SERUM', tag: 'VITAMIN C · 30 ml', note: 'Three drops, morning and night. Patch test first.', qr: 'branded' }),
  S({ id: 'ph-aurum-noir', name: 'Aurum · Noir Reserve', category: 'Premium', blurb: 'Black marble duotone poster, gold outline type.', box: 'ste', dims: [70, 70, 130], mat: 'black', pal: ['#101014', '#efe6d0', '#c9a227', '#5a564c'], art: 'marble-black', lay: 5, brand: 'Aurum', product: 'NOIR RESERVE', tag: 'EAU DE PARFUM · 50 ml', note: 'Oud, black fig and cold stone. Numbered bottles.' }),
  S({ id: 'ph-aurum-kintsugi', name: 'Aurum · Kintsugi Set', category: 'Premium', blurb: 'Grey marble diptych with gold repair motif.', box: 'seal', dims: [180, 120, 50], mat: 'sbs', pal: ['#f4f2ec', '#26241f', '#c9a227', '#9b968a'], art: 'marble-grey', lay: 1, brand: 'Aurum', product: 'KINTSUGI SET', tag: 'CUP · LACQUER · GOLD', note: 'Repair kit for two cups. Urushi lacquer inside.', qr: 'classic' }),
  S({ id: 'ph-still-bloom', name: 'Still Bloom · Dutch Vase', category: 'Home', blurb: 'Moody still-life framed like an old master print.', box: 'ste', dims: [120, 80, 160], mat: 'sbs', pal: ['#f1e9dc', '#241d18', '#a1433f', '#7c6a54'], art: 'flowers-dark', lay: 7, brand: 'Still Bloom', product: 'DUTCH VASE', tag: 'STONEWARE · MATTE', note: 'Thrown in small batches. Glaze pools at the foot.' }),
  S({ id: 'ph-still-pastel', name: 'Still Bloom · Pastel Dried Set', category: 'Home', blurb: 'Capsule of dried pastels on blush paper.', box: 'rte', dims: [140, 90, 60], mat: 'sbs', pal: ['#f7ece8', '#4a3230', '#c96f6f', '#dcae9f'], art: 'flowers-pastel', lay: 2, brand: 'Still Bloom', product: 'PASTEL DRIED SET', tag: 'LASTS A YEAR · NO WATER', note: 'Shake gently to dust. Keep out of direct sun.' }),
  S({ id: 'ph-still-stem', name: 'Still Bloom · Stem Subscription', category: 'E-commerce', blurb: 'Bouquet hero with subscription route notes.', box: 'mailer', dims: [260, 180, 100], mat: 'eflute', pal: ['#f4ece6', '#33221f', '#b0563c', '#8a6a5c'], art: 'flowers-dark', lay: 0, brand: 'Still Bloom', product: 'STEM SUBSCRIPTION', tag: 'WEEKLY · SEASONAL STEMS', note: 'Cut Thursday, with you Friday. Snip stems at 45°.', qr: 'rounded' }),
  S({ id: 'ph-golden-good', name: 'Golden Hour · Good Boy Biscuits', category: 'Pet', blurb: 'Seated golden retriever hero on warm kraft.', box: 'rsc', dims: [200, 140, 180], mat: 'kraft', pal: ['#f2e5cd', '#3a2a1a', '#d98e2b', '#a97c46'], art: 'dog-sit', lay: 0, brand: 'Golden Hour', product: 'GOOD BOY BISCUITS', tag: 'PEANUT BUTTER · 400 g', note: 'Oven-baked. One biscuit per 10 kg of good boy.', qr: 'classic' }),
  S({ id: 'ph-golden-portrait', name: 'Golden Hour · Portrait Treats', category: 'Pet', blurb: 'Retriever portrait medallion with cream ring.', box: 'ste', dims: [110, 70, 150], mat: 'sbs', pal: ['#f8efdf', '#402c17', '#e09a3a', '#b98d54'], art: 'dog-face', lay: 4, brand: 'Golden Hour', product: 'PORTRAIT TREATS', tag: 'SALMON · GRAIN FREE', note: 'Slow-dried salmon skins. Crunchy, single ingredient.' }),
  S({ id: 'ph-golden-pup', name: 'Golden Hour · Pup Starter Kit', category: 'Pet', blurb: 'Diptych starter-kit carton in warm cream and tan.', box: 'seal', dims: [190, 130, 90], mat: 'eflute', pal: ['#f6ecd9', '#39281a', '#c98a2e', '#96703f'], art: 'dog-sit', lay: 1, brand: 'Golden Hour', product: 'PUP STARTER KIT', tag: 'TREATS · ROPE · GUIDE', note: 'For dogs 8–20 weeks. The guide is the real treat.', qr: 'rounded' }),
  S({ id: 'ph-ember-flame', name: 'Ember & Wick · First Flame', category: 'Home', blurb: 'Candle-flame macro hero on near-black stock.', box: 'ste', dims: [80, 80, 110], mat: 'black', pal: ['#151210', '#f4e3c2', '#e0862f', '#7a4c22'], art: 'candle-flame', lay: 0, brand: 'Ember & Wick', product: 'FIRST FLAME', tag: '60 HR · AMBER GLASS', note: 'Trim wick to 5 mm. First burn: full melt pool.', qr: 'branded' }),
  S({ id: 'ph-ember-evening', name: 'Ember & Wick · Long Evening', category: 'Home', blurb: 'Candlelit table framed print with hygge caption.', box: 'rte', dims: [120, 90, 70], mat: 'sbs', pal: ['#f3e7d3', '#2e2018', '#c96f2f', '#8a5a3b'], art: 'candle-evening', lay: 7, brand: 'Ember & Wick', product: 'LONG EVENING', tag: 'TRIO · 3 × 30 HR', note: 'Fig, cedar and a little woodsmoke. Burn in threes.' }),
  S({ id: 'ph-lumen-drop', name: 'Lumen · Drop Serum Trio', category: 'Beauty', blurb: 'Serum bottles diptych on clinical bone white.', box: 'ste', dims: [140, 50, 90], mat: 'sbs', pal: ['#f7f5f1', '#232732', '#7b68ee', '#9aa2b5'], art: 'serum', lay: 1, brand: 'Lumen', product: 'DROP SERUM TRIO', tag: 'AM · PM · WEEKLY', note: 'Retinal on Thursdays only. SPF always.', qr: 'classic' }),
  S({ id: 'ph-lumen-glass', name: 'Lumen · Glass Skin Kit', category: 'Beauty', blurb: 'Capsule window of droppers over cool porcelain.', box: 'seal', dims: [120, 80, 120], mat: 'sbs', pal: ['#f4f6f8', '#1f2937', '#38bdf8', '#7d8ca3'], art: 'serum', lay: 2, brand: 'Lumen', product: 'GLASS SKIN KIT', tag: '4 STEPS · 6 WEEKS', note: 'Damp skin, thin layers, patience.' }),
  S({ id: 'ph-hopper-bar', name: 'Hopper · Bar Session IPA', category: 'Food & Bev', blurb: 'Bar-bokeh hero on a four-pack shipper.', box: 'rsc', dims: [190, 150, 130], mat: 'bflute', pal: ['#191410', '#f2dfb9', '#d98e2b', '#8a5a2b'], art: 'beer-bokeh', lay: 0, brand: 'Hopper', product: 'BAR SESSION IPA', tag: '4 × 440 ml · 4.6%', note: 'Best within 60 days of the date on the flap.', qr: 'rounded' }),
  S({ id: 'ph-hopper-pour', name: 'Hopper · First Pour Ale', category: 'Food & Bev', blurb: 'Wooden-bar pour framed like a taproom print.', box: 'seal', dims: [170, 120, 110], mat: 'kraft', pal: ['#efe0c4', '#2b1d12', '#b3672a', '#7d5a36'], art: 'beer-bar', lay: 7, brand: 'Hopper', product: 'FIRST POUR ALE', tag: '5.2% · CASK CONDITIONED', note: 'Cellar temperature. Tilting the glass is tradition.' }),
  S({ id: 'ph-vinea-cluster', name: 'Vinea · Cluster Reserve', category: 'Wine & Spirits', blurb: 'Vine-cluster medallion on oxblood stock.', box: 'ste', dims: [90, 90, 320], mat: 'black', pal: ['#170d10', '#f0dfc8', '#8e2f3c', '#5c2430'], art: 'grapes', lay: 4, brand: 'Vinea', product: 'CLUSTER RESERVE', tag: 'OLD VINE · UNFINED', note: 'Decant an hour. Drink with someone patient.', qr: 'branded' }),
  S({ id: 'ph-vinea-cellar', name: 'Vinea · Cellar Notes', category: 'Wine & Spirits', blurb: 'Vintage-paper diptych with corkscrew motif.', box: 'rsc', dims: [260, 180, 200], mat: 'bflute', pal: ['#efe3cc', '#3a2620', '#7e3b47', '#a08a68'], art: 'wine-vintage', lay: 1, brand: 'Vinea', product: 'CELLAR NOTES', tag: 'SIX BOTTLES · CURATED', note: 'Tasting cards for every bottle in the case.' }),
  S({ id: 'ph-vinea-press', name: 'Vinea · First Press', category: 'Wine & Spirits', blurb: 'Grape-macro twin band over deep plum.', box: 'rte', dims: [95, 95, 330], mat: 'sbs', pal: ['#f2e4d4', '#2c1216', '#93304a', '#6d4a52'], art: 'grapes', lay: 3, brand: 'Vinea', product: 'FIRST PRESS', tag: 'NATURAL · PÉT-NAT', note: 'Cloudy on purpose. Chill hard, open over the sink.' }),
  S({ id: 'ph-souk-bowls', name: 'Souk · Seven Bowls', category: 'Food & Bev', blurb: 'Spice-bowl flat-lay hero for a sampler set.', box: 'seal', dims: [180, 130, 60], mat: 'sbs', pal: ['#f6ecd9', '#402c17', '#c0392b', '#d98e2b'], art: 'spices-flat', lay: 0, brand: 'Souk', product: 'SEVEN BOWLS', tag: '7 × 40 g · WHOLE SPICE', note: 'Toast whole, grind fresh. Recipes on the back.', qr: 'classic' }),
  S({ id: 'ph-souk-leaf', name: 'Souk · Market Leaf', category: 'Food & Bev', blurb: 'Banana-leaf spice duotone poster.', box: 'rte', dims: [160, 110, 50], mat: 'kraft', pal: ['#efe3c8', '#2e3d1f', '#c0392b', '#7d8a4c'], art: 'spices-leaf', lay: 5, brand: 'Souk', product: 'MARKET LEAF', tag: 'CURRY LEAF · FRESH PACK', note: 'Freeze on arrival. Fry in hot oil to wake them.' }),
  S({ id: 'ph-souk-rub', name: 'Souk · Ember Rub', category: 'Food & Bev', blurb: 'Capsule window of spice over charcoal.', box: 'ste', dims: [90, 90, 120], mat: 'black', pal: ['#161210', '#f2dfb9', '#d35400', '#8a5a2b'], art: 'spices-flat', lay: 2, brand: 'Souk', product: 'EMBER RUB', tag: 'SMOKED PAPRIKA · 120 g', note: 'Two tablespoons per kilo. Rest the meat after.' }),
  S({ id: 'ph-monitor-grey', name: 'Monitor · Studio Cans', category: 'Tech', blurb: 'Grey studio headphone diptych, mono type system.', box: 'ste', dims: [180, 90, 200], mat: 'grey', pal: ['#eceff1', '#1c2126', '#3ddc97', '#5c6672'], art: 'headphones', lay: 1, brand: 'Monitor', product: 'STUDIO CANS', tag: 'CLOSED BACK · 38 Ω', note: 'Pads are user-replaceable. Twist, pull, click.', qr: 'rounded' }),
  S({ id: 'ph-monitor-light', name: 'Monitor · Daylight Edition', category: 'Tech', blurb: 'Window-light headphone hero on pale stock.', box: 'rte', dims: [170, 85, 190], mat: 'sbs', pal: ['#f4f6f8', '#20262e', '#5b8dee', '#8a97a8'], art: 'headphones-light', lay: 0, brand: 'Monitor', product: 'DAYLIGHT EDITION', tag: 'OPEN BACK · LIMITED', note: 'For quiet rooms and honest mixes.' }),
  S({ id: 'ph-monitor-tour', name: 'Monitor · Tour Case', category: 'Tech', blurb: 'Framed headphone print on a road-case carton.', box: 'rsc', dims: [240, 160, 180], mat: 'bflute', pal: ['#15181c', '#e8ecef', '#e4572e', '#4a5560'], art: 'headphones', lay: 7, brand: 'Monitor', product: 'TOUR CASE', tag: 'FOAM · CABLES · SPARE PADS', note: 'This case has flown 40,000 km. Recycle it kindly.', qr: 'branded' }),
  S({ id: 'ph-block-blue', name: 'Block & Birch · Puzzle Set', category: 'Kids', blurb: 'Blue puzzle flat-lay twin band for a toy shelf box.', box: 'rsc', dims: [220, 160, 90], mat: 'eflute', pal: ['#eaf3f8', '#1f4e6b', '#f2a03d', '#7fa8c4'], art: 'toys-blue', lay: 3, brand: 'Block & Birch', product: 'PUZZLE SET', tag: 'AGES 3+ · BEECHWOOD', note: 'Wipe clean. Oil monthly with food-safe oil.', qr: 'classic' }),
  S({ id: 'ph-block-sunny', name: 'Block & Birch · Sunny Stack', category: 'Kids', blurb: 'Yellow play-set diptych with chunky primaries.', box: 'ste', dims: [200, 140, 80], mat: 'sbs', pal: ['#fff6da', '#b34700', '#f4b942', '#e4572e'], art: 'toys-yellow', lay: 1, brand: 'Block & Birch', product: 'SUNNY STACK', tag: 'AGES 2+ · 24 PIECES', note: 'Stack, knock down, repeat. That is the whole point.' }),
  S({ id: 'ph-block-elephant', name: 'Block & Birch · Elephant Pack', category: 'Kids', blurb: 'Medallion of the felt elephant on butter yellow.', box: 'rte', dims: [180, 120, 70], mat: 'grey', pal: ['#fdf1d7', '#5c4a1f', '#7fa08c', '#c9b458'], art: 'toys-yellow', lay: 4, brand: 'Block & Birch', product: 'ELEPHANT PACK', tag: 'FELT · FSC WOOD', note: 'Machine wash cold, in a pillowcase.' }),
  S({ id: 'ph-nest-blush', name: 'Nest & Co · First Days Kit', category: 'Baby', blurb: 'Blush newborn flat-lay framed like a keepsake.', box: 'seal', dims: [220, 160, 80], mat: 'sbs', pal: ['#f9ecec', '#5c3a3a', '#d98c8c', '#e8c4c4'], art: 'baby-pink', lay: 7, brand: 'Nest & Co', product: 'FIRST DAYS KIT', tag: '0–3 MONTHS · ORGANIC COTTON', note: 'Wash before first use. Keep the ribbon for the box.', qr: 'rounded' }),
  S({ id: 'ph-nest-cloud', name: 'Nest & Co · Cloud Booties', category: 'Baby', blurb: 'Capsule window over cloud-soft pink.', box: 'ste', dims: [120, 80, 60], mat: 'sbs', pal: ['#f8eeee', '#4a3232', '#c97c7c', '#dfb4b4'], art: 'baby-pink', lay: 2, brand: 'Nest & Co', product: 'CLOUD BOOTIES', tag: 'TWO SIZES · MERINO', note: 'Size up — feet are ambitious.' }),
  S({ id: 'ph-drift-roastship', name: 'Driftwood · Roast Ship Case', category: 'E-commerce', blurb: 'Beans-top-down hero on a bulk roast case.', box: 'rsc', dims: [240, 180, 200], mat: 'bflute', pal: ['#efe6d6', '#241c15', '#e4572e', '#8a6a4c'], art: 'coffee-beans', lay: 0, brand: 'Driftwood Coffee', product: 'ROAST SHIP CASE', tag: '6 × 250 g · MIXED', note: 'Roast dates on each bag. Oldest first.', qr: 'classic' }),
  S({ id: 'ph-drift-decaf', name: 'Driftwood · Late Decaf', category: 'Food & Bev', blurb: 'Macro-bean duotone poster for the decaf line.', box: 'rte', dims: [85, 55, 135], mat: 'sbs', pal: ['#f1e8db', '#2c211a', '#7d5a8c', '#a08aa8'], art: 'coffee-macro', lay: 5, brand: 'Driftwood Coffee', product: 'LATE DECAF', tag: 'SUGARCANE PROCESS · 250 g', note: 'All of the comfort, none of the ceiling stare.' }),
  S({ id: 'ph-aurum-bath', name: 'Aurum · Vein Bath Stone', category: 'Beauty', blurb: 'Marble twin band for a carved bath stone.', box: 'rte', dims: [110, 70, 50], mat: 'sbs', pal: ['#f7f4ee', '#2a2620', '#c9a227', '#a39a8a'], art: 'marble-grey', lay: 3, brand: 'Aurum', product: 'VEIN BATH STONE', tag: 'CARVED · REUSABLE', note: 'Warm it under the tap. It holds heat for twenty minutes.' }),
  S({ id: 'ph-tide-line', name: 'Tide & Swell · Line-Up Wax Trio', category: 'Outdoor', blurb: 'Aerial foam diptych across a wax trio pack.', box: 'seal', dims: [150, 60, 40], mat: 'grey', pal: ['#e8f4f2', '#0e3335', '#128f8b', '#5fa39d'], art: 'ocean-foam', lay: 1, brand: 'Tide & Swell', product: 'LINE-UP TRIO', tag: 'COLD · COOL · WARM', note: 'Basecoat cold, topcoat warm. Same as everything.' }),
];

/* ------------------------------ layout systems --------------------------- */

type Art = { fills: Record<string, string>; objects: DesignObject[] };

const qrObject = (s: PSpec, rect: { x: number; y: number; w: number; h: number }, captionFill: string): DesignObject[] => {
  if (!s.qr) return [];
  const side = Math.min(rect.w, rect.h);
  const src = qrDataURL(`https://boxcraft.studio/${s.id}`, { ...QR_DEFAULTS[s.qr], px: 16, label: mark(s.brand) });
  const objs = [Im({ x: rect.x + (rect.w - side) / 2, y: rect.y, w: side, h: side, src, fit: 'contain', name: `QR · ${s.qr}` })];
  objs.push(T({ x: rect.x, y: rect.y + side + 1, w: rect.w, h: 5, text: 'SCAN FOR THE STORY', fill: captionFill, size: fit('SCAN FOR THE STORY', rect.w * 0.9, 0.6, 4), weight: 700, tracking: 0.6, opacity: 0.75 }));
  return objs;
};

const backDressing = (net: Net, s: PSpec, o: Art, dark: boolean) => {
  const body = dark ? s.pal[0] : s.pal[1];
  const p = net.byId['back'];
  if (!p) return;
  o.objects.push(
    T({ ...on(net, 'back', 0.08, 0.07, 0.84, 0.08), text: s.brand.toUpperCase(), fill: body, size: fit(s.brand.toUpperCase(), pw(net, 'back', 0.7), 1.5, 7), weight: 800, tracking: 1.5 }),
    T({ ...on(net, 'back', 0.08, 0.17, 0.84, 0.3), text: s.note, fill: body, size: Math.min(5.2, fit(s.note, pw(net, 'back', 0.8), 0, 5.2)), weight: 500, align: 'left', lineHeight: 1.5, opacity: 0.9 }),
    T({ ...on(net, 'back', 0.08, 0.86, 0.84, 0.06), text: s.tag, fill: body, size: fit(s.tag, pw(net, 'back', 0.8), 0.8, 4.4), weight: 700, tracking: 0.8, opacity: 0.75 }),
  );
  if (s.qr) {
    const qside = Math.min(p.w, p.h) * 0.34;
    o.objects.push(...qrObject(s, { x: p.x + p.w * 0.62, y: p.y + p.h * 0.55, w: qside, h: qside }, body));
  } else {
    o.objects.push(El({ ...on(net, 'back', 0.72, 0.62, 0.18, 0.2), fill: s.pal[2], opacity: 0.9, name: 'Back seal' }));
  }
};

const sideDressing = (net: Net, s: PSpec, o: Art, light: string) => {
  const l = net.byId['side-l']; const r = net.byId['side-r'];
  if (l) {
    const w = l.h * 0.72, h = Math.min(l.w * 0.5, 14);
    o.objects.push(T({ x: l.x + l.w / 2 - w / 2, y: l.y + l.h / 2 - h / 2, w, h, rot: -90, text: s.brand.toUpperCase(), fill: light, size: Math.min(h * 0.62, fit(s.brand.toUpperCase(), w, 2, h * 0.62)), weight: 800, tracking: 2 }));
  }
  if (r) o.objects.push(T({ ...on(net, 'side-r', 0.1, 0.42, 0.8, 0.16), text: mark(s.brand), fill: light, size: fit(mark(s.brand), pw(net, 'side-r', 0.6), 1, 12), weight: 800, tracking: 1, opacity: 0.9 }));
  const t = topId(net);
  if (t) o.objects.push(T({ ...on(net, t, 0.12, 0.36, 0.76, 0.28), text: s.product, fill: light, size: fit(s.product, pw(net, t, 0.72), 1, 9), weight: 800, tracking: 1 }));
};

function buildPhoto(net: Net, s: PSpec): Art {
  const [paper, ink, accent, soft] = s.pal;
  const o: Art = { fills: {}, objects: [] };
  const art = artSrc(s.art);

  switch (s.lay) {
    case 0: { // hero scrim
      o.fills = { front: ink, back: ink, 'side-l': ink, 'side-r': ink };
      const t = topId(net); const b = botId(net);
      if (t) o.fills[t] = accent; if (b) o.fills[b] = accent;
      o.objects.push(
        Im({ ...on(net, 'front', 0, 0, 1, 1), src: art, fit: 'cover', name: 'Hero photo' }),
        R({ ...on(net, 'front', 0, 0.42, 1, 0.3), fill: ink, opacity: 0.32, name: 'Scrim mid' }),
        R({ ...on(net, 'front', 0, 0.58, 1, 0.42), fill: ink, opacity: 0.78, name: 'Scrim low' }),
        R({ ...on(net, 'front', 0.07, 0.075, 0.1, 0.012), fill: accent, name: 'Kicker bar' }),
        T({ ...on(net, 'front', 0.07, 0.1, 0.86, 0.06), text: s.brand.toUpperCase(), fill: paper, size: fit(s.brand.toUpperCase(), pw(net, 'front', 0.8), 1.6, 6.5), weight: 800, tracking: 1.6 }),
        T({ ...on(net, 'front', 0.07, 0.66, 0.86, 0.16), text: s.product, fill: paper, size: fit(s.product, pw(net, 'front', 0.82), 2, 22), weight: 800, tracking: 2 }),
        T({ ...on(net, 'front', 0.07, 0.85, 0.86, 0.07), text: s.tag, fill: accent, size: fit(s.tag, pw(net, 'front', 0.8), 0.9, 5), weight: 700, tracking: 0.9 }),
        El({ ...on(net, 'front', 0.78, 0.1, 0.15, 0.12), fill: accent, opacity: 0.95, name: 'Corner seal' }),
        T({ ...on(net, 'front', 0.78, 0.135, 0.15, 0.05), text: mark(s.brand), fill: ink, size: fit(mark(s.brand), pw(net, 'front', 0.11), 0.4, 4.5), weight: 800 }),
      );
      backDressing(net, s, o, true);
      sideDressing(net, s, o, paper);
      break;
    }
    case 1: { // diptych
      o.fills = { front: paper, back: ink, 'side-l': accent, 'side-r': accent };
      o.objects.push(
        Im({ ...on(net, 'front', 0, 0, 0.58, 1), src: art, fit: 'cover', name: 'Diptych photo' }),
        R({ ...on(net, 'front', 0.58, 0, 0.012, 1), fill: accent, name: 'Split rule' }),
        T({ ...on(net, 'front', 0.63, 0.09, 0.32, 0.07), text: s.brand.toUpperCase(), fill: ink, size: fit(s.brand.toUpperCase(), pw(net, 'front', 0.3), 0.8, 5), weight: 800, tracking: 0.8 }),
        T({ ...on(net, 'front', 0.63, 0.34, 0.33, 0.3), text: s.product.split(' ').join('\n'), fill: ink, size: fit(s.product.split(' ').sort((a, b) => b.length - a.length)[0], pw(net, 'front', 0.3), 1, 14), weight: 800, tracking: 1, lineHeight: 1.05, align: 'left' }),
        R({ ...on(net, 'front', 0.63, 0.72, 0.2, 0.012), fill: accent }),
        T({ ...on(net, 'front', 0.63, 0.78, 0.33, 0.12), text: s.tag, fill: soft, size: fit(s.tag, pw(net, 'front', 0.32), 0.2, 3.6), weight: 600, align: 'left', lineHeight: 1.4 }),
      );
      backDressing(net, s, o, true);
      sideDressing(net, s, o, paper);
      break;
    }
    case 2: { // capsule window
      o.fills = { front: paper, back: paper, 'side-l': paper, 'side-r': paper };
      const t = topId(net); if (t) o.fills[t] = accent;
      o.objects.push(
        T({ ...on(net, 'front', 0.08, 0.06, 0.84, 0.07), text: s.brand.toUpperCase(), fill: ink, size: fit(s.brand.toUpperCase(), pw(net, 'front', 0.75), 1.8, 6), weight: 800, tracking: 1.8 }),
        Im({ ...on(net, 'front', 0.16, 0.17, 0.68, 0.5), src: art, fit: 'cover', radius: 999, name: 'Capsule photo' }),
        T({ ...on(net, 'front', 0.08, 0.72, 0.84, 0.12), text: s.product, fill: ink, size: fit(s.product, pw(net, 'front', 0.8), 1.5, 12), weight: 800, tracking: 1.5 }),
        T({ ...on(net, 'front', 0.08, 0.87, 0.84, 0.06), text: s.tag, fill: accent, size: fit(s.tag, pw(net, 'front', 0.8), 0.7, 4.5), weight: 700, tracking: 0.7 }),
        El({ ...on(net, 'front', 0.09, 0.19, 0.05, 0.05), fill: accent, name: 'Dot' }),
        El({ ...on(net, 'front', 0.86, 0.19, 0.05, 0.05), fill: soft, name: 'Dot' }),
      );
      backDressing(net, s, o, false);
      sideDressing(net, s, o, ink);
      break;
    }
    case 3: { // twin band
      o.fills = { front: paper, back: ink, 'side-l': soft, 'side-r': soft };
      o.objects.push(
        Im({ ...on(net, 'front', 0, 0, 1, 0.46), src: art, fit: 'cover', name: 'Band photo' }),
        R({ ...on(net, 'front', 0, 0.46, 1, 0.02), fill: accent, name: 'Band rule' }),
        T({ ...on(net, 'front', 0.07, 0.54, 0.86, 0.17), text: s.product, fill: ink, size: fit(s.product, pw(net, 'front', 0.84), 2, 18), weight: 800, tracking: 2 }),
        T({ ...on(net, 'front', 0.07, 0.73, 0.86, 0.07), text: s.brand.toUpperCase(), fill: accent, size: fit(s.brand.toUpperCase(), pw(net, 'front', 0.7), 1.4, 6), weight: 800, tracking: 1.4 }),
        T({ ...on(net, 'front', 0.07, 0.86, 0.86, 0.07), text: s.tag, fill: soft, size: fit(s.tag, pw(net, 'front', 0.8), 0.8, 4.6), weight: 600, tracking: 0.8 }),
      );
      backDressing(net, s, o, true);
      sideDressing(net, s, o, ink);
      break;
    }
    case 4: { // medallion
      o.fills = { front: ink, back: ink, 'side-l': ink, 'side-r': ink };
      const b = botId(net); if (b) o.fills[b] = accent;
      o.objects.push(
        El({ ...on(net, 'front', 0.14, 0.14, 0.72, 0.56), fill: 'transparent', stroke: accent, strokeW: 0.8, name: 'Ring' }),
        Im({ ...on(net, 'front', 0.18, 0.18, 0.64, 0.48), src: art, fit: 'cover', radius: 999, name: 'Medallion photo' }),
        T({ ...on(net, 'front', 0.08, 0.05, 0.84, 0.06), text: s.brand.toUpperCase(), fill: paper, size: fit(s.brand.toUpperCase(), pw(net, 'front', 0.7), 1.6, 5.5), weight: 800, tracking: 1.6 }),
        T({ ...on(net, 'front', 0.08, 0.76, 0.84, 0.12), text: s.product, fill: paper, size: fit(s.product, pw(net, 'front', 0.8), 1.5, 11), weight: 800, tracking: 1.5 }),
        T({ ...on(net, 'front', 0.08, 0.9, 0.84, 0.06), text: s.tag, fill: accent, size: fit(s.tag, pw(net, 'front', 0.78), 0.7, 4.5), weight: 700, tracking: 0.7 }),
      );
      backDressing(net, s, o, true);
      sideDressing(net, s, o, paper);
      break;
    }
    case 5: { // duotone poster
      o.fills = { front: ink, back: paper, 'side-l': ink, 'side-r': ink };
      o.objects.push(
        Im({ ...on(net, 'front', 0, 0, 1, 1), src: art, fit: 'cover', name: 'Poster photo' }),
        R({ ...on(net, 'front', 0, 0, 1, 1), fill: accent, opacity: 0.34, name: 'Duotone wash' }),
        T({ ...on(net, 'front', 0.06, 0.06, 0.88, 0.07), text: s.brand.toUpperCase(), fill: paper, size: fit(s.brand.toUpperCase(), pw(net, 'front', 0.8), 2, 6), weight: 800, tracking: 2 }),
        T({ ...on(net, 'front', 0.05, 0.6, 0.9, 0.26), text: s.product, fill: 'transparent', stroke: paper, strokeW: 0.5, size: fit(s.product, pw(net, 'front', 0.86), 2, 24), weight: 800, tracking: 2 }),
        T({ ...on(net, 'front', 0.06, 0.89, 0.88, 0.06), text: s.tag, fill: paper, size: fit(s.tag, pw(net, 'front', 0.8), 0.8, 4.6), weight: 700, tracking: 0.8, opacity: 0.85 }),
      );
      backDressing(net, s, o, false);
      sideDressing(net, s, o, paper);
      break;
    }
    case 6: { // rail
      o.fills = { front: paper, back: paper, 'side-l': ink, 'side-r': ink };
      const t = topId(net); if (t) o.fills[t] = ink;
      o.objects.push(
        Im({ ...on(net, 'front', 0, 0, 0.3, 1), src: art, fit: 'cover', name: 'Rail photo' }),
        R({ ...on(net, 'front', 0.3, 0, 0.014, 1), fill: accent }),
        T({ ...on(net, 'front', 0.36, 0.1, 0.58, 0.26), text: s.product.split(' ').join('\n'), fill: ink, size: fit(s.product.split(' ').sort((a, b) => b.length - a.length)[0], pw(net, 'front', 0.55), 1, 16), weight: 800, tracking: 1, lineHeight: 1.02, align: 'left' }),
        T({ ...on(net, 'front', 0.36, 0.52, 0.58, 0.06), text: s.brand.toUpperCase(), fill: accent, size: fit(s.brand.toUpperCase(), pw(net, 'front', 0.5), 1.2, 5.5), weight: 800, tracking: 1.2 }),
        T({ ...on(net, 'front', 0.36, 0.66, 0.58, 0.2), text: s.note, fill: soft, size: fit(s.note, pw(net, 'front', 0.55), 0, 4.2), weight: 500, align: 'left', lineHeight: 1.45 }),
        R({ ...on(net, 'front', 0.36, 0.9, 0.3, 0.012), fill: ink }),
      );
      backDressing(net, s, o, false);
      sideDressing(net, s, o, paper);
      break;
    }
    default: { // framed print
      o.fills = { front: soft, back: paper, 'side-l': paper, 'side-r': paper };
      o.objects.push(
        R({ ...on(net, 'front', 0.07, 0.06, 0.86, 0.72), fill: paper, name: 'Frame', stroke: ink, strokeW: 0.35 }),
        Im({ ...on(net, 'front', 0.11, 0.1, 0.78, 0.6), src: art, fit: 'cover', name: 'Print photo' }),
        T({ ...on(net, 'front', 0.09, 0.81, 0.6, 0.09), text: s.product, fill: ink, size: fit(s.product, pw(net, 'front', 0.55), 1, 8.5), weight: 700, tracking: 1, align: 'left', font: SERIF }),
        T({ ...on(net, 'front', 0.09, 0.9, 0.6, 0.06), text: `${s.brand} — ${s.tag}`, fill: soft, size: fit(`${s.brand} — ${s.tag}`, pw(net, 'front', 0.55), 0.3, 4), weight: 500, align: 'left', font: SERIF, opacity: 0.9 }),
        T({ ...on(net, 'front', 0.72, 0.86, 0.2, 0.08), text: mark(s.brand), fill: accent, size: fit(mark(s.brand), pw(net, 'front', 0.16), 1, 9), weight: 800, align: 'right' }),
      );
      backDressing(net, s, o, false);
      sideDressing(net, s, o, ink);
      break;
    }
  }

  // keep only fills for panels that exist on this structure
  o.fills = Object.fromEntries(Object.entries(o.fills).filter(([id]) => !!net.byId[id]));
  return o;
}

export const PHOTO_TEMPLATES: Template[] = SPECS.map((s) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  blurb: s.blurb,
  boxType: s.box,
  dims: s.dims,
  materialId: s.mat,
  board: s.pal[0],
  inner: '#efe9dd',
  swatch: [s.pal[1], s.pal[2], s.pal[0]],
  build: (net) => buildPhoto(net, s),
}));

export const PHOTO_COUNT = PHOTO_TEMPLATES.length;
