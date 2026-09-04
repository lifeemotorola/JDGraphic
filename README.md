# BoxCraft

A browser-based packaging design studio — the Pacdora idea, rebuilt as a single
parametric engine: **type three dimensions, get a manufacturable folding carton.**

One net tree drives everything. The same geometry that draws the dieline supplies
the UV map for the artboard and the hinge hierarchy for the 3D fold, so the flat,
the render and the print files can never drift apart.

## What it does

| | |
|---|---|
| **21 templates** | Beauty, food & bev, tech, e-commerce, health, kids, pet, home, media, outdoor and premium starting points, filterable by category in the studio |
| **7 structures** | Straight/Reverse Tuck End, Seal End, Regular Slotted Carton, Roll End Mailer, Sleeve, Open Tray |
| **Parametric dielines** | Cut / crease / bleed / safe-area generated from L × W × H, caliper and glue-flap width |
| **Artwork editor** | Text, images, rectangles, ellipses and rules on the flat, with panel snapping, per-panel fills and a layer inspector |
| **Real-time 3D** | Panel-by-panel fold animation (0–100 %), orbit, board substrates, finishes, studio lighting and shadows |
| **Exports** | Layered dieline SVG, print-ready PDF (bleed + registration marks), vector dieline PDF, 300 dpi flat artwork PNG, transparent 2× render PNG, `.boxcraft.json` project |
| **Manufacturing spec sheet** | One-page PDF: structure, board, flat sheet size, board area and waste, blank weight, internal volume, bleed/glue, plus dieline and render thumbnails |
| **Estimator** | Board area, waste percentage, blank weight and internal volume update live with the geometry |

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint
```

## How the engine works

**`src/lib/geometry.ts`** — the net builder. A structure is a list of `PanelSpec`s
(`id`, `w`, `h`, `parent`, `hinge`, `angle`, `kind`, `shape`, `seq`). `buildNet`
resolves them into a tree with absolute flat coordinates and outlines. Flat space
is millimetres, y-down; a panel is laid out from its hinge:

| hinge | flat position |
|---|---|
| `right` | `(px + pw, py)` |
| `left` | `(px - cw, py)` |
| `top` | `(px, py - ch)` |
| `bottom` | `(px, py + ph)` |

**`src/three/engine.ts`** — the folder. Each panel becomes a `THREE.Group` pivoted
on its crease. A child's local origin is expressed **in its parent's frame**
(`xOff`/`yOff` inherit down the tree), which is what keeps a flap hanging off a
left-hinged wall from landing mirrored on the far side of the box. Folding is
`rotation.y = ±a` for left/right creases and `rotation.x = ∓a` for top/bottom,
sequenced by `seq` so dust flaps close before the lid. Panels are offset along
their own normal by an assembly `layer` (tucks and glue flaps negative, i.e.
*inside* the wall they meet; dust flaps then lids stacking outward) so nothing
z-fights and the tuck really does disappear into the carton. Base-rooted
structures (mailer, tray) tilt flat as they close instead of standing on edge.

**`src/lib/render2d.ts`** — bakes the artboard to a single canvas texture that both
the dieline view and the 3D model sample, using `u = (x - minX)/W`, `v = 1 - (y - minY)/H`.

## Project layout

```
src/
  lib/        geometry.ts  store.ts  render2d.ts  exporters.ts  templates.ts
  three/      engine.ts            vanilla three.js renderer + fold rig
  components/ Viewer3D  Dieline2D  Panels  Inspector  MiniViewer  Thumb  ui
  pages/      Home.tsx  Editor.tsx
```

State is a single zustand store with `commit(fn, coalesceKey)` for undo/redo —
drags coalesce into one history entry.

## Troubleshooting

**Nothing in the UI responds / the page is blank.** The dev server needs
`node_modules`, and dependency folders are not kept in workspace snapshots. Run
`npm install && npm run dev` and it comes straight back.

**Exports do nothing.** Sandboxed preview frames block file downloads. The Export
tab detects this and offers an *Open studio in a new tab* button — every export
works in a real tab.

**Narrow window.** Below 900 px the two side panels become slide-over drawers:
tap a rail icon to open, tap it again (or the ✕, or the dimmed stage) to close.
The layers icon in the top bar opens the inspector.

## Notes

- No backend. Everything renders and exports in the browser.
- No external fonts or assets: system font stacks and a procedural studio
  environment map, so it works offline and inside sandboxed previews.
- `shot.mjs` is a small Playwright screenshotter used during development.

## Deliberately out of scope

MP4/GIF turntables, pillow/gable/rigid boxes, true auto-bottom geometry, and any
"AI" claim that isn't actually doing inference.
