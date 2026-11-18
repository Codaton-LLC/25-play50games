// An honest climbing bot: it reads only what a player sees (the pillars, where the movers are now, the
// vents, Kalder's phase) and plays through step() with the stick and the jump press. Pure; used by the
// tests (the limits proof's "best real run") and by the preview-only ?autoplay=1 (Scene.tsx, screenshots).
//
// The route: the target is the pillar after the one it stands on. On the ground it runs at the target
// and jumps on the first frame from which a look-ahead (a copy of the run, jumping now and steering at
// the target) lands on it; it brakes instead of running off an edge. Before a vent climb (a step too
// tall for a jump) it stands on the vent and waits for the beat; in a vent's flight it steers at the
// target. Level 5's arena: P1 and P3, it waits on a ring vent for Kalder's slam and steers its flight
// onto his hit zone; P2, it jumps onto his back and waits there for the opening. It never uses the power.
import { copyCombo } from "@/arcade3d/menu2/combo/combo";
import { copySecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { ACCEL, FOOT, H_JUMP, NONE, createRun, onSupport, step, supportX, supportZ, type LavaRun, type StepInput, type Support } from "./rules";

export interface Bot {
   /** the frame time (ms) the look-ahead simulates with */
   frameMs: number;
   /** the highest route support index stood on so far */
   reached: number;
   scratch: LavaRun;
   scratchInput: StepInput;
}

export function createBot(run: LavaRun, frameMs = 1000 / 60): Bot {
   return { frameMs, reached: 0, scratch: createRun(run.seed, run.level, run.heroId), scratchInput: { moveX: 0, moveZ: 0, jumpPressed: false, actionPressed: false } };
}

/** Copies the mutable run state (not the course or the events) from `src` into `dst`. */
export function copyRun(src: LavaRun, dst: LavaRun): void {
   dst.simMs = src.simMs;
   dst.remainder = src.remainder;
   dst.stepMs = src.stepMs;
   dst.heroId = src.heroId;
   Object.assign(dst.hero, src.hero);
   dst.pressMs = src.pressMs;
   dst.actionMs = src.actionMs;
   dst.powerReadyAt = src.powerReadyAt;
   dst.checkpoint = src.checkpoint;
   dst.respawns = src.respawns;
   dst.collected.set(src.collected);
   dst.orbs = src.orbs;
   dst.finishMs = src.finishMs;
   dst.bestTop = src.bestTop;
   dst.collapsed.set(src.collapsed);
   dst.heat.set(src.heat);
   dst.heatMs.set(src.heatMs);
   dst.heatOn = src.heatOn;
   dst.crumbleUntil.set(src.crumbleUntil);
   dst.crumbles = src.crumbles;
   copyCombo(src.combo, dst.combo);
   dst.visited.set(src.visited);
   copySecretTracker(src.secrets, dst.secrets);
   dst.hits = src.hits;
   if (src.boss && dst.boss) Object.assign(dst.boss, src.boss);
   dst.bossStartMs = src.bossStartMs;
   dst.ended = src.ended;
}

/** The stick towards (tx, tz): full when far, proportional within 0.4 m. */
function steerTo(run: LavaRun, tx: number, tz: number, input: StepInput): void {
   const dx = tx - run.hero.x;
   const dz = tz - run.hero.z;
   const d = Math.sqrt(dx * dx + dz * dz);
   const k = d > 0.4 ? 1 / d : 2.5;
   input.moveX = dx * k;
   input.moveZ = dz * k;
}

/** In the arena (the fight runs, or the hero stands in the ring). */
function inArena(run: LavaRun): boolean {
   if (!run.course.arena) return false;
   if (run.bossStartMs !== NONE) return true;
   const h = run.hero;
   return h.grounded && h.support !== NONE && run.course.supports[h.support].ring;
}

function targetOf(bot: Bot, run: LavaRun): number {
   return Math.min(run.course.route - 1, bot.reached + 1);
}

/** Does this pillar's next step need its vent (taller than a jump makes)? */
function needsVent(here: Support, target: Support): boolean {
   return !!here.vent && here.vent.lift && target.top - here.top > H_JUMP - 0.4;
}

/** The arena's goal for the stick this frame: a support index to stand on / jump to. */
function arenaTarget(run: LavaRun): { index: number; jump: boolean } {
   const a = run.course.arena!;
   const sup = run.course.supports;
   const h = run.hero;
   const boss = run.boss!;
   const here = h.grounded ? h.support : NONE;
   const zone = a.zones[Math.min(2, boss.phase)];
   if (here !== NONE && sup[here].zone > 0) return { index: here, jump: false };
   if (boss.phase === 1 && run.bossStartMs !== NONE && boss.step !== "defeat") return { index: zone, jump: true };
   // P1, P3, the intro and transitions: the ring vent nearest the hero
   if (here !== NONE && sup[here].ring && sup[here].vent) return { index: here, jump: false };
   let best = a.ring[1];
   let bestD = Infinity;
   for (let k = 1; k < a.ring.length; k++) {
      const s = sup[a.ring[k]];
      const d = Math.hypot(s.cx - h.x, s.cz - h.z);
      if (d < bestD) {
         bestD = d;
         best = a.ring[k];
      }
   }
   return { index: best, jump: true };
}

/** Steer at the target platform's centre (where a mover is now). */
function steer(bot: Bot, run: LavaRun, input: StepInput): void {
   const h = run.hero;
   input.jumpPressed = false;
   input.actionPressed = false;
   const supports = run.course.supports;
   if (inArena(run)) {
      const a = run.course.arena!;
      if (!h.grounded && h.ventFlight) {
         steerTo(run, a.cx, a.cz, input);
         return;
      }
      const t = supports[arenaTarget(run).index];
      steerTo(run, t.cx, t.cz, input);
      return;
   }
   if (h.grounded && h.support !== NONE) {
      const here = supports[h.support];
      const t = supports[targetOf(bot, run)];
      if (needsVent(here, t)) {
         steerTo(run, here.cx, here.cz, input);
         return;
      }
   }
   const t = supports[targetOf(bot, run)];
   steerTo(run, supportX(t, run.simMs), supportZ(t, run.simMs), input);
}

/** Does a jump now, steering at `target`, land on it (route: or beyond) within 2 s? */
function jumpLands(bot: Bot, run: LavaRun, target: number, exact: boolean): boolean {
   const sim = bot.scratch;
   const input = bot.scratchInput;
   copyRun(run, sim);
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
      if (sim.events.landedOn !== NONE) return exact ? sim.events.landedOn === target : sim.events.landedOn >= target && sim.events.landedOn < sim.course.route;
      if (sim.hero.grounded) return exact ? sim.hero.support === target : sim.hero.support >= target;
      steer(bot, sim, input);
   }
   return sim.ended === "win";
}

/** Would `frames` frames of running at the target leave the ground (run off an edge)? */
function runsOff(bot: Bot, run: LavaRun, frames: number): boolean {
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

/** Gap between two pillars where they are right now (not the mover's whole sweep). */
function standGapNow(a: Support, b: Support, ms: number): number {
   const dx = Math.max(0, Math.abs(supportX(a, ms) - supportX(b, ms)) - a.hw - b.hw - 2 * FOOT);
   const dz = Math.max(0, Math.abs(supportZ(a, ms) - supportZ(b, ms)) - a.hd - b.hd - 2 * FOOT);
   return Math.hypot(dx, dz);
}

/** Ice needs a longer brake: stop distance at ACCEL.ice, looked ahead in frames. */
function brakeFrames(bot: Bot, run: LavaRun): number {
   const h = run.hero;
   if (!h.grounded || h.support === NONE || !run.course.supports[h.support].slippery) return 4;
   const v = Math.max(1, Math.hypot(h.vx, h.vz));
   const stopMs = (v / ACCEL.ice) * 1000 + 140;
   return Math.min(40, Math.max(8, Math.ceil(stopMs / bot.frameMs)));
}

function brake(bot: Bot, run: LavaRun, input: StepInput): void {
   if (runsOff(bot, run, brakeFrames(bot, run))) {
      input.moveX = 0;
      input.moveZ = 0;
   }
}

/** Fills `input` for this frame. */
export function botInput(bot: Bot, run: LavaRun, input: StepInput): void {
   const h = run.hero;
   const supports = run.course.supports;
   const route = run.course.route;
   if (h.grounded && h.support !== NONE && h.state === "play" && h.support < route) {
      // a missed jump that lands on a lower step: climb again from there (the route is still in order)
      if (h.support < bot.reached && supports[h.support].top < supports[bot.reached].top - 1) bot.reached = h.support;
      else if (h.support > bot.reached) bot.reached = h.support;
   }
   if (run.events.landedOn > bot.reached && run.events.landedOn < route) bot.reached = run.events.landedOn;
   // after a fall: carry on from the checkpoint
   if (run.events.respawned) bot.reached = run.course.checkpoints[run.checkpoint];
   steer(bot, run, input);
   if (h.state !== "play" || !h.grounded) return;
   const here = supports[h.support];
   if (inArena(run)) {
      const t = arenaTarget(run);
      if (!t.jump || t.index === h.support) {
         // stand on the vent (or the zone) and wait: the stick settles at the centre
         return;
      }
      if (jumpLands(bot, run, t.index, true)) {
         input.jumpPressed = true;
         return;
      }
      brake(bot, run, input);
      return;
   }
   const target = supports[targetOf(bot, run)];
   if (needsVent(here, target)) return;
   if (target.top <= here.top + 1e-6 && !target.mover && standGapNow(here, target, run.simMs) < 0.02) {
      // touching pillars at the same height: walk across. A gap still needs a jump.
      return;
   }
   if (onSupport(target, h.x, h.z, run.simMs) && Math.abs(target.top - h.y) < 1e-6) return;
   if (jumpLands(bot, run, targetOf(bot, run), false)) {
      input.jumpPressed = true;
      return;
   }
   brake(bot, run, input);
}
