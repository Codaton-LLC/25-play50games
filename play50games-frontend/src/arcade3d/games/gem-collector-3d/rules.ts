// Gem Collector 3D rules. Pure and deterministic: one run, stepped in whole milliseconds (the
// fraction carries, so 30, 60 and 144 fps agree). The signature is the gem train: every gem you roll
// over joins a chain of links that trail your exact path (LINK_SPACING apart, at most MAX_LINKS).
// Drive into a score beacon to bank it: n links (gold counts 2) score min(400, n^2). Cross your own
// tail and the train is cut there: the cut links scatter as loose gems for SCATTER_MS. Bring the head
// back close to your tail without crossing it and the loop is closed: whatever is inside is lassoed
// (an ice slime freezes into a gold gem; the boss is stunned or hit).
//
// Every gem is in exactly one state (absent, on the floor, in the train, banked, loose, eaten), and
// the train holds gem indices, so a gem can be banked once at most. That is the score proof (README
// "Score limits"): the banks score at most floor(W / 20) * 400 + (W mod 20)^2 for the level's whole
// link supply W (every gem that can ever exist, gold counted twice), plus the orbs, the most flow
// bonus (menu2/combo: a gem's FIRST pickup, a bank, a lasso, a hit) and, on level 5, the Glutton.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "../../types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "../../menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "../../menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "../../menu2/secrets/secrets";
import {
   BANK_CAP,
   BANK_R,
   CHEST_R,
   CUT_R,
   CUT_SKIP,
   HERO_R,
   LASSO_MIN,
   LASSO_R,
   LINK_SPACING,
   LINK_WEIGHT,
   MAGNET_EXTRA,
   MAX_LINKS,
   ORB_R,
   PATH_CAP,
   PATH_STEP,
   PED_R,
   PICKUP_R,
   SCATTER_MS,
   SECRET_R,
   SLIME_R,
   arenaFor,
   beaconActive,
   buildArena,
   inBox,
   linkSupply,
   overPit,
   pushOutOf,
   sweepBand,
   type Arena,
} from "./arena";
import { BOSS_HOME } from "./levels";
import { DASH_BOOST, DASH_CHARGES, DEFAULT_HERO, POWER_MS, heroById, type HeroId } from "./heroes";
import { COMBO, COMBO_BASE, GLUTTON, POINTS, SECRETS } from "./progression";

export { arenaFor, buildArena };

/** roll speed (m/s), how fast the velocity eases to the stick (1/s), gravity, jumps */
export const V_RUN = 7;
export const ACCEL = 8;
export const G = 30;
export const V_JUMP = 8.5;
/** a frost gem (or the frost breath on the head) slows you to this share for SLOW_MS */
export const SLOW = 0.8;
export const SLOW_MS = 3000;
export const MAGNET_REVEAL_R = 7;
export const KNOCK_V = 6;
export const STUN_MS = 450;
export const RESPAWN_MS = 1000;
export const FALL_Y = -3;
const COYOTE = 90;
const BUFFER = 110;
const MAX_STEP_MS = 50;

/** the Glutton: body radius, speeds, how close his mouth is, the yawn bank's least train, his stun */
export const BOSS_R = 1.15;
export const BOSS_CHASE = 2.6;
export const BOSS_BITE_MS = 500;
export const BOSS_LUNGE = 7;
export const MOUTH_OFFSET = 1.4;
export const MOUTH_R = 1.8;
export const YAWN_MIN = 10;
export const STUN_BOSS_MS = 4000;
export const SLAM_R = 3.5;
export const MINI_R = 0.5;
export const MINI_CHASE = 2.8;
export const MINI_SLOW = 1;
export const SLIME_SPEED = 1.9;
export const BITE_COOLDOWN = 900;
/** after a bite a slime sits still, chewing, this long (the moment to lasso it) */
export const CHEW_MS = 3500;

export interface StepInput {
   moveX: number;
   moveZ: number;
   /** the camera yaw: the stick is camera-relative (inputToWorld) */
   yaw: number;
   jumpPressed: boolean;
   jumpHeld: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
}

/** gem states */
export const GEM = { absent: 0, floor: 1, train: 2, banked: 3, loose: 4, eaten: 5 } as const;

export interface Hero {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   grounded: boolean;
   coyote: number;
   buffer: number;
   airJumps: number;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   dashes: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   powerReadyAt: number;
   slowUntil: number;
   stunUntil: number;
   lostUntil: number;
   lastKnockMs: number;
   /** the pedestal it stands on (-1) */
   onPed: number;
}

export interface Glutton {
   x: number;
   z: number;
   /** the lunge's direction */
   lx: number;
   lz: number;
   stunUntil: number;
   /** the minis (phase 2): position and alive */
   mx: Float64Array;
   mz: Float64Array;
   mAlive: Uint8Array;
   mBite: Float64Array;
   lastBite: number;
}

export interface StepEvents {
   picked: number;
   banked: number;
   bankLinks: number;
   bankPoints: number;
   cut: number;
   cutLinks: number;
   lassoed: number;
   lassoKind: "" | "slime" | "boss" | "mini";
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   powered: boolean;
   dashed: boolean;
   wallBroken: number;
   knocked: boolean;
   shielded: boolean;
   fell: boolean;
   respawned: boolean;
   chest: number;
   orb: number;
   secret: string | null;
   comboUp: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeat: boolean;
   bossAttack: boolean;
   bossOpen: boolean;
   yawn: boolean;
   reachedTarget: boolean;
   ended: boolean;
}

export function createEvents(): StepEvents {
   return {
      picked: -1, banked: -1, bankLinks: 0, bankPoints: 0, cut: -1, cutLinks: 0, lassoed: -1, lassoKind: "",
      jumped: false, airJumped: false, landed: false, powered: false, dashed: false, wallBroken: -1, knocked: false, shielded: false,
      fell: false, respawned: false, chest: -1, orb: -1, secret: null, comboUp: false, bossHit: false, bossPhase: false,
      bossDefeat: false, bossAttack: false, bossOpen: false, yawn: false, reachedTarget: false, ended: false,
   };
}

function clearEvents(e: StepEvents): void {
   e.picked = e.banked = e.cut = e.lassoed = e.wallBroken = e.chest = e.orb = -1;
   e.bankLinks = e.bankPoints = e.cutLinks = 0;
   e.lassoKind = "";
   e.jumped = e.airJumped = e.landed = e.powered = e.dashed = e.knocked = e.shielded = e.fell = e.respawned = false;
   e.secret = null;
   e.comboUp = e.bossHit = e.bossPhase = e.bossDefeat = e.bossAttack = e.bossOpen = e.yawn = e.reachedTarget = e.ended = false;
}

export interface GemRun {
   seed: number;
   level: LevelId;
   heroId: HeroId;
   arena: Arena;
   simMs: number;
   frac: number;
   hero: Hero;
   /** per gem: state, position (loose gems move), fade time, first pickup done, revealed (magnet trail) */
   gemState: Uint8Array;
   gx: Float64Array;
   gz: Float64Array;
   gy: Float64Array;
   fadeAt: Float64Array;
   everTaken: Uint8Array;
   revealed: Uint8Array;
   /** the train: gem indices, head first */
   links: Int16Array;
   n: number;
   /** the path ring (x, z pairs), newest at pathHead - 1 */
   path: Float64Array;
   pathHead: number;
   pathCount: number;
   /** link positions (x, z pairs), recomputed with each path sample */
   linkPos: Float64Array;
   wallBroken: Uint8Array;
   chestOpen: Uint8Array;
   slimeX: Float64Array;
   slimeZ: Float64Array;
   slimeAlive: Uint8Array;
   slimeBite: Float64Array;
   orbTaken: Uint8Array;
   orbs: number;
   secrets: SecretTracker;
   combo: ComboState;
   score: number;
   bankPoints: number;
   banks: number;
   bestBank: number;
   cuts: number;
   lassos: number;
   strikes: number;
   /** the first ms the score reached the target (Infinity: not yet) */
   reachedAt: number;
   boss: BossState | null;
   bossEv: BossEvents;
   glutton: Glutton;
   fountains: number;
   /** a lasso's cooldown per target (ms of the last one): slimes, then the boss, then the minis */
   lassoAt: Float64Array;
   ended: "time" | "win" | null;
   ev: StepEvents;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO, arena: Arena = arenaFor(level)): GemRun {
   const a = arena;
   const ng = a.gems.length;
   const gemState = new Uint8Array(ng);
   const gx = new Float64Array(ng);
   const gz = new Float64Array(ng);
   const gy = new Float64Array(ng);
   for (let i = 0; i < ng; i++) {
      gx[i] = a.gems[i].x;
      gz[i] = a.gems[i].z;
      gy[i] = a.gems[i].y;
      if (i < a.levelGems) gemState[i] = GEM.floor;
   }
   const run: GemRun = {
      seed,
      level,
      heroId,
      arena: a,
      simMs: 0,
      frac: 0,
      hero: {
         x: a.startX, y: 0, z: a.startZ, vx: 0, vy: 0, vz: 0, grounded: true, coyote: 0, buffer: 0, airJumps: 0,
         dashUntil: -1, dashX: 0, dashZ: 1, dashes: DASH_CHARGES, shieldUntil: -1, magnetUntil: -1, phaseUntil: -1, powerReadyAt: 0,
         slowUntil: -1, stunUntil: -1, lostUntil: -1, lastKnockMs: -9999, onPed: -1,
      },
      gemState,
      gx,
      gz,
      gy,
      fadeAt: new Float64Array(ng).fill(Infinity),
      everTaken: new Uint8Array(ng),
      revealed: new Uint8Array(ng),
      links: new Int16Array(MAX_LINKS),
      n: 0,
      path: new Float64Array(PATH_CAP * 2),
      pathHead: 0,
      pathCount: 0,
      linkPos: new Float64Array(MAX_LINKS * 2),
      wallBroken: new Uint8Array(a.spec.crackedWalls.length),
      chestOpen: new Uint8Array(a.spec.chests.length),
      slimeX: Float64Array.from(a.spec.slimes.map((s) => s.x)),
      slimeZ: Float64Array.from(a.spec.slimes.map((s) => s.z)),
      slimeAlive: new Uint8Array(a.spec.slimes.length).fill(1),
      slimeBite: new Float64Array(a.spec.slimes.length).fill(-9999),
      orbTaken: new Uint8Array(a.orbs.length),
      orbs: 0,
      secrets: createSecretTracker(SECRETS[level]),
      combo: createCombo(),
      score: 0,
      bankPoints: 0,
      banks: 0,
      bestBank: 0,
      cuts: 0,
      lassos: 0,
      strikes: 0,
      reachedAt: Infinity,
      boss: a.spec.boss ? createBoss(GLUTTON) : null,
      bossEv: createBossEvents(),
      glutton: {
         x: BOSS_HOME.x, z: BOSS_HOME.z, lx: 0, lz: -1, stunUntil: -1,
         mx: new Float64Array(3), mz: new Float64Array(3), mAlive: new Uint8Array(3), mBite: new Float64Array(3).fill(-9999), lastBite: -9999,
      },
      fountains: 0,
      lassoAt: new Float64Array(a.spec.slimes.length + 4).fill(-9999),
      ended: null,
      ev: createEvents(),
   };
   resetPath(run);
   return run;
}

// ---------------------------------------------------------------------------------------------
// the train

/** Clears the path to a straight line behind the hero along (-dx, -dz) (a respawn, Riko's dash). */
function resetPath(run: GemRun, dx = 0, dz = 1): void {
   const h = run.hero;
   const m = Math.hypot(dx, dz) || 1;
   const ux = dx / m;
   const uz = dz / m;
   const count = Math.min(PATH_CAP, Math.ceil(((MAX_LINKS + 1) * LINK_SPACING) / PATH_STEP) + 2);
   run.pathHead = 0;
   run.pathCount = 0;
   for (let k = count - 1; k >= 0; k--) pushSample(run, h.x - ux * k * PATH_STEP, h.z - uz * k * PATH_STEP);
   placeLinks(run);
}

function pushSample(run: GemRun, x: number, z: number): void {
   run.path[run.pathHead * 2] = x;
   run.path[run.pathHead * 2 + 1] = z;
   run.pathHead = (run.pathHead + 1) % PATH_CAP;
   if (run.pathCount < PATH_CAP) run.pathCount++;
}

/** The k-th newest path sample (0 = newest) into out. */
function sample(run: GemRun, k: number, out: { x: number; z: number }): void {
   const i = (run.pathHead - 1 - k + PATH_CAP * 2) % PATH_CAP;
   out.x = run.path[i * 2];
   out.z = run.path[i * 2 + 1];
}

const SA = { x: 0, z: 0 };
const SB = { x: 0, z: 0 };

/** Places the links along the path behind the head (link k at (k + 1) * LINK_SPACING of arc). */
export function placeLinks(run: GemRun): void {
   const h = run.hero;
   let ax = h.x;
   let az = h.z;
   let walked = 0;
   let s = 0;
   for (let k = 0; k < MAX_LINKS; k++) {
      const want = (k + 1) * LINK_SPACING;
      while (s < run.pathCount) {
         sample(run, s, SB);
         const seg = Math.hypot(SB.x - ax, SB.z - az);
         if (walked + seg >= want) {
            const t = seg > 1e-9 ? (want - walked) / seg : 0;
            run.linkPos[k * 2] = ax + (SB.x - ax) * t;
            run.linkPos[k * 2 + 1] = az + (SB.z - az) * t;
            break;
         }
         walked += seg;
         ax = SB.x;
         az = SB.z;
         s++;
      }
      if (s >= run.pathCount) {
         run.linkPos[k * 2] = ax;
         run.linkPos[k * 2 + 1] = az;
      }
   }
}

/** Puts the hero at (x, z) with its train laid straight behind it along (-dx, -dz) (tests, set-ups). */
export function teleport(run: GemRun, x: number, z: number, dx = 0, dz = 1): void {
   run.hero.x = x;
   run.hero.z = z;
   resetPath(run, dx, dz);
}

/** Hands the hero a train of these gems (head first), taken from wherever they were (tests, set-ups). */
export function giveTrain(run: GemRun, gems: readonly number[]): void {
   run.n = 0;
   for (const gi of gems) {
      run.gemState[gi] = GEM.train;
      run.links[run.n++] = gi;
   }
   placeLinks(run);
}

/** The link weight now in the train (gold counts 2). */
export function trainWeight(run: GemRun): number {
   let w = 0;
   for (let k = 0; k < run.n; k++) w += LINK_WEIGHT[run.arena.gems[run.links[k]].kind];
   return w;
}

/** Cuts the train at link k: links k.. scatter as loose gems (or are eaten). */
function cutAt(run: GemRun, k: number, ev: StepEvents, eaten = false): void {
   if (k >= run.n) return;
   const ms = run.simMs;
   for (let j = k; j < run.n; j++) {
      const gi = run.links[j];
      if (eaten) {
         run.gemState[gi] = GEM.eaten;
         continue;
      }
      run.gemState[gi] = GEM.loose;
      const off = (((gi * 37) % 7) - 3) * 0.12;
      run.gx[gi] = run.linkPos[j * 2] + off;
      run.gz[gi] = run.linkPos[j * 2 + 1] - off;
      run.gy[gi] = 0;
      run.fadeAt[gi] = ms + SCATTER_MS;
   }
   ev.cut = k;
   ev.cutLinks = run.n - k;
   run.n = k;
   run.cuts += 1;
   comboBreak(run.combo);
}

/** Is (x, z) inside the loop the path makes from the head back `arc` m (closed by a straight line)? */
function inLoop(run: GemRun, arc: number, x: number, z: number): boolean {
   const h = run.hero;
   let inside = false;
   let px = h.x;
   let pz = h.z;
   let walked = 0;
   const firstX = h.x;
   const firstZ = h.z;
   for (let s = 0; s < run.pathCount && walked < arc; s++) {
      sample(run, s, SA);
      walked += Math.hypot(SA.x - px, SA.z - pz);
      if (pz > z !== SA.z > z && x < ((SA.x - px) * (z - pz)) / (SA.z - pz) + px) inside = !inside;
      px = SA.x;
      pz = SA.z;
   }
   // close it back to the head
   if (pz > z !== firstZ > z && x < ((firstX - px) * (z - pz)) / (firstZ - pz) + px) inside = !inside;
   return inside;
}

/** On each new path sample: the self-cut and the lasso. */
function trainChecks(run: GemRun, ev: StepEvents): void {
   const h = run.hero;
   const ms = run.simMs;
   const noCut = h.phaseUntil >= ms || h.dashUntil >= ms;
   for (let k = CUT_SKIP; k < run.n; k++) {
      const d = Math.hypot(run.linkPos[k * 2] - h.x, run.linkPos[k * 2 + 1] - h.z);
      if (d < CUT_R && !noCut) {
         cutAt(run, k, ev);
         return;
      }
      if (k >= LASSO_MIN && d < LASSO_R) {
         lasso(run, (k + 1) * LINK_SPACING, ev);
         return;
      }
   }
}

function lasso(run: GemRun, arc: number, ev: StepEvents): void {
   const ms = run.simMs;
   const a = run.arena;
   const ns = a.spec.slimes.length;
   // slimes freeze into a gold gem
   for (let i = 0; i < ns; i++) {
      if (!run.slimeAlive[i] || ms - run.lassoAt[i] < 1000) continue;
      if (!inLoop(run, arc, run.slimeX[i], run.slimeZ[i])) continue;
      run.lassoAt[i] = ms;
      run.slimeAlive[i] = 0;
      const gi = a.slimeGem0 + i;
      run.gemState[gi] = GEM.floor;
      run.gx[gi] = run.slimeX[i];
      run.gz[gi] = run.slimeZ[i];
      gotLasso(run, ev, i, "slime");
   }
   const b = run.boss;
   if (!b || b.hp <= 0) return;
   const g = run.glutton;
   const atHome = Math.hypot(g.x - BOSS_HOME.x, g.z - BOSS_HOME.z) < 0.2;
   if (b.phase === 0 && b.step === "vulnerable" && atHome && g.stunUntil < ms && ms - run.lassoAt[ns] >= 1000 && inLoop(run, arc, g.x, g.z)) {
      run.lassoAt[ns] = ms;
      g.stunUntil = ms + STUN_BOSS_MS;
      gotLasso(run, ev, ns, "boss");
   }
   if (b.phase === 1) {
      for (let m = 0; m < 3; m++) {
         if (!g.mAlive[m] || ms - run.lassoAt[ns + 1 + m] < 1000) continue;
         if (!inLoop(run, arc, g.mx[m], g.mz[m])) continue;
         run.lassoAt[ns + 1 + m] = ms;
         if (b.step === "vulnerable") {
            g.mAlive[m] = 0;
            gotLasso(run, ev, ns + 1 + m, "mini");
            bossHitNow(run, ev);
            return;
         }
      }
   }
}

function gotLasso(run: GemRun, ev: StepEvents, target: number, kind: StepEvents["lassoKind"]): void {
   ev.lassoed = target;
   ev.lassoKind = kind;
   run.lassos += 1;
   addPoints(run, comboHit(run.combo, COMBO, run.simMs, COMBO_BASE.lasso));
   ev.comboUp = true;
}

function addPoints(run: GemRun, p: number): void {
   run.score += p;
}

/** Banks the whole train: min(BANK_CAP, w^2). Returns the points. */
function bank(run: GemRun, ev: StepEvents, where: number): number {
   const w = trainWeight(run);
   const pts = Math.min(BANK_CAP, w * w);
   for (let k = 0; k < run.n; k++) run.gemState[run.links[k]] = GEM.banked;
   ev.banked = where;
   ev.bankLinks = run.n;
   ev.bankPoints = pts;
   run.n = 0;
   run.banks += 1;
   run.bankPoints += pts;
   run.bestBank = Math.max(run.bestBank, pts);
   addPoints(run, pts);
   addPoints(run, comboHit(run.combo, COMBO, run.simMs, COMBO_BASE.bank));
   ev.comboUp = true;
   return pts;
}

function bossHitNow(run: GemRun, ev: StepEvents): void {
   const b = run.boss!;
   const r = hitBoss(b, GLUTTON, 1, run.bossEv);
   if (r === "ignored") return;
   ev.bossHit = true;
   addPoints(run, POINTS.hit);
   addPoints(run, comboHit(run.combo, COMBO, run.simMs, COMBO_BASE.hit));
   if (r === "defeated") {
      ev.bossDefeat = true;
      addPoints(run, POINTS.defeat);
   }
}

// ---------------------------------------------------------------------------------------------
// the step

function knock(run: GemRun, ev: StepEvents, dx: number, dz: number): void {
   const h = run.hero;
   const ms = run.simMs;
   if (ms - h.lastKnockMs < 600) return;
   if (h.shieldUntil >= ms) {
      ev.shielded = true;
      return;
   }
   h.lastKnockMs = ms;
   const m = Math.hypot(dx, dz) || 1;
   h.vx = (dx / m) * KNOCK_V;
   h.vz = (dz / m) * KNOCK_V;
   h.vy = Math.max(h.vy, 4);
   h.grounded = false;
   h.stunUntil = ms + STUN_MS;
   run.strikes += 1;
   comboBreak(run.combo);
   ev.knocked = true;
}

function usePower(run: GemRun, input: StepInput, ev: StepEvents): void {
   const h = run.hero;
   const ms = run.simMs;
   const def = heroById(run.heroId);
   if (!input.actionPressed || ms < h.powerReadyAt) return;
   if (def.power === "doubleJump") return;
   if (def.power === "dash") {
      if (h.dashes <= 0) return;
      h.dashes -= 1;
      const sp = Math.hypot(h.vx, h.vz);
      h.dashX = sp > 0.5 ? h.vx / sp : h.dashX;
      h.dashZ = sp > 0.5 ? h.vz / sp : h.dashZ;
      h.dashUntil = ms + POWER_MS.dash;
      // the train snaps straight behind the dash
      resetPath(run, h.dashX, h.dashZ);
      ev.dashed = true;
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else if (def.power === "phase") h.phaseUntil = ms + POWER_MS.phase;
   h.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

function respawn(run: GemRun, ev: StepEvents): void {
   const h = run.hero;
   const a = run.arena;
   h.x = a.startX;
   h.z = a.startZ;
   h.y = 0;
   h.vx = h.vy = h.vz = 0;
   h.grounded = true;
   h.lostUntil = -1;
   h.onPed = -1;
   resetPath(run);
   ev.respawned = true;
}

const STICK = { x: 0, z: 0 };
const PUSH = { x: 0, z: 0 };
const BAND = { x0: 0, x1: 0 };
const K_ACCEL = 1 - Math.exp(-ACCEL / 1000);

/** Advances the run by dtMs (capped at MAX_STEP_MS), 1 ms at a time. Returns the run's events object. */
export function step(run: GemRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.ev;
   clearEvents(ev);
   if (run.ended) return ev;
   const total = Math.min(MAX_STEP_MS, Math.max(0, dtMs)) + run.frac;
   const whole = Math.floor(total);
   run.frac = total - whole;
   if (input.jumpPressed) run.hero.buffer = BUFFER;
   usePower(run, input, ev);
   inputToWorld(input.moveX, input.moveZ, input.yaw, STICK);
   const sx = Math.max(-1, Math.min(1, STICK.x));
   const sz = Math.max(-1, Math.min(1, STICK.z));
   for (let i = 0; i < whole && !run.ended; i++) stepMs(run, ev, sx, sz, input);
   return ev;
}

function stepMs(run: GemRun, ev: StepEvents, sx: number, sz: number, input: StepInput): void {
   run.simMs += 1;
   const ms = run.simMs;
   const a = run.arena;
   const h = run.hero;
   comboTick(run.combo, COMBO, ms);
   if (run.boss) stepBossMs(run, ev);
   if (run.ended) return;
   if (ms >= a.durationMs) {
      run.ended = "time";
      ev.ended = true;
      return;
   }
   // the vault refills on its schedule
   if (a.waveEveryMs > 0 && ms % a.waveEveryMs === 0) {
      const k = ms / a.waveEveryMs - 1;
      for (let i = a.waveGem0; i < a.fountainGem0; i++) if (a.gems[i].source === k && run.gemState[i] === GEM.absent) run.gemState[i] = GEM.floor;
   }
   // loose gems fade
   for (let i = 0; i < run.gemState.length; i++) if (run.gemState[i] === GEM.loose && ms >= run.fadeAt[i]) run.gemState[i] = GEM.eaten;
   if (h.lostUntil >= 0) {
      if (ms >= h.lostUntil) respawn(run, ev);
      return;
   }

   // --- horizontal
   const stunned = ms < h.stunUntil;
   const dashing = h.dashUntil >= ms;
   const top = V_RUN * (h.slowUntil >= ms ? SLOW : 1);
   if (dashing) {
      h.vx = h.dashX * (V_RUN + DASH_BOOST);
      h.vz = h.dashZ * (V_RUN + DASH_BOOST);
   } else {
      const tx = stunned ? 0 : sx * top;
      const tz = stunned ? 0 : sz * top;
      const k = stunned ? K_ACCEL * 0.5 : K_ACCEL;
      h.vx += (tx - h.vx) * k;
      h.vz += (tz - h.vz) * k;
   }
   const cap = (dashing ? V_RUN + DASH_BOOST : Math.max(V_RUN, KNOCK_V)) / 1000;
   let mx = h.vx * 0.001;
   let mz = h.vz * 0.001;
   const ml = Math.hypot(mx, mz);
   if (ml > cap) {
      mx *= cap / ml;
      mz *= cap / ml;
   }
   let nx = h.x + mx;
   let nz = h.z + mz;
   // solids: the cracked wall (a dash breaks it), the ghost wall (Vexa's phase), the vault and pocket walls
   for (const s of a.solids) {
      if (s.kind === "cracked" && run.wallBroken[s.index]) continue;
      if (s.kind === "ghost" && h.phaseUntil >= ms) continue;
      if (h.y > 2.6) continue;
      if (s.kind === "cracked" && dashing && inBox(s, nx, nz, HERO_R + 0.05)) {
         run.wallBroken[s.index] = 1;
         ev.wallBroken = s.index;
         continue;
      }
      if (pushOutOf(s, nx, nz, PUSH)) {
         nx = PUSH.x;
         nz = PUSH.z;
      }
   }
   // pedestal sides
   for (let p = 0; p < a.pedestals.length; p++) {
      const pd = a.pedestals[p];
      if (h.y >= pd.h - 0.15) continue;
      const dx = nx - pd.x;
      const dz = nz - pd.z;
      const d = Math.hypot(dx, dz);
      const r = PED_R + HERO_R;
      if (d < r && d > 1e-9) {
         nx = pd.x + (dx / d) * r;
         nz = pd.z + (dz / d) * r;
      }
   }
   // the Glutton's body
   if (run.boss && run.boss.hp > 0 && h.y < 2.4) {
      const g = run.glutton;
      const dx = nx - g.x;
      const dz = nz - g.z;
      const d = Math.hypot(dx, dz);
      const r = BOSS_R + HERO_R;
      if (d < r && d > 1e-9) {
         nx = g.x + (dx / d) * r;
         nz = g.z + (dz / d) * r;
      }
   }
   // the rim
   const rr = a.radius - 0.5;
   const dr = Math.hypot(nx, nz);
   if (dr > rr) {
      nx *= rr / dr;
      nz *= rr / dr;
   }
   h.x = nx;
   h.z = nz;

   // --- vertical
   if (h.buffer > 0) h.buffer -= 1;
   const def = heroById(run.heroId);
   if (h.buffer > 0 && (h.grounded || h.coyote > 0) && !stunned) {
      h.vy = V_JUMP;
      h.grounded = false;
      h.coyote = 0;
      h.buffer = 0;
      h.airJumps = def.power === "doubleJump" ? 1 : 0;
      ev.jumped = true;
   } else if (h.buffer > 0 && !h.grounded && h.airJumps > 0 && !stunned) {
      h.vy = V_JUMP;
      h.airJumps -= 1;
      h.buffer = 0;
      ev.airJumped = true;
   }
   let surf = overPit(a, h.x, h.z, ms) ? -Infinity : 0;
   let ped = -1;
   for (let p = 0; p < a.pedestals.length; p++) {
      const pd = a.pedestals[p];
      if (Math.hypot(h.x - pd.x, h.z - pd.z) <= PED_R + 0.1 && h.y >= pd.h - 0.6 && pd.h > surf) {
         surf = pd.h;
         ped = p;
      }
   }
   if (h.grounded) {
      if (surf !== -Infinity && Math.abs(surf - h.y) <= 0.3) {
         h.y = surf;
         h.vy = 0;
      } else {
         h.grounded = false;
         h.coyote = COYOTE;
         h.airJumps = def.power === "doubleJump" ? 1 : 0;
      }
   }
   if (!h.grounded) {
      h.vy -= G * 0.001;
      h.y += h.vy * 0.001;
      if (h.coyote > 0) h.coyote -= 1;
      if (surf !== -Infinity && h.vy <= 0 && h.y <= surf && h.y >= surf - 0.8) {
         h.y = surf;
         h.vy = 0;
         h.grounded = true;
         ev.landed = true;
      }
   }
   h.onPed = h.grounded ? ped : -1;
   if (h.y < FALL_Y) {
      // into a sunk tile: the train is lost (it scatters on the floor round the pit), back to the start
      cutAt(run, 0, ev);
      h.lostUntil = ms + RESPAWN_MS;
      ev.fell = true;
      return;
   }

   // --- the path and the train
   sample(run, 0, SA);
   if (Math.hypot(h.x - SA.x, h.z - SA.z) >= PATH_STEP) {
      pushSample(run, h.x, h.z);
      placeLinks(run);
      trainChecks(run, ev);
   }

   // --- hazards on the tail: frost sweepers and slimes (Kiro's shield keeps the tail)
   const shield = h.shieldUntil >= ms;
   for (const sw of a.sweepers) {
      if (!sweepBand(sw, ms, BAND)) continue;
      if (h.x > BAND.x0 && h.x < BAND.x1 && h.z > sw.z0 && h.z < sw.z1 && !shield) h.slowUntil = ms + SLOW_MS;
      if (shield) continue;
      for (let k = 0; k < run.n; k++) {
         const lx = run.linkPos[k * 2];
         const lz = run.linkPos[k * 2 + 1];
         if (lx > BAND.x0 && lx < BAND.x1 && lz > sw.z0 && lz < sw.z1) {
            cutAt(run, k, ev);
            break;
         }
      }
   }
   stepSlimes(run, ev, shield);

   // --- pickups
   const reach = PICKUP_R + (h.magnetUntil >= ms ? MAGNET_EXTRA : 0);
   const magnet = h.magnetUntil >= ms;
   for (let i = 0; i < run.gemState.length; i++) {
      const st = run.gemState[i];
      if (st !== GEM.floor && st !== GEM.loose) continue;
      const gem = a.gems[i];
      if (gem.hidden && !run.revealed[i]) {
         if (magnet && Math.hypot(run.gx[i] - h.x, run.gz[i] - h.z) <= MAGNET_REVEAL_R) run.revealed[i] = 1;
         continue;
      }
      if (run.n >= MAX_LINKS) break;
      if (Math.abs(run.gy[i] - h.y) > 1.1) continue;
      if (Math.hypot(run.gx[i] - h.x, run.gz[i] - h.z) > reach) continue;
      run.gemState[i] = GEM.train;
      // the newest link goes at the head of the train
      for (let k = run.n; k > 0; k--) run.links[k] = run.links[k - 1];
      run.links[0] = i;
      run.n += 1;
      ev.picked = i;
      if (gem.kind === "frost") h.slowUntil = ms + SLOW_MS;
      if (!run.everTaken[i]) {
         run.everTaken[i] = 1;
         addPoints(run, comboHit(run.combo, COMBO, ms, COMBO_BASE.gem));
         ev.comboUp = true;
      }
   }

   // --- chests (L4): touch one and it bursts into its six gems
   for (let c = 0; c < run.chestOpen.length; c++) {
      if (run.chestOpen[c]) continue;
      const ch = a.spec.chests[c];
      if (Math.hypot(ch.x - h.x, ch.z - h.z) > CHEST_R + HERO_R) continue;
      run.chestOpen[c] = 1;
      for (let j = 0; j < 6; j++) run.gemState[a.chestGem0 + c * 6 + j] = GEM.floor;
      ev.chest = c;
   }

   // --- banking at a beacon (none while the Glutton holds the last one in phase 3)
   const swallowed = run.boss !== null && run.boss.phase === 2 && run.boss.hp > 0;
   if (run.n > 0 && !swallowed) {
      for (let b = 0; b < a.beacons.length; b++) {
         if (!beaconActive(a, b, ms)) continue;
         const bc = a.beacons[b];
         if (Math.hypot(bc.x - h.x, bc.z - h.z) > BANK_R) continue;
         bank(run, ev, b);
         // phase 1: a bank while he is stunned is the hit
         const bs = run.boss;
         if (bs && bs.phase === 0 && bs.step === "vulnerable" && run.glutton.stunUntil >= ms) bossHitNow(run, ev);
         break;
      }
   }

   // --- orbs and secrets
   for (let o = 0; o < a.orbs.length; o++) {
      if (run.orbTaken[o]) continue;
      const ob = a.orbs[o];
      if (Math.hypot(ob.x - h.x, ob.z - h.z) > ORB_R || Math.abs(ob.y - (h.y + 0.8)) > 1.4) continue;
      run.orbTaken[o] = 1;
      run.orbs += 1;
      addPoints(run, POINTS.orb);
      ev.orb = o;
   }
   for (let s = 0; s < a.secrets.length; s++) {
      const sp = a.secrets[s];
      if (Math.hypot(sp.x - h.x, sp.z - h.z) > SECRET_R || Math.abs(sp.y - (h.y + 0.8)) > 1.4) continue;
      if (collectSecret(run.secrets, s)) ev.secret = SECRETS[run.level][s].id;
   }

   if (run.reachedAt === Infinity && !run.boss && run.score >= a.spec.targetScore) {
      run.reachedAt = ms;
      ev.reachedTarget = true;
   }
}

function stepSlimes(run: GemRun, ev: StepEvents, shield: boolean): void {
   const ms = run.simMs;
   const h = run.hero;
   const rr = run.arena.radius - 1;
   for (let i = 0; i < run.slimeAlive.length; i++) {
      if (!run.slimeAlive[i]) continue;
      const chewing = ms - run.slimeBite[i] < CHEW_MS;
      // hunt the train's last link (no train: sit); still while it chews
      if (!chewing && run.n > 0) {
         const tx = run.linkPos[(run.n - 1) * 2];
         const tz = run.linkPos[(run.n - 1) * 2 + 1];
         const dx = tx - run.slimeX[i];
         const dz = tz - run.slimeZ[i];
         const d = Math.hypot(dx, dz);
         if (d > 0.05) {
            run.slimeX[i] += (dx / d) * SLIME_SPEED * 0.001;
            run.slimeZ[i] += (dz / d) * SLIME_SPEED * 0.001;
         }
      }
      const sr = Math.hypot(run.slimeX[i], run.slimeZ[i]);
      if (sr > rr) {
         run.slimeX[i] *= rr / sr;
         run.slimeZ[i] *= rr / sr;
      }
      if (shield || chewing) continue;
      // a bite takes the last link only (it scatters)
      const k = run.n - 1;
      if (k >= 0 && Math.hypot(run.linkPos[k * 2] - run.slimeX[i], run.linkPos[k * 2 + 1] - run.slimeZ[i]) < SLIME_R + 0.3) {
         run.slimeBite[i] = ms;
         cutAt(run, k, ev);
      }
   }
}

/** The Glutton: his phases move him, his mouth eats the tail, the minis nibble; the fountains refill. */
function stepBossMs(run: GemRun, ev: StepEvents): void {
   const b = run.boss!;
   const g = run.glutton;
   const h = run.hero;
   const ms = run.simMs;
   const be = run.bossEv;
   const phaseBefore = b.phase;
   stepBoss(b, GLUTTON, 1, be);
   if (be.attack) ev.bossAttack = true;
   if (be.vulnerable) ev.bossOpen = true;
   if (b.phase !== phaseBefore) ev.bossPhase = true;
   if (b.step === "done" || b.step === "defeat") {
      if (b.step === "done" && !run.ended) {
         run.ended = "win";
         ev.ended = true;
      }
      return;
   }
   // a fountain refills the floor as each new phase starts
   if (b.phase > run.fountains && b.step !== "transition" && b.phase - 1 < 2) {
      const f = b.phase - 1;
      const a = run.arena;
      for (let i = a.fountainGem0; i < a.gems.length; i++) if (a.gems[i].source === f && run.gemState[i] === GEM.absent) run.gemState[i] = GEM.floor;
      run.fountains = b.phase;
      if (b.phase === 1) {
         // the split: three minis round his home
         for (let m = 0; m < 3; m++) {
            const ang = (m / 3) * Math.PI * 2 + 0.5;
            g.mx[m] = BOSS_HOME.x + Math.sin(ang) * 4;
            g.mz[m] = BOSS_HOME.z + Math.cos(ang) * 4;
            g.mAlive[m] = 1;
         }
      }
   }
   const toHero = (speed: number) => {
      const dx = h.x - g.x;
      const dz = h.z - g.z;
      const d = Math.hypot(dx, dz);
      if (d > BOSS_R + HERO_R + 0.2) {
         g.x += (dx / d) * speed * 0.001;
         g.z += (dz / d) * speed * 0.001;
      }
   };
   const home = (speed: number) => {
      const dx = BOSS_HOME.x - g.x;
      const dz = BOSS_HOME.z - g.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
         g.x += (dx / d) * Math.min(d, speed * 0.001);
         g.z += (dz / d) * Math.min(d, speed * 0.001);
      }
   };
   if (b.phase === 0) {
      if (b.step === "telegraph") toHero(BOSS_CHASE);
      else if (b.step === "attack") {
         if (be.attack) {
            const d = Math.hypot(h.x - g.x, h.z - g.z) || 1;
            g.lx = (h.x - g.x) / d;
            g.lz = (h.z - g.z) / d;
         }
         g.x += g.lx * BOSS_LUNGE * 0.001;
         g.z += g.lz * BOSS_LUNGE * 0.001;
      } else if (b.step === "vulnerable") home(6);
      else if (b.step === "transition" || b.step === "intro") home(3);
      // touching the train, he eats its last link every BOSS_BITE_MS (not while he squats, full)
      if ((b.step === "telegraph" || b.step === "attack") && ms - g.lastBite > BOSS_BITE_MS && run.n > 0) {
         for (let k = 0; k < run.n; k++) {
            if (Math.hypot(run.linkPos[k * 2] - g.x, run.linkPos[k * 2 + 1] - g.z) < BOSS_R + 0.3) {
               g.lastBite = ms;
               cutAt(run, run.n - 1, ev, true);
               break;
            }
         }
         if (Math.hypot(h.x - g.x, h.z - g.z) < BOSS_R + HERO_R + 0.15) knock(run, ev, h.x - g.x, h.z - g.z);
      }
   } else if (b.phase === 1) {
      home(3);
      const speed = b.step === "vulnerable" ? MINI_SLOW : MINI_CHASE;
      for (let m = 0; m < 3; m++) {
         if (!g.mAlive[m]) continue;
         const tx = run.n > 0 ? run.linkPos[(run.n - 1) * 2] : h.x;
         const tz = run.n > 0 ? run.linkPos[(run.n - 1) * 2 + 1] : h.z;
         const dx = tx - g.mx[m];
         const dz = tz - g.mz[m];
         const d = Math.hypot(dx, dz);
         if (d > 0.05) {
            g.mx[m] += (dx / d) * speed * 0.001;
            g.mz[m] += (dz / d) * speed * 0.001;
         }
         const r = run.arena.radius - 1;
         const mr = Math.hypot(g.mx[m], g.mz[m]);
         if (mr > r) {
            g.mx[m] *= r / mr;
            g.mz[m] *= r / mr;
         }
         if (b.step === "vulnerable" || h.shieldUntil >= ms || ms - g.mBite[m] < BITE_COOLDOWN) continue;
         for (let k = 0; k < run.n; k++) {
            if (Math.hypot(run.linkPos[k * 2] - g.mx[m], run.linkPos[k * 2 + 1] - g.mz[m]) < MINI_R + 0.3) {
               g.mBite[m] = ms;
               cutAt(run, k, ev);
               break;
            }
         }
      }
   } else {
      // the yawn: he holds the last beacon at home, slams on the attack, yawns in the window
      home(3);
      if (be.attack && Math.hypot(h.x - g.x, h.z - g.z) < SLAM_R && h.y < 1) knock(run, ev, h.x - g.x, h.z - g.z);
      if (b.step === "vulnerable" && run.n >= YAWN_MIN) {
         const mx = g.x;
         const mz = g.z - MOUTH_OFFSET;
         if (Math.hypot(h.x - mx, h.z - mz) <= MOUTH_R) {
            const over = run.n - YAWN_MIN;
            bank(run, ev, -1);
            addPoints(run, over * POINTS.yawnLink);
            ev.yawn = true;
            bossHitNow(run, ev);
         }
      }
   }
}

// ---------------------------------------------------------------------------------------------
// the proof

/** The least rules-time to beat the Glutton: every hit on the first instant of its window. */
export function bossMinMs(): number {
   const s = createBoss(GLUTTON);
   const ev = createBossEvents();
   let t = 0;
   for (let guard = 0; guard < 400_000 && s.step !== "defeat" && s.step !== "done"; guard++) {
      if (s.step === "vulnerable") {
         const r = hitBoss(s, GLUTTON, 1, ev);
         if (r === "defeated") return t;
         continue;
      }
      stepBoss(s, GLUTTON, 1, ev);
      t += 1;
   }
   return t;
}

/** The most the banks can score with W link weight in all: floor(W / 20) * 400 + (W mod 20)^2. */
export function bankBound(w: number): number {
   const full = Math.floor(w / MAX_LINKS);
   const rest = w - full * MAX_LINKS;
   return full * BANK_CAP + Math.min(BANK_CAP, rest * rest);
}

export function comboSpecOf(a: Arena): ComboLevelSpec {
   const gems = a.gems.length;
   return {
      combo: COMBO,
      sources: [
         { count: gems, base: COMBO_BASE.gem },
         { count: gems, base: COMBO_BASE.bank },
         { count: a.spec.slimes.length + (a.spec.boss ? 6 : 0), base: COMBO_BASE.lasso },
         { count: a.spec.boss ? GLUTTON.maxHp : 0, base: COMBO_BASE.hit },
      ],
   };
}

/** The most any run of the level can score (README "Score limits"). */
export function maxScoreOf(a: Arena): number {
   let m = bankBound(linkSupply(a)) + a.orbs.length * POINTS.orb + comboMaxBonus(comboSpecOf(a));
   if (a.spec.boss) m += GLUTTON.maxHp * POINTS.hit + POINTS.defeat + (MAX_LINKS - YAWN_MIN) * POINTS.yawnLink;
   return m;
}

/** The least duration of a ranked run: the round (it only ends on its clock), or on level 5 the defeat. */
export function minDurationMsOf(a: Arena): number {
   return a.spec.boss ? bossMinMs() : a.durationMs;
}

export interface LevelLimits {
   kind: "points";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   base: number;
   maxPointsPerSec: number;
}

export function proposeLimits(_id: LevelId, a: Arena): LevelLimits {
   const least = minDurationMsOf(a);
   const minDurationMs = Math.floor((least * 0.95) / 100) * 100;
   const maxScore = maxScoreOf(a);
   return { kind: "points", maxScore, minDurationMs, maxDurationMs: a.durationMs + 1000, base: 0, maxPointsPerSec: Math.ceil((maxScore * 1000) / minDurationMs) };
}

/** Pinned (literal) limits: equal to proposeLimits (rules.test.ts), meta.ts and arcade-games.json. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: { kind: "points", maxScore: 4235, minDurationMs: 85500, maxDurationMs: 91000, base: 0, maxPointsPerSec: 50 },
   2: { kind: "points", maxScore: 5449, minDurationMs: 95000, maxDurationMs: 101000, base: 0, maxPointsPerSec: 58 },
   3: { kind: "points", maxScore: 6300, minDurationMs: 104500, maxDurationMs: 111000, base: 0, maxPointsPerSec: 61 },
   4: { kind: "points", maxScore: 7132, minDurationMs: 114000, maxDurationMs: 121000, base: 0, maxPointsPerSec: 63 },
   5: { kind: "points", maxScore: 10917, minDurationMs: 29100, maxDurationMs: 201000, base: 0, maxPointsPerSec: 376 },
};

/** The run's final score for the shell: the points (the duration is the run time). */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   return { score: Math.max(0, Math.floor(s.score)), durationMs: s.elapsedMs };
}

/** The level is cleared: the target score reached (level 5: the Glutton down). */
export function levelCleared(run: GemRun): boolean {
   if (run.boss) return run.boss.hp <= 0;
   return run.score >= run.arena.spec.targetScore;
}

/** The no-cut badge: never cut, bitten, eaten or knocked. */
export function badgeHits(run: GemRun): number {
   return run.cuts + run.strikes;
}

/** Where the ground arrow points: a full train to a beacon, else the nearest gem; Glutton's windows. */
export function guidePoint(run: GemRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const a = run.arena;
   const h = run.hero;
   const ms = run.simMs;
   out.y = 0;
   const b = run.boss;
   if (b && b.hp > 0) {
      const g = run.glutton;
      if ((b.phase === 0 && b.step === "vulnerable" && g.stunUntil < ms) || b.phase === 2) {
         out.x = g.x;
         out.z = b.phase === 2 ? g.z - MOUTH_OFFSET : g.z;
         return out;
      }
   }
   const full = trainWeight(run) >= MAX_LINKS || (b !== null && b.phase === 0 && run.glutton.stunUntil >= ms && run.n > 0);
   let best = Infinity;
   out.x = h.x;
   out.z = h.z;
   if (full) {
      for (let i = 0; i < a.beacons.length; i++) {
         if (!beaconActive(a, i, ms)) continue;
         const d = Math.hypot(a.beacons[i].x - h.x, a.beacons[i].z - h.z);
         if (d < best) {
            best = d;
            out.x = a.beacons[i].x;
            out.z = a.beacons[i].z;
         }
      }
      return out;
   }
   for (let i = 0; i < run.gemState.length; i++) {
      const st = run.gemState[i];
      if ((st !== GEM.floor && st !== GEM.loose) || (a.gems[i].hidden && !run.revealed[i]) || run.gy[i] > 0.5) continue;
      const d = Math.hypot(run.gx[i] - h.x, run.gz[i] - h.z);
      if (d < best) {
         best = d;
         out.x = run.gx[i];
         out.z = run.gz[i];
      }
   }
   return out;
}

/** The store stats the HUD and the star screen read. */
export const STAT = {
   links: "links",
   weight: "weight",
   orbs: "orbs",
   hero: "hero",
   power: "power",
   dashes: "dashes",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   banks: "banks",
   bestBank: "bestBank",
   target: "target",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   bossOn: "bossOn",
   bossStun: "bossStun",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
   cuts: "cuts",
} as const;
