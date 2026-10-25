// An honest climbing bot: it reads only what a player sees (the platforms, where the movers are now)
// and plays through step() with the stick and the jump press. Pure; used by rules.test.ts (the
// limits proof's "best real run") and by the preview-only ?autoplay=1 (Scene.tsx, screenshots).
//
// Each frame: the target is the platform after the one it stands on (the route is the course order).
// On the ground it runs at the target and jumps on the first frame from which a look-ahead (a copy
// of the run, jumping now and steering at the target) lands on it; it brakes instead of running off
// an edge. A pad platform: it walks onto the pad. In the air it steers at the target.
import { NONE, createRun, onSupport, step, supportX, supportZ, type SkyRun, type StepInput } from "./rules";
import { PAD_HALF } from "./rules";

export interface Bot {
   /** the frame time (ms) the look-ahead simulates with */
   frameMs: number;
   /** the highest support index stood on so far */
   reached: number;
   scratch: SkyRun;
   scratchInput: StepInput;
}

export function createBot(run: SkyRun, frameMs = 1000 / 60): Bot {
   return { frameMs, reached: 0, scratch: createRun(run.seed, run.level), scratchInput: { moveX: 0, moveZ: 0, jumpPressed: false } };
}

/** Copies the mutable run state (not the course or the events) from `src` into `dst`. */
export function copyRun(src: SkyRun, dst: SkyRun): void {
   dst.simMs = src.simMs;
   dst.remainder = src.remainder;
   dst.stepMs = src.stepMs;
   Object.assign(dst.hero, src.hero);
   dst.pressMs = src.pressMs;
   dst.checkpoint = src.checkpoint;
   dst.respawns = src.respawns;
   dst.collected.set(src.collected);
   dst.orbs = src.orbs;
   dst.finishMs = src.finishMs;
   dst.bestTop = src.bestTop;
   dst.ended = src.ended;
}

/** The stick towards (tx, tz): full when far, proportional within 0.4 m. */
function steerTo(run: SkyRun, tx: number, tz: number, input: StepInput): void {
   const dx = tx - run.hero.x;
   const dz = tz - run.hero.z;
   const d = Math.sqrt(dx * dx + dz * dz);
   const k = d > 0.4 ? 1 / d : 2.5;
   input.moveX = dx * k;
   input.moveZ = dz * k;
}

function targetOf(bot: Bot, run: SkyRun): number {
   return Math.min(run.course.supports.length - 1, bot.reached + 1);
}

/** Steer at the target platform's centre (where a mover is now); onto the pad on a pad platform. */
function steer(bot: Bot, run: SkyRun, input: StepInput): void {
   const h = run.hero;
   input.jumpPressed = false;
   const supports = run.course.supports;
   if (h.grounded && supports[h.support].pad) {
      const s = supports[h.support];
      steerTo(run, s.cx, s.cz, input);
      return;
   }
   const t = supports[targetOf(bot, run)];
   steerTo(run, supportX(t, run.simMs), supportZ(t, run.simMs), input);
}

/** Does a jump now, steering at the target, land on it (or beyond) within 2 s? */
function jumpLands(bot: Bot, run: SkyRun): boolean {
   const sim = bot.scratch;
   const input = bot.scratchInput;
   copyRun(run, sim);
   const target = targetOf(bot, run);
   steer(bot, sim, input);
   input.jumpPressed = true;
   let left = 2000;
   let first = true;
   while (left > 0 && sim.ended === null) {
      step(sim, bot.frameMs, input);
      left -= bot.frameMs;
      if (first) {
         first = false;
         if (sim.hero.grounded && !sim.events.jumped) return false;
      }
      input.jumpPressed = false;
      if (sim.hero.state !== "play") return false;
      if (sim.events.landedOn !== NONE) return sim.events.landedOn >= target;
      if (sim.hero.grounded) return sim.hero.support >= target;
      steer(bot, sim, input);
   }
   return sim.ended === "win";
}

/** Would `frames` frames of running at the target leave the ground (run off an edge)? */
function runsOff(bot: Bot, run: SkyRun, frames: number): boolean {
   const sim = bot.scratch;
   const input = bot.scratchInput;
   copyRun(run, sim);
   for (let i = 0; i < frames; i++) {
      steer(bot, sim, input);
      step(sim, bot.frameMs, input);
      if (!sim.hero.grounded || sim.hero.state !== "play") return true;
   }
   return false;
}

/** Fills `input` for this frame. */
export function botInput(bot: Bot, run: SkyRun, input: StepInput): void {
   const h = run.hero;
   if (h.grounded && h.support !== NONE && h.support > bot.reached) bot.reached = h.support;
   if (run.events.landedOn > bot.reached) bot.reached = run.events.landedOn;
   // after a fall: carry on from the checkpoint
   if (run.events.respawned) bot.reached = run.course.checkpoints[run.checkpoint];
   steer(bot, run, input);
   if (h.state !== "play" || !h.grounded) return;
   const supports = run.course.supports;
   const here = supports[h.support];
   if (here.pad && Math.abs(h.x - here.cx) <= PAD_HALF + 0.5 && Math.abs(h.z - here.cz) <= PAD_HALF + 0.5) return;
   const target = supports[targetOf(bot, run)];
   if (target.top <= here.top + 1e-6 && !target.mover) {
      // same height or lower, static: walk across (a bridge) or off the edge onto it
      return;
   }
   if (onSupport(target, h.x, h.z, run.simMs) && Math.abs(target.top - h.y) < 1e-6) return;
   if (jumpLands(bot, run)) {
      input.jumpPressed = true;
      return;
   }
   if (runsOff(bot, run, 4)) {
      input.moveX = 0;
      input.moveZ = 0;
   }
}
