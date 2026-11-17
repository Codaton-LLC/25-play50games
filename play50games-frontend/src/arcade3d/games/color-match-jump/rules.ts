// Color Match Jump's rules: pure and deterministic (the field and the codes are seeded per level).
// The renderer, the bot and the proofs all call step(). A hop is a fixed-time arc from hex to hex; a
// landing is the colour check: your active hero's colour holds and lights the hex, another colour
// cracks it (it drops 0.6 s later), grey is neutral. Crack the beacon's codes, then land the crown.
import type { LevelId, ScoringRules } from "../../types";
import type { RunState } from "../../core/types";
import { createRng, inputToWorld } from "../../core/math";
import { createCombo, comboBreak, comboHit, comboTick, type ComboState } from "../../menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossState } from "../../menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "../../menu2/secrets/secrets";
import { LEVELS, type CmjLevel } from "./levels";
import { CORE_COLOURS, D, DIRS, GOLEM, GREY, ICE, cellAt, courseFor, indexCourse, type Cell, type Course } from "./course";
import { HEROES, heroIndex, type HeroId } from "./heroes";
import { COMBO, FROST_GOLEM, SECRETS, STORM } from "./progression";

export const SUBSTEP_MS = 8;
/** A one-hex hop's airtime (ms): the shortest landing-to-landing time there is (the proofs' unit). */
export const HOP_MS = 560;
/** A held jump becomes a two-hex long jump (ms of airtime). */
export const LONG_MS = 720;
/** The jump button still held this long after takeoff = a long jump. */
export const LONG_DECIDE_MS = 150;
export const DASH_EXTRA_MS = 200;
export const DOUBLE_EXTRA_MS = 240;
export const BOUNCE_MS = 320;
/** Climb allowed by a hop / a double jump (m). */
export const CLIMB = 1.3;
export const CLIMB_DOUBLE = 4.3;
export const CRACK_MS = 600;
export const FALL_MS = 900;
export const SKID_MS = 250;
export const TAG_MS = 500;
export const LINGER_MS = 300;
export const HEARTS = 3;
export const MAGNET_R = 6;
/** L5: cracked and boulder hexes grow back (ms). */
export const REGROW_MS = 5000;
export const BOULDER_GONE_MS = 8000;
export const ICE_MS = 6000;

export const STAT = {
   level: "cmjLevel", codes: "cmjCodes", codeStep: "cmjCodeStep", code: "cmjCode", codeLen: "cmjCodeLen",
   hearts: "cmjHearts", orbs: "cmjOrbs", active: "cmjActive", tagReady: "cmjTagReady",
   cd0: "cmjCd0", cd1: "cmjCd1", cd2: "cmjCd2", cd3: "cmjCd3", cd4: "cmjCd4",
   chain: "cmjChain", multiplier: "cmjMult", flow: "cmjFlow", hint: "cmjHint", sink: "cmjSink",
   bossHp: "cmjBossHp", bossPhase: "cmjBossPhase", bossOpen: "cmjBossOpen", bossFlash: "cmjBossFlash",
   plate: "cmjPlate", shards: "cmjShards", storm: "cmjStorm", finishMs: "cmjFinishMs",
   stars: "cmjStars", newStars: "cmjNewStars", noHit: "cmjNoHit", secrets: "cmjSecrets", newSecrets: "cmjNewSecrets", xp: "cmjXp",
} as const;

export interface StepInput {
   moveX: number;
   moveY: number;
   yaw: number;
   jumpPressed: boolean;
   jumpHeld: boolean;
   actionPressed: boolean;
   /** -1 none, 0..4 select that hero, 5 the next one */
   tag: number;
}
export const idleInput = (): StepInput => ({ moveX: 0, moveY: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false, tag: -1 });

export interface Events {
   hop: boolean; landed: boolean; matched: boolean; cracked: boolean; fell: boolean; respawned: boolean;
   tagged: boolean; power: boolean; airJump: boolean; dash: boolean; zap: boolean; bonk: boolean; hurt: boolean;
   orb: boolean; secret: boolean; codeStep: boolean; codeCracked: boolean; crownLocked: boolean; finished: boolean;
   bossTelegraph: boolean; bossAttack: boolean; bossHit: boolean; bossPhase: boolean; bossDefeated: boolean;
   stomp: boolean; shard: boolean;
}
const newEvents = (): Events => ({ hop: false, landed: false, matched: false, cracked: false, fell: false, respawned: false, tagged: false, power: false, airJump: false, dash: false, zap: false, bonk: false, hurt: false, orb: false, secret: false, codeStep: false, codeCracked: false, crownLocked: false, finished: false, bossTelegraph: false, bossAttack: false, bossHit: false, bossPhase: false, bossDefeated: false, stomp: false, shard: false });
const clearEvents = (e: Events) => {
   for (const k of Object.keys(e) as (keyof Events)[]) e[k] = false;
   return e;
};

export interface Hop {
   from: number;
   dir: number;
   cells: number;
   t0: number;
   dur: number;
   decided: boolean;
   doubled: boolean;
   airUsed: boolean;
   fresh: boolean;
   shoulder: boolean;
   bounce: boolean;
   x0: number; z0: number; h0: number;
   x1: number; z1: number; h1: number;
}

export interface CmjRun {
   seed: number;
   level: LevelId;
   config: CmjLevel;
   course: Course;
   index: Map<string, number>;
   lead: HeroId;
   active: number;
   simMs: number;
   cell: number;
   hop: Hop | null;
   x: number; y: number; z: number; vx: number; vy: number; vz: number;
   hearts: number;
   hits: number;
   fallUntil: number;
   skidUntil: number;
   tagReadyAt: number;
   cooldown: number[];
   powerUntil: number[];
   tagOutAt: number[];
   crackAt: Float64Array;
   removedUntil: Float64Array;
   iceUntil: Float64Array;
   litUntil: Float64Array;
   orbTaken: Uint8Array;
   floatTaken: Uint8Array;
   orbs: number;
   rng: () => number;
   codes: number;
   code: number[];
   codeStep: number;
   lastCodeCell: number;
   codeStartMs: number;
   combo: ComboState;
   secrets: SecretTracker;
   boss: BossState | null;
   bossEv: ReturnType<typeof createBossEvents>;
   pendingHits: number;
   coreTarget: number;
   slamBand: number;
   boulderCell: number;
   plate: number;
   p3Start: number;
   p3Done: boolean;
   shards: number;
   shardCell: number;
   finishMs: number;
   ended: "win" | "lose" | "timeup" | null;
   events: Events;
}

export function createRun(seed: number, level: LevelId = 1, lead: HeroId = "riko"): CmjRun {
   const config = LEVELS[level];
   const course = courseFor(level);
   const n = course.cells.length;
   const s = course.cells[course.start];
   const r: CmjRun = {
      seed, level, config, course, index: indexCourse(course), lead, active: Math.max(0, heroIndex(lead)), simMs: 0,
      cell: course.start, hop: null, x: s.x, y: s.h, z: s.z, vx: 0, vy: 0, vz: 0,
      hearts: HEARTS, hits: 0, fallUntil: -1, skidUntil: 0, tagReadyAt: 0,
      cooldown: [0, 0, 0, 0, 0], powerUntil: [0, 0, 0, 0, 0], tagOutAt: [-1e9, -1e9, -1e9, -1e9, -1e9],
      crackAt: new Float64Array(n).fill(-1), removedUntil: new Float64Array(n), iceUntil: new Float64Array(n), litUntil: new Float64Array(n),
      orbTaken: new Uint8Array(n), floatTaken: new Uint8Array(course.floats.length), orbs: 0,
      // codes come from the level's own seed: every player cracks the same codes
      rng: createRng(course.seed * 7 + 3), codes: 0, code: [], codeStep: 0, lastCodeCell: -1, codeStartMs: 0,
      combo: createCombo(), secrets: createSecretTracker(SECRETS[level]),
      boss: config.boss ? createBoss(FROST_GOLEM) : null, bossEv: createBossEvents(), pendingHits: 0, coreTarget: 0,
      slamBand: -1, boulderCell: -1, plate: 1, p3Start: -1, p3Done: false, shards: 0, shardCell: -1,
      finishMs: 0, ended: null, events: newEvents(),
   };
   newCode(r);
   return r;
}

// ---------- reads ----------

/** Rows the sink wave has dropped (rows below this are gone). */
export function sunkRows(r: Pick<CmjRun, "config" | "simMs">): number {
   const l = r.config;
   if (!l.sinkMs || r.simMs < l.sinkDelayMs) return 0;
   return Math.min(l.rows - 3, Math.floor((r.simMs - l.sinkDelayMs) / l.sinkMs) + 1);
}

export function cellAlive(r: CmjRun, c: Cell, t = r.simMs): boolean {
   if (!r.config.boss && !c.crown && c.row < sunkRows(r)) return false;
   if (r.removedUntil[c.id] > t) return false;
   const k = r.crackAt[c.id];
   if (k >= 0 && t >= k + CRACK_MS) {
      if (!r.config.boss) return false;
      return t >= k + CRACK_MS + REGROW_MS;
   }
   return true;
}

/** The colour a hex shows at time t (L3 cycles, L5 freezes and storms). */
export function colourAt(r: CmjRun, c: Cell, t = r.simMs): number {
   if (c.colour === GREY) return GREY;
   if (r.iceUntil[c.id] > t) return ICE;
   if (r.p3Start >= 0 && c.core < 0) {
      const epoch = Math.floor((t - r.p3Start) / STORM.recolourMs);
      let h = (c.id * 2654435761 + epoch * 40503) >>> 0;
      h = (h ^ (h >>> 13)) >>> 0;
      return r.config.palette[h % r.config.palette.length];
   }
   const hue = r.config.hueMs;
   if (hue > 0) {
      const p = r.config.palette;
      return p[(p.indexOf(c.colour) + Math.floor(t / hue)) % p.length];
   }
   return c.colour;
}

/** The height of a hex's top at time t (L3 bobs). */
export function cellHeight(r: CmjRun, c: Cell, t = r.simMs): number {
   return r.config.bob > 0 ? c.h + Math.sin(t * 0.0021 + c.phase) * r.config.bob : c.h;
}

export const activeHero = (r: CmjRun): HeroId => HEROES[r.active].id;

/** A hero's power is up (the active one, or one tagged out in the last 0.3 s: the hand-off linger). */
export function powerUp(r: CmjRun, hero: number, t = r.simMs): boolean {
   return r.powerUntil[hero] > t && (r.active === hero || t - r.tagOutAt[hero] < LINGER_MS);
}

export const codesNeeded = (r: CmjRun): number => r.config.codes;
export const crownOpen = (r: CmjRun): boolean => r.codes >= r.config.codes;

/** The hex k hexes from (x, z) along direction d, if any. */
export function cellFrom(r: CmjRun, x: number, z: number, d: number, k: number): Cell | undefined {
   return cellAt(r.course, r.index, x + DIRS[d].x * D * k, z + DIRS[d].z * D * k);
}

/** The hop direction (0..5) a stick points at, camera-relative; -1 = no direction. */
export function stickDir(moveX: number, moveY: number, yaw: number): number {
   if (Math.hypot(moveX, moveY) < 0.35) return -1;
   const w = inputToWorld(moveX, moveY, yaw);
   let best = 0;
   let bd = -Infinity;
   for (let i = 0; i < 6; i++) {
      const d = DIRS[i].x * w.x + DIRS[i].z * w.z;
      if (d > bd) {
         bd = d;
         best = i;
      }
   }
   return best;
}

// ---------- codes ----------

function newCode(r: CmjRun): void {
   const p = r.config.palette;
   const code: number[] = [];
   const len = r.config.codeLen;
   for (let i = 0; i < len; i++) {
      let c = p[Math.floor(r.rng() * p.length)];
      if (i > 0 && c === code[i - 1]) c = p[(p.indexOf(c) + 1) % p.length];
      code.push(c);
   }
   if (r.boss) code[len - 1] = CORE_COLOURS[Math.min(2, r.coreTarget)];
   r.code = code;
   r.codeStep = 0;
   r.lastCodeCell = -1;
   r.codeStartMs = r.simMs;
}

function crackCode(r: CmjRun, ev: Events): void {
   ev.codeCracked = true;
   if (r.boss) {
      if (r.boss.phase === 0 && r.coreTarget < 3) {
         r.pendingHits++;
         r.coreTarget++;
      }
   } else {
      if (r.level === 4 && r.simMs - r.codeStartMs <= 4000 && collectSecret(r.secrets, 0)) ev.secret = true;
      r.codes++;
   }
   newCode(r);
}

// ---------- hops ----------

function hopTarget(r: CmjRun, hop: Hop): void {
   if (hop.shoulder) return;
   if (hop.dir < 0) {
      hop.x1 = hop.x0;
      hop.z1 = hop.z0;
   } else {
      hop.x1 = hop.x0 + DIRS[hop.dir].x * D * hop.cells;
      hop.z1 = hop.z0 + DIRS[hop.dir].z * D * hop.cells;
   }
   const c = cellAt(r.course, r.index, hop.x1, hop.z1);
   hop.h1 = c ? c.h : hop.h0 - 2;
}

function takeoff(r: CmjRun, dir: number, cells: number, ev: Events): void {
   const from = r.course.cells[r.cell];
   const h0 = cellHeight(r, from);
   const hop: Hop = {
      from: r.cell, dir, cells: dir < 0 ? 0 : cells, t0: r.simMs, dur: cells >= 3 ? HOP_MS + DASH_EXTRA_MS : HOP_MS,
      decided: cells !== 1, doubled: false, airUsed: cells >= 3, fresh: false, shoulder: false, bounce: false,
      x0: from.x, z0: from.z, h0, x1: from.x, z1: from.z, h1: h0,
   };
   // L5 P2: from the stomp hex, a jump at the golem goes for its shoulder
   if (r.boss && r.boss.phase === 1 && from.stomp && dir >= 0) {
      const gx = GOLEM.x - from.x;
      const gz = GOLEM.z - from.z;
      const len = Math.hypot(gx, gz);
      if ((DIRS[dir].x * gx + DIRS[dir].z * gz) / len > 0.8) {
         hop.shoulder = true;
         hop.decided = true;
         hop.x1 = GOLEM.x - (gx / len) * 1.4;
         hop.z1 = GOLEM.z - (gz / len) * 1.4;
         hop.h1 = 5.2;
      }
   }
   hopTarget(r, hop);
   r.hop = hop;
   r.cell = -1;
   ev.hop = true;
}

function bounceBack(r: CmjRun, hop: Hop, ev: Events): void {
   ev.bonk = true;
   const back: Hop = {
      from: hop.from, dir: -1, cells: 0, t0: r.simMs, dur: BOUNCE_MS, decided: true, doubled: false, airUsed: true, fresh: true,
      shoulder: false, bounce: true, x0: r.x, z0: r.z, h0: r.y, x1: hop.x0, z1: hop.z0, h1: hop.h0,
   };
   r.hop = back;
}

function fall(r: CmjRun, ev: Events): void {
   r.hop = null;
   r.cell = -1;
   r.fallUntil = r.simMs + FALL_MS;
   r.codeStep = 0;
   r.lastCodeCell = -1;
   comboBreak(r.combo);
   ev.fell = true;
   loseHeart(r, ev);
}

function loseHeart(r: CmjRun, ev: Events): void {
   r.hearts--;
   r.hits++;
   ev.hurt = true;
   if (r.hearts <= 0) r.ended = "lose";
}

function respawn(r: CmjRun, ev: Events): void {
   r.fallUntil = -1;
   const sunk = sunkRows(r);
   let best = -1;
   let bd = Infinity;
   for (const c of r.course.cells) {
      if (c.ghost || c.curtain || c.tall || c.island || c.crown || c.stomp || c.core >= 0 || !cellAlive(r, c) || r.crackAt[c.id] >= 0) continue;
      if (!r.config.boss && c.row < sunk + 2) continue;
      const d = (c.x - r.x) ** 2 + (c.z - r.z) ** 2;
      if (d < bd) {
         bd = d;
         best = c.id;
      }
   }
   if (best < 0) best = r.course.start;
   const c = r.course.cells[best];
   r.cell = best;
   r.x = c.x;
   r.z = c.z;
   r.y = cellHeight(r, c);
   ev.respawned = true;
}

function takeOrbs(r: CmjRun, c: Cell, ev: Events): void {
   if (c.orb && !r.orbTaken[c.id]) {
      r.orbTaken[c.id] = 1;
      r.orbs++;
      ev.orb = true;
   }
   if (c.secret >= 0 && collectSecret(r.secrets, c.secret)) ev.secret = true;
}

function land(r: CmjRun, c: Cell, ev: Events): void {
   const t = r.simMs;
   r.hop = null;
   r.cell = c.id;
   r.x = c.x;
   r.z = c.z;
   r.y = cellHeight(r, c);
   ev.landed = true;
   takeOrbs(r, c, ev);
   if (c.crown) {
      if (crownOpen(r)) finish(r, ev);
      else ev.crownLocked = true;
      return;
   }
   if (c.glassy) r.skidUntil = t + SKID_MS;
   const col = colourAt(r, c, t);
   if (col === GREY) return;
   if (col === ICE) {
      r.skidUntil = t + SKID_MS;
      return;
   }
   if (col !== r.active) {
      r.crackAt[c.id] = t;
      r.hits++;
      r.codeStep = 0;
      r.lastCodeCell = -1;
      comboBreak(r.combo);
      ev.cracked = true;
      return;
   }
   ev.matched = true;
   r.litUntil[c.id] = t + 1200;
   comboHit(r.combo, COMBO, t, 0);
   // the beacon code: the next colour on a new hex (L5 P1: the last one on the glowing core)
   const boss = r.boss;
   const codesOn = boss ? boss.phase === 0 && r.coreTarget < 3 : r.codes < r.config.codes;
   if (codesOn && col === r.code[r.codeStep] && c.id !== r.lastCodeCell) {
      const last = r.codeStep === r.code.length - 1;
      if (!(boss && last && c.core !== r.coreTarget)) {
         r.codeStep++;
         r.lastCodeCell = c.id;
         ev.codeStep = true;
         if (r.codeStep >= r.code.length) crackCode(r, ev);
      }
   }
   if (boss && r.p3Start >= 0 && c.id === r.shardCell) {
      r.shards++;
      ev.shard = true;
      pickShard(r);
   }
}

function resolveHop(r: CmjRun, hop: Hop, ev: Events): void {
   const from = r.course.cells[hop.from];
   if (hop.bounce) {
      if (cellAlive(r, from)) {
         r.hop = null;
         r.cell = from.id;
         r.x = from.x;
         r.z = from.z;
         r.y = cellHeight(r, from);
      } else fall(r, ev);
      return;
   }
   if (hop.shoulder) {
      if (!hop.doubled) return bounceBack(r, hop, ev);
      if (r.active === r.plate) {
         r.pendingHits++;
         ev.stomp = true;
      } else loseHeart(r, ev);
      if (!r.ended) bounceBack(r, hop, ev);
      return;
   }
   // the path: ghost pillars stop all but a phasing Vexa; curtains zap all but a shielded Kiro
   for (let j = 1; j <= hop.cells; j++) {
      const c = cellFrom(r, hop.x0, hop.z0, hop.dir, j);
      if (!c || !cellAlive(r, c)) continue;
      if (c.ghost && !powerUp(r, 4)) return bounceBack(r, hop, ev);
      if (c.curtain && !powerUp(r, 2)) {
         ev.zap = true;
         loseHeart(r, ev);
         if (!r.ended) bounceBack(r, hop, ev);
         return;
      }
   }
   const target = hop.dir < 0 ? from : cellFrom(r, hop.x0, hop.z0, hop.dir, hop.cells);
   if (!target || !cellAlive(r, target)) return fall(r, ev);
   if (cellHeight(r, target) - hop.h0 > (hop.doubled ? CLIMB_DOUBLE : CLIMB)) return bounceBack(r, hop, ev);
   land(r, target, ev);
}

// ---------- the boss ----------

function bandOf(c: Cell): number {
   const d = Math.hypot(c.x - GOLEM.x, c.z - GOLEM.z);
   return d < 9.5 ? 0 : d < 12.6 ? 1 : 2;
}

function pickShard(r: CmjRun): void {
   const hx = r.x;
   const hz = r.z;
   const ok: number[] = [];
   for (const c of r.course.cells) {
      if (c.colour === GREY || c.core >= 0 || c.tall || c.island || c.curtain || c.ghost || !cellAlive(r, c)) continue;
      const d = Math.hypot(c.x - hx, c.z - hz);
      if (d >= 4 && d <= 9.5) ok.push(c.id);
   }
   r.shardCell = ok.length ? ok[Math.floor(r.rng() * ok.length)] : -1;
}

function stepBossMs(r: CmjRun, ms: number, ev: Events): void {
   const b = r.boss!;
   const before = b.phase;
   const be = stepBoss(b, FROST_GOLEM, ms, r.bossEv);
   if (b.phase !== before) ev.bossPhase = true;
   if (be.telegraph) {
      ev.bossTelegraph = true;
      if (b.phase === 0) r.slamBand = Math.floor(r.rng() * 3);
      if (b.phase === 1) {
         // a boulder aims at the hero's hex, never at the stomp hex beside the golem's feet
         const aim = r.cell >= 0 ? r.cell : r.hop ? r.hop.from : -1;
         r.boulderCell = aim >= 0 && !r.course.cells[aim].stomp ? aim : -1;
         const p = r.config.palette;
         r.plate = p[(p.indexOf(r.plate) + 1 + Math.floor(r.rng() * (p.length - 1))) % p.length];
      }
   }
   if (be.attack) {
      ev.bossAttack = true;
      if (b.phase === 0 && r.slamBand >= 0) {
         for (const c of r.course.cells) if (c.colour !== GREY && c.core < 0 && bandOf(c) === r.slamBand) r.iceUntil[c.id] = r.simMs + ICE_MS;
      }
      if (b.phase === 1 && r.boulderCell >= 0) {
         r.removedUntil[r.boulderCell] = r.simMs + BOULDER_GONE_MS;
         r.boulderCell = -1;
      }
   }
   if (b.phase === 2 && r.p3Start < 0) {
      r.p3Start = r.simMs;
      pickShard(r);
   }
   if (r.p3Start >= 0 && !r.p3Done) {
      if (r.shardCell >= 0 && !cellAlive(r, r.course.cells[r.shardCell])) pickShard(r);
      if (r.shardCell < 0) pickShard(r);
      if (r.shards >= STORM.shards && r.simMs - r.p3Start >= STORM.surviveMs) {
         r.p3Done = true;
         r.pendingHits++;
      }
   }
   if (r.pendingHits > 0 && b.step === "vulnerable") {
      const res = hitBoss(b, FROST_GOLEM, 1, r.bossEv);
      if (res !== "ignored") {
         r.pendingHits--;
         ev.bossHit = true;
         if (res === "phase") ev.bossPhase = true;
         if (res === "defeated") {
            ev.bossDefeated = true;
            finish(r, ev);
         }
      }
   }
}

function finish(r: CmjRun, ev: Events): void {
   if (r.ended) return;
   r.finishMs = r.simMs;
   r.ended = "win";
   ev.finished = true;
}

// ---------- the step ----------

function power(r: CmjRun, input: StepInput, ev: Events): void {
   const h = r.active;
   const t = r.simMs;
   const hop = r.hop;
   if (h === 1) {
      if (hop && !hop.airUsed && !hop.bounce) doubleJump(r, hop, ev);
      return;
   }
   if (r.cooldown[h] > 0) return;
   if (h === 0) {
      if (hop) {
         if (hop.airUsed || hop.bounce || hop.shoulder || hop.dir < 0) return;
         hop.cells += 2;
         hop.decided = true;
         hop.dur += DASH_EXTRA_MS;
         hop.airUsed = true;
         hopTarget(r, hop);
      } else if (r.cell >= 0 && t >= r.skidUntil) {
         const d = stickDir(input.moveX, input.moveY, input.yaw);
         if (d < 0) return;
         takeoff(r, d, 3, ev);
      } else return;
      r.cooldown[h] = HEROES[h].cooldownMs;
      ev.dash = true;
      ev.power = true;
      return;
   }
   r.powerUntil[h] = t + HEROES[h].powerMs;
   r.cooldown[h] = HEROES[h].cooldownMs;
   ev.power = true;
}

function doubleJump(r: CmjRun, hop: Hop, ev: Events): void {
   hop.doubled = true;
   hop.airUsed = true;
   hop.dur += DOUBLE_EXTRA_MS;
   ev.airJump = true;
}

function substep(r: CmjRun, ms: number, input: StepInput, first: boolean): void {
   const ev = r.events;
   r.simMs += ms;
   const t = r.simMs;
   comboTick(r.combo, COMBO, t);
   for (let i = 0; i < 5; i++) if (r.cooldown[i] > 0) r.cooldown[i] = Math.max(0, r.cooldown[i] - ms * (i === r.active ? 1 : 2));
   // tagging
   if (first && input.tag >= 0 && t >= r.tagReadyAt) {
      const next = input.tag === 5 ? (r.active + 1) % 5 : input.tag;
      if (next !== r.active) {
         r.tagOutAt[r.active] = t;
         r.active = next;
         r.tagReadyAt = t + TAG_MS;
         ev.tagged = true;
         // fresh legs: a hero tagged in mid-air gets a fresh air action (once per airtime)
         if (r.hop && !r.hop.fresh && !r.hop.bounce) {
            r.hop.fresh = true;
            r.hop.airUsed = false;
         }
      }
   }
   if (r.fallUntil >= 0) {
      r.y -= ms * 0.02;
      if (t >= r.fallUntil && !r.ended) respawn(r, ev);
   } else if (r.hop) {
      const hop = r.hop;
      if (first && input.jumpPressed && r.active === 1 && !hop.airUsed && !hop.bounce) doubleJump(r, hop, ev);
      if (first && input.actionPressed) power(r, input, ev);
      if (!hop.decided && t - hop.t0 >= LONG_DECIDE_MS) {
         hop.decided = true;
         if (input.jumpHeld && hop.dir >= 0) {
            hop.cells = 2;
            hop.dur = LONG_MS;
            hopTarget(r, hop);
         }
      }
      const k = Math.min(1, (t - hop.t0) / hop.dur);
      const apex = (hop.bounce ? 0.8 : hop.cells >= 2 ? 2.0 : 1.4) + (hop.doubled ? 2.2 : 0);
      const px = r.x;
      const pz = r.z;
      const py = r.y;
      r.x = hop.x0 + (hop.x1 - hop.x0) * k;
      r.z = hop.z0 + (hop.z1 - hop.z0) * k;
      r.y = hop.h0 + (hop.h1 - hop.h0) * k + 4 * apex * k * (1 - k);
      r.vx = ((r.x - px) / ms) * 1000;
      r.vy = ((r.y - py) / ms) * 1000;
      r.vz = ((r.z - pz) / ms) * 1000;
      if (k >= 1) resolveHop(r, hop, ev);
   } else if (r.cell >= 0) {
      r.vx = r.vy = r.vz = 0;
      const c = r.course.cells[r.cell];
      r.y = cellHeight(r, c);
      if (!cellAlive(r, c)) fall(r, ev);
      else {
         if (first && input.actionPressed) power(r, input, ev);
         if (!r.hop && first && input.jumpPressed && t >= r.skidUntil) takeoff(r, stickDir(input.moveX, input.moveY, input.yaw), 1, ev);
      }
   }
   // Zuno's magnet pulls the floating orbs in
   if (powerUp(r, 3)) {
      r.course.floats.forEach((f, i) => {
         if (r.floatTaken[i] || Math.hypot(f.x - r.x, f.z - r.z) > MAGNET_R) return;
         r.floatTaken[i] = 1;
         if (f.secret >= 0) {
            if (collectSecret(r.secrets, f.secret)) ev.secret = true;
         } else {
            r.orbs++;
            ev.orb = true;
         }
      });
   }
   if (r.boss && !r.ended) stepBossMs(r, ms, ev);
   if (!r.ended && t >= r.config.durationMs) r.ended = "timeup";
}

export function step(r: CmjRun, dtMs: number, input: StepInput): Events {
   clearEvents(r.events);
   if (r.ended || !Number.isFinite(dtMs) || dtMs <= 0) return r.events;
   let left = Math.min(250, dtMs, r.config.durationMs - r.simMs);
   let first = true;
   while (left > 1e-7 && !r.ended) {
      const ms = Math.min(SUBSTEP_MS, left);
      substep(r, ms, input, first);
      first = false;
      left -= ms;
   }
   return r.events;
}

// ---------- hints, limits, the score ----------

export const HINT = { none: 0, match: 1, tag: 2, code: 3, crown: 4, sink: 5, hues: 6, glassy: 7, cores: 8, stomp: 9, storm: 10, fell: 11 } as const;

export function hintFor(r: CmjRun): number {
   if (r.fallUntil >= 0) return HINT.fell;
   const b = r.boss;
   if (b) return b.phase === 0 ? HINT.cores : b.phase === 1 ? HINT.stomp : HINT.storm;
   if (crownOpen(r)) return HINT.crown;
   if (r.level === 1) return r.simMs < 6000 ? HINT.match : r.codes < 2 ? HINT.tag : HINT.code;
   if (r.level === 3) return HINT.hues;
   if (r.level === 4) return HINT.glassy;
   return sunkRows(r) > 0 ? HINT.sink : HINT.code;
}

/**
 * The fastest legal finish: every code step is a landing on a hex, every landing ends a hop, a hop
 * lasts at least HOP_MS and only starts on the ground, so k code steps take at least k * HOP_MS.
 * L5: three 4-step codes (P1), three stomps of two hops each (P2), then the storm lasts STORM.surviveMs.
 */
export function minFinishMs(level: LevelId): number {
   const l = LEVELS[level];
   if (l.boss) return 3 * l.codeLen * HOP_MS + 3 * 2 * HOP_MS + STORM.surviveMs;
   return l.codes * l.codeLen * HOP_MS;
}

export const LIMITS: Record<LevelId, ScoringRules> = Object.fromEntries(
   ([1, 2, 3, 4, 5] as const).map((id) => {
      const l = LEVELS[id];
      const minDurationMs = minFinishMs(id) - 1;
      return [id, { kind: "time", minDurationMs, maxDurationMs: l.durationMs, timeBaseMs: l.durationMs, maxScore: Math.floor((l.durationMs - minDurationMs) / 10), base: 0, maxPointsPerSec: 0, unitLabel: "time", display: "time" }];
   })
) as Record<LevelId, ScoringRules>;

export function finalScore(s: Pick<RunState, "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const durationMs = Math.ceil(s.stats[STAT.finishMs] || s.elapsedMs);
   const level = (s.stats[STAT.level] ?? 1) as LevelId;
   return { score: Math.max(0, Math.floor((LEVELS[level].durationMs - durationMs) / 10)), durationMs };
}
