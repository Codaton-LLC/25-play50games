// Temple Gong Timing's rules: pure and deterministic (no three.js, React, DOM, Math.random or Date).
// Scene.tsx calls step() from one useRunFrame; the run's play time IS the song's clock (the beat grid, the
// rings and every judgement read it), so a run is the same at any frame rate (fixed 1000/120 ms steps)
// and on any device: the judgement never reads the audio or the frame time.
//
// The signature mechanic (card "Strike on the beat"): a ring shrinks onto a gong one to four beats ahead
// of its note. Be at that gong's strike point and press Action (Strike) on the beat: within 45 ms a
// Perfect, within 90 ms a Good, the same windows on touch and keyboard. With the stick at rest the hero
// rolls to the next note's gong by himself (the card's touch fix: the timing press is the only skill);
// the stick takes over to go after bonus notes, echo orbs and secrets. Ceremony drums are holds,
// off-beat shockwaves are jumped, level 2's lanterns call a pattern you answer with no rings, level 3's
// gongs ride round the stage, and level 5 is Coilstone, fought on the chart.
import type { LevelId } from "../../types";
import { inputToWorld } from "@/arcade3d/core/math";
import { comboBreak, comboFlow, comboHit, createCombo, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import {
   DRUM_R, GREAT_STRIKE, PILLAR_AIR, REACH, SHOCK_SPEED, STRIKE_R, WALK_R, chartFor, stageFor, targetPoint, writeUnit,
   type Chart, type Note, type Stage, type UnitKind,
} from "./chart";
import { DEFAULT_HERO, MAGNET_REACH, SHIELD_MS, heroById, speedOf, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { COILSTONE, COMBO, DUEL_ACCURACY, POINTS, SECRETS, secretIndex, starSpecFor } from "./progression";

// ---------- tuning ----------

export const STEP_MS = 1000 / 120;
export const MAX_FRAME_MS = 50;
/** the judgement windows (ms either side of the beat): the same on every device */
export const PERFECT_MS = 45;
export const GOOD_MS = 90;
/** a press this early before a note at your gong spends it as a miss (no spamming through the window) */
export const EARLY_MS = 180;
/** a held drum may let go this early */
export const HOLD_SLACK_MS = 120;
export const V_JUMP = 7.2;
export const V_JUMP2 = 7;
export const GRAV = 20;
/** an echo orb lives this long; the hero picks it up this close */
export const ECHO_MS = 1_600;
export const ECHO_REACH = 1.3;
/** an echo orb floats out from the gong towards the middle at this speed (m/s) */
export const ECHO_DRIFT = 1.2;
/** a shockwave hits a grounded hero whose radius it crosses within this (m) */
export const SHOCK_BAND = 0.4;
/** the hidden ninth gong's strike point (front left, among the ruins) and how many downbeats it needs */
export const NINTH = { x: -5.4, z: 3.8, strikes: 3 } as const;
/** Level 5: how many units of each kind pay points (the rest are encores: no points, so farming never pays). */
export const PAID_UNITS: Record<UnitKind, number> = { call: 2, duel: 4, great: 2 };
/** level 5's Great Gong and the drums are solid (radius, m) */
export const GREAT_SOLID = 1.3;
export const DRUM_SOLID = 0.85;

// ---------- the run ----------

export interface Hero {
   x: number;
   z: number;
   vx: number;
   vz: number;
   air: number;
   vAir: number;
   grounded: boolean;
   airJumped: boolean;
   /** the strike's roll into the gong (rules ms until it ends) */
   strikeUntil: number;
   strikeX: number;
   strikeZ: number;
   facing: number;
}

export interface Echo {
   x: number;
   z: number;
   born: number;
   alive: boolean;
}

export type Grade = 0 | 1 | 2 | 3;
export const PENDING: Grade = 0;
export const PERFECT: Grade = 1;
export const GOOD: Grade = 2;
export const MISS: Grade = 3;

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   strike: Grade;
   /** the note struck (or missed by an early press), -1 none */
   note: number;
   missCount: number;
   missList: number[];
   whiff: boolean;
   holdDone: boolean;
   holdBroken: boolean;
   echo: number;
   echoCaught: number;
   shockHit: boolean;
   shielded: boolean;
   ninth: boolean;
   beat: boolean;
   downbeat: boolean;
   comboBonus: number;
   points: number;
   secretCount: number;
   secretList: number[];
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   finished: boolean;
}

function createEvents(): StepEvents {
   return {
      jumped: false, airJumped: false, landed: false, strike: PENDING, note: -1, missCount: 0, missList: [], whiff: false, holdDone: false, holdBroken: false,
      echo: -1, echoCaught: 0, shockHit: false, shielded: false, ninth: false, beat: false, downbeat: false, comboBonus: 0, points: 0, secretCount: 0, secretList: [],
      bossHit: false, bossPhase: false, bossDefeated: false, finished: false,
   };
}

export interface StepInput {
   moveX: number;
   moveZ: number;
   /** the camera's view yaw (menu2/camera): the stick is camera-relative */
   yaw: number;
   jumpPressed: boolean;
   /** Strike: the press, and whether it is held (drum holds) */
   actionPressed: boolean;
   action: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false, action: false };
}

export interface GongRun {
   seed: number;
   level: LevelId;
   heroId: HeroId;
   stage: Stage;
   /** levels 1-4 share the level's chart; level 5 writes its own as the fight goes */
   chart: Chart;
   simMs: number;
   acc: number;
   pendJump: boolean;
   pendAction: boolean;
   hero: Hero;
   grade: Grade[];
   /** does note i pay points? (level 5: an encore of a unit past its PAID_UNITS count pays none) */
   paid: boolean[];
   /** the unit being written is an encore */
   encore: boolean;
   /** the first pending note (everything before it is judged) */
   cursor: number;
   holding: number;
   holdBroken: boolean;
   shocksHit: boolean[];
   echoes: Echo[];
   echoCount: number;
   score: number;
   perfects: number;
   goods: number;
   misses: number;
   /** Perfects and Goods on main notes only (the accuracy) */
   perfectsMain: number;
   goodsMain: number;
   /** main notes judged / in the chart (levels 1-4: the chart's total) */
   mainJudged: number;
   mainTotal: number;
   combo: ComboState;
   secrets: SecretTracker;
   hits: number;
   shieldReadyAt: number;
   ghostStruck: number;
   ghostTotal: number;
   silentPerfect: boolean;
   silentSeen: number;
   ninthStrikes: number;
   lastBeat: number;
   boss: BossState | null;
   bossEvents: BossEvents;
   unitKind: UnitKind;
   unitN: number;
   unitStart: number;
   unitEnd: number;
   unitFirstNote: number;
   greatTries: number;
   ended: "win" | "lose" | null;
   finishMs: number;
   ev: StepEvents;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): GongRun {
   const stage = stageFor(level);
   const cfg = LEVELS[level];
   const chart: Chart = cfg.boss ? { notes: [], calls: [], shocks: [], endMs: 0 } : chartFor(level);
   const first = { x: 0, z: 0, air: 0 };
   if (chart.notes.length > 0) targetPoint(stage, chart.notes[0].target, 0, first);
   else targetPoint(stage, { kind: "gong", i: 1 }, 0, first);
   const run: GongRun = {
      seed, level, heroId, stage, chart, simMs: 0, acc: 0, pendJump: false, pendAction: false,
      hero: { x: first.x * 0.7, z: first.z * 0.7 + 1.5, vx: 0, vz: 0, air: 0, vAir: 0, grounded: true, airJumped: false, strikeUntil: -1, strikeX: 0, strikeZ: 0, facing: Math.PI },
      grade: [], paid: [], encore: false, cursor: 0, holding: -1, holdBroken: false, shocksHit: [], echoes: [], echoCount: 0,
      score: 0, perfects: 0, goods: 0, misses: 0, perfectsMain: 0, goodsMain: 0, mainJudged: 0, mainTotal: 0, combo: createCombo(), secrets: createSecretTracker(SECRETS[level]),
      hits: 0, shieldReadyAt: 0, ghostStruck: 0, ghostTotal: 0, silentPerfect: true, silentSeen: 0, ninthStrikes: 0, lastBeat: -1,
      boss: cfg.boss ? createBoss(COILSTONE) : null, bossEvents: createBossEvents(),
      unitKind: "call", unitN: 0, unitStart: 0, unitEnd: 0, unitFirstNote: 0, greatTries: 0,
      ended: null, finishMs: 0, ev: createEvents(),
   };
   if (cfg.boss) {
      run.unitEnd = writeUnit(stage, "call", 0, 0, chart);
      run.unitN = 1;
   }
   syncChart(run);
   return run;
}

/** Grow the per-note arrays to the chart (level 5 appends units) and recount its totals. */
function syncChart(run: GongRun): void {
   const c = run.chart;
   while (run.grade.length < c.notes.length) {
      const n = c.notes[run.grade.length];
      run.grade.push(PENDING);
      run.paid.push(!run.encore);
      if (n.bonus === "") run.mainTotal += 1;
      if (n.bonus === "ghost") run.ghostTotal += 1;
   }
   while (run.shocksHit.length < c.shocks.length) run.shocksHit.push(false);
}

// ---------- reads ----------

/** Accuracy so far: (Perfects + half the Goods) over the main notes judged (1 before any). */
export function accuracyOf(run: GongRun): number {
   if (run.mainJudged === 0) return 1;
   return (run.perfectsMain + 0.5 * run.goodsMain) / run.mainJudged;
}

/** The final accuracy over every main note of the song. */
export function finalAccuracy(run: GongRun): number {
   if (run.mainTotal === 0) return 0;
   return (run.perfectsMain + 0.5 * run.goodsMain) / run.mainTotal;
}

export const shieldReady = (run: GongRun): boolean => run.heroId === "kiro" && run.simMs >= run.shieldReadyAt;

const P = { x: 0, z: 0, air: 0 };

/** Can the hero strike this note right now (in reach, high enough for a pillar, the right hero for the ghost)? */
export function inReach(run: GongRun, n: Note): boolean {
   const h = run.hero;
   if (n.bonus === "ghost" && run.heroId !== "vexa") return false;
   targetPoint(run.stage, n.target, run.simMs, P);
   if (Math.hypot(h.x - P.x, h.z - P.z) > (n.target.kind === "pillar" ? REACH + 1.2 : REACH)) return false;
   if (n.target.kind === "pillar" && h.air < PILLAR_AIR) return false;
   return true;
}

/** The note the hero rolls to by himself (stick at rest): the next pending main note (Riko: cross notes too). */
export function routeNote(run: GongRun): number {
   const notes = run.chart.notes;
   for (let i = run.cursor; i < notes.length; i++) {
      if (run.grade[i] !== PENDING) continue;
      const n = notes[i];
      if (n.t < run.simMs - GOOD_MS) continue;
      if (n.bonus === "" || (n.bonus === "cross" && run.heroId === "riko")) return i;
   }
   return -1;
}

// ---------- the step ----------

const W = { x: 0, z: 0 };

function pushSecret(run: GongRun, index: number): void {
   if (index < 0) return;
   if (!collectSecret(run.secrets, index)) return;
   run.ev.secretList[run.ev.secretCount++] = index;
}

function award(run: GongRun, base: number, note = -1): void {
   if (note >= 0 && !run.paid[note]) return;
   const bonus = comboHit(run.combo, COMBO, run.simMs, base);
   run.score += base + bonus;
   run.ev.points += base + bonus;
   run.ev.comboBonus += bonus;
}

/** A miss on a main note: the combo breaks (Kiro's shield can save it once). */
function missMain(run: GongRun, i: number): void {
   run.grade[i] = MISS;
   run.misses += 1;
   run.mainJudged += 1;
   run.ev.missList[run.ev.missCount++] = i;
   const n = run.chart.notes[i];
   if (n.silent) run.silentPerfect = false;
   if (shieldReady(run)) {
      run.shieldReadyAt = run.simMs + SHIELD_MS;
      run.ev.shielded = true;
      return;
   }
   run.hits += 1;
   comboBreak(run.combo);
}

function judge(run: GongRun, i: number, grade: Grade): void {
   const n = run.chart.notes[i];
   const ev = run.ev;
   run.grade[i] = grade;
   ev.strike = grade;
   ev.note = i;
   const perfect = grade === PERFECT;
   if (n.bonus === "") {
      run.mainJudged += 1;
      if (perfect) run.perfectsMain += 1;
      else run.goodsMain += 1;
      if (n.silent) {
         run.silentSeen += 1;
         if (!perfect) run.silentPerfect = false;
      }
   }
   if (perfect) run.perfects += 1;
   else run.goods += 1;
   const base =
      n.bonus === "cross" ? (perfect ? POINTS.crossPerfect : POINTS.crossGood) : n.bonus !== "" ? (perfect ? POINTS.bonusPerfect : POINTS.bonusGood) : perfect ? POINTS.perfect : POINTS.good;
   award(run, base, i);
   if (n.bonus === "ghost") {
      run.ghostStruck += 1;
      if (run.ghostStruck >= run.ghostTotal && run.ghostTotal > 0) pushSecret(run, secretIndex(run.level, "ghost-chord"));
   }
   if (n.hold > 0) {
      run.holding = i;
      run.holdBroken = false;
   }
   const h = run.hero;
   targetPoint(run.stage, n.target, run.simMs, P);
   h.strikeUntil = run.simMs + 250;
   h.strikeX = P.x;
   h.strikeZ = P.z;
   // a Perfect throws an echo orb out of the gong, towards the middle of the stage
   if (perfect && run.paid[i]) {
      const r = Math.hypot(P.x, P.z) || 1;
      const k = Math.max(0, (r - 0.8) / r);
      run.echoes.push({ x: P.x * k, z: P.z * k, born: run.simMs, alive: true });
      ev.echo = run.echoes.length - 1;
   }
   const b = run.boss;
   if (b) {
      // P1: a Perfect echo of the call cracks a plate; P3: a Perfect on the Great Gong frees Coilstone
      if (b.phase === 0 && n.silent && perfect) bossStrike(run);
      if (n.target.kind === "great") {
         run.greatTries += 1;
         if (perfect) {
            if (run.greatTries === 1) pushSecret(run, secretIndex(run.level, "first-try"));
            bossStrike(run);
         }
      }
   }
}

function bossStrike(run: GongRun): void {
   const b = run.boss;
   if (!b) return;
   const r = hitBoss(b, COILSTONE, 1, run.bossEvents);
   if (r === "ignored") return;
   run.ev.bossHit = true;
   if (r === "defeated") {
      run.ev.bossDefeated = true;
      if (run.silentPerfect && run.silentSeen > 0) pushSecret(run, secretIndex(run.level, "silent-master"));
      end(run, "win");
   }
}

function end(run: GongRun, why: "win" | "lose"): void {
   if (run.ended !== null) return;
   run.ended = why;
   run.finishMs = run.simMs;
   run.ev.finished = true;
}

function strike(run: GongRun): void {
   const notes = run.chart.notes;
   const now = run.simMs;
   let best = -1;
   let bestDt = Infinity;
   for (let i = run.cursor; i < notes.length; i++) {
      const n = notes[i];
      if (n.t > now + GOOD_MS) break;
      if (run.grade[i] !== PENDING) continue;
      const dt = Math.abs(n.t - now);
      if (dt <= GOOD_MS && dt < bestDt && inReach(run, n)) {
         best = i;
         bestDt = dt;
      }
   }
   if (best >= 0) {
      judge(run, best, bestDt <= PERFECT_MS ? PERFECT : GOOD);
      return;
   }
   // the ninth gong among the ruins: three strikes on a downbeat
   const h = run.hero;
   if (Math.hypot(h.x - NINTH.x, h.z - NINTH.z) <= REACH && secretIndex(run.level, "ninth-gong") >= 0) {
      const bar = 4 * run.stage.beatMs;
      const off = Math.abs(now - Math.round(now / bar) * bar);
      if (off <= GOOD_MS) {
         run.ninthStrikes += 1;
         run.ev.ninth = true;
         if (run.ninthStrikes >= NINTH.strikes) pushSecret(run, secretIndex(run.level, "ninth-gong"));
         return;
      }
   }
   // too early at the next note's gong: that note is spent (spam never pays)
   for (let i = run.cursor; i < notes.length; i++) {
      const n = notes[i];
      if (n.t > now + EARLY_MS) break;
      if (run.grade[i] !== PENDING || n.bonus !== "" || n.t - now <= GOOD_MS) continue;
      if (inReach(run, n)) {
         run.ev.note = i;
         run.ev.strike = MISS;
         missMain(run, i);
         return;
      }
   }
   run.ev.whiff = true;
   h.strikeUntil = now + 200;
   h.strikeX = h.x + Math.sin(h.facing);
   h.strikeZ = h.z + Math.cos(h.facing);
}

/** One frame: cut into fixed steps. Returns the (reused) events. */
export function step(run: GongRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.ev;
   ev.jumped = ev.airJumped = ev.landed = ev.whiff = ev.holdDone = ev.holdBroken = ev.shockHit = ev.shielded = ev.ninth = ev.beat = ev.downbeat = false;
   ev.bossHit = ev.bossPhase = ev.bossDefeated = ev.finished = false;
   ev.strike = PENDING;
   ev.note = ev.echo = -1;
   ev.missCount = ev.echoCaught = ev.secretCount = ev.points = 0;
   ev.comboBonus = 0;
   if (run.ended !== null || !(dtMs > 0)) return ev;
   run.acc += Math.min(MAX_FRAME_MS, dtMs);
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

function sub(run: GongRun, input: StepInput, jumpEdge: boolean, actionEdge: boolean): void {
   const ev = run.ev;
   const h = run.hero;
   const st = run.stage;
   const dt = STEP_MS / 1000;
   const now = run.simMs;
   const cfg = st.cfg;

   // level 5: the next unit of the fight, chosen by Coilstone's phase when the last one ends
   if (run.boss) {
      stepBoss(run.boss, COILSTONE, STEP_MS, run.bossEvents);
      if (run.bossEvents.phaseChanged) ev.bossPhase = true;
      if (now >= run.unitEnd - 1e-6) bossUnitEnd(run);
   }

   // the beat (for the music and the ninth gong)
   const beat = Math.floor(now / st.beatMs);
   if (beat !== run.lastBeat) {
      run.lastBeat = beat;
      ev.beat = true;
      ev.downbeat = beat % 4 === 0;
   }

   // movement: the stick, or (at rest) the roll to the next note's gong
   inputToWorld(input.moveX, input.moveZ, input.yaw, W);
   const push = Math.hypot(W.x, W.z);
   const speed = speedOf(run.heroId);
   let vx = 0;
   let vz = 0;
   if (push > 0.2) {
      const k = Math.min(1, push);
      vx = (W.x / push) * k * speed;
      vz = (W.z / push) * k * speed;
   } else if (run.holding < 0) {
      const i = routeNote(run);
      if (i >= 0) {
         const n = run.chart.notes[i];
         targetPoint(st, n.target, Math.max(now, n.t), P);
         const dx = P.x - h.x;
         const dz = P.z - h.z;
         const d = Math.hypot(dx, dz);
         if (d > 0.12) {
            const v = Math.min(speed, d / dt);
            vx = (dx / d) * v;
            vz = (dz / d) * v;
         }
      }
   }
   h.x += vx * dt;
   h.z += vz * dt;
   h.vx = vx;
   h.vz = vz;
   if (Math.abs(vx) + Math.abs(vz) > 0.3) h.facing = Math.atan2(vx, vz);
   // the stage edge, the drums and the Great Gong
   const r = Math.hypot(h.x, h.z);
   if (r > WALK_R) {
      h.x *= WALK_R / r;
      h.z *= WALK_R / r;
   }
   const solid = (cx: number, cz: number, rad: number) => {
      const dx = h.x - cx;
      const dz = h.z - cz;
      const d = Math.hypot(dx, dz);
      if (d < rad && d > 1e-6) {
         h.x = cx + (dx / d) * rad;
         h.z = cz + (dz / d) * rad;
      }
   };
   for (const a of st.drumAngles) solid(DRUM_R * Math.sin(a), DRUM_R * Math.cos(a), DRUM_SOLID);
   if (st.great) solid(0, 0, GREAT_SOLID);
   void GREAT_STRIKE;

   // jumps
   if (jumpEdge) {
      if (h.grounded) {
         h.grounded = false;
         h.vAir = V_JUMP;
         ev.jumped = true;
      } else if (!h.airJumped && heroById(run.heroId).power === "doubleJump") {
         h.airJumped = true;
         h.vAir = V_JUMP2;
         ev.airJumped = true;
      }
   }
   if (!h.grounded) {
      h.vAir -= GRAV * dt;
      h.air += h.vAir * dt;
      if (h.air <= 0) {
         h.air = 0;
         h.vAir = 0;
         h.grounded = true;
         h.airJumped = false;
         ev.landed = true;
      }
   }

   if (actionEdge) strike(run);

   // a held drum: hold Strike to its end
   if (run.holding >= 0) {
      const n = run.chart.notes[run.holding];
      if (now >= n.t + n.hold - HOLD_SLACK_MS) {
         if (!run.holdBroken) {
            award(run, POINTS.hold, run.holding);
            ev.holdDone = true;
         }
         run.holding = -1;
      } else if (!input.action || !inReach(run, n)) {
         run.holdBroken = true;
         ev.holdBroken = true;
         run.holding = -1;
      }
   }

   // notes that went by unstruck
   const notes = run.chart.notes;
   while (run.cursor < notes.length && (run.grade[run.cursor] !== PENDING || notes[run.cursor].t < now - GOOD_MS)) {
      const i = run.cursor;
      if (run.grade[i] === PENDING) {
         if (notes[i].bonus === "") missMain(run, i);
         else run.grade[i] = MISS;
      }
      run.cursor += 1;
   }

   // shockwaves: a ring running out from the middle; jump it
   const shocks = run.chart.shocks;
   const hr = Math.hypot(h.x, h.z);
   for (let i = 0; i < shocks.length; i++) {
      if (run.shocksHit[i]) continue;
      const ring = SHOCK_SPEED * ((now - shocks[i].t) / 1000) + STRIKE_R;
      if (ring < hr - SHOCK_BAND) continue;
      if (ring > hr + SHOCK_BAND) {
         if (ring > hr + SHOCK_BAND + 1) run.shocksHit[i] = true;
         continue;
      }
      if (h.air > 0.35) continue;
      run.shocksHit[i] = true;
      ev.shockHit = true;
      if (shieldReady(run)) {
         run.shieldReadyAt = now + SHIELD_MS;
         ev.shielded = true;
      } else {
         run.hits += 1;
         comboBreak(run.combo);
      }
   }

   // echo orbs
   const reach = run.heroId === "zuno" ? MAGNET_REACH : ECHO_REACH;
   for (const e of run.echoes) {
      if (!e.alive) continue;
      if (now - e.born > ECHO_MS) {
         e.alive = false;
         continue;
      }
      // it floats in towards the middle of the stage
      const er = Math.hypot(e.x, e.z);
      if (er > 0.5) {
         e.x -= (e.x / er) * ECHO_DRIFT * dt;
         e.z -= (e.z / er) * ECHO_DRIFT * dt;
      }
      if (Math.hypot(h.x - e.x, h.z - e.z) <= reach && h.air < 1.5) {
         e.alive = false;
         run.echoCount += 1;
         ev.echoCaught += 1;
         run.score += POINTS.echo;
         ev.points += POINTS.echo;
      }
   }

   run.simMs += STEP_MS;
   if (!cfg.boss && run.simMs >= run.chart.endMs) {
      const clear = finalAccuracy(run) >= cfg.accuracy;
      if (run.level === 2 && run.silentPerfect && run.silentSeen > 0) pushSecret(run, secretIndex(run.level, "silent-master"));
      end(run, clear ? "win" : "lose");
   }
   if (cfg.boss && run.ended === null && run.simMs >= cfg.capMs) end(run, "lose");
}

/** Level 5: a unit of the fight ended. P2 scores the phrase; then the next unit by Coilstone's phase. */
function bossUnitEnd(run: GongRun): void {
   const b = run.boss!;
   const notes = run.chart.notes;
   if (run.unitKind === "duel") {
      let total = 0;
      let got = 0;
      for (let i = run.unitFirstNote; i < notes.length; i++) {
         if (notes[i].bonus !== "") continue;
         total += 1;
         if (run.grade[i] === PERFECT) got += 1;
         else if (run.grade[i] === GOOD) got += 0.5;
      }
      if (total > 0 && got / total >= DUEL_ACCURACY) bossStrike(run);
   }
   if (run.ended !== null) return;
   const phase = b.hp > COILSTONE.maxHp * COILSTONE.phases[0].endsAt ? 0 : b.hp > COILSTONE.maxHp * COILSTONE.phases[1].endsAt ? 1 : 2;
   const kind: UnitKind = phase === 0 ? "call" : phase === 1 ? "duel" : "great";
   if (kind !== run.unitKind) run.unitN = 0;
   run.unitKind = kind;
   // past its paid count a unit is an encore: it still cracks plates and counts for accuracy, pays nothing
   run.encore = run.unitN >= PAID_UNITS[kind];
   run.unitStart = run.unitEnd;
   run.unitFirstNote = notes.length;
   run.unitEnd = writeUnit(run.stage, kind, run.unitN, run.unitStart, run.chart);
   run.unitN += 1;
   syncChart(run);
}

// ---------- the score ----------

/** The stars: clear (levels 1-4 the accuracy target, level 5 Coilstone freed), the echo orbs, the score target; full combo = no-hit. */
export function runStars(run: GongRun): StarResult {
   return evaluateStars(starSpecFor(run.level), { cleared: run.ended === "win", orbs: run.echoCount, goalValue: run.score, hits: run.hits });
}

export function flowOf(run: GongRun): number {
   return comboFlow(run.combo, COMBO, run.simMs);
}

export const bossVulnerable = (run: GongRun): boolean => run.boss !== null && run.boss.step === "vulnerable";

export { SECRETS, COILSTONE };
export type { HeroId };

export const STAT = {
   accuracy: "accuracy",
   perfects: "perfects",
   goods: "goods",
   misses: "misses",
   echoes: "echoes",
   hero: "hero",
   shield: "shield",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   song: "song",
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

/** The level limits proven in proof.test.ts (README table): bound.ts proposeLimits, pinned. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, { kind: "points"; maxScore: number; minDurationMs: number; maxDurationMs: number; base: number; maxPointsPerSec: number }> = {
   1: { kind: "points", maxScore: 12_790, minDurationMs: 72_800, maxDurationMs: 79_500, base: 400, maxPointsPerSec: 176 },
   2: { kind: "points", maxScore: 13_690, minDurationMs: 71_500, maxDurationMs: 78_154, base: 400, maxPointsPerSec: 187 },
   3: { kind: "points", maxScore: 14_180, minDurationMs: 64_400, maxDurationMs: 70_572, base: 400, maxPointsPerSec: 215 },
   4: { kind: "points", maxScore: 14_790, minDurationMs: 41_800, maxDurationMs: 46_517, base: 400, maxPointsPerSec: 358 },
   5: { kind: "points", maxScore: 28_600, minDurationMs: 64_700, maxDurationMs: 242_000, base: 5_720, maxPointsPerSec: 318 },
};
