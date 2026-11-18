// Wall Run Temple's rules (pure, deterministic, fixed 8 ms substeps).
// - Wall-run: jump at a glyph wall moving toward it (or holding toward it: a 150 ms grace) and you
//   stick, running along it at 7 m/s. The run holds its height for 0.6 s, then droops at 1.5 m/s²;
//   after 1.6 s on one wall you drop off.
// - Wall-kick: Jump on a wall kicks you up and across to the facing wall (8 m/s up, 6.5 m/s out); the
//   catch on the far wall restarts the run. The kick chain is the combo (x1-x5).
// - Column whip: pass a stone column at speed and you swing 90° round it into a new heading.
// - Wall-roll: Action on a wall rolls you into ball form for 0.4 s: spike panels pass over you.
// - The floor is a chasm; gap platforms are the rests and checkpoints.
import type { LevelId } from "@/arcade3d/types";
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import { comboBreak, comboHit, comboMaxBonus, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, stepProgress, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DEFAULT_HERO, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { COMBO, COMBO_BASE_MS, SECRETS, UMBRA } from "./progression";
import { HALF_W, buildCourse, ramAt, wallOut, type Box, type Course, type Vec3, type Wall } from "./course";

export const NONE = -1;
export const MAX_STEP_MS = 50;
export const SUB_MS = 8;

export const G = 20;
export const V_RUN = 6.5;
export const V_JUMP = 8;
export const AIR = 14;
export const V_AIR_CAP = 9;
export const V_WALL = 7;
export const KICK_UP = 8;
export const KICK_OUT = 6.5;
export const RUN_MS = 1600;
export const DROOP_START_MS = 600;
export const DROOP_ACC = 1.5;
export const CATCH_GRACE_MS = 150;
export const CATCH_REACH = 0.35;
export const BODY_R = 0.4;
export const ROLL_MS = 500;
export const ROLL_COOLDOWN_MS = 900;
export const WHIP_SPEED_MIN = 5;
export const WHIP_EXIT = 8;
export const WHIP_CAP = 10;
export const WHIP_REACH = 0.95;
export const CRUMBLE_MS = 800;
export const ORB = { pickup: 1.1, bonusMs: 50 } as const;
export const LOST_MS = 650;
export const SPAWN_MS = 400;

export type MoveMode = "ground" | "air" | "wall" | "whip" | "lost" | "spawn";

export interface Hero {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   mode: MoveMode;
   support: number;
   faceX: number;
   faceZ: number;
   /** on a wall: its index, the ms on it, the run direction along its axis (-1, 0, 1) */
   wall: number;
   wallT: number;
   runDir: number;
   /** the wall last kicked from (no instant re-catch) and when */
   wallLast: number;
   wallLastAt: number;
   /** the last ms the stick pointed into a wall face (the catch grace), and that wall */
   holdAt: number;
   /** the kick chain is live (a catch after a kick links the combo) */
   chaining: boolean;
   rollUntil: number;
   rollReadyAt: number;
   /** column whip: column, centre, radius, angle, direction, swept, speed */
   col: number;
   colR: number;
   colAng: number;
   colDir: number;
   colSwept: number;
   colSpeed: number;
   colLast: number;
   colLastAt: number;
   airJump: boolean;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   timer: number;
}

export interface StepInput {
   moveX: number;
   moveZ: number;
   yaw: number;
   jumpPressed: boolean;
   jumpHeld: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
}

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   caught: number;
   kicked: boolean;
   whipped: number;
   whipEnd: boolean;
   rolled: boolean;
   detached: boolean;
   landed: boolean;
   landedOn: number;
   checkpoint: number;
   orbCount: number;
   orbList: number[];
   lost: boolean;
   struck: boolean;
   respawned: boolean;
   floorReset: boolean;
   finished: boolean;
   timeup: boolean;
   powered: boolean;
   dashed: boolean;
   smashed: number;
   crumbled: number;
   comboBonus: number;
   secretCount: number;
   secretList: number[];
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   plateThrown: boolean;
}

/** Umbra (level 5): where he is and his shadow plate in flight */
export interface Umbra {
   x: number;
   y: number;
   z: number;
   visible: boolean;
   /** the wall he runs, or the hall column he waits at, or -1 */
   wall: number;
   column: number;
   plateLive: boolean;
   px: number;
   py: number;
   pz: number;
   /** the shaft climb's height above the shaft base (phase 3) */
   climb: number;
   /** the plate's flight: from (sx, sy, sz) to (ex, sy, ez) through the attack step */
   throwing: boolean;
   sx: number;
   sy: number;
   sz: number;
   ex: number;
   ez: number;
}

export interface WallRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   startX: number;
   startZ: number;
   simMs: number;
   remainder: number;
   hero: Hero;
   jumpLatch: number;
   powerReadyAt: number;
   checkpoint: number;
   respawns: number;
   /** the no-fall badge: falls and resets */
   hits: number;
   /** landings on a non-checkpoint pad (the "Never Touch the Floor" sticker needs none) */
   offCp: number;
   collected: Uint8Array;
   broken: Uint8Array;
   /** crumbling walls: when the first run on them started (-1 never), and 1 once crumbled */
   crumbleAt: Float64Array;
   crumbled: Uint8Array;
   colCooldown: Float64Array;
   /** flow links paid so far by kicks and whips (each capped: the proof counts at most this many) */
   kickLinks: number;
   whipLinks: number;
   inHull: boolean;
   orbs: number;
   mainOrbs: number;
   combo: ComboState;
   secrets: SecretTracker;
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
   boss: BossState | null;
   bossEv: BossEvents;
   umbra: Umbra;
   /** the hall column the hero whipped last in phase 2 (Umbra waits at the next one) */
   hallDone: number;
   /** multiplayer */
   multi: boolean;
   versus: boolean;
   seat: number;
}

const STICK = { x: 0, z: 0 };
const P: Vec3 = { x: 0, y: 0, z: 0 };

function createEvents(): StepEvents {
   return {
      jumped: false, airJumped: false, caught: NONE, kicked: false, whipped: NONE, whipEnd: false, rolled: false, detached: false,
      landed: false, landedOn: NONE, checkpoint: NONE, orbCount: 0, orbList: new Array<number>(24).fill(0),
      lost: false, struck: false, respawned: false, floorReset: false, finished: false, timeup: false,
      powered: false, dashed: false, smashed: NONE, crumbled: NONE, comboBonus: 0, secretCount: 0, secretList: [0, 0, 0, 0],
      bossHit: false, bossPhase: false, bossDefeated: false, plateThrown: false,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.jumped = ev.airJumped = ev.kicked = ev.whipEnd = ev.rolled = ev.detached = ev.landed = false;
   ev.lost = ev.struck = ev.respawned = ev.floorReset = ev.finished = ev.timeup = false;
   ev.powered = ev.dashed = ev.bossHit = ev.bossPhase = ev.bossDefeated = ev.plateThrown = false;
   ev.caught = ev.whipped = ev.landedOn = ev.checkpoint = ev.smashed = ev.crumbled = NONE;
   ev.orbCount = ev.secretCount = ev.comboBonus = 0;
}

function freshHero(x: number, y: number, z: number): Hero {
   return {
      x, y, z, vx: 0, vy: 0, vz: 0, mode: "ground", support: 0, faceX: 1, faceZ: 0,
      wall: NONE, wallT: 0, runDir: 1, wallLast: NONE, wallLastAt: -9999, holdAt: -9999, chaining: false,
      rollUntil: -1, rollReadyAt: 0,
      col: NONE, colR: 1, colAng: 0, colDir: 1, colSwept: 0, colSpeed: 0, colLast: NONE, colLastAt: -9999,
      airJump: true, dashUntil: -1, dashX: 1, dashZ: 0, shieldUntil: -1, magnetUntil: -1, phaseUntil: -1, timer: 0,
   };
}

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(level));
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): WallRun {
   const course = courseFor(level);
   const s = course.pads[0];
   return {
      course, level, heroId, seed, startX: s.x, startZ: s.z, simMs: 0, remainder: 0,
      hero: freshHero(s.x, s.y, s.z),
      jumpLatch: NONE, powerReadyAt: 0, checkpoint: 0, respawns: 0, hits: 0, offCp: 0,
      collected: new Uint8Array(course.orbs.length),
      broken: new Uint8Array(course.blocks.length),
      crumbleAt: new Float64Array(course.walls.length).fill(-1),
      crumbled: new Uint8Array(course.walls.length),
      colCooldown: new Float64Array(course.columns.length),
      kickLinks: 0, whipLinks: 0, inHull: false, orbs: 0, mainOrbs: 0, combo: createCombo(), secrets: createSecretTracker(SECRETS[level]),
      finishMs: 0, ended: null, events: createEvents(),
      boss: course.boss ? createBoss(UMBRA) : null,
      bossEv: createBossEvents(),
      umbra: { x: 0, y: -50, z: 0, visible: false, wall: NONE, column: NONE, plateLive: false, px: 0, py: 0, pz: 0, climb: 0, throwing: false, sx: 0, sy: 0, sz: 0, ex: 0, ez: 0 },
      hallDone: NONE,
      multi: false, versus: false, seat: 0,
   };
}

const finite = (v: number) => (Number.isFinite(v) ? v : 0);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// ---------------- geometry ----------------

/** The hero's coordinate along a wall's axis, and across it (the face's plane axis). */
function along(w: Wall, x: number, z: number): number {
   return w.axis === "x" ? x : z;
}
function across(w: Wall, x: number, z: number): number {
   return w.axis === "x" ? z : x;
}

/** Can the hero run this wall now? */
export function runnable(run: WallRun, i: number): boolean {
   const w = run.course.walls[i];
   if (run.crumbled[i]) return false;
   if (w.kind === "ghost") return false;
   return wallOut(w, run.simMs);
}

/** How far a moving panel sits back into the cliff while it is in (m). */
export const PANEL_IN = 1.2;

/** A wall's solid box (behind its face; a moving panel that is in sits PANEL_IN back), or null once crumbled. */
export function wallBox(run: WallRun, i: number, out: Box): Box | null {
   const w = run.course.walls[i];
   if (run.crumbled[i]) return null;
   const face = wallOut(w, run.simMs) ? w.c : w.c - w.n * PANEL_IN;
   const back = face - w.n * 0.6;
   const c0 = Math.min(face, back);
   const c1 = Math.max(face, back);
   if (w.axis === "x") {
      out.x0 = w.a0; out.x1 = w.a1; out.z0 = c0; out.z1 = c1;
   } else {
      out.z0 = w.a0; out.z1 = w.a1; out.x0 = c0; out.x1 = c1;
   }
   out.y0 = w.y0;
   out.y1 = w.y1;
   return out;
}

function overlap(x: number, y: number, z: number, b: Box): number {
   const cx = clamp(x, b.x0, b.x1);
   const cy = clamp(y, b.y0, b.y1);
   const cz = clamp(z, b.z0, b.z1);
   const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
   return d2 < BODY_R * BODY_R ? 1 : 0;
}

function pushOut(h: Hero, b: Box): void {
   const cy = h.y + 0.6;
   if (!overlap(h.x, cy, h.z, b)) return;
   const dl = h.x - b.x0;
   const dr = b.x1 - h.x;
   const dd = cy - b.y0;
   const du = b.y1 - cy;
   const df = h.z - b.z0;
   const db = b.z1 - h.z;
   const m = Math.min(dl, dr, dd, du, df, db);
   if (m === dl) { h.x = b.x0 - BODY_R; if (h.vx > 0) h.vx = 0; }
   else if (m === dr) { h.x = b.x1 + BODY_R; if (h.vx < 0) h.vx = 0; }
   else if (m === dd) { h.y = b.y0 - BODY_R - 0.6; if (h.vy > 0) h.vy = 0; }
   else if (m === du) { h.y = b.y1 + BODY_R - 0.6; if (h.vy < 0) h.vy = 0; }
   else if (m === df) { h.z = b.z0 - BODY_R; if (h.vz > 0) h.vz = 0; }
   else { h.z = b.z1 + BODY_R; if (h.vz < 0) h.vz = 0; }
}

const BOX: Box = { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 };

/** inside a Vexa room, `grow` m past its inner faces */
export function insideHull(course: Course, x: number, y: number, z: number, grow = 0): boolean {
   for (const b of course.hulls) {
      if (x > b.x0 - grow && x < b.x1 + grow && y > b.y0 - grow && y < b.y1 + grow && z > b.z0 - grow && z < b.z1 + grow) return true;
   }
   return false;
}

function phasing(h: Hero, ms: number): boolean {
   return h.phaseUntil >= ms;
}

export function blockSolid(run: WallRun, i: number): boolean {
   const b = run.course.blocks[i];
   if (b.kind === "cracked") return !run.broken[i];
   return !run.boss || run.boss.phase < b.gatePhase;
}

function collide(run: WallRun, ev: StepEvents): void {
   const h = run.hero;
   const c = run.course;
   for (let i = 0; i < c.walls.length; i++) {
      if (h.mode === "wall" && h.wall === i) continue;
      const w = c.walls[i];
      if (w.kind === "moving") {
         // a sliding panel always pushes the hero back toward the corridor (never behind it)
         const al = along(w, h.x, h.z);
         if (al < w.a0 - BODY_R || al > w.a1 + BODY_R || h.y + 0.6 < w.y0 || h.y > w.y1) continue;
         const d = (across(w, h.x, h.z) - w.c) * w.n;
         const face = wallOut(w, run.simMs) ? 0 : -PANEL_IN;
         if (d < face + BODY_R && d > -PANEL_IN - 0.6 - BODY_R) {
            const want = w.c + w.n * (face + BODY_R);
            if (w.axis === "x") {
               h.z = want;
               if (h.vz * w.n < 0) h.vz = 0;
            } else {
               h.x = want;
               if (h.vx * w.n < 0) h.vx = 0;
            }
         }
         continue;
      }
      if (wallBox(run, i, BOX)) pushOut(h, BOX);
   }
   for (let i = 0; i < c.blocks.length; i++) {
      const b = c.blocks[i];
      if (!blockSolid(run, i)) continue;
      if (b.kind === "cracked" && h.dashUntil >= run.simMs && overlap(h.x, h.y + 0.6, h.z, b)) {
         run.broken[i] = 1;
         ev.smashed = i;
         continue;
      }
      pushOut(h, b);
   }
   if (!phasing(h, run.simMs) && !run.inHull) for (const g of c.ghosts) pushOut(h, g);
   for (const k of c.corners) pushOut(h, k);
   // columns are round: push out in xz
   for (let i = 0; i < c.columns.length; i++) {
      if (h.mode === "whip" && h.col === i) continue;
      const col = c.columns[i];
      if (h.y + 0.6 < col.y0 || h.y > col.y1) continue;
      const dx = h.x - col.x;
      const dz = h.z - col.z;
      const d = Math.hypot(dx, dz);
      const min = col.r + BODY_R;
      if (d < min && d > 1e-6) {
         h.x = col.x + (dx / d) * min;
         h.z = col.z + (dz / d) * min;
      }
   }
}

// ---------------- pads ----------------

function padAt(c: Course, x: number, z: number, y: number): number {
   let best = NONE;
   let top = -Infinity;
   for (let i = 0; i < c.pads.length; i++) {
      const s = c.pads[i];
      if (s.y > y + 0.25 || s.y < top) continue;
      if (Math.abs(x - s.x) <= s.r && Math.abs(z - s.z) <= s.r) {
         best = i;
         top = s.y;
      }
   }
   return best;
}

function crossedPad(c: Course, x: number, z: number, y0: number, y1: number): number {
   let best = NONE;
   let top = -Infinity;
   for (let i = 0; i < c.pads.length; i++) {
      const s = c.pads[i];
      if (y0 < s.y - 0.25 || y1 > s.y + 0.35 || s.y < top) continue;
      if (Math.abs(x - s.x) <= s.r && Math.abs(z - s.z) <= s.r) {
         best = i;
         top = s.y;
      }
   }
   return best;
}

// ---------------- life and death ----------------

function lose(run: WallRun, ev: StepEvents, struck: boolean): void {
   const h = run.hero;
   if (h.mode === "lost" || h.mode === "spawn" || run.ended) return;
   h.mode = "lost";
   h.wall = NONE;
   h.col = NONE;
   h.timer = 0;
   h.chaining = false;
   comboBreak(run.combo);
   run.hits += 1;
   ev.lost = true;
   ev.struck = struck;
}

function respawnAt(run: WallRun, ev: StepEvents): void {
   const h = run.hero;
   const s = run.course.pads[run.checkpoint];
   h.x = s.x;
   h.y = s.y;
   h.z = s.z;
   h.vx = h.vy = h.vz = 0;
   h.mode = "spawn";
   h.timer = 0;
   h.support = run.checkpoint;
   h.wall = NONE;
   h.col = NONE;
   run.inHull = false;
   // crumbled walls come back, so a respawn never strands the hero
   run.crumbled.fill(0);
   run.crumbleAt.fill(-1);
   clampReach(run);
   run.respawns += 1;
   ev.respawned = true;
}

function win(run: WallRun, ev: StepEvents): void {
   if (run.ended) return;
   run.finishMs = run.simMs;
   run.ended = "win";
   ev.finished = true;
   // "Never Touch the Floor": no pad but the checkpoints all the way (secret 0 on every level)
   if (run.offCp === 0 && run.hits === 0 && SECRETS[run.level][0]?.id === "floorless" && collectSecret(run.secrets, 0)) {
      ev.secretList[ev.secretCount++] = 0;
   }
}

function land(run: WallRun, index: number, ev: StepEvents): void {
   const h = run.hero;
   const s = run.course.pads[index];
   if (s.kind === "floor") {
      // level 1's safety floor: a soft reset to the checkpoint (no fall counted)
      comboBreak(run.combo);
      h.chaining = false;
      ev.floorReset = true;
      respawnAt(run, ev);
      return;
   }
   h.mode = "ground";
   h.y = s.y;
   h.vy = 0;
   h.support = index;
   h.wall = NONE;
   h.airJump = true;
   if (h.chaining) comboBreak(run.combo);
   h.chaining = false;
   ev.landed = true;
   ev.landedOn = index;
   if (s.cp) {
      if (run.checkpoint !== index && run.course.pads[run.checkpoint].x + run.course.pads[run.checkpoint].z <= s.x + s.z + 1e3) ev.checkpoint = index;
      run.checkpoint = index;
      run.crumbled.fill(0);
      run.crumbleAt.fill(-1);
      if (index === run.course.finish && !run.course.boss) win(run, ev);
   } else if (s.kind !== "start") {
      run.offCp += 1;
   }
}

// ---------------- moves ----------------

function stickWorld(input: StepInput): { x: number; z: number; m: number } {
   inputToWorld(finite(input.moveX), finite(input.moveZ), finite(input.yaw), STICK);
   return { x: STICK.x, z: STICK.z, m: Math.hypot(STICK.x, STICK.z) };
}

function firePower(run: WallRun, input: StepInput, ev: StepEvents): void {
   const h = run.hero;
   if (run.simMs < run.powerReadyAt) return;
   const id = run.heroId;
   if (id === "nami") return;
   if (id === "riko") {
      const s = stickWorld(input);
      let dx = s.m > 0.2 ? s.x / s.m : h.faceX;
      let dz = s.m > 0.2 ? s.z / s.m : h.faceZ;
      const m = Math.hypot(dx, dz) || 1;
      dx /= m;
      dz /= m;
      h.dashX = dx;
      h.dashZ = dz;
      h.dashUntil = run.simMs + POWER_MS.dash;
      if (h.mode === "ground") h.mode = "air";
      h.vy = Math.max(h.vy, 1.5);
      ev.dashed = true;
   } else if (id === "kiro") h.shieldUntil = run.simMs + POWER_MS.shield;
   else if (id === "zuno") h.magnetUntil = run.simMs + POWER_MS.magnet;
   else h.phaseUntil = run.simMs + POWER_MS.phase;
   run.powerReadyAt = run.simMs + heroById(id).cooldownMs;
   ev.powered = true;
}

function tryCatch(run: WallRun, input: StepInput, ev: StepEvents): boolean {
   const h = run.hero;
   const c = run.course;
   const s = stickWorld(input);
   for (let i = 0; i < c.walls.length; i++) {
      if (!runnable(run, i)) continue;
      if (i === h.wallLast && run.simMs - h.wallLastAt < 300) continue;
      const w = c.walls[i];
      const a = along(w, h.x, h.z);
      if (a < w.a0 + 0.15 || a > w.a1 - 0.15) continue;
      if (h.y < w.y0 || h.y > w.y1 - 1.2) continue;
      const d = (across(w, h.x, h.z) - w.c) * w.n;
      if (d < 0 || d > BODY_R + CATCH_REACH) continue;
      // moving into the face, or the stick held into it (now or within the grace)
      const vIn = -(w.axis === "x" ? h.vz : h.vx) * w.n;
      const sIn = -(w.axis === "x" ? s.z : s.x) * w.n;
      if (sIn > 0.3) h.holdAt = run.simMs;
      if (vIn < 0.5 && run.simMs - h.holdAt > CATCH_GRACE_MS) continue;
      // stick
      const va = w.axis === "x" ? h.vx : h.vz;
      const sa = w.axis === "x" ? s.x : s.z;
      h.mode = "wall";
      h.wall = i;
      h.wallT = 0;
      h.runDir = w.kind === "shaft" ? 0 : Math.abs(va) > 0.8 ? Math.sign(va) : Math.abs(sa) > 0.2 ? Math.sign(sa) : h.runDir || 1;
      h.vy = 0;
      if (w.axis === "x") h.z = w.c + w.n * BODY_R;
      else h.x = w.c + w.n * BODY_R;
      h.airJump = true;
      if (w.kind === "crumble" && run.crumbleAt[i] < 0) run.crumbleAt[i] = run.simMs;
      if (h.chaining) {
         // the chain links on every catch; only the first KICK_LINKS of a run pay flow time
         const base = run.kickLinks < KICK_LINKS ? COMBO_BASE_MS.kick : 0;
         run.kickLinks += 1;
         ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, base);
      }
      h.chaining = false;
      ev.caught = i;
      return true;
   }
   return false;
}

function detach(run: WallRun, ev: StepEvents, push = 1): void {
   const h = run.hero;
   const w = run.course.walls[h.wall];
   if (w) {
      if (w.axis === "x") {
         h.vx = V_WALL * h.runDir;
         h.vz = w.n * push;
      } else {
         h.vz = V_WALL * h.runDir;
         h.vx = w.n * push;
      }
   }
   h.wallLast = h.wall;
   h.wallLastAt = run.simMs;
   h.wall = NONE;
   h.mode = "air";
   ev.detached = true;
}

function tryWhip(run: WallRun, ev: StepEvents): boolean {
   const h = run.hero;
   const cols = run.course.columns;
   const sp = Math.hypot(h.vx, h.vz);
   if (sp < WHIP_SPEED_MIN) return false;
   for (let i = 0; i < cols.length; i++) {
      if (run.colCooldown[i] > run.simMs) continue;
      const c = cols[i];
      if (h.y + 0.6 < c.y0 || h.y > c.y1) continue;
      const dx = h.x - c.x;
      const dz = h.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d > c.r + WHIP_REACH) continue;
      // only when coming up to it: from 1.2 m before the closest point to just past it
      const ahead = (dx * h.vx + dz * h.vz) / sp;
      if (ahead > 0.3 || ahead < -1.2) continue;
      // the grab snaps to the closest point (the radius square to the travel), so the whip turns
      // the travel by exactly 90° (a snap of at most 1.2 m along it)
      const px = dx - (ahead * h.vx) / sp;
      const pz = dz - (ahead * h.vz) / sp;
      const pd = Math.hypot(px, pz) || 1e-3;
      h.mode = "whip";
      h.col = i;
      h.colR = clamp(pd, c.r + 0.35, c.r + WHIP_REACH);
      h.colAng = Math.atan2(pz, px);
      h.x = c.x + Math.cos(h.colAng) * h.colR;
      h.z = c.z + Math.sin(h.colAng) * h.colR;
      // positive = counter-clockwise seen from +y (x toward -z... the sign of the angular velocity)
      const cross = dz * h.vx - dx * h.vz;
      h.colDir = cross >= 0 ? -1 : 1;
      h.colSwept = 0;
      h.colSpeed = clamp(Math.max(sp, WHIP_EXIT), WHIP_EXIT, WHIP_CAP);
      h.vy = 0;
      h.wall = NONE;
      if (h.chaining) {
         const base = run.whipLinks < run.course.columns.length * 2 ? COMBO_BASE_MS.whip : 0;
         run.whipLinks += 1;
         ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, base);
      }
      h.chaining = false;
      ev.whipped = i;
      bossWhip(run, i, ev);
      return true;
   }
   return false;
}

function whipStep(run: WallRun, dt: number, ev: StepEvents): void {
   const h = run.hero;
   const c = run.course.columns[h.col];
   const w = h.colSpeed / h.colR;
   h.colAng += h.colDir * w * dt;
   h.colSwept += w * dt;
   h.x = c.x + Math.cos(h.colAng) * h.colR;
   h.z = c.z + Math.sin(h.colAng) * h.colR;
   // the tangent of the orbit
   const tx = -Math.sin(h.colAng) * h.colDir;
   const tz = Math.cos(h.colAng) * h.colDir;
   h.vx = tx * h.colSpeed;
   h.vz = tz * h.colSpeed;
   h.faceX = tx;
   h.faceZ = tz;
   if (h.colSwept >= Math.PI / 2) {
      run.colCooldown[h.col] = run.simMs + 500;
      h.colLast = h.col;
      h.colLastAt = run.simMs;
      h.col = NONE;
      h.mode = "air";
      h.vy = 5;
      h.chaining = true;
      ev.whipEnd = true;
   }
}

function wallStep(run: WallRun, dt: number, input: StepInput, edge: boolean, ev: StepEvents): void {
   const h = run.hero;
   const i = h.wall;
   const w = run.course.walls[i];
   if (!runnable(run, i)) {
      detach(run, ev, 0.5);
      return;
   }
   if (w.kind === "crumble" && run.crumbleAt[i] >= 0 && run.simMs - run.crumbleAt[i] >= CRUMBLE_MS) {
      run.crumbled[i] = 1;
      ev.crumbled = i;
      detach(run, ev, 0.5);
      return;
   }
   h.wallT += dt * 1000;
   const v = w.kind === "shaft" ? 0 : V_WALL * h.runDir;
   if (w.axis === "x") {
      h.x += v * dt;
      h.vx = v;
      h.vz = 0;
      h.faceX = Math.sign(v) || h.faceX;
      h.faceZ = 0;
   } else {
      h.z += v * dt;
      h.vz = v;
      h.vx = 0;
      h.faceZ = Math.sign(v) || h.faceZ;
      h.faceX = 0;
   }
   if (h.wallT > DROOP_START_MS) h.vy -= DROOP_ACC * dt;
   if (w.kind === "shaft") h.vy -= 3 * dt;
   h.y += h.vy * dt;
   // a kick: up and across
   if (run.jumpLatch >= 0 && run.simMs - run.jumpLatch <= 140) {
      run.jumpLatch = NONE;
      const along = w.kind === "shaft" ? 0 : V_WALL * h.runDir;
      if (w.axis === "x") {
         h.vx = along;
         h.vz = w.n * KICK_OUT;
      } else {
         h.vz = along;
         h.vx = w.n * KICK_OUT;
      }
      h.vy = KICK_UP;
      h.wallLast = i;
      h.wallLastAt = run.simMs;
      h.wall = NONE;
      h.mode = "air";
      h.chaining = true;
      h.airJump = true;
      ev.kicked = true;
      return;
   }
   if (edge && run.simMs >= h.rollReadyAt) {
      h.rollUntil = run.simMs + ROLL_MS;
      h.rollReadyAt = run.simMs + ROLL_COOLDOWN_MS;
      ev.rolled = true;
   }
   let a = along(w, h.x, h.z);
   if (a < w.a0 || a > w.a1) {
      // run on across the seam onto the next panel of the same face
      const next = panelAt(run, i, a, h.y);
      if (next !== NONE) {
         h.wall = next;
         const nw = run.course.walls[next];
         // the crack timer runs with the run, not the panel: a seam does not buy time
         if (nw.kind === "crumble" && run.crumbleAt[next] < 0) run.crumbleAt[next] = w.kind === "crumble" && run.crumbleAt[i] >= 0 ? run.crumbleAt[i] : run.simMs;
         a = along(nw, h.x, h.z);
         return;
      }
   }
   if (h.wallT >= RUN_MS || a < w.a0 || a > w.a1 || h.y < w.y0 + 0.1) {
      detach(run, ev, a < w.a0 || a > w.a1 ? 0 : 1);
      return;
   }
   void input;
}

/** The runnable panel of the same face as wall `i` that holds `a` along its axis at height `y`, or NONE. */
function panelAt(run: WallRun, i: number, a: number, y: number): number {
   const w = run.course.walls[i];
   const walls = run.course.walls;
   for (let k = 0; k < walls.length; k++) {
      if (k === i) continue;
      const o = walls[k];
      if (o.axis !== w.axis || o.n !== w.n || Math.abs(o.c - w.c) > 0.01) continue;
      if (a < o.a0 || a > o.a1 || y < o.y0 || y > o.y1 - 0.6) continue;
      if (!runnable(run, k)) continue;
      return k;
   }
   return NONE;
}

function airStep(run: WallRun, dt: number, input: StepInput, edge: boolean, ev: StepEvents): void {
   const h = run.hero;
   if (h.dashUntil >= run.simMs) {
      h.vx = h.dashX * V_DASH;
      h.vz = h.dashZ * V_DASH;
   } else {
      const s = stickWorld(input);
      if (s.m > 0.15) {
         h.vx += (s.x / s.m) * AIR * dt * Math.min(1, s.m);
         h.vz += (s.z / s.m) * AIR * dt * Math.min(1, s.m);
      }
      const hs = Math.hypot(h.vx, h.vz);
      const cap = Math.max(V_AIR_CAP, Math.min(WHIP_CAP, hs - 6 * dt));
      if (hs > cap) {
         h.vx *= cap / hs;
         h.vz *= cap / hs;
      }
   }
   h.vy -= G * dt;
   const y0 = h.y;
   h.x += h.vx * dt;
   h.y += h.vy * dt;
   h.z += h.vz * dt;
   collide(run, ev);
   if (run.jumpLatch >= 0 && run.simMs - run.jumpLatch <= 140 && run.heroId === "nami" && h.airJump) {
      run.jumpLatch = NONE;
      h.vy = V_JUMP;
      h.airJump = false;
      ev.airJumped = true;
   }
   if (edge) firePower(run, input, ev);
   if (tryWhip(run, ev)) return;
   if (tryCatch(run, input, ev)) return;
   if (h.vy <= 0.8) {
      const pad = crossedPad(run.course, h.x, h.z, y0, h.y);
      if (pad !== NONE) land(run, pad, ev);
   }
}

function groundStep(run: WallRun, dt: number, input: StepInput, edge: boolean, ev: StepEvents): void {
   const h = run.hero;
   const s = stickWorld(input);
   if (h.dashUntil >= run.simMs) {
      h.vx = h.dashX * V_DASH;
      h.vz = h.dashZ * V_DASH;
   } else if (s.m > 0.12) {
      const k = Math.min(1, s.m);
      h.vx += ((s.x / s.m) * V_RUN * k - h.vx) * Math.min(1, 12 * dt);
      h.vz += ((s.z / s.m) * V_RUN * k - h.vz) * Math.min(1, 12 * dt);
      h.faceX = s.x / s.m;
      h.faceZ = s.z / s.m;
   } else {
      h.vx *= Math.max(0, 1 - 14 * dt);
      h.vz *= Math.max(0, 1 - 14 * dt);
   }
   h.x += h.vx * dt;
   h.z += h.vz * dt;
   const sup = run.course.pads[h.support];
   const still = padAt(run.course, h.x, h.z, sup.y + 0.3);
   collide(run, ev);
   if (still === NONE) {
      h.mode = "air";
      h.vy = 0;
      return;
   }
   h.support = still;
   h.y = run.course.pads[still].y;
   if (run.jumpLatch >= 0 && run.simMs - run.jumpLatch <= 140) {
      run.jumpLatch = NONE;
      h.mode = "air";
      h.vy = V_JUMP;
      h.airJump = true;
      ev.jumped = true;
      return;
   }
   if (edge) firePower(run, input, ev);
}

// ---------------- pickups, hazards ----------------

function pickup(run: WallRun, ev: StepEvents): void {
   const h = run.hero;
   if (h.mode === "lost" || h.mode === "spawn") return;
   const reach = h.magnetUntil >= run.simMs ? MAGNET_REACH : ORB.pickup;
   const orbs = run.course.orbs;
   for (let i = 0; i < orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = orbs[i];
      const dx = h.x - o.x;
      const dy = h.y + 0.7 - o.y;
      const dz = h.z - o.z;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.kind === "main") run.mainOrbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
      ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, COMBO_BASE_MS.orb);
   }
   const spots = run.course.secrets;
   for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      // secret 0 is the floor-free run (given at the finish), not a place
      if (SECRETS[run.level][i]?.id === "floorless") continue;
      const dx = h.x - s.x;
      const dy = h.y + 0.6 - s.y;
      const dz = h.z - s.z;
      if (dx * dx + dy * dy + dz * dz > s.r * s.r) continue;
      if (collectSecret(run.secrets, i)) ev.secretList[ev.secretCount++] = i;
   }
}

export function rolled(h: Hero, ms: number): boolean {
   return h.rollUntil >= ms;
}

function hurt(run: WallRun, ev: StepEvents): void {
   const h = run.hero;
   if (h.mode === "lost" || h.mode === "spawn") return;
   const shield = h.shieldUntil >= run.simMs;
   const c = run.course;
   const cy = h.y + 0.6;
   if (!rolled(h, run.simMs)) {
      for (const s of c.spikes) {
         if (overlap(h.x, cy, h.z, s)) return lose(run, ev, true);
      }
   }
   if (shield) return;
   for (const d of c.darts) {
      const dx = h.x - d.x;
      const dy = cy - d.y;
      const dz = h.z - d.z;
      if (dx * dx + dy * dy + dz * dz < d.r * d.r) return lose(run, ev, true);
   }
   for (const r of c.rams) {
      ramAt(r, run.simMs, P);
      const dx = h.x - P.x;
      const dy = cy - P.y;
      const dz = h.z - P.z;
      if (dx * dx + dy * dy + dz * dz < (r.r + BODY_R) ** 2) return lose(run, ev, true);
   }
   const u = run.umbra;
   if (u.plateLive) {
      const dx = h.x - u.px;
      const dy = cy - u.py;
      const dz = h.z - u.pz;
      if (dx * dx + dy * dy + dz * dz < 0.9 * 0.9) return lose(run, ev, true);
   }
}

// ---------------- the boss: Umbra ----------------

function bossFrame(run: WallRun, dtMs: number, ev: StepEvents): void {
   const b = run.boss;
   const a = run.course.arena;
   if (!b || !a) return;
   const bev = stepBoss(b, UMBRA, dtMs, run.bossEv);
   if (bev.phaseChanged) ev.bossPhase = true;
   const h = run.hero;
   const u = run.umbra;
   u.plateLive = false;
   u.visible = b.step !== "done";
   u.column = NONE;
   u.wall = NONE;
   if (b.phase === 0) {
      // he runs the facing wall level with you; between windows he weaves above and below
      const mine = h.mode === "wall" ? h.wall : NONE;
      let wi = NONE;
      for (let k = 0; k < a.mirror.length; k += 2) {
         const w0 = run.course.walls[a.mirror[k]];
         const at = along(w0, h.x, h.z);
         if (at >= w0.a0 - 2 && at <= w0.a1 + 2) wi = mine === a.mirror[k] ? a.mirror[k + 1] : mine === a.mirror[k + 1] ? a.mirror[k] : a.mirror[k + (h.z > w0.c ? 0 : 1)];
      }
      // outside the mirror corridors he waits at the first one's start (no plates)
      const inMirror = wi !== NONE;
      if (wi === NONE) wi = a.mirror[1];
      const w = run.course.walls[wi];
      const at = inMirror ? clamp(along(w, h.x, h.z), w.a0, w.a1) : w.a0 + 1;
      const weave = b.step === "vulnerable" ? 0 : 1.9 * Math.sin(run.simMs / 520);
      u.wall = wi;
      u.y = inMirror ? Math.max(w.y0 + 1, h.y + weave) : w.y0 + 3;
      if (w.axis === "x") {
         u.x = at;
         u.z = w.c + w.n * BODY_R;
      } else {
         u.z = at;
         u.x = w.c + w.n * BODY_R;
      }
      // the shadow plate: thrown flat across the corridor at his height when the attack starts (it does
      // not home: rise or drop on the wall to let it pass)
      if (bev.attack && inMirror) {
         u.sx = u.x;
         u.sy = u.y + 0.8;
         u.sz = u.z;
         // across to the facing wall at the same along-position
         u.ex = w.axis === "x" ? u.x : u.x + w.n * (2 * HALF_W - 2 * BODY_R);
         u.ez = w.axis === "x" ? u.z + w.n * (2 * HALF_W - 2 * BODY_R) : u.z;
         u.throwing = true;
         ev.plateThrown = true;
      }
      if (b.step === "attack" && u.throwing) {
         const k = stepProgress(b, UMBRA);
         u.plateLive = true;
         u.px = u.sx + (u.ex - u.sx) * k;
         u.py = u.sy;
         u.pz = u.sz + (u.ez - u.sz) * k;
      } else if (b.step !== "attack") u.throwing = false;
   } else if (b.phase === 1) {
      // he waits at the next hall column you have not whipped
      let k = 0;
      while (k < a.hall.length && a.hall[k] <= run.hallDone) k++;
      const ci = a.hall[Math.min(k, a.hall.length - 1)];
      const col = run.course.columns[ci];
      u.column = ci;
      u.x = col.x;
      u.z = col.z;
      u.y = run.course.pads[a.phaseCp[1]].y + 0.2;
   } else {
      // the shaft: he climbs the far wall; you must beat him to the glyph
      const sw = run.course.walls[a.shaft[1]];
      u.climb = Math.min(a.glyph.y - sw.y0 - 2, u.climb + (dtMs / 1000) * 0.8);
      u.wall = a.shaft[1];
      const mid = (sw.a0 + sw.a1) / 2;
      u.y = sw.y0 + 2 + u.climb;
      if (sw.axis === "x") {
         u.x = mid;
         u.z = sw.c + sw.n * BODY_R;
      } else {
         u.z = mid;
         u.x = sw.c + sw.n * BODY_R;
      }
   }
}

function bossTouch(run: WallRun, ev: StepEvents): void {
   const b = run.boss;
   const a = run.course.arena;
   if (!b || !a || b.step !== "vulnerable" || run.ended) return;
   const h = run.hero;
   const u = run.umbra;
   if (b.phase === 0) {
      if (h.mode !== "air") return;
      const d = Math.hypot(h.x - u.x, h.y - u.y, h.z - u.z);
      if (d < 1.6) noteBossHit(run, ev);
   } else if (b.phase === 2) {
      const g = a.glyph;
      if (Math.hypot(h.x - g.x, h.y + 0.6 - g.y, h.z - g.z) <= g.r) noteBossHit(run, ev);
   }
}

/** Phase 2: a whip round the column Umbra waits at, in his window, is a hit. */
function bossWhip(run: WallRun, column: number, ev: StepEvents): void {
   const b = run.boss;
   const a = run.course.arena;
   if (!b || !a || b.phase !== 1) return;
   if (a.hall.includes(column)) run.hallDone = Math.max(run.hallDone, column);
   if (b.step === "vulnerable" && run.umbra.column === column) noteBossHit(run, ev);
}

function noteBossHit(run: WallRun, ev: StepEvents): void {
   const b = run.boss;
   const a = run.course.arena;
   if (!b || !a) return;
   const result = hitBoss(b, UMBRA, 1, run.bossEv);
   if (result === "ignored") return;
   ev.bossHit = true;
   ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, COMBO_BASE_MS.boss);
   if (result === "phase") {
      ev.bossPhase = true;
      const cp = a.phaseCp[b.phase] ?? NONE;
      if (cp >= 0) run.checkpoint = cp;
   }
   if (result === "defeated") {
      ev.bossDefeated = true;
      win(run, ev);
   }
}

// ---------------- the step ----------------

/** The proof's guard: the hero's Manhattan distance (xz) from the start never passes V_PACE * t. */
export function reachOf(run: WallRun): number {
   return (V_PACE * run.simMs) / 1000;
}

/**
 * The proof's pace (m/s, Manhattan in xz from the start). An average from the start, not a top speed:
 * a dash or a whip exit is faster for a moment, the honest bots stay well under it (proof.test.ts).
 */
export const V_PACE = 12;

function clampReach(run: WallRun): void {
   const h = run.hero;
   const dx = h.x - run.startX;
   const dz = h.z - run.startZ;
   const m = Math.abs(dx) + Math.abs(dz);
   const lim = reachOf(run);
   if (m > lim && m > 0) {
      const k = lim / m;
      h.x = run.startX + dx * k;
      h.z = run.startZ + dz * k;
   }
}

function substep(run: WallRun, dtMs: number, input: StepInput, edge: boolean, ev: StepEvents): void {
   const h = run.hero;
   run.simMs += dtMs;
   const dt = dtMs / 1000;
   if (h.mode === "lost") {
      h.timer += dtMs;
      if (h.timer >= LOST_MS) respawnAt(run, ev);
      return;
   }
   if (h.mode === "spawn") {
      h.timer += dtMs;
      if (h.timer >= SPAWN_MS) h.mode = "ground";
      return;
   }
   if (run.course.hulls.length > 0) {
      const cy = h.y + 0.6;
      if (insideHull(run.course, h.x, cy, h.z)) run.inHull = true;
      else if (run.inHull && !insideHull(run.course, h.x, cy, h.z, 0.3 + BODY_R + 0.05)) run.inHull = false;
   }
   if (h.mode === "wall") wallStep(run, dt, input, edge, ev);
   else if (h.mode === "whip") whipStep(run, dt, ev);
   else if (h.mode === "air") airStep(run, dt, input, edge, ev);
   else groundStep(run, dt, input, edge, ev);
   clampReach(run);
   if (run.ended) return;
   if (h.y < lowestY(run.course) - 10) lose(run, ev, false);
}

const LOWEST = new WeakMap<Course, number>();
function lowestY(c: Course): number {
   let v = LOWEST.get(c);
   if (v === undefined) {
      v = Math.min(...c.pads.map((p) => p.y), ...c.walls.map((w) => w.y0));
      LOWEST.set(c, v);
   }
   return v;
}

export function step(run: WallRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   if (run.ended !== null || !(dtMs > 0)) return ev;
   if (input.jumpPressed) run.jumpLatch = run.simMs;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   if (whole <= 0) return ev;
   bossFrame(run, whole, ev);
   let left = whole;
   let edge = input.actionPressed;
   while (left > 0 && run.ended === null) {
      const d = Math.min(SUB_MS, left);
      substep(run, d, input, edge, ev);
      edge = false;
      left -= d;
      if (run.hero.mode === "lost") break;
      if (run.hero.mode !== "spawn") {
         hurt(run, ev);
         if ((run.hero.mode as string) === "lost") break;
      }
   }
   if (run.ended === null && run.hero.mode !== "lost") {
      pickup(run, ev);
      bossTouch(run, ev);
   }
   if (run.ended === null && run.simMs >= LEVELS[run.level].durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
   return ev;
}

// ---------------- the proof ----------------

let bossFloor = 0;

/** The least rules ms to land every Umbra hit, striking at the first moment of each window. */
export function bossMinMs(): number {
   if (bossFloor > 0) return bossFloor;
   const s = createBoss(UMBRA);
   const ev = createBossEvents();
   let ms = 0;
   while (s.hp > 0 && ms < 120_000) {
      stepBoss(s, UMBRA, 10, ev);
      ms += 10;
      if (s.step === "vulnerable") hitBoss(s, UMBRA, 1, ev);
   }
   bossFloor = ms;
   return ms;
}

/** No run gets farther (Manhattan, xz) from the start than V_PACE * t: the least time to the finish. */
export function travelFloorMs(course: Course): number {
   return (course.span / V_PACE) * 1000;
}

export function minFinishMs(course: Course): number {
   const travel = travelFloorMs(course);
   return course.boss ? Math.max(travel, bossMinMs()) : travel;
}

export function comboSpecOf(course: Course): ComboLevelSpec {
   // kicks and whips repeat: only the first KICK_LINKS of a run feed the meter (rules: chain counted)
   return {
      combo: COMBO,
      sources: [
         { count: course.orbs.length, base: COMBO_BASE_MS.orb },
         { count: KICK_LINKS, base: COMBO_BASE_MS.kick },
         { count: course.columns.length * 2, base: COMBO_BASE_MS.whip },
         { count: course.boss ? 5 : 0, base: COMBO_BASE_MS.boss },
      ],
   };
}

/** the most kick links a run's flow meter counts (later ones still chain, at no bonus) */
export const KICK_LINKS = 40;

export function minDurationMsOf(course: Course): number {
   return minFinishMs(course) - course.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(course));
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

export function proposeLimits(course: Course): LevelLimits {
   const lb = minDurationMsOf(course);
   if (!(lb > 200)) throw new Error(`wall-run-temple L${course.level} floor ${lb} is not positive`);
   const minDurationMs = Math.floor((lb * 0.95) / 100) * 100;
   const timeBaseMs = LEVELS[course.level].durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(courseFor(1)),
   2: proposeLimits(courseFor(2)),
   3: proposeLimits(courseFor(3)),
   4: proposeLimits(courseFor(4)),
   5: proposeLimits(courseFor(5)),
};

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   distance: "distance",
   finishMs: "finishMs",
   falls: "falls",
   hero: "hero",
   power: "power",
   mode: "mode",
   runLeft: "runLeft",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs - comboMs);
}

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

export function badgeHits(run: WallRun): number {
   return run.hits;
}
