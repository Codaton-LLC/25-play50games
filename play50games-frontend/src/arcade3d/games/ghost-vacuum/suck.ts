// Visual-only "sucked into the nozzle" look of a pulling ghost. The rules keep their own
// pull path (capture at the hunter centre at p = 1); this maps that logical position and
// the posed nozzle mouth to where the ghost is DRAWN: kept in front of the nozzle, outside
// the hunter's body, shrinking to SUCK.endScale and stretched towards the mouth, ending
// exactly at the mouth at p = 1. Pure and allocation-free (out parameters).

/**
 * The floating ghost (user request 2026-10-09): every ghost hovers with its frame base FLOAT.hover
 * above the floor and bobs by +-FLOAT.bob (visual only; rules radii unchanged). The Hyper3D GLB is
 * 1.8972 GLB units tall with its floor pivot; it is drawn 1.35 m tall with its middle on the
 * frame's body centre (SUCK.centreY), like the old procedural sheet.
 */
export const FLOAT = { hover: 0.35, bob: 0.06, glbHeight: 1.8972, height: 1.35 } as const;
export const GHOST_GLB_SCALE = FLOAT.height / FLOAT.glbHeight;
export const GHOST_GLB_Y_OFFSET = 0.8 - FLOAT.height / 2;

export const SUCK = {
   /** Pull progress at which the final suck-in (shrink, stretch, slide into the mouth) starts. */
   inStart: 0.6,
   /** Drawn scale when the suck-in starts, and at capture. */
   midScale: 0.55, endScale: 0.1,
   /** Extra length along the ghost-to-mouth axis at capture (1 + stretch). */
   stretch: 1.6,
   /** Local body centre of the drawn sheet (Ghosts.tsx) and its horizontal radius. */
   centreY: 0.8, bodyRadius: 0.5,
   /** Rules hunter radius (HUNTER.radius) used as the body the ghost must not cover. */
   hunterRadius: 0.4,
   /** Progress over which the drawn ghost blends from its rules position into the drawn path. */
   blendIn: 0.15,
} as const;

const clamp01 = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

/** Drawn scale (before the big-ghost factor): 1 → midScale over the approach, → endScale in the suck-in. Monotonic. */
export function suckScale(p: number): number {
   if (p <= SUCK.inStart) return 1 - (1 - SUCK.midScale) * smooth(p / SUCK.inStart);
   return SUCK.midScale + (SUCK.endScale - SUCK.midScale) * smooth((p - SUCK.inStart) / (1 - SUCK.inStart));
}
/** 0 → 1 over the final suck-in. */
export const suckIn = (p: number) => smooth((p - SUCK.inStart) / (1 - SUCK.inStart));

export interface NozzleMouth { x: number; y: number; z: number; dirX: number; dirZ: number }
export interface SuckLook {
   /** Drawn body centre. */
   x: number; y: number; z: number;
   /** Uniform scale (includes the big-ghost factor) and the stretch along (ax, ay, az). */
   scale: number; stretch: number; ax: number; ay: number; az: number;
}
export const createSuckLook = (): SuckLook => ({ x: 0, y: 0, z: 0, scale: 1, stretch: 1, ax: 0, ay: 0, az: 1 });

/**
 * Drawn look of a ghost at pull progress p (0..1), its rules position (gx, gz), big-ghost
 * factor ks, idle centre height restY, the hunter centre (hx, hz) and the nozzle mouth
 * (world position plus horizontal unit forward).
 */
export function suckLook(p: number, gx: number, gz: number, ks: number, restY: number, hx: number, hz: number, m: NozzleMouth, out: SuckLook): SuckLook {
   const k = suckIn(p), s = suckScale(p), st = 1 + SUCK.stretch * smooth((p - 0.35) / 0.65);
   const radius = SUCK.bodyRadius * ks * s;
   // Rules position relative to the mouth: along the nozzle, and across it.
   const rx = gx - m.x, rz = gz - m.z;
   const along = rx * m.dirX + rz * m.dirZ, across = rx * m.dirZ - rz * m.dirX;
   // Keep the whole drawn sheet ahead of the mouth until the suck-in slides it in.
   const front = Math.max(along, radius * st) * (1 - k), side = across * (1 - smooth(p / SUCK.inStart * 0.5 + k * 0.5));
   let x = m.x + m.dirX * front + m.dirZ * side, z = m.z + m.dirZ * front - m.dirX * side;
   // Never over the hunter's body: push out radially until the sheet clears it (the clearance
   // fades with the suck-in, so the end point is the mouth itself).
   const minDist = SUCK.hunterRadius + radius * (1 - k);
   let dx = x - hx, dz = z - hz, d = Math.hypot(dx, dz);
   if (d < minDist) {
      if (d < 1e-6) { dx = m.dirX; dz = m.dirZ; d = 1; }
      x = hx + dx / d * minDist; z = hz + dz / d * minDist;
   }
   const w = smooth(p / SUCK.blendIn);
   x = gx + (x - gx) * w; z = gz + (z - gz) * w;
   out.x = x; out.z = z; out.y = restY + (m.y - restY) * smooth(p);
   out.scale = ks * s; out.stretch = st;
   // Stretch axis: from the drawn centre to the mouth (forward when already there).
   let ax = m.x - x, ay = m.y - out.y, az = m.z - z;
   const len = Math.hypot(ax, ay, az);
   if (len < 1e-4) { ax = -m.dirX; ay = 0; az = -m.dirZ; } else { ax /= len; ay /= len; az /= len; }
   out.ax = ax; out.ay = ay; out.az = az;
   return out;
}

/**
 * Column-major 4x4 (Matrix4.fromArray) drawing the sheet so its local body centre
 * (0, SUCK.centreY, 0) lands on the look's centre, scaled by `scale` and stretched by
 * `stretch` along the axis (squashed by 1/sqrt(stretch) across it).
 */
export function suckMatrix(look: SuckLook, out: number[]): number[] {
   const st = look.stretch, sq = 1 / Math.sqrt(st), s = look.scale;
   for (let c = 0; c < 3; c++) {
      const ac = c === 0 ? look.ax : c === 1 ? look.ay : look.az;
      for (let r = 0; r < 3; r++) {
         const ar = r === 0 ? look.ax : r === 1 ? look.ay : look.az;
         out[c * 4 + r] = s * ((r === c ? sq : 0) + (st - sq) * ar * ac);
      }
   }
   out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;
   out[12] = look.x - out[4] * SUCK.centreY; out[13] = look.y - out[5] * SUCK.centreY; out[14] = look.z - out[6] * SUCK.centreY;
   return out;
}

/** Per-frame hand-off: Hunter writes the posed nozzle mouth, Ghosts the strongest pull's drawn centre (swirl particles). */
export interface SuckShared { mouth: NozzleMouth; active: boolean; p: number; cx: number; cy: number; cz: number; scale: number }
export const createSuckShared = (): SuckShared => ({ mouth: { x: 0, y: 0.9, z: 0, dirX: 0, dirZ: 1 }, active: false, p: 0, cx: 0, cy: 0, cz: 0, scale: 1 });
