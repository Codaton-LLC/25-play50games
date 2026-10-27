// An honest bot: it follows the level's route (ruins.ts: the blocks to stand on, the levers to set,
// the water levels to wait for, the boss's moves) and plays only through step() with the stick, the
// jump press and Jump held, like a player who knows the level. Pure; used by the tests (the limits
// proof's "best real run") and by the preview-only ?autoplay=1 (Scene.tsx, screenshots).
//
// "go": on land it runs at the block and jumps on the first frame from which a look-ahead (a copy of
// the run, jumping now and steering at the block) lands on it; it brakes instead of running off an
// edge it should not take. In the water it swims at the block holding Jump and leaps on the first
// frame a look-ahead leap lands. "lever": it walks into the lever until it shows the position,
// stepping out to pull again. "wait": it stands still until a chamber's water passes a level.
import { copyCombo } from "@/arcade3d/menu2/combo/combo";
import { copySecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import {
   BOSS_R,
   FLOAT_DEPTH,
   LEVER_R,
   LEVER_REARM,
   NONE,
   SURFACE_REACH,
   createRun,
   createStepInput,
   onSupport,
   step,
   supportTop,
   surfaceAt,
   zoneLevel,
   type RuinRun,
   type StepInput,
   type Support,
} from "./rules";

export interface Bot {
   /** the frame time (ms) the look-ahead simulates with */
   frameMs: number;
   /** the route step being worked on */
   at: number;
   /** a lever step: stepping away to re-arm the lever */
   backing: boolean;
   scratch: RuinRun;
   scratchInput: StepInput;
}

export function createBot(run: RuinRun, frameMs = 1000 / 60): Bot {
   return { frameMs, at: 0, backing: false, scratch: createRun(run.seed, run.level, run.heroId), scratchInput: createStepInput() };
}

/** Copies the mutable run state (not the course or the events) from `src` into `dst`. */
export function copyRun(src: RuinRun, dst: RuinRun): void {
   dst.simMs = src.simMs;
   dst.remainder = src.remainder;
   dst.stepMs = src.stepMs;
   dst.heroId = src.heroId;
   Object.assign(dst.hero, src.hero);
   dst.pressMs = src.pressMs;
   dst.jumpHeld = src.jumpHeld;
   dst.actionMs = src.actionMs;
   dst.powerReadyAt = src.powerReadyAt;
   dst.checkpoint = src.checkpoint;
   dst.respawns = src.respawns;
   dst.collected.set(src.collected);
   dst.orbs = src.orbs;
   dst.mainOrbs = src.mainOrbs;
   dst.finishMs = src.finishMs;
   copyCombo(src.combo, dst.combo);
   dst.visited.set(src.visited);
   dst.pulled.set(src.pulled);
   dst.armed.set(src.armed);
   copySecretTracker(src.secrets, dst.secrets);
   dst.hits = src.hits;
   dst.bestTop = src.bestTop;
   dst.tideFrom = src.tideFrom;
   dst.water.fromY.set(src.water.fromY);
   dst.water.fromMs.set(src.water.fromMs);
   dst.water.target.set(src.water.target);
   dst.water.cycle.set(src.water.cycle);
   dst.levers.pos.set(src.levers.pos);
   dst.levers.at.set(src.levers.at);
   dst.broken.set(src.broken);
   if (src.boss && dst.boss) Object.assign(dst.boss, src.boss);
   dst.bossOwner = true;
   Object.assign(dst.bossPose, src.bossPose);
   dst.ended = src.ended;
}

/** The stick towards (tx, tz): full when far, proportional within 0.4 m. */
function steerTo(run: RuinRun, tx: number, tz: number, input: StepInput): void {
   const dx = tx - run.hero.x;
   const dz = tz - run.hero.z;
   const d = Math.sqrt(dx * dx + dz * dz);
   const k = d > 0.4 ? 1 / d : 2.5;
   input.moveX = dx * k;
   input.moveZ = dz * k;
}

/** The point of block `s` the bot aims at: its centre (the orbs sit on the centre lines). */
function aimAt(_run: RuinRun, s: Support, out: { x: number; z: number }): void {
   out.x = s.cx;
   out.z = s.cz;
}

const AIM = { x: 0, z: 0 };

function standingOn(run: RuinRun, target: number): boolean {
   const h = run.hero;
   if (h.state !== "play" || h.support !== target) return false;
   return h.grounded || h.swim;
}

/** Steer at the go-target (inside its rectangle). In the water: hold Jump unless the target is a flooded floor. */
function steerGo(run: RuinRun, target: number, input: StepInput): void {
   const s = run.course.supports[target];
   aimAt(run, s, AIM);
   steerTo(run, AIM.x, AIM.z, input);
   const h = run.hero;
   if (h.swim) {
      const surface = surfaceAt(run.course, run.water, h.x, h.z, run.simMs);
      const top = supportTop(run.course, run.water, s, run.simMs);
      input.jumpHeld = top > surface - 0.5 || h.air < 2500;
   } else input.jumpHeld = false;
}

/** Does a jump (or a leap from the water) now, steering at the target, land on it within 2.4 s, unhurt? */
function jumpLands(bot: Bot, run: RuinRun, target: number): boolean {
   const sim = bot.scratch;
   const input = bot.scratchInput;
   copyRun(run, sim);
   steerGo(sim, target, input);
   input.jumpPressed = true;
   input.actionPressed = false;
   let left = 2400;
   let first = true;
   while (left > 0 && sim.ended === null) {
      step(sim, bot.frameMs, input);
      left -= bot.frameMs;
      if (first) {
         first = false;
         if (!sim.events.jumped) return false;
      }
      input.jumpPressed = false;
      if (sim.hero.state !== "play") return false;
      if (sim.events.landedOn !== NONE) return sim.events.landedOn === target;
      if (sim.hero.swim) return false;
      steerGo(sim, target, input);
      input.jumpHeld = false;
   }
   return sim.ended === "win";
}

/** Would `frames` frames of steering at the target leave the block (run off an edge) without reaching it? */
function runsOff(bot: Bot, run: RuinRun, target: number, frames: number): boolean {
   const sim = bot.scratch;
   const input = bot.scratchInput;
   copyRun(run, sim);
   for (let i = 0; i < frames; i++) {
      steerGo(sim, target, input);
      input.jumpPressed = false;
      step(sim, bot.frameMs, input);
      if (sim.hero.state !== "play") return true;
      if (standingOn(sim, target)) return false;
      if (!sim.hero.grounded && !sim.hero.swim) {
         // a walk-off is fine when the fall lands on the target (dropping into a trench)
         for (let f = 0; f < 120 && sim.ended === null; f++) {
            steerGo(sim, target, input);
            step(sim, bot.frameMs, input);
            if (sim.hero.state !== "play") return true;
            if (standingOn(sim, target)) return false;
            if (sim.hero.swim) {
               // into the water: fine when the target is the flooded floor down there
               const sh = sim.hero;
               const surf = surfaceAt(sim.course, sim.water, sh.x, sh.z, sim.simMs);
               return !(supportTop(sim.course, sim.water, sim.course.supports[target], sim.simMs) < surf - 0.5);
            }
            if (sim.hero.grounded) return sim.hero.support !== target;
         }
         return true;
      }
   }
   return false;
}

/** Would steering at the target for the next `frames` frames (no jump) get the hero hurt (a steam jet, a bat, the boss)? */
function hurtAhead(bot: Bot, run: RuinRun, target: number, frames: number): boolean {
   const sim = bot.scratch;
   const input = bot.scratchInput;
   copyRun(run, sim);
   for (let i = 0; i < frames && sim.ended === null; i++) {
      steerGo(sim, target, input);
      input.jumpPressed = false;
      step(sim, bot.frameMs, input);
      if (sim.events.lost) return sim.hero.lostCause !== "fall";
      if (standingOn(sim, target) && i > 4) return false;
   }
   return false;
}

/** Hold still (keep the water's swim-up as it is) instead of walking into a hazard. */
function holdStill(input: StepInput): void {
   input.moveX = 0;
   input.moveZ = 0;
}

function goStep(bot: Bot, run: RuinRun, target: number, input: StepInput): boolean {
   if (standingOn(run, target)) return true;
   const h = run.hero;
   steerGo(run, target, input);
   if (h.state !== "play") return false;
   const s = run.course.supports[target];
   if (h.swim) {
      const surface = surfaceAt(run.course, run.water, h.x, h.z, run.simMs);
      if (h.y >= surface - FLOAT_DEPTH - SURFACE_REACH && supportTop(run.course, run.water, s, run.simMs) > h.y + 0.3 && jumpLands(bot, run, target)) input.jumpPressed = true;
      return false;
   }
   if (!h.grounded) return false;
   const top = supportTop(run.course, run.water, s, run.simMs);
   if (hurtAhead(bot, run, target, Math.ceil(700 / bot.frameMs))) {
      holdStill(input);
      return false;
   }
   // a block at or under the feet, touching or below: walk (a drop into a trench is a walk-off)
   if (top <= h.y + 1e-6 && !runsOff(bot, run, target, 6)) return false;
   if (onSupport(s, h.x, h.z) && Math.abs(top - h.y) < 1e-6) return false;
   if (jumpLands(bot, run, target)) {
      input.jumpPressed = true;
      return false;
   }
   if (runsOff(bot, run, target, Math.ceil(170 / bot.frameMs) + 1)) {
      input.moveX = 0;
      input.moveZ = 0;
   }
   return false;
}

function leverStep(bot: Bot, run: RuinRun, li: number, pos: number, input: StepInput): boolean {
   if (run.levers.pos[li] === pos) {
      bot.backing = false;
      return true;
   }
   const l = run.course.levers[li];
   // the pressure levers only matter in phase 2: after a respawn later on they are skipped
   if (l.kind === "pressure" && run.boss && run.boss.phase >= 2) return true;
   const h = run.hero;
   input.jumpHeld = h.swim && h.y < l.y - 0.4;
   if (!run.armed[li]) {
      // step back out of the trigger so the next touch pulls again
      const dx = h.x - l.x;
      const dz = h.z - l.z;
      const d = Math.max(1e-3, Math.sqrt(dx * dx + dz * dz));
      steerTo(run, l.x + (dx / d) * (LEVER_REARM + 0.4), l.z + (dz / d) * (LEVER_REARM + 0.4), input);
      return false;
   }
   steerTo(run, l.x, l.z, input);
   void LEVER_R;
   return false;
}

function waitStep(run: RuinRun, zone: number, atLeast: number | undefined, atMost: number | undefined, input: StepInput): boolean {
   const y = zoneLevel(run.water, zone, run.simMs);
   input.moveX = 0;
   input.moveZ = 0;
   input.jumpHeld = run.hero.swim;
   if (atLeast !== undefined && y < atLeast) return false;
   if (atMost !== undefined && y > atMost) return false;
   return true;
}

function swimStep(run: RuinRun, x: number, z: number, dive: number | undefined, input: StepInput): boolean {
   const h = run.hero;
   steerTo(run, x, z, input);
   // hold Jump to rise; under a roof keep the feet at `dive` (let go to sink, hold to stay)
   input.jumpHeld = dive === undefined ? true : h.y < dive - 0.15;
   if (dive !== undefined && h.swim && h.y > dive + 0.6) {
      // still too high to pass under: sink where you are first
      input.moveX *= 0.25;
      input.moveZ *= 0.25;
   }
   return Math.hypot(h.x - x, h.z - z) < 0.8 && h.swim;
}

function walkStep(run: RuinRun, x: number, z: number, input: StepInput): boolean {
   const h = run.hero;
   steerTo(run, x, z, input);
   input.jumpHeld = h.swim;
   return Math.hypot(h.x - x, h.z - z) < 0.5;
}

/** Fills `input` for this frame. */
export function botInput(bot: Bot, run: RuinRun, input: StepInput): void {
   input.jumpPressed = false;
   input.actionPressed = false;
   input.jumpHeld = false;
   input.moveX = 0;
   input.moveZ = 0;
   const route = run.course.route;
   // after a loss: back to the step whose block is the respawn checkpoint (or the start)
   if (run.events.respawned) {
      const cp = run.course.checkpoints[run.checkpoint];
      let k = 0;
      for (let i = 0; i < route.length; i++) {
         const st = route[i];
         if ("go" in st && st.go === cp) k = i + 1;
      }
      bot.at = Math.min(bot.at, k);
   }
   for (let guard = 0; guard < 4 && bot.at < route.length; guard++) {
      const st = route[bot.at];
      let done = false;
      if ("go" in st) done = goStep(bot, run, st.go, input);
      else if ("lever" in st) done = leverStep(bot, run, st.lever, st.pos, input);
      else if ("wait" in st) done = waitStep(run, st.wait, st.atLeast, st.atMost, input);
      else if ("swim" in st) done = swimStep(run, st.swim[0], st.swim[1], st.dive, input);
      else if ("walk" in st) done = walkStep(run, st.walk[0], st.walk[1], input);
      else done = bossStep(bot, run, st.boss, input);
      if (!done) return;
      bot.at += 1;
      input.jumpPressed = false;
      input.moveX = 0;
      input.moveZ = 0;
   }
}

/** The boss's moves (level 5): land on its back, wait for phase 2, touch it in the geyser, pull the floodgate. */
function bossStep(bot: Bot, run: RuinRun, kind: "stomp" | "p2-wait" | "geyser" | "gate", input: StepInput): boolean {
   const b = run.boss;
   const arena = run.course.boss;
   if (!b || !arena) return true;
   const phase = kind === "stomp" ? 0 : kind === "gate" ? 2 : 1;
   // done once that phase is over and the hero is back on its feet (or swimming): never steer on mid-bounce
   if (b.phase > phase || b.step === "defeat" || b.step === "done") return run.hero.grounded || run.hero.swim || run.hero.state !== "play";
   const p = run.bossPose;
   const h = run.hero;
   if (kind === "stomp") {
      // from the step over the basin: when it floats, jump onto its back
      if (h.swim) {
         input.jumpHeld = true;
         return false;
      }
      if (!h.grounded) steerTo(run, p.x, p.z, input);
      else if (p.mode === "float" && bossJumpHits(bot, run)) {
         input.jumpPressed = true;
         steerTo(run, p.x, p.z, input);
      }
      return false;
   }
   if (kind === "p2-wait") {
      // stand clear of the drain until its next wind-up, then run the levers
      return b.phase === 1 && b.step === "telegraph";
   }
   if (kind === "geyser") {
      if (p.mode === "geyser") {
         steerTo(run, p.x, p.z, input);
         if (h.grounded && Math.hypot(h.x - p.x, h.z - p.z) < 2.2) input.jumpPressed = true;
      } else if (b.step === "telegraph" || (b.step === "vulnerable" && !geyserUpNow(run))) {
         // the window was missed: wait for the next wind-up and pull the levers again
         bot.at = Math.max(0, bot.at - 4);
      } else {
         // wait beside the drain
         const dx = h.x - p.x;
         const dz = h.z - p.z;
         const d = Math.max(1e-3, Math.hypot(dx, dz));
         steerTo(run, p.x + (dx / d) * 2.4, p.z + (dz / d) * 2.4, input);
      }
      return false;
   }
   // the floodgate: step into the lever while the boss sits on the gate
   const li = arena.gateLever;
   const l = run.course.levers[li];
   if (p.mode !== "gate" || !run.armed[li]) {
      const d = Math.max(1e-3, Math.hypot(h.x - l.x, h.z - l.z));
      steerTo(run, l.x + ((h.x - l.x) / d) * (LEVER_REARM + 0.4), l.z + ((h.z - l.z) / d) * (LEVER_REARM + 0.4), input);
      return false;
   }
   steerTo(run, l.x, l.z, input);
   return false;
}

function geyserUpNow(run: RuinRun): boolean {
   const arena = run.course.boss!;
   return arena.pressure.every((li) => run.levers.pos[li] !== 0);
}

/** Does a jump now, steering at the floating boss, hit its back? */
function bossJumpHits(bot: Bot, run: RuinRun): boolean {
   const sim = bot.scratch;
   const input = bot.scratchInput;
   copyRun(run, sim);
   input.jumpPressed = true;
   input.jumpHeld = false;
   input.actionPressed = false;
   for (let f = 0, n = Math.ceil(1500 / bot.frameMs); f < n && sim.ended === null; f++) {
      steerTo(sim, sim.bossPose.x, sim.bossPose.z, input);
      step(sim, bot.frameMs, input);
      input.jumpPressed = false;
      if (sim.events.bossHit) return true;
      if (sim.hero.state !== "play" || (f > 2 && (sim.hero.grounded || sim.hero.swim))) return false;
   }
   return false;
}
