// Disc Target Throw rules (the design card's THROW, BANK, CATCH): the hero stands in a ruin courtyard
// and throws a returning training disc. Hold Throw (Space / the Throw button) to aim along the camera's
// view (the orbit camera turns the aim), push the stick sideways to set a hook (up to a 35 deg bend), and
// let go to throw. The disc flies 18 m at 15 m/s; stone (the walls and the columns) banks it with a
// reflection and a 15 % speed loss, up to three banks; wood (the palisade) stops it. After 18 m, a
// fourth stone contact, wood or its third hit it swings back on a boomerang arc to the spot it was
// thrown from, 1 s later. Be there: within 0.6 m is a clean catch (the combo), within 1.6 m a catch, and
// a miss drops the disc there for 1.5 s.
// Targets score their base times the banks before the hit (x1, x2, x3); a throw can hit three things.
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now. The Scene passes the stick
// and the orbit camera's yaw (StepInput.yaw); tests and bot.ts drive it with their own yaw.
//
// Clock: whole ms, the fraction carried, stepped 1 ms at a time: the same at 30, 60 or 144 fps.
// README "Rules" and "Server limits" explain the design and the proof; rules.test.ts checks them.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld, rngNext } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DASH_REACH, DEFAULT_HERO, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { YARD, courseFor, buildCourse, monkeyPos, raftX, targetPos, type Course, type TargetDef } from "./course";
import { COMBO, SECRETS, SNAPPER } from "./progression";

export { courseFor, buildCourse } from "./course";
export type { Course, TargetDef } from "./course";

// ---------- tuning (1 unit = 1 m, up is +y, the courtyard floor at y = 0) ----------

export const NONE = -1;
export const MAX_STEP_MS = 50;
/** the disc (the card) */
export const DISC = {
   speed: 15,
   /** outbound path length (m) */
   range: 18,
   /** speed kept after a bank */
   keep: 0.85,
   banks: 3,
   /** things one throw can hit (targets, orbs, posts, monkeys, pods, the boss) */
   hits: 3,
   r: 0.25,
   /** the flight height and a lob's peak (Nami: over the palisade) */
   y: 1.1,
   lobY: 2.3,
   /** the hook: up to 35 deg over the outbound flight (18 m at 15 m/s = 1.2 s) */
   hookRate: (35 * Math.PI) / 180 / 1.2,
   /** the boomerang arc back to the throw spot */
   returnMs: 1000,
   returnRise: 1.6,
   arc: 5,
} as const;
/** hold Throw at least this long before letting go (a tap does not throw) */
export const HOLD_MS = 150;
/** the catch (the card): clean within 0.6 m keeps the combo, 1.6 m is a catch, else a 1.5 s fetch */
export const CATCH = { clean: 0.6, reach: 1.6, fetchMs: 1500 } as const;
/** the hero on foot */
export const HERO_R = 0.4;
export const V_WALK = 6;
export const ACCEL = 40;
/** a thorn burst or a volley stuns this long; then a short grace */
export const STUN_MS = 700;
export const INVULN_MS = 900;
/** the palisade's top: a lob above it passes */
export const PALISADE_TOP = 1.8;
/** targets stand this tall (a disc lower than this hits them) */
export const TARGET_TOP = 1.9;
/** monkeys (L4): stunned this long by a disc, snatch a returning disc within this */
export const MONKEY = { stunMs: 6000, snatch: 1.4, r: 0.6 } as const;
/** Mother Snapper's seed pods (L5) and the volley lane's half-width */
export const POD = { r: 0.6, regrowMs: 5000 } as const;
export const LANE_HALF = 1.0;

/** Points (README "Scoring"). */
export const PTS = { catch: 50, triple: 300, monkey: 200, bossHit: 400, defeat: 2000 } as const;
/** The speed bonus: points per second cleared under par. */
export const TIME_PTS = 20;

/** The bank multiplier (the card: x1 / x2 / x3). */
export function bankMult(banks: number): number {
   return banks <= 0 ? 1 : banks === 1 ? 2 : 3;
}

// ---------- the run ----------

export type DiscMode = "hand" | "out" | "back" | "ground";

export interface Disc {
   mode: DiscMode;
   x: number;
   y: number;
   z: number;
   vx: number;
   vz: number;
   /** current speed (m/s) and the hook's turn rate (rad/s) */
   speed: number;
   turn: number;
   travelled: number;
   banks: number;
   hits: number;
   lob: boolean;
   phase: boolean;
   /** where it was thrown from (the return point) */
   fromX: number;
   fromZ: number;
   /** the return arc: start, control point and its clock */
   p0x: number;
   p0z: number;
   p1x: number;
   p1z: number;
   backMs: number;
   /** a dropped disc is back in the hand at this ms */
   groundUntil: number;
   /** this throw scored (a catch pays only then), its colour run (L3) and its triple */
   scored: boolean;
   colourRun: number;
   tripled: boolean;
   /** the spin angle (visual) */
   spin: number;
}

export interface Hero {
   x: number;
   z: number;
   vx: number;
   vz: number;
   facing: number;
   stunUntil: number;
   invulnUntil: number;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   shieldUntil: number;
   magnetUntil: number;
   /** the next throw is a lob (Nami) or phases the ghost walls (Vexa) */
   lobArmed: boolean;
   phaseArmed: boolean;
}

export interface StepInput {
   moveX: number;
   moveZ: number;
   /** the orbit camera's drawn yaw (menu2/camera): the stick turns with it, the aim is its view */
   yaw: number;
   /** Throw held (aim) and released (throw) */
   throwHeld: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, throwHeld: false, actionPressed: false };
}

export interface StepEvents {
   thrown: boolean;
   banked: number;
   /** wood or a ghost wall stopped the disc */
   thunk: boolean;
   targetList: number[];
   targetPts: number[];
   targetCount: number;
   monkeyHit: number;
   snatched: boolean;
   podPopped: number;
   returning: boolean;
   caught: "clean" | "catch" | null;
   dropped: boolean;
   fetched: boolean;
   triple: boolean;
   powered: boolean;
   hurt: boolean;
   secretList: number[];
   secretCount: number;
   comboLinked: boolean;
   comboBonus: number;
   finished: boolean;
   timeup: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   bossDeflect: boolean;
}

function createEvents(): StepEvents {
   return {
      thrown: false,
      banked: 0,
      thunk: false,
      targetList: [],
      targetPts: [],
      targetCount: 0,
      monkeyHit: NONE,
      snatched: false,
      podPopped: NONE,
      returning: false,
      caught: null,
      dropped: false,
      fetched: false,
      triple: false,
      powered: false,
      hurt: false,
      secretList: [],
      secretCount: 0,
      comboLinked: false,
      comboBonus: 0,
      finished: false,
      timeup: false,
      bossTelegraph: false,
      bossAttack: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
      bossDeflect: false,
   };
}

function clearEvents(ev: StepEvents): void {
   ev.thrown = false;
   ev.banked = 0;
   ev.thunk = false;
   ev.targetCount = 0;
   ev.monkeyHit = NONE;
   ev.snatched = false;
   ev.podPopped = NONE;
   ev.returning = false;
   ev.caught = null;
   ev.dropped = false;
   ev.fetched = false;
   ev.triple = false;
   ev.powered = false;
   ev.hurt = false;
   ev.secretCount = 0;
   ev.comboLinked = false;
   ev.comboBonus = 0;
   ev.finished = false;
   ev.timeup = false;
   ev.bossTelegraph = false;
   ev.bossAttack = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
   ev.bossDeflect = false;
}

export interface DiscRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   rng: { s: number };
   simMs: number;
   carry: number;
   hero: Hero;
   disc: Disc;
   ended: "win" | "timeup" | null;
   finishMs: number;
   score: number;
   /** per target: hit (shared between multiplayer runs: the first to hit takes it) */
   hit: Uint8Array;
   /** per monkey: stunned until (ms), paid once */
   monkeyStun: Float64Array;
   monkeyPaid: Uint8Array;
   /** level 5: the pods (popped), their regrow clock */
   podGone: Uint8Array;
   podsRegrowAt: number;
   /** throw aim state: Throw held since (ms, -1 when not held) and the hook it holds */
   aimSince: number;
   hook: number;
   throws: number;
   required: number;
   orbs: number;
   posts: number;
   /** clean catches, catches, drops */
   cleans: number;
   catches: number;
   drops: number;
   hits: number;
   /** L3: the colour that pays double next (0 green, 1 gold, 2 jade) */
   nextColour: number;
   combo: ComboState;
   secrets: SecretTracker;
   powerReadyAt: number;
   timeBonus: number;
   parts: { targets: number; catches: number; flow: number; boss: number; triples: number; monkeys: number; time: number };
   boss: BossState | null;
   bossEv: BossEvents;
   /** the volley's lane heading (L5 phase 3), set on its telegraph */
   lane: number;
   events: StepEvents;
}

function freshHero(c: Course): Hero {
   return {
      x: c.startX,
      z: c.startZ,
      vx: 0,
      vz: 0,
      facing: Math.PI,
      stunUntil: NONE,
      invulnUntil: NONE,
      dashUntil: NONE,
      dashX: 0,
      dashZ: -1,
      shieldUntil: NONE,
      magnetUntil: NONE,
      lobArmed: false,
      phaseArmed: false,
   };
}

function freshDisc(): Disc {
   return {
      mode: "hand",
      x: 0,
      y: DISC.y,
      z: 0,
      vx: 0,
      vz: 0,
      speed: 0,
      turn: 0,
      travelled: 0,
      banks: 0,
      hits: 0,
      lob: false,
      phase: false,
      fromX: 0,
      fromZ: 0,
      p0x: 0,
      p0z: 0,
      p1x: 0,
      p1z: 0,
      backMs: 0,
      groundUntil: 0,
      scored: false,
      colourRun: 0,
      tripled: false,
      spin: 0,
   };
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO, course: Course = courseFor(level)): DiscRun {
   return {
      course,
      level,
      heroId,
      seed,
      rng: { s: (seed >>> 0) || 1 },
      simMs: 0,
      carry: 0,
      hero: freshHero(course),
      disc: freshDisc(),
      ended: null,
      finishMs: 0,
      score: 0,
      hit: new Uint8Array(course.targets.length),
      monkeyStun: new Float64Array(course.monkeys.length),
      monkeyPaid: new Uint8Array(course.monkeys.length),
      podGone: new Uint8Array(course.boss ? course.boss.pods.length : 0),
      podsRegrowAt: NONE,
      aimSince: NONE,
      hook: 0,
      throws: 0,
      required: 0,
      orbs: 0,
      posts: 0,
      cleans: 0,
      catches: 0,
      drops: 0,
      hits: 0,
      nextColour: 0,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      powerReadyAt: 0,
      timeBonus: 0,
      parts: { targets: 0, catches: 0, flow: 0, boss: 0, triples: 0, monkeys: 0, time: 0 },
      boss: course.boss ? createBoss(SNAPPER) : null,
      bossEv: createBossEvents(),
      lane: 0,
      events: createEvents(),
   };
}

// ---------- the disc's flight (shared with bot.ts: the same physics, no score) ----------

/** What one ms of flight met (DiscContact.none: open air). */
export const CONTACT = { none: 0, bank: 1, stop: 2, boss: 3, bossOpen: 4 } as const;

/** Is (x, z) inside the box widened by r? */
function inBox(x: number, z: number, b: Course["boxes"][number], r: number): boolean {
   return x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r;
}

/** The disc's height along the outbound flight (a lob rises over the palisade and comes down behind it). */
export function discY(d: Pick<Disc, "lob" | "travelled">): number {
   if (!d.lob) return DISC.y;
   const s = d.travelled / DISC.range;
   if (s >= 0.85) return DISC.y;
   return DISC.y + (DISC.lobY - DISC.y) * Math.sin((Math.min(1, s / 0.85) * Math.PI));
}

/**
 * One ms of outbound flight for disc `d` (moves, hooks, banks off stone, stops on wood): the physics
 * only. Returns a CONTACT code. `bossOpen` says whether Mother Snapper's open mouth swallows the disc
 * (a hit for the caller) instead of plating it away.
 */
export function flyMs(c: Course, d: Disc, rng: { s: number } | null, bossOpen: boolean): number {
   const dt = 0.001;
   const a = d.turn * dt;
   if (a !== 0) {
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      const vx = d.vx * cs + d.vz * sn;
      const vz = -d.vx * sn + d.vz * cs;
      d.vx = vx;
      d.vz = vz;
   }
   d.x += d.vx * dt;
   d.z += d.vz * dt;
   d.travelled += d.speed * dt;
   d.y = discY(d);
   const r = DISC.r;
   for (const b of c.boxes) {
      if (!inBox(d.x, d.z, b, r)) continue;
      if (b.kind === "wood" && d.y > PALISADE_TOP) continue;
      if (b.kind === "ghost" && d.phase) continue;
      if (b.kind !== "stone") return CONTACT.stop;
      const px = Math.min(d.x - (b.minX - r), b.maxX + r - d.x);
      const pz = Math.min(d.z - (b.minZ - r), b.maxZ + r - d.z);
      if (px < pz) {
         d.x = d.x - (b.minX - r) < b.maxX + r - d.x ? b.minX - r : b.maxX + r;
         d.vx = -d.vx;
      } else {
         d.z = d.z - (b.minZ - r) < b.maxZ + r - d.z ? b.minZ - r : b.maxZ + r;
         d.vz = -d.vz;
      }
      return CONTACT.bank;
   }
   for (const col of c.columns) {
      const dx = d.x - col.x;
      const dz = d.z - col.z;
      const rr = col.r + r;
      const dd = dx * dx + dz * dz;
      if (dd >= rr * rr) continue;
      const len = Math.sqrt(dd) || 1;
      const nx = dx / len;
      const nz = dz / len;
      const dot = d.vx * nx + d.vz * nz;
      if (dot < 0) {
         d.vx -= 2 * dot * nx;
         d.vz -= 2 * dot * nz;
      }
      d.x = col.x + nx * rr;
      d.z = col.z + nz * rr;
      return CONTACT.bank;
   }
   const boss = c.boss;
   if (boss) {
      const dx = d.x - boss.x;
      const dz = d.z - boss.z;
      const rr = boss.r + r;
      const dd = dx * dx + dz * dz;
      if (dd < rr * rr) {
         if (bossOpen) return CONTACT.bossOpen;
         const len = Math.sqrt(dd) || 1;
         let nx = dx / len;
         let nz = dz / len;
         // the plated mouth kicks the disc away at a seeded angle (the card: "reflects the disc randomly")
         if (rng) {
            const j = (rngNext(rng) - 0.5) * 0.9;
            const cs = Math.cos(j);
            const sn = Math.sin(j);
            const ux = nx * cs - nz * sn;
            nz = nx * sn + nz * cs;
            nx = ux;
         }
         const dot = d.vx * nx + d.vz * nz;
         if (dot < 0) {
            d.vx -= 2 * dot * nx;
            d.vz -= 2 * dot * nz;
         }
         d.x = boss.x + (dx / len) * rr;
         d.z = boss.z + (dz / len) * rr;
         return CONTACT.boss;
      }
   }
   return CONTACT.none;
}

/** After a bank: the speed loss (velocity rescaled to the new speed). */
export function bankSlow(d: Disc): void {
   const v = Math.hypot(d.vx, d.vz) || 1;
   d.speed *= DISC.keep;
   d.vx = (d.vx / v) * d.speed;
   d.vz = (d.vz / v) * d.speed;
}

/** Starts disc `d` flying from (x, z) along `heading` (rad, the card's aim) with a hook in -1..1. */
export function launchDisc(d: Disc, x: number, z: number, heading: number, hook: number, lob: boolean, phase: boolean): void {
   d.mode = "out";
   d.x = x + Math.sin(heading) * 0.6;
   d.z = z + Math.cos(heading) * 0.6;
   d.y = DISC.y;
   d.speed = DISC.speed;
   d.vx = Math.sin(heading) * DISC.speed;
   d.vz = Math.cos(heading) * DISC.speed;
   d.turn = -Math.max(-1, Math.min(1, hook)) * DISC.hookRate;
   d.travelled = 0;
   d.banks = 0;
   d.hits = 0;
   d.lob = lob;
   d.phase = phase;
   d.fromX = x;
   d.fromZ = z;
   d.scored = false;
   d.colourRun = 0;
   d.tripled = false;
}

const TP = { x: 0, z: 0 };

/** The first target (not in `taken`) the disc at (x, y, z) overlaps at rules ms `ms`, or NONE. */
export function targetAt(c: Course, taken: Uint8Array, x: number, y: number, z: number, ms: number): number {
   if (y > TARGET_TOP + 0.1) return NONE;
   for (let i = 0; i < c.targets.length; i++) {
      if (taken[i]) continue;
      const t = c.targets[i];
      targetPos(t, ms, TP);
      const rr = t.r + DISC.r;
      const dx = x - TP.x;
      const dz = z - TP.z;
      if (dx * dx + dz * dz <= rr * rr) return i;
   }
   return NONE;
}

// ---------- the boss (level 5) ----------

/** Is Mother Snapper's mouth / crown open to a hit right now (the step and the phase's own rule)? */
export function bossVulnerable(run: Pick<DiscRun, "boss">): boolean {
   const b = run.boss;
   return !!b && b.step === "vulnerable";
}

/** The earliest rules ms Mother Snapper can be down: every window hit at its first ms. */
export function bossMinMs(): number {
   const s = createBoss(SNAPPER);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(s, SNAPPER, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, SNAPPER, 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

const BOSS_MIN_MS = bossMinMs();

// ---------- the bound (README "Server limits and why they hold") ----------

/** The most points one hit on target t can pay: its base at the top bank multiplier, x2 for an idol in colour order. */
export function maxHitPts(c: Course, t: TargetDef): number {
   return t.base * bankMult(DISC.banks) * (c.cfg.colours && t.kind === "idol" ? 2 : 1);
}

/** How many scoring things a level holds (targets, monkeys, boss hits): the most throws that can score. */
export function scoringThings(c: Course): number {
   return c.targets.filter((t) => t.base > 0).length + c.monkeys.length + (c.boss ? SNAPPER.maxHp : 0);
}

/** What the course can feed the flow meter: each scoring hit once at its top value, each scoring throw's clean catch. */
export function comboSpecOf(c: Course): ComboLevelSpec {
   const sources: { count: number; base: number }[] = [];
   for (const t of c.targets) if (t.base > 0) sources.push({ count: 1, base: maxHitPts(c, t) });
   if (c.monkeys.length) sources.push({ count: c.monkeys.length, base: PTS.monkey });
   if (c.boss) sources.push({ count: SNAPPER.maxHp, base: PTS.bossHit });
   sources.push({ count: scoringThings(c), base: PTS.catch });
   return { combo: COMBO, sources };
}

/**
 * The least finish ms. Without the boss: one disc, at most DISC.hits things a throw, so the clear needs
 * at least ceil(required / hits) throws; a throw needs HOLD_MS of aim and the next one waits for the
 * disc to come back (DISC.returnMs) and a new aim, whatever the outbound did (it may end at once).
 * With the boss: its least defeat time (every window hit at its first ms).
 */
export function minFinishMs(c: Course): number {
   if (c.boss) return BOSS_MIN_MS;
   const throws = Math.ceil(c.required / DISC.hits);
   return HOLD_MS + (throws - 1) * (DISC.returnMs + HOLD_MS);
}

/** The speed bonus of a clear at finishMs. */
export function timeBonusFor(c: Course, finishMs: number): number {
   return Math.floor((Math.max(0, c.parMs - finishMs) * TIME_PTS) / 1000);
}

/**
 * The most points any run of the course can make: every target at its top value, every Triple Glyph,
 * a catch bonus for every throw that can score, every monkey, the most flow bonus (menu2/combo
 * comboMaxBonus), every boss hit and the defeat, and the speed bonus at the least finish.
 */
export function maxScoreOf(c: Course): number {
   let targets = 0;
   for (const t of c.targets) targets += maxHitPts(c, t);
   const idols = c.targets.filter((t) => t.kind === "idol").length;
   const triples = c.cfg.colours ? Math.floor(idols / 3) * PTS.triple : 0;
   const catches = scoringThings(c) * PTS.catch;
   const monkeys = c.monkeys.length * PTS.monkey;
   const boss = c.boss ? SNAPPER.maxHp * PTS.bossHit + PTS.defeat : 0;
   const flow = comboMaxBonus(comboSpecOf(c));
   const time = timeBonusFor(c, minFinishMs(c));
   return targets + triples + catches + monkeys + boss + flow + time;
}

export interface LevelLimits {
   kind: "points";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   base: number;
   maxPointsPerSec: number;
}

/**
 * The limits of a level: maxScore is the bound above; minDurationMs the least finish less about 4.5 %,
 * rounded down to 100 ms; maxDurationMs the run clock's cap plus 1 s; base 0 and the rate
 * ceil(maxScore / minDuration): every run is at most maxScore and lasts at least minDuration, so
 * score * 1000 <= rate * duration always holds.
 */
export function proposeLimits(c: Course): LevelLimits {
   const lb = minFinishMs(c);
   let minDurationMs = Math.floor((lb * 0.955) / 100) * 100;
   if (minDurationMs < lb * 0.94) minDurationMs = Math.ceil((lb * 0.94) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb);
   const maxScore = maxScoreOf(c);
   return { kind: "points", maxScore, minDurationMs, maxDurationMs: c.durationMs + 1000, base: 0, maxPointsPerSec: Math.ceil((maxScore * 1000) / minDurationMs) };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(courseFor(1)),
   2: proposeLimits(courseFor(2)),
   3: proposeLimits(courseFor(3)),
   4: proposeLimits(courseFor(4)),
   5: proposeLimits(courseFor(5)),
};

// ---------- the step ----------

const STICK = { x: 0, z: 0 };

/** Advances the run by dtMs (capped at MAX_STEP_MS), 1 ms at a time. Returns the run's events object. */
export function step(run: DiscRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   clearEvents(ev);
   if (run.ended !== null) return ev;
   const total = Math.min(MAX_STEP_MS, Math.max(0, dtMs)) + run.carry;
   const whole = Math.floor(total);
   run.carry = total - whole;
   inputToWorld(input.moveX, input.moveZ, input.yaw, STICK);
   let action = input.actionPressed;
   for (let k = 0; k < whole && run.ended === null; k++) {
      stepMs(run, input, action, ev);
      action = false;
   }
   return ev;
}

function addPoints(run: DiscRun, pts: number): void {
   run.score += pts;
}

function chain(run: DiscRun, base: number, ev: StepEvents): void {
   const bonus = comboHit(run.combo, COMBO, run.simMs, base);
   if (bonus > 0) {
      addPoints(run, bonus);
      run.parts.flow += bonus;
      ev.comboBonus += bonus;
   }
   ev.comboLinked = true;
}

function secret(run: DiscRun, id: string, ev: StepEvents): void {
   const i = SECRETS[run.level].findIndex((s) => s.id === id);
   if (i >= 0 && collectSecret(run.secrets, i)) ev.secretList[ev.secretCount++] = i;
}

function finish(run: DiscRun, ev: StepEvents): void {
   run.ended = "win";
   run.finishMs = run.simMs;
   run.timeBonus = timeBonusFor(run.course, run.finishMs);
   run.parts.time = run.timeBonus;
   addPoints(run, run.timeBonus);
   ev.finished = true;
}

function hurt(run: DiscRun, ev: StepEvents): void {
   const h = run.hero;
   const ms = run.simMs;
   if (ms <= h.shieldUntil || ms <= h.invulnUntil) return;
   h.stunUntil = ms + STUN_MS;
   h.invulnUntil = ms + INVULN_MS;
   h.vx = 0;
   h.vz = 0;
   run.hits += 1;
   run.aimSince = NONE;
   ev.hurt = true;
}

function power(run: DiscRun, ev: StepEvents): void {
   const h = run.hero;
   const ms = run.simMs;
   if (ms < run.powerReadyAt || ms <= h.stunUntil) return;
   const def = heroById(run.heroId);
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
   if (def.power === "dash") {
      const len = Math.hypot(STICK.x, STICK.z);
      h.dashX = len > 0.2 ? STICK.x / len : Math.sin(h.facing);
      h.dashZ = len > 0.2 ? STICK.z / len : Math.cos(h.facing);
      h.dashUntil = ms + POWER_MS.dash;
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else if (def.power === "lob") h.lobArmed = true;
   else if (def.power === "phase") h.phaseArmed = true;
}

function moveHero(run: DiscRun, aiming: boolean): void {
   const h = run.hero;
   const c = run.course;
   const ms = run.simMs;
   const dt = 0.001;
   let wx = 0;
   let wz = 0;
   if (ms > h.stunUntil && !aiming) {
      wx = STICK.x * V_WALK;
      wz = STICK.z * V_WALK;
   }
   if (ms <= h.dashUntil) {
      wx = h.dashX * V_DASH;
      wz = h.dashZ * V_DASH;
   }
   const dvx = wx - h.vx;
   const dvz = wz - h.vz;
   const dv = Math.hypot(dvx, dvz);
   const max = (ms <= h.dashUntil ? 400 : ACCEL) * dt;
   if (dv > max) {
      h.vx += (dvx / dv) * max;
      h.vz += (dvz / dv) * max;
   } else {
      h.vx = wx;
      h.vz = wz;
   }
   let x = h.x + h.vx * dt;
   let z = h.z + h.vz * dt;
   const raft = c.raft;
   if (raft) {
      // the raft carries the hero; he walks on its deck only
      const rx0 = raftX(c, ms - 1);
      const rx1 = raftX(c, ms);
      x += rx1 - rx0;
      x = Math.max(rx1 - raft.half + HERO_R * 0.5, Math.min(rx1 + raft.half - HERO_R * 0.5, x));
      z = Math.max(raft.z - raft.half + HERO_R * 0.5, Math.min(raft.z + raft.half - HERO_R * 0.5, z));
   } else {
      x = Math.max(YARD.minX + HERO_R, Math.min(YARD.maxX - HERO_R, x));
      z = Math.max(YARD.minZ + HERO_R, Math.min(YARD.maxZ - HERO_R, z));
      for (const b of c.boxes) {
         if (!inBox(x, z, b, HERO_R)) continue;
         const px = Math.min(x - (b.minX - HERO_R), b.maxX + HERO_R - x);
         const pz = Math.min(z - (b.minZ - HERO_R), b.maxZ + HERO_R - z);
         if (px < pz) x = x - (b.minX - HERO_R) < b.maxX + HERO_R - x ? b.minX - HERO_R : b.maxX + HERO_R;
         else z = z - (b.minZ - HERO_R) < b.maxZ + HERO_R - z ? b.minZ - HERO_R : b.maxZ + HERO_R;
      }
      const solids = c.boss ? [...c.columns, { x: c.boss.x, z: c.boss.z, r: c.boss.r }] : c.columns;
      for (const col of solids) {
         const dx = x - col.x;
         const dz = z - col.z;
         const rr = col.r + HERO_R;
         const dd = dx * dx + dz * dz;
         if (dd >= rr * rr) continue;
         const len = Math.sqrt(dd) || 1;
         x = col.x + (dx / len) * rr;
         z = col.z + (dz / len) * rr;
      }
   }
   h.x = x;
   h.z = z;
   if (Math.hypot(h.vx, h.vz) > 0.3) h.facing = Math.atan2(h.vx, h.vz);
}

function onTargetHit(run: DiscRun, i: number, ev: StepEvents): void {
   const c = run.course;
   const t = c.targets[i];
   const d = run.disc;
   run.hit[i] = 1;
   d.hits += 1;
   let pts = t.base * bankMult(d.banks);
   if (c.cfg.colours && t.kind === "idol") {
      if (t.colour === run.nextColour) {
         pts *= 2;
         run.nextColour = (run.nextColour + 1) % 3;
         d.colourRun += 1;
         if (d.colourRun >= 3 && !d.tripled) {
            d.tripled = true;
            addPoints(run, PTS.triple);
            run.parts.triples += PTS.triple;
            ev.triple = true;
         }
      } else d.colourRun = 0;
   }
   if (pts > 0) {
      addPoints(run, pts);
      run.parts.targets += pts;
      d.scored = true;
      chain(run, pts, ev);
   }
   if (t.required) run.required += 1;
   if (t.kind === "orb") run.orbs += 1;
   if (t.kind === "post") {
      run.posts += 1;
      if (run.level === 1 && run.posts === c.targets.filter((q) => q.kind === "post").length && run.drops === 0) secret(run, "gold-disc", ev);
   }
   if (t.kind === "shard") secret(run, "shrine", ev);
   ev.targetList[ev.targetCount] = i;
   ev.targetPts[ev.targetCount] = pts;
   ev.targetCount += 1;
   if (d.banks >= 3 && d.hits >= 3) secret(run, "trick-shot", ev);
}

function bossHit(run: DiscRun, ev: StepEvents): boolean {
   const b = run.boss;
   if (!b || b.step !== "vulnerable") return false;
   const r = hitBoss(b, SNAPPER, 1, run.bossEv);
   if (r === "ignored") return false;
   const d = run.disc;
   d.hits += 1;
   d.scored = true;
   addPoints(run, PTS.bossHit);
   run.parts.boss += PTS.bossHit;
   chain(run, PTS.bossHit, ev);
   ev.bossHit = true;
   if (r === "phase") ev.bossPhase = true;
   if (r === "defeated") {
      ev.bossDefeated = true;
      addPoints(run, PTS.defeat);
      run.parts.boss += PTS.defeat;
   }
   return true;
}

function startReturn(run: DiscRun, ev: StepEvents): void {
   const d = run.disc;
   d.mode = "back";
   d.backMs = 0;
   d.p0x = d.x;
   d.p0z = d.z;
   const mx = (d.x + d.fromX) / 2;
   const mz = (d.z + d.fromZ) / 2;
   const dx = d.fromX - d.x;
   const dz = d.fromZ - d.z;
   const len = Math.hypot(dx, dz) || 1;
   // the boomerang bows out on the hook's side (right-handed when thrown straight)
   const side = d.turn > 0 ? -1 : 1;
   const bow = Math.min(DISC.arc, len * 0.45) * side;
   d.p1x = mx + (-dz / len) * bow;
   d.p1z = mz + (dx / len) * bow;
   ev.returning = true;
}

/** The return arc's point at fraction k (0..1). */
export function backPos(d: Disc, k: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const u = 1 - k;
   out.x = u * u * d.p0x + 2 * u * k * d.p1x + k * k * d.fromX;
   out.z = u * u * d.p0z + 2 * u * k * d.p1z + k * k * d.fromZ;
   out.y = DISC.y + DISC.returnRise * Math.sin(Math.PI * k);
   return out;
}

const BP = { x: 0, y: 0, z: 0 };
const MP = { x: 0, z: 0 };

function drop(run: DiscRun, x: number, z: number, ev: StepEvents): void {
   const d = run.disc;
   d.mode = "ground";
   d.x = x;
   d.z = z;
   d.y = 0.05;
   d.groundUntil = run.simMs + CATCH.fetchMs;
   run.drops += 1;
   comboBreak(run.combo);
   ev.dropped = true;
}

function stepDisc(run: DiscRun, ev: StepEvents): void {
   const d = run.disc;
   const c = run.course;
   const ms = run.simMs;
   const h = run.hero;
   if (d.mode === "hand") return;
   if (d.mode === "ground") {
      if (ms >= d.groundUntil) {
         d.mode = "hand";
         ev.fetched = true;
      }
      return;
   }
   d.spin += 0.04;
   if (d.mode === "out") {
      const b = run.boss;
      const phase = b ? b.phase : 0;
      const open = !!b && b.step === "vulnerable" && (phase === 0 || (phase === 2 && d.banks >= 2));
      const hit = flyMs(c, d, run.rng, open);
      if (hit === CONTACT.bossOpen) {
         bossHit(run, ev);
         startReturn(run, ev);
         return;
      }
      if (hit === CONTACT.bank || hit === CONTACT.boss) {
         if (hit === CONTACT.boss) ev.bossDeflect = true;
         if (d.banks >= DISC.banks) {
            startReturn(run, ev);
            return;
         }
         d.banks += 1;
         bankSlow(d);
         ev.banked = d.banks;
      } else if (hit === CONTACT.stop) {
         ev.thunk = true;
         startReturn(run, ev);
         return;
      }
      // targets, monkeys and pods on the way
      const ti = targetAt(c, run.hit, d.x, d.y, d.z, ms);
      if (ti >= 0) onTargetHit(run, ti, ev);
      for (let m = 0; m < c.monkeys.length && d.hits < DISC.hits; m++) {
         if (ms < run.monkeyStun[m]) continue;
         monkeyPos(c.monkeys[m], ms, MP);
         if (Math.hypot(d.x - MP.x, d.z - MP.z) > MONKEY.r + DISC.r) continue;
         run.monkeyStun[m] = ms + MONKEY.stunMs;
         d.hits += 1;
         if (!run.monkeyPaid[m]) {
            run.monkeyPaid[m] = 1;
            d.scored = true;
            addPoints(run, PTS.monkey);
            run.parts.monkeys += PTS.monkey;
            chain(run, PTS.monkey, ev);
         }
         ev.monkeyHit = m;
      }
      if (c.boss && b && phase === 1) {
         for (let p = 0; p < c.boss.pods.length && d.hits < DISC.hits; p++) {
            if (run.podGone[p] || d.banks < 1) continue;
            const pod = c.boss.pods[p];
            if (Math.hypot(d.x - pod.x, d.z - pod.z) > POD.r + DISC.r) continue;
            run.podGone[p] = 1;
            ev.podPopped = p;
            if (!bossHit(run, ev)) d.hits += 1;
            if (run.podGone.every((g) => g === 1)) run.podsRegrowAt = ms + POD.regrowMs;
         }
      }
      if (d.hits >= DISC.hits || d.travelled >= DISC.range) startReturn(run, ev);
      return;
   }
   // back: the boomerang arc
   d.backMs += 1;
   const k = Math.min(1, d.backMs / DISC.returnMs);
   backPos(d, k, BP);
   d.x = BP.x;
   d.y = BP.y;
   d.z = BP.z;
   for (let m = 0; m < c.monkeys.length; m++) {
      if (ms < run.monkeyStun[m]) continue;
      monkeyPos(c.monkeys[m], ms, MP);
      if (Math.hypot(d.x - MP.x, d.z - MP.z) <= MONKEY.snatch) {
         // a monkey snatches the returning disc and drops it where it stands
         ev.snatched = true;
         run.monkeyStun[m] = ms + 1500;
         drop(run, MP.x, MP.z, ev);
         return;
      }
   }
   // Zuno's magnet pulls it in early from 3 m
   const dist = Math.hypot(h.x - d.x, h.z - d.z);
   const magnet = ms <= h.magnetUntil && dist <= MAGNET_REACH;
   if (k < 1 && !magnet) return;
   const catchDist = Math.hypot(h.x - d.fromX, h.z - d.fromZ);
   const reach = CATCH.reach + (ms <= h.dashUntil ? DASH_REACH : 0);
   if (magnet || catchDist <= CATCH.clean) {
      d.mode = "hand";
      run.cleans += 1;
      run.catches += 1;
      ev.caught = "clean";
      if (d.scored) {
         addPoints(run, PTS.catch);
         run.parts.catches += PTS.catch;
         chain(run, PTS.catch, ev);
      }
   } else if (catchDist <= reach) {
      d.mode = "hand";
      run.catches += 1;
      ev.caught = "catch";
   } else drop(run, d.fromX, d.fromZ, ev);
}

function stepBossMs(run: DiscRun, ev: StepEvents): void {
   const b = run.boss;
   const c = run.course;
   if (!b || !c.boss) return;
   const bev = stepBoss(b, SNAPPER, 1, run.bossEv);
   if (bev.telegraph) {
      ev.bossTelegraph = true;
      if (b.phase === 2) run.lane = Math.atan2(run.hero.x - c.boss.x, run.hero.z - c.boss.z);
   }
   if (bev.attack) {
      ev.bossAttack = true;
      if (b.phase === 2) {
         // the thorn volley down the lane picked at the telegraph
         const h = run.hero;
         const dx = h.x - c.boss.x;
         const dz = h.z - c.boss.z;
         const along = dx * Math.sin(run.lane) + dz * Math.cos(run.lane);
         const across = Math.abs(dx * Math.cos(run.lane) - dz * Math.sin(run.lane));
         if (along > 0 && across <= LANE_HALF) hurt(run, ev);
      }
   }
   if (b.phase === 1 && run.podsRegrowAt >= 0 && run.simMs >= run.podsRegrowAt) {
      run.podGone.fill(0);
      run.podsRegrowAt = NONE;
   }
   if (b.phase !== 1 && run.podGone.some((g) => g === 1)) run.podGone.fill(0);
}

function stepMs(run: DiscRun, input: StepInput, actionPressed: boolean, ev: StepEvents): void {
   run.simMs += 1;
   const ms = run.simMs;
   const h = run.hero;
   const c = run.course;
   const d = run.disc;
   comboTick(run.combo, COMBO, ms);
   if (actionPressed) power(run, ev);
   // the aim: hold Throw with the disc in hand, the stick sideways sets the hook; let go to throw
   const canAim = d.mode === "hand" && ms > h.stunUntil;
   if (input.throwHeld && canAim) {
      if (run.aimSince < 0) run.aimSince = ms;
      run.hook = Math.max(-1, Math.min(1, input.moveX));
   } else if (!input.throwHeld && run.aimSince >= 0) {
      const held = ms - run.aimSince;
      run.aimSince = NONE;
      if (held >= HOLD_MS && canAim) {
         const heading = input.yaw + Math.PI;
         launchDisc(d, h.x, h.z, heading, run.hook, h.lobArmed, h.phaseArmed);
         h.facing = heading;
         h.lobArmed = false;
         h.phaseArmed = false;
         run.throws += 1;
         ev.thrown = true;
      }
   } else if (!canAim) run.aimSince = NONE;
   moveHero(run, run.aimSince >= 0);
   stepDisc(run, ev);
   stepBossMs(run, ev);
   // Kiro's thorn zone: it bursts over the best throwing spot
   const th = c.thorns;
   if (th && ms % th.periodMs < th.burstMs && Math.hypot(h.x - th.x, h.z - th.z) <= th.r) hurt(run, ev);
   if (run.ended === null) {
      if (c.boss ? ev.bossDefeated : run.required >= c.required) finish(run, ev);
      else if (ms >= c.durationMs) {
         run.ended = "timeup";
         ev.timeup = true;
      }
   }
}

// ---------- reading the run ----------

/** Is the thorn zone bursting now? */
export function thornsBursting(c: Course, ms: number): boolean {
   const th = c.thorns;
   return !!th && ms % th.periodMs < th.burstMs;
}

export const STAT = {
   required: "required",
   orbs: "orbs",
   hits: "hits",
   cleans: "cleans",
   drops: "drops",
   hero: "hero",
   power: "power",
   aiming: "aiming",
   hook: "hook",
   colour: "colour",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   finishMs: "finishMs",
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
   hint: "hint",
} as const;

/** The one teaching line the HUD shows (teach by playing: a word when it matters). */
export const HINT = { none: 0, aim: 1, catch: 2, fetch: 3, mouth: 4, pods: 5, crown: 6, volley: 7, raft: 8 } as const;

export function hintFor(run: DiscRun): number {
   if (run.ended !== null) return HINT.none;
   const d = run.disc;
   const b = run.boss;
   if (b && b.step !== "defeat" && b.step !== "done" && b.step !== "intro") {
      if (b.phase === 2 && (b.step === "telegraph" || b.step === "attack")) return HINT.volley;
      return b.phase === 0 ? HINT.mouth : b.phase === 1 ? HINT.pods : HINT.crown;
   }
   if (d.mode === "back") return run.course.raft ? HINT.raft : HINT.catch;
   if (d.mode === "ground") return HINT.fetch;
   if (run.throws === 0) return HINT.aim;
   return HINT.none;
}

/** A points game: the store's score (the rules' run.score, published every frame) and the run time. */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The "no dropped disc" badge (the card): hits for the star screen are the drops plus the hurts. */
export function badgeHits(run: DiscRun): number {
   return run.drops + run.hits;
}
