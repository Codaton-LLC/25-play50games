// The honest bot (README "Server limits and why they hold"): a careful player who plans each throw. With
// the disc in hand it tries a set of throwing spots it can walk to in a straight line (never inside the
// thorn zone), and from each a fan of aims and hooks; it flies each candidate with the rules' own disc
// physics (rules.ts flyMs, the same banks and stops) and picks the throw that breaks the most targets
// for the walk it costs. Then it walks there, holds Throw 0.17 s and lets go, and stands on the throw
// spot for the catch (on the raft it walks against the drift to stay on it). Against Mother Snapper it
// times the throw so the disc reaches her in an open window (a cloned boss clock), banks into a pod in
// phase 2 and twice off the columns into her crown in phase 3, and steps out of a volley's lane. It
// never uses a power or a ghost wall, and is the same at any frame rate. Used by the proofs and by
// `?autoplay=1` (preview).
import { createBoss, stepBoss, createBossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { YARD, monkeyPos, raftX, type Course } from "./course";
import { CONTACT, DISC, HERO_R, HOLD_MS, POD, MONKEY, V_WALK, bankSlow, flyMs, launchDisc, targetAt, type Disc, type DiscRun, type StepInput } from "./rules";
import { SNAPPER } from "./progression";

export interface Plan {
   x: number;
   z: number;
   heading: number;
   hook: number;
   value: number;
}

export interface Bot {
   frameMs: number;
   plan: Plan | null;
   /** frames Throw has been held for the current plan (-1: walking) */
   held: number;
   /** the next plan search may run at this rules ms (planning is not free) */
   nextPlanMs: number;
   disc: Disc;
   mask: Uint8Array;
   boss: BossState | null;
   /** the ms the volley dodge started (L5 phase 3), -1 */
   dodgeSide: number;
}

export function createBot(run: DiscRun, frameMs = 1000 / 60): Bot {
   return {
      frameMs,
      plan: null,
      held: -1,
      nextPlanMs: 0,
      disc: { ...run.disc },
      mask: new Uint8Array(run.hit.length),
      boss: run.boss ? createBoss(SNAPPER) : null,
      dodgeSide: 0,
   };
}

const HEADINGS = 48;
const HOOKS = [-1, 0, 1] as const;
const MP = { x: 0, z: 0 };
const BEV = createBossEvents();

/** Is the straight walk from (ax, az) to (bx, bz) clear of every box and column (and the thorns)? */
export function walkClear(c: Course, ax: number, az: number, bx: number, bz: number): boolean {
   const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.3));
   for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n;
      const z = az + ((bz - az) * i) / n;
      if (!spotFree(c, x, z)) return false;
   }
   return true;
}

/** Can the hero stand at (x, z): inside the yard, off every obstacle, out of the thorn zone? */
export function spotFree(c: Course, x: number, z: number): boolean {
   const r = HERO_R + 0.15;
   if (x < YARD.minX + r || x > YARD.maxX - r || z < YARD.minZ + r || z > YARD.maxZ - r) return false;
   for (const b of c.boxes) if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return false;
   for (const col of c.columns) if (Math.hypot(x - col.x, z - col.z) < col.r + r) return false;
   if (c.boss && Math.hypot(x - c.boss.x, z - c.boss.z) < c.boss.r + r + 1) return false;
   const th = c.thorns;
   if (th && Math.hypot(x - th.x, z - th.z) < th.r + 0.6) return false;
   return true;
}

/** The throwing spots the bot considers: where it stands, plus a grid over the near half of the yard. */
function spots(run: DiscRun): { x: number; z: number }[] {
   const h = run.hero;
   const c = run.course;
   const out = [{ x: h.x, z: h.z }];
   if (c.raft) return out;
   for (let z = 3; z >= -11; z -= 4) for (let x = -8; x <= 8; x += 4) if (spotFree(c, x, z) && walkClear(c, h.x, h.z, x, z)) out.push({ x, z });
   return out;
}

/** Steps a boss clone to rules ms `ms` (it only ever moves forward). */
function bossAt(src: BossState, clone: BossState, fromMs: number, toMs: number): void {
   Object.assign(clone, src);
   if (toMs > fromMs) stepBoss(clone, SNAPPER, toMs - fromMs, BEV);
}

/**
 * Flies one candidate throw with the rules' physics and returns what it is worth to the bot: required
 * targets most, orbs, posts and monkeys a little, and against the boss a hit in an open window.
 */
export function evalThrow(bot: Bot, run: DiscRun, x: number, z: number, heading: number, hook: number, releaseMs: number): number {
   const c = run.course;
   const d = bot.disc;
   const mask = bot.mask;
   mask.set(run.hit);
   launchDisc(d, x, z, heading, hook, false, false);
   let value = 0;
   const clone = bot.boss;
   const src = run.boss;
   if (clone && src) bossAt(src, clone, run.simMs, releaseMs);
   for (let k = 1; k <= 1500; k++) {
      const ms = releaseMs + k;
      if (clone) stepBoss(clone, SNAPPER, 1, BEV);
      const ph = clone ? clone.phase : 0;
      const open = !!clone && clone.step === "vulnerable" && (ph === 0 || (ph === 2 && d.banks >= 2));
      const hit = flyMs(c, d, null, open);
      if (hit === CONTACT.bossOpen) return value + 100;
      if (hit === CONTACT.bank || hit === CONTACT.boss) {
         if (d.banks >= DISC.banks) break;
         d.banks += 1;
         bankSlow(d);
      } else if (hit === CONTACT.stop) break;
      const ti = targetAt(c, mask, d.x, d.y, d.z, ms);
      if (ti >= 0) {
         mask[ti] = 1;
         d.hits += 1;
         const t = c.targets[ti];
         value += t.required ? 10 : t.kind === "orb" ? 6 : t.kind === "post" ? 2 : 0;
      }
      for (let m = 0; m < c.monkeys.length; m++) {
         if (ms < run.monkeyStun[m]) continue;
         monkeyPos(c.monkeys[m], ms, MP);
         if (Math.hypot(d.x - MP.x, d.z - MP.z) <= MONKEY.r + DISC.r) {
            d.hits += 1;
            value += run.monkeyPaid[m] ? 0.5 : 3;
         }
      }
      if (c.boss && clone && ph === 1 && clone.step === "vulnerable" && d.banks >= 1) {
         for (let p = 0; p < c.boss.pods.length; p++) {
            if (run.podGone[p]) continue;
            const pod = c.boss.pods[p];
            if (Math.hypot(d.x - pod.x, d.z - pod.z) <= POD.r + DISC.r) return value + 100;
         }
      }
      if (d.hits >= DISC.hits || d.travelled >= DISC.range) break;
   }
   return value;
}

/** The best throw from the spots the bot can reach (null: nothing worth throwing at yet). `here`: only where it stands. */
export function planThrow(bot: Bot, run: DiscRun, here = false): Plan | null {
   const h = run.hero;
   let best: Plan | null = null;
   let bestScore = 0;
   const list = here ? [{ x: h.x, z: h.z }] : spots(run);
   for (const s of list) {
      const walkMs = (Math.hypot(s.x - h.x, s.z - h.z) / V_WALK) * 1000 + (s.x === h.x && s.z === h.z ? 0 : 300);
      const release = run.simMs + Math.ceil(walkMs) + HOLD_MS + 40;
      for (let i = 0; i < HEADINGS; i++) {
         const heading = (i / HEADINGS) * Math.PI * 2;
         for (const hook of HOOKS) {
            const v = evalThrow(bot, run, s.x, s.z, heading, hook, release);
            if (v <= 0) continue;
            const score = v / (2.6 + walkMs / 1000);
            if (score > bestScore) {
               bestScore = score;
               best = { x: s.x, z: s.z, heading, hook, value: v };
            }
         }
      }
      // a boss throw from where it stands is good enough: do not walk round for it
      if (run.boss && best && best.value >= 100) break;
   }
   return best;
}

function walkTo(input: StepInput, run: DiscRun, x: number, z: number): number {
   const h = run.hero;
   const dx = x - h.x;
   const dz = z - h.z;
   const d = Math.hypot(dx, dz);
   input.yaw = 0;
   if (d < 0.08) {
      input.moveX = 0;
      input.moveZ = 0;
      return d;
   }
   const k = Math.min(1, d / 0.6);
   input.moveX = (dx / d) * k;
   input.moveZ = (dz / d) * k;
   return d;
}

/** Fills `input` for this frame. */
export function botInput(bot: Bot, run: DiscRun, input: StepInput): void {
   input.actionPressed = false;
   input.throwHeld = false;
   input.moveX = 0;
   input.moveZ = 0;
   input.yaw = 0;
   const d = run.disc;
   const h = run.hero;
   const c = run.course;
   // a volley: step out of its lane (L5 phase 3)
   const b = run.boss;
   if (b && b.phase === 2 && (b.step === "telegraph" || b.step === "attack") && d.mode === "hand" && bot.held < 0) {
      if (bot.dodgeSide === 0) bot.dodgeSide = h.x > 0 ? -1 : 1;
      const cx = c.boss!.x;
      const cz = c.boss!.z;
      const ax = Math.sin(run.lane);
      const az = Math.cos(run.lane);
      const dx = h.x - cx;
      const dz = h.z - cz;
      const across = dx * az - dz * ax;
      if (Math.abs(across) < 2.2) {
         const sx = az * bot.dodgeSide;
         const sz = -ax * bot.dodgeSide;
         if (spotFree(c, h.x + sx * 1.2, h.z + sz * 1.2)) {
            input.moveX = sx;
            input.moveZ = sz;
         } else bot.dodgeSide = -bot.dodgeSide;
      }
      return;
   }
   bot.dodgeSide = 0;
   if (d.mode === "out" || d.mode === "back") {
      // the catch: be on the throw spot (the raft drifts: walk against it)
      walkTo(input, run, d.fromX, d.fromZ);
      return;
   }
   if (d.mode === "ground") return;
   // in hand: plan, walk, aim, throw
   if (bot.held >= 0 && bot.plan) {
      const p = bot.plan;
      input.yaw = p.heading - Math.PI;
      input.moveX = p.hook;
      bot.held += 1;
      if (bot.held * bot.frameMs < HOLD_MS + 20) input.throwHeld = true;
      else {
         input.throwHeld = false;
         bot.held = -1;
         bot.plan = null;
         bot.nextPlanMs = run.simMs + 200;
      }
      return;
   }
   if (!bot.plan) {
      if (run.simMs < bot.nextPlanMs) return;
      bot.plan = planThrow(bot, run);
      bot.nextPlanMs = run.simMs + (run.boss ? 120 : 400);
      if (!bot.plan) return;
   }
   const p = bot.plan;
   const target = c.raft ? { x: raftX(c, run.simMs), z: c.raft.z } : p;
   const dist = walkTo(input, run, target.x, target.z);
   if (dist < 0.1 && Math.hypot(h.vx, h.vz) < 0.4) {
      // re-plan from exactly where it stands (the walk may end a little off), then aim
      const here = planThrow(bot, run, true);
      if (!here) {
         bot.plan = null;
         return;
      }
      bot.plan = here;
      bot.held = 0;
      input.throwHeld = true;
      input.yaw = here.heading - Math.PI;
      input.moveX = here.hook;
      input.moveZ = 0;
   }
}


