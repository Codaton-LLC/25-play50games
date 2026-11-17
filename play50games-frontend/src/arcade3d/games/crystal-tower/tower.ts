// The tower built from a level spec (levels.ts): the route pads and the side pads in one list, the
// tiers with their crystals flattened and indexed, and the pure queries the rules, bots, scene and
// proof share (where a sliding pad, a sliding crystal or a drone is this ms, whether a storm is on,
// the solid discs and the core). Nothing here mutates a run.
import type { LevelId } from "../../types";
import { ARENA_R, DRONE_LIFT, LEVELS, arenaSlots, type CrystalSpec, type DiscSpec, type DroneSpec, type PadSpec, type TowerSpec, type XYZ } from "./levels";

/** The crystal spire in the middle: a solid column the hero is pushed out of, all the way up. */
export const CORE_R = 3.2;
/** The hero's radius. */
export const HERO_R = 0.32;
/** A step the hero walks up without a jump. */
export const STEP_UP = 0.75;
/** A sequence beacon's ring: stand inside it to start the show, stay inside it to the end. */
export const BEACON_R = 1.6;
/** The ring's reach the proof uses: a show ends with the hero at most this far from the beacon. */
export const RING = BEACON_R + 0.3;
/** A crystal floats this high over its pad; touching it = the hero's chest within CRYSTAL_R of its centre. */
export const CRYSTAL_LIFT = 0.9;
export const CRYSTAL_R = 1.2;
/** Zuno's magnet reaches the next crystal of the sequence (never a wrong one) from this far. */
export const MAGNET_CRYSTAL_R = 3;
export const MAGNET_R = 6;
/** Reach of the summit crystal, a gem, a secret. */
export const FINISH_R = 2.2;
export const PICKUP_R = 1.4;
/** This far under the beacon it respawns at, the hero has fallen into the cosmos. */
export const FALL_DROP = 6;
/** Kiro: crystal shards rain on a storm pad for STORM_ON every STORM_PERIOD, across STORM_R of its centre. */
export const STORM_PERIOD = 3200;
export const STORM_ON = 900;
export const STORM_R = 1.1;
/** A spark drone knocks whoever comes within this of its centre (it flies at head height: jumpers). */
export const DRONE_R = 1.2;
/** The show: one colour every SHOW_STEP_MS, then a SHOW_TAIL_MS pause before the crystals go live. */
export const SHOW_STEP_MS = 650;
export const SHOW_TAIL_MS = 300;
/** A crumbling pad gives way CRUMBLE_MS after the hero lands on it and is back GONE_MS later. */
export const CRUMBLE_MS = 800;
export const GONE_MS = 2500;
/** The boss's shockwave (its attack step) runs from the arena's centre to its rim; jump it. */
export const WAVE_HALF_W = 0.7;

export interface Pad extends PadSpec {
   index: number;
   /** on the climb route (the bot's waypoints) */
   route: boolean;
}

export interface Crystal {
   index: number;
   tier: number;
   color: number;
   x: number;
   z: number;
   /** the pad surface it floats over */
   y: number;
   bob?: CrystalSpec["bob"];
}

export interface Tier {
   beacon: XYZ;
   seqLen: number;
   /** its crystals in course.crystals: first .. first + count - 1 */
   first: number;
   count: number;
}

export interface Course {
   id: LevelId;
   name: string;
   spec: TowerSpec;
   timerMs: number;
   starTargetMs: number;
   colors: number;
   startX: number;
   startY: number;
   startZ: number;
   /** the orbit yaw that looks along the climb from the start */
   startYaw: number;
   /** the route pads first (in climb order), then the side pads */
   pads: Pad[];
   routeCount: number;
   tiers: Tier[];
   crystals: Crystal[];
   walls: DiscSpec[];
   gates: DiscSpec[];
   drones: DroneSpec[];
   orbs: TowerSpec["orbs"];
   mainOrbs: number;
   secrets: XYZ[];
   summit: XYZ;
   boss: boolean;
   arena: { x: number; z: number; y: number; r: number } | null;
   /** level 5: the arena rim slots of the boss's crystals (colour i starts in slot i) */
   slots: XYZ[];
   bossSeqLen: [number, number, number];
   minY: number;
   maxY: number;
   /** the widest radius anything sits at (the fog and the decor use it) */
   maxR: number;
}

export function showMs(len: number): number {
   return len * SHOW_STEP_MS + SHOW_TAIL_MS;
}

export function buildCourse(spec: TowerSpec): Course {
   const pads: Pad[] = [];
   spec.pads.forEach((p, i) => pads.push({ ...p, index: i, route: true }));
   spec.side.forEach((p) => pads.push({ ...p, index: pads.length, route: false }));
   const crystals: Crystal[] = [];
   const tiers: Tier[] = spec.tiers.map((t, ti) => {
      const first = crystals.length;
      for (const c of t.crystals) crystals.push({ index: crystals.length, tier: ti, color: c.color, x: c.x, z: c.z, y: c.y, bob: c.bob });
      return { beacon: t.beacon, seqLen: t.seqLen, first, count: t.crystals.length };
   });
   const next = spec.pads[1] ?? spec.pads[0];
   const dx = next.x - spec.start.x;
   const dz = next.z - spec.start.z;
   let minY = Infinity;
   let maxY = -Infinity;
   let maxR = 0;
   for (const p of pads) {
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      maxR = Math.max(maxR, Math.hypot(p.x, p.z) + p.r);
   }
   return {
      id: spec.id,
      name: spec.name,
      spec,
      timerMs: spec.timerMs,
      starTargetMs: spec.starTargetMs,
      colors: spec.colors,
      startX: spec.start.x,
      startY: spec.start.y,
      startZ: spec.start.z,
      startYaw: Math.atan2(-dx, -dz),
      pads,
      routeCount: spec.pads.length,
      tiers,
      crystals,
      walls: spec.walls,
      gates: spec.gates,
      drones: spec.drones,
      orbs: spec.orbs,
      mainOrbs: spec.orbs.filter((o) => o.main).length,
      secrets: spec.secrets,
      summit: spec.summit,
      boss: spec.boss,
      arena: spec.arena ?? null,
      slots: spec.arena ? arenaSlots(spec.arena) : [],
      bossSeqLen: spec.bossSeqLen ?? [0, 0, 0],
      minY,
      maxY: Math.max(maxY, spec.summit.y),
      maxR: Math.max(maxR, spec.arena ? ARENA_R : 0),
   };
}

const cache = new Map<LevelId, Course>();

export function courseFor(id: LevelId): Course {
   let c = cache.get(id);
   if (!c) {
      c = buildCourse(LEVELS[id]);
      cache.set(id, c);
   }
   return c;
}

/** A pad's centre this ms (a sliding pad moves on a sine). */
export function padCenterAt(p: PadSpec, ms: number, out: { x: number; z: number }): { x: number; z: number } {
   if (!p.move) {
      out.x = p.x;
      out.z = p.z;
      return out;
   }
   const k = Math.sin((ms / p.move.periodMs) * Math.PI * 2);
   out.x = p.x + p.move.dx * k;
   out.z = p.z + p.move.dz * k;
   return out;
}

/** A sliding pad's horizontal velocity this ms (m/s). */
export function padSpeedAt(p: PadSpec, ms: number, out: { x: number; z: number }): { x: number; z: number } {
   if (!p.move) {
      out.x = out.z = 0;
      return out;
   }
   const w = (Math.PI * 2) / p.move.periodMs;
   const k = Math.cos(ms * w) * w * 1000;
   out.x = p.move.dx * k;
   out.z = p.move.dz * k;
   return out;
}

/** The most any sliding pad moves (m/s): under the run speed, so a ride adds nothing (the proof). */
export function padTopSpeed(p: PadSpec): number {
   if (!p.move) return 0;
   return (Math.hypot(p.move.dx, p.move.dz) * Math.PI * 2 * 1000) / p.move.periodMs;
}

/** A crystal's centre this ms (a bobbing one rises out of reach and sinks back, never sideways). */
export function crystalAt(c: Crystal, ms: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = c.x;
   out.z = c.z;
   out.y = c.y + CRYSTAL_LIFT;
   if (c.bob) out.y += c.bob.amp * (0.5 + 0.5 * Math.sin((ms / c.bob.periodMs) * Math.PI * 2 + c.bob.phase));
   return out;
}

/** A bobbing crystal is within reach of a hero standing under it while this is true. */
export function crystalLow(c: Crystal, ms: number): boolean {
   if (!c.bob) return true;
   return crystalAt(c, ms, bobTmp).y - (c.y + CRYSTAL_LIFT) <= CRYSTAL_R - 0.35;
}

const bobTmp = { x: 0, y: 0, z: 0 };

/** Is the storm on the pad raining this ms? */
export function stormOn(p: PadSpec, ms: number): boolean {
   if (p.storm === undefined) return false;
   const t = (ms + p.storm) % STORM_PERIOD;
   return t >= 0 && t < STORM_ON;
}

/** Ms until the storm on the pad next rains (0 while it rains). */
export function stormIn(p: PadSpec, ms: number): number {
   if (p.storm === undefined) return Infinity;
   const t = (ms + p.storm) % STORM_PERIOD;
   return t < STORM_ON ? 0 : STORM_PERIOD - t;
}

/** A drone's centre this ms: to and fro along the spiral between its two route pads, DRONE_LIFT over them. */
export function droneAt(c: Course, d: DroneSpec, ms: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const a = c.pads[d.from];
   const b = c.pads[d.to];
   const k = 0.5 + 0.5 * Math.sin((ms / d.periodMs) * Math.PI * 2 + d.phase);
   const a0 = Math.atan2(a.x, a.z);
   let da = Math.atan2(b.x, b.z) - a0;
   while (da > Math.PI) da -= Math.PI * 2;
   while (da < -Math.PI) da += Math.PI * 2;
   const ang = a0 + da * k;
   const r = Math.hypot(a.x, a.z) + (Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z)) * k;
   out.x = Math.sin(ang) * r;
   out.z = Math.cos(ang) * r;
   out.y = a.y + (b.y - a.y) * k + DRONE_LIFT;
   return out;
}

/** Pushes (x, z) out of the disc at (cx, cz, r) by the hero's radius. Returns whether it moved. */
export function pushOutOfDisc(cx: number, cz: number, r: number, x: number, z: number, out: { x: number; z: number }): boolean {
   const dx = x - cx;
   const dz = z - cz;
   const d = Math.hypot(dx, dz);
   const keep = r + HERO_R;
   if (d >= keep) return false;
   if (d < 1e-6) {
      out.x = cx + keep;
      out.z = cz;
      return true;
   }
   out.x = cx + (dx / d) * keep;
   out.z = cz + (dz / d) * keep;
   return true;
}

/** Is the hero's height inside the disc's band (its feet between y0 and y1)? */
export function inDiscBand(d: DiscSpec, y: number): boolean {
   return y >= d.y0 - 0.1 && y < d.y1;
}

/** The arena's shockwave radius this ms into the attack step (0 .. ARENA_R over attackMs). */
export function waveRadius(stepMs: number, attackMs: number): number {
   return (Math.min(1, Math.max(0, stepMs / attackMs)) * ARENA_R);
}
