import { useEffect, useRef } from 'react';
import { BoxEngine } from '../three/engine';
import { materialById, useStore } from '../lib/store';
import { renderTexture, preloadAll } from '../lib/render2d';
import { Icon, I } from './ui';

export default function Viewer3D({ engineRef }: { engineRef?: React.MutableRefObject<BoxEngine | null> }) {
  const host = useRef<HTMLDivElement>(null);
  const eng = useRef<BoxEngine | null>(null);
  const design = useStore((s) => s.design);
  const net = useStore((s) => s.net);
  const dirty = useStore((s) => s.dirty);
  const commit = useStore((s) => s.commit);

  useEffect(() => {
    if (!host.current) return;
    const e = new BoxEngine(host.current);
    eng.current = e;
    if (engineRef) engineRef.current = e;
    const ro = new ResizeObserver(() => e.resize());
    ro.observe(host.current);
    return () => { ro.disconnect(); e.dispose(); eng.current = null; };
  }, [engineRef]);

  // rebuild structure
  useEffect(() => {
    const m = materialById(design.materialId);
    eng.current?.buildFromNet(net, Math.max(design.params.caliper, m.id.includes('flute') ? m.caliper : design.params.caliper));
  }, [net, design.materialId, design.params.caliper]);

  // texture
  useEffect(() => {
    let cancel = false;
    const t = setTimeout(() => {
      preloadAll(design).then(() => {
        if (cancel || !eng.current) return;
        eng.current.setTexture(renderTexture(design, net, 7));
      });
    }, 90);
    return () => { cancel = true; clearTimeout(t); };
  }, [dirty, design, net]);

  // material + scene
  useEffect(() => {
    const m = materialById(design.materialId);
    eng.current?.setMaterial({
      roughness: m.roughness, inner: design.innerColor,
      edge: m.id.includes('flute') ? '#d9c7a6' : m.inner, finish: design.scene.finish,
    });
    eng.current?.setScene({
      bg: design.scene.bg, studio: design.scene.studio,
      shadow: design.scene.shadow, showInner: design.scene.showInner,
    });
  }, [design.materialId, design.innerColor, design.scene, dirty]);

  useEffect(() => { eng.current?.setFold(design.scene.fold); }, [design.scene.fold]);
  useEffect(() => { eng.current?.setAutoRotate(design.scene.autoRotate); }, [design.scene.autoRotate]);

  const setFold = (v: number) => commit((d) => { d.scene.fold = v; }, 'fold');
  const animate = () => {
    const target = design.scene.fold > 0.5 ? 0 : 1;
    commit((d) => { d.scene.fold = target; });
  };

  return (
    <div className="pane pane3d" style={{ background: design.scene.bg }}>
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      <div className="pane-label">3D preview</div>
      <div className="overlay-tools">
        <button className="otool" onClick={() => eng.current?.setViewAngle('front')}>Front</button>
        <button className="otool" onClick={() => eng.current?.setViewAngle('threeq')}>3/4</button>
        <button className="otool" onClick={() => eng.current?.setViewAngle('top')}>Top</button>
        <button className={`otool ${design.scene.autoRotate ? 'on' : ''}`}
          onClick={() => commit((d) => { d.scene.autoRotate = !d.scene.autoRotate; })}>
          <Icon d={I.reset} size={12} /> Spin
        </button>
      </div>
      <div className="foldbar">
        <button className="otool" onClick={animate} title="Fold / unfold">
          <Icon d={design.scene.fold > 0.5 ? I.pause : I.play} size={12} />
        </button>
        <span>FOLD</span>
        <input type="range" min={0} max={1} step={0.01} value={design.scene.fold}
          onChange={(e) => setFold(parseFloat(e.target.value))} />
        <span>{Math.round(design.scene.fold * 100)}%</span>
      </div>
    </div>
  );
}
