import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { TEMPLATES, applyTemplate } from '../lib/templates';
import { boxTypeById } from '../lib/geometry';
import type { BoxEngine } from '../three/engine';
import Viewer3D from '../components/Viewer3D';
import Dieline2D from '../components/Dieline2D';
import Inspector from '../components/Inspector';
import { DesignPanel, ExportPanel, MaterialPanel, ScenePanel, StructurePanel } from '../components/Panels';
import { BoxThumb } from '../components/Thumb';
import { Icon, I } from '../components/ui';

type Tab = 'structure' | 'design' | 'material' | 'scene' | 'export';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'structure', label: 'Box', icon: I.cube },
  { id: 'design', label: 'Art', icon: I.brush },
  { id: 'material', label: 'Board', icon: I.swatch },
  { id: 'scene', label: 'Scene', icon: I.camera },
  { id: 'export', label: 'Export', icon: I.down },
];

export default function Editor({ nav }: { nav: (p: string) => void }) {
  const design = useStore((s) => s.design);
  const commit = useStore((s) => s.commit);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const past = useStore((s) => s.past.length);
  const future = useStore((s) => s.future.length);
  const selection = useStore((s) => s.selection);
  const remove = useStore((s) => s.removeObjects);
  const dup = useStore((s) => s.duplicate);
  const update = useStore((s) => s.updateObject);
  const loadDesign = useStore((s) => s.loadDesign);

  const engine = useRef<BoxEngine | null>(null);
  const [mode, setMode] = useState<'3d' | 'split' | 'die'>('split');
  const [panelSel, setPanelSel] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [tplOpen, setTplOpen] = useState(false);
  /** on narrow viewports the side panels become slide-over drawers */
  const [drawer, setDrawer] = useState<'tools' | 'layers' | null>(null);
  const [tplCat, setTplCat] = useState('All');
  const tplCats = ['All', ...Array.from(new Set(TEMPLATES.map((t) => t.category)))];
  const tplList = tplCat === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.category === tplCat);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (meta && e.key.toLowerCase() === 'd') { e.preventDefault(); if (selection.length) dup(selection); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length) { e.preventDefault(); remove(selection); }
      else if (e.key.startsWith('Arrow') && selection.length) {
        e.preventDefault();
        const d = e.shiftKey ? 5 : 0.5;
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
        const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
        for (const id of selection) {
          const o = design.objects.find((x) => x.id === id);
          if (o) update(id, { x: o.x + dx, y: o.y + dy }, 'nudge');
        }
      }
    };
    addEventListener('keydown', h);
    return () => removeEventListener('keydown', h);
  }, [selection, design.objects, undo, redo, dup, remove, update]);

  return (
    <div className="editor">
      <div className="ebar">
        <a className="logo" href="#/" onClick={(e) => { e.preventDefault(); nav('/'); }}>
          <span className="logo-mark"><Icon d={I.box} size={15} /></span> BoxCraft
        </a>
        <input className="name-in" value={design.name}
          onChange={(e) => commit((d) => { d.name = e.target.value; }, 'name')} />
        <button className="ebtn sq" disabled={!past} onClick={undo} title="Undo (⌘Z)"><Icon d={I.undo} size={14} /></button>
        <button className="ebtn sq" disabled={!future} onClick={redo} title="Redo (⇧⌘Z)"><Icon d={I.redo} size={14} /></button>
        <button className="ebtn" onClick={() => setTplOpen(true)}><Icon d={I.sparkle} size={13} /> Templates</button>

        <div className="spacer" />

        <div className="seg" style={{ width: 210 }}>
          {(['3d', 'split', 'die'] as const).map((m) => (
            <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {m === '3d' ? '3D' : m === 'split' ? 'Split' : 'Dieline'}
            </button>
          ))}
        </div>
        <button className={`ebtn wide ${view.showBleed ? 'on' : ''}`} onClick={() => setView({ showBleed: !view.showBleed })}>Bleed</button>
        <button className={`ebtn wide ${view.showSafe ? 'on' : ''}`} onClick={() => setView({ showSafe: !view.showSafe })}>Safe area</button>
        <button className="ebtn sq only-narrow" title="Layers" onClick={() => setDrawer(drawer === 'layers' ? null : 'layers')}>
          <Icon d={I.layers} size={14} />
        </button>
        <button className="ebtn pri" onClick={() => { setView({ tab: 'export' }); setDrawer('tools'); }}>
          <Icon d={I.down} size={13} /> Export
        </button>
      </div>

      <div className="ebody">
        <div className="rail">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={view.tab === t.id && drawer !== 'layers' ? 'on' : ''}
              title={t.label}
              onClick={() => {
                // narrow: tapping the active tab again closes the drawer
                setDrawer((d) => (d === 'tools' && view.tab === t.id ? null : 'tools'));
                setView({ tab: t.id });
              }}
            >
              <Icon d={t.icon} size={17} />{t.label}
            </button>
          ))}
        </div>

        <div className={`panel${drawer === 'tools' ? ' open' : ''}`}>
          <div className="drawer-h">
            <span>{TABS.find((t) => t.id === view.tab)?.label}</span>
            <button className="ebtn sq" onClick={() => setDrawer(null)}><Icon d={I.x} size={14} /></button>
          </div>
          {view.tab === 'structure' && <StructurePanel />}
          {view.tab === 'design' && <DesignPanel selectedPanel={panelSel} />}
          {view.tab === 'material' && <MaterialPanel />}
          {view.tab === 'scene' && <ScenePanel />}
          {view.tab === 'export' && <ExportPanel engine={engine} toast={say} />}
        </div>

        <div className="stagewrap">
          <div className="canvases">
            {mode !== 'die' && <Viewer3D engineRef={engine} />}
            {mode !== '3d' && <Dieline2D selectedPanel={panelSel} onSelectPanel={setPanelSel} />}
          </div>
        </div>

        <Inspector open={drawer === 'layers'} />

        {drawer && <div className="drawer-bg" onClick={() => setDrawer(null)} />}
      </div>

      {toast && <div className="toast">{toast}</div>}

      {tplOpen && (
        <div className="modal-bg" onClick={() => setTplOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>Start from a template</h3>
              <span style={{ color: 'var(--txt-3)', fontSize: 13 }}>{TEMPLATES.length} starting points — structure, colour and copy all stay editable.</span>
              <div className="spacer" />
              <button className="ebtn sq" onClick={() => setTplOpen(false)}><Icon d={I.x} size={14} /></button>
            </div>
            <div className="modal-cats">
              {tplCats.map((c) => (
                <button key={c} className={`chip-btn${tplCat === c ? ' on' : ''}`} onClick={() => setTplCat(c)}>
                  {c}
                  <em>{c === 'All' ? TEMPLATES.length : TEMPLATES.filter((t) => t.category === c).length}</em>
                </button>
              ))}
            </div>
            <div className="modal-b">
              <div className="tpl-grid">
                {tplList.map((t) => (
                  <button key={t.id} onClick={() => { loadDesign(applyTemplate(t)); setTplOpen(false); say(`${t.name} loaded`); }}>
                    <BoxThumb design={applyTemplate(t)} h={132} bg="#e9edf3" />
                    <div className="tb">
                      <b>{t.name}</b>
                      <span>{t.blurb}</span>
                      <div className="tb-meta">
                        <span className="tb-tag">{boxTypeById(t.boxType).short}</span>
                        <span>{t.dims.join(' × ')} mm</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
