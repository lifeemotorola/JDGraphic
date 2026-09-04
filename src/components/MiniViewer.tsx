import { useEffect, useRef } from 'react';
import { BoxEngine } from '../three/engine';
import { buildNet } from '../lib/geometry';
import { materialById, type Design } from '../lib/store';
import { preloadAll, renderTexture } from '../lib/render2d';

/** Standalone 3D preview driven by a plain design object (used on the marketing site). */
export default function MiniViewer({ design, fold = 1, spin = true }: { design: Design; fold?: number; spin?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const eng = useRef<BoxEngine | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const e = new BoxEngine(host.current);
    eng.current = e;
    const ro = new ResizeObserver(() => e.resize());
    ro.observe(host.current);
    return () => { ro.disconnect(); e.dispose(); eng.current = null; };
  }, []);

  useEffect(() => {
    const e = eng.current;
    if (!e) return;
    const m = materialById(design.materialId);
    const net = buildNet(design.boxType, design.params);
    e.buildFromNet(net, design.params.caliper);
    e.setMaterial({ roughness: m.roughness, inner: design.innerColor, edge: m.inner, finish: design.scene.finish });
    e.setScene({ bg: design.scene.bg, studio: design.scene.studio, shadow: true, showInner: true });
    e.setAutoRotate(spin);
    e.setFold(fold, true);
    let dead = false;
    preloadAll(design).then(() => { if (!dead && eng.current) eng.current.setTexture(renderTexture(design, net, 7)); });
    return () => { dead = true; };
  }, [design, spin, fold]);

  useEffect(() => { eng.current?.setFold(fold); }, [fold]);

  return <div ref={host} style={{ position: 'absolute', inset: 0 }} />;
}
