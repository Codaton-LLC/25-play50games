// Off-screen litter hints (README "Scene and camera", "Phones"): where the edge arrows stand on the
// screen. Pure 2D math in canvas CSS px (x right, y down), no three.js, no allocation: LitterHints.tsx
// projects the litter and the cleaner with the live camera and calls these every frame; hints.test.ts
// checks them at the phone viewports.
import type { ScreenRect } from "@/arcade3d/core/view";

/** The most arrows shown at once: the nearest off-screen pieces. */
export const MAX_HINTS = 3;
/** Arrow length (CSS px) of the nearest piece's arrow; the others are drawn at HINT_FAR_SCALE of it. */
export const HINT_PX = 26;
export const HINT_FAR_SCALE = 0.8;
/** The arrows' centres stay this far inside the canvas edges, so a whole arrow (and its outline) shows. */
export const HINT_INSET = 22;
/** Air (CSS px) between an arrow's centre and a HUD panel, a touch control or the cookie banner. */
export const HINT_CLEARANCE = 20;
/** Arrows closer than this (CSS px, centre to centre) would overlap: the farther piece's is dropped. */
export const HINT_SPACING = 30;
/** A piece counts as on screen when its middle is this far inside the canvas edges and under no panel. */
export const VIEW_INSET = 6;

export interface Point2 {
   x: number;
   y: number;
}

/** `rect` shrunk by `inset` on every side, written into `out`. */
export function insetRect(width: number, height: number, inset: number, out: ScreenRect): ScreenRect {
   out.left = inset;
   out.top = inset;
   out.right = width - inset;
   out.bottom = height - inset;
   return out;
}

const inside = (x: number, y: number, r: ScreenRect, pad: number): boolean =>
   x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;

/**
 * Is a projected point on screen: in front of the camera (`depth` = NDC z in -1..1), inside `view`
 * and under none of `covers` (the HUD, the touch controls, the cookie banner)?
 */
export function onScreen(x: number, y: number, depth: number, view: ScreenRect, covers: readonly ScreenRect[]): boolean {
   if (!(depth > -1 && depth < 1)) return false;
   if (x < view.left || x > view.right || y < view.top || y > view.bottom) return false;
   for (let i = 0; i < covers.length; i++) if (inside(x, y, covers[i], 0)) return false;
   return true;
}

/**
 * Where a ray from (x, y) along (dx, dy) leaves `inner` (the start is first clamped into it).
 * A zero direction leaves the (clamped) start. Writes into `out`.
 */
export function edgePoint(x: number, y: number, dx: number, dy: number, inner: ScreenRect, out: Point2): Point2 {
   const sx = x < inner.left ? inner.left : x > inner.right ? inner.right : x;
   const sy = y < inner.top ? inner.top : y > inner.bottom ? inner.bottom : y;
   let t = Infinity;
   if (dx > 0) t = Math.min(t, (inner.right - sx) / dx);
   else if (dx < 0) t = Math.min(t, (inner.left - sx) / dx);
   if (dy > 0) t = Math.min(t, (inner.bottom - sy) / dy);
   else if (dy < 0) t = Math.min(t, (inner.top - sy) / dy);
   if (!Number.isFinite(t)) t = 0;
   out.x = sx + dx * t;
   out.y = sy + dy * t;
   return out;
}

/** Is (x, y) at least `pad` from every rect of `covers` (touching that distance counts as clear)? */
function clearAt(x: number, y: number, covers: readonly ScreenRect[], pad: number): boolean {
   for (let i = 0; i < covers.length; i++) if (inside(x, y, covers[i], pad)) return false;
   return true;
}

/**
 * Moves `p` the shortest distance that puts it `pad` clear of every rect of `covers` while it stays
 * inside `inner`. The candidates: each x of `p` or a rect's side (grown by `pad`) with each y of `p`
 * or a rect's top or bottom, so a move out of one panel never lands under another (the arrow at the
 * bottom edge under the banner goes up past it, and past the joystick lifted above it). No move when
 * `p` is already clear. Returns false (and leaves `p`) if no candidate is clear.
 */
export function clearOfRects(p: Point2, covers: readonly ScreenRect[], pad: number, inner: ScreenRect): boolean {
   if (clearAt(p.x, p.y, covers, pad)) return true;
   const n = covers.length;
   let best = Infinity;
   let bx = p.x;
   let by = p.y;
   for (let i = -1; i < 2 * n; i++) {
      const cx = i < 0 ? p.x : i % 2 === 0 ? covers[i >> 1].left - pad : covers[i >> 1].right + pad;
      if (cx < inner.left || cx > inner.right) continue;
      for (let j = -1; j < 2 * n; j++) {
         const cy = j < 0 ? p.y : j % 2 === 0 ? covers[j >> 1].top - pad : covers[j >> 1].bottom + pad;
         if (cy < inner.top || cy > inner.bottom) continue;
         const d = (cx - p.x) * (cx - p.x) + (cy - p.y) * (cy - p.y);
         if (d >= best || !clearAt(cx, cy, covers, pad)) continue;
         best = d;
         bx = cx;
         by = cy;
      }
   }
   if (best === Infinity) return false;
   p.x = bx;
   p.y = by;
   return true;
}

/** Height of a litter piece's middle and of the cleaner's middle, for the projections. */
export const PIECE_MID = 0.4;
export const RUNNER_MID = 0.5;
/** The direction towards a piece is taken this far along the floor from the cleaner (always in front of the camera). */
export const AIM_STEP = 2;

/** Writes the screen point (CSS px) of a world point into `out` and returns its NDC depth (-1..1 in front of the camera). */
export type Projector = (x: number, y: number, z: number, out: Point2) => number;

/** The arrows of this frame: `count` of them, nearest first, at (x, y) pointing at `angle` (radians, counter-clockwise from screen right). */
export interface HintState {
   count: number;
   slot: Int32Array;
   dist: Float64Array;
   x: Float64Array;
   y: Float64Array;
   angle: Float64Array;
}

export function createHintState(): HintState {
   return {
      count: 0,
      slot: new Int32Array(MAX_HINTS),
      dist: new Float64Array(MAX_HINTS),
      x: new Float64Array(MAX_HINTS),
      y: new Float64Array(MAX_HINTS),
      angle: new Float64Array(MAX_HINTS),
   };
}

const VIEW_RECT: ScreenRect = { left: 0, top: 0, right: 0, bottom: 0 };
const INNER_RECT: ScreenRect = { left: 0, top: 0, right: 0, bottom: 0 };
const AT: Point2 = { x: 0, y: 0 };
const FROM: Point2 = { x: 0, y: 0 };

/**
 * This frame's arrows: the MAX_HINTS nearest active pieces (world distance to the cleaner) that are
 * not on screen, each where the line from the cleaner towards it meets the screen's edge (HINT_INSET
 * in), moved out from under `covers` (the HUD, the touch controls, the banner). An arrow that fits
 * nowhere, or lands within HINT_SPACING of a nearer piece's arrow, is dropped. Allocation-free.
 * Returns the count (also in `state.count`).
 */
export function updateHints(
   state: HintState,
   runner: { x: number; z: number },
   litter: readonly { x: number; z: number; active: boolean }[],
   project: Projector,
   width: number,
   height: number,
   covers: readonly ScreenRect[]
): number {
   state.count = 0;
   if (width <= 0 || height <= 0) return 0;
   insetRect(width, height, VIEW_INSET, VIEW_RECT);
   insetRect(width, height, HINT_INSET, INNER_RECT);
   let count = 0;
   for (let s = 0; s < litter.length; s++) {
      const piece = litter[s];
      if (!piece.active) continue;
      const depth = project(piece.x, PIECE_MID, piece.z, AT);
      if (onScreen(AT.x, AT.y, depth, VIEW_RECT, covers)) continue;
      count = keepNearest(state.slot, state.dist, count, s, Math.hypot(piece.x - runner.x, piece.z - runner.z));
   }
   project(runner.x, RUNNER_MID, runner.z, FROM);
   let shown = 0;
   for (let i = 0; i < count; i++) {
      const piece = litter[state.slot[i]];
      const d = state.dist[i];
      const k = d > AIM_STEP ? AIM_STEP / d : 1;
      project(runner.x + (piece.x - runner.x) * k, RUNNER_MID, runner.z + (piece.z - runner.z) * k, AT);
      let dx = AT.x - FROM.x;
      let dy = AT.y - FROM.y;
      if (Math.hypot(dx, dy) < 1e-6) {
         // straight along the view: the floor direction (yaw 0: +x right, +z down the screen)
         dx = piece.x - runner.x;
         dy = piece.z - runner.z;
      }
      edgePoint(FROM.x, FROM.y, dx, dy, INNER_RECT, AT);
      if (!clearOfRects(AT, covers, HINT_CLEARANCE, INNER_RECT)) continue;
      // two pieces the same way (often both pushed into the same corner past a panel): one arrow
      let overlaps = false;
      for (let j = 0; j < shown; j++) if (Math.hypot(state.x[j] - AT.x, state.y[j] - AT.y) < HINT_SPACING) overlaps = true;
      if (overlaps) continue;
      state.slot[shown] = state.slot[i];
      state.dist[shown] = d;
      state.x[shown] = AT.x;
      state.y[shown] = AT.y;
      state.angle[shown] = Math.atan2(-dy, dx);
      shown++;
   }
   state.count = shown;
   return shown;
}

/**
 * Inserts piece `slot` at world distance `dist` into the `count` nearest kept so far (sorted, at most
 * `slots.length`). Returns the new count.
 */
export function keepNearest(slots: Int32Array, dists: Float64Array, count: number, slot: number, dist: number): number {
   const cap = slots.length;
   let i = count < cap ? count : cap - 1;
   if (count >= cap && dist >= dists[cap - 1]) return count;
   while (i > 0 && dists[i - 1] > dist) {
      slots[i] = slots[i - 1];
      dists[i] = dists[i - 1];
      i--;
   }
   slots[i] = slot;
   dists[i] = dist;
   return count < cap ? count + 1 : cap;
}
