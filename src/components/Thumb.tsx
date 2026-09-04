import { useEffect, useRef } from 'react';
import { buildNet, boxTypeById, panelPoly, type BoxTypeId, type Net } from '../lib/geometry';
import type { Design } from '../lib/store';
import { drawDieline, preloadAll, renderTexture } from '../lib/render2d';

/** Flat dieline thumbnail. */
export function NetThumb({ type, w = 200, h = 90, color = '#8b95a6', bg = 'transparent' }: {
  type: BoxTypeId; w?: number; h?: number; color?: string; bg?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(devicePixelRatio, 2);
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    if (bg !== 'transparent') { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    const t = boxTypeById(type);
    const [L, W, H] = t.defaults;
    const net = buildNet(type, { L, W, H, caliper: 0.45, glue: 12, bleed: 3 });
    const b = net.bounds;
    const s = Math.min((w - 14) / b.w, (h - 14) / b.h);
    ctx.translate(w / 2, h / 2);
    ctx.scale(s, s);
    ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (const p of net.panels) {
      const poly = panelPoly(p);
      ctx.beginPath();
      poly.forEach(([x, y]: [number, number], i: number) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath(); ctx.fill();
    }
    drawDieline(ctx, net, {
      cut: color, crease: 'rgba(90,140,255,.75)', bleed: 'transparent', safe: 'transparent',
      lw: 1 / s, labels: false, showBleed: false, showSafe: false, labelSize: 0,
    }, 0);
  }, [type, w, h, color, bg]);
  return <canvas ref={ref} style={{ width: w, height: h }} />;
}

/** Pseudo-3D box preview built from the artwork artboard — fast, no WebGL. */
export function drawPseudo3D(
  ctx: CanvasRenderingContext2D, art: HTMLCanvasElement, net: Net, W: number, H: number,
  bg: string, k: number,
) {
  const b = net.bounds;
  const pick = (...ids: string[]) => { for (const id of ids) if (net.byId[id]) return net.byId[id]; return net.root; };
  const front = pick('front', 'base');
  const side = pick('side-r', 'side-l', 'back');
  const top = pick('lid-top', 'lid', 'bt', 'base', 'back');

  const src = (p: typeof front) => [
    (p.x - b.x) * k, (p.y - b.y) * k, Math.max(1, p.w * k), Math.max(1, p.h * k),
  ] as [number, number, number, number];

  // layout: fit the composed box into W x H.
  // Base-rooted structures (mailer, tray) carry their walls rotated in the
  // flat, so their depth lives on the lid panel and the side art is transposed.
  const flat = !!net.layFlat;
  const fw = front.w, fh = front.h, dw = flat ? top.h : side.w;
  const iso = 0.42;
  const totalW = fw + dw * iso * 1.35;
  const totalH = fh + dw * iso * 0.78;
  const s = Math.min((W * 0.74) / totalW, (H * 0.78) / totalH);
  const x0 = (W - (fw + dw * iso * 1.35) * s) / 2;
  const y0 = (H - (fh + dw * iso * 0.78) * s) / 2 + dw * iso * 0.78 * s;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // soft ground shadow
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.filter = 'blur(9px)';
  ctx.fillStyle = '#0b1020';
  ctx.beginPath();
  ctx.ellipse(x0 + fw * s * 0.62, y0 + fh * s + 8, fw * s * 0.62, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const dx = dw * iso * 1.35 * s;
  const dy = dw * iso * 0.78 * s;

  // top face
  ctx.save();
  ctx.transform(1, 0, dx / (top.h || 1) / s, -dy / (top.h || 1) / s, x0, y0);
  ctx.scale(s, s);
  const [tsx, tsy, tsw, tsh] = src(top);
  ctx.drawImage(art, tsx, tsy, tsw, tsh, 0, 0, top.w, top.h);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x0 + dx, y0 - dy);
  ctx.lineTo(x0 + dx + fw * s, y0 - dy); ctx.lineTo(x0 + fw * s, y0);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // side face
  ctx.save();
  if (flat) ctx.transform(0, 1, dx / ((side.h || 1) * s), -dy / ((side.h || 1) * s), x0 + fw * s, y0);
  else ctx.transform(dx / (side.w || 1) / s, -dy / (side.w || 1) / s, 0, 1, x0 + fw * s, y0);
  ctx.scale(s, s);
  const [ssx, ssy, ssw, ssh] = src(side);
  ctx.drawImage(art, ssx, ssy, ssw, ssh, 0, 0, side.w, side.h);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(x0 + fw * s, y0); ctx.lineTo(x0 + fw * s + dx, y0 - dy);
  ctx.lineTo(x0 + fw * s + dx, y0 - dy + fh * s); ctx.lineTo(x0 + fw * s, y0 + fh * s);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // front face
  ctx.save();
  ctx.translate(x0, y0);
  ctx.scale(s, s);
  const [fsx, fsy, fsw, fsh] = src(front);
  ctx.drawImage(art, fsx, fsy, fsw, fsh, 0, 0, front.w, front.h);
  ctx.restore();

  // sheen
  ctx.save();
  const g = ctx.createLinearGradient(x0, y0, x0 + fw * s, y0 + fh * s);
  g.addColorStop(0, 'rgba(255,255,255,0.16)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, fw * s, fh * s);
  ctx.restore();
}

export function BoxThumb({ design, w = 260, h = 170, bg = '#eef1f6' }: {
  design: Design; w?: number; h?: number; bg?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let dead = false;
    let observer: IntersectionObserver | null = null;

    const draw = () => {
      const net = buildNet(design.boxType, design.params);
      preloadAll(design).then(() => {
        if (dead || !ref.current) return;
        const k = 4;
        const art = renderTexture(design, net, k, 2400);
        const kk = art.width / net.bounds.w;
        const c = ref.current;
        const cw = c.clientWidth || w;
        const dpr = Math.min(devicePixelRatio, 2);
        c.width = cw * dpr; c.height = h * dpr;
        const ctx = c.getContext('2d')!;
        ctx.scale(dpr, dpr);
        drawPseudo3D(ctx, art, net, cw, h, bg, kk);
      });
    };

    // A hundred cards can otherwise allocate a hundred full-size art canvases
    // at once. Render only cards near the viewport; the coloured canvas keeps
    // the grid stable while a user scrolls or filters the library.
    const canvas = ref.current;
    if (!canvas || typeof IntersectionObserver === 'undefined') draw();
    else {
      observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer?.disconnect();
        draw();
      }, { rootMargin: '320px 0px' });
      observer.observe(canvas);
    }

    return () => { dead = true; observer?.disconnect(); };
  }, [design, w, h, bg]);
  return <canvas ref={ref} style={{ width: '100%', height: h, display: 'block', background: bg }} />;
}
