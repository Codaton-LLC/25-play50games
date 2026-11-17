// One palette, the chase view and the street dressing. Pure: no React, no three.js.
import type { AABB } from "../../core/collision";
import type { InstanceSpot } from "../../core/render";
import type { FittedViewOptions } from "../../core/useFittedView";
import type { BurgerLevel } from "./levels";
import { BLOCK_HALF, PITCH, cityHalf, type Run } from "./rules";

export const COLORS = {
   road: "#475569", roadLine: "#e2e8f0", sidewalk: "#cbd5e1", curb: "#94a3b8", ground: "#94a3b8",
   shop: "#fb7185", bag: "#fbbf24", cream: "#fff1e6", dark: "#1e293b", glass: "#bae6fd",
   wet: "#1e293b", target: "#34d399", skin: "#e8b99a",
   wallA: "#e7e5e4", wallB: "#fde68a", wallC: "#bfdbfe", wallD: "#fecdd3", roof: "#64748b", window: "#334155",
} as const;

/** Parked-car paint, one per car (instance tint on the white-ish GLB). */
export const CAR_TINTS = ["#f87171", "#60a5fa", "#fbbf24", "#a3e635", "#f472b6", "#e2e8f0"] as const;

export function environment(level: BurgerLevel) {
   return { background: level.background, lighting: level.lighting,
      fog: [level.background, level.wet ? 26 : 45, level.wet ? 75 : 110] as [string, number, number] };
}

export const FOV = 50;
export const PITCH_RAD = (50 * Math.PI) / 180;
export const LOOK_AHEAD = 2.5;
export const DAMPING = 4;
/** half size of the street window the chase camera keeps on screen around its aim */
export const WINDOW = { x: 9, z: 7 } as const;
/** Low blocks: at a 50° pitch a wall this tall hides 0.84 × its height of street behind it, < the 3 m half street. */
export const BUILDING_HEIGHT = 3.0;

export const CAMERA = { position: [0, 16, 13] as [number, number, number], lookAt: [0, 0, 0] as [number, number, number], fov: FOV };

const VIEW: FittedViewOptions = {
   area: { min: { x: -WINDOW.x, y: 0, z: -WINDOW.z }, max: { x: WINDOW.x, y: 1.8, z: WINDOW.z } },
   pitch: PITCH_RAD,
   yaws: [0],
   fov: FOV,
   margin: { top: 0.04, right: 0.02, bottom: 0.04, left: 0.02 },
   padding: 6,
   shift: true,
};
export const viewFor = (): FittedViewOptions => VIEW;

/** Where the camera may aim: the city less the window, so the frame stays over the streets. */
export function aimBounds(level: BurgerLevel): AABB {
   const h = cityHalf(level);
   const x = Math.max(0, h.x - WINDOW.x + 3), z = Math.max(0, h.z - WINDOW.z + 3);
   return { min: { x: -x, y: 0, z: -z }, max: { x, y: 2, z } };
}

export interface BlockSpot extends InstanceSpot { tone: 0 | 1 | 2 | 3 }

/**
 * The blocks drawn as low town buildings (the shop's block draws the shop GLB instead), plus a ring of
 * decor blocks round the city so the streets never end in a void. Bodies at unit size, scaled by spot.
 */
export function blockSpots(run: Run): BlockSpot[] {
   const out: BlockSpot[] = [];
   const h = run.config;
   const size = 2 * BLOCK_HALF - 1.2;
   const add = (x: number, z: number, k: number) => out.push({ x, y: 0, z, sx: size, sy: BUILDING_HEIGHT, sz: size, tone: (k % 4) as 0 | 1 | 2 | 3 });
   run.buildings.forEach((b, i) => { if (i > 0) add(b.x, b.z, i); });
   // the shop's block: a low back building behind the shop
   const sb = run.buildings[0];
   out.push({ x: sb.x, y: 0, z: sb.z - BLOCK_HALF + 2.4, sx: size, sy: BUILDING_HEIGHT * 0.8, sz: 3.6, tone: 2 });
   // the ring: one block pitch outside every edge street
   const ox = h.blocksX * 9 + 3 + 6.6, oz = h.blocksZ * 9 + 3 + 6.6;
   let k = 7;
   for (let x = -ox; x <= ox + 0.1; x += PITCH) { add(x, -oz, k++); add(x, oz, k++); }
   for (let z = -oz + PITCH; z <= oz - PITCH + 0.1; z += PITCH) { add(-ox, z, k++); add(ox, z, k++); }
   return out;
}

/** Street lamps on the inner corners of the intersections, benches by the shop, cones by the barriers. */
export function dressing(run: Run): { lamps: InstanceSpot[]; benches: InstanceSpot[]; cones: InstanceSpot[] } {
   const lamps: InstanceSpot[] = [];
   for (const b of run.buildings.slice(1)) lamps.push({ x: b.x - BLOCK_HALF + 0.4, y: 0, z: b.z + BLOCK_HALF - 0.4, scale: 3.4 });
   const benches: InstanceSpot[] = [{ x: run.shop.x + 11.6, y: 0, z: run.shop.z - 3.7, rotY: Math.PI, scale: 1.5 }];
   const cones = run.barriers.flatMap((b) => [-1, 1].map((s): InstanceSpot => ({ x: b.x + s * 1.0, y: 0, z: b.z, scale: 0.55 })));
   return { lamps, benches, cones };
}

/** Lane dashes along every street centre line (unit boxes, scaled by spot). */
export function laneDashes(level: BurgerLevel): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   const hx = level.blocksX * 9, hz = level.blocksZ * 9;
   for (let x = -hx; x <= hx + 0.1; x += PITCH) for (let z = -hz + 4; z < hz - 3; z += 3) if (((z + hz) % PITCH) > 3.5 && ((z + hz) % PITCH) < 14.5) out.push({ x, y: 0.012, z, sx: 0.14, sy: 0.01, sz: 1.4 });
   for (let z = -hz; z <= hz + 0.1; z += PITCH) for (let x = -hx + 4; x < hx - 3; x += 3) if (((x + hx) % PITCH) > 3.5 && ((x + hx) % PITCH) < 14.5) out.push({ x, y: 0.012, z, sx: 1.4, sy: 0.01, sz: 0.14 });
   return out;
}

/** The shop GLB's centre: the south-west corner of its block, 1.6 m in from the west curb and 0.7 m from the south one. */
export function shopSpot(run: Run, width: number, depth: number): { x: number; z: number } {
   const sb = run.buildings[0];
   return { x: sb.x - BLOCK_HALF + 1.6 + width / 2, z: sb.z + BLOCK_HALF - 0.7 - depth / 2 };
}
