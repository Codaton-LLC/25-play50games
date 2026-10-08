// Moving instances: the per-frame matrix writer behind <DynamicInstanced> and
// <DynamicInstancedModel> (core/assets.tsx). Pure three.js (no React, no R3F), so it is tested in node.
//
// One update callback per copy, whatever the number of meshes: the caller writes where copy `index`
// stands into `matrix` (it arrives as the identity) and returns false to hide it this frame. Every
// mesh of the prop then draws that copy with its own piece transforms. Shown copies are packed to
// the front and `mesh.count` is set, so hidden pool slots cost nothing to draw. No allocation.
//
// Per-copy tint: `update` also gets a `color` (white on every call). Setting it (e.g.
// `color.copy(FLIGHT_COLOR[bag.flight])`) tints that copy: every piece's colour (the GLB's own, or
// the part's piece colour) is multiplied by it through instanceColor. A pool whose update never
// changes it writes no colours at all.
import { Color } from "three";
import type { BufferGeometry, InstancedMesh, Material, Matrix4 } from "three";

/**
 * Where copy `index` stands this frame: write its placement (its feet, like <Model position /
 * rotation / scale>) into `matrix`, e.g. `matrix.compose(position, quaternion, scale)` or
 * `spotMatrix(spot, matrix)`. Return false to hide the copy (an unused pool slot); returning
 * nothing draws it. Runs every frame: read your run state, do not allocate or call setState.
 */
export type InstanceUpdate = (index: number, matrix: Matrix4, color: Color) => boolean | void;

/**
 * One InstancedMesh of a moving prop: a geometry, its material(s) and the pieces it draws per copy
 * (e.g. a desk's top and legs share one box geometry and material: one mesh, five pieces, one draw
 * call for every desk). Build the array once (useMemo) and dispose of what you created yourself.
 */
export interface InstancePart {
   geometry: BufferGeometry;
   material: Material | Material[];
   /** each piece's transform inside one copy (origin = the copy's feet); default one piece at the origin */
   locals?: readonly Matrix4[] | null;
   /** one colour per piece (instanceColor), or nothing for the material's own colour */
   colors?: readonly Color[] | null;
}

/** A mesh the writer fills, with the pieces each copy draws in it (null/empty = one piece, no local transform). */
export interface InstanceTarget {
   mesh: InstancedMesh | null;
   locals?: readonly Matrix4[] | null;
   /** the part's piece colours (a tint multiplies them); none = white */
   colors?: readonly Color[] | null;
}

/**
 * The writer's tint scratch: the colour handed to `update`, a scratch for piece x tint, and whether
 * any copy was ever tinted (from then on every shown copy's colour is written each frame, so a slot
 * a tinted copy used never keeps a stale colour). One per pool (createInstanceTint).
 */
export interface InstanceTint {
   color: Color;
   piece: Color;
   on: boolean;
}

export function createInstanceTint(): InstanceTint {
   return { color: new Color(1, 1, 1), piece: new Color(1, 1, 1), on: false };
}

const isWhite = (c: Color) => c.r === 1 && c.g === 1 && c.b === 1;

/** Pieces per copy in a mesh. */
export function piecesOf(locals: readonly Matrix4[] | null | undefined): number {
   return locals && locals.length > 0 ? locals.length : 1;
}

/**
 * Calls `update` once for every copy 0..count-1 and writes each shown copy into every target
 * (packed: the k-th shown copy fills instances k * pieces .. k * pieces + pieces - 1), then sets
 * each mesh's `count` and flags its matrices for upload. Targets whose mesh is null are skipped,
 * but `update` still runs once per copy. `matrix` and `piece` are the caller's scratch matrices.
 * Returns the number of copies shown.
 */
export function writeDynamicInstances(
   targets: readonly InstanceTarget[],
   count: number,
   update: InstanceUpdate,
   matrix: Matrix4,
   piece: Matrix4,
   tint: InstanceTint = FALLBACK_TINT
): number {
   let shown = 0;
   const color = tint.color;
   for (let i = 0; i < count; i++) {
      matrix.identity();
      color.r = 1;
      color.g = 1;
      color.b = 1;
      if (update(i, matrix, color) === false) continue;
      if (!tint.on && !isWhite(color)) tint.on = true;
      if (tint.on) writeColors(targets, shown, color, tint.piece);
      for (let t = 0; t < targets.length; t++) {
         const target = targets[t];
         const mesh = target.mesh;
         if (!mesh) continue;
         const locals = target.locals;
         if (!locals || locals.length === 0) {
            mesh.setMatrixAt(shown, matrix);
            continue;
         }
         const n = locals.length;
         for (let j = 0; j < n; j++) mesh.setMatrixAt(shown * n + j, piece.multiplyMatrices(matrix, locals[j]));
      }
      shown += 1;
   }
   for (let t = 0; t < targets.length; t++) {
      const target = targets[t];
      const mesh = target.mesh;
      if (!mesh) continue;
      mesh.count = shown * piecesOf(target.locals);
      mesh.instanceMatrix.needsUpdate = true;
      if (tint.on && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
   }
   return shown;
}

/** Without a pool's own tint scratch (old callers): tints still work, sharing this one. */
const FALLBACK_TINT = createInstanceTint();

/** The shown copy `slot`'s colour in every target: each piece's colour times the tint. */
function writeColors(targets: readonly InstanceTarget[], slot: number, tint: Color, scratch: Color): void {
   for (let t = 0; t < targets.length; t++) {
      const target = targets[t];
      const mesh = target.mesh;
      if (!mesh) continue;
      const n = piecesOf(target.locals);
      const colors = target.colors;
      for (let j = 0; j < n; j++) {
         const base = colors && colors.length > 0 ? colors[j % colors.length] : null;
         mesh.setColorAt(slot * n + j, base ? scratch.copy(base).multiply(tint) : tint);
      }
   }
}
