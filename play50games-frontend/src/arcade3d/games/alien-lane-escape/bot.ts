// The honest bot (the tests, the proof and ?autoplay=1): it only writes a StepInput (lane presses, the
// slide held, Jump, Action), what a player's keys or touch give. It reads the track the way a player
// reads the violet telegraph: for the next scan, the lane of the cover that will shade its meeting point
// (the course's beats), steering in once the glow plant before it is behind; it slides under low covers
// and arches, jumps rocks, keeps out of goo, takes the track's orbs, and on level 5 lures the abduction
// beams (in the lane as it locks, out before it lands) and jumps into the underside. It plays its hero's
// route too: Vexa phases into the crystal cave, Nyla double-jumps onto the mesa, Zuno pulls the goo's
// orbs with the magnet, Kiro shields through the goo, Riko dashes for the orbs in open ground.
import { CLEAR_H, LURE_LOCK, caveAt, inPhase, type AlienRun, type StepInput } from "./rules";
import { MESA_Y, type Beat, type BossEvent } from "./course";

export interface Bot {
   frameMs: number;
   pressAt: number;
   /** play the hero's own route (power, cave, mesa) */
   routes: boolean;
}

export function createBot(_run: AlienRun, frameMs = 1000 / 60, routes = true): Bot {
   return { frameMs, pressAt: -1, routes };
}

function loopLen(run: AlienRun): number {
   const l = run.course.loop;
   return l ? l.s1 - l.s0 : 0;
}

function looping(run: AlienRun): boolean {
   return !!run.course.loop && !!run.boss && run.boss.step !== "done";
}

/** The next beat ahead (in its phase on level 5), or null. */
export function nextBeat(run: AlienRun, s: number): Beat | null {
   for (const b of run.course.beats) {
      if (b.s <= s + 0.3) continue;
      if (b.phase >= 0 && !inPhase(run, b.phase)) continue;
      return b;
   }
   if (looping(run)) {
      for (const b of run.course.beats) if (b.phase >= 0 && inPhase(run, b.phase)) return { ...b, s: b.s + loopLen(run) };
   }
   return null;
}

function nextEvent(run: AlienRun, s: number): BossEvent | null {
   if (!run.boss || !run.bossAwake) return null;
   for (const e of run.course.bossEvents) if (e.s > s - 0.2 && inPhase(run, e.phase)) return e;
   if (looping(run)) for (const e of run.course.bossEvents) if (inPhase(run, e.phase)) return { ...e, s: e.s + loopLen(run) };
   return null;
}

function gooAhead(run: AlienRun, lane: number, s0: number, s1: number): boolean {
   for (const g of run.course.goo) if (g.lane === lane && g.s1 > s0 && g.s0 < s1) return true;
   return false;
}

function obstacleAhead(run: AlienRun, lane: number, s0: number, s1: number): boolean {
   for (const o of run.course.obstacles) if (o.lane === lane && o.s > s0 && o.s < s1 && inPhase(run, o.phase)) return true;
   return false;
}

/** A lane other than `avoid`, nearest to `from`, free of goo and obstacles for a while. */
function sideLane(run: AlienRun, avoid: number, from: number, s: number): number {
   const order = [from, from - 1, from + 1, from - 2, from + 2].filter((l) => l >= 0 && l <= 2 && l !== avoid);
   for (const l of order) if (!gooAhead(run, l, s, s + 12) && !obstacleAhead(run, l, s, s + 12)) return l;
   return order[0] ?? 1;
}

export function botInput(bot: Bot, run: AlienRun, input: StepInput): void {
   input.left = input.right = input.slide = input.jumpPressed = input.actionPressed = false;
   const r = run.runner;
   const co = run.course;
   const v = co.config.speed;
   const hero = run.heroId;
   const cur = r.lane;
   let target = cur === 3 ? 3 : cur;
   let fixed = false;

   // level 5: the Mothership's events come first
   const ev = nextEvent(run, r.s);
   if (ev) {
      const d = ev.s - r.s;
      if (ev.kind === "lure" && d < 30) {
         target = d > LURE_LOCK - 2 ? ev.lane : sideLane(run, ev.lane, ev.lane, r.s);
         fixed = true;
      } else if (ev.kind === "underside" && d < 25) {
         target = ev.lane;
         fixed = true;
         if (d > 0 && d < 0.3 * v && r.h <= 0.001) input.jumpPressed = true;
      } else if (ev.kind === "crash" && d > 0 && d < 0.3 * v && r.h <= 0.001) input.jumpPressed = true;
   }

   // the next scan: into its cover's lane in time (after the plant before it)
   const beat = nextBeat(run, r.s);
   if (!fixed && beat) {
      const d = beat.s - r.s;
      let plantS = -Infinity;
      for (const p of co.plants) if (p.lane === beat.lane && p.s < beat.s && p.s > beat.s - 14) plantS = p.s;
      if (r.s < plantS + 0.5 && d < 30) {
         target = cur === beat.lane ? sideLane(run, beat.lane, cur, r.s) : cur;
         fixed = true;
      } else if (d < 16) {
         target = beat.lane;
         fixed = true;
         // Riko: the open-ground orbs at the meeting point instead, dashing through them unseen
         if (hero === "riko" && bot.routes && (run.ms >= run.powerReadyAt - 400 || run.ms < run.dashUntil)) {
            const open = co.orbs.findIndex((o, i) => o.bonus === "open" && !run.collected[i] && Math.abs(o.s - beat.s) < 0.5);
            if (open >= 0) {
               target = co.orbs[open].lane;
               if (d < 1.5 + 0.35 * v * 1.6 && run.ms >= run.powerReadyAt) input.actionPressed = true;
            }
         }
      }
   }
   // a low cover: slide through its meeting point
   for (const b of co.beats) {
      if (!b.low || (b.phase >= 0 && !inPhase(run, b.phase))) continue;
      if (b.s - r.s < 2.5 && b.s - r.s > -1) input.slide = true;
   }

   // the hero's route
   if (!fixed && bot.routes) {
      if (hero === "vexa") {
         for (const cv of co.caves) {
            if (r.s > cv.s1 || cv.s0 - r.s > 22) continue;
            target = 3;
            fixed = true;
            if (cv.s0 - r.s < 0.4 * v && cv.s0 > r.s && run.ms >= run.powerReadyAt) input.actionPressed = true;
         }
      } else if (hero === "nami") {
         for (const m of co.mesas) {
            if (r.s > m.s1 - 2 || m.s0 - r.s > 25) continue;
            target = 1;
            fixed = true;
            if (cur === 1 && r.swapAt < 0 && r.h <= 0.001 && m.s0 - r.s < 0.5 * v && m.s0 - r.s > 0.3 * v) input.jumpPressed = true;
            if (!r.onMesa && r.h > 1.0 && r.h < MESA_Y && r.vy < 1 && r.airHops === 0) input.jumpPressed = true;
         }
      } else if (hero === "zuno" || hero === "kiro") {
         for (const g of co.goo) {
            if (r.s > g.s1 || g.s0 - r.s > 20) continue;
            fixed = true;
            if (hero === "kiro") {
               target = g.lane;
               if (g.s0 - r.s < 1 && run.ms >= run.powerReadyAt) input.actionPressed = true;
            } else {
               target = sideLane(run, g.lane, g.lane, r.s);
               if (Math.abs(target - g.lane) > 1) target = g.lane === 1 ? 0 : 1;
               if (g.s0 - r.s < 3 && run.ms >= run.powerReadyAt) input.actionPressed = true;
            }
         }
      }
   }

   // the track's orbs
   if (!fixed) {
      let best = Infinity;
      for (let i = 0; i < co.orbs.length; i++) {
         const o = co.orbs[i];
         if (o.bonus !== null || run.collected[i] || o.s < r.s - 0.3 || o.s > r.s + 30) continue;
         if (o.s < best) {
            best = o.s;
            target = o.lane;
         }
      }
   }

   // keep out of goo (unless Kiro's shield is the plan)
   if (target !== 3 && !(hero === "kiro" && bot.routes && run.shieldUntil > run.ms) && gooAhead(run, target, r.s - 1, r.s + 6) && !(hero === "kiro" && bot.routes && fixed)) {
      target = sideLane(run, target, target, r.s);
   }

   // steer (one press at a time, once the last change is done)
   if (r.swapAt < 0 && target !== cur && run.ms - bot.pressAt > 100 && !r.onMesa && run.ms >= r.heldUntil) {
      if (target < cur) input.left = true;
      else if (cur !== 2 || caveAt(run, r.s) >= 0 || target < 3) input.right = true;
      bot.pressAt = run.ms;
   }

   // rocks and blobs: jump; arches: slide
   const lane = r.lane;
   for (const o of co.obstacles) {
      if (o.lane !== lane || !inPhase(run, o.phase)) continue;
      const d = o.s - r.s;
      if (d < -0.5) continue;
      if (d > v) break;
      if (o.kind === "arch") {
         if (d < 0.5 * v) input.slide = true;
      } else if (d > 0 && d < 0.3 * v && r.h <= 0.001 && !r.onMesa) input.jumpPressed = true;
      else if (d > 0 && d < 0.1 * v && r.h > 0 && r.h < CLEAR_H) input.jumpPressed = true;
   }
   if (input.slide) input.jumpPressed = false;
}
