import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { drawArtwork, drawDieline, hitTest, panelAt, pathPoly } from '../lib/render2d';
import { panelPoly } from '../lib/geometry';
import { Icon, I } from './ui';

interface View { s: number; tx: number; ty: number; }
type Mode = null | { m: 'move' | 'resize' | 'rot' | 'pan'; mx: number; my: number; orig: any; h?: number; sx?: number; sy?: number };

export default function Dieline2D({ selectedPanel, onSelectPanel }: {
  selectedPanel: string | null; onSelectPanel: (id: string | null) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const cvs = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ s: 2, tx: 0, ty: 0 });
  const mode = useRef<Mode>(null);
  const guides = useRef<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [, force] = useState(0);
  const repaint = useCallback(() => force((n) => n + 1), []);

  const design = useStore((s) => s.design);
  const net = useStore((s) => s.net);
  const vs = useStore((s) => s.view);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const update = useStore((s) => s.updateObject);
  const dirty = useStore((s) => s.dirty);

  const fit = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const b = net.bounds;
    const pad = 60;
    const s = Math.min((el.clientWidth - pad * 2) / b.w, (el.clientHeight - pad * 2) / b.h);
    view.current = {
      s,
      tx: (el.clientWidth - b.w * s) / 2 - b.x * s,
      ty: (el.clientHeight - b.h * s) / 2 - b.y * s,
    };
    repaint();
  }, [net, repaint]);

  useEffect(() => { fit(); }, [net.id, fit]);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { fit(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  /* ------------------------- paint ------------------------- */
  useEffect(() => {
    const c = cvs.current, el = wrap.current;
    if (!c || !el) return;
    const dpr = Math.min(devicePixelRatio, 2);
    const W = el.clientWidth, H = el.clientHeight;
    c.width = W * dpr; c.height = H * dpr;
    c.style.width = W + 'px'; c.style.height = H + 'px';
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // backdrop grid
    ctx.fillStyle = '#14171d';
    ctx.fillRect(0, 0, W, H);
    const { s, tx, ty } = view.current;
    const step = 10 * s;
    if (step > 6) {
      ctx.strokeStyle = 'rgba(255,255,255,0.032)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = tx % step; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = ty % step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(s, s);

    // paper drop shadow
    const b = net.bounds;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 26 / s;
    ctx.shadowOffsetY = 8 / s;
    ctx.fillStyle = design.boardColor;
    ctx.beginPath();
    for (const p of net.panels) { const poly = panelPoly(p); poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
    ctx.fill();
    ctx.restore();

    drawArtwork(ctx, design, net, { clip: true, repaint });

    // artwork that spills outside the die
    ctx.save();
    ctx.globalAlpha = 0.09;
    drawArtwork(ctx, design, net, { clip: false, repaint });
    ctx.restore();

    if (vs.showDieline) {
      drawDieline(ctx, net, {
        cut: 'rgba(20,24,31,.85)', crease: '#0a84ff', bleed: '#ff3b30', safe: 'rgba(20,24,31,.4)',
        lw: 1 / s, labels: vs.showLabels, showBleed: vs.showBleed, showSafe: vs.showSafe,
        labelSize: Math.min(6, 14 / s),
      }, design.params.bleed, 4);
    }

    // selected panel highlight
    if (selectedPanel && net.byId[selectedPanel]) {
      ctx.save();
      pathPoly(ctx, panelPoly(net.byId[selectedPanel]));
      ctx.strokeStyle = '#ff5c39';
      ctx.lineWidth = 2 / s;
      ctx.setLineDash([6 / s, 4 / s]);
      ctx.stroke();
      ctx.restore();
    }

    // snap guides
    ctx.strokeStyle = '#3ddc97';
    ctx.lineWidth = 1 / s;
    for (const gx of guides.current.v) { ctx.beginPath(); ctx.moveTo(gx, b.y - 20); ctx.lineTo(gx, b.y + b.h + 20); ctx.stroke(); }
    for (const gy of guides.current.h) { ctx.beginPath(); ctx.moveTo(b.x - 20, gy); ctx.lineTo(b.x + b.w + 20, gy); ctx.stroke(); }

    ctx.restore();

    // selection chrome (screen space)
    for (const id of selection) {
      const o = design.objects.find((x) => x.id === id);
      if (!o) continue;
      const cx = (o.x + o.w / 2) * s + tx;
      const cy = (o.y + o.h / 2) * s + ty;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((o.rot * Math.PI) / 180);
      const w = o.w * s, h = o.h * s;
      ctx.strokeStyle = '#ff5c39';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#fff';
      for (const [hx, hy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        ctx.beginPath();
        ctx.rect(hx * w / 2 - 4, hy * h / 2 - 4, 8, 8);
        ctx.fill(); ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, -h / 2); ctx.lineTo(0, -h / 2 - 18); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -h / 2 - 22, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  });

  /* ------------------------- interaction ------------------------- */
  const toMM = (e: { clientX: number; clientY: number }) => {
    const r = cvs.current!.getBoundingClientRect();
    const { s, tx, ty } = view.current;
    return { x: (e.clientX - r.left - tx) / s, y: (e.clientY - r.top - ty) / s };
  };

  const handleAt = (e: React.PointerEvent) => {
    const r = cvs.current!.getBoundingClientRect();
    const { s, tx, ty } = view.current;
    const px = e.clientX - r.left, py = e.clientY - r.top;
    for (const id of selection) {
      const o = design.objects.find((x) => x.id === id);
      if (!o) continue;
      const cx = (o.x + o.w / 2) * s + tx, cy = (o.y + o.h / 2) * s + ty;
      const a = (-o.rot * Math.PI) / 180;
      const dx = px - cx, dy = py - cy;
      const lx = dx * Math.cos(a) - dy * Math.sin(a);
      const ly = dx * Math.sin(a) + dy * Math.cos(a);
      const w = o.w * s, h = o.h * s;
      const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let i = 0; i < 4; i++) {
        if (Math.abs(lx - corners[i][0] * w / 2) < 7 && Math.abs(ly - corners[i][1] * h / 2) < 7) return { id, h: i };
      }
      if (Math.abs(lx) < 8 && Math.abs(ly + h / 2 + 22) < 9) return { id, h: -1 };
    }
    return null;
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = toMM(e);
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      mode.current = { m: 'pan', mx: e.clientX, my: e.clientY, orig: { ...view.current } };
      return;
    }
    const hnd = handleAt(e);
    if (hnd) {
      const o = design.objects.find((x) => x.id === hnd.id)!;
      mode.current = { m: hnd.h === -1 ? 'rot' : 'resize', mx: p.x, my: p.y, orig: { ...o }, h: hnd.h };
      return;
    }
    const hit = hitTest(design, p.x, p.y);
    if (hit) {
      if (!selection.includes(hit)) select([hit]);
      const o = design.objects.find((x) => x.id === hit)!;
      mode.current = { m: 'move', mx: p.x, my: p.y, orig: { ...o } };
      onSelectPanel(null);
    } else {
      select([]);
      const pan = panelAt(net, p.x, p.y);
      onSelectPanel(pan ? pan.id : null);
      mode.current = { m: 'pan', mx: e.clientX, my: e.clientY, orig: { ...view.current } };
    }
    repaint();
  };

  /** cursor feedback without re-rendering on every pointer move */
  const setCursor = (c: string) => { if (cvs.current) cvs.current.style.cursor = c; };

  const onMove = (e: React.PointerEvent) => {
    const md = mode.current;
    if (!md) {
      const p = toMM(e);
      setCursor(handleAt(e) ? 'crosshair' : hitTest(design, p.x, p.y) ? 'move' : 'default');
      return;
    }
    if (md.m === 'pan') setCursor('grabbing');
    if (md.m === 'pan') {
      view.current = { s: md.orig.s, tx: md.orig.tx + (e.clientX - md.mx), ty: md.orig.ty + (e.clientY - md.my) };
      repaint();
      return;
    }
    const p = toMM(e);
    const o = md.orig;
    const dx = p.x - md.mx, dy = p.y - md.my;

    if (md.m === 'move') {
      let nx = o.x + dx, ny = o.y + dy;
      const gv: number[] = [], gh: number[] = [];
      const tol = 1.6 / view.current.s * 2;
      for (const pn of net.panels) {
        for (const [target, cur, set] of [
          [pn.x, nx, (v: number) => (nx = v)], [pn.x + pn.w, nx + o.w, (v: number) => (nx = v - o.w)],
          [pn.x + pn.w / 2, nx + o.w / 2, (v: number) => (nx = v - o.w / 2)],
        ] as [number, number, (v: number) => void][]) {
          if (Math.abs(target - cur) < tol) { set(target); gv.push(target); }
        }
        for (const [target, cur, set] of [
          [pn.y, ny, (v: number) => (ny = v)], [pn.y + pn.h, ny + o.h, (v: number) => (ny = v - o.h)],
          [pn.y + pn.h / 2, ny + o.h / 2, (v: number) => (ny = v - o.h / 2)],
        ] as [number, number, (v: number) => void][]) {
          if (Math.abs(target - cur) < tol) { set(target); gh.push(target); }
        }
      }
      guides.current = { v: gv.slice(0, 2), h: gh.slice(0, 2) };
      update(o.id, { x: nx, y: ny }, 'move');
    } else if (md.m === 'rot') {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      let ang = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      if (e.shiftKey) ang = Math.round(ang / 15) * 15;
      update(o.id, { rot: Math.round(ang * 10) / 10 }, 'rot');
    } else if (md.m === 'resize') {
      const r = (o.rot * Math.PI) / 180;
      const ux = { x: Math.cos(r), y: Math.sin(r) };
      const uy = { x: -Math.sin(r), y: Math.cos(r) };
      const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      const [sx, sy] = corners[md.h!];
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      const fx = cx + ux.x * (-sx * o.w / 2) + uy.x * (-sy * o.h / 2);
      const fy = cy + ux.y * (-sx * o.w / 2) + uy.y * (-sy * o.h / 2);
      const vx = p.x - fx, vy = p.y - fy;
      let nw = Math.max(2, (vx * ux.x + vy * ux.y) * sx);
      let nh = Math.max(2, (vx * uy.x + vy * uy.y) * sy);
      if (e.altKey || o.type === 'image') {
        const ar = o.w / o.h;
        if (nw / nh > ar) nw = nh * ar; else nh = nw / ar;
      }
      const ncx = fx + (ux.x * sx * nw + uy.x * sy * nh) / 2;
      const ncy = fy + (ux.y * sx * nw + uy.y * sy * nh) / 2;
      const patch: any = { w: nw, h: nh, x: ncx - nw / 2, y: ncy - nh / 2 };
      if (o.type === 'text') patch.size = Math.max(1, o.size * (nh / o.h));
      update(o.id, patch, 'resize');
    }
  };

  const onUp = () => { mode.current = null; guides.current = { v: [], h: [] }; setCursor('default'); repaint(); };

  const onWheel = (e: React.WheelEvent) => {
    const r = cvs.current!.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const { s, tx, ty } = view.current;
    const ns = Math.max(0.3, Math.min(40, s * (1 - Math.sign(e.deltaY) * 0.12)));
    view.current = { s: ns, tx: mx - ((mx - tx) / s) * ns, ty: my - ((my - ty) / s) * ns };
    repaint();
  };

  useEffect(() => { repaint(); }, [dirty, vs, selection, selectedPanel, repaint]);

  const zoom = (f: number) => {
    const el = wrap.current!;
    const { s, tx, ty } = view.current;
    const mx = el.clientWidth / 2, my = el.clientHeight / 2;
    const ns = Math.max(0.3, Math.min(40, s * f));
    view.current = { s: ns, tx: mx - ((mx - tx) / s) * ns, ty: my - ((my - ty) / s) * ns };
    repaint();
  };

  return (
    <div className="pane pane2d" ref={wrap} onContextMenu={(e) => e.preventDefault()}>
      <canvas
        ref={cvs}
        style={{ position: 'absolute', inset: 0 }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
      />
      <div className="pane-label" title={`${net.name} · ${net.bounds.w.toFixed(0)}×${net.bounds.h.toFixed(0)} mm blank`}>
        {net.bounds.w.toFixed(0)}×{net.bounds.h.toFixed(0)} mm blank
      </div>
      <div className="overlay-tools">
        <button className="otool" onClick={() => zoom(1 / 1.25)}>−</button>
        <button className="otool" onClick={fit}>Fit</button>
        <button className="otool" onClick={() => zoom(1.25)}>+</button>
        <button className={`otool ${vs.showDieline ? 'on' : ''}`} onClick={() => useStore.getState().setView({ showDieline: !vs.showDieline })}>
          <Icon d={I.grid} size={12} /> Die
        </button>
      </div>
    </div>
  );
}
