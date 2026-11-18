// The honest bot (tests, and `?autoplay=1` on preview builds): it only writes a StepInput (the stick in
// world space with yaw 0, Jump, swap presses, duck, Action), exactly what a player's keys or touch give,
// and reads the run to decide: lean into every curve, hop rocks and gaps at the right moment, duck beams
// and breaths, swap round crystals, lavafalls and Cindermaw's fireballs, hop her plates and collar locks,
// ride her ramps. It never uses a power.
import { V_HOP, G, NONE, bossDone, lavaOn, laneBeside, type CaveRun, type StepInput } from "./rules";
import { segmentAt } from "./track";

export interface Bot {
   frameMs: number;
   swapAt: number;
}

export function createBot(_run: CaveRun, frameMs = 1000 / 60): Bot {
   return { frameMs, swapAt: -1 };
}

const AIR = (2 * V_HOP) / G;

function clearInput(i: StepInput): void {
   i.moveX = 0;
   i.moveZ = 0;
   i.yaw = 0;
   i.jumpPressed = false;
   i.swapLeft = false;
   i.swapRight = false;
   i.duck = false;
   i.actionPressed = false;
}

/** How far ahead (m) this lane's first danger is: a crystal, a lavafall on when the cart gets there, fireballs. Infinity if none within reach. */
function dangerAt(run: CaveRun, lane: number, s: number, reach: number): number {
   const c = run.course;
   const v = c.config.speed;
   let best = Infinity;
   for (const hz of c.hazards) {
      if (hz.lane !== lane) continue;
      const d = hz.s - s;
      if (d < -hz.len - 1 || d > reach || d >= best) continue;
      if (hz.kind === "crystal") best = Math.max(0, d);
      else if (hz.kind === "lavafall") {
         // the arrival window, widened for the lean's faster curves and a margin
         const t0 = run.ms + (Math.max(0, d) / (v * 1.15)) * 1000 - 300;
         const t1 = run.ms + ((d + hz.len + 2) / v) * 1000 + 300;
         for (let t = t0; t <= t1; t += 50) {
            if (lavaOn(hz, t)) {
               best = Math.max(0, d);
               break;
            }
         }
      }
   }
   if (lane === 0 && run.boss && !bossDone(run) && run.boss.phase === 1 && (run.boss.step === "telegraph" || run.boss.step === "attack")) best = 0;
   if (lane === 0 && run.fireballsUntil > run.ms) best = 0;
   return best;
}

/** One frame of input (writes into `input`). */
export function botInput(bot: Bot, run: CaveRun, input: StepInput): void {
   clearInput(input);
   const c = run.cart;
   const co = run.course;
   if (c.state !== "ride" || run.ended) return;
   const v = c.v || co.config.speed;
   const s = c.s;
   // lean into the curve (towards its inside)
   const seg = segmentAt(co, s);
   const next = segmentAt(co, s + v * 0.15);
   const curve = seg.turn !== 0 ? seg : next.turn !== 0 ? next : null;
   if (curve) {
      const i = Math.min(co.samples.length / 4 - 1, Math.round(s / 0.5));
      const h = co.samples[i * 4 + 3];
      const inside = curve.turn > 0 ? -1 : 1;
      input.moveX = Math.cos(h) * inside;
      input.moveZ = -Math.sin(h) * inside;
   }
   // which lane: the plan's, the boss's, then away from danger
   let want = 0;
   for (const p of co.bot) if (p.s <= s) want = p.lane;
   if (run.boss && co.loop && s >= co.loop.s0 - 30 && !bossDone(run)) {
      const out = co.bossEvents.find((e) => e.kind === "ramp")!.lane;
      want = run.boss.phase === 1 ? out : 0;
   }
   const ok = (l: number) => l !== NONE && s >= co.lanes[l].s0 - 1 && s <= co.lanes[l].s1 - 4;
   if (!ok(want)) want = 0;
   // away from a danger close ahead: to the lane (main or a fork beside) whose first danger is farthest
   const mine = dangerAt(run, want, s, 60);
   if (mine < 40) {
      let best = mine;
      for (const cand of [0, laneBeside(run, want, 1, s), laneBeside(run, want, -1, s)]) {
         if (cand === NONE || !ok(cand) || (cand !== 0 && co.lanes[cand].kind !== "fork")) continue;
         const d = dangerAt(run, cand, s, 60);
         if (d > best + 1) {
            best = d;
            want = cand;
         }
      }
   }
   if (want !== c.lane && run.ms > bot.swapAt) {
      const dw = co.lanes[want].d - co.lanes[c.lane].d;
      if (Math.abs(dw) > 0.1) {
         // world right with yaw 0 is screen right; the cart's right is turned by its heading
         const i = Math.min(co.samples.length / 4 - 1, Math.round(s / 0.5));
         const h = co.samples[i * 4 + 3];
         const side = Math.sign(dw);
         const screenRight = Math.cos(h) >= 0 ? 1 : -1;
         if (side * screenRight > 0) input.swapRight = true;
         else input.swapLeft = true;
         bot.swapAt = run.ms + 250;
      }
   }
   // hop: rocks (peak over them), gaps (centred), the boss's plates and locks
   const ahead = (x: number) => (x - s) / v;
   for (const hz of co.hazards) {
      if (hz.lane !== c.lane && !(hz.kind === "beam")) continue;
      if (hz.kind === "rock") {
         const t = ahead(hz.s);
         if (t > 0 && t <= AIR / 2 && c.h <= 0.01) input.jumpPressed = true;
      } else if (hz.kind === "gap") {
         const t = ahead(hz.s);
         const lead = Math.max(0.03, (AIR - hz.len / v) / 2);
         if (t > 0 && t <= lead && c.h <= 0.01) input.jumpPressed = true;
      } else if (hz.kind === "beam") {
         const t = ahead(hz.s);
         if (t > -0.05 && t < 0.35) input.duck = true;
      }
   }
   if (run.boss && co.loop && run.boss.hp > 0) {
      for (const e of co.bossEvents) {
         if (e.kind === "ramp" || e.phase !== run.boss.phase || e.lane !== c.lane) continue;
         // the loop wraps: look at this lap's spot
         const t = ahead(e.s);
         if (t > 0 && t <= AIR / 2 && c.h <= 0.01) input.jumpPressed = true;
      }
   }
   // duck the breaths aimed at this lane
   for (const br of run.breaths) if (br.lane === c.lane && run.ms > br.fireAt - 160 && run.ms < br.fireAt + 640) input.duck = true;
   if (input.duck && input.jumpPressed) input.jumpPressed = false;
}
