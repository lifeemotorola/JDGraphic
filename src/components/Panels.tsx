import { useMemo, useRef, useState } from 'react';
import {
  BOX_TYPES, boxTypeById, netMetrics, type BoxTypeId,
} from '../lib/geometry';
import {
  MATERIALS, materialById, newObject, setBoxType, useStore, type DesignObject,
} from '../lib/store';
import { PALETTES, TEMPLATES, applyTemplate } from '../lib/templates';
import { templateDesign, templateSwatch, useLibrary } from '../lib/library';
import { ColorIn, Field, Group, Icon, I, NumIn, Segmented, Slider, Swatches } from './ui';
import { NetThumb } from './Thumb';
import {
  dielineSVG, download, exportArtworkPNG, exportPrintPDF, exportProject, exportSpecSheet, isEmbedded, slug,
} from '../lib/exporters';
import type { BoxEngine } from '../three/engine';

const mmIn = (mm: number, u: 'mm' | 'in') => (u === 'mm' ? mm : mm / 25.4);

/* ============================ STRUCTURE ============================ */
export function StructurePanel() {
  const design = useStore((s) => s.design);
  const net = useStore((s) => s.net);
  const commit = useStore((s) => s.commit);
  const units = useStore((s) => s.view.units);
  const setView = useStore((s) => s.setView);
  const [qty, setQty] = useState(1000);

  const m = materialById(design.materialId);
  const met = useMemo(() => netMetrics(net, design.params, m.gsm), [net, design.params, m.gsm]);
  const type = boxTypeById(design.boxType);

  // simple converter-style quote model
  const boardCost = (met.boardArea / 10000) * (m.gsm / 1000) * 1.35; // $/blank material
  const printSetup = 420 + (design.objects.length > 0 ? 120 : 0);
  const dieCost = 380;
  const run = qty * (boardCost + 0.052);
  const unit = (run + printSetup + dieCost) / Math.max(1, qty);

  const setP = (k: 'L' | 'W' | 'H' | 'caliper' | 'glue' | 'bleed', v: number) =>
    commit((d) => { d.params[k] = v; }, `p${k}`);

  return (
    <>
      <Group title="Box style">
        <div className="stype">
          {BOX_TYPES.map((t) => (
            <button key={t.id} className={design.boxType === t.id ? 'on' : ''}
              onClick={() => setBoxType(t.id as BoxTypeId)} title={t.desc}>
              <NetThumb type={t.id} w={126} h={42} color={design.boxType === t.id ? '#ff5c39' : '#7c8698'} />
              <b>{t.name}</b>
              <span>{t.short}</span>
            </button>
          ))}
        </div>
        <p className="phint">{type.desc}</p>
      </Group>

      <Group title="Dimensions" right={
        <Segmented value={units} options={[{ v: 'mm', l: 'mm' }, { v: 'in', l: 'in' }]}
          onChange={(v) => setView({ units: v })} />
      }>
        <Slider label="Length (L)" value={design.params.L} min={20} max={600} step={1} unit=" mm" onChange={(v) => setP('L', v)} />
        <Slider label="Width / depth (W)" value={design.params.W} min={10} max={450} step={1} unit=" mm" onChange={(v) => setP('W', v)} />
        <Slider label="Height (H)" value={design.params.H} min={15} max={600} step={1} unit=" mm" onChange={(v) => setP('H', v)} />
        <div className="grid3">
          <NumIn label="L" value={design.params.L} min={20} max={600} onChange={(v) => setP('L', v)} />
          <NumIn label="W" value={design.params.W} min={10} max={450} onChange={(v) => setP('W', v)} />
          <NumIn label="H" value={design.params.H} min={15} max={600} onChange={(v) => setP('H', v)} />
        </div>
        {units === 'in' && (
          <p className="phint">
            {mmIn(design.params.L, 'in').toFixed(2)} × {mmIn(design.params.W, 'in').toFixed(2)} × {mmIn(design.params.H, 'in').toFixed(2)} in
          </p>
        )}
      </Group>

      <Group title="Die & print rules">
        <Slider label="Board caliper" value={design.params.caliper} min={0.2} max={4} step={0.05} unit=" mm" onChange={(v) => setP('caliper', v)} />
        <Slider label="Glue flap" value={design.params.glue} min={6} max={40} step={0.5} unit=" mm" onChange={(v) => setP('glue', v)} />
        <Slider label="Bleed" value={design.params.bleed} min={0} max={10} step={0.5} unit=" mm" onChange={(v) => setP('bleed', v)} />
      </Group>

      <Group title="Blank analysis">
        <div className="metric"><span>Flat sheet</span><b>{met.sheetW.toFixed(1)} × {met.sheetH.toFixed(1)} mm</b></div>
        <div className="metric"><span>Board used</span><b>{met.boardArea.toFixed(0)} cm²</b></div>
        <div className="metric"><span>Trim waste</span><b>{(met.waste * 100).toFixed(0)}%</b></div>
        <div className="metric"><span>Blank weight</span><b>{met.weight.toFixed(1)} g</b></div>
        <div className="metric"><span>Internal volume</span><b>{met.volumeL.toFixed(2)} L</b></div>
        <div className="metric"><span>Panels / creases</span><b>{met.panels} / {met.panels - 1}</b></div>
      </Group>

      <Group title="Instant quote">
        <Field label="Order quantity">
          <input className="inp" type="number" min={100} step={100} value={qty}
            onChange={(e) => setQty(Math.max(50, parseInt(e.target.value) || 50))} />
        </Field>
        <div className="quote-row"><span>Board & converting</span><b>${run.toFixed(0)}</b></div>
        <div className="quote-row"><span>Cutting die</span><b>${dieCost}</b></div>
        <div className="quote-row"><span>Print setup</span><b>${printSetup}</b></div>
        <div className="quote-row quote-total"><span>Unit price</span><b>${unit.toFixed(3)}</b></div>
        <p className="phint">Indicative litho-lam estimate. Real pricing depends on your converter, ink coverage and finishing.</p>
      </Group>
    </>
  );
}

/* ============================ DESIGN ============================ */
export function DesignPanel({ selectedPanel }: { selectedPanel: string | null }) {
  const design = useStore((s) => s.design);
  const net = useStore((s) => s.net);
  const commit = useStore((s) => s.commit);
  const addObject = useStore((s) => s.addObject);
  const loadDesign = useStore((s) => s.loadDesign);
  const mine = useLibrary((s) => s.items);
  const openSave = useLibrary((s) => s.openSave);
  const file = useRef<HTMLInputElement>(null);

  const panel = selectedPanel ? net.byId[selectedPanel] : null;
  const target = () => panel ?? net.byId['front'] ?? net.root;
  /** size new elements relative to the panel they land on */
  const place = (fw: number, fh: number) => {
    const p = target();
    const w = p.w * fw;
    const h = p.h * fh;
    return { x: p.x + (p.w - w) / 2, y: p.y + (p.h - h) / 2, w, h };
  };

  const add = (o: DesignObject) => addObject(o);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const p = panel ?? net.byId['front'] ?? net.root;
      const w = p.w * 0.6;
      add(newObject('image', {
        src: String(r.result), name: f.name.slice(0, 18),
        x: p.x + (p.w - w) / 2, y: p.y + p.h * 0.16, w, h: w * 0.75,
      }));
    };
    r.readAsDataURL(f);
  };

  return (
    <>
      <Group title="Add to artwork">
        <div className="grid2">
          <button className="ebtn" onClick={() => {
            const p = target();
            const size = Math.max(3, Math.min(16, p.w / 7));
            add(newObject('text', { ...place(0.84, 0), h: size * 1.5, y: p.y + p.h * 0.4, text: 'Your brand', size }));
          }}>
            <Icon d={I.text} size={13} /> Text
          </button>
          <button className="ebtn" onClick={() => file.current?.click()}>
            <Icon d={I.image} size={13} /> Image
          </button>
          <button className="ebtn" onClick={() => add(newObject('rect', place(0.6, 0.34)))}>
            <Icon d={I.square} size={13} /> Shape
          </button>
          <button className="ebtn" onClick={() => {
            const p = target();
            const d = Math.min(p.w, p.h) * 0.5;
            add(newObject('ellipse', { x: p.x + (p.w - d) / 2, y: p.y + (p.h - d) / 2, w: d, h: d, fill: '#3ddc97' }));
          }}>
            <Icon d={I.circle} size={13} /> Circle
          </button>
        </div>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <p className="phint">New elements land on the selected panel. Click a panel in the dieline to target it.</p>
      </Group>

      <Group title={panel ? `Panel fill · ${panel.label}` : 'Panel fill'}>
        {panel ? (
          <>
            <ColorIn value={design.panelFills[panel.id] ?? design.boardColor}
              onChange={(v) => commit((d) => { d.panelFills[panel.id] = v; }, 'pf')} allowNone />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="ebtn" onClick={() => commit((d) => {
                const c = d.panelFills[panel.id] ?? d.boardColor;
                for (const p of net.panels) if (p.kind === 'panel') d.panelFills[p.id] = c;
              })}>Apply to all panels</button>
              <button className="ebtn sq" title="Clear"
                onClick={() => commit((d) => { delete d.panelFills[panel.id]; })}><Icon d={I.x} size={13} /></button>
            </div>
          </>
        ) : <div className="empty">Click any panel on the dieline to colour it.</div>}
      </Group>

      <Group title="Board & liner">
        <ColorIn label="Outside base" value={design.boardColor} onChange={(v) => commit((d) => { d.boardColor = v; }, 'bc')} />
        <ColorIn label="Inside liner" value={design.innerColor} onChange={(v) => commit((d) => { d.innerColor = v; }, 'ic')} />
      </Group>

      <Group title="Palettes">
        {PALETTES.map((p) => (
          <div key={p.name} style={{ marginBottom: 10 }}>
            <div className="flabel"><span>{p.name}</span></div>
            <Swatches colors={p.colors} onPick={(c) => {
              if (panel) commit((d) => { d.panelFills[panel.id] = c; });
              else commit((d) => { d.boardColor = c; });
            }} />
          </div>
        ))}
      </Group>

      {!!mine.length && (
        <Group
          title="My templates"
          right={<button className="link-mini" onClick={() => openSave()}>Save current</button>}
        >
          <div className="tpl-mini">
            {mine.slice(0, 6).map((t) => (
              <button key={t.id} title={t.blurb || t.category} onClick={() => loadDesign(templateDesign(t))}>
                <div style={{ display: 'flex', height: 34 }}>
                  {(templateSwatch(t).length ? templateSwatch(t) : ['#2a3140']).map((c, i) => (
                    <div key={`${c}${i}`} style={{ flex: 1, background: c }} />
                  ))}
                </div>
                <b>{t.name}</b>
              </button>
            ))}
          </div>
        </Group>
      )}

      <Group
        title="Start from a template"
        right={mine.length ? undefined : <button className="link-mini" onClick={() => openSave()}>Save current</button>}
      >
        <div className="tpl-mini">
          {TEMPLATES.slice(0, 6).map((t) => (
            <button key={t.id} onClick={() => loadDesign(applyTemplate(t))}>
              <div style={{ display: 'flex', height: 34 }}>
                {t.swatch.map((c) => <div key={c} style={{ flex: 1, background: c }} />)}
              </div>
              <b>{t.name}</b>
            </button>
          ))}
        </div>
      </Group>
    </>
  );
}

/* ============================ MATERIAL ============================ */
export function MaterialPanel() {
  const design = useStore((s) => s.design);
  const commit = useStore((s) => s.commit);
  const m = materialById(design.materialId);
  return (
    <>
      <Group title="Substrate">
        {MATERIALS.map((x) => (
          <button key={x.id} className={`mat-card ${x.id === design.materialId ? 'on' : ''}`}
            onClick={() => commit((d) => {
              d.materialId = x.id;
              d.boardColor = x.color;
              d.innerColor = x.inner;
              d.params.caliper = x.caliper;
            })}>
            <div className="mat-chip" style={{ background: x.color }} />
            <div><b>{x.name}</b><span>{x.gsm} gsm · {x.caliper} mm</span></div>
          </button>
        ))}
        <p className="phint">{m.note}</p>
      </Group>

      <Group title="Finish">
        <Segmented value={design.scene.finish}
          options={[{ v: 'matte', l: 'Matte' }, { v: 'gloss', l: 'Gloss' }, { v: 'softTouch', l: 'Soft touch' }]}
          onChange={(v) => commit((d) => { d.scene.finish = v; })} />
        <p className="phint">
          {design.scene.finish === 'gloss' ? 'Gloss lamination adds a clear reflective coat — great for food and vivid colour.'
            : design.scene.finish === 'softTouch' ? 'Soft-touch film gives a velvet, low-glare surface used on premium beauty and tech cartons.'
              : 'Matte varnish: neutral diffuse surface, most forgiving for fingerprints.'}
        </p>
      </Group>

      <Group title="Print inside">
        <Segmented value={design.scene.showInner ? 'on' : 'off'}
          options={[{ v: 'on', l: 'Show liner' }, { v: 'off', l: 'Hide liner' }]}
          onChange={(v) => commit((d) => { d.scene.showInner = v === 'on'; })} />
        <div style={{ height: 10 }} />
        <ColorIn label="Liner colour" value={design.innerColor} onChange={(v) => commit((d) => { d.innerColor = v; }, 'ic')} />
      </Group>
    </>
  );
}

/* ============================ SCENE ============================ */
const BGS = ['#eceff3', '#ffffff', '#f4ece3', '#dfe7f2', '#1c1f26', '#0d0f14', '#e8e3f5', '#e6f0ea'];

export function ScenePanel() {
  const design = useStore((s) => s.design);
  const commit = useStore((s) => s.commit);
  return (
    <>
      <Group title="Lighting">
        <Segmented value={design.scene.studio}
          options={[{ v: 'softbox', l: 'Softbox' }, { v: 'contrast', l: 'Contrast' }, { v: 'warm', l: 'Warm' }, { v: 'cool', l: 'Cool' }]}
          onChange={(v) => commit((d) => { d.scene.studio = v; })} />
        <div style={{ height: 12 }} />
        <Segmented value={design.scene.shadow ? 'on' : 'off'}
          options={[{ v: 'on', l: 'Shadow on' }, { v: 'off', l: 'Shadow off' }]}
          onChange={(v) => commit((d) => { d.scene.shadow = v === 'on'; })} />
      </Group>
      <Group title="Backdrop">
        <div className="swatch-row" style={{ marginBottom: 10 }}>
          {BGS.map((c) => <button key={c} style={{ background: c }} onClick={() => commit((d) => { d.scene.bg = c; })} />)}
        </div>
        <ColorIn value={design.scene.bg} onChange={(v) => commit((d) => { d.scene.bg = v; }, 'bg')} />
      </Group>
      <Group title="Motion">
        <Slider label="Fold state" value={design.scene.fold} min={0} max={1} step={0.01} onChange={(v) => commit((d) => { d.scene.fold = v; }, 'fold')} />
        <Segmented value={design.scene.autoRotate ? 'on' : 'off'}
          options={[{ v: 'on', l: 'Auto spin' }, { v: 'off', l: 'Manual' }]}
          onChange={(v) => commit((d) => { d.scene.autoRotate = v === 'on'; })} />
        <p className="phint">Drag the 3D view to orbit, scroll to zoom. Use the fold slider to show the carton being erected.</p>
      </Group>
    </>
  );
}

/* ============================ EXPORT ============================ */
export function ExportPanel({ engine, toast }: { engine: React.MutableRefObject<BoxEngine | null>; toast: (s: string) => void }) {
  const design = useStore((s) => s.design);
  const net = useStore((s) => s.net);
  const loadDesign = useStore((s) => s.loadDesign);
  const openSaveTpl = useLibrary((s) => s.openSave);
  const [dpi, setDpi] = useState<'150' | '300' | '600'>('300');
  const [busy, setBusy] = useState('');
  const imp = useRef<HTMLInputElement>(null);

  const run = async (label: string, fn: () => Promise<void> | void) => {
    setBusy(label);
    try { await fn(); toast(`${label} exported`); }
    catch (e) { toast(`Export failed: ${(e as Error).message}`); }
    finally { setBusy(''); }
  };

  return (
    <>
      {isEmbedded && (
        <div className="pgroup notice">
          <strong>Downloads are blocked in the embedded preview.</strong>
          <span>This studio is running inside a sandboxed frame, so saved files never reach your disk. Open it in a real tab and every export below works.</span>
          <a className="ebtn" href={location.href} target="_blank" rel="noopener noreferrer">
            <Icon d={I.arrowR} size={13} /> Open studio in a new tab
          </a>
        </div>
      )}
      <Group title="Production files">
        <Field label="Raster resolution">
          <Segmented value={dpi} options={[{ v: '150', l: '150' }, { v: '300', l: '300' }, { v: '600', l: '600 dpi' }]} onChange={setDpi} />
        </Field>
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="ebtn" disabled={!!busy}
            onClick={() => run('SVG dieline', () => download(`${slug(design.name)}-dieline.svg`,
              new Blob([dielineSVG(net, design)], { type: 'image/svg+xml' })))}>
            <Icon d={I.file} size={13} /> Dieline SVG (cut + crease layers)
          </button>
          <button className="ebtn" disabled={!!busy}
            onClick={() => run('Print PDF', () => exportPrintPDF(design, net, { art: true, marks: true, dpi: parseInt(dpi) }))}>
            <Icon d={I.down} size={13} /> Print-ready PDF (artwork + marks)
          </button>
          <button className="ebtn" disabled={!!busy}
            onClick={() => run('Dieline PDF', () => exportPrintPDF(design, net, { art: false, marks: true }))}>
            <Icon d={I.ruler} size={13} /> Vector dieline PDF
          </button>
          <button className="ebtn" disabled={!!busy}
            onClick={() => run('Artwork PNG', () => exportArtworkPNG(design, net, parseInt(dpi)))}>
            <Icon d={I.image} size={13} /> Flat artwork PNG
          </button>
        </div>
      </Group>

      <Group title="Marketing renders">
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="ebtn" disabled={!!busy} onClick={() => run('3D render', () => {
            const url = engine.current?.snapshot(2, false);
            if (url) download(`${slug(design.name)}-render.png`, url);
          })}>
            <Icon d={I.camera} size={13} /> 3D render PNG (2×)
          </button>
          <button className="ebtn" disabled={!!busy} onClick={() => run('Transparent render', () => {
            const url = engine.current?.snapshot(2, true);
            if (url) download(`${slug(design.name)}-render-alpha.png`, url);
          })}>
            <Icon d={I.camera} size={13} /> Render with transparency
          </button>
          <button className="ebtn" disabled={!!busy} onClick={() => run('Spec sheet', async () => {
            const url = engine.current?.snapshot(1.5, false) ?? null;
            await exportSpecSheet(design, net, url);
          })}>
            <Icon d={I.file} size={13} /> Manufacturing spec sheet PDF
          </button>
        </div>
      </Group>

      <Group title="Project">
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="ebtn" onClick={() => run('Project', () => exportProject(design))}>
            <Icon d={I.down} size={13} /> Save .boxcraft.json
          </button>
          <button className="ebtn" onClick={() => imp.current?.click()}>
            <Icon d={I.copy} size={13} /> Open project file
          </button>
          <button className="ebtn" onClick={() => openSaveTpl()}>
            <Icon d={I.plus} size={13} /> Save to my templates
          </button>
          <input ref={imp} type="file" accept=".json,application/json" hidden onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => {
              try { loadDesign(JSON.parse(String(r.result))); toast('Project loaded'); }
              catch { toast('Could not read that file'); }
            };
            r.readAsText(f);
          }} />
        </div>
        <p className="phint">Files are generated entirely in your browser — nothing is uploaded.</p>
      </Group>
    </>
  );
}
