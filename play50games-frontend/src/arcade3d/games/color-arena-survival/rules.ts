// Color Arena Survival's rules: pure and deterministic (no three.js, React, DOM, Math.random or Date).
// Scene.tsx calls step() from one useRunFrame; the same seed + level + hero + inputs always give the same
// run at any frame rate (the simulation advances in fixed 1000/120 ms steps).
//
// The card (GAME 26): "Stand on the announced color before all wrong-color tiles disappear." The floor
// is a grid of colour tiles over the void. A round:
//   CALL  a colour is called (the beacon, the HUD); the floor shows it for callMs. Stand still (under
//         LOCK_SPEED) on a tile of that colour for LOCK_MS to LOCK IN: once the call is MIN_CALL_MS old, a lock-in ends it at
//         once (the speed run). Over the last WARN_MS the wrong tiles fade.
//   DROP  every tile of another colour drops (it stops holding you DROP_SOLID_MS in). Still on a tile
//         at the end of the drop = the round survived.
//   RISE  the tiles come back (held only from halfway up), then the floor is repainted for the next call.
// A fall into the void costs a life (three); you respawn on the SAFE MARKER (the nearest safe tile).
// Levels 1-4 are won by surviving `rounds` rounds; level 5 by defeating the Prism Keeper, whose attack
// cycle IS the round there (progression.ts KEEPER). Each level adds a rule (levels.ts): holes (cracked
// tiles that stay down; never one that splits the floor), tiles that swap colour mid-call, a sweeper
// bar, the Keeper's attacks.
//
// The arena (the floor, the round, the Keeper) is one object: in local multiplayer every run shares it,
// and only the owner run (index 0) advances it, even after its own hero is out.
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "../../types";
import { inputToWorld, rngNext, type RngState } from "@/arcade3d/core/math";
import { comboFlow, comboHit, createCombo, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import { DEFAULT_HERO, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { LEVELS, type ArenaLevel } from "./levels";
import {
   BEACON_EVERY, COMBO, HOPS, KEEPER, KEEPER_CRACKS, ORBS_PER_LEVEL, QUICK_MS, QUICK_ROUNDS, REPAINT_AT, REPAINT_WARN_MS, SECRETS, SHOCK_HALF, SHOCK_HIGH, SHOCK_SPEED, STREAK,
   secretIndex, starSpecFor,
} from "./progression";

// ---------- tuning ----------

export const STEP_MS = 1000 / 120;
/** a frame longer than this is cut (the shell's own play dt cap is 50 ms) */
export const MAX_FRAME_MS = 50;
export const V_RUN = 6;
export const V_JUMP = 8;
/** Nyla's second jump */
export const V_JUMP2 = 7.5;
export const GRAV = 20;
export const GROUND_ACCEL = 45;
export const AIR_ACCEL = 22;
export const BODY_R = 0.35;
/** the tile pitch (m): a tile is 2.0 m with a 0.2 m seam; a seam holds you like its tiles */
export const TILE_P = 2.2;
export const TILE_W = 2.0;
/** the round's clock (ms) */
export const START_MS = 1500;
export const MIN_CALL_MS = 1000;
export const LOCK_MS = 350;
/** a lock-in needs the hero standing: slower than this (m/s) */
export const LOCK_SPEED = 1.2;
export const WARN_MS = 1000;
export const DROP_MS = 900;
export const DROP_SOLID_MS = 150;
export const RISE_MS = 800;
/** a risen tile holds you again from this far into the rise */
export const RISE_SOLID_MS = 400;
/** L3: a swapping tile blinks this long before it changes */
export const SWAP_WARN_MS = 600;
/** below this a body cannot land any more; below RESPAWN_Y it is lost */
export const FALL_Y = -0.25;
export const RESPAWN_Y = -6;
export const LIVES = 3;
export const INVULN_MS = 1200;
export const STUN_MS = 350;
export const KNOCK_V = 6;
/** an orb floats this high over its tile; it is taken within ORB_REACH of the hero's middle */
export const ORB_Y = 0.9;
export const ORB_REACH = 0.95;
/** L4: the sweeper bar's half depth and its top (jump it) */
export const BAR_HALF = 0.3;
export const BAR_HIGH = 0.55;
/** the bar's arm starts this far out (the hub) */
export const BAR_INNER = 0.8;
/** the gap shard floats this high over its hole */
export const GAP_Y = 0.7;

/** the five colours (the heroes' own) and the rainbow tile */
export const COLOUR_COUNT = 5;
export const RAINBOW = 5;
export const COLOUR_NAMES = ["Red", "Blue", "Green", "Yellow", "Purple", "Rainbow"] as const;

const TAU = Math.PI * 2;

export function wrapPi(a: number): number {
   let r = a % TAU;
   if (r > Math.PI) r -= TAU;
   if (r < -Math.PI) r += TAU;
   return r;
}

// ---------- state ----------

export type ArenaPhase = "start" | "call" | "drop" | "rise" | "wait";

/** What the arena did in the owner's last frame (the Scene's juice; reset at each owner step). */
export interface ArenaEvents {
   called: boolean;
   warned: boolean;
   dropped: boolean;
   rose: boolean;
   swapWarn: boolean;
   swapped: boolean;
   repaintWarn: boolean;
   repainted: boolean;
   shock: boolean;
   locked: boolean;
   bossAttack: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
}

export interface Arena {
   level: LevelId;
   cfg: ArenaLevel;
   /** tiles along a side; tile i is column i % n, row floor(i / n) */
   n: number;
   /** the floor's half width (m) */
   half: number;
   colour: Int8Array;
   hole: Uint8Array;
   /** this round: the tile drops whatever its colour (L2-L4: becomes a hole; L5 P1: the Keeper's cracks) */
   crack: Uint8Array;
   /** this drop: the tile falls */
   drop: Uint8Array;
   phase: ArenaPhase;
   phaseMs: number;
   callLen: number;
   called: number;
   round: number;
   simMs: number;
   rng: RngState;
   /** drops ended so far (each run judges its survival once per drop) */
   dropsEnded: number;
   /** L3 swaps this call */
   swapTiles: number[];
   swapTo: number[];
   swapAt: number;
   swapDone: boolean;
   /** L5 P3: the colour the call changes to, and when */
   repaintAt: number;
   repaintTo: number;
   repaintDone: boolean;
   /** the rounds an orb floats on, its tile this round, and whether it is still there */
   orbRounds: number[];
   orbTile: number;
   orbLive: boolean;
   rainbowRound: number;
   rainbowTile: number;
   gapRound: number;
   gapTile: number;
   gapLive: boolean;
   /** L5: the beacon's tile this round (-1 none); armed while the Keeper's window is open; beacon rounds so far */
   beaconTile: number;
   beaconArmed: boolean;
   beaconSeq: number;
   /** L4: the sweeper's angle (rad round +y from +x towards +z) */
   sweepAngle: number;
   /** L5 P2: the shock ring's radius (m), -1 = none */
   shockR: number;
   /** per run index: locked in this call / still playing */
   votes: boolean[];
   alive: boolean[];
   boss: BossState | null;
   bossEv: BossEvents;
   won: boolean;
   wonMs: number;
   ev: ArenaEvents;
}

export interface Hero {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   grounded: boolean;
   airJumped: boolean;
   /** the facing (rad, atan2(x, z) convention: 0 = +z) */
   yaw: number;
   state: "play" | "fall";
   stunUntil: number;
   invulnUntil: number;
}

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   powered: boolean;
   knocked: boolean;
   blocked: boolean;
   saved: boolean;
   fell: boolean;
   respawned: boolean;
   locked: boolean;
   survived: boolean;
   orb: boolean;
   hop: boolean;
   secretCount: number;
   secretList: number[];
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   finished: boolean;
   lost: boolean;
   timeup: boolean;
}

export interface StepInput {
   moveX: number;
   moveZ: number;
   /** the camera's yaw: the stick is camera-relative */
   yaw: number;
   jumpPressed: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false };
}

export interface ArenaRun {
   level: LevelId;
   heroId: HeroId;
   arena: Arena;
   /** this run's place in the arena's votes (0 = the owner, who advances the arena) */
   index: number;
   hero: Hero;
   lives: number;
   hits: number;
   survived: number;
   orbs: number;
   simMs: number;
   acc: number;
   ended: "win" | "lose" | "timeup" | null;
   finishMs: number;
   powerReadyAt: number;
   dashUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   lockMs: number;
   /** the arena phase-ms of the lock-in, and the round it was in (-1 = none yet) */
   lockAt: number;
   lockRound: number;
   quickStreak: number;
   hops: number;
   barSide: number;
   /** the hero's signed distance ahead of the bar's face last step (NaN = off its arm) */
   barPerp: number;
   seenDrops: number;
   seenBeacon: number;
   hitBeacon: number;
   beaconStreak: number;
   /** the tile the hero was last put back on (the safe marker) and when */
   respawnTile: number;
   respawnAt: number;
   pendJump: boolean;
   pendAction: boolean;
   combo: ComboState;
   secrets: SecretTracker;
   ev: StepEvents;
}

function createEvents(): StepEvents {
   return {
      jumped: false, airJumped: false, landed: false, powered: false, knocked: false, blocked: false, saved: false, fell: false, respawned: false, locked: false, survived: false,
      orb: false, hop: false, secretCount: 0, secretList: [0, 0, 0], bossHit: false, bossPhase: false, bossDefeated: false, finished: false, lost: false, timeup: false,
   };
}

function resetEvents(e: StepEvents): void {
   e.jumped = e.airJumped = e.landed = e.powered = e.knocked = e.blocked = e.saved = e.fell = e.respawned = e.locked = e.survived = false;
   e.orb = e.hop = e.bossHit = e.bossPhase = e.bossDefeated = e.finished = e.lost = e.timeup = false;
   e.secretCount = 0;
}

function createArenaEvents(): ArenaEvents {
   return { called: false, warned: false, dropped: false, rose: false, swapWarn: false, swapped: false, repaintWarn: false, repainted: false, shock: false, locked: false, bossAttack: false, bossPhase: false, bossDefeated: false };
}

function resetArenaEvents(e: ArenaEvents): void {
   e.called = e.warned = e.dropped = e.rose = e.swapWarn = e.swapped = e.repaintWarn = e.repainted = e.shock = e.locked = e.bossAttack = e.bossPhase = e.bossDefeated = false;
}

/** The rounds an orb floats on: five, spread over the level's rounds (never a beacon round on level 5). */
export function orbRoundsFor(rounds: number, boss = false): number[] {
   const out: number[] = [];
   for (let i = 0; i < ORBS_PER_LEVEL; i++) {
      let r = 1 + Math.floor(((i + 0.5) * rounds) / ORBS_PER_LEVEL);
      if (boss && r % BEACON_EVERY === 0) r += 1;
      out.push(r);
   }
   return out;
}

export function createArena(seed: number, level: LevelId): Arena {
   const cfg = LEVELS[level];
   const n = cfg.size;
   const tiles = n * n;
   return {
      level,
      cfg,
      n,
      half: (n * TILE_P) / 2,
      colour: new Int8Array(tiles),
      hole: new Uint8Array(tiles),
      crack: new Uint8Array(tiles),
      drop: new Uint8Array(tiles),
      phase: cfg.boss ? "wait" : "start",
      phaseMs: 0,
      callLen: cfg.callMs,
      called: 0,
      round: 0,
      simMs: 0,
      rng: { s: seed >>> 0 },
      dropsEnded: 0,
      swapTiles: [],
      swapTo: [],
      swapAt: Infinity,
      swapDone: true,
      repaintAt: Infinity,
      repaintTo: 0,
      repaintDone: true,
      orbRounds: orbRoundsFor(cfg.rounds, cfg.boss),
      orbTile: -1,
      orbLive: false,
      rainbowRound: 2,
      rainbowTile: -1,
      gapRound: cfg.holesPerRound > 0 && !cfg.sweeper ? 4 : -1,
      gapTile: -1,
      gapLive: false,
      beaconTile: -1,
      beaconArmed: false,
      beaconSeq: 0,
      sweepAngle: Math.PI / 2,
      shockR: -1,
      votes: [false],
      alive: [true],
      boss: cfg.boss ? createBoss(KEEPER) : null,
      bossEv: createBossEvents(),
      won: false,
      wonMs: 0,
      ev: createArenaEvents(),
   };
}

/** The start: the middle of the floor (the seam between the middle tiles on an even floor). */
export function startPoint(a: Arena): { x: number; z: number } {
   return { x: 0, z: a.n % 2 === 1 ? 0 : TILE_P / 2 };
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO, arena: Arena = createArena(seed, level), index = 0): ArenaRun {
   const s = startPoint(arena);
   arena.votes[index] = false;
   arena.alive[index] = true;
   return {
      level,
      heroId,
      arena,
      index,
      hero: { x: s.x + index * 0.9 * (index % 2 ? 1 : -1), y: 0, z: s.z, vx: 0, vy: 0, vz: 0, grounded: true, airJumped: false, yaw: Math.PI, state: "play", stunUntil: 0, invulnUntil: 0 },
      lives: LIVES,
      hits: 0,
      survived: 0,
      orbs: 0,
      simMs: 0,
      acc: 0,
      ended: null,
      finishMs: 0,
      powerReadyAt: 0,
      dashUntil: -1,
      shieldUntil: -1,
      magnetUntil: -1,
      phaseUntil: -1,
      lockMs: 0,
      lockAt: -1,
      lockRound: -1,
      quickStreak: 0,
      hops: 0,
      barSide: 0,
      barPerp: Number.NaN,
      seenDrops: 0,
      seenBeacon: 0,
      hitBeacon: 0,
      beaconStreak: 0,
      respawnTile: -1,
      respawnAt: -99_999,
      pendJump: false,
      pendAction: false,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      ev: createEvents(),
   };
}

// ---------- the floor ----------

export function tileCentre(a: Arena, i: number, out: { x: number; z: number }): { x: number; z: number } {
   const c = i % a.n;
   const r = Math.floor(i / a.n);
   out.x = (c - (a.n - 1) / 2) * TILE_P;
   out.z = (r - (a.n - 1) / 2) * TILE_P;
   return out;
}

/** The tile under (x, z), or -1 off the floor. */
export function tileAt(a: Arena, x: number, z: number): number {
   if (Math.abs(x) > a.half || Math.abs(z) > a.half) return -1;
   const c = Math.min(a.n - 1, Math.max(0, Math.floor((x + a.half) / TILE_P)));
   const r = Math.min(a.n - 1, Math.max(0, Math.floor((z + a.half) / TILE_P)));
   return r * a.n + c;
}

/** Does tile i hold a body now? */
export function tileSolid(a: Arena, i: number): boolean {
   if (i < 0 || a.hole[i]) return false;
   if (!a.drop[i]) return true;
   if (a.phase === "drop") return a.phaseMs < DROP_SOLID_MS;
   if (a.phase === "rise") return a.phaseMs >= RISE_SOLID_MS;
   return true;
}

/** Is tile i safe for the current call (its colour or the rainbow, not cracked)? */
export function tileSafe(a: Arena, i: number): boolean {
   if (i < 0 || a.hole[i] || a.crack[i]) return false;
   return a.colour[i] === a.called || a.colour[i] === RAINBOW;
}

/** How far the tile sinks (0 up, 1 gone) for the scene. */
export function tileSink(a: Arena, i: number): number {
   if (a.hole[i]) return 1;
   if (!a.drop[i]) return 0;
   if (a.phase === "drop") return Math.min(1, a.phaseMs / DROP_MS);
   if (a.phase === "rise") return Math.max(0, 1 - a.phaseMs / RISE_MS);
   return 0;
}

const pt = { x: 0, z: 0 };

function rnd(a: Arena): number {
   return rngNext(a.rng);
}

function present(a: Arena): number {
   let k = 0;
   for (let i = 0; i < a.hole.length; i++) if (!a.hole[i]) k++;
   return k;
}

/** A random present tile matching `pred`, or -1. */
function pickTile(a: Arena, pred: (i: number) => boolean): number {
   let count = 0;
   for (let i = 0; i < a.colour.length; i++) if (!a.hole[i] && pred(i)) count++;
   if (count === 0) return -1;
   let k = Math.floor(rnd(a) * count);
   for (let i = 0; i < a.colour.length; i++) {
      if (a.hole[i] || !pred(i)) continue;
      if (k-- === 0) return i;
   }
   return -1;
}

const seen: number[] = [];
const queue: number[] = [];

/** Would the floor stay in one piece (4-connected) with tile `extra` gone too, besides the holes and this round's cracks? */
export function staysConnected(a: Arena, extra: number): boolean {
   const n = a.n;
   const gone = (i: number): boolean => i === extra || a.hole[i] === 1 || a.crack[i] === 1;
   let start = -1;
   let left = 0;
   for (let i = 0; i < n * n; i++) {
      seen[i] = 0;
      if (!gone(i)) {
         left++;
         if (start < 0) start = i;
      }
   }
   if (start < 0) return false;
   let head = 0;
   queue.length = 0;
   queue.push(start);
   seen[start] = 1;
   let reached = 0;
   while (head < queue.length) {
      const i = queue[head++];
      reached++;
      const col = i % n;
      const row = Math.floor(i / n);
      if (col + 1 < n && !seen[i + 1] && !gone(i + 1)) (seen[i + 1] = 1), queue.push(i + 1);
      if (col > 0 && !seen[i - 1] && !gone(i - 1)) (seen[i - 1] = 1), queue.push(i - 1);
      if (row + 1 < n && !seen[i + n] && !gone(i + n)) (seen[i + n] = 1), queue.push(i + n);
      if (row > 0 && !seen[i - n] && !gone(i - n)) (seen[i - n] = 1), queue.push(i - n);
   }
   return reached === left;
}

function countColour(a: Arena, colour: number): number {
   let k = 0;
   for (let i = 0; i < a.colour.length; i++) if (!a.hole[i] && !a.crack[i] && a.colour[i] === colour) k++;
   return k;
}

/** The least tiles of the called colour a call leaves (never fewer than 3). */
function minCalled(a: Arena): number {
   return Math.max(3, Math.floor((present(a) / a.cfg.colours) * 0.6));
}

function ensureCalled(a: Arena, colour: number): void {
   const want = minCalled(a);
   for (let guard = 0; guard < 64 && countColour(a, colour) < want; guard++) {
      const t = pickTile(a, (i) => a.colour[i] !== colour && a.colour[i] !== RAINBOW && !a.crack[i]);
      if (t < 0) break;
      a.colour[t] = colour;
   }
}

/** Repaints the floor: level 1 in 2 x 2 blocks (big patches), the others tile by tile. */
function recolour(a: Arena): void {
   const k = a.cfg.colours;
   const n = a.n;
   if (a.level === 1) {
      const blocks = Math.ceil(n / 2);
      const pick: number[] = [];
      for (let b = 0; b < blocks * blocks; b++) pick.push(Math.floor(rnd(a) * k));
      for (let i = 0; i < n * n; i++) {
         const c = i % n;
         const r = Math.floor(i / n);
         a.colour[i] = pick[Math.floor(r / 2) * blocks + Math.floor(c / 2)];
      }
      return;
   }
   for (let i = 0; i < n * n; i++) a.colour[i] = Math.floor(rnd(a) * k);
}

function beginCall(a: Arena): void {
   const cfg = a.cfg;
   a.phase = "call";
   a.phaseMs = 0;
   a.round += 1;
   a.drop.fill(0);
   a.crack.fill(0);
   a.shockR = -1;
   a.beaconTile = -1;
   a.beaconArmed = false;
   a.rainbowTile = -1;
   for (let i = 0; i < a.votes.length; i++) a.votes[i] = false;
   recolour(a);
   const prev = a.called;
   let called = Math.floor(rnd(a) * cfg.colours);
   if (cfg.colours > 1 && a.round > 1 && called === prev) called = (called + 1 + Math.floor(rnd(a) * (cfg.colours - 1))) % cfg.colours;
   a.called = called;
   a.callLen = cfg.boss ? KEEPER.phases[0].attacks[0].telegraphMs : cfg.callMs;
   // L2-L4: tiles of another colour crack now and stay down after the drop (never under the floor share)
   if (cfg.holesPerRound > 0) {
      const floorMin = Math.ceil(cfg.minFloorShare * a.n * a.n);
      for (let h = 0; h < cfg.holesPerRound && present(a) - h - 1 >= floorMin; h++) {
         // a hole never splits the floor: every tile stays reachable on foot
         const t = pickTile(a, (i) => a.colour[i] !== called && !a.crack[i] && staysConnected(a, i));
         if (t >= 0) a.crack[t] = 1;
      }
   }
   ensureCalled(a, called);
   if (a.round === a.rainbowRound) {
      a.rainbowTile = pickTile(a, (i) => a.colour[i] !== called && !a.crack[i]);
      if (a.rainbowTile >= 0) a.colour[a.rainbowTile] = RAINBOW;
   }
   const boss = a.boss;
   if (boss) {
      if (a.round % BEACON_EVERY === 0) {
         a.beaconSeq += 1;
         a.beaconTile = pickTile(a, (i) => a.colour[i] === called && !a.crack[i]);
      }
      if (boss.phase === 0) {
         for (let k = 0; k < KEEPER_CRACKS; k++) {
            if (countColour(a, called) <= 3) break;
            const t = pickTile(a, (i) => a.colour[i] === called && !a.crack[i] && i !== a.beaconTile);
            if (t >= 0) a.crack[t] = 1;
         }
      }
      a.repaintDone = boss.phase !== 2;
      if (boss.phase === 2) {
         a.repaintAt = a.callLen * REPAINT_AT;
         let to = Math.floor(rnd(a) * cfg.colours);
         if (to === called) to = (to + 1) % cfg.colours;
         a.repaintTo = to;
      }
   }
   // L3: tiles that blink and swap halfway through the call (half onto the called colour, half off it)
   a.swapTiles.length = 0;
   a.swapTo.length = 0;
   a.swapDone = cfg.swaps === 0;
   if (cfg.swaps > 0) {
      a.swapAt = a.callLen * 0.5;
      for (let s = 0; s < cfg.swaps; s++) {
         const onto = s % 2 === 0;
         const t = pickTile(a, (i) => (onto ? a.colour[i] !== called : a.colour[i] === called) && a.colour[i] !== RAINBOW && !a.crack[i] && !a.swapTiles.includes(i));
         if (t < 0) continue;
         a.swapTiles.push(t);
         a.swapTo.push(onto ? called : (called + 1 + Math.floor(rnd(a) * (cfg.colours - 1))) % cfg.colours);
      }
   }
   // an orb over a tile of the called colour on the orb rounds, in the middle of the floor where
   // anyone can reach it in a call
   a.orbLive = false;
   a.orbTile = -1;
   if (a.orbRounds.includes(a.round)) {
      const orbOk = (i: number): boolean => a.colour[i] === called && !a.crack[i] && !a.swapTiles.includes(i) && i !== a.beaconTile;
      const mid = a.half * 0.55;
      a.orbTile = pickTile(a, (i) => orbOk(i) && Math.hypot(tileCentre(a, i, pt).x, pt.z) <= mid);
      if (a.orbTile < 0) a.orbTile = pickTile(a, orbOk);
      a.orbLive = a.orbTile >= 0;
   }
   if (a.round === a.gapRound) {
      // the hole nearest the middle
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < a.hole.length; i++) {
         if (!a.hole[i]) continue;
         tileCentre(a, i, pt);
         const d = Math.hypot(pt.x, pt.z);
         if (d < bd) {
            bd = d;
            best = i;
         }
      }
      a.gapTile = best;
      a.gapLive = best >= 0;
   }
   a.ev.called = true;
}

function beginDrop(a: Arena): void {
   a.phase = "drop";
   a.phaseMs = 0;
   for (let i = 0; i < a.colour.length; i++) a.drop[i] = !a.hole[i] && (a.crack[i] || (a.colour[i] !== a.called && a.colour[i] !== RAINBOW)) ? 1 : 0;
   if (a.boss && a.boss.phase === 1) {
      a.shockR = 0;
      a.ev.shock = true;
   }
   a.ev.dropped = true;
}

function endDrop(a: Arena): void {
   if (a.cfg.holesPerRound > 0) for (let i = 0; i < a.crack.length; i++) if (a.crack[i]) a.hole[i] = 1;
   a.dropsEnded += 1;
   a.shockR = -1;
}

function beginRise(a: Arena): void {
   a.phase = "rise";
   a.phaseMs = 0;
   a.orbLive = false;
   a.ev.rose = true;
}

function allLocked(a: Arena): boolean {
   let any = false;
   for (let i = 0; i < a.alive.length; i++) {
      if (!a.alive[i]) continue;
      any = true;
      if (!a.votes[i]) return false;
   }
   return any;
}

/** Advances the shared arena by one fixed step (the owner run only). */
export function stepArena(a: Arena, dt: number): void {
   a.simMs += dt;
   a.phaseMs += dt;
   const cfg = a.cfg;
   if (cfg.sweeper > 0 && a.phase !== "start") a.sweepAngle = wrapPi(a.sweepAngle + (cfg.sweeper * dt) / 1000);
   const boss = a.boss;
   if (boss) {
      const ev = stepBoss(boss, KEEPER, dt, a.bossEv);
      if (ev.telegraph) beginCall(a);
      if (ev.attack) {
         beginDrop(a);
         a.ev.bossAttack = true;
      }
      if (ev.vulnerable) {
         endDrop(a);
         beginRise(a);
         a.beaconArmed = a.beaconTile >= 0;
      }
      if ((boss.step === "transition" || boss.step === "defeat" || boss.step === "done") && a.phase !== "wait") {
         if (a.phase === "drop") endDrop(a);
         a.phase = "wait";
         a.phaseMs = 0;
         a.beaconArmed = false;
         a.shockR = -1;
      }
      if (a.phase === "wait" && a.phaseMs >= RISE_MS) {
         a.drop.fill(0);
         a.crack.fill(0);
      }
      if (a.phase === "call" && !a.repaintDone) {
         if (a.phaseMs >= a.repaintAt - REPAINT_WARN_MS && a.phaseMs - dt < a.repaintAt - REPAINT_WARN_MS) a.ev.repaintWarn = true;
         if (a.phaseMs >= a.repaintAt) {
            a.repaintDone = true;
            a.called = a.repaintTo;
            // the beacon stays where it stands: its tile takes the new colour
            if (a.beaconTile >= 0) a.colour[a.beaconTile] = a.called;
            ensureCalled(a, a.called);
            a.ev.repainted = true;
         }
      }
      if (a.phase === "drop" && a.shockR >= 0) {
         a.shockR = (SHOCK_SPEED * a.phaseMs) / 1000;
         if (a.shockR > a.half * 1.5 + 1) a.shockR = -1;
      }
      if (a.phase === "call" && a.phaseMs >= a.callLen - WARN_MS && a.phaseMs - dt < a.callLen - WARN_MS) a.ev.warned = true;
      return;
   }
   switch (a.phase) {
      case "start":
         if (a.phaseMs >= START_MS) beginCall(a);
         return;
      case "call": {
         if (!a.swapDone) {
            if (a.phaseMs >= a.swapAt - SWAP_WARN_MS && a.phaseMs - dt < a.swapAt - SWAP_WARN_MS) a.ev.swapWarn = true;
            if (a.phaseMs >= a.swapAt) {
               a.swapDone = true;
               for (let s = 0; s < a.swapTiles.length; s++) a.colour[a.swapTiles[s]] = a.swapTo[s];
               ensureCalled(a, a.called);
               if (a.orbTile >= 0 && a.colour[a.orbTile] !== a.called) a.orbTile = pickTile(a, (i) => a.colour[i] === a.called && !a.crack[i]);
               a.ev.swapped = true;
            }
         }
         if (a.phaseMs >= a.callLen - WARN_MS && a.phaseMs - dt < a.callLen - WARN_MS) a.ev.warned = true;
         if (a.phaseMs >= MIN_CALL_MS && allLocked(a)) {
            a.ev.locked = true;
            beginDrop(a);
         } else if (a.phaseMs >= a.callLen) beginDrop(a);
         return;
      }
      case "drop":
         if (a.phaseMs >= DROP_MS) {
            endDrop(a);
            beginRise(a);
         }
         return;
      case "rise":
         if (a.phaseMs >= RISE_MS) beginCall(a);
         return;
      case "wait":
         return;
   }
}

// ---------- the hero ----------

export const shielded = (run: ArenaRun): boolean => run.simMs < run.shieldUntil;
export const phasing = (run: ArenaRun): boolean => run.simMs < run.phaseUntil;
export const dashing = (run: ArenaRun): boolean => run.simMs < run.dashUntil;

/** Is there something under (x, z) holding this hero (a solid tile, or anything on the floor while Vexa phases)? */
export function supportAt(run: ArenaRun, x: number, z: number): boolean {
   const a = run.arena;
   const t = tileAt(a, x, z);
   if (t < 0) return false;
   return phasing(run) || tileSolid(a, t);
}

function secret(run: ArenaRun, id: string): void {
   const k = secretIndex(run.level, id);
   if (k < 0 || !collectSecret(run.secrets, k)) return;
   const ev = run.ev;
   if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount++] = k;
}

/** The safe marker: the safe tile nearest (x, z) (any solid tile when nothing is called). */
export function safeTile(a: Arena, x: number, z: number): number {
   let best = -1;
   let bd = Infinity;
   const callOn = a.phase === "call" || a.phase === "drop";
   for (let pass = 0; pass < 2 && best < 0; pass++) {
      for (let i = 0; i < a.colour.length; i++) {
         if (a.hole[i] || !tileSolid(a, i) || a.drop[i]) continue;
         if (pass === 0 && callOn && !tileSafe(a, i)) continue;
         tileCentre(a, i, pt);
         const d = Math.hypot(pt.x - x, pt.z - z);
         if (d < bd) {
            bd = d;
            best = i;
         }
      }
   }
   return best;
}

function respawn(run: ArenaRun): void {
   const a = run.arena;
   const h = run.hero;
   const t = safeTile(a, h.x, h.z);
   if (t >= 0) tileCentre(a, t, pt);
   else {
      pt.x = 0;
      pt.z = 0;
   }
   h.x = pt.x;
   h.z = pt.z;
   h.y = 0;
   h.vx = h.vy = h.vz = 0;
   h.grounded = true;
   h.airJumped = false;
   h.state = "play";
   h.invulnUntil = run.simMs + INVULN_MS;
   h.stunUntil = 0;
   run.lockMs = 0;
   run.respawnTile = t;
   run.respawnAt = run.simMs;
   run.ev.respawned = true;
}

function knock(run: ArenaRun, dx: number, dz: number): void {
   const h = run.hero;
   if (run.simMs < h.invulnUntil || h.state !== "play") return;
   if (shielded(run)) {
      h.invulnUntil = run.simMs + 400;
      run.ev.blocked = true;
      return;
   }
   const len = Math.hypot(dx, dz) || 1;
   h.vx = (dx / len) * KNOCK_V;
   h.vz = (dz / len) * KNOCK_V;
   h.vy = 3;
   h.grounded = false;
   h.stunUntil = run.simMs + STUN_MS;
   h.invulnUntil = run.simMs + INVULN_MS;
   run.hits += 1;
   run.lockMs = 0;
   run.ev.knocked = true;
}

function finish(run: ArenaRun): void {
   if (run.ended !== null) return;
   run.ended = "win";
   run.finishMs = run.simMs;
   run.ev.finished = true;
}

const dir = { x: 0, z: 0 };

function stepHero(run: ArenaRun, input: StepInput, dt: number): void {
   const a = run.arena;
   const h = run.hero;
   const ev = run.ev;
   const s = dt / 1000;
   const hero = heroById(run.heroId);

   if (h.state === "fall") {
      h.vy -= GRAV * s;
      h.x += h.vx * s;
      h.y += h.vy * s;
      h.z += h.vz * s;
      if (h.y < RESPAWN_Y) {
         run.lives -= 1;
         run.hits += 1;
         run.quickStreak = 0;
         ev.fell = true;
         if (run.lives <= 0) {
            run.ended = "lose";
            ev.lost = true;
            return;
         }
         respawn(run);
      }
      return;
   }

   // the stick (camera-relative)
   inputToWorld(input.moveX, input.moveZ, input.yaw, dir);
   let mag = Math.hypot(dir.x, dir.z);
   if (mag > 1) {
      dir.x /= mag;
      dir.z /= mag;
      mag = 1;
   }

   // the power (a dash goes along the stick, else the facing)
   if (run.pendAction) {
      run.pendAction = false;
      if (hero.power !== "doubleJump" && run.simMs >= run.powerReadyAt) {
         run.powerReadyAt = run.simMs + hero.cooldownMs;
         ev.powered = true;
         if (hero.power === "dash") {
            run.dashUntil = run.simMs + POWER_MS.dash;
            if (mag > 0.15) h.yaw = Math.atan2(dir.x, dir.z);
            h.vx = Math.sin(h.yaw) * V_DASH;
            h.vz = Math.cos(h.yaw) * V_DASH;
         } else if (hero.power === "shield") run.shieldUntil = run.simMs + POWER_MS.shield;
         else if (hero.power === "magnet") run.magnetUntil = run.simMs + POWER_MS.magnet;
         else if (hero.power === "phase") run.phaseUntil = run.simMs + POWER_MS.phase;
      }
   }

   const stunned = run.simMs < h.stunUntil;
   if (dashing(run)) {
      const sp = Math.hypot(h.vx, h.vz) || 1;
      h.vx = (h.vx / sp) * V_DASH;
      h.vz = (h.vz / sp) * V_DASH;
   } else if (!stunned) {
      const tx = dir.x * V_RUN;
      const tz = dir.z * V_RUN;
      const acc = (h.grounded ? GROUND_ACCEL : AIR_ACCEL) * s;
      const dx = tx - h.vx;
      const dz = tz - h.vz;
      const dl = Math.hypot(dx, dz);
      if (dl <= acc) {
         h.vx = tx;
         h.vz = tz;
      } else {
         h.vx += (dx / dl) * acc;
         h.vz += (dz / dl) * acc;
      }
      if (mag > 0.15) h.yaw = Math.atan2(dir.x, dir.z);
   }
   // no speed over V_RUN outside a dash or a knock
   const hs = Math.hypot(h.vx, h.vz);
   if (!dashing(run) && !stunned && hs > V_RUN) {
      h.vx *= V_RUN / hs;
      h.vz *= V_RUN / hs;
   }

   // the jump
   if (run.pendJump) {
      run.pendJump = false;
      if (h.grounded && !stunned) {
         h.vy = V_JUMP;
         h.grounded = false;
         ev.jumped = true;
      } else if (!h.grounded && hero.power === "doubleJump" && !h.airJumped && h.y > FALL_Y) {
         h.vy = V_JUMP2;
         h.airJumped = true;
         ev.airJumped = true;
      }
   }

   h.x += h.vx * s;
   h.z += h.vz * s;
   if (h.grounded) {
      if (!supportAt(run, h.x, h.z)) {
         h.grounded = false;
         h.vy = 0;
      }
   }
   if (!h.grounded) {
      h.vy -= GRAV * s;
      h.y += h.vy * s;
      if (h.y <= 0 && h.vy <= 0) {
         if (h.y > FALL_Y && supportAt(run, h.x, h.z)) {
            h.y = 0;
            h.vy = 0;
            h.grounded = true;
            h.airJumped = false;
            ev.landed = true;
         } else if (h.y <= FALL_Y) {
            if (shielded(run)) {
               // Kiro's shield bounces him onto the safe marker: no life lost
               ev.saved = true;
               respawn(run);
               return;
            }
            h.state = "fall";
            run.lockMs = 0;
         }
      }
   }

   // L4: the sweeper bar
   if (a.cfg.sweeper > 0 && a.phase !== "start") {
      const c = Math.cos(a.sweepAngle);
      const sn = Math.sin(a.sweepAngle);
      const along = h.x * c + h.z * sn;
      const perp = -h.x * sn + h.z * c;
      const reach = a.half + 0.6;
      const face = BAR_HALF + BODY_R;
      if (along >= BAR_INNER && along <= reach) {
         // only the bar's leading face knocks: a body it reaches low; one already over or behind it is passed
         if (run.barPerp >= face && perp < face && perp > -face && h.y < BAR_HIGH) knock(run, -sn, c);
         run.barPerp = perp;
         const side = perp > 0 ? 1 : -1;
         if (run.barSide > 0 && side < 0 && h.y >= BAR_HIGH && Math.abs(perp) < 1.5) {
            run.hops += 1;
            ev.hop = true;
            if (run.hops >= HOPS) secret(run, "hopper");
         }
         run.barSide = side;
      } else {
         run.barSide = 0;
         run.barPerp = Number.NaN;
      }
   }
   // L5 P2: the shock ring
   if (a.shockR >= 0 && h.y < SHOCK_HIGH) {
      const d = Math.hypot(h.x, h.z);
      if (Math.abs(d - a.shockR) < SHOCK_HALF + BODY_R) knock(run, h.x || 0.01, h.z);
   }
}

function subStep(run: ArenaRun, input: StepInput): void {
   const a = run.arena;
   const ev = run.ev;
   if (run.index === 0) stepArena(a, STEP_MS);
   if (run.ended !== null) return;
   run.simMs += STEP_MS;
   a.alive[run.index] = true;
   stepHero(run, input, STEP_MS);
   if (run.ended !== null) {
      a.alive[run.index] = false;
      a.votes[run.index] = false;
      return;
   }
   const h = run.hero;
   const under = h.state === "play" ? tileAt(a, h.x, h.z) : -1;

   // the lock-in (not on level 5: the Keeper sets the pace)
   const canLock =
      a.phase === "call" && !a.cfg.boss && h.state === "play" && h.grounded && !phasing(run) && Math.hypot(h.vx, h.vz) < LOCK_SPEED && tileSafe(a, under) && tileSolid(a, under);
   run.lockMs = canLock ? run.lockMs + STEP_MS : 0;
   if (a.phase === "call") {
      const was = a.votes[run.index];
      a.votes[run.index] = run.lockMs >= LOCK_MS;
      if (!was && a.votes[run.index] && run.lockRound !== a.round) {
         run.lockAt = a.phaseMs;
         run.lockRound = a.round;
         ev.locked = true;
         comboHit(run.combo, COMBO, run.simMs, 0);
      }
   }

   // the orb (shared) and the gap shard
   if (a.orbLive && a.orbTile >= 0 && h.state === "play" && (a.phase === "call" || a.phase === "drop")) {
      tileCentre(a, a.orbTile, pt);
      const flat = Math.hypot(pt.x - h.x, pt.z - h.z);
      const near = Math.hypot(flat, ORB_Y - (h.y + 0.6)) < ORB_REACH;
      if (near || (run.simMs < run.magnetUntil && flat < MAGNET_REACH)) {
         a.orbLive = false;
         run.orbs += 1;
         ev.orb = true;
         comboHit(run.combo, COMBO, run.simMs, 0);
      }
   }
   if (a.gapLive && a.gapTile >= 0 && h.state === "play") {
      tileCentre(a, a.gapTile, pt);
      if (Math.hypot(pt.x - h.x, pt.z - h.z, GAP_Y - (h.y + 0.6)) < 0.9) {
         a.gapLive = false;
         secret(run, "gap");
      }
   }

   // each drop's end: did this hero survive the round?
   while (run.seenDrops < a.dropsEnded) {
      run.seenDrops += 1;
      const t = tileAt(a, h.x, h.z);
      const ok = h.state === "play" && h.y > FALL_Y && t >= 0 && (tileSolid(a, t) || (a.phase === "rise" && !a.drop[t])) && !a.hole[t];
      if (ok) {
         run.survived += 1;
         ev.survived = true;
         if (t === a.rainbowTile) secret(run, "rainbow");
         if (!a.cfg.boss) {
            run.quickStreak = run.lockRound === a.round && run.lockAt <= QUICK_MS ? run.quickStreak + 1 : 0;
            if (run.quickStreak >= QUICK_ROUNDS) secret(run, "quick");
         }
      } else run.quickStreak = 0;
      if (!a.cfg.boss && run.survived >= a.cfg.rounds) finish(run);
   }

   // level 5: a new beacon round resets the streak if the last one was missed
   while (run.seenBeacon < a.beaconSeq) {
      run.seenBeacon += 1;
      if (run.seenBeacon > 1 && run.hitBeacon !== run.seenBeacon - 1) run.beaconStreak = 0;
   }
   // level 5: on the beacon while the Keeper's window is open: the beam
   const boss = a.boss;
   if (boss && a.beaconArmed && boss.step === "vulnerable" && h.state === "play" && h.grounded && under === a.beaconTile) {
      a.beaconArmed = false;
      const r = hitBoss(boss, KEEPER, 1, a.bossEv);
      if (r !== "ignored") {
         ev.bossHit = true;
         run.hitBeacon = a.beaconSeq;
         run.beaconStreak += 1;
         if (run.beaconStreak >= STREAK) secret(run, "streak");
         comboHit(run.combo, COMBO, run.simMs, 0);
         if (r === "phase") {
            ev.bossPhase = true;
            a.ev.bossPhase = true;
         }
         if (r === "defeated") {
            ev.bossDefeated = true;
            a.ev.bossDefeated = true;
            a.won = true;
            a.wonMs = a.simMs;
         }
      }
   }
   if (a.won) finish(run);

   if (run.ended === null && run.simMs >= LEVELS[run.level].durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
   if (run.ended !== null) {
      a.alive[run.index] = false;
      a.votes[run.index] = false;
   }
}

/** Advances the run by one rendered frame (any dt); returns this frame's events (reused object). */
export function step(run: ArenaRun, frameMs: number, input: StepInput): StepEvents {
   const ev = run.ev;
   resetEvents(ev);
   if (run.index === 0) resetArenaEvents(run.arena.ev);
   // an owner whose hero is out keeps the shared arena going while the others still play
   const keepsArena = (): boolean => run.index === 0 && run.arena.alive.some(Boolean);
   if (run.ended !== null && !keepsArena()) return ev;
   if (run.ended === null) {
      if (input.jumpPressed) run.pendJump = true;
      if (input.actionPressed) run.pendAction = true;
   }
   run.acc += Math.min(MAX_FRAME_MS, Math.max(0, frameMs));
   while (run.acc >= STEP_MS - 1e-9) {
      run.acc -= STEP_MS;
      subStep(run, input);
      if (run.ended !== null && !keepsArena()) {
         run.acc = 0;
         break;
      }
   }
   return ev;
}

// ---------- reads for the scene and the HUD ----------

export const bossVulnerable = (run: ArenaRun): boolean => run.arena.boss !== null && run.arena.boss.step === "vulnerable";

/** 0..1 through the current call (the HUD's ring), 0 outside a call. */
export function callProgress(a: Arena): number {
   return a.phase === "call" ? Math.min(1, a.phaseMs / a.callLen) : 0;
}

/** The safe tile nearest the hero this call (the bot and the HUD's arrow), or -1. */
export function nearestSafe(run: ArenaRun): number {
   const a = run.arena;
   const h = run.hero;
   let best = -1;
   let bd = Infinity;
   for (let i = 0; i < a.colour.length; i++) {
      if (!tileSafe(a, i)) continue;
      tileCentre(a, i, pt);
      const d = Math.hypot(pt.x - h.x, pt.z - h.z);
      if (d < bd) {
         bd = d;
         best = i;
      }
   }
   return best;
}

export function flowOf(run: ArenaRun): number {
   return comboFlow(run.combo, COMBO, run.simMs);
}

// ---------- the score ----------

/** The submitted time: the finish time, nothing off (README "Scoring"). */
export const submittedMs = (run: ArenaRun): number => run.finishMs;

/** The run's stars (clear, the five orbs, the target time) and the no-hit badge. */
export function runStars(run: ArenaRun): StarResult {
   const cleared = run.ended === "win";
   return evaluateStars(starSpecFor(run.level), { cleared, orbs: run.orbs, goalValue: cleared ? submittedMs(run) : Number.NaN, hits: run.hits });
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/** The shell's score for a win: the time game submits its finish time. */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: finishMs };
   return { score: s.score, durationMs: s.elapsedMs };
}

export const STAT = {
   hero: "hero",
   power: "power",
   finishMs: "finishMs",
   hits: "hits",
   lives: "lives",
   orbs: "orbs",
   survived: "survived",
   round: "round",
   called: "called",
   phase: "phase",
   callLeft: "callLeft",
   lock: "lock",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   beacon: "beacon",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

/** The arena phase as a number for the HUD (STAT.phase). */
export const PHASE_IDS: Record<ArenaPhase, number> = { start: 0, call: 1, drop: 2, rise: 3, wait: 4 };

/** The level limits proven in proof.test.ts: bound.ts proposeLimits, pinned. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: { kind: "time", maxScore: 13_670, minDurationMs: 13_300, maxDurationMs: 150_000, timeBaseMs: 150_000 },
   2: { kind: "time", maxScore: 15_910, minDurationMs: 20_900, maxDurationMs: 180_000, timeBaseMs: 180_000 },
   3: { kind: "time", maxScore: 18_890, minDurationMs: 31_100, maxDurationMs: 220_000, timeBaseMs: 220_000 },
   4: { kind: "time", maxScore: 20_880, minDurationMs: 41_200, maxDurationMs: 250_000, timeBaseMs: 250_000 },
   5: { kind: "time", maxScore: 28_100, minDurationMs: 19_000, maxDurationMs: 300_000, timeBaseMs: 300_000 },
};

export { SECRETS, KEEPER };
