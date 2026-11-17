// Mirror Dash rules: pure, deterministic, stepped at a fixed 120 Hz. One "pair" per player: the hero on
// the left runway and its glass reflection on the right, auto-running down the course (+s, drawn along
// -z). One input drives both bodies: a lane change is mirrored for the reflection (frosted zones: copied;
// echo zones: repeated 0.5 s later), jumps and slides are copied. A hit cracks the pair (both slow down
// for 0.6 s); a third crack shatters it back to the last checkpoint, where the cracks reset. Merge zones
// pull the runways into one road where the two inner lanes touch: the bodies must not meet there.
// L5 ends in the Glass Sentinel's arena (progression.ts SENTINEL).
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "../../menu2/boss/boss";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "../../menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "../../menu2/secrets/secrets";
import type { M2HeroId } from "../../menu2/heroModels";
import type { LevelId } from "../../types";
import { LANE_W, LEVELS, parseCourse, zoneAt, type Course, type MirrorLevel, type ObstacleKind, type Zone } from "./levels";
import { COMBO, COMBO_BASE_MS, SECRETS, SENTINEL } from "./progression";

export const FIXED_MS = 1000 / 120;
/** a lane change: lanes per second */
export const LANE_RATE = 1 / 0.14;
export const JUMP_V = 8;
export const GRAVITY = 26;
export const SLIDE_MS = 650;
export const SLOW = { ms: 600, factor: 0.55 } as const;
export const GRACE_MS = 900;
export const SHATTER_MS = 900;
export const CRACKS = 3;
export const ECHO_MS = 500;
/** the runways' centres (|x|) apart and merged */
export const CENTRE = { apart: 2 * LANE_W, merged: LANE_W } as const;
export const DASH = { ms: 320, factor: 1.5, cooldownMs: 2500 } as const;
export const POWER_MS = { kiro: 1000, zuno: 3000, vexa: 800 } as const;
export const POWER_COOLDOWN_MS = { riko: DASH.cooldownMs, nami: 0, kiro: 6000, zuno: 7000, vexa: 5000 } as const;
export const MAGNET = { lanes: 2, ahead: 9 } as const;
export const ORB_BONUS_MS = 400;
/** the boss arena: how far ahead the Sentinel's targets appear, how long the course runs on after it falls */
export const ARENA = { ahead: 32, exit: 24, laneTol: 0.55 } as const;
export const V_MAX = Math.max(...Object.values(LEVELS).map((l) => Math.max(...l.speed))) * DASH.factor;

export interface StepInput {
   left: boolean;
   right: boolean;
   jump: boolean;
   slide: boolean;
   action: boolean;
}
export const idleInput = (): StepInput => ({ left: false, right: false, jump: false, slide: false, action: false });

export interface Body {
   /** the lane it heads for (-1, 0, 1) and its offset now (lanes, eased) */
   lane: number;
   off: number;
   y: number;
   vy: number;
   slideMs: number;
   airJumped: boolean;
}

export interface PairEvents {
   laneChange: boolean;
   jump: boolean;
   land: boolean;
   slide: boolean;
   crack: boolean;
   crackBody: number;
   shatter: boolean;
   orb: number;
   orbBody: number;
   secret: boolean;
   checkpoint: boolean;
   twin: boolean;
   power: boolean;
   broke: boolean;
   bump: boolean;
   zone: boolean;
   won: boolean;
   bossHit: boolean;
}
const newEvents = (): PairEvents => ({ laneChange: false, jump: false, land: false, slide: false, crack: false, crackBody: 0, shatter: false, orb: 0, orbBody: 0, secret: false, checkpoint: false, twin: false, power: false, broke: false, bump: false, zone: false, won: false, bossHit: false });

/** A boss obstacle (the panes it throws) or target (a gem to jump through). */
export interface Pane {
   s: number;
   body: 0 | 1;
   lane: -1 | 0 | 1;
}
export interface Target {
   s: number;
   /** 0 = the hero's runway, 1 = the reflection's, 2 = both bodies together (the chest crystal) */
   body: 0 | 1 | 2;
   lane: number;
   done: boolean;
}

export interface Sentinel {
   state: BossState;
   ev: BossEvents;
   active: boolean;
   panes: Pane[];
   target: Target | null;
   /** which runway its shield covers in P2 (0 / 1) */
   shield: 0 | 1;
   cycles: number;
   defeatedAtS: number;
}

interface Echo {
   at: number;
   kind: "left" | "right" | "jump" | "slide";
   zone: Zone;
}

export interface Pair {
   index: number;
   heroId: M2HeroId;
   s: number;
   speed: number;
   bodies: [Body, Body];
   /** 0 apart .. 1 merged (eased) */
   merge: number;
   zone: Zone;
   cracks: number;
   checkpoint: number;
   slowMs: number;
   graceMs: number;
   freezeMs: number;
   cooldown: number;
   powerMs: number;
   dashMs: number;
   echo: Echo[];
   orbsTaken: Uint8Array;
   broken: Uint8Array;
   orbs: number;
   hits: number;
   shatters: number;
   ended: "win" | "timeup" | null;
   finishMs: number;
   combo: ComboState;
   comboMs: number;
   secrets: SecretTracker;
   boss: Sentinel | null;
   finishS: number;
   ev: PairEvents;
   /** obstacle row last judged for a Twin Perfect (both runways blocked, both clear) */
   twinS: number;
}

export interface World {
   level: LevelId;
   cfg: MirrorLevel;
   course: Course;
   pairs: Pair[];
   ms: number;
   accumulator: number;
   ended: "win" | "timeup" | null;
}

function createPair(level: LevelId, course: Course, index: number, heroId: M2HeroId): Pair {
   const boss = LEVELS[level].boss;
   return {
      index,
      heroId,
      s: 0,
      speed: LEVELS[level].speed[0],
      bodies: [
         { lane: 0, off: 0, y: 0, vy: 0, slideMs: 0, airJumped: false },
         { lane: 0, off: 0, y: 0, vy: 0, slideMs: 0, airJumped: false },
      ],
      merge: 0,
      zone: "mirror",
      cracks: 0,
      checkpoint: 0,
      slowMs: 0,
      graceMs: 0,
      freezeMs: 0,
      cooldown: 0,
      powerMs: 0,
      dashMs: 0,
      echo: [],
      orbsTaken: new Uint8Array(course.orbs.length),
      broken: new Uint8Array(course.obstacles.length),
      orbs: 0,
      hits: 0,
      shatters: 0,
      ended: null,
      finishMs: 0,
      combo: createCombo(),
      comboMs: 0,
      secrets: createSecretTracker(SECRETS),
      boss: boss ? { state: createBoss(SENTINEL), ev: createBossEvents(), active: false, panes: [], target: null, shield: 0, cycles: 0, defeatedAtS: -1 } : null,
      finishS: boss ? Infinity : course.endS,
      ev: newEvents(),
      twinS: -1,
   };
}

export function createWorld(level: LevelId = 1, heroIds: readonly M2HeroId[] = ["vexa"]): World {
   const course = parseCourse(level);
   return { level, cfg: LEVELS[level], course, pairs: heroIds.slice(0, 4).map((id, i) => createPair(level, course, i, id)), ms: 0, accumulator: 0, ended: null };
}
export const createRun = (level: LevelId = 1, heroId: M2HeroId = "vexa") => createWorld(level, [heroId]);

// ---------- geometry ----------

/** World x of a body: its runway's centre (closer in a merge) plus its lane offset. */
export function bodyX(p: Pair, k: 0 | 1): number {
   const c = CENTRE.apart + (CENTRE.merged - CENTRE.apart) * p.merge;
   return (k === 0 ? -c : c) + p.bodies[k].off * LANE_W;
}
export const laneX = (p: Pair, k: 0 | 1, lane: number) => {
   const c = CENTRE.apart + (CENTRE.merged - CENTRE.apart) * p.merge;
   return (k === 0 ? -c : c) + lane * LANE_W;
};

export function baseSpeed(w: World, s: number): number {
   const [a, b] = w.cfg.speed;
   const k = Math.max(0, Math.min(1, s / Math.max(1, w.course.endS)));
   return a + (b - a) * k;
}

// ---------- input ----------

function applyMove(p: Pair, k: 0 | 1, kind: Echo["kind"], dir: number) {
   const b = p.bodies[k];
   if (kind === "left" || kind === "right") {
      const next = Math.max(-1, Math.min(1, b.lane + dir));
      if (next !== b.lane) {
         b.lane = next;
         p.ev.laneChange = true;
      }
   } else if (kind === "jump") {
      if (b.y <= 0.001 && b.vy <= 0) {
         b.vy = JUMP_V;
         b.slideMs = 0;
         p.ev.jump = true;
      } else if (p.heroId === "nami" && !b.airJumped) {
         b.vy = JUMP_V;
         b.airJumped = true;
         p.ev.jump = true;
      }
   } else if (kind === "slide") {
      if (b.y <= 0.001) {
         b.slideMs = SLIDE_MS;
         p.ev.slide = true;
      } else b.vy = Math.min(b.vy, -JUMP_V); // a slide in the air drops you
   }
}

/** One press: the hero moves now; the reflection mirrors it (copies it in frost, later in echo). */
function press(p: Pair, w: World, kind: Echo["kind"]) {
   const dir = kind === "left" ? -1 : kind === "right" ? 1 : 0;
   applyMove(p, 0, kind, dir);
   if (p.zone === "echo") {
      p.echo.push({ at: w.ms + ECHO_MS, kind, zone: "mirror" });
      return;
   }
   applyMove(p, 1, kind, p.zone === "frost" ? dir : -dir);
}

function power(p: Pair) {
   if (p.cooldown > 0 || p.heroId === "nami") return;
   p.ev.power = true;
   p.cooldown = POWER_COOLDOWN_MS[p.heroId];
   if (p.heroId === "riko") p.dashMs = DASH.ms;
   else p.powerMs = POWER_MS[p.heroId];
}

// ---------- the step ----------

/** index of the first item with s >= x (items sorted by s) */
function lowerBound(items: readonly { s: number }[], x: number): number {
   let lo = 0;
   let hi = items.length;
   while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (items[mid].s < x) lo = mid + 1;
      else hi = mid;
   }
   return lo;
}

const shielded = (p: Pair) => (p.heroId === "kiro" && p.powerMs > 0) || p.graceMs > 0;
const phased = (p: Pair) => p.heroId === "vexa" && p.powerMs > 0;

function passes(p: Pair, k: 0 | 1, kind: ObstacleKind): boolean {
   const b = p.bodies[k];
   if (phased(p)) return true;
   switch (kind) {
      case "L":
         return b.y > 0.45 || (p.heroId === "kiro" && p.powerMs > 0);
      case "H":
         return b.slideMs > 0 || (p.heroId === "kiro" && p.powerMs > 0);
      case "G":
         return false;
      case "Z":
      case "B":
      case "C":
         return p.heroId === "kiro" && p.powerMs > 0;
   }
}

function crack(w: World, p: Pair, body: number) {
   if (shielded(p) || p.freezeMs > 0) return;
   p.cracks++;
   p.hits++;
   p.slowMs = SLOW.ms;
   p.graceMs = GRACE_MS;
   p.ev.crack = true;
   p.ev.crackBody = body;
   comboBreak(p.combo);
   if (p.cracks >= CRACKS) {
      // shattered: back to the last checkpoint, whole again
      p.shatters++;
      p.ev.shatter = true;
      p.cracks = 0;
      p.s = p.checkpoint;
      p.freezeMs = SHATTER_MS;
      p.echo.length = 0;
      for (const b of p.bodies) Object.assign(b, { lane: 0, off: 0, y: 0, vy: 0, slideMs: 0, airJumped: false });
      if (p.boss) {
         p.boss.panes.length = 0;
         if (p.boss.target) p.boss.target.s = p.s + ARENA.ahead;
      }
   }
   void w;
}

function award(w: World, p: Pair, base: number) {
   p.comboMs += comboHit(p.combo, COMBO, w.ms, base);
}

function stepPair(w: World, p: Pair, input: StepInput, first: boolean, dt: number) {
   const ms = dt * 1000;
   p.cooldown = Math.max(0, p.cooldown - ms);
   p.powerMs = Math.max(0, p.powerMs - ms);
   p.dashMs = Math.max(0, p.dashMs - ms);
   p.slowMs = Math.max(0, p.slowMs - ms);
   p.graceMs = Math.max(0, p.graceMs - ms);
   comboTick(p.combo, COMBO, w.ms);
   if (p.ended) return;
   if (p.freezeMs > 0) {
      p.freezeMs = Math.max(0, p.freezeMs - ms);
      return;
   }
   const c = w.course;
   const zone = p.boss && p.boss.active ? (p.boss.state.phase === 2 ? "merge" : "mirror") : zoneAt(c, p.s);
   if (zone !== p.zone) {
      p.zone = zone;
      p.ev.zone = true;
   }
   // presses (one-frame flags: only on the first quantum of a frame)
   if (first) {
      if (input.left) press(p, w, "left");
      if (input.right) press(p, w, "right");
      if (input.jump) press(p, w, "jump");
      if (input.slide) press(p, w, "slide");
      if (input.action) power(p);
   }
   while (p.echo.length && p.echo[0].at <= w.ms) {
      const e = p.echo.shift()!;
      applyMove(p, 1, e.kind, e.kind === "left" ? 1 : e.kind === "right" ? -1 : 0);
   }
   // bodies: lanes ease, jumps arc, slides run out
   for (const b of p.bodies) {
      const d = b.lane - b.off;
      b.off += Math.sign(d) * Math.min(Math.abs(d), LANE_RATE * dt);
      if (b.y > 0 || b.vy > 0) {
         b.vy -= GRAVITY * dt;
         b.y += b.vy * dt;
         if (b.y <= 0) {
            b.y = 0;
            b.vy = 0;
            b.airJumped = false;
            p.ev.land = true;
         }
      }
      b.slideMs = Math.max(0, b.slideMs - ms);
   }
   const mergeWant = p.zone === "merge" ? 1 : 0;
   p.merge += Math.sign(mergeWant - p.merge) * Math.min(Math.abs(mergeWant - p.merge), dt * 2.2);
   // forward
   p.speed = baseSpeed(w, Math.min(p.s, c.endS)) * (p.slowMs > 0 ? SLOW.factor : 1) * (p.dashMs > 0 ? DASH.factor : 1);
   const s0 = p.s;
   p.s += p.speed * dt;
   const s1 = p.s;
   // obstacles crossed this quantum (each is 1 m deep)
   const crossing = (s: number) => s1 + 0.5 >= s && s0 + 0.5 < s + 1;
   let blockedRow = -1;
   for (let i = lowerBound(c.obstacles, s0 - 1.5); i < c.obstacles.length; i++) {
      const o = c.obstacles[i];
      if (o.s > s1 + 1) break;
      if (!crossing(o.s) || p.broken[i]) continue;
      const b = p.bodies[o.body];
      if (Math.abs(b.off - o.lane) >= 0.55) continue;
      if (o.kind === "C" && p.dashMs > 0) {
         p.broken[i] = 1;
         p.ev.broke = true;
         continue;
      }
      if (!passes(p, o.body, o.kind)) {
         crack(w, p, o.body);
         if (p.ev.shatter) return;
      } else blockedRow = o.s;
   }
   // a Twin Perfect: a row with obstacles on both runways, cleared by one input with no crack
   if (blockedRow >= 0 && blockedRow !== p.twinS && !p.ev.crack && p.graceMs === 0) {
      const both = c.obstacles.slice(lowerBound(c.obstacles, blockedRow), lowerBound(c.obstacles, blockedRow + 0.01));
      if (both.some((o) => o.body === 0) && both.some((o) => o.body === 1)) {
         p.twinS = blockedRow;
         p.ev.twin = true;
         award(w, p, COMBO_BASE_MS.twin);
      }
   }
   // merged road: the bodies must not meet
   if (p.merge > 0.8 && Math.abs(bodyX(p, 0) - bodyX(p, 1)) < 0.9 && Math.abs(p.bodies[0].y - p.bodies[1].y) < 0.8 && !phased(p)) {
      if (p.graceMs === 0 && !shielded(p)) p.ev.bump = true;
      crack(w, p, 1);
      if (p.ev.shatter) return;
   }
   // orbs (Zuno's magnet: both runways, two lanes either side, 9 m ahead) and secrets
   const magnet = p.heroId === "zuno" && p.powerMs > 0;
   for (let i = lowerBound(c.orbs, s0 - 2); i < c.orbs.length; i++) {
      const o = c.orbs[i];
      if (o.s > s1 + MAGNET.ahead + 1) break;
      if (p.orbsTaken[i]) continue;
      const b = p.bodies[o.body];
      const near = magnet ? o.s >= s0 - 1 && o.s <= s1 + MAGNET.ahead && Math.abs(b.off - o.lane) <= MAGNET.lanes : crossing(o.s) && Math.abs(b.off - o.lane) < 0.6 && Math.abs(b.y + 0.6 - o.y) < 0.85;
      if (!near) continue;
      p.orbsTaken[i] = 1;
      p.orbs++;
      p.ev.orb++;
      p.ev.orbBody = o.body;
      award(w, p, COMBO_BASE_MS.orb);
   }
   for (const x of c.secrets) {
      const b = p.bodies[x.body];
      if (crossing(x.s) && Math.abs(b.off - x.lane) < 0.6 && collectSecret(p.secrets, x.secret)) p.ev.secret = true;
   }
   // checkpoints: the cracks heal
   for (const cp of c.checkpoints) {
      if (cp > p.checkpoint && s0 < cp && s1 >= cp) {
         p.checkpoint = cp;
         p.cracks = 0;
         p.ev.checkpoint = true;
      }
   }
   if (p.boss) stepSentinel(w, p, s0, s1, dt);
   if (p.s >= p.finishS && !p.ended) {
      p.ended = "win";
      p.finishMs = w.ms;
      p.ev.won = true;
   }
}

// ---------- the Glass Sentinel ----------

/** a deterministic lane pattern for the n-th pane barrage / gem */
const PATTERN = [1, -1, 0, -1, 1, 0, 1, 0, -1];

function stepSentinel(w: World, p: Pair, s0: number, s1: number, dt: number) {
   const g = p.boss!;
   if (!g.active) {
      if (p.s < w.course.endS) return;
      g.active = true;
      p.checkpoint = w.course.endS;
   }
   for (const k of Object.keys(g.ev) as (keyof BossEvents)[]) g.ev[k] = false;
   const before = g.state.step;
   stepBoss(g.state, SENTINEL, dt * 1000, g.ev);
   const step = g.state.step;
   if (g.state.hp === 0 && g.defeatedAtS < 0) {
      g.defeatedAtS = p.s;
      p.finishS = p.s + ARENA.exit;
      g.target = null;
      g.panes.length = 0;
   }
   if (step !== before) {
      const n = g.cycles;
      if (step === "attack" && g.state.phase === 0) {
         // a barrage: two panes per runway at mirrored lanes, one lane left open
         const open = PATTERN[n % PATTERN.length];
         for (const lane of [-1, 0, 1] as const) {
            if (lane === open) continue;
            g.panes.push({ s: p.s + ARENA.ahead, body: 0, lane }, { s: p.s + ARENA.ahead, body: 1, lane: -lane as -1 | 0 | 1 });
         }
      }
      if (step === "attack" && g.state.phase === 1) g.shield = (n % 2) as 0 | 1;
      if (step === "vulnerable") {
         const ph = g.state.phase;
         if (ph === 0) g.target = { s: p.s + ARENA.ahead, body: 0, lane: 0, done: false };
         else if (ph === 1) g.target = { s: p.s + ARENA.ahead, body: (1 - g.shield) as 0 | 1, lane: PATTERN[(n + 2) % PATTERN.length], done: false };
         else g.target = { s: p.s + ARENA.ahead, body: 2, lane: 0, done: false };
         g.cycles++;
      }
      if (step !== "vulnerable" && g.target && !g.target.done) g.target = null;
   }
   // panes crash on the runways: dodge them like blocks
   for (let i = g.panes.length - 1; i >= 0; i--) {
      const pn = g.panes[i];
      if (pn.s < s0 - 2) {
         g.panes.splice(i, 1);
         continue;
      }
      if (s1 + 0.5 >= pn.s && s0 + 0.5 < pn.s + 1 && Math.abs(p.bodies[pn.body].off - pn.lane) < 0.55 && !phased(p)) {
         crack(w, p, pn.body);
         if (p.ev.shatter) return;
      }
   }
   // the gem / crystal: jump through it as it passes
   const t = g.target;
   if (t && !t.done && s1 + 0.5 >= t.s && s0 + 0.5 < t.s + 1.5) {
      const ok =
         t.body === 2
            ? p.bodies[0].y > 0.5 && p.bodies[1].y > 0.5
            : p.bodies[t.body].y > 0.5 && Math.abs(p.bodies[t.body].off - t.lane) < ARENA.laneTol;
      if (ok) {
         t.done = true;
         const res = hitBoss(g.state, SENTINEL, 1, g.ev);
         if (res !== "ignored") {
            p.ev.bossHit = true;
            award(w, p, COMBO_BASE_MS.boss);
         }
      }
   }
   // a missed gem drifts back ahead while the window is still open
   if (t && !t.done && t.s < s0 - 2 && step === "vulnerable") t.s = p.s + ARENA.ahead * 0.7;
}

// ---------- the world step ----------

const latches = new WeakMap<Pair, StepInput>();

export function stepWorld(w: World, dtMs: number, inputs: readonly StepInput[]) {
   for (const p of w.pairs) {
      const e = p.ev as unknown as Record<string, number | boolean>;
      for (const k of Object.keys(e)) e[k] = typeof e[k] === "number" ? 0 : false;
   }
   if (w.ended || !Number.isFinite(dtMs) || dtMs <= 0) return;
   // presses are latched until the next quantum runs (a short frame never drops one)
   w.pairs.forEach((p, k) => {
      const i = inputs[k];
      let l = latches.get(p);
      if (!l) latches.set(p, (l = idleInput()));
      if (!i) return;
      l.left ||= !!i.left;
      l.right ||= !!i.right;
      l.jump ||= !!i.jump;
      l.slide ||= !!i.slide;
      l.action ||= !!i.action;
   });
   w.accumulator += Math.min(250, dtMs);
   while (w.accumulator >= FIXED_MS && !w.ended) {
      w.accumulator -= FIXED_MS;
      w.ms += FIXED_MS;
      if (w.ms >= w.cfg.durationMs) {
         w.ended = "timeup";
         for (const p of w.pairs) if (!p.ended) p.ended = "timeup";
         break;
      }
      for (const p of w.pairs) {
         const l = latches.get(p) ?? idleInput();
         stepPair(w, p, l, true, FIXED_MS / 1000);
         Object.assign(l, idleInput());
      }
      if (w.pairs.every((p) => p.ended)) w.ended = w.pairs.some((p) => p.ended === "win") ? "win" : "timeup";
   }
}

export function step(w: World, dtMs: number, input: StepInput) {
   stepWorld(w, dtMs, [input]);
}

// ---------- scoring ----------

export const runTimeMs = (finishMs: number, orbs: number, comboMs = 0) => Math.max(0, Math.round(finishMs - orbs * ORB_BONUS_MS - comboMs));
export const submittedMs = (p: Pair) => runTimeMs(p.finishMs, p.orbs, p.comboMs);
export const orbTotal = (level: LevelId) => parseCourse(level).orbs.length;

export function comboSpecOf(level: LevelId): ComboLevelSpec {
   const c = parseCourse(level);
   const rows = new Set(c.obstacles.map((o) => o.s));
   const boss = LEVELS[level].boss;
   return { combo: COMBO, sources: [{ count: c.orbs.length, base: COMBO_BASE_MS.orb }, { count: rows.size, base: COMBO_BASE_MS.twin }, { count: boss ? SENTINEL.maxHp : 0, base: COMBO_BASE_MS.boss }] };
}

/** The earliest rules ms the Sentinel can be down once it wakes: every vulnerable window hit at its first ms. */
export function bossMinMs(): number {
   const s = createBoss(SENTINEL);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(s, SENTINEL, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, SENTINEL, 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

/**
 * The least finish ms: the course run at V_MAX (the top course speed with a dash on, faster than any
 * pair ever moves), and on L5 the Sentinel's fastest defeat plus the exit run at V_MAX.
 */
export function minFinishMs(level: LevelId): number {
   const c = parseCourse(level);
   let ms = (c.endS / V_MAX) * 1000;
   if (LEVELS[level].boss) ms += bossMinMs() + (ARENA.exit / V_MAX) * 1000;
   return Math.floor(ms);
}

export function minDurationMsOf(level: LevelId): number {
   return Math.max(0, minFinishMs(level) - orbTotal(level) * ORB_BONUS_MS - comboMaxBonus(comboSpecOf(level)));
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

export function proposeLimits(id: LevelId): LevelLimits {
   const lb = minDurationMsOf(id);
   const minDurationMs = Math.max(100, Math.floor(lb / 100) * 100);
   const timeBaseMs = LEVELS[id].durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = { 1: proposeLimits(1), 2: proposeLimits(2), 3: proposeLimits(3), 4: proposeLimits(4), 5: proposeLimits(5) };

export const STAT = {
   orbs: "orbs",
   finishMs: "finishMs",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   cracks: "cracks",
   progress: "progress",
   zone: "zone",
   power: "power",
   hits: "hits",
   coach: "coach",
   boss: "boss",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   bossShield: "bossShield",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   flawless: "flawless",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

export const ZONE_CODE: Record<Zone, number> = { mirror: 0, merge: 1, frost: 2, echo: 3 };

export function finalScore(s: { score: number; endReason: string | null; stats: Record<string, number>; elapsedMs: number }): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}
