// The honest bot (tests, ?autoplay=1): it plays the table only through StepInput, like a player. The
// rules are deterministic, so when the ball comes down to the flippers it tries a set of flips (which
// flipper, when, how long, or a cradle) on copies of the run, plays each one 1.5 s ahead with a simple
// reflex after it, and keeps the one that makes progress on the current objective (or brings the ball
// nearest its target) without draining. Away from the flippers the reflex keeps the ball alive.
import { inputToWorld } from "@/arcade3d/core/math";
import { BALL_R, FLIPPER_LEN } from "./table";
import { cloneRun, createStepInput, currentObjective, exitOpen, step, type PinRun, type StepInput } from "./rules";

export interface Plan {
   /** 0 left, 1 right, -1 no flip */
   side: number;
   startMs: number;
   holdMs: number;
}

export interface Bot {
   plan: Plan | null;
   nextSearch: number;
   charge: number;
   /** searches run (cost check in tests) */
   searches: number;
   /** the last rules ms the ball was down at the flippers */
   zoneAt: number;
}

export function createBot(_run?: PinRun): Bot {
   return { plan: null, nextSearch: 0, charge: 0.9, searches: 0, zoneAt: 0 };
}

const SEARCH_MS = 60;
const HORIZON_MS = 1500;
const ROLL_DT = 16;
const DELAYS = [0, 30, 60, 90, 120, 160, 200, 250, 300];

/** A ball that has not come down to the flippers for this long is caught in a loop: nudge toward the drain. */
const LOOP_MS = 8000;

function clearInput(i: StepInput): void {
   i.moveX = i.moveZ = 0;
   i.left = i.right = i.jumpPressed = i.jumpHeld = i.actionPressed = i.actionHeld = false;
}

/** Distance from the ball to flipper i's blade. */
function bladeDist(run: PinRun, i: number): number {
   const f = run.table.flippers[i];
   const a = run.flip[i];
   const dx = f.side * Math.cos(a);
   const dz = Math.sin(a);
   const b = run.ball;
   const t = Math.max(0, Math.min(FLIPPER_LEN, (b.x - f.px) * dx + (b.z - f.pz) * dz));
   return Math.hypot(b.x - (f.px + dx * t), b.z - (f.pz + dz * t));
}

/** The reflex: flip a flipper the ball is coming down onto. */
export function reflex(run: PinRun, input: StepInput): void {
   const b = run.ball;
   if (b.mode !== "roll" || b.layer !== 0 || b.z < -7) return;
   for (let i = 0; i < 2; i++) {
      if (bladeDist(run, i) < 1.15 && b.vz > 0.8) {
         if (i === 0) input.left = true;
         else input.right = true;
      }
   }
}

function inZone(run: PinRun): boolean {
   const b = run.ball;
   return b.mode === "roll" && b.layer === 0 && b.h < 0.3 && b.z > -6.5 && b.x < 5.4;
}

/** Progress so far: stages, counts, lit lanterns, dropped targets, boss damage, the win. */
export function progressKey(run: PinRun): number {
   const p = run.prog;
   let k = p.stage * 1000 + p.count * 10;
   for (let i = 0; i < p.lit.length; i++) k += p.lit[i] * 10;
   for (let i = 0; i < p.down.length; i++) if (run.table.targets[i].bank >= 0) k += p.down[i] * 10;
   if (run.boss) k += (6 - run.boss.hp) * 1000;
   if (run.ended === "win") k += 100_000;
   return k;
}

/** Where the ball should go next (table x, z), and whether arriving fast matters. */
export function targetOf(run: PinRun, out: { x: number; z: number }): { x: number; z: number } {
   const t = run.table;
   const b = run.ball;
   const near = (list: { x: number; z: number }[]) => {
      let best = Infinity;
      for (const c of list) {
         const d = Math.hypot(c.x - b.x, c.z - b.z);
         if (d < best) {
            best = d;
            out.x = c.x;
            out.z = c.z;
         }
      }
   };
   out.x = 0;
   out.z = -18;
   if (exitOpen(run)) {
      out.x = t.hole.x;
      out.z = t.hole.z;
      return out;
   }
   const o = currentObjective(run);
   if (!o) return out;
   if (o.kind === "bumpers") near(t.bumpers.filter((c) => c.layer === 0));
   else if (o.kind === "ramp") near(t.ramps.filter((r) => r.kind === "ramp").map((r) => ({ x: r.ex + r.dx * 0.6, z: r.ez + r.dz * 0.6 })));
   else if (o.kind === "orbits") near(t.mushrooms);
   else if (o.kind === "lanterns") near(t.lanterns.filter((_, i) => !run.prog.lit[i]));
   else if (o.kind === "bank") near(t.targets.filter((x, i) => x.bank === o.bank && !run.prog.down[i]));
   else if (o.kind === "boss" && run.boss) {
      const golden = run.goldenUntil > run.simMs + 2000;
      const ramp = t.ramps[0];
      if (run.boss.phase === 2 || (run.boss.phase === 1 && !golden)) {
         out.x = ramp.ex + ramp.dx * 0.6;
         out.z = ramp.ez + ramp.dz * 0.6;
      } else {
         out.x = run.rollo.x;
         out.z = run.rollo.z;
      }
   }
   return out;
}

const T = { x: 0, z: 0 };
const SIM_IN = createStepInput();

function score(run: PinRun, plan: Plan): number {
   const r = cloneRun(run);
   const k0 = progressKey(run);
   const balls0 = run.ballsLeft;
   let best = Infinity;
   const end = run.simMs + HORIZON_MS;
   while (r.simMs < end && r.ended === null) {
      clearInput(SIM_IN);
      const inPlan = plan.side >= 0 && r.simMs >= plan.startMs && r.simMs < plan.startMs + plan.holdMs;
      if (inPlan) {
         if (plan.side === 0) SIM_IN.left = true;
         else SIM_IN.right = true;
      } else if (r.simMs >= plan.startMs + plan.holdMs) reflex(r, SIM_IN);
      const ev = step(r, ROLL_DT, SIM_IN);
      if (ev.lost || ev.saved || r.ballsLeft < balls0 || r.ended === "lose") return -5000 + (r.simMs - run.simMs);
      const k = progressKey(r);
      if (k > k0) return 10_000 + (k - k0) - (r.simMs - run.simMs) * 0.5;
      if (r.ball.mode === "ramp") return 4000 - (r.simMs - run.simMs) * 0.5;
      if (r.simMs > plan.startMs + 120) {
         targetOf(r, T);
         const d = Math.hypot(r.ball.x - T.x, r.ball.z - T.z) - BALL_R;
         if (d < best) best = d;
      }
   }
   if (r.ended === "win") return 100_000;
   // a ball still near the flippers at the end is a held chance, not a wasted one
   return -best * 10 - (r.ball.z > -4 ? 30 : 0);
}

function search(bot: Bot, run: PinRun): Plan {
   bot.searches++;
   const now = run.simMs;
   let bestPlan: Plan = { side: -1, startMs: now, holdMs: 0 };
   let bestScore = score(run, bestPlan);
   for (let side = 0; side < 2; side++) {
      if (bladeDist(run, side) > 3.2) continue;
      for (const d of DELAYS) {
         for (const hold of [180, 700]) {
            const plan = { side, startMs: now + d, holdMs: hold };
            const s = score(run, plan);
            if (s > bestScore) {
               bestScore = s;
               bestPlan = plan;
            }
         }
      }
   }
   return bestPlan;
}

export function botInput(bot: Bot, run: PinRun, input: StepInput): void {
   clearInput(input);
   const b = run.ball;
   if (run.ended !== null) return;
   if (b.mode === "plunger") {
      // charge to the bot's mark and let go
      input.jumpHeld = b.charge < bot.charge;
      bot.plan = null;
      return;
   }
   if (b.mode !== "roll") {
      bot.plan = null;
      return;
   }
   // Kiro: the shield when the ball is falling into the drain
   if (run.heroId === "kiro" && !run.powerUsed && b.z > -1.6 && b.vz > 2 && Math.abs(b.x) < 1.6) input.actionPressed = true;
   const p = bot.plan;
   if (p && run.simMs < p.startMs + p.holdMs) {
      if (p.side >= 0 && run.simMs >= p.startMs) {
         if (p.side === 0) input.left = true;
         else input.right = true;
      }
      return;
   }
   bot.plan = null;
   if (inZone(run) || b.layer === 1) bot.zoneAt = run.simMs;
   else if (run.simMs - bot.zoneAt > LOOP_MS) {
      // the stick that nudges the table toward the drain (+z) whatever the camera's yaw
      const a = inputToWorld(1, 0, input.yaw);
      const c = inputToWorld(0, 1, input.yaw);
      input.moveX = a.z;
      input.moveZ = c.z;
   }
   if (inZone(run) && run.simMs >= bot.nextSearch) {
      bot.plan = search(bot, run);
      bot.nextSearch = run.simMs + SEARCH_MS;
      if (bot.plan.side < 0) bot.plan = null;
      else {
         if (bot.plan.startMs <= run.simMs) {
            if (bot.plan.side === 0) input.left = true;
            else input.right = true;
         }
         return;
      }
   }
   reflex(run, input);
}
