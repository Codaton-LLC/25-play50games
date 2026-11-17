// The trial built from a level spec (levels.ts): the sections flattened into the arrays the rules,
// bots, scene and proof share (floors, pads, rings, switches, door rows, lasers, orbs, survival
// arenas, cores, exit gates, checkpoints, the nooks and the ledge), and the pure queries (where a
// sliding pad, a laser beam or an orb is this ms). Nothing here mutates a run.
import type { LevelId } from "../../types";
import { HALF_W, LEDGE_LIFT, LEVELS, NOOK_X, type BlobSpec, type DoorRow, type GemSpec, type LaserSpec, type PadSpec, type RingSpec, type SectionKind, type SectionSpec, type SwitchSpec, type TrialSpec, type XYZ, type XZ } from "./levels";

/** The hero's radius. */
export const HERO_R = 0.32;
/** A step the hero walks up without a jump. */
export const STEP_UP = 0.75;
/** Below this the hero has fallen into the void: respawn at the section's checkpoint. */
export const FALL_Y = -6;
/** Reach of a gem, a secret, the finish, a checkpoint. */
export const PICKUP_R = 1.4;
export const FINISH_R = 2.2;
export const MAGNET_R = 6;
/** A colour switch charges the hero within this of its centre. */
export const SWITCH_R = 1.1;
/** The energy core is picked up within this; Zuno's magnet pulls it from MAGNET_CORE_R. */
export const CORE_R = 1.2;
export const MAGNET_CORE_R = 5;
/** The receptor takes a carried core within this. */
export const RECEPTOR_R = 1.6;
/** A laser beam: this high over the floor, this thick along z; feet at or over BEAM_CLEAR pass over it. */
export const BEAM_Y = 0.5;
export const BEAM_HALF = 0.3;
export const BEAM_CLEAR = 0.9;
/** A rolling orb knocks within this of its centre (horizontal, and the hero on the floor). */
export const ORB_R = 1.15;
/** A door or exit gate is this thick along z (the hero is held before it). */
export const GATE_T = 0.5;
/** The nook alcove (behind its barrier) and its barrier disc. */
export const NOOK_R = 1.3;
/** The Chroma Sentinel is hit by touching him within this (level 5). */
export const BOSS_HIT_R = 2.2;

export interface Pad extends PadSpec {
   index: number;
   /** the section it belongs to */
   section: number;
}

export interface Floor {
   x0: number;
   x1: number;
   z0: number;
   z1: number;
   y: number;
   /** a nook alcove (off the corridor) or the sky ledge */
   kind: "floor" | "nook" | "ledge";
}

export interface Ring extends RingSpec {
   index: number;
   section: number;
   /** its place in its section's order */
   order: number;
}

export interface Switch extends SwitchSpec {
   index: number;
   section: number;
}

export interface Row extends DoorRow {
   index: number;
   section: number;
   /** its place in its section's rows */
   order: number;
}

export interface Laser extends LaserSpec {
   index: number;
   section: number;
}

export interface Blob extends BlobSpec {
   index: number;
   section: number;
}

export interface Section {
   index: number;
   kind: SectionKind;
   name: string;
   z0: number;
   z1: number;
   /** has an exit gate at z1 that opens when the section is done */
   gated: boolean;
   surviveMs: number;
   core: XZ | null;
   receptor: XZ | null;
   ringCount: number;
   rowCount: number;
}

export interface Nook {
   kind: "wall" | "gate";
   /** the alcove floor */
   floor: Floor;
   /** the barrier disc in the wall opening */
   disc: { x: number; z: number; r: number; y0: number; y1: number };
}

export interface Course {
   id: LevelId;
   name: string;
   spec: TrialSpec;
   timerMs: number;
   starTargetMs: number;
   colors: number;
   startX: number;
   startZ: number;
   /** the orbit yaw that looks down the corridor (+z) */
   startYaw: number;
   finish: XZ;
   sections: Section[];
   floors: Floor[];
   pads: Pad[];
   rings: Ring[];
   switches: Switch[];
   rows: Row[];
   lasers: Laser[];
   blobs: Blob[];
   nooks: Nook[];
   ledge: Floor;
   /** per section: where the hero respawns (the section's start line) */
   checkpoints: XZ[];
   gems: GemSpec[];
   mainGems: number;
   secrets: XYZ[];
   boss: boolean;
   bossSpec: TrialSpec["boss5"] | null;
   minZ: number;
   maxZ: number;
}

export function buildCourse(spec: TrialSpec): Course {
   const sections: Section[] = [];
   const floors: Floor[] = [];
   const pads: Pad[] = [];
   const rings: Ring[] = [];
   const switches: Switch[] = [];
   const rows: Row[] = [];
   const lasers: Laser[] = [];
   const blobs: Blob[] = [];
   const checkpoints: XZ[] = [];
   const first = spec.sections[0];
   // the start strip
   floors.push({ x0: -HALF_W, x1: HALF_W, z0: spec.start.z - 6, z1: first.z0, y: 0, kind: "floor" });
   spec.sections.forEach((s: SectionSpec, i) => {
      const gated = s.kind === "rings" || s.kind === "survive" || s.kind === "core";
      sections.push({ index: i, kind: s.kind, name: s.name, z0: s.z0, z1: s.z1, gated, surviveMs: s.surviveMs ?? 0, core: s.core ?? null, receptor: s.receptor ?? null, ringCount: s.rings?.length ?? 0, rowCount: s.rows?.length ?? 0 });
      // the respawn spot: on the floor just inside the section, or (jump pads) on the floor just before it
      checkpoints.push({ x: 0, z: s.kind === "jump" ? s.z0 - 1.6 : s.z0 + 1.2 });
      if (s.kind !== "jump") floors.push({ x0: -HALF_W, x1: HALF_W, z0: s.z0, z1: s.z1, y: 0, kind: "floor" });
      for (const p of s.pads ?? []) pads.push({ ...p, index: pads.length, section: i });
      (s.rings ?? []).forEach((r, k) => rings.push({ ...r, index: rings.length, section: i, order: k }));
      for (const w of s.switches ?? []) switches.push({ ...w, index: switches.length, section: i });
      (s.rows ?? []).forEach((r, k) => rows.push({ ...r, index: rows.length, section: i, order: k }));
      for (const l of s.lasers ?? []) lasers.push({ ...l, index: lasers.length, section: i });
      for (const b of s.blobs ?? []) blobs.push({ ...b, index: blobs.length, section: i });
   });
   const last = spec.sections[spec.sections.length - 1];
   // the finish strip (level 5: the arena is the last section and holds the finish)
   if (!spec.boss) floors.push({ x0: -HALF_W, x1: HALF_W, z0: last.z1, z1: spec.finish.z + 8, y: 0, kind: "floor" });
   const nooks: Nook[] = spec.nooks.map((n) => ({
      kind: n.kind,
      floor: { x0: HALF_W, x1: NOOK_X + NOOK_R, z0: n.z - NOOK_R, z1: n.z + NOOK_R, y: 0, kind: "nook" as const },
      disc: { x: HALF_W + 0.9, z: n.z, r: NOOK_R, y0: -0.2, y1: 3.6 },
   }));
   const ledge: Floor = { x0: spec.ledge.x - 1.4, x1: spec.ledge.x + 1.4, z0: spec.ledge.z - 1.4, z1: spec.ledge.z + 1.4, y: LEDGE_LIFT, kind: "ledge" };
   floors.push(...nooks.map((n) => n.floor), ledge);
   if (spec.boss5) {
      const b = spec.boss5;
      const i = sections.length - 1;
      b.rings.forEach((r, k) => rings.push({ ...r, index: rings.length, section: i, order: k }));
      for (const w of b.switches) switches.push({ ...w, index: switches.length, section: i });
      rows.push({ ...b.row, index: rows.length, section: i, order: 0 });
      for (const o of b.blobs) blobs.push({ ...o, index: blobs.length, section: i });
   }
   return {
      id: spec.id,
      name: spec.name,
      spec,
      timerMs: spec.timerMs,
      starTargetMs: spec.starTargetMs,
      colors: spec.colors,
      startX: spec.start.x,
      startZ: spec.start.z,
      startYaw: Math.PI,
      finish: spec.finish,
      sections,
      floors,
      pads,
      rings,
      switches,
      rows,
      lasers,
      blobs,
      nooks,
      ledge,
      checkpoints,
      gems: spec.gems,
      mainGems: spec.gems.filter((g) => g.main).length,
      secrets: spec.secrets,
      boss: spec.boss,
      bossSpec: spec.boss5 ?? null,
      minZ: spec.start.z - 6,
      maxZ: spec.finish.z + 8,
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

/** A pad's centre this ms (a sliding pad moves on a sine across the corridor). */
export function padCenterAt(p: PadSpec, ms: number, out: { x: number; z: number }): { x: number; z: number } {
   out.z = p.z;
   out.x = p.move ? p.x + p.move.dx * Math.sin((ms / p.move.periodMs) * Math.PI * 2 + p.move.phase) : p.x;
   return out;
}

/** A sliding pad's velocity this ms (m/s, along x). */
export function padSpeedAt(p: PadSpec, ms: number): number {
   if (!p.move) return 0;
   const w = (Math.PI * 2) / p.move.periodMs;
   return p.move.dx * Math.cos(ms * w + p.move.phase) * w * 1000;
}

/** The most a sliding pad moves (m/s): under the run speed, so a ride adds nothing (the proof). */
export function padTopSpeed(p: PadSpec): number {
   return p.move ? (Math.abs(p.move.dx) * Math.PI * 2 * 1000) / p.move.periodMs : 0;
}

/** Where a laser beam is this ms (its z): it sweeps from zb down to za toward the hero, then wraps. */
export function laserZ(l: LaserSpec, ms: number): number {
   const span = l.zb - l.za;
   return l.zb - ((((ms * l.speed) / 1000 + l.phase) % span) + span) % span;
}

/** A rolling orb's centre this ms. */
export function blobAt(b: BlobSpec, ms: number, out: { x: number; z: number }): { x: number; z: number } {
   const a = b.phase + (ms / b.periodMs) * Math.PI * 2;
   out.x = b.cx + Math.sin(a) * b.r;
   out.z = b.cz + Math.cos(a) * b.r;
   return out;
}

/** The floor under (x, z) at or under y + STEP_UP: the highest one, -Infinity over the void. */
export function floorAt(c: Course, x: number, z: number, y: number): number {
   let best = -Infinity;
   for (const f of c.floors) {
      if (f.y > y + STEP_UP || f.y <= best) continue;
      if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) best = f.y;
   }
   return best;
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

/** The section the point is in (by z), -1 before the first, sections.length past the last. */
export function sectionAt(c: Course, z: number): number {
   if (z < c.sections[0].z0) return -1;
   for (const s of c.sections) if (z < s.z1) return s.index;
   return c.sections.length;
}

/** The door of the row that spans x, or null (a wall there). */
export function doorAt(row: DoorRow, x: number): DoorRow["doors"][number] | null {
   for (const d of row.doors) if (x >= d.x0 && x <= d.x1) return d;
   return null;
}
