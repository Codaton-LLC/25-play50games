// Portal Hop's rules: pure and deterministic (no three.js, React, DOM, Math.random or Date). Scene.tsx
// calls step() from one useRunFrame; the same level + hero + inputs always give the same run at any
// frame rate (the simulation advances in fixed 1000/120 ms steps).
//
// The signature mechanic (card "you choose where the exit opens"): every portal pair has one fixed
// ENTRY and up to four ANCHOR obelisks. The exit opens in front of the selected anchor; moving it takes
// 0.4 s (the pair is closed meanwhile). Speed in = speed out, along the exit's facing: fall 10 m into a
// floor pad and a pitched wall exit flings you 20 m. Nothing is placed freely (anchors only), so it reads
// on a phone: tap an obelisk, press 1-4, or the Exit button to cycle the nearest pair.
// Speed never exceeds V_CAP anywhere (the score proof rests on it: bound.ts).
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "../../types";
import { inputToWorld } from "@/arcade3d/core/math";
import { comboBreak, comboFlow, comboHit, comboMaxBonus, createCombo, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import { EXIT_UP, FRAME_HALF_H, FRAME_HALF_W, L5_CENTRE, TAU, courseFor, exitPose, islandOn, wrapPi, type Anchor, type Course, type ExitPose, type Island, type Pair } from "./course";
import { DASH_PORTAL_BONUS, DEFAULT_HERO, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import {
   BACK_REACH, BACK_SPEED, COMBO, COMBO_BASE_MS, DIVE_MS, HEAD_REACH, P1_DIVE_AT, P3_KNOT_AT, SECRETS, SWEEP_HALF, SWEEP_HIGH, SWEEP_R0, SWEEP_R1, WYRM, secretIndex, starSpecFor,
} from "./progression";

// ---------- tuning ----------

export const STEP_MS = 1000 / 120;
/** a frame longer than this is cut (the shell's own play dt cap is 50 ms) */
export const MAX_FRAME_MS = 50;
export const V_RUN = 6;
export const V_JUMP = 8;
/** Nami's second jump */
export const V_JUMP2 = 7.5;
export const GRAV = 20;
/** no speed anywhere goes over this (falls, exits, dashes): the score proof's bound */
export const V_CAP = 24;
/** an exit never lets you out slower than this */
export const MIN_OUT = 3;
export const GROUND_ACCEL = 45;
export const AIR_ACCEL = 7;
/** the hero's body: feet to centre (m), radius round it */
export const BODY_MID = 0.6;
export const BODY_R = 0.35;
/** an island's rock side reaches this far under its top (a ledge is a wall to anyone below it) */
export const SIDE_DEPTH = 6;
/** moving an exit to another anchor takes this long; the pair is closed meanwhile */
export const SWITCH_MS = 400;
/** after a teleport the same body cannot teleport again for this long */
export const PORT_COOLDOWN_MS = 250;
export const STUN_MS = 500;
export const INVULN_MS = 1200;
/** within this of an entry (m) the ghost arc shows where its exit flings you */
export const PREVIEW_REACH = 6;
export const ORB = { reach: 0.9, bonusMs: 100 } as const;
/** the void crystal cargo block: half its edge (m), the speed a push gives it, its sliding friction */
export const BLOCK_HALF = 0.6;
export const V_PUSH = 4;
export const BLOCK_FRICTION = 9;
/** a lost block comes back home after this long */
export const BLOCK_RESPAWN_MS = 1200;
/** "Terminal Velocity": out of an exit at this speed or more */
export const TERMINAL = 18;

// ---------- the run ----------

export interface Hero {
   /** the feet */
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   grounded: boolean;
   /** the island stood on (-1 none); a block is -2 - its index */
   ground: number;
   airJumped: boolean;
   /** out of an exit and not landed yet: the only time he may fly faster than a run (bound.ts) */
   flung: boolean;
   /** the way the hero faces (yaw) */
   facing: number;
}

export interface BlockState {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   grounded: boolean;
   portReadyAt: number;
   /** gone into the void: back home at this ms (-1 = here) */
   lostUntil: number;
}

export type WyrmMode = "circle" | "dive" | "emerge" | "coil" | "knot" | "gone";

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   landSpeed: number;
   teleported: boolean;
   /** the anchor the last teleport came out of, and its speed */
   exitAnchor: number;
   exitSpeed: number;
   ghostPass: boolean;
   closedPass: boolean;
   switched: number;
   opened: number;
   blockPorted: boolean;
   blockLost: boolean;
   plate: number;
   powered: boolean;
   orbCount: number;
   orbList: number[];
   secretCount: number;
   secretList: number[];
   comboBonus: number;
   comboLinked: boolean;
   hurt: "" | "fall" | "sweep";
   shielded: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossVulnerable: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   wyrmDive: boolean;
   wyrmEmerge: boolean;
   wyrmBonk: number;
   wyrmKnot: boolean;
   finished: boolean;
   timeup: boolean;
}

function createEvents(): StepEvents {
   return {
      jumped: false, airJumped: false, landed: false, landSpeed: 0, teleported: false, exitAnchor: -1, exitSpeed: 0, ghostPass: false, closedPass: false,
      switched: -1, opened: -1, blockPorted: false, blockLost: false, plate: -1, powered: false, orbCount: 0, orbList: [], secretCount: 0, secretList: [],
      comboBonus: 0, comboLinked: false, hurt: "", shielded: false,
      bossTelegraph: false, bossAttack: false, bossVulnerable: false, bossHit: false, bossPhase: false, bossDefeated: false,
      wyrmDive: false, wyrmEmerge: false, wyrmBonk: -1, wyrmKnot: false, finished: false, timeup: false,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.jumped = ev.airJumped = ev.landed = ev.teleported = ev.ghostPass = ev.closedPass = ev.blockPorted = ev.blockLost = ev.powered = false;
   ev.comboLinked = ev.shielded = ev.bossTelegraph = ev.bossAttack = ev.bossVulnerable = ev.bossHit = ev.bossPhase = ev.bossDefeated = false;
   ev.wyrmDive = ev.wyrmEmerge = ev.wyrmKnot = ev.finished = ev.timeup = false;
   ev.landSpeed = 0;
   ev.exitAnchor = ev.switched = ev.opened = ev.plate = ev.wyrmBonk = -1;
   ev.exitSpeed = ev.orbCount = ev.secretCount = ev.comboBonus = 0;
   ev.hurt = "";
}

export interface StepInput {
   /** the stick, -1..1 (up = -1) */
   moveX: number;
   moveZ: number;
   /** the camera's view yaw (menu2/camera orbit.viewYaw): the stick is camera-relative */
   yaw: number;
   jumpPressed: boolean;
   actionPressed: boolean;
   /** 1-4: open the nearest pair's exit on that anchor (0 = none) */
   digit: number;
   /** cycle the nearest pair's exit to its next anchor */
   cyclePressed: boolean;
   /** a tapped obelisk: open its pair's exit there (-1 = none) */
   pick: number;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false, digit: 0, cyclePressed: false, pick: -1 };
}

export interface PortalRun {
   seed: number;
   level: LevelId;
   heroId: HeroId;
   course: Course;
   simMs: number;
   acc: number;
   pendJump: boolean;
   pendAction: boolean;
   pendDigit: number;
   pendCycle: boolean;
   pendPick: number;
   hero: Hero;
   /** per pair: the selected anchor's index in pair.anchors, and the ms the move to it finishes */
   sel: number[];
   switchUntil: number[];
   switches: number;
   portReadyAt: number;
   /** per anchor: its exit has fed the flow meter (first pass only) */
   exitUsed: boolean[];
   teleports: number;
   lastExitSpeed: number;
   /** the island the hero last stood on (the void puts him back there) */
   checkpoint: number;
   gates: boolean[];
   blocks: BlockState[];
   /** this run steps the cargo blocks (local multiplayer shares one set: only the first run moves them) */
   blockOwner: boolean;
   orbTaken: boolean[];
   orbs: number;
   mainOrbs: number;
   combo: ComboState;
   secrets: SecretTracker;
   hits: number;
   stunUntil: number;
   invulnUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   powerReadyAt: number;
   boss: BossState | null;
   bossEvents: BossEvents;
   beaconAlive: boolean[];
   wyrm: WyrmMode;
   wyrmAt: number;
   /** the anchor the Wyrm last came out of (-1 = its own entry) */
   wyrmAnchor: number;
   /** the tail sweep's start angle round the centre island */
   sweepA0: number;
   /** this window's dive / knot has happened */
   windowDone: boolean;
   ended: "win" | "timeup" | null;
   finishMs: number;
   ev: StepEvents;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): PortalRun {
   const course = courseFor(level);
   const s = course.start;
   const gateCount = course.islands.reduce((m, i) => Math.max(m, i.gate + 1), 0);
   const run: PortalRun = {
      seed, level, heroId, course, simMs: 0, acc: 0, pendJump: false, pendAction: false, pendDigit: 0, pendCycle: false, pendPick: -1,
      hero: { x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, grounded: true, ground: 0, airJumped: false, flung: false, facing: Math.PI },
      sel: course.pairs.map((p) => p.start), switchUntil: course.pairs.map(() => -1), switches: 0, portReadyAt: 0,
      exitUsed: course.anchors.map(() => false), teleports: 0, lastExitSpeed: 0, checkpoint: 0,
      gates: Array.from({ length: gateCount }, () => false),
      blocks: course.blocks.map((b) => ({ x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 0, grounded: true, portReadyAt: 0, lostUntil: -1 })),
      blockOwner: true,
      orbTaken: course.orbs.map(() => false), orbs: 0, mainOrbs: 0, combo: createCombo(), secrets: createSecretTracker(SECRETS[level]),
      hits: 0, stunUntil: -1, invulnUntil: -1, shieldUntil: -1, magnetUntil: -1, phaseUntil: -1, dashUntil: -1, dashX: 0, dashZ: -1, powerReadyAt: 0,
      boss: course.cfg.boss ? createBoss(WYRM) : null, bossEvents: createBossEvents(), beaconAlive: course.beacons.map(() => true),
      wyrm: "circle", wyrmAt: 0, wyrmAnchor: -1, sweepA0: 0, windowDone: false,
      ended: null, finishMs: 0, ev: createEvents(),
   };
   run.hero.ground = groundUnder(run, s.x, s.z, s.y);
   return run;
}

// ---------- reads ----------

export const shielded = (run: PortalRun): boolean => run.simMs < run.shieldUntil;
export const phasing = (run: PortalRun): boolean => run.simMs < run.phaseUntil;
export const dashing = (run: PortalRun): boolean => run.simMs < run.dashUntil;

/** The anchor a pair's exit is on. */
export function selectedAnchor(run: PortalRun, pair: number): Anchor {
   const p = run.course.pairs[pair];
   return run.course.anchors[p.anchors[run.sel[pair]]];
}

/** Is the pair's exit open (not moving)? */
export const pairOpen = (run: PortalRun, pair: number): boolean => run.simMs >= run.switchUntil[pair];

/** May the hero pick this anchor now (a hidden one only from its spot)? */
export function anchorVisible(run: PortalRun, a: Anchor): boolean {
   const hd = a.hidden;
   if (!hd) return true;
   const h = run.hero;
   return h.grounded && Math.abs(h.y - hd.y) < 0.2 && Math.hypot(h.x - hd.x, h.z - hd.z) <= hd.r;
}

/** The pair whose entry is nearest the hero (horizontally) among those with a choice, or -1. */
export function nearestPair(run: PortalRun): number {
   const h = run.hero;
   let best = -1;
   let bd = Infinity;
   for (const p of run.course.pairs) {
      if (p.anchors.length < 2) continue;
      const d = Math.hypot(h.x - p.entry.x, h.z - p.entry.z) + Math.max(0, p.entry.y - h.y) * 0.5;
      if (d < bd) {
         bd = d;
         best = p.id;
      }
   }
   return best;
}

/** The island under (x, z) whose top is at or just below y (-1 none). */
function groundUnder(run: PortalRun, x: number, z: number, y: number): number {
   const c = run.course;
   let best = -1;
   let top = -Infinity;
   for (const i of c.islands) {
      if (!islandOn(i, run.gates)) continue;
      if (Math.hypot(x - i.x, z - i.z) >= i.r) continue;
      if (i.y <= y + 0.05 && i.y > top) {
         top = i.y;
         best = i.id;
      }
   }
   return best;
}

/** The hero's speed (m/s). */
export function heroSpeed(run: PortalRun): number {
   const h = run.hero;
   return Math.hypot(h.vx, h.vy, h.vz);
}

/** The angle round the centre island (level 5). */
export function centreAngle(x: number, z: number): number {
   return Math.atan2(x - L5_CENTRE.x, z - L5_CENTRE.z);
}

/** The tail sweep's angle now (only meaningful during the boss's attack step). */
export function sweepAngle(run: PortalRun): number {
   const b = run.boss;
   if (!b || b.step !== "attack") return Number.NaN;
   const att = WYRM.phases[b.phase].attacks[0];
   return run.sweepA0 + TAU * (b.stepMs / att.attackMs);
}

/** Where the Wyrm's knotted head rests (phase 3). */
export const KNOT_HEAD = { x: 0, y: 0.9, z: -2.2 } as const;

// ---------- the ghost arc (the HUD's preview; pure) ----------

const POSE: ExitPose = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, ax: 0, az: 0, yaw: 0 };

/**
 * The entry the hero is about to use (within PREVIEW_REACH, in front of a wall frame or over a pad),
 * or -1, and the speed he would carry in.
 */
export function previewPair(run: PortalRun): { pair: number; speed: number } {
   const h = run.hero;
   const out = { pair: -1, speed: 0 };
   let bd = Infinity;
   for (const p of run.course.pairs) {
      const e = p.entry;
      const d = Math.hypot(h.x - e.x, h.z - e.z);
      if (d > PREVIEW_REACH) continue;
      let speed = 0;
      if (e.kind === "wall") {
         const front = (h.x - e.x) * Math.sin(e.yaw) + (h.z - e.z) * Math.cos(e.yaw);
         if (front < 0) continue;
         speed = Math.max(Math.hypot(h.vx, h.vz), V_RUN);
      } else {
         if (h.y < e.y + 1) continue;
         speed = Math.sqrt(Math.hypot(h.vx, h.vz) ** 2 + h.vy * h.vy + 2 * GRAV * Math.max(0, h.y - e.y));
      }
      if (run.heroId === "riko" && dashing(run)) speed += DASH_PORTAL_BONUS;
      if (d < bd) {
         bd = d;
         out.pair = p.id;
         out.speed = Math.min(V_CAP, Math.max(MIN_OUT, speed));
      }
   }
   return out;
}

/**
 * Writes the ballistic arc out of pair's selected exit at speed (x, y, z triples of the body's centre,
 * every 1/30 s) into out, until it meets an island top or the void; returns the point count.
 */
export function previewArc(run: PortalRun, pair: number, speed: number, out: Float32Array): number {
   const c = run.course;
   const a = selectedAnchor(run, pair);
   exitPose(c, a, run.simMs, POSE);
   let x = POSE.x;
   let y = POSE.y;
   let z = POSE.z;
   let vx = POSE.dx * speed;
   let vy = POSE.dy * speed;
   let vz = POSE.dz * speed;
   const dt = 1 / 30;
   let n = 0;
   const max = Math.floor(out.length / 3);
   while (n < max) {
      out[n * 3] = x;
      out[n * 3 + 1] = y;
      out[n * 3 + 2] = z;
      n += 1;
      const ny = y + vy * dt - 0.5 * GRAV * dt * dt;
      const nx = x + vx * dt;
      const nz = z + vz * dt;
      vy -= GRAV * dt;
      let hit = false;
      for (const i of c.islands) {
         if (!islandOn(i, run.gates)) continue;
         if (y - BODY_MID >= i.y && ny - BODY_MID < i.y && Math.hypot(nx - i.x, nz - i.z) < i.r) hit = true;
      }
      x = nx;
      y = ny;
      z = nz;
      if (hit || y < c.voidY) {
         if (n < max) {
            out[n * 3] = x;
            out[n * 3 + 1] = y;
            out[n * 3 + 2] = z;
            n += 1;
         }
         break;
      }
   }
   return n;
}

// ---------- the step ----------

const W = { x: 0, z: 0 };

function pushSecret(run: PortalRun, index: number): void {
   if (index < 0) return;
   if (!collectSecret(run.secrets, index)) return;
   run.ev.secretList[run.ev.secretCount++] = index;
}

function chain(run: PortalRun, base: number): void {
   const bonus = comboHit(run.combo, COMBO, run.simMs, base);
   run.ev.comboBonus += bonus;
   if (run.combo.chain > 1) run.ev.comboLinked = true;
}

function hurt(run: PortalRun, why: StepEvents["hurt"], kx = 0, kz = 0): void {
   if (why !== "fall" && run.simMs < run.invulnUntil) return;
   if (why !== "fall" && shielded(run)) {
      run.ev.shielded = true;
      return;
   }
   run.hits += 1;
   run.ev.hurt = why;
   run.stunUntil = run.simMs + STUN_MS;
   run.invulnUntil = run.simMs + INVULN_MS;
   comboBreak(run.combo);
   if (why === "sweep") {
      const h = run.hero;
      h.vx = kx * 3;
      h.vz = kz * 3;
      h.vy = 4;
      h.grounded = false;
      h.ground = -1;
   }
}

/** The hero fell into the void: back on the last island stood on. */
function respawn(run: PortalRun): void {
   const h = run.hero;
   const i = run.course.islands[run.checkpoint];
   h.x = i.x;
   h.z = i.z;
   h.y = i.y;
   h.vx = h.vy = h.vz = 0;
   h.grounded = true;
   h.ground = i.id;
   h.airJumped = false;
   h.flung = false;
   hurt(run, "fall");
}

function select(run: PortalRun, pair: number, index: number): void {
   if (run.sel[pair] === index) return;
   const a = run.course.anchors[run.course.pairs[pair].anchors[index]];
   if (!anchorVisible(run, a)) return;
   run.sel[pair] = index;
   run.switchUntil[pair] = run.simMs + SWITCH_MS;
   run.switches += 1;
   run.ev.switched = pair;
}

function handleChoice(run: PortalRun): void {
   const c = run.course;
   if (run.pendPick >= 0 && run.pendPick < c.anchors.length) {
      const a = c.anchors[run.pendPick];
      select(run, a.pair, c.pairs[a.pair].anchors.indexOf(a.id));
   }
   if (run.pendDigit > 0 || run.pendCycle) {
      const p = nearestPair(run);
      if (p >= 0) {
         const pr = c.pairs[p];
         if (run.pendDigit > 0) {
            if (run.pendDigit <= pr.anchors.length) select(run, p, run.pendDigit - 1);
         } else {
            for (let k = 1; k <= pr.anchors.length; k++) {
               const idx = (run.sel[p] + k) % pr.anchors.length;
               if (anchorVisible(run, c.anchors[pr.anchors[idx]])) {
                  select(run, p, idx);
                  break;
               }
            }
         }
      }
   }
   run.pendPick = -1;
   run.pendDigit = 0;
   run.pendCycle = false;
}

function firePower(run: PortalRun, wx: number, wz: number): void {
   const ms = run.simMs;
   const def = heroById(run.heroId);
   if (def.power === "doubleJump" || ms < run.powerReadyAt) return;
   run.powerReadyAt = ms + def.cooldownMs;
   run.ev.powered = true;
   const h = run.hero;
   if (def.power === "dash") {
      const len = Math.hypot(wx, wz);
      if (len > 0.1) {
         run.dashX = wx / len;
         run.dashZ = wz / len;
      } else {
         run.dashX = Math.sin(h.facing);
         run.dashZ = Math.cos(h.facing);
      }
      run.dashUntil = ms + POWER_MS.dash;
   } else if (def.power === "shield") run.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") run.magnetUntil = ms + POWER_MS.magnet;
   else if (def.power === "phase") run.phaseUntil = ms + POWER_MS.phase;
}

function capSpeed(o: { vx: number; vy: number; vz: number }): void {
   const s = Math.hypot(o.vx, o.vy, o.vz);
   if (s > V_CAP) {
      const k = V_CAP / s;
      o.vx *= k;
      o.vy *= k;
      o.vz *= k;
   }
}

/** Clamps a body's horizontal speed to V_RUN: a landing sticks (no skid off the island; the proof's walk class). */
function stick(body: { vx: number; vz: number }): void {
   const hs = Math.hypot(body.vx, body.vz);
   if (hs > V_RUN) {
      body.vx *= V_RUN / hs;
      body.vz *= V_RUN / hs;
   }
}

/** Islands: land on a top, stand on it, and the rock sides push you out. Returns the landing speed (or -1). */
function islandContacts(run: PortalRun, body: { x: number; y: number; z: number; vx: number; vy: number; vz: number; grounded: boolean }, oy: number, radius: number, setGround: (id: number) => void): number {
   let landSpeed = -1;
   for (const i of run.course.islands) {
      if (!islandOn(i, run.gates)) continue;
      const dx = body.x - i.x;
      const dz = body.z - i.z;
      const d = Math.hypot(dx, dz);
      if (!body.grounded && body.vy <= 0 && oy >= i.y - 1e-6 && body.y < i.y && d < i.r) {
         landSpeed = Math.hypot(body.vx, body.vy, body.vz);
         body.y = i.y;
         body.vy = 0;
         body.grounded = true;
         stick(body);
         setGround(i.id);
         continue;
      }
      // the rock side
      if (body.y < i.y - 0.05 && body.y > i.y - SIDE_DEPTH && d < i.r + radius && d > 1e-6) {
         const k = (i.r + radius) / d;
         body.x = i.x + dx * k;
         body.z = i.z + dz * k;
         const nx = dx / d;
         const nz = dz / d;
         const vn = body.vx * nx + body.vz * nz;
         if (vn < 0) {
            body.vx -= vn * nx;
            body.vz -= vn * nz;
         }
      }
   }
   return landSpeed;
}

/** Does a body crossing from (x0, y0, z0) to (x1, y1, z1) (its centre) pass through entry e's opening? */
function crosses(e: Pair["entry"], x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, footY1: number, footY0: number): boolean {
   if (e.kind === "wall") {
      const sy = Math.sin(e.yaw);
      const cy = Math.cos(e.yaw);
      const ey = e.y + EXIT_UP;
      const s0 = (x0 - e.x) * sy + (z0 - e.z) * cy;
      const s1 = (x1 - e.x) * sy + (z1 - e.z) * cy;
      if (!(s0 > 0 && s1 <= 0)) return false;
      const lat = (x1 - e.x) * cy - (z1 - e.z) * sy;
      return Math.abs(lat) < FRAME_HALF_W - 0.1 && Math.abs(y1 - ey) < FRAME_HALF_H;
   }
   return footY0 >= e.y && footY1 < e.y && Math.hypot(x1 - e.x, z1 - e.z) < e.r;
}

/** Sends a body out of pair p's exit: speed in -> speed out along the exit. Returns the anchor, or -1 (closed). */
function portOut(run: PortalRun, p: Pair, body: { x: number; y: number; z: number; vx: number; vy: number; vz: number }, centreUp: number, bonus: number): number {
   if (!pairOpen(run, p.id)) return -1;
   const a = selectedAnchor(run, p.id);
   exitPose(run.course, a, run.simMs, POSE);
   const s = Math.min(V_CAP, Math.max(MIN_OUT, Math.hypot(body.vx, body.vy, body.vz) + bonus));
   body.x = POSE.x;
   body.y = POSE.y - centreUp;
   body.z = POSE.z;
   body.vx = POSE.dx * s;
   body.vy = POSE.dy * s;
   body.vz = POSE.dz * s;
   return a.id;
}

function heroPortals(run: PortalRun, ox: number, oy: number, oz: number): void {
   const h = run.hero;
   if (run.simMs < run.portReadyAt) return;
   for (const p of run.course.pairs) {
      if (!crosses(p.entry, ox, oy + BODY_MID, oz, h.x, h.y + BODY_MID, h.z, h.y, oy)) continue;
      if (p.entry.kind === "wall" && phasing(run)) {
         run.ev.ghostPass = true;
         run.portReadyAt = run.simMs + PORT_COOLDOWN_MS;
         return;
      }
      // Riko's dash into a portal: a grounded run-in only (a dash in the air adds nothing)
      const bonus = run.heroId === "riko" && dashing(run) && h.grounded ? DASH_PORTAL_BONUS : 0;
      const id = portOut(run, p, h, BODY_MID, bonus);
      if (id < 0) {
         run.ev.closedPass = true;
         return;
      }
      run.portReadyAt = run.simMs + PORT_COOLDOWN_MS;
      h.grounded = false;
      h.ground = -1;
      h.airJumped = false;
      h.flung = true;
      run.dashUntil = Math.min(run.dashUntil, run.simMs);
      const s = Math.hypot(h.vx, h.vy, h.vz);
      run.teleports += 1;
      run.lastExitSpeed = s;
      run.ev.teleported = true;
      run.ev.exitAnchor = id;
      run.ev.exitSpeed = s;
      if (Math.hypot(h.vx, h.vz) > 0.1) h.facing = Math.atan2(h.vx, h.vz);
      if (!run.exitUsed[id]) {
         run.exitUsed[id] = true;
         chain(run, COMBO_BASE_MS.exit);
      }
      if (s >= TERMINAL) pushSecret(run, secretIndex(run.level, "terminal"));
      if (run.course.anchors[id].hidden) pushSecret(run, secretIndex(run.level, "hidden-anchor"));
      return;
   }
}

function blockTopAt(run: PortalRun, x: number, z: number, y: number, oy: number): number {
   for (let k = 0; k < run.blocks.length; k++) {
      const b = run.blocks[k];
      if (b.lostUntil >= 0) continue;
      const top = b.y + 2 * BLOCK_HALF;
      if (Math.abs(x - b.x) < BLOCK_HALF + 0.15 && Math.abs(z - b.z) < BLOCK_HALF + 0.15 && oy >= top - 1e-6 && y < top) return k;
   }
   return -1;
}

/** The hero against the cargo blocks: stand on one, or push it. */
function heroBlocks(run: PortalRun, oy: number): void {
   const h = run.hero;
   const k = !h.grounded && h.vy <= 0 ? blockTopAt(run, h.x, h.z, h.y, oy) : -1;
   if (k >= 0) {
      const b = run.blocks[k];
      run.ev.landSpeed = Math.hypot(h.vx, h.vy, h.vz);
      h.y = b.y + 2 * BLOCK_HALF;
      h.vy = 0;
      h.grounded = true;
      stick(h);
      h.ground = -2 - k;
      h.airJumped = false;
      run.ev.landed = true;
      return;
   }
   for (const b of run.blocks) {
      if (b.lostUntil >= 0) continue;
      const top = b.y + 2 * BLOCK_HALF;
      if (h.y >= top - 0.25 || h.y + 1.2 <= b.y) continue;
      const dx = h.x - b.x;
      const dz = h.z - b.z;
      const px = BLOCK_HALF + BODY_R - Math.abs(dx);
      const pz = BLOCK_HALF + BODY_R - Math.abs(dz);
      if (px <= 0 || pz <= 0) continue;
      // push out along the shallower axis; a hero walking into the face pushes the block along it
      if (px < pz) {
         const sx = Math.sign(dx) || 1;
         h.x = b.x + sx * (BLOCK_HALF + BODY_R);
         if (h.vx * sx < 0) {
            if (b.grounded) b.vx = Math.max(-V_PUSH, Math.min(V_PUSH, h.vx));
            h.vx = b.vx;
         }
      } else {
         const sz = Math.sign(dz) || 1;
         h.z = b.z + sz * (BLOCK_HALF + BODY_R);
         if (h.vz * sz < 0) {
            if (b.grounded) b.vz = Math.max(-V_PUSH, Math.min(V_PUSH, h.vz));
            h.vz = b.vz;
         }
      }
   }
}

function stepBlocks(run: PortalRun, dt: number): void {
   const c = run.course;
   const ms = run.simMs;
   for (let k = 0; k < run.blocks.length; k++) {
      const b = run.blocks[k];
      if (b.lostUntil >= 0) {
         if (ms >= b.lostUntil) {
            const home = c.blocks[k];
            b.x = home.x;
            b.y = home.y;
            b.z = home.z;
            b.vx = b.vy = b.vz = 0;
            b.grounded = true;
            b.lostUntil = -1;
         }
         continue;
      }
      const ox = b.x;
      const oy = b.y;
      const oz = b.z;
      if (b.grounded) {
         const sp = Math.hypot(b.vx, b.vz);
         if (sp > 0) {
            const k2 = Math.max(0, sp - BLOCK_FRICTION * dt) / sp;
            b.vx *= k2;
            b.vz *= k2;
         }
      } else b.vy -= GRAV * dt;
      capSpeed(b);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      if (b.grounded) {
         // still on something?
         let on = false;
         for (const i of c.islands) if (islandOn(i, run.gates) && Math.abs(i.y - b.y) < 0.02 && Math.hypot(b.x - i.x, b.z - i.z) < i.r) on = true;
         if (!on) b.grounded = false;
      }
      islandContacts(run, b, oy, BLOCK_HALF, () => undefined);
      // portals (its centre)
      if (ms >= b.portReadyAt) {
         for (const p of c.pairs) {
            if (!crosses(p.entry, ox, oy + BLOCK_HALF, oz, b.x, b.y + BLOCK_HALF, b.z, b.y, oy)) continue;
            if (portOut(run, p, b, BLOCK_HALF, 0) >= 0) {
               b.grounded = false;
               b.portReadyAt = ms + PORT_COOLDOWN_MS;
               run.ev.blockPorted = true;
            }
            break;
         }
      }
      if (b.y < c.voidY) {
         b.lostUntil = ms + BLOCK_RESPAWN_MS;
         run.ev.blockLost = true;
         continue;
      }
      // the pressure plates
      for (let q = 0; q < c.plates.length; q++) {
         const pl = c.plates[q];
         if (run.gates[pl.gate] || !b.grounded) continue;
         if (Math.abs(b.y - pl.y) < 0.05 && Math.hypot(b.x - pl.x, b.z - pl.z) < pl.r) {
            run.gates[pl.gate] = true;
            run.ev.plate = q;
         }
      }
   }
}

function collect(run: PortalRun): void {
   const h = run.hero;
   const c = run.course;
   const ms = run.simMs;
   const cy = h.y + BODY_MID;
   for (let i = 0; i < c.orbs.length; i++) {
      if (run.orbTaken[i]) continue;
      const o = c.orbs[i];
      const d = Math.hypot(h.x - o.x, cy - o.y, h.z - o.z);
      let take = d < ORB.reach;
      if (o.gate === "zuno") take = ms < run.magnetUntil && d <= MAGNET_REACH;
      else if (o.gate === "riko") take = take && ms < run.dashUntil;
      else if (o.gate === "kiro") take = take && ms < run.shieldUntil;
      else if (o.gate === "vexa") take = take && ms < run.phaseUntil;
      if (!take) continue;
      run.orbTaken[i] = true;
      run.orbs += 1;
      if (i < c.mainOrbs) run.mainOrbs += 1;
      run.ev.orbList[run.ev.orbCount++] = i;
      chain(run, COMBO_BASE_MS.orb);
   }
   const sh = c.shard;
   if (sh && phasing(run) && Math.hypot(h.x - sh.x, cy - sh.y, h.z - sh.z) < 1.3) pushSecret(run, secretIndex(run.level, "ghost-frame"));
}

function finish(run: PortalRun): void {
   if (run.ended !== null) return;
   if (run.switches <= run.course.cfg.parSwitches) pushSecret(run, secretIndex(run.level, "economy"));
   run.ended = "win";
   run.finishMs = run.simMs;
   run.ev.finished = true;
}

function bossHit(run: PortalRun): void {
   const b = run.boss;
   if (!b) return;
   const r = hitBoss(b, WYRM, 1, run.bossEvents);
   if (r === "ignored") return;
   run.ev.bossHit = true;
   run.windowDone = true;
   chain(run, COMBO_BASE_MS.boss);
   if (r === "phase") run.ev.bossPhase = true;
   if (r === "defeated") {
      run.ev.bossDefeated = true;
      run.wyrm = "gone";
      finish(run);
   }
}

function setWyrm(run: PortalRun, mode: WyrmMode): void {
   if (run.wyrm === mode) return;
   run.wyrm = mode;
   run.wyrmAt = run.simMs;
}

/** Level 5: the Wyrm's machine (menu2/boss) and what it does in each step. */
function stepWyrm(run: PortalRun, landSpeed: number): void {
   const b = run.boss;
   if (!b || run.ended !== null) return;
   const ev = run.ev;
   const bev = stepBoss(b, WYRM, STEP_MS, run.bossEvents);
   const h = run.hero;
   if (bev.telegraph) {
      ev.bossTelegraph = true;
      run.windowDone = false;
      setWyrm(run, b.phase === 1 ? "coil" : "circle");
   }
   if (bev.attack) {
      ev.bossAttack = true;
      // the tail starts opposite the hero and sweeps round to him mid-attack
      run.sweepA0 = centreAngle(h.x, h.z) - Math.PI;
   }
   if (bev.vulnerable) {
      ev.bossVulnerable = true;
      run.windowDone = false;
   }
   if (b.step === "attack" && run.simMs >= run.invulnUntil) {
      const d = Math.hypot(h.x - L5_CENTRE.x, h.z - L5_CENTRE.z);
      const onCentre = h.y - L5_CENTRE.y < SWEEP_HIGH && h.y > L5_CENTRE.y - 0.5;
      if (onCentre && d >= SWEEP_R0 && d <= SWEEP_R1 && Math.abs(wrapPi(centreAngle(h.x, h.z) - sweepAngle(run))) < SWEEP_HALF) {
         // the tail swats you towards the middle (never off the island)
         hurt(run, "sweep", -(h.x - L5_CENTRE.x) / Math.max(0.1, d), -(h.z - L5_CENTRE.z) / Math.max(0.1, d));
      }
   }
   if (b.step !== "vulnerable" || run.windowDone) return;
   if (b.phase === 0) {
      // P1: it dives into pair A's frame and comes out of its exit
      if (run.wyrm !== "dive" && run.wyrm !== "emerge" && b.stepMs >= P1_DIVE_AT) {
         setWyrm(run, "dive");
         ev.wyrmDive = true;
      } else if (run.wyrm === "dive" && run.simMs - run.wyrmAt >= DIVE_MS) {
         const open = pairOpen(run, 0);
         const a = selectedAnchor(run, 0);
         run.wyrmAnchor = open ? a.id : -1;
         setWyrm(run, "emerge");
         ev.wyrmEmerge = true;
         run.windowDone = true;
         if (open && a.beacon >= 0 && run.beaconAlive[a.beacon]) {
            run.beaconAlive[a.beacon] = false;
            ev.wyrmBonk = a.beacon;
            run.windowDone = false;
            bossHit(run);
         }
      }
   } else if (b.phase === 1) {
      // P2: come down on its back crystal at speed
      if (landSpeed >= BACK_SPEED && h.ground === 0 && Math.hypot(h.x - L5_CENTRE.x, h.z - L5_CENTRE.z) <= BACK_REACH) bossHit(run);
   } else {
      // P3: both pairs on their loops: it swims into its own tail and knots; touch its head
      if (run.wyrm !== "knot") {
         const loops = pairOpen(run, 0) && pairOpen(run, 1) && selectedAnchor(run, 0).loop && selectedAnchor(run, 1).loop;
         if (loops && b.stepMs >= P3_KNOT_AT) {
            setWyrm(run, "knot");
            ev.wyrmKnot = true;
         }
      } else if (Math.hypot(h.x - KNOT_HEAD.x, h.y + BODY_MID - KNOT_HEAD.y, h.z - KNOT_HEAD.z) <= HEAD_REACH) bossHit(run);
   }
}

function subStep(run: PortalRun, input: StepInput): void {
   const ms = run.simMs;
   const dt = STEP_MS / 1000;
   const h = run.hero;
   const c = run.course;
   const ev = run.ev;
   handleChoice(run);
   inputToWorld(input.moveX, input.moveZ, input.yaw, W);
   let wx = W.x;
   let wz = W.z;
   const len = Math.hypot(wx, wz);
   if (len > 1) {
      wx /= len;
      wz /= len;
   }
   if (ms < run.stunUntil) {
      wx = 0;
      wz = 0;
   }
   if (run.pendAction) {
      run.pendAction = false;
      firePower(run, wx, wz);
   }
   const mag = Math.min(1, Math.hypot(wx, wz));
   if (mag > 0.1) h.facing = Math.atan2(wx, wz);
   // move
   if (h.grounded) {
      let tx = wx * V_RUN;
      let tz = wz * V_RUN;
      if (ms < run.dashUntil) {
         tx = run.dashX * V_DASH;
         tz = run.dashZ * V_DASH;
      }
      const dvx = tx - h.vx;
      const dvz = tz - h.vz;
      const dv = Math.hypot(dvx, dvz);
      const max = GROUND_ACCEL * dt * (ms < run.dashUntil ? 3 : 1);
      if (dv > max) {
         h.vx += (dvx / dv) * max;
         h.vz += (dvz / dv) * max;
      } else {
         h.vx = tx;
         h.vz = tz;
      }
   } else if (mag > 0.1) {
      const ux = wx / mag;
      const uz = wz / mag;
      const along = h.vx * ux + h.vz * uz;
      const room = V_RUN * mag - along;
      if (room > 0) {
         const add = Math.min(room, AIR_ACCEL * dt * mag);
         h.vx += ux * add;
         h.vz += uz * add;
      }
   }
   if (run.pendJump) {
      run.pendJump = false;
      if (h.grounded && ms >= run.stunUntil) {
         h.vy = V_JUMP;
         h.grounded = false;
         h.ground = -1;
         ev.jumped = true;
      } else if (!h.grounded && run.heroId === "nami" && !h.airJumped && ms >= run.stunUntil) {
         h.vy = V_JUMP2;
         h.airJumped = true;
         ev.airJumped = true;
      }
   }
   if (!h.grounded) {
      h.vy -= GRAV * dt;
      // only a fling out of an exit (or a dash still on) carries more than a run through the air
      if (!h.flung && ms >= run.dashUntil) stick(h);
   }
   capSpeed(h);
   const ox = h.x;
   const oy = h.y;
   const oz = h.z;
   h.x += h.vx * dt;
   h.y += h.vy * dt;
   h.z += h.vz * dt;
   // still standing on something?
   if (h.grounded) {
      if (h.ground <= -2) {
         const b = run.blocks[-2 - h.ground];
         if (!b || b.lostUntil >= 0 || Math.abs(h.x - b.x) > BLOCK_HALF + 0.15 || Math.abs(h.z - b.z) > BLOCK_HALF + 0.15) {
            h.grounded = false;
            h.ground = -1;
         } else h.y = b.y + 2 * BLOCK_HALF;
      } else {
         const i = h.ground >= 0 ? c.islands[h.ground] : null;
         if (!i || !islandOn(i, run.gates) || Math.hypot(h.x - i.x, h.z - i.z) >= i.r) {
            const next = groundUnder(run, h.x, h.z, h.y);
            if (next >= 0 && Math.abs(c.islands[next].y - h.y) < 0.05) h.ground = next;
            else {
               h.grounded = false;
               h.ground = -1;
            }
         }
      }
   }
   const wasAir = !h.grounded;
   let landSpeed = islandContacts(run, h, oy, BODY_R, (id) => {
      h.ground = id;
   });
   if (h.grounded) h.flung = false;
   if (wasAir && h.grounded) {
      h.airJumped = false;
      ev.landed = true;
      ev.landSpeed = landSpeed;
   }
   if (run.blocks.length > 0) {
      const before = h.grounded;
      heroBlocks(run, oy);
      if (!before && h.grounded) landSpeed = ev.landSpeed;
   }
   heroPortals(run, ox, oy, oz);
   if (run.blocks.length > 0 && run.blockOwner) stepBlocks(run, dt);
   if (h.grounded && h.ground >= 0) {
      const i = c.islands[h.ground];
      if (i.gate < 0) run.checkpoint = i.id;
   }
   if (h.y < c.voidY) respawn(run);
   collect(run);
   if (c.goal && h.grounded && Math.abs(h.y - c.goal.y) < 0.05 && Math.hypot(h.x - c.goal.x, h.z - c.goal.z) <= c.goal.r) finish(run);
   stepWyrm(run, wasAir && h.grounded ? landSpeed : -1);
   run.simMs += STEP_MS;
   if (run.ended === null && run.simMs >= LEVELS[run.level].durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
}

/** Advances the run by one rendered frame (any dt); returns this frame's events (reused object). */
export function step(run: PortalRun, frameMs: number, input: StepInput): StepEvents {
   const ev = run.ev;
   resetEvents(ev);
   if (run.ended !== null) return ev;
   if (input.jumpPressed) run.pendJump = true;
   if (input.actionPressed) run.pendAction = true;
   if (input.digit > 0) run.pendDigit = input.digit;
   if (input.cyclePressed) run.pendCycle = true;
   if (input.pick >= 0) run.pendPick = input.pick;
   run.acc += Math.min(MAX_FRAME_MS, Math.max(0, frameMs));
   while (run.acc >= STEP_MS - 1e-9 && run.ended === null) {
      run.acc -= STEP_MS;
      subStep(run, input);
   }
   if (ev.switched < 0) {
      // a switch that finished this frame (the HUD's "open" ping)
      for (let p = 0; p < run.switchUntil.length; p++) if (run.switchUntil[p] > run.simMs - 50 && run.switchUntil[p] <= run.simMs) ev.opened = p;
   }
   return ev;
}

// ---------- the boss reads (the scene) ----------

export const bossVulnerable = (run: PortalRun): boolean => run.boss !== null && run.boss.step === "vulnerable";

// ---------- the score ----------

/** The submitted time: the finish less 0.1 s an orb and the flow bonus. */
export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs - comboMs);
}

export const submittedMs = (run: PortalRun): number => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

/** The run's stars (clear, the five main orbs, the target time) and the no-hit badge. */
export function runStars(run: PortalRun): StarResult {
   const cleared = run.ended === "win";
   return evaluateStars(starSpecFor(run.level, run.course.mainOrbs), { cleared, orbs: run.mainOrbs, goalValue: cleared ? submittedMs(run) : Number.NaN, hits: run.hits });
}

export function flowOf(run: PortalRun): number {
   return comboFlow(run.combo, COMBO, run.simMs);
}

// ---------- the limits (README "Server limits and why they hold"; bound.ts) ----------

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/** The most the submitted time can be cut by orbs and the flow meter (ms). */
export function maxBonusMs(level: LevelId): number {
   const c = courseFor(level);
   const sources = [
      { count: c.anchors.length, base: COMBO_BASE_MS.exit },
      { count: c.orbs.length, base: COMBO_BASE_MS.orb },
      { count: c.cfg.boss ? WYRM.maxHp : 0, base: COMBO_BASE_MS.boss },
   ];
   return c.orbs.length * ORB.bonusMs + comboMaxBonus({ combo: COMBO, sources });
}

export { SECRETS, WYRM };
export type { HeroId, Island };

/** The shell's score for a win: the time game submits its submitted time. */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   hero: "hero",
   power: "power",
   finishMs: "finishMs",
   hits: "hits",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   speed: "speed",
   switches: "switches",
   pair: "pair",
   pairAnchor: "pairAnchor",
   pairCount: "pairCount",
   pairMoving: "pairMoving",
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

/** The level limits proven in proof.test.ts: bound.ts proposeLimits, pinned. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: { kind: "time", maxScore: 14_000, minDurationMs: 1_000, maxDurationMs: 150_000, timeBaseMs: 150_000 },
   2: { kind: "time", maxScore: 17_000, minDurationMs: 1_000, maxDurationMs: 180_000, timeBaseMs: 180_000 },
   3: { kind: "time", maxScore: 20_000, minDurationMs: 1_000, maxDurationMs: 210_000, timeBaseMs: 210_000 },
   4: { kind: "time", maxScore: 23_000, minDurationMs: 1_000, maxDurationMs: 240_000, timeBaseMs: 240_000 },
   5: { kind: "time", maxScore: 29_000, minDurationMs: 1_000, maxDurationMs: 300_000, timeBaseMs: 300_000 },
};
