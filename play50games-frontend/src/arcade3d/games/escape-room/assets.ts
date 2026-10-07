// Models for Tiny Escape Room. Plain data. Only urls in core/modelManifest.ts are fetched.
// Measured GLBs (w x h x d), longest side about 1.9, standing on y = 0:
//   desk 1.90 x 1.47 x 0.92, tabletop at y = 0.55
//   chair 1.21 x 1.90 x 1.24
//   battery 1.02 x 1.90 x 1.01
//   runner 1.90 x 1.886 x 0.52 (v2, T-pose: the arm span is the longest side; auto-rigged; faces +z)
//   group C (2026-10-07): key 1.90 x 0.25 x 0.91 (lying flat, bow at -x), book 0.70 x 1.90 x 1.30
//   (standing on its tail edge: red cover at -x, spine at +z), door 1.19 x 1.89 x 0.27 (a leaf in
//   its own thin casing, knob at -x)
// Station bodies are 1.2 x 1.4 and at most 1.4 tall; chairs are 0.8 x 0.8. Every GLB is fitted to
// the size its stand-in is authored at (Primitives.tsx), so look.test.ts's loot boxes and the door
// leaf hold for both; assets.test.ts measures the real GLBs. Fallbacks ignore scale.
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

const local = (id: string, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset => ({
   id,
   url: `/models/3d/escape-room/${id}.glb`,
   fallback,
   fallbackColor,
   budget: { ...PROP_BUDGET },
});

/**
 * The book lies flat. ModelAsset only turns about y, so Primitives.tsx draws it inside a group
 * turned a quarter about x (BOOK_LIE) at BOOK_DRAWN.y: rotationY first turns the cover to -z, then
 * that tips the cover up and the book's height along z. yOffset centres the height on the group.
 */
export const BOOK_LIE = Math.PI / 2;

/** Drawn loot sizes (x along the station, y up, z), as the stand-ins are authored: the GLBs match. */
export const KEY_DRAWN = { size: [0.28, 0.08, 0.12], y: 0.08 } as const;
export const BOOK_DRAWN = { size: [0.22, 0.08, 0.3], y: 0.06 } as const;
/** The door leaf: 1.4 x 2.0 x 0.12, its bottom on the floor, hinged at its -x edge. */
export const DOOR_LEAF = [1.4, 2, 0.12] as const;

type Vec3 = [number, number, number];
/**
 * The transforms Primitives.tsx draws with (spread as props, never mutated; assets.test.ts reads
 * them back from the drawn elements). The book's <Model> group lays the standing GLB flat at
 * BOOK_DRAWN.y; the stand-in box inside it is turned back, so it lies as authored.
 */
export const BOOK_GROUP: { position: Vec3; rotation: Vec3 } = { position: [0, BOOK_DRAWN.y, 0], rotation: [BOOK_LIE, 0, 0] };
export const BOOK_STAND_IN: { rotation: Vec3 } = { rotation: [-BOOK_LIE, 0, 0] };
/** The door: the hinge group (the scene swings it about y) on the leaf's -x edge, 0.08 in front of the frame, and the leaf (GLB or box) centred on it. */
export const DOOR_HINGE: { position: Vec3; leaf: Vec3 } = { position: [-DOOR_LEAF[0] / 2, 0, 0.08], leaf: [DOOR_LEAF[0] / 2, 0, 0] };

export const ASSETS = {
   // 0.744 draws the 1.886 runner 1.40 m tall: the README's visible height and the stand-in's.
   runner: { ...SHARED_ASSETS.runner, scale: 0.744 },
   // long side (model x, 1.90) runs along the station's z (1.4). Tabletop y 0.55 stays put;
   // height 1.47 is squeezed to the 1.4 cap. Model z (0.92) becomes the 1.2 body width.
   desk: {
      ...SHARED_ASSETS.desk,
      rotationY: Math.PI / 2,
      stretch: [1.4 / 1.9, 1.4 / 1.47, 1.2 / 0.92],
   },
   // footprint 0.8 x 0.8: the 1.24 depth is the widest horizontal side.
   chair: { ...SHARED_ASSETS.chair, scale: 0.8 / 1.24 },
   // a shelf pickup, not a 1.9 m prop. 0.32 tall.
   battery: { ...SHARED_ASSETS.battery, scale: 0.32 / 1.9 },
   // 0.28 x 0.08 x 0.12 lying flat, 0.04 up like the stand-in (thickened: a chunky toy key reads
   // from the room camera)
   key: { ...local("key", "box", "#eab308"), scale: 0.1476, stretch: [1, 2.13, 0.889], yOffset: 0.04 },
   // 0.22 (width) x 0.08 (thick) x 0.30 (tall) once lying (BOOK_LIE), red cover up
   book: { ...local("book", "box", "#b91c1c"), scale: 0.1583, stretch: [0.726, 1, 1.071], rotationY: -Math.PI / 2, yOffset: -0.15 },
   // the 1.4 x 2.0 x 0.12 leaf, turned round so the knob is at the free (+x) edge
   door: { ...local("door", "box", "#b45309"), scale: 1.0566, stretch: [1.113, 1, 0.424], rotationY: Math.PI },
} satisfies Record<string, ModelAsset>;

/** The character Scene.tsx draws (<HumanoidModel asset={RUNNER_ASSET}>): runner.glb 1.40 m tall. */
export const RUNNER_ASSET: ModelAsset = ASSETS.runner;
/** Its scale: the stride and the body lift are in world units through it. */
export const RUNNER_SCALE = RUNNER_ASSET.scale ?? 1;
