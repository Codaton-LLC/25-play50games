// Clean the City decoration around the maps: where the parked cars (city) and the pigeons (park)
// stand, the ground around the floor, and the pigeons' animation. Pure data and math (no three.js,
// React or DOM), so decorSpots.test.ts checks every spot against the rules data. Decoration only: rules.ts
// never sees any of it (no collision, no litter, no camera fit change).
//
// Where decor may stand (README "Decor around the maps"):
// - Outside DECOR_KEEP_OUT: the square |x|, |z| <= 14.3 holds everything the run collides with or
//   spawns (the runner's body reaches 14.0, a litter piece's glow 13.5 + 0.72 = 14.22, 14.29 at its
//   pop-in overshoot). Every decor footprint, a pigeon's peck and flight included, stays outside it,
//   so no decor overlaps the floor, an obstacle square, a litter spot or a reachable runner
//   position (decorSpots.test.ts). One effect reaches past it: the pickup burst's fading outer
//   edge (Scene.tsx, up to 13.5 + 1.0 = 14.5, opacity <= 0.21 past 14.3) may slip under the city
//   kerb; it stays short of every car and pigeon.
// - Never beyond the near edge (z > 14): the camera looks from +z, so only something on that side
//   could stand between it and the floor. Seen from the camera (x within the follow range, +z),
//   decor beyond the far edge or the left/right edges is always behind or beside what it looks at.
// - Beyond the far edge, close to it: the strip the fitted camera shows at every aspect (1280 x 800,
//   390 x 844, 844 x 390, banner open or closed): portrait shows a wide band above the floor, the
//   landscape fits show the band the fit keeps for the 2.6-tall props on the far edge.
import type { InstanceSpot } from "@/arcade3d/core/render";
import { FLOOR_HALF, SPAWN_HALF } from "./rules";

/** Litter glow (Scene.tsx circle r 0.72) around a centre at most SPAWN_HALF out: the floor content's reach. */
export const FLOOR_CONTENT_HALF = SPAWN_HALF + 0.72;
/**
 * Decor footprints stay outside |x|, |z| <= this: everything the run collides with or spawns
 * (0.08 of air past the glow, 0.008 past its pop-in overshoot). The pickup burst's faint outer
 * edge (up to 14.5) is the one thing drawn past it (header).
 */
export const DECOR_KEEP_OUT = 14.3;

// ---------- the ground around the floor ----------

/** How far the surround reaches from the centre: past anything the fitted camera can show. */
const REACH = 120;
const SURROUND_TOP = -0.005;
const SURROUND_THICK = 0.02;

/**
 * Four flat boxes framing the 28 x 28 floor (far, near, left, right), touching its edges and never
 * under it (no z-fighting), top just below y = 0 so the litter glows that reach past the edge stay
 * on top. Unit box, scaled per spot.
 */
export const SURROUND_SPOTS: readonly InstanceSpot[] = (() => {
   const y = SURROUND_TOP - SURROUND_THICK / 2;
   const long = 2 * REACH;
   const deep = REACH - FLOOR_HALF;
   const mid = (REACH + FLOOR_HALF) / 2;
   return [
      { x: 0, y, z: -mid, sx: long, sy: SURROUND_THICK, sz: deep },
      { x: 0, y, z: mid, sx: long, sy: SURROUND_THICK, sz: deep },
      { x: -mid, y, z: 0, sx: deep, sy: SURROUND_THICK, sz: 2 * FLOOR_HALF },
      { x: mid, y, z: 0, sx: deep, sy: SURROUND_THICK, sz: 2 * FLOOR_HALF },
   ];
})();

// ---------- city: a street beyond the far edge, kerbs, parked cars ----------

export const KERB = { inner: DECOR_KEEP_OUT + 0.02, width: 0.3, height: 0.1 } as const;
const KERB_MID = KERB.inner + KERB.width / 2;
const KERB_OUTER = KERB.inner + KERB.width;
/**
 * The city block's kerb (unit box, scaled) on the far side and down the left and right sides to the
 * near edge. None on the near side: nothing may stand between the camera and the floor.
 */
export const KERB_SPOTS: readonly InstanceSpot[] = [
   { x: 0, y: KERB.height / 2, z: -KERB_MID, sx: 2 * REACH, sy: KERB.height, sz: KERB.width },
   { x: -KERB_MID, y: KERB.height / 2, z: (FLOOR_HALF - KERB_OUTER) / 2, sx: KERB.width, sy: KERB.height, sz: FLOOR_HALF + KERB_OUTER },
   { x: KERB_MID, y: KERB.height / 2, z: (FLOOR_HALF - KERB_OUTER) / 2, sx: KERB.width, sy: KERB.height, sz: FLOOR_HALF + KERB_OUTER },
];

/** The far street's centre line: dashes 1.2 long every 2.5 (only portrait shows that far out). */
export const STREET_LINE_Z = -17.6;
export const DASH_SPOTS: readonly InstanceSpot[] = Array.from({ length: 33 }, (_v, i) => ({
   x: (i - 16) * 2.5,
   y: 0.002,
   z: STREET_LINE_Z,
   sx: 1.2,
   sy: 1,
   sz: 0.12,
}));

/** Parked along the far kerb, nose to +x (the GLBs face +z: rotY PI / 2), a hand's width off the kerb. */
const PARKED_ROT = Math.PI / 2;
/** Centre line of the parking lane: the widest car (van, 1.03) keeps 0.06 off the kerb's outer face (-14.62). */
export const PARKING_Z = -15.2;
export const CAR_SPOTS: readonly InstanceSpot[] = [
   { x: -4.4, y: 0, z: PARKING_Z, rotY: PARKED_ROT },
   { x: 9.4, y: 0, z: PARKING_Z, rotY: PARKED_ROT },
];
export const TAXI_SPOTS: readonly InstanceSpot[] = [{ x: 3.4, y: 0, z: PARKING_Z, rotY: PARKED_ROT }];
export const VAN_SPOTS: readonly InstanceSpot[] = [{ x: -9.6, y: 0, z: PARKING_Z, rotY: PARKED_ROT }];

// ---------- park: pigeons on the lawn beyond the far edge ----------

export interface PigeonHome {
   x: number;
   z: number;
   /** resting heading, radians around +y (0 = facing -z, away from the camera) */
   yaw: number;
   /** seconds added to the clock, so the five never peck in step */
   phase: number;
   /** unit direction away from the floor: where it flies when the runner comes close */
   awayX: number;
   awayZ: number;
}

const home = (x: number, z: number, yaw: number, phase: number): PigeonHome => ({ x, z, yaw, phase, awayX: 0, awayZ: -1 });

export const PIGEON_HOMES: readonly PigeonHome[] = [
   home(-9.3, -15.0, 0.9, 0),
   home(-8.2, -15.6, -2.2, 1.3),
   home(2.1, -15.1, 2.6, 0.6),
   home(3.2, -15.65, -0.4, 2.1),
   home(10.0, -15.1, -1.4, 1.7),
];

/** The pigeon's height (Decor.tsx createPigeonParts): half the 0.95 runner. */
export const PIGEON_HEIGHT = 0.475;
/** The pigeon's footprint radius around its pose point at rest (standing level: 0.264 measured on its parts). */
export const PIGEON_RADIUS = 0.27;
/** Its footprint radius in any pose: a peck tips the head forward (0.363 measured on its parts). */
export const PIGEON_REACH = 0.37;

/** One loop of the idle: two pecks, a pause, a hop that turns to a new heading. Seconds. */
export const PIGEON_CYCLE = 2.8;
const PECK_PITCH = 0.42;
/** A peck tips the bird about a point this far ahead of its feet (under its beak): the body lifts by PECK_PIVOT x sin(tip). */
const PECK_PIVOT = 0.19;
const PECKS: readonly number[] = [0.12, 0.32];
const PECK_LEN = 0.15;
const HOP_START = 0.78;
const HOP_LEN = 0.14;
const HOP_HEIGHT = 0.07;
const TURN = 0.9;

/** Startle (visual only): closer than SCARE_NEAR the pigeon flies out, past SCARE_FAR it comes back. */
export const SCARE_NEAR = 2.4;
export const SCARE_FAR = 3.6;
const SCARE_UP = 2.5;
const SCARE_DOWN = 0.7;
/** How far out and how high the startled pigeon flies. */
export const FLEE_DISTANCE = 1.4;
export const FLEE_HEIGHT = 0.7;

export interface PigeonPose {
   x: number;
   y: number;
   z: number;
   yaw: number;
   /** forward tip about the feet: negative dips the head (a peck) */
   pitch: number;
}

export function createPigeonPose(): PigeonPose {
   return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
}

/** The heading for loop `cycle`: the resting heading turned by up to TURN either way. */
const headingAt = (p: PigeonHome, cycle: number): number => p.yaw + TURN * Math.sin(cycle * 2.39 + p.phase * 3.1);
const smooth = (k: number): number => k * k * (3 - 2 * k);
/** The yaw that faces (dx, dz): the drawn pigeon faces -z at yaw 0. */
export const yawFacing = (dx: number, dz: number): number => Math.atan2(-dx, -dz);

/**
 * How startled the pigeon is, 0 (home) .. 1 (landed FLEE_DISTANCE out), one frame on. `distance`
 * is from the runner to the pigeon's home; `dt` seconds (pause-safe game time).
 */
export function stepScare(scare: number, distance: number, dt: number): number {
   if (distance < SCARE_NEAR) return Math.min(1, scare + SCARE_UP * dt);
   if (distance > SCARE_FAR) return Math.max(0, scare - SCARE_DOWN * dt);
   return scare;
}

/**
 * Where pigeon `p` stands at animation time `t` (seconds) with startle `scare` (0..1), and whether
 * it is flying out (`fleeing`) or back. On the ground it pecks twice and hops round to a new
 * heading every PIGEON_CYCLE; in the air it flies an arc along its away direction. Writes `out`,
 * allocates nothing.
 */
export function pigeonPose(p: PigeonHome, t: number, scare: number, fleeing: boolean, out: PigeonPose): PigeonPose {
   const s = scare < 0 ? 0 : scare > 1 ? 1 : scare;
   const out1 = FLEE_DISTANCE * smooth(s);
   out.x = p.x + p.awayX * out1;
   out.z = p.z + p.awayZ * out1;
   const air = Math.sin(Math.PI * s);
   if (air > 0.05) {
      out.y = FLEE_HEIGHT * air;
      out.pitch = 0;
      out.yaw = fleeing ? yawFacing(p.awayX, p.awayZ) : yawFacing(-p.awayX, -p.awayZ);
      return out;
   }
   const local = t + p.phase;
   const cycle = Math.floor(local / PIGEON_CYCLE);
   const u = local / PIGEON_CYCLE - cycle;
   let pitch = 0;
   for (let i = 0; i < PECKS.length; i++) {
      const k = (u - PECKS[i]) / PECK_LEN;
      if (k > 0 && k < 1) pitch = -PECK_PITCH * Math.sin(Math.PI * k);
   }
   let y = 0.004 * (1 + Math.sin(local * 7)) + PECK_PIVOT * Math.sin(-pitch);
   let yaw = headingAt(p, cycle);
   const hop = (u - HOP_START) / HOP_LEN;
   if (hop >= 1) yaw = headingAt(p, cycle + 1);
   else if (hop > 0) {
      y += HOP_HEIGHT * Math.sin(Math.PI * hop);
      yaw += (headingAt(p, cycle + 1) - yaw) * smooth(hop);
   }
   out.y = y;
   out.yaw = yaw;
   out.pitch = pitch;
   return out;
}
