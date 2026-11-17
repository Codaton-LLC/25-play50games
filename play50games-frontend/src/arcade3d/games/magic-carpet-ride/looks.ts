// One palette, the chase camera and the biome dressing. Pure: no React, no three.js.
import { createRng } from "@/arcade3d/core/math";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { Biome } from "./levels";
import { CORR_X, poseAt, type Run } from "./rules";

export const COLORS = {
   accent: "#a78bfa",
   ring: "#fbbf24",
   ringNext: "#fff7d6",
   ringDim: "#78716c",
   gemRuby: "#fb7185",
   gemEmerald: "#4ade80",
   gemSapphire: "#60a5fa",
   gemAmethyst: "#e879f9",
   finish: "#fde68a",
   comboText: "#fde047",
   gemText: "#f0abfc",
   speedLine: "#ffffff",
   lanternGlow: "#ff9d2e",
} as const;

export const FOV = 64;
/** The fov kick of a boost (deg). */
export const BOOST_FOV = 12;
export const FOG_NEAR = 30;
/** The chase camera: this far behind the carpet and above it (m), looking down by CAM_PITCH (rad). */
export const CAM_BACK = 6.4;
export const CAM_UP = 2.3;
export const CAM_PITCH = 0.17;
/** The camera follows the carpet's offset in the lane by this share (the rest is the lane's centre). */
export const CAM_FOLLOW = 0.8;
/** The camera leans (rolls) into a turn by this share of the carpet's bank. */
export const CAM_LEAN = 0.45;

/**
 * The chase eye for a screen shape: a phone held upright sees the carpet from further back and
 * a wider lens, so the carpet sits mid-screen above the joystick and the lane ahead stays in view.
 */
export function camFor(portrait: boolean): { back: number; up: number; pitch: number; fov: number } {
   return portrait ? { back: 9.5, up: 2.4, pitch: 0.1, fov: 72 } : { back: CAM_BACK, up: CAM_UP, pitch: CAM_PITCH, fov: FOV };
}

/** Sky (dome top, horizon) and the ground's colour per biome. */
export const BIOME_LOOK: Record<Biome, { skyTop: string; ground: string; groundY: number }> = {
   desert: { skyTop: "#38bdf8", ground: "#e7b877", groundY: 0 },
   canyon: { skyTop: "#7c3aed", ground: "#9a3412", groundY: -4 },
   clouds: { skyTop: "#0ea5e9", ground: "#f8fafc", groundY: 6 },
   night: { skyTop: "#020617", ground: "#2e2a6b", groundY: 0 },
   palace: { skyTop: "#4c1d95", ground: "#fbcfe8", groundY: 4 },
};

export type DecorKind = "roof" | "tower" | "palm" | "pyramid" | "mesa" | "cloud" | "islandCastle" | "islandFalls" | "islandMill" | "lantern" | "palace";

export type DecorSpots = Record<DecorKind, InstanceSpot[]>;

const empty = (): DecorSpots => ({ roof: [], tower: [], palm: [], pyramid: [], mesa: [], cloud: [], islandCastle: [], islandFalls: [], islandMill: [], lantern: [], palace: [] });

/** No decor stands nearer the lane's centre line than this (m): the lane is CORR_X wide either side. */
export const DECOR_CLEAR = CORR_X + 3;

/**
 * The biome's dressing along the lane, seeded by the run: every spot is a unit box scaled by its
 * size (assets.ts unitBox), standing on its y. Everything keeps DECOR_CLEAR off the lane's centre
 * (decorClearance in looks.test.ts), so the dressing never stands in the flight.
 */
export function decorSpots(run: Run, biome: Biome): DecorSpots {
   const out = empty();
   const rng = createRng(run.seed ^ 0xdec0);
   const L = run.path.total;
   const ground = BIOME_LOOK[biome].groundY;
   const at = { x: 0, y: 0, z: 0 };
   const put = (kind: DecorKind, s: number, lat: number, y: number, w: number, h: number, d: number, rotY = rng() * Math.PI * 2) => {
      poseAt(run.path, s, lat, 0, run.scratch, at);
      const spot = { x: at.x, y, z: at.z, rotY, sx: w, sy: h, sz: d };
      // on a bend the lane can swing back towards a spot: what reaches the lane's height keeps clear of it
      if (!LOW_DECOR.has(kind) && decorClearance(run, spot) - Math.hypot(w, d) / 2 < CORR_X + 1.5) return;
      out[kind].push(spot);
   };
   const side = () => (rng() < 0.5 ? -1 : 1);
   if (biome === "desert" || biome === "night") {
      // a town below the lane: roofs in rows on both sides, palace towers, palms; a pyramid on the horizon
      for (let s = -20; s < L + 60; s += 9 + rng() * 6) {
         for (const k of [-1, 1]) {
            const lat = k * (DECOR_CLEAR + 1 + rng() * 22);
            const w = 6 + rng() * 4;
            put("roof", s, lat, ground, w, 4 + rng() * 5, w * 0.9);
         }
         if (rng() < 0.45) put("tower", s + 4, side() * (DECOR_CLEAR + 2 + rng() * 12), ground, 4.5, 13 + rng() * 8, 4.5);
         if (biome === "desert" && rng() < 0.5) put("palm", s + 2, side() * (DECOR_CLEAR + rng() * 16), ground, 4, 7 + rng() * 3, 4);
         if (biome === "night" && rng() < 0.8) put("lantern", s, side() * (DECOR_CLEAR + rng() * 6), 14 + rng() * 14, 1.3, 2.6, 1.3);
      }
      if (biome === "desert") for (let s = 60; s < L; s += 180) put("pyramid", s, side() * (70 + rng() * 30), ground, 46, 40, 52);
   } else if (biome === "canyon") {
      // the canyon's walls: tall mesas close on both sides, the far rim behind them
      for (let s = -20; s < L + 60; s += 11 + rng() * 5) {
         for (const k of [-1, 1]) {
            put("mesa", s, k * (DECOR_CLEAR + 4 + rng() * 5), ground, 14 + rng() * 6, 26 + rng() * 10, 16 + rng() * 6);
            if (rng() < 0.5) put("mesa", s + 5, k * (DECOR_CLEAR + 22 + rng() * 14), ground, 20, 34 + rng() * 10, 22);
         }
      }
   } else {
      // the sky: a sea of clouds below, clouds drifting beside the lane, floating islands further out
      for (let s = -20; s < L + 60; s += 14 + rng() * 10) {
         put("cloud", s, side() * (DECOR_CLEAR + 1 + rng() * 26), 10 + rng() * 18, 9 + rng() * 8, 4 + rng() * 3, 6 + rng() * 5);
         if (rng() < 0.4) {
            const kinds: DecorKind[] = ["islandCastle", "islandFalls", "islandMill"];
            const size = 10 + rng() * 10;
            put(kinds[Math.floor(rng() * 3)], s + 6, side() * (DECOR_CLEAR + 12 + rng() * 30), 8 + rng() * 20, size, size * 0.9, size);
         }
      }
      if (biome === "palace") for (let s = 90; s < L - 80; s += 160) put("palace", s, side() * (55 + rng() * 25), 6 + rng() * 10, 26, 24, 26);
   }
   // the goal: the floating palace past the end of the lane, facing back along it
   poseAt(run.path, L, 0, 0, run.scratch, at);
   const t = run.scratch.t;
   const yaw = Math.atan2(t.x, t.z);
   const reach = 34;
   out.palace.push({ x: at.x + t.x * reach, y: at.y - 14, z: at.z + t.z * reach, rotY: yaw + Math.PI, sx: 30, sy: 28, sz: 30 });
   return out;
}

/** Decor that stays under the lane (roofs, palms, the far pyramid): never checked against it. */
export const LOW_DECOR: ReadonlySet<DecorKind> = new Set<DecorKind>(["roof", "palm", "pyramid"]);

const NEAR = { x: 0, y: 0, z: 0 };
const SCRATCH = { p: { x: 0, y: 0, z: 0 }, t: { x: 0, y: 0, z: 1 }, r: { x: 1, y: 0, z: 0 }, a: { x: 0, y: 0, z: 0 } };

/**
 * The smallest distance (m, in the ground plane) from a decor spot's centre to the lane's centre
 * line, over the lane within 80 m of `near` (along it), or the whole lane.
 */
export function decorClearance(run: Run, spot: InstanceSpot, near?: number): number {
   const at = NEAR;
   let best = Infinity;
   const from = near === undefined ? 0 : Math.max(0, near - 80);
   const to = near === undefined ? run.path.total : Math.min(run.path.total, near + 80);
   for (let s = from; s <= to; s += 2) {
      poseAt(run.path, s, 0, 0, SCRATCH, at);
      best = Math.min(best, Math.hypot(spot.x - at.x, spot.z - at.z));
   }
   return best;
}
