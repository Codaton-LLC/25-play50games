// The shared camera's maths (pure, no three.js): one camera that keeps every active hero framed,
// and the split-screen viewports.
//
// fitView (core/view.ts) is too heavy for every frame, but a perspective picture scales exactly:
// a box k times larger, seen from a camera k times farther along the same direction, projects to
// the same picture. So SharedCamera fits ONE reference cube (REF_SPAN, its floor centre at the
// origin) with useFittedView when the canvas or the safe area changes, and every frame only scales
// that offset by span / REF_SPAN around the heroes' frame (frameHeroes).
//
// Zoom limit: the frame never grows past maxSpan. When the heroes are spread wider than that, the
// frame stays on the anchor (the leader in a race, or the group's centre) and the heroes it cannot
// hold are reported in `inView` (false), so the game can show an arrow or pull them back.
import type { AABB, Vec3Like } from "@/arcade3d/core/collision";

/** Side of the reference cube SharedCamera fits (m). */
export const REF_SPAN = 10;
/** The reference cube: x/z centred on 0, the floor at y = 0 (fitView's default focus is its floor centre). */
export const REF_BOX: AABB = {
   min: { x: -REF_SPAN / 2, y: 0, z: -REF_SPAN / 2 },
   max: { x: REF_SPAN / 2, y: REF_SPAN, z: REF_SPAN / 2 },
};

export interface FramingOptions {
   /** the smallest frame (m): one hero alone is never framed tighter. Default 6 */
   minSpan?: number;
   /** the zoom limit (m): the frame never grows past this. Default 24 */
   maxSpan?: number;
   /** air around the heroes (m) on every side. Default 1.5 */
   padding?: number;
   /** height of a hero above its feet (m), so the head stays in. Default 1.5 */
   heroHeight?: number;
   /** whom the frame keeps when the heroes are spread past maxSpan: "centroid" or a hero index. Default "centroid" */
   anchor?: "centroid" | number;
}

export interface Framing {
   /** the frame cube: x/z centre and the floor (feet level) */
   x: number;
   y: number;
   z: number;
   /** side of the frame cube (m), within [minSpan, maxSpan] */
   span: number;
   /** the heroes did not fit and the zoom limit held */
   clamped: boolean;
   /** per point: inside the frame (false = off screen, or not active) */
   inView: boolean[];
   /** how many active points there were */
   count: number;
}

export function createFraming(): Framing {
   return { x: 0, y: 0, z: 0, span: 0, clamped: false, inView: [], count: 0 };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The cube that frames the active points (feet positions). `active[i] === false` leaves a point out
 * (finished and parked, dropped). With no active point the previous framing is kept as it is.
 */
export function frameHeroes(points: readonly Vec3Like[], active: readonly boolean[] | undefined, options: FramingOptions = {}, out: Framing = createFraming()): Framing {
   const minSpan = options.minSpan ?? 6;
   const maxSpan = Math.max(minSpan, options.maxSpan ?? 24);
   const pad = options.padding ?? 1.5;
   const tall = options.heroHeight ?? 1.5;
   let minX = Infinity;
   let maxX = -Infinity;
   let minY = Infinity;
   let maxY = -Infinity;
   let minZ = Infinity;
   let maxZ = -Infinity;
   let sx = 0;
   let sy = 0;
   let sz = 0;
   let count = 0;
   out.inView.length = points.length;
   for (let i = 0; i < points.length; i++) {
      out.inView[i] = false;
      if (active?.[i] === false) continue;
      const p = points[i];
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) continue;
      count++;
      sx += p.x;
      sy += p.y;
      sz += p.z;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y + tall > maxY) maxY = p.y + tall;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
   }
   out.count = count;
   if (count === 0) return out;
   const need = Math.max(maxX - minX, maxY - minY, maxZ - minZ) + 2 * pad;
   const span = clamp(need, minSpan, maxSpan);
   let cx = (minX + maxX) / 2;
   let cz = (minZ + maxZ) / 2;
   // vertically the cube stands on the lowest feet, or centres the heroes' height range when it is roomier
   let fy = minY - pad;
   if (maxY - minY + 2 * pad < span) fy = (minY + maxY) / 2 - span / 2;
   out.clamped = need > maxSpan;
   if (out.clamped) {
      const anchor = options.anchor ?? "centroid";
      const a: Vec3Like =
         typeof anchor === "number" && points[anchor] && active?.[anchor] !== false
            ? points[anchor]
            : { x: sx / count, y: sy / count, z: sz / count };
      // the frame moves towards the group's centre as far as it can while it still holds the anchor
      const room = span / 2 - pad;
      cx = clamp(cx, a.x - room, a.x + room);
      cz = clamp(cz, a.z - room, a.z + room);
      fy = clamp(fy, a.y + tall + pad - span, a.y - pad);
   }
   out.x = cx;
   out.y = fy;
   out.z = cz;
   out.span = span;
   const h = span / 2;
   for (let i = 0; i < points.length; i++) {
      if (active?.[i] === false) continue;
      const p = points[i];
      out.inView[i] = Math.abs(p.x - cx) <= h && Math.abs(p.z - cz) <= h && p.y >= fy && p.y + tall <= fy + span;
   }
   return out;
}

export interface CameraPose {
   px: number;
   py: number;
   pz: number;
   lx: number;
   ly: number;
   lz: number;
}

/**
 * The camera for a framing: the reference fit's offset (useFittedView over REF_BOX) scaled by
 * span / REF_SPAN from the frame's floor centre, looking at that point (fitView's focus).
 */
export function sharedCameraPose(framing: Framing, refOffset: readonly [number, number, number], out: CameraPose): CameraPose {
   const k = framing.span / REF_SPAN;
   out.lx = framing.x;
   out.ly = framing.y;
   out.lz = framing.z;
   out.px = framing.x + refOffset[0] * k;
   out.py = framing.y + refOffset[1] * k;
   out.pz = framing.z + refOffset[2] * k;
   return out;
}

/** A viewport in CSS px from the canvas's top-left corner. */
export interface Viewport {
   left: number;
   top: number;
   width: number;
   height: number;
}

/**
 * Split-screen viewports: 1 = the whole canvas; 2 = side by side on a landscape canvas, stacked on
 * a portrait one; 3-4 = a 2 x 2 grid (with 3, the fourth cell stays empty). `gap` px between them.
 */
export function splitViewports(count: number, width: number, height: number, gap = 4): Viewport[] {
   const n = clamp(Math.floor(count), 1, 4);
   const w = Math.max(1, width);
   const h = Math.max(1, height);
   if (n === 1) return [{ left: 0, top: 0, width: w, height: h }];
   if (n === 2) {
      if (w >= h) {
         const cw = (w - gap) / 2;
         return [
            { left: 0, top: 0, width: cw, height: h },
            { left: cw + gap, top: 0, width: cw, height: h },
         ];
      }
      const ch = (h - gap) / 2;
      return [
         { left: 0, top: 0, width: w, height: ch },
         { left: 0, top: ch + gap, width: w, height: ch },
      ];
   }
   const cw = (w - gap) / 2;
   const ch = (h - gap) / 2;
   const cells: Viewport[] = [
      { left: 0, top: 0, width: cw, height: ch },
      { left: cw + gap, top: 0, width: cw, height: ch },
      { left: 0, top: ch + gap, width: cw, height: ch },
      { left: cw + gap, top: ch + gap, width: cw, height: ch },
   ];
   return cells.slice(0, n);
}
