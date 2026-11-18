// Temple Lantern Jump's rules: pure and deterministic (no three.js, React, DOM, Math.random or Date).
// Scene.tsx calls step() from one useRunFrame; the same seed + level + hero + inputs always give the
// same run, at any frame rate (the simulation advances in fixed 1000/120 ms steps).
//
// The signature mechanic (card "Ignite and carry the flame"): a vertical platformer in the dark. The
// hero carries an EMBER, an 8 s meter (6 s on level 4) whose light radius shrinks from 6 m to 1.5 m
// as it burns down, and nothing at all once it is out. LANTERNS are bounce pads: landing on one throws
// you a normal jump x1.4 high, refills the ember and lights the lantern for 12 s (a 5 m sphere of
// light). GLYPH ledges are solid only while they sit in some light (the ember, a lit lantern, a flare,
// an ally's ember, a brazier flood) and fade out over 0.4 s once it is gone; plain stone, decks, wood
// balconies and the roof are always solid. So the route is a chain of light: bounce, climb the ledges
// the light made solid, reach the next lantern before both lights die. Action in the air throws the
// ember down at a lantern (3 s of ember), else the hero's power.
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "../../types";
import { comboBreak, comboFlow, comboHit, comboTick, createCombo, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import { RIM, WALL_RING, batAt, courseFor, gustStart, GUST, jetPhase, padX, padZ, type Course, type Pad } from "./course";
import { DEFAULT_HERO, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { COMBO, COMBO_BASE_MS, QUEEN, SECRETS, starSpecFor } from "./progression";

// ---------- tuning ----------

export const STEP_MS = 1000 / 120;
/** a frame longer than this is cut (the shell's own play dt cap is 50 ms) */
export const MAX_FRAME_MS = 50;
export const V_WALK = 5.5;
export const V_JUMP = 9.4;
export const GRAV = 24;
/** a lantern throws you a normal jump x1.4 high (the card) */
export const BOUNCE_HEIGHT = 1.4;
export const V_BOUNCE = V_JUMP * Math.sqrt(BOUNCE_HEIGHT);
/** the fastest average climb any route can make: bounces landing on their apex (m/s), used by the proof */
export const V_CLIMB_MAX = V_BOUNCE / 2;
export const HERO_R = 0.38;
/** a landing counts this far past a pad's rim (m) */
export const LAND_SLACK = 0.25;
/** a jump still works this long after walking off a ledge (ms) */
export const COYOTE_MS = 100;
/** a glyph ledge fades out over this long once the light is gone (the card: 0.4 s) */
export const FADE_MS = 400;
export const LANTERN_LIT_MS = 12_000;
export const GUST_LIT_MS = 6_000;
export const LANTERN_LIGHT_R = 5;
export const DECK_LIGHT_R = 3.5;
export const EMBER_MAX_R = 6;
export const EMBER_MIN_R = 1.5;
/** the ember beeps (a sound) when it falls under this (ms) */
export const EMBER_LOW_MS = 2_000;
export const THROW_COST_MS = 3_000;
export const THROW_REACH = 4.5;
export const THROW_DROP = 14;
export const FLARE_MS = 6_000;
export const FLARE_R = 4;
export const FLOOD_MS = 20_000;
export const SPARK_MS = 2_000;
export const SPARK_REACH = 5.5;
export const ORB = { pickup: 1.0, bonusMs: 100 } as const;
export const BRAZIER_R = 1.2;
export const CRUMBLE_MS = 1_200;
export const CRUMBLE_BACK_MS = 4_000;
export const BAT_STUN_MS = 4_000;
export const BAT_R = 0.95;
export const HURT_MS = 1_200;
export const HURT_EMBER_MS = 2_000;
export const FALL_DEPTH = 7;
export const ROOF_THROW_R = 3.6;
/** standing in the dark with the ember out this long sends the hero back to the last lantern (no dead end) */
export const STRAND_MS = 1_500;

// ---------- the run ----------

export interface Hero {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   /** standing on a pad this step (pad id, -1 in the air) */
   standing: number;
   grounded: boolean;
   /** the run ms the hero last stood on something (the coyote jump) */
   lastGroundMs: number;
   airJumped: boolean;
   dashed: boolean;
   facing: number;
}

export interface Flare {
   x: number;
   y: number;
   z: number;
   until: number;
}

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   /** the pad id of the platform landed on, -1 none */
   landed: number;
   /** the lantern bounced on (pad id), -1 none */
   bounced: number;
   /** the lantern lit this step (pad id; a bounce or a throw), -1 none */
   ignited: number;
   threw: boolean;
   flared: boolean;
   powered: boolean;
   emberLow: boolean;
   emberOut: boolean;
   orbCount: number;
   orbList: number[];
   sparkCount: number;
   secretCount: number;
   secretList: number[];
   brazier: number;
   gust: boolean;
   snuffed: number;
   stunned: number;
   hurt: "" | "bat" | "jet" | "dive" | "fall";
   respawned: boolean;
   comboBonus: number;
   comboLinked: boolean;
   crumbled: number;
   plate: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossVulnerable: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   finished: boolean;
   timeup: boolean;
}

function createEvents(): StepEvents {
   return {
      jumped: false, airJumped: false, landed: -1, bounced: -1, ignited: -1, threw: false, flared: false, powered: false, emberLow: false, emberOut: false,
      orbCount: 0, orbList: [], sparkCount: 0, secretCount: 0, secretList: [], brazier: -1, gust: false, snuffed: 0, stunned: -1, hurt: "", respawned: false,
      comboBonus: 0, comboLinked: false, crumbled: -1, plate: false, bossTelegraph: false, bossAttack: false, bossVulnerable: false, bossHit: false,
      bossPhase: false, bossDefeated: false, finished: false, timeup: false,
   };
}

export interface StepInput {
   /** the stick, -1..1 (up = -1) */
   moveX: number;
   moveZ: number;
   /** the camera's view yaw (menu2/camera orbit.viewYaw): the stick is camera-relative */
   yaw: number;
   jumpPressed: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false };
}

export interface TempleRun {
   seed: number;
   level: LevelId;
   heroId: HeroId;
   course: Course;
   /** the run's play time (ms): whole 1000/120 ms steps */
   simMs: number;
   acc: number;
   /** a jump / Action press waiting for the next fixed step */
   pendJump: boolean;
   pendAction: boolean;
   hero: Hero;
   /** ember left (ms) and the least it has been */
   ember: number;
   minEmber: number;
   /** per pad id: lit until (ms), ignited at, solid until, balcony touched at, balcony gone until */
   litUntil: number[];
   litAt: number[];
   solidUntil: number[];
   touched: number[];
   gone: number[];
   /** lanterns lit at least once (counts: the Nine Lights) */
   visited: boolean[];
   lanternsLit: number;
   flares: Flare[];
   floodUntil: number;
   brazierLit: boolean[];
   orbTaken: boolean[];
   sparkTaken: boolean[];
   orbs: number;
   combo: ComboState;
   secrets: SecretTracker;
   /** the last deck or lantern: the respawn */
   checkpoint: number;
   hits: number;
   hurtUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   powerReadyAt: number;
   batStun: number[];
   gustDone: number;
   /** other heroes' embers (multiplayer): light for this one too */
   allies: { x: number; y: number; z: number; radius: number }[];
   boss: BossState | null;
   bossEvents: BossEvents;
   bossActive: boolean;
   relights: number;
   /** the lantern the Queen hangs over in her dive (an arena index) */
   diveTarget: number;
   /** ms the hero has stood in the dark with no ember */
   dark: number;
   ended: "win" | "timeup" | null;
   finishMs: number;
   ev: StepEvents;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): TempleRun {
   const course = courseFor(level);
   const cfg = LEVELS[level];
   const n = course.pads.length;
   const start = course.pads[course.chain[0]];
   const run: TempleRun = {
      seed, level, heroId, course, simMs: 0, acc: 0, pendJump: false, pendAction: false,
      hero: { x: start.x, y: start.y, z: start.z, vx: 0, vy: 0, vz: 0, standing: start.id, grounded: true, lastGroundMs: 0, airJumped: false, dashed: false, facing: 0 },
      ember: cfg.emberMs, minEmber: cfg.emberMs,
      litUntil: new Array<number>(n).fill(0), litAt: new Array<number>(n).fill(0), solidUntil: new Array<number>(n).fill(0),
      touched: new Array<number>(n).fill(0), gone: new Array<number>(n).fill(0),
      visited: new Array<boolean>(n).fill(false), lanternsLit: 0, flares: [], floodUntil: 0,
      brazierLit: course.braziers.map(() => false), orbTaken: course.orbs.map(() => false), sparkTaken: course.sparks.map(() => false), orbs: 0,
      combo: createCombo(), secrets: createSecretTracker(SECRETS[level]), checkpoint: start.id,
      hits: 0, hurtUntil: 0, shieldUntil: -1, magnetUntil: -1, phaseUntil: -1, dashUntil: -1, dashX: 0, dashZ: 0, powerReadyAt: 0,
      batStun: course.bats.map(() => 0), gustDone: -1, allies: [],
      boss: cfg.boss ? createBoss(QUEEN) : null, bossEvents: createBossEvents(), bossActive: false, relights: 0, diveTarget: 0,
      dark: 0, ended: null, finishMs: 0, ev: createEvents(),
   };
   // the first lantern burns from the start (the card: one lit lantern)
   const first = course.lanterns[0];
   run.litUntil[first] = LANTERN_LIT_MS;
   run.litAt[first] = 0;
   return run;
}

// ---------- light ----------

/** The ember's light radius (m): 6 m full, 1.5 m nearly out, nothing once it is out. */
export function emberRadius(run: TempleRun): number {
   if (run.ember <= 0) return 0;
   return EMBER_MIN_R + (EMBER_MAX_R - EMBER_MIN_R) * (run.ember / LEVELS[run.level].emberMs);
}

const dist3 = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => Math.hypot(ax - bx, ay - by, az - bz);

/** Is the point (x, y, z), with `margin` m of reach (a pad's radius), inside any light? */
export function lightReaches(run: TempleRun, x: number, y: number, z: number, margin: number): boolean {
   const ms = run.simMs;
   if (run.floodUntil > ms) return true;
   const h = run.hero;
   const er = emberRadius(run);
   if (er > 0 && dist3(h.x, h.y + 0.6, h.z, x, y, z) <= er + margin) return true;
   for (const a of run.allies) if (a.radius > 0 && dist3(a.x, a.y + 0.6, a.z, x, y, z) <= a.radius + margin) return true;
   const course = run.course;
   for (const id of course.lanterns) {
      if (run.litUntil[id] <= ms) continue;
      const p = course.pads[id];
      if (dist3(padX(p, ms), p.y + 0.5, padZ(p, ms), x, y, z) <= LANTERN_LIGHT_R + margin) return true;
   }
   if (run.litUntil[course.room] > ms) {
      const p = course.pads[course.room];
      if (dist3(p.x, p.y + 0.5, p.z, x, y, z) <= LANTERN_LIGHT_R + margin) return true;
   }
   for (const id of course.decks) {
      const p = course.pads[id];
      if (dist3(p.x, p.y + 0.5, p.z, x, y, z) <= DECK_LIGHT_R + margin) return true;
   }
   for (const f of run.flares) if (f.until > ms && dist3(f.x, f.y, f.z, x, y, z) <= FLARE_R + margin) return true;
   return false;
}

/** Is this pad solid right now? (A lantern is a bounce pad: solid too.) */
export function padSolid(run: TempleRun, pad: Pad): boolean {
   switch (pad.kind) {
      case "glyph":
      case "gallery":
      case "express":
         return run.solidUntil[pad.id] > run.simMs;
      case "balcony":
         return run.gone[pad.id] <= run.simMs;
      default:
         return true;
   }
}

/** 0..1: how solid a glyph ledge looks (1 in light, fading to 0 over FADE_MS), for the visuals. */
export function padGlow(run: TempleRun, pad: Pad): number {
   if (pad.kind !== "glyph" && pad.kind !== "gallery" && pad.kind !== "express") return 1;
   const left = run.solidUntil[pad.id] - run.simMs;
   return left <= 0 ? 0 : Math.min(1, left / FADE_MS);
}

export const lanternLit = (run: TempleRun, id: number): boolean => run.litUntil[id] > run.simMs;

/** Is the hero's ember out of the light of any lantern (the dark the card warns about)? */
export function heroPhasing(run: TempleRun): boolean {
   return run.simMs < run.phaseUntil;
}

// ---------- the step ----------

function ignite(run: TempleRun, id: number, bounced: boolean): void {
   const ev = run.ev;
   const ms = run.simMs;
   const wasLit = run.litUntil[id] > ms;
   const gusting = run.course.cfg.gusts && inGust(ms);
   run.litUntil[id] = ms + (gusting ? GUST_LIT_MS : LANTERN_LIT_MS);
   run.litAt[id] = ms;
   ev.ignited = id;
   if (bounced) run.ember = LEVELS[run.level].emberMs;
   const pad = run.course.pads[id];
   if (pad.lantern >= 0 && !run.visited[id]) {
      run.visited[id] = true;
      run.lanternsLit += 1;
      const bonus = comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.lantern);
      ev.comboLinked = run.combo.chain > 1;
      ev.comboBonus += bonus;
      if (run.level === 1 && run.lanternsLit >= LEVELS[1].lanterns) {
         if (collectSecret(run.secrets, 2)) pushSecret(run, 2);
      }
   }
   // a lantern or a deck we light is where we come back to
   if (pad.y >= run.course.pads[run.checkpoint].y && pad.lantern >= 0) run.checkpoint = id;
   // the Queen's first phase: relight three in her window
   const b = run.boss;
   if (run.bossActive && b && b.phase === 0 && b.step === "vulnerable" && !wasLit) {
      run.relights += 1;
      if (run.relights >= 3) bossHit(run);
   }
}

function pushSecret(run: TempleRun, index: number): void {
   const ev = run.ev;
   if (ev.secretCount < 4) ev.secretList[ev.secretCount++] = index;
}

function inGust(ms: number): boolean {
   if (ms < GUST.first) return false;
   const k = Math.floor((ms - GUST.first) / GUST.every);
   const s = gustStart(k);
   return ms >= s && ms < s + GUST.lastsMs;
}

function bossHit(run: TempleRun): void {
   const b = run.boss;
   if (!b) return;
   const before = b.phase;
   const result = hitBoss(b, QUEEN, 1, run.bossEvents);
   if (result === "ignored") return;
   const ev = run.ev;
   ev.bossHit = true;
   if (result === "phase" || b.phase !== before) ev.bossPhase = true;
   if (result === "defeated") ev.bossDefeated = true;
   run.relights = 0;
   const bonus = comboHit(run.combo, COMBO, run.simMs, COMBO_BASE_MS.boss);
   ev.comboBonus += bonus;
}

function respawn(run: TempleRun, why: StepEvents["hurt"]): void {
   const ev = run.ev;
   const cp = run.course.pads[run.checkpoint];
   const h = run.hero;
   const ms = run.simMs;
   h.x = padX(cp, ms);
   h.z = padZ(cp, ms);
   h.y = cp.y + (cp.kind === "lantern" ? 0.5 : 0.02);
   h.vx = h.vy = h.vz = 0;
   h.standing = -1;
   h.grounded = false;
   h.lastGroundMs = -1e9;
   run.ember = LEVELS[run.level].emberMs;
   run.hits += 1;
   run.hurtUntil = ms + HURT_MS;
   comboBreak(run.combo);
   ev.respawned = true;
   if (ev.hurt === "") ev.hurt = why;
   // the lantern we return to burns a while, so the ledges around it are there
   if (cp.kind === "lantern") run.litUntil[cp.id] = Math.max(run.litUntil[cp.id], ms + GUST_LIT_MS);
}

/** Sends a hero back to the last lantern (multiplayer: more than 8 m under the highest hero). */
export function sendBack(run: TempleRun): void {
   respawn(run, "fall");
}

function hurtEmber(run: TempleRun, why: StepEvents["hurt"]): void {
   run.ember = Math.max(0, run.ember - HURT_EMBER_MS);
   run.hits += 1;
   run.hurtUntil = run.simMs + HURT_MS;
   comboBreak(run.combo);
   run.ev.hurt = why;
}

/** The lantern a thrown ember would land on: the nearest unlit one below within reach, or -1. */
export function throwTarget(run: TempleRun): number {
   const h = run.hero;
   const ms = run.simMs;
   let best = -1;
   let bestD = THROW_REACH;
   for (const id of run.course.lanterns) {
      if (run.litUntil[id] > ms) continue;
      const p = run.course.pads[id];
      const drop = h.y - p.y;
      if (drop < 0.4 || drop > THROW_DROP) continue;
      const d = Math.hypot(padX(p, ms) - h.x, padZ(p, ms) - h.z);
      if (d < bestD) {
         bestD = d;
         best = id;
      }
   }
   return best;
}

/** Is the hero over the roof brazier, high enough to drop an ember into it? (the boss's third phase) */
export function overRoofBrazier(run: TempleRun): boolean {
   const rb = run.course.roofBrazier;
   if (!rb) return false;
   const h = run.hero;
   return Math.hypot(h.x - rb.x, h.z - rb.z) <= ROOF_THROW_R && h.y >= rb.y - 1.2;
}

function useAction(run: TempleRun): void {
   const ev = run.ev;
   const h = run.hero;
   const ms = run.simMs;
   const air = !h.grounded;
   if (air && run.ember >= THROW_COST_MS) {
      const roof = run.bossActive && run.boss !== null && run.boss.phase === 2 && overRoofBrazier(run);
      const target = throwTarget(run);
      if (roof || target >= 0) {
         run.ember -= THROW_COST_MS;
         ev.threw = true;
         if (roof) bossHit(run);
         if (target >= 0 && !roof) ignite(run, target, false);
         return;
      }
   }
   const def = heroById(run.heroId);
   if (def.power !== "doubleJump" && ms >= run.powerReadyAt) {
      run.powerReadyAt = ms + def.cooldownMs;
      ev.powered = true;
      if (def.power === "dash") {
         run.dashUntil = ms + POWER_MS.dash;
         h.dashed = true;
      } else if (def.power === "shield") run.shieldUntil = ms + POWER_MS.shield;
      else if (def.power === "magnet") run.magnetUntil = ms + POWER_MS.magnet;
      else if (def.power === "phase") run.phaseUntil = ms + POWER_MS.phase;
      return;
   }
   if (air && run.ember >= THROW_COST_MS) {
      run.ember -= THROW_COST_MS;
      ev.threw = true;
      ev.flared = true;
      run.flares.push({ x: h.x, y: Math.max(0, h.y - 2.5), z: h.z, until: ms + FLARE_MS });
      if (run.flares.length > 4) run.flares.shift();
   }
}

/** One frame: cut into fixed steps, so a run is the same at any frame rate. Returns the (reused) events. */
export function step(run: TempleRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.ev;
   ev.jumped = ev.airJumped = ev.threw = ev.flared = ev.powered = ev.emberLow = ev.emberOut = ev.gust = ev.respawned = ev.plate = false;
   ev.bossTelegraph = ev.bossAttack = ev.bossVulnerable = ev.bossHit = ev.bossPhase = ev.bossDefeated = ev.finished = ev.timeup = false;
   ev.landed = ev.bounced = ev.ignited = ev.stunned = ev.crumbled = ev.brazier = -1;
   ev.orbCount = ev.sparkCount = ev.secretCount = ev.snuffed = 0;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.hurt = "";
   if (run.ended !== null || !(dtMs > 0)) return ev;
   run.acc += Math.min(MAX_FRAME_MS, dtMs);
   // a press is never lost: a frame shorter than a step (144 Hz) hands it to the next step that runs
   if (input.jumpPressed) run.pendJump = true;
   if (input.actionPressed) run.pendAction = true;
   while (run.acc >= STEP_MS - 1e-9 && run.ended === null) {
      run.acc -= STEP_MS;
      sub(run, input, run.pendJump, run.pendAction);
      run.pendJump = false;
      run.pendAction = false;
   }
   return ev;
}

const PAD_SCRATCH = { x: 0, y: 0, z: 0 };

function sub(run: TempleRun, input: StepInput, jumpEdge: boolean, actionEdge: boolean): void {
   const ev = run.ev;
   const course = run.course;
   const cfg = course.cfg;
   const h = run.hero;
   const dt = STEP_MS / 1000;
   const ms = (run.simMs += STEP_MS);

   // the ember burns
   if (run.ember > 0) {
      const before = run.ember;
      run.ember = Math.max(0, run.ember - STEP_MS);
      if (before > EMBER_LOW_MS && run.ember <= EMBER_LOW_MS) ev.emberLow = true;
      if (run.ember <= 0) ev.emberOut = true;
   }
   if (run.ember < run.minEmber) run.minEmber = run.ember;
   comboTick(run.combo, COMBO, ms);

   // gusts (level 3): every lit lantern is cut to 6 s of its own light
   if (cfg.gusts) {
      const k = ms < GUST.first ? -1 : Math.floor((ms - GUST.first) / GUST.every);
      if (k > run.gustDone && ms >= gustStart(k)) {
         run.gustDone = k;
         ev.gust = true;
         for (const id of course.lanterns) {
            if (run.litUntil[id] > ms) run.litUntil[id] = Math.min(run.litUntil[id], Math.max(ms, run.litAt[id] + GUST_LIT_MS));
         }
      }
   }
   // the boss's clock
   if (run.bossActive && run.boss) {
      const be = stepBoss(run.boss, QUEEN, STEP_MS, run.bossEvents);
      if (be.telegraph) ev.bossTelegraph = true;
      if (be.attack) {
         ev.bossAttack = true;
         if (run.boss.phase === 0) {
            for (const id of course.lanterns) if (run.litUntil[id] > ms) { run.litUntil[id] = ms; ev.snuffed += 1; }
            run.relights = 0;
         }
      }
      if (be.vulnerable) {
         ev.bossVulnerable = true;
         run.relights = 0;
         if (run.boss.phase === 1) run.diveTarget = run.boss.hits % Math.max(1, course.arena.length);
      }
   }

   // the stick, camera-relative, and the powers
   const cos = Math.cos(input.yaw);
   const sin = Math.sin(input.yaw);
   let mx = input.moveX * cos + input.moveZ * sin;
   let mz = input.moveZ * cos - input.moveX * sin;
   const len = Math.hypot(mx, mz);
   if (len > 1) {
      mx /= len;
      mz /= len;
   }
   if (len > 0.05) h.facing = Math.atan2(mx, mz);
   if (actionEdge) {
      const was = run.dashUntil;
      useAction(run);
      if (run.dashUntil !== was) {
         const n = Math.hypot(mx, mz);
         run.dashX = n > 0.05 ? mx / n : Math.sin(h.facing);
         run.dashZ = n > 0.05 ? mz / n : Math.cos(h.facing);
      }
   }
   let vx = mx * V_WALK;
   let vz = mz * V_WALK;
   if (ms <= run.dashUntil) {
      vx += run.dashX * V_DASH;
      vz += run.dashZ * V_DASH;
   }
   h.vx = vx;
   h.vz = vz;

   // jump: on a ledge or a hair after it; Nami once more in the air
   const grounded = h.grounded || ms - h.lastGroundMs <= COYOTE_MS;
   if (jumpEdge) {
      if (grounded && h.vy <= 0.01) {
         h.vy = V_JUMP;
         h.grounded = false;
         h.lastGroundMs = -1e9;
         ev.jumped = true;
      } else if (run.heroId === "nami" && !h.airJumped && !h.grounded) {
         h.vy = V_JUMP;
         h.airJumped = true;
         ev.airJumped = true;
      }
   }

   // move: x / z with the shaft's rim and the ghost wall, then y under gravity
   const prevY = h.y;
   const r0 = Math.hypot(h.x, h.z);
   let nx = h.x + h.vx * dt;
   let nz = h.z + h.vz * dt;
   const r1 = Math.hypot(nx, nz);
   if (r1 > RIM) {
      nx *= RIM / r1;
      nz *= RIM / r1;
   } else if (r1 > WALL_RING && r1 > r0 && !heroPhasing(run)) {
      if (r0 <= WALL_RING) {
         nx *= WALL_RING / r1;
         nz *= WALL_RING / r1;
      } else {
         nx = h.x;
         nz = h.z;
      }
   }
   h.x = nx;
   h.z = nz;
   h.vy -= GRAV * dt;
   h.y += h.vy * dt;

   // light: refresh how long each glyph ledge stays solid, fade the rest
   for (const pad of course.pads) {
      if (pad.kind !== "glyph" && pad.kind !== "gallery" && pad.kind !== "express") continue;
      if (lightReaches(run, pad.x, pad.y, pad.z, pad.r)) run.solidUntil[pad.id] = ms + FADE_MS;
   }
   // balconies crumble
   for (const pad of course.pads) {
      if (pad.kind !== "balcony") continue;
      if (run.touched[pad.id] > 0 && ms - run.touched[pad.id] >= CRUMBLE_MS) {
         run.touched[pad.id] = 0;
         run.gone[pad.id] = ms + CRUMBLE_BACK_MS;
         ev.crumbled = pad.id;
      }
   }

   // landing: the highest solid pad the feet crossed this step
   let landed = -1;
   let landedTop = -Infinity;
   if (h.vy <= 0) {
      for (const pad of course.pads) {
         if (!padSolid(run, pad)) continue;
         const top = pad.y;
         if (prevY < top - 0.03 || h.y > top || top <= landedTop) continue;
         if (Math.hypot(h.x - padX(pad, ms), h.z - padZ(pad, ms)) > pad.r + LAND_SLACK) continue;
         landed = pad.id;
         landedTop = top;
      }
   }
   const wasAir = !h.grounded;
   if (landed >= 0) {
      const pad = course.pads[landed];
      h.y = pad.y;
      h.standing = landed;
      h.airJumped = false;
      h.dashed = false;
      if (pad.kind === "lantern") {
         h.vy = V_BOUNCE;
         h.grounded = false;
         h.lastGroundMs = -1e9;
         ev.bounced = landed;
         ev.landed = landed;
         ignite(run, landed, true);
      } else {
         h.vy = 0;
         h.grounded = true;
         h.lastGroundMs = ms;
         if (wasAir) ev.landed = landed;
         if (pad.kind === "balcony" && run.touched[landed] === 0 && wasAir) run.touched[landed] = ms;
         if (pad.kind === "deck" && pad.y >= course.pads[run.checkpoint].y) run.checkpoint = landed;
         if (pad.kind === "goal" && !cfg.boss) {
            run.ended = "win";
            run.finishMs = ms;
            ev.finished = true;
         }
      }
   } else {
      h.grounded = false;
      h.standing = -1;
   }

   // the Queen wakes when the hero lands in her arena (the last lanterns under the roof)
   if (cfg.boss && run.boss && !run.bossActive && landed >= 0 && course.pads[landed].y >= course.pads[course.arena[0]].y - 1.2) run.bossActive = true;

   // soot bats (level 4): snuff lit lanterns, stun on a stomp, drain the ember on a side touch
   for (let b = 0; b < course.bats.length; b++) {
      const bat = batAt(course.bats[b], ms, PAD_SCRATCH);
      const stunned = run.batStun[b] > ms;
      if (!stunned) {
         for (const id of course.lanterns) {
            if (run.litUntil[id] <= ms) continue;
            const p = course.pads[id];
            if (dist3(bat.x, bat.y, bat.z, padX(p, ms), p.y + 0.5, padZ(p, ms)) < 1.4) {
               run.litUntil[id] = ms;
               ev.snuffed += 1;
            }
         }
      }
      const dxz = Math.hypot(bat.x - h.x, bat.z - h.z);
      if (dxz <= BAT_R) {
         if (h.vy < 0 && h.y >= bat.y + 0.1 && h.y <= bat.y + 1.5) {
            run.batStun[b] = ms + BAT_STUN_MS;
            h.vy = V_JUMP * 0.95;
            h.airJumped = false;
            ev.stunned = b;
         } else if (!stunned && ms >= run.hurtUntil && Math.abs(h.y + 0.6 - bat.y) < 0.9 && ms >= run.shieldUntil) {
            hurtEmber(run, "bat");
         }
      }
   }

   // the Queen's dive (phase 2): the lantern she hangs over, her swoop, her hit window
   if (run.bossActive && run.boss) {
      const b = run.boss;
      if (b.phase === 1 && course.arena.length > 0) {
         const p = course.pads[course.arena[run.diveTarget % course.arena.length]];
         const qx = padX(p, ms);
         const qz = padZ(p, ms);
         if (b.step === "attack" && ms >= run.hurtUntil && ms >= run.shieldUntil && Math.hypot(h.x - qx, h.z - qz) < 1.6 && h.y < p.y + 3.6 && h.y > p.y - 1) hurtEmber(run, "dive");
         if (b.step === "vulnerable" && h.vy > 0.3 && run.ember > 0 && dist3(h.x, h.y + 0.8, h.z, qx, p.y + 2.4, qz) <= 1.9) bossHit(run);
      }
   }

   // the fire jets of the express column (the Queen's second phase pulses them faster)
   if (course.jet) {
      const j = course.jet;
      const fast = run.bossActive && run.boss !== null && run.boss.phase >= 1;
      if (jetPhase(ms, fast) === "on" && Math.hypot(h.x, h.z) <= j.r + 0.3 && h.y >= j.y0 && h.y <= j.y1 + 0.2 && ms >= run.shieldUntil) respawn(run, "jet");
   }

   // pickups: orbs (the magnet pulls from 6 m), sparks (Zuno), braziers, the lantern room, the plates
   const magnet = ms <= run.magnetUntil;
   for (let i = 0; i < course.orbs.length; i++) {
      if (run.orbTaken[i]) continue;
      const o = course.orbs[i];
      if (dist3(h.x, h.y + 0.8, h.z, o.x, o.y, o.z) <= (magnet ? MAGNET_REACH : ORB.pickup)) {
         run.orbTaken[i] = true;
         run.orbs += 1;
         if (ev.orbCount < 8) ev.orbList[ev.orbCount++] = i;
         const bonus = comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.orb);
         ev.comboBonus += bonus;
         ev.comboLinked = run.combo.chain > 1;
      }
   }
   if (magnet) {
      for (let i = 0; i < course.sparks.length; i++) {
         if (run.sparkTaken[i]) continue;
         const s = course.sparks[i];
         if (dist3(h.x, h.y + 0.8, h.z, s.x, s.y, s.z) <= SPARK_REACH) {
            run.sparkTaken[i] = true;
            run.ember = Math.min(LEVELS[run.level].emberMs, run.ember + SPARK_MS);
            ev.sparkCount += 1;
         }
      }
   }
   for (let i = 0; i < course.braziers.length; i++) {
      if (run.brazierLit[i]) continue;
      const b = course.braziers[i];
      if (Math.hypot(h.x - b.x, h.z - b.z) <= BRAZIER_R && Math.abs(h.y - b.y) <= 1.5) {
         run.brazierLit[i] = true;
         run.floodUntil = ms + FLOOD_MS;
         ev.brazier = i;
      }
   }
   const room = course.pads[course.room];
   if (!run.visited[room.id] && Math.hypot(h.x, h.z) >= WALL_RING + 0.3 && Math.hypot(h.x - room.x, h.z - room.z) <= room.r + 0.4 && Math.abs(h.y - room.y) <= 1.6) {
      run.visited[room.id] = true;
      run.litUntil[room.id] = ms + LANTERN_LIT_MS;
      if (collectSecret(run.secrets, 1)) pushSecret(run, 1);
   }

   // standing in the dark with the ember out: no dead end, back to the last lantern
   if (run.ember <= 0 && h.grounded && !lightReaches(run, h.x, h.y + 0.6, h.z, 0)) {
      run.dark += STEP_MS;
      if (run.dark >= STRAND_MS) {
         run.dark = 0;
         respawn(run, "fall");
      }
   } else run.dark = 0;
   // a fall: far under the last lantern or deck
   const cp = course.pads[run.checkpoint];
   if (h.y < cp.y - FALL_DEPTH || h.y < -6) respawn(run, "fall");

   // the end
   if (run.boss && run.boss.step === "done" && run.ended === null) {
      run.ended = "win";
      run.finishMs = ms;
      ev.finished = true;
   }
   if (run.ended === null && ms >= cfg.durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
   if (run.ended === "win" && run.minEmber >= EMBER_LOW_MS) {
      if (collectSecret(run.secrets, 0)) pushSecret(run, 0);
   }
}

/** True once the lantern pad `id` is the Queen's current dive target (the scene draws her over it). */
export function queenPos(run: TempleRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const c = run.course;
   const b = run.boss;
   out.x = c.perch.x;
   out.y = c.perch.y;
   out.z = c.perch.z;
   if (!b || !run.bossActive) return out;
   if (b.phase === 1 && c.arena.length > 0) {
      const p = c.pads[c.arena[run.diveTarget % c.arena.length]];
      const hang = b.step === "vulnerable" || b.step === "attack";
      out.x = padX(p, run.simMs);
      out.z = padZ(p, run.simMs);
      out.y = hang ? p.y + 2.4 : c.perch.y - 1;
      if (b.step === "telegraph") out.y = c.perch.y - 3;
   } else if (b.phase === 2 && c.roofBrazier) {
      const over = b.step === "vulnerable";
      out.x = 0;
      out.z = 0;
      out.y = over ? c.top + 3.2 : c.perch.y;
   }
   return out;
}

export function bossVulnerable(run: TempleRun): boolean {
   return run.bossActive && run.boss !== null && run.boss.step === "vulnerable";
}

// ---------- the score ----------

/** The submitted time: the finish less 0.1 s an orb and the flow bonus (README "Scoring"). */
export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs - comboMs);
}

export const submittedMs = (run: TempleRun): number => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

/** The run's stars (clear, all five orbs, the target time) and the no-hit badge (no fall, no bat, no jet). */
export function runStars(run: TempleRun): StarResult {
   const cleared = run.ended === "win";
   return evaluateStars(starSpecFor(run.level, run.course.orbs.length), { cleared, orbs: run.orbs, goalValue: cleared ? submittedMs(run) : Number.NaN, hits: run.hits });
}

/** The flow meter's fill 0..1 (the HUD). */
export function flowOf(run: TempleRun): number {
   return comboFlow(run.combo, COMBO, run.simMs);
}

// ---------- the limits (README "Server limits and why they hold") ----------

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/**
 * The least play time (ms) any route can take to win a level: the climb's height at the fastest
 * average a hero can rise (bounces landing on their apex, V_CLIMB_MAX), and on level 5 the Queen's
 * least defeat time after the arena is reached (bound.ts bossMinMs adds the real boss machine).
 */
export function climbFloorMs(level: LevelId): number {
   return (LEVELS[level].height / V_CLIMB_MAX) * 1000;
}

/** The most the submitted time can be cut by orbs and the flow meter (ms). */
export function maxBonusMs(level: LevelId): number {
   const c = courseFor(level);
   const bases = c.lanterns.length * COMBO_BASE_MS.lantern + c.orbs.length * COMBO_BASE_MS.orb + (c.cfg.boss ? QUEEN.maxHp * COMBO_BASE_MS.boss : 0);
   return c.orbs.length * ORB.bonusMs + bases * (COMBO.cap - 1);
}

export { SECRETS, QUEEN };
export type { HeroId };

/** The shell's score for a win: the time game submits its submitted time (README "Scoring"). */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

export const STAT = {
   orbs: "orbs",
   ember: "ember",
   emberMax: "emberMax",
   lanterns: "lanterns",
   hero: "hero",
   power: "power",
   finishMs: "finishMs",
   hits: "hits",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   relights: "relights",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

/** The level limits proven in proof.test.ts (README table): bound.ts proposeLimits, pinned. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: { kind: "time", maxScore: 17_870, minDurationMs: 1_300, maxDurationMs: 180_000, timeBaseMs: 180_000 },
   2: { kind: "time", maxScore: 20_740, minDurationMs: 2_600, maxDurationMs: 210_000, timeBaseMs: 210_000 },
   3: { kind: "time", maxScore: 23_610, minDurationMs: 3_900, maxDurationMs: 240_000, timeBaseMs: 240_000 },
   4: { kind: "time", maxScore: 26_480, minDurationMs: 5_200, maxDurationMs: 270_000, timeBaseMs: 270_000 },
   5: { kind: "time", maxScore: 33_570, minDurationMs: 24_300, maxDurationMs: 360_000, timeBaseMs: 360_000 },
};

export const LEVEL1_LIMITS: LevelLimits = PROPOSED_LEVEL_LIMITS[1];
