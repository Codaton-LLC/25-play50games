// The star system (pure data, no three.js): every level is laid out in the x-y plane (x the way to the
// dock, y up, z = 0 the play plane). Bodies: planetoids (walkable rock spheres), moons (small bodies on
// circular orbits round a parent: slingshots and springboards), the Orbit Warden (level 5). Each body has
// gravity mu = G_SURF * R^2 inside its sphere of influence (SOI = 2.5 R); only the dominant SOI pulls
// (patched conics, the card). Props: station pod cradles on the bodies' surfaces (charged launches),
// orbs (main ones on the route, bonus ones in high orbits and behind hero gates), slingshot gates
// (level 3: open only at 8 m/s), solar-flare zones and orbiting debris (Kiro's shield), Riko's cracked
// satellite panel, level 4's floating push-off crates, Vexa's ghost hatches and the big planetoid's
// core, the dock (a station deck with a wide capture ring). Fixed per level; only the run moves.
import type { LevelId } from "@/arcade3d/types";
import type { PodLevel } from "./levels";

export const NONE = -1;
/** surface gravity of every body (m/s^2: the card's 6 on an R = 4 planetoid, mu = 96) */
export const G_SURF = 6;
export const SOI_K = 2.5;

export type BodyKind = "rock" | "moon" | "warden";

export interface BodyOrbit {
   parent: number;
   r: number;
   /** angular speed (rad/s, + counter-clockwise) and the angle at t = 0 */
   w: number;
   phase: number;
}

export interface BodyDef {
   index: number;
   kind: BodyKind;
   x: number;
   y: number;
   R: number;
   mu: number;
   soi: number;
   orbit: BodyOrbit | null;
   /** pod cradles: surface angles (rad) */
   pods: number[];
   /** the order on the route (0 the start; NONE: off the route, a moon or a secret) */
   route: number;
}

export interface OrbDef {
   x: number;
   y: number;
   kind: "main" | "bonus";
}

/** A slingshot gate (level 3): a ring that opens only at GATE_SPEED. */
export interface GateDef {
   x: number;
   y: number;
}

/** A solar-flare zone: burns for `on` ms of every `period` ms. */
export interface FlareDef {
   x: number;
   y: number;
   r: number;
   period: number;
   on: number;
   phase: number;
}

/** A piece of debris on a circular orbit round a body. */
export interface DebrisDef {
   parent: number;
   r: number;
   w: number;
   phase: number;
}

/** Riko's cracked satellite panel: a barrier only her dash breaks. */
export interface PanelDef {
   x: number;
   y: number;
   r: number;
}

/** Level 4: a floating crate to push off (a jump press next to it in flight). */
export interface CrateDef {
   x: number;
   y: number;
}

export interface SecretSpot {
   x: number;
   y: number;
   /** "hatch": Vexa phasing on that body at that angle; "core": her chord through that body; "spot": reach the point */
   need: "hatch" | "core" | "spot";
   body: number;
   angle: number;
}

export interface SystemDraft {
   bodies: BodyDef[];
   orbs: OrbDef[];
   gates: GateDef[];
   flares: FlareDef[];
   debris: DebrisDef[];
   panels: PanelDef[];
   crates: CrateDef[];
   secrets: Record<string, SecretSpot>;
   startBody: number;
   startAngle: number;
   dock: { x: number; y: number; r: number };
   /** the map's bounds: outside every SOI and outside these, the hero is lost in space */
   bounds: { minX: number; maxX: number; minY: number; maxY: number };
   /** level 5: the Orbit Warden's body index and the arena's first body (NONE without a boss) */
   warden: number;
   arenaBodies: number[];
}

const DEG = Math.PI / 180;

/** A builder for one level's system. */
class Sys {
   bodies: BodyDef[] = [];
   orbs: OrbDef[] = [];
   gates: GateDef[] = [];
   flares: FlareDef[] = [];
   debris: DebrisDef[] = [];
   panels: PanelDef[] = [];
   crates: CrateDef[] = [];
   secrets: Record<string, SecretSpot> = {};
   private routeN = 0;
   body(kind: BodyKind, x: number, y: number, R: number, onRoute = true, orbit: BodyOrbit | null = null, g = G_SURF): number {
      const index = this.bodies.length;
      this.bodies.push({ index, kind, x, y, R, mu: g * R * R, soi: SOI_K * R, orbit, pods: [], route: onRoute ? this.routeN++ : NONE });
      return index;
   }
   moon(parent: number, R: number, r: number, w: number, phase: number): number {
      const p = this.bodies[parent];
      return this.body("moon", p.x + r * Math.cos(phase), p.y + r * Math.sin(phase), R, false, { parent, r, w, phase });
   }
   /** a pod cradle on body b pointing at (x, y) (or at a fixed angle) */
   podToward(b: number, x: number, y: number): void {
      const p = this.bodies[b];
      p.pods.push(Math.atan2(y - p.y, x - p.x));
   }
   podAt(b: number, angle: number): void {
      this.bodies[b].pods.push(angle);
   }
   /** n main orbs on a ring round body b at height h over its surface, starting at angle a0, step da */
   ring(b: number, n: number, a0: number, da: number, h = 0.7, kind: "main" | "bonus" = "main"): void {
      const p = this.bodies[b];
      for (let k = 0; k < n; k++) {
         const a = a0 + k * da;
         this.orbs.push({ x: p.x + (p.R + h) * Math.cos(a), y: p.y + (p.R + h) * Math.sin(a), kind });
      }
   }
   /** n orbs on the straight line from (x0, y0) to (x1, y1), ends excluded */
   line(x0: number, y0: number, x1: number, y1: number, n: number, kind: "main" | "bonus" = "main"): void {
      for (let k = 1; k <= n; k++) {
         const t = k / (n + 1);
         this.orbs.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, kind });
      }
   }
   hatch(b: number, angle: number): void {
      const p = this.bodies[b];
      this.secrets.hatch = { x: p.x + p.R * Math.cos(angle), y: p.y + p.R * Math.sin(angle), need: "hatch", body: b, angle };
   }
}

/** The surface point of a body at an angle (static bodies only). */
function surf(s: Sys, b: number, a: number): [number, number] {
   const p = s.bodies[b];
   return [p.x + p.R * Math.cos(a), p.y + p.R * Math.sin(a)];
}

function level1(): Sys {
   const s = new Sys();
   // beat 1: walk round one planetoid (orbs all the way round); beat 2: hop to the second, whose SOI
   // overlaps; beat 3: the first pod launch to the dock
   const b0 = s.body("rock", 0, 0, 4);
   const b1 = s.body("rock", 11.5, 0, 4);
   s.ring(b0, 6, 150 * DEG, 50 * DEG);
   s.line(4, 0, 7.5, 0, 2);
   s.ring(b1, 3, 60 * DEG, 50 * DEG);
   s.podAt(b1, 0);
   s.line(16, 0, 28, 0, 4);
   s.ring(b1, 3, 80 * DEG, 10 * DEG, 4.6, "bonus");
   s.ring(b0, 2, 80 * DEG, 20 * DEG, 4.4, "bonus");
   s.hatch(b0, -90 * DEG);
   return s;
}

function level2(): Sys {
   const s = new Sys();
   // a chain of six cradles: each launch has to be aimed (tangent) and the arrival braked into the next body
   const pts: Array<[number, number]> = [
      [0, 0],
      [20, 4],
      [40, -3],
      [60, 3],
      [80, -4],
      [100, 2],
   ];
   const bs = pts.map(([x, y]) => s.body("rock", x, y, 3.5));
   for (let i = 0; i < bs.length; i++) {
      const next = i + 1 < pts.length ? pts[i + 1] : [120, 0];
      s.podToward(bs[i], next[0], next[1]);
      const [sx, sy] = surf(s, bs[i], Math.atan2(next[1] - pts[i][1], next[0] - pts[i][0]));
      const tx = next[0] - (i + 1 < pts.length ? 3.5 : 4) * Math.cos(Math.atan2(next[1] - pts[i][1], next[0] - pts[i][0]));
      const ty = next[1] - (i + 1 < pts.length ? 3.5 : 4) * Math.sin(Math.atan2(next[1] - pts[i][1], next[0] - pts[i][0]));
      s.line(sx, sy, tx, ty, i === 0 ? 3 : 2);
   }
   s.ring(bs[0], 2, 100 * DEG, 40 * DEG);
   // Riko's high-orbit shard above body 3, behind a cracked panel; Nami's high bonus orbs over body 1
   s.secrets.shard = { x: 60, y: 13.5, need: "spot", body: NONE, angle: 0 };
   s.panels.push({ x: 60, y: 11.2, r: 1.2 });
   s.ring(bs[1], 3, 80 * DEG, 10 * DEG, 4.2, "bonus");
   s.hatch(bs[2], -90 * DEG);
   return s;
}

function level3(): Sys {
   const s = new Sys();
   // moving moons (slingshots, springboards), slingshot gates (8 m/s), debris in orbit, a hidden moonlet
   const b0 = s.body("rock", 0, 0, 4);
   const b1 = s.body("rock", 26, 5, 4);
   const b2 = s.body("rock", 52, -3, 4.5);
   const b3 = s.body("rock", 78, 3, 4);
   s.moon(b0, 1.6, 11, 0.25, 90 * DEG);
   s.moon(b1, 1.6, 11, -0.22, -90 * DEG);
   s.podToward(b0, 26, 5);
   s.podToward(b1, 52, -3);
   s.podToward(b2, 78, 3);
   s.podToward(b3, 98, 2);
   s.line(4, 0.8, 22, 4.2, 3);
   s.line(30, 4.3, 47.5, -2.4, 3);
   s.line(56.5, -2.3, 74, 2.8, 3);
   s.line(82, 2.9, 94, 2.1, 3);
   s.ring(b0, 2, 110 * DEG, 40 * DEG);
   s.gates.push({ x: 13, y: 9 }, { x: 39, y: -9 }, { x: 65, y: 9 });
   s.debris.push({ parent: b1, r: 8, w: 0.6, phase: 0 }, { parent: b1, r: 8, w: 0.6, phase: Math.PI }, { parent: b2, r: 9, w: -0.5, phase: 1 });
   // Kiro's flare shortcut: bonus orbs in a flare zone between body 2 and 3, above the line
   s.flares.push({ x: 65, y: 6, r: 3.5, period: 3000, on: 1400, phase: 0 });
   s.line(61, 5, 69, 7, 3, "bonus");
   // the hidden moonlet: reachable only by a perfect slingshot
   const moonlet = s.body("rock", 40, 18, 1.2, false);
   s.secrets.moonlet = { x: 40, y: 19.2, need: "spot", body: moonlet, angle: Math.PI / 2 };
   s.hatch(b2, -90 * DEG);
   return s;
}

function level4(): Sys {
   const s = new Sys();
   // the zero-g gap: no body, only drift; floating crates to push off; jet fuel is precious
   const b0 = s.body("rock", 0, 0, 4);
   const b1 = s.body("rock", 20, 0, 4);
   const b2 = s.body("rock", 75, 0, 5);
   const b3 = s.body("rock", 100, 3, 4);
   s.podToward(b0, 20, 0);
   s.podToward(b1, 75, 0);
   s.podToward(b2, 100, 3);
   s.podToward(b3, 120, 0);
   s.line(4, 0, 16, 0, 2);
   s.line(24, 0, 70, 0, 6);
   s.line(80, 0.6, 96, 2.6, 2);
   s.line(104, 2.6, 116, 0.4, 2);
   s.ring(b0, 2, 110 * DEG, 40 * DEG);
   s.crates.push({ x: 33, y: 2 }, { x: 43, y: -2 }, { x: 53, y: 1.5 }, { x: 62, y: -1 });
   // the debris belt round the big planetoid and a flare zone over the gap (Kiro)
   for (let k = 0; k < 4; k++) s.debris.push({ parent: b2, r: 9, w: 0.45, phase: (k * Math.PI) / 2 });
   s.flares.push({ x: 48, y: 7, r: 4, period: 3200, on: 1500, phase: 0 });
   s.line(44, 7, 52, 7, 3, "bonus");
   // Vexa: the big planetoid's core (her chord through it)
   s.secrets.core = { x: 75, y: 0, need: "core", body: b2, angle: 0 };
   s.hatch(b3, -90 * DEG);
   return s;
}

function level5(): Sys {
   const s = new Sys();
   // a short warm-up, then the Orbit Warden's arena: the Warden at the centre with its moon, two
   // launch planetoids, and the dock beyond
   const b0 = s.body("rock", 0, 0, 4);
   const b1 = s.body("rock", 22, 3, 4);
   s.podToward(b0, 22, 3);
   s.line(4, 0.6, 18, 2.4, 3);
   s.ring(b0, 2, 110 * DEG, 40 * DEG);
   const a1 = s.body("rock", 42, 14, 3.5);
   const a2 = s.body("rock", 42, -14, 3.5, false);
   const w = s.body("warden", 64, 0, 6);
   s.moon(w, 1.6, 12.5, 0.3, 0);
   s.podToward(b1, 42, 14);
   s.line(26, 4.5, 39, 12.5, 3);
   s.podToward(a1, 64, 0);
   s.podToward(a2, 64, 0);
   s.podToward(a2, 42, 14);
   s.podToward(a1, 42, -14);
   s.podAt(w, 135 * DEG);
   s.podAt(w, -135 * DEG);
   s.podToward(w, 92, 0);
   s.line(70, 0, 88, 0, 3);
   s.ring(a1, 3, 60 * DEG, 40 * DEG);
   s.ring(a2, 3, -60 * DEG, -40 * DEG);
   s.secrets.shard = { x: 42, y: 25.5, need: "spot", body: NONE, angle: 0 };
   s.panels.push({ x: 42, y: 23, r: 1.2 });
   s.hatch(a1, 90 * DEG);
   return s;
}

const BUILDERS: Record<LevelId, () => Sys> = { 1: level1, 2: level2, 3: level3, 4: level4, 5: level5 };
const DOCKS: Record<LevelId, { x: number; y: number }> = { 1: { x: 32, y: 0 }, 2: { x: 120, y: 0 }, 3: { x: 98, y: 2 }, 4: { x: 120, y: 0 }, 5: { x: 92, y: 0 } };

export const DOCK_R = 4.5;

export function buildSystem(level: PodLevel): SystemDraft {
   const s = BUILDERS[level.id]();
   const dock = { ...DOCKS[level.id], r: DOCK_R };
   let minX = Infinity;
   let maxX = -Infinity;
   let minY = Infinity;
   let maxY = -Infinity;
   for (const b of s.bodies) {
      const reach = b.orbit ? b.orbit.r + b.soi : b.soi;
      const c = b.orbit ? s.bodies[b.orbit.parent] : b;
      minX = Math.min(minX, c.x - reach);
      maxX = Math.max(maxX, c.x + reach);
      minY = Math.min(minY, c.y - reach);
      maxY = Math.max(maxY, c.y + reach);
   }
   const warden = s.bodies.findIndex((b) => b.kind === "warden");
   return {
      bodies: s.bodies,
      orbs: s.orbs,
      gates: s.gates,
      flares: s.flares,
      debris: s.debris,
      panels: s.panels,
      crates: s.crates,
      secrets: s.secrets,
      startBody: 0,
      startAngle: Math.PI / 2,
      dock,
      bounds: { minX: minX - 12, maxX: Math.max(maxX, dock.x + dock.r) + 20, minY: Math.min(minY, -20) - 14, maxY: Math.max(maxY, 20) + 14 },
      warden,
      arenaBodies: warden >= 0 ? s.bodies.filter((b) => b.x > 35).map((b) => b.index) : [],
   };
}
