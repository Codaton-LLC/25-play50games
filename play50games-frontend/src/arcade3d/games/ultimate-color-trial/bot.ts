// The honest bot (pure). It plays like a careful player with no hero power: it jumps the pads one
// by one (each from the middle of the one it stands on, when the next is in reach), passes the rings
// in order (jumping for the high ones), steps on the switch of a colour the next door row has a
// door for and walks through that door, jumps the laser beams as they come, waits a survival round
// out in the arena's safe corner, carries the energy core round the orbs, and in the Sentinel's
// arena waits his sweeps out at the wall, then does what his beacon asks. `mash` adds the hero power
// whenever it is ready (the proof's power-mashing check); it never changes the line.
import type { LevelId } from "../../types";
import { HALF_W } from "./levels";
import { ARENA_IN, G, V_JUMP, bossMinMs, createRun, createStepInput, currentSection, nextRing, nextRow, step, type StepInput, type TrialRun } from "./rules";
import { BEAM_CLEAR, blobAt, laserZ, padCenterAt, type Course, type Pad } from "./course";
import { heroById, type HeroId } from "./heroes";

export interface Bot {
   frameMs: number;
   mash: boolean;
   still: number;
   lastX: number;
   lastZ: number;
   /** the jump pad the hero stands on (or last stood on), -1 the floor before the section */
   pad: number;
}

export function createBot(run: TrialRun, frameMs = 1000 / 60): Bot {
   return { frameMs, mash: false, still: 0, lastX: run.hero.x, lastZ: run.hero.z, pad: -1 };
}

const tmp = { x: 0, z: 0 };
const tmp2 = { x: 0, z: 0 };

function steer(run: TrialRun, tx: number, tz: number, input: StepInput, k = 1): number {
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

/** Time in the air (s) of a jump that lands `rise` m higher (or lower). */
export function jumpAirtime(rise: number): number {
   const disc = V_JUMP * V_JUMP - 2 * G * rise;
   if (disc < 0) return 0;
   return (V_JUMP + Math.sqrt(disc)) / G;
}

/** The section's jump pads in z order. */
function padsOf(c: Course, section: number): Pad[] {
   return c.pads.filter((p) => p.section === section).sort((a, b) => a.z - b.z);
}

/** Steer toward a landing spot and jump when it is in reach (from the middle of the pad we stand on). */
function hop(run: TrialRun, tx: number, tz: number, ty: number, targetR: number, atEdge: boolean, input: StepInput): void {
   const h = run.hero;
   const d = steer(run, tx, tz, input);
   if (!h.grounded) return;
   const rise = ty - h.y;
   if (rise < -0.5) return; // a lower spot: walk off the edge and steer onto it
   const air = jumpAirtime(rise);
   const speed = Math.max(3.5, Math.hypot(h.vx, h.vz));
   const travel = speed * air;
   if (d > 0.6 && ((d <= travel - 0.3 && d >= travel - 1.8 - targetR) || atEdge)) input.jumpPressed = true;
}

/** Keep out of the rolling orbs of this section: a push away from any within reach. */
function dodgeOrbs(run: TrialRun, section: number, input: StepInput, reach = 2.6): void {
   const c = run.course;
   const h = run.hero;
   let ax = 0;
   let az = 0;
   for (const b of c.blobs) {
      if (b.section !== section) continue;
      blobAt(b, run.simMs + 150, tmp2);
      const dx = h.x - tmp2.x;
      const dz = h.z - tmp2.z;
      const d = Math.hypot(dx, dz);
      if (d > reach || d < 1e-6) continue;
      const w = (reach - d) / reach;
      ax += (dx / d) * w * 2.5;
      az += (dz / d) * w * 2.5;
   }
   if (ax === 0 && az === 0) return;
   const mx = input.moveX + ax;
   const mz = input.moveZ + az;
   const m = Math.hypot(mx, mz) || 1;
   input.moveX = mx / Math.max(1, m);
   input.moveZ = mz / Math.max(1, m);
}

/** Line up 4.5 m before a ring, run straight through it, jumping for a high one when it is 2-3.3 m off. */
function aimRing(run: TrialRun, r: { x: number; y: number; z: number }, floorZ0: number, input: StepInput): void {
   const h = run.hero;
   const lined = Math.abs(h.x - r.x) < 0.45 && h.z < r.z + 0.6;
   if (!lined) {
      steer(run, r.x, Math.max(floorZ0 + 0.8, r.z - 4.8), input);
      return;
   }
   const d = steer(run, r.x, r.z + 1, input);
   if (r.y > 2 && h.grounded && d <= 3.3 && d >= 2.0) input.jumpPressed = true;
}

/** Jump a laser beam of this section as it comes. */
function jumpBeams(run: TrialRun, section: number, input: StepInput): void {
   const h = run.hero;
   if (!h.grounded) return;
   for (const l of run.course.lasers) {
      if (l.section !== section) continue;
      const bz = laserZ(l, run.simMs);
      const ahead = bz - h.z;
      if (ahead > -0.3 && ahead < 1.9) input.jumpPressed = true;
   }
   void BEAM_CLEAR;
}

function playSection(bot: Bot, run: TrialRun, cur: number, input: StepInput): void {
   const c = run.course;
   const h = run.hero;
   const sec = c.sections[cur];
   // not there yet: the section's start line
   if (h.z < sec.z0 - 0.3 && sec.kind !== "jump") {
      steer(run, 0, sec.z0 + 1, input);
      return;
   }
   switch (sec.kind) {
      case "jump": {
         const pads = padsOf(c, cur);
         if (h.onPad >= 0 && c.pads[h.onPad].section === cur) bot.pad = h.onPad;
         else if (h.grounded && h.z < sec.z0) bot.pad = -1;
         else if (h.grounded && h.z > sec.z1 - 0.5) bot.pad = c.pads.length;
         // the pad we stand on, and the next one (or the far floor)
         const k = bot.pad < 0 ? -1 : pads.findIndex((p) => p.index === bot.pad);
         const here = k >= 0 ? pads[k] : null;
         // at the edge of what we stand on: the pad's rim, or the floor's edge line before the first pad
         const hereX = here ? padCenterAt(here, run.simMs, tmp2).x : h.x;
         const atEdge = here ? Math.hypot(h.x - hereX, h.z - here.z) >= here.r - 0.4 : h.z >= sec.z0 - 0.45;
         if (bot.pad === c.pads.length || k >= pads.length - 1) {
            // the far floor
            hop(run, here ? hereX : 0, sec.z1 + 1.2, 0, 3, atEdge, input);
            return;
         }
         const next = pads[k + 1];
         const rise = next.y - h.y;
         const air = jumpAirtime(Math.max(0, rise));
         padCenterAt(next, run.simMs + air * 1000, tmp);
         hop(run, tmp.x, tmp.z, next.y, next.r, atEdge, input);
         return;
      }
      case "runner":
         steer(run, 0, sec.z1 - 0.2, input);
         jumpBeams(run, cur, input);
         return;
      case "rings": {
         const r = nextRing(run, cur);
         if (!r) {
            steer(run, 0, sec.z1 - 0.2, input);
            return;
         }
         aimRing(run, r, sec.z0, input);
         return;
      }
      case "gates": {
         const row = nextRow(run, cur);
         if (!row) {
            steer(run, 0, sec.z1 + 1.2, input);
            return;
         }
         const door = row.doors.find((dd) => dd.color === run.charge);
         if (door) {
            steer(run, (door.x0 + door.x1) / 2, row.z + 1.5, input);
            return;
         }
         let best: { x: number; z: number } | null = null;
         let bd = Infinity;
         for (const w of c.switches) {
            // only this row's own switches (the ones just before it): a switch behind a passed row shuts you out of it
            if (w.section !== cur || w.z >= row.z || w.z < row.z - 9 || !row.doors.some((dd) => dd.color === w.color)) continue;
            const d = Math.hypot(w.x - h.x, w.z - h.z);
            if (d < bd) {
               bd = d;
               best = w;
            }
         }
         if (best) steer(run, best.x, best.z, input);
         return;
      }
      case "survive": {
         if (run.surviveStart[cur] < 0) {
            steer(run, 4.6, sec.z0 + ARENA_IN + 1, input);
            return;
         }
         // the round runs: the arena's corner is clear of the circling orbs
         steer(run, 4.6, sec.z0 + 2.4, input);
         dodgeOrbs(run, cur, input);
         return;
      }
      case "core": {
         if (run.coreState[cur] === 0) steer(run, run.coreX[cur], run.coreZ[cur], input);
         else steer(run, sec.receptor!.x, sec.receptor!.z, input);
         dodgeOrbs(run, cur, input);
         return;
      }
      case "boss":
         bossPlay(run, cur, input);
         return;
   }
}

function bossPlay(run: TrialRun, cur: number, input: StepInput): void {
   const c = run.course;
   const h = run.hero;
   const bs = c.bossSpec!;
   const b = run.boss!;
   if (!run.bossAwake) {
      steer(run, bs.beacon.x, bs.beacon.z, input);
      return;
   }
   const sec = c.sections[cur];
   if (b.step !== "vulnerable") {
      // his sweeps roll round the arena's middle: the wall by the switches is clear
      steer(run, HALF_W - 0.6, sec.z0 + 6, input);
      if (b.step === "attack") dodgeOrbs(run, cur, input, 3);
      return;
   }
   if (b.phase === 0) {
      const row = c.rows.find((r) => r.section === cur)!;
      if (run.charge === run.bossColor) {
         if (h.z < row.z) {
            const door = row.doors.find((dd) => dd.color === run.bossColor)!;
            steer(run, (door.x0 + door.x1) / 2, row.z + 1.5, input);
         } else steer(run, bs.x, bs.z - 1.2, input);
      } else {
         const w = c.switches.find((s) => s.section === cur && s.color === run.bossColor);
         if (w) steer(run, w.x, w.z, input);
      }
      return;
   }
   if (b.phase === 1) {
      const r = c.rings.find((rr) => rr.section === cur && rr.order === run.bossRingNext);
      if (r) aimRing(run, r, sec.z0, input);
      return;
   }
   if (run.bossCore === 1) steer(run, run.bossCoreX, run.bossCoreZ, input);
   else if (run.bossCore === 2) steer(run, bs.receptor.x, bs.receptor.z, input);
}

export function botInput(bot: Bot, run: TrialRun, input: StepInput): void {
   input.yaw = 0;
   input.jumpPressed = false;
   input.jumpHeld = false;
   input.actionPressed = false;
   input.moveX = 0;
   input.moveZ = 0;
   const c = run.course;
   const h = run.hero;
   if (run.ended) return;
   if (h.lostUntil >= 0) {
      bot.pad = -1;
      return;
   }
   const cur = currentSection(run);
   if (cur >= c.sections.length) steer(run, c.finish.x, c.finish.z, input);
   else playSection(bot, run, cur, input);
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
   void bossMinMs;
}

/** Runs a bot until the level ends (tests and the preview's ?autoplay=1). */
export function botRun(level: LevelId, fps = 60, hero: HeroId = "riko", mash = false, seed = 1): TrialRun {
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
