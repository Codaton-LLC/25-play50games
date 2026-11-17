// The honest bot (pure). It plays like a careful player with no hero power and a perfect memory:
// it walks to the armed beacon, stands still through the show, then climbs the route pad by pad
// (jumping where the physics says the next pad is in reach) to the crystals of the sequence in
// order, waits out a storm or a crumbled pad, never jumps into a spark drone, and in Prism Shade's
// fight jumps his shockwave and touches his crystals in the shown (or flipped) order. `mash` adds
// the hero power whenever it is ready (the proof's power-mashing check); it never changes the line.
import type { LevelId } from "../../types";
import { ARENA_R } from "./levels";
import { STORM_R, droneAt, padCenterAt, stormIn, stormOn, waveRadius, type Course, type Pad } from "./tower";
import { heroById, type HeroId } from "./heroes";
import { PRISM } from "./progression";
import { G, V_JUMP, bossCrystalAt, bossExpectedColor, createRun, createStepInput, expectedColor, padAvailable, step, tierLive, type StepInput, type TowerRun } from "./rules";

export interface Bot {
   frameMs: number;
   mash: boolean;
   still: number;
   lastX: number;
   lastZ: number;
   /** the route pad the hero is on (or was last on) */
   pad: number;
   /** a crossing to the next pad has begun from this pad's middle (no more pulling back to it) */
   crossing: boolean;
}

export function createBot(run: TowerRun, frameMs = 1000 / 60): Bot {
   return { frameMs, mash: false, still: 0, lastX: run.hero.x, lastZ: run.hero.z, pad: 0, crossing: false };
}

const tmp = { x: 0, y: 0, z: 0 };
const tmp2 = { x: 0, y: 0, z: 0 };

/** The route pad whose top the point (x, z, y) lies over, -1 none. */
export function routePadOf(c: Course, x: number, z: number, y: number): number {
   let best = -1;
   let bestD = Infinity;
   for (let i = 0; i < c.routeCount; i++) {
      const p = c.pads[i];
      if (Math.abs(p.y - y) > 0.6) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d <= p.r + 0.4 && d < bestD) {
         bestD = d;
         best = i;
      }
   }
   return best;
}

function steer(run: TowerRun, tx: number, tz: number, input: StepInput, k = 1): number {
   const h = run.hero;
   const dx = tx - h.x;
   const dz = tz - h.z;
   const d = Math.hypot(dx, dz);
   if (d < 0.12) {
      input.moveX = 0;
      input.moveZ = 0;
      return d;
   }
   const s = Math.min(1, k, d / 0.6);
   input.moveX = (dx / d) * s;
   input.moveZ = (dz / d) * s;
   return d;
}

/** Time in the air (s) of a jump that lands `rise` m higher (or lower), from a standing jump. */
export function jumpAirtime(rise: number): number {
   const disc = V_JUMP * V_JUMP - 2 * G * rise;
   if (disc < 0) return 0;
   return (V_JUMP + Math.sqrt(disc)) / G;
}

const dtmp = { x: 0, y: 0, z: 0 };

/**
 * Would a spark drone come within `r` of the hero's chest anywhere along a jump from (x0, y0, z0)
 * landing at (x1, y1, z1) in `air` s (sampled every eighth of the flight, the drone where it will be)?
 */
function droneOnArc(run: TowerRun, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, air: number, r: number): boolean {
   if (run.course.drones.length === 0) return false;
   for (let s = 0; s <= 1; s += 0.125) {
      const t = s * air;
      const hx = x0 + (x1 - x0) * s;
      const hz = z0 + (z1 - z0) * s;
      const hy = y0 + V_JUMP * t - 0.5 * G * t * t + 0.6;
      for (const d of run.course.drones) {
         droneAt(run.course, d, run.simMs + t * 1000, dtmp);
         if (Math.hypot(dtmp.x - hx, dtmp.y - hy, dtmp.z - hz) < r) return true;
      }
   }
   void y1;
   return false;
}

/** The pad (as a point) the bot heads to, and the route pad under it. */
interface Goal {
   x: number;
   z: number;
   y: number;
   pad: number;
   /** stand still on it (a show) */
   hold: boolean;
}

const goal: Goal = { x: 0, z: 0, y: 0, pad: 0, hold: false };

/** Where the climbing bot heads this ms (a shared record; tests read it). */
export function botGoal(run: TowerRun): Goal | null {
   return climbGoal(run);
}

function climbGoal(run: TowerRun): Goal | null {
   const c = run.course;
   const t = run.tier;
   if (t >= c.tiers.length) {
      goal.x = c.summit.x;
      goal.z = c.summit.z;
      goal.y = c.summit.y;
      goal.pad = c.routeCount - 1;
      goal.hold = false;
      return goal;
   }
   const ts = run.tiers[t];
   const tier = c.tiers[t];
   const live = tierLive(run, t);
   if (!live || tier.seqLen === 0) {
      const b = tier.beacon;
      goal.x = b.x;
      goal.z = b.z;
      goal.y = b.y;
      goal.pad = routePadOf(c, b.x, b.z, b.y);
      goal.hold = ts.showStart >= 0;
      return goal;
   }
   const want = expectedColor(run);
   for (let k = 0; k < tier.count; k++) {
      const cr = c.crystals[tier.first + k];
      if (cr.color !== want) continue;
      // stand under it, half a metre in from the pad's edge (a bobbing one sinks into reach by itself)
      const pad = routePadOf(c, cr.x, cr.z, cr.y);
      padCenterAt(c.pads[pad], run.simMs, tmp2);
      const dx = tmp2.x - cr.x;
      const dz = tmp2.z - cr.z;
      const dd = Math.hypot(dx, dz) || 1;
      goal.x = cr.x + (dx / dd) * 0.5;
      goal.z = cr.z + (dz / dd) * 0.5;
      goal.y = cr.y;
      goal.pad = pad;
      goal.hold = false;
      return goal;
   }
   return null;
}

/** Walk the route toward the goal pad: steer to the next pad and jump when it is in reach. */
function climb(bot: Bot, run: TowerRun, g: Goal, input: StepInput): void {
   const c = run.course;
   const h = run.hero;
   const ms = run.simMs;
   if (bot.pad === g.pad) {
      bot.crossing = false;
      const p = c.pads[bot.pad];
      padCenterAt(p, ms, tmp2);
      // a storm pad: hold at the rim (outside the shard column) while it rains or is about to
      const fromCentre = Math.hypot(h.x - tmp2.x, h.z - tmp2.z);
      if (p.storm !== undefined && (stormOn(p, ms) || stormIn(p, ms) < 700) && fromCentre > STORM_R + 0.25 && Math.hypot(g.x - h.x, g.z - h.z) > 0.3) {
         input.moveX = 0;
         input.moveZ = 0;
         return;
      }
      const d = steer(run, g.x, g.z, input);
      if (g.hold && d < 0.5) {
         input.moveX = 0;
         input.moveZ = 0;
      }
      return;
   }
   const dir = g.pad > bot.pad ? 1 : -1;
   const next: Pad = c.pads[bot.pad + dir];
   const here: Pad = c.pads[bot.pad];
   padCenterAt(here, ms, tmp2);
   const fromCentre = Math.hypot(h.x - tmp2.x, h.z - tmp2.z);
   // waits: a storm on the next pad, a crumbled pad, a drone over the gap
   const stormWait = stormOn(next, ms) || stormIn(next, ms) < 1200;
   const gone = !padAvailable(run, bot.pad + dir) || (run.crumbleAt[bot.pad + dir] >= 0 && ms > run.crumbleAt[bot.pad + dir]);
   const hurry = run.crumbleAt[bot.pad] >= 0;
   if ((stormWait || gone) && !hurry) {
      steer(run, tmp2.x, tmp2.z, input);
      return;
   }
   const rise = next.y - h.y;
   const air = jumpAirtime(rise);
   padCenterAt(next, ms + air * 1000, tmp);
   if (!h.grounded) {
      steer(run, tmp.x, tmp.z, input);
      return;
   }
   // start every crossing from the middle of this pad (beside a crystal is no place to leave from);
   // a storm pad instead: keep out of its shard column while it rains or is about to
   if (here.storm !== undefined) {
      if ((stormOn(here, ms) || stormIn(here, ms) < 900) && fromCentre < STORM_R + 0.4) {
         steer(run, tmp2.x + ((h.x - tmp2.x) / Math.max(0.1, fromCentre)) * (STORM_R + 0.7), tmp2.z + ((h.z - tmp2.z) / Math.max(0.1, fromCentre)) * (STORM_R + 0.7), input);
         return;
      }
   } else if (!bot.crossing) {
      if (fromCentre > 0.6 && !hurry) {
         steer(run, tmp2.x, tmp2.z, input);
         return;
      }
      bot.crossing = true;
   }
   const d = steer(run, tmp.x, tmp.z, input);
   const dronesClear = !droneOnArc(run, h.x, h.y, h.z, tmp.x, next.y, tmp.z, air, 3);
   if (!dronesClear && !hurry) {
      // hold in the middle of this pad until the drone has passed
      steer(run, tmp2.x, tmp2.z, input);
      return;
   }
   if (rise < -0.5) {
      // a lower pad: walk off the edge and steer onto it (a jump would overshoot)
      return;
   }
   const speed = Math.max(3.5, Math.hypot(h.vx, h.vz));
   const travel = speed * air;
   const edge = fromCentre >= here.r - 0.4;
   if (d > 0.6 && ((d <= travel - 0.3 && d >= travel - 1.8) || edge)) input.jumpPressed = true;
}

function bossPlay(run: TowerRun, input: StepInput): void {
   const c = run.course;
   const b = run.boss!;
   const h = run.hero;
   const arena = c.arena!;
   if (b.step === "vulnerable") {
      const want = bossExpectedColor(run);
      if (want >= 0) {
         bossCrystalAt(run, want, tmp);
         // already standing in it as the window opened (no entry): step out toward the middle and come back
         if (run.bossInside[want]) steer(run, arena.x + (h.x - arena.x) * 0.5, arena.z + (h.z - arena.z) * 0.5, input);
         else steer(run, tmp.x, tmp.z, input);
      }
      return;
   }
   // between windows: wait a little out from the centre, and jump the shockwave as it reaches you
   const d = Math.hypot(h.x - arena.x, h.z - arena.z);
   const a = Math.atan2(h.x - arena.x, h.z - arena.z);
   const waitR = ARENA_R * 0.5;
   steer(run, arena.x + Math.sin(a) * waitR, arena.z + Math.cos(a) * waitR, input);
   if (b.step === "attack") {
      const r = waveRadius(b.stepMs, PRISM.phases[b.phase].attacks[0].attackMs);
      const speed = ARENA_R / PRISM.phases[b.phase].attacks[0].attackMs;
      // the ring reaches us in (d - r) / speed ms: leave the ground about 250 ms before
      if (h.grounded && d - r > 0 && (d - r) / speed < 260) input.jumpPressed = true;
   }
}

export function botInput(bot: Bot, run: TowerRun, input: StepInput): void {
   input.yaw = 0;
   input.jumpPressed = false;
   input.jumpHeld = false;
   input.actionPressed = false;
   input.moveX = 0;
   input.moveZ = 0;
   const c = run.course;
   const h = run.hero;
   if (run.ended) return;
   if (h.lostUntil >= 0) return;
   if (h.onPad >= 0 && h.onPad < c.routeCount) {
      if (h.onPad !== bot.pad) bot.crossing = false;
      bot.pad = h.onPad;
   }
   if (h.onPad >= c.routeCount) {
      // knocked onto a nook or a ledge: back toward the route pad it came from, and off the edge
      padCenterAt(c.pads[bot.pad], run.simMs, tmp2);
      steer(run, tmp2.x, tmp2.z, input);
      if (h.grounded) input.jumpPressed = true;
   } else if (run.bossAwake && run.boss && run.boss.hp > 0) bossPlay(run, input);
   else {
      const g = climbGoal(run);
      if (g && g.pad >= 0) climb(bot, run, g, input);
   }
   const power = heroById(run.heroId).power;
   if (bot.mash && run.simMs >= h.powerReadyAt && power !== "doubleJump" && power !== "dash") input.actionPressed = true;
   // unstick: a jump after 800 ms pushing without moving
   const moved = Math.hypot(h.x - bot.lastX, h.z - bot.lastZ);
   const trying = Math.abs(input.moveX) + Math.abs(input.moveZ) > 0.3;
   if (moved < 0.01 && trying && h.grounded) bot.still += bot.frameMs;
   else bot.still = 0;
   bot.lastX = h.x;
   bot.lastZ = h.z;
   if (bot.still > 800) {
      input.jumpPressed = true;
      bot.still = 0;
   }
}

/** Runs a bot until the level ends (tests and the preview's ?autoplay=1). */
export function botRun(level: LevelId, fps = 60, hero: HeroId = "vexa", mash = false, seed = 1): TowerRun {
   const fms = 1000 / fps;
   const run = createRun(seed, level, hero);
   const bot = createBot(run, fms);
   bot.mash = mash;
   const input = createStepInput();
   const cap = Math.ceil(run.course.timerMs / fms) + 5;
   for (let f = 0; f < cap && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}
