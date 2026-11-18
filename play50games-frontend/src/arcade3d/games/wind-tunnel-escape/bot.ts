// The honest bot (tests, and `?autoplay=1` on preview builds): it only writes a StepInput, exactly what a
// player's keys or touch give (stick in world space with yaw 0, Jump, Action pressed / held), and reads
// the run to decide. It follows the course's plan (tunnel.ts writes one per room: go there, wait for the
// lift, turn this fan to n, switch that vent on, wait for the rail fan's far dwell, wait for the drone)
// and plays the Gale Engine (bossInput). After a respawn it replays the room it came back in.
import type { BotStep } from "./tunnel";
import { HOLD_MS, autoLeftMs, dronePos, fanDir, nearestFan, railDwell, type StepInput, type WindRun } from "./rules";

export interface Bot {
   step: number;
   /** ms the current step began (stuck guard) */
   since: number;
   /** an Action press in flight: frames held so far (0 = none) and how long it must be held */
   pressFrames: number;
   holdMs: number;
   pressAt: number;
   respawns: number;
   /** the frame time it plays at (ms), for its timing look-ahead */
   frameMs: number;
   /** the boss script's progress */
   boss: number;
}

export function createBot(_run: WindRun, frameMs = 1000 / 60): Bot {
   return { step: 0, since: 0, pressFrames: 0, holdMs: 0, pressAt: 0, respawns: 0, frameMs, boss: 0 };
}

const P = { x: 0, y: 0, z: 0 };

function clearInput(i: StepInput): void {
   i.moveX = 0;
   i.moveZ = 0;
   i.yaw = 0;
   i.jumpPressed = false;
   i.jumpHeld = false;
   i.actionPressed = false;
   i.actionHeld = false;
}

/** Steer towards (x, z); true once within r. */
function steer(run: WindRun, i: StepInput, x: number, z: number, r = 0.45): boolean {
   const h = run.hero;
   const dx = x - h.x;
   const dz = z - h.z;
   const d = Math.hypot(dx, dz);
   if (d <= r) return true;
   const k = Math.min(1, d * 1.6) / d;
   i.moveX = dx * k;
   i.moveZ = dz * k;
   return false;
}

/** Action: a tap (press, release next frame) or a hold of holdMs. Returns true while a press is still in flight. */
function press(bot: Bot, run: WindRun, i: StepInput, holdMs: number): boolean {
   if (bot.pressFrames === 0) {
      bot.pressFrames = 1;
      bot.holdMs = holdMs;
      bot.pressAt = run.ms;
      i.actionPressed = true;
      i.actionHeld = true;
      return true;
   }
   if (bot.holdMs > 0 && run.ms - bot.pressAt < bot.holdMs) {
      bot.pressFrames += 1;
      i.actionHeld = true;
      return true;
   }
   // released this frame
   bot.pressFrames = 0;
   i.actionHeld = false;
   return true;
}

/** One frame of input for the run (writes into `input`). */
export function botInput(bot: Bot, run: WindRun, input: StepInput): void {
   clearInput(input);
   const h = run.hero;
   const c = run.course;
   if (run.respawns !== bot.respawns) {
      bot.respawns = run.respawns;
      bot.pressFrames = 0;
      bot.step = c.botStart[run.checkpoint] ?? 0;
      bot.since = run.ms;
      bot.boss = 0;
   }
   if (h.state !== "play" || run.ended) return;
   // finish an Action press in flight first (a release frame turns the fan)
   if (bot.pressFrames > 0) {
      press(bot, run, input, bot.holdMs);
      return;
   }
   const plan = c.bot;
   for (let guard = 0; guard < 8 && bot.step < plan.length; guard++) {
      const s = plan[bot.step];
      if (doStep(bot, run, s, input)) {
         bot.step += 1;
         bot.since = run.ms;
         clearInput(input);
         continue;
      }
      return;
   }
   // past the plan: walk on towards the goal
   steer(run, input, (c.goal.x0 + c.goal.x1) / 2, (c.goal.z0 + c.goal.z1) / 2, 0.1);
}

/** Does one plan step's frame; true when it is done. */
function doStep(bot: Bot, run: WindRun, s: BotStep, input: StepInput): boolean {
   const h = run.hero;
   const w = run.world;
   const c = run.course;
   switch (s.t) {
      case "go":
         // stepping into a current: done once it carries you
         if (s.ride && h.riding > 0) return true;
         return steer(run, input, s.x, s.z, s.r ?? 0.45);
      case "waitY":
         return h.y >= s.y;
      case "turn": {
         if (fanDir(run, s.fan) === s.dir) return true;
         if (!steer(run, input, s.from.x, s.from.z, 0.2)) return false;
         if (w.turnUntil[s.fan] > run.ms || nearestFan(run) !== s.fan) return false;
         press(bot, run, input, 0);
         return false;
      }
      case "switch": {
         if ((w.on[s.fan] === 1) === s.on) return true;
         if (!steer(run, input, s.from.x, s.from.z, 0.2)) return false;
         if (nearestFan(run) !== s.fan) return false;
         press(bot, run, input, c.fans[s.fan].kind === "vent" ? 0 : HOLD_MS + 40);
         return false;
      }
      case "timing": {
         const f = c.fans[s.fan];
         if (s.want === "railEnd") {
            const d = railDwell(f, run.ms);
            return d.end === 1 && d.leftMs >= (s.minLeftMs ?? 0);
         }
         return fanDir(run, s.fan) === (s.dir ?? 0) && autoLeftMs(f, run.ms) >= (s.minLeftMs ?? 0);
      }
      case "clear": {
         // the ride reaches the drone's line about this long from now; its swing must be away then
         const lead = Math.max(0, (h.z - s.z) / 7) * 1000 + 300;
         for (let dt = -500; dt <= 500; dt += 100) {
            dronePos(c, s.drone, run.ms + lead + dt, P);
            if (Math.abs(P.x - s.x) < 2.2) return false;
         }
         return true;
      }
      case "boss":
         return bossInput(bot, run, input);
   }
}

/**
 * The Gale Engine: aim the three side fans at the intake from behind them (outside the blast lane), the
 * middle one only right after a blast; wait out phase 1 beside the lane; then for each crate turn its
 * high fan forward and switch its vent on, and wait for the gate. Done when the gate is open.
 */
function bossInput(bot: Bot, run: WindRun, input: StepInput): boolean {
   const a = run.course.arena!;
   const w = run.world;
   const b = w.boss!;
   const h = run.hero;
   const zs = a.z0 + 1;
   if (b.step === "done") return true;
   const safe = { x: 5.2, z: zs - 2 };
   const busy = (fan: number, dir: number, fromX: number, fromZ: number): boolean => {
      if (w.dir[fan] === dir) return false;
      if (!steer(run, input, fromX, fromZ, 0.3)) return true;
      if (w.turnUntil[fan] > run.ms || nearestFan(run) !== fan) return true;
      press(bot, run, input, 0);
      return true;
   };
   if (b.phase === 0 && b.step !== "transition") {
      const [left, right, mid] = a.sideFans;
      if (!w.spent[left] && busy(left, 0, -5.6, zs - 5.4)) return false;
      if (!w.spent[right] && busy(right, 0, 5.6, zs - 5.4)) return false;
      if (!w.spent[mid] && w.dir[mid] !== 0) {
         // only between blasts: the middle fan stands in the lane
         if (b.step === "vulnerable" || b.step === "intro") {
            if (busy(mid, 0, 1.6, zs - 1.4)) return false;
         }
      }
      steer(run, input, safe.x, safe.z, 0.3);
      return false;
   }
   if (b.phase >= 1 && b.step !== "defeat") {
      for (let k = 0; k < a.crateFans.length; k++) {
         const f = a.crateFans[k];
         const v = a.crateVents[k];
         const fx = run.course.fans[f].x;
         if (w.crates[k]?.state === "in") continue;
         if (busy(f, 0, fx, zs - 12.2)) return false;
         if (!w.on[v]) {
            const vx = run.course.fans[v].x;
            const from = vx < -1 ? { x: vx - 2.0, z: zs - 18 } : vx > 1 ? { x: vx + 2.0, z: zs - 18 } : { x: 1.8, z: zs - 16.9 };
            // round the pillars, then down beside the vent
            const pre = vx < -1 ? -5.6 : vx > 1 ? 5.6 : 1.8;
            if (h.z > zs - 16 && Math.abs(h.x - pre) > 0.4) {
               steer(run, input, pre, zs - 12.2, 0.3);
               return false;
            }
            if (!steer(run, input, from.x, from.z, 0.3)) return false;
            if (nearestFan(run) !== v) return false;
            press(bot, run, input, 0);
            return false;
         }
      }
   }
   // wait by the side of the lane, behind the pillars
   steer(run, input, safe.x, h.z < zs - 10 ? zs - 11 : safe.z, 0.3);
   return false;
}
