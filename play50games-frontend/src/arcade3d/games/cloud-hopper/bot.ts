// An honest hopping-and-gliding bot: it reads only what a player sees (the clouds where they are now,
// the orbs, the feathers, the boss's ring) and plays through step() with the stick, the jump press and
// Jump held. Pure; used by the tests (the limits proof's "best real run") and by the preview-only
// ?autoplay=1 (Scene.tsx). It never uses the hero power.
//
// On a cloud: it first walks over the cloud's orb and, before a glide gap, its feather; then it runs at
// the next route cloud and jumps on the first frame from which a look-ahead (a copy of the run, jumping
// now and flying with the same air policy) lands on it. In the air it steers at the target (or a mid-air
// orb on the way) and holds Jump only while a plain fall would land short (so the meter lasts).
import { copyCombo } from "@/arcade3d/menu2/combo/combo";
import { copySecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { FOOT, G, NONE, ORB, V_RUN, cloudTop, cloudX, createRun, heroVy, step, type CloudRun, type StepInput } from "./rules";

export interface Bot {
   frameMs: number;
   /** the route position of the last route cloud stood on */
   reached: number;
   scratch: CloudRun;
   scratchInput: StepInput;
   /** per route position: the main orbs on that cloud, and its feather (or NONE) */
   cloudOrbs: number[][];
   cloudFeather: number[];
   /** per route position: mid-air main orbs over the gap after that cloud */
   gapOrbs: number[][];
   /** cloud index -> route position (NONE off the route) */
   routePos: number[];
}

export function createBot(run: CloudRun, frameMs = 1000 / 60): Bot {
   const c = run.course;
   const routePos = new Array<number>(c.clouds.length).fill(NONE);
   c.route.forEach((ci, k) => (routePos[ci] = k));
   const cloudOrbs: number[][] = c.route.map(() => []);
   const gapOrbs: number[][] = c.route.map(() => []);
   const cloudFeather = c.route.map(() => NONE);
   c.orbs.forEach((o, i) => {
      if (o.kind !== "main") return;
      for (let k = 0; k < c.route.length; k++) {
         const s = c.clouds[c.route[k]];
         if (Math.abs(o.z - s.cz) <= s.hd + 0.01 && Math.abs(o.x - s.cx) <= s.hw + 2 && Math.abs(o.y - s.top - 0.9) < 0.05) {
            cloudOrbs[k].push(i);
            return;
         }
      }
      // a mid-air orb: over the gap after the route cloud just before it
      for (let k = 0; k + 1 < c.route.length; k++) {
         const a = c.clouds[c.route[k]];
         const b = c.clouds[c.route[k + 1]];
         if (o.z < a.cz - a.hd && o.z > b.cz + b.hd) {
            gapOrbs[k].push(i);
            return;
         }
      }
   });
   c.feathers.forEach((f, i) => {
      for (let k = 0; k < c.route.length; k++) {
         const s = c.clouds[c.route[k]];
         if (Math.abs(f.z - s.cz) <= s.hd && Math.abs(f.x - s.cx) <= s.hw) cloudFeather[k] = i;
      }
   });
   return {
      frameMs,
      reached: 0,
      scratch: createRun(run.seed, run.level, run.heroId),
      scratchInput: { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false },
      cloudOrbs,
      cloudFeather,
      gapOrbs,
      routePos,
   };
}

/** Copies the mutable run state (not the course or the events) from `src` into `dst`. */
export function copyRun(src: CloudRun, dst: CloudRun): void {
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
   dst.mainOrbs = src.mainOrbs;
   dst.featherAt.set(src.featherAt);
   dst.landAt.set(src.landAt);
   dst.ringPassed.set(src.ringPassed);
   dst.broken.set(src.broken);
   dst.visited.set(src.visited);
   copyCombo(src.combo, dst.combo);
   copySecretTracker(src.secrets, dst.secrets);
   dst.hits = src.hits;
   dst.streak = src.streak;
   dst.bestStreak = src.bestStreak;
   dst.bestDist = src.bestDist;
   dst.finishMs = src.finishMs;
   dst.ended = src.ended;
   if (src.boss && dst.boss) Object.assign(dst.boss, src.boss);
   dst.charges = src.charges;
   dst.chaseZ = src.chaseZ;
   Object.assign(dst.eye, src.eye);
   Object.assign(dst.hail, src.hail);
}

function steerTo(run: CloudRun, tx: number, tz: number, input: StepInput): void {
   const dx = tx - run.hero.x;
   const dz = tz - run.hero.z;
   const d = Math.sqrt(dx * dx + dz * dz);
   const k = d > 0.4 ? 1 / d : 2.5;
   input.moveX = dx * k;
   input.moveZ = dz * k;
}

function targetPos(bot: Bot, run: CloudRun): number {
   return Math.min(run.course.route.length - 1, bot.reached + 1);
}

/** The air policy: steer at the target (or a mid-air orb before it); hold Jump while a plain fall lands short. */
function air(bot: Bot, run: CloudRun, input: StepInput): void {
   const h = run.hero;
   const c = run.course;
   const ms = run.simMs;
   const k = targetPos(bot, run);
   const t = c.clouds[c.route[k]];
   const tx = cloudX(t, ms);
   let ax = tx;
   let az = t.cz;
   let wantY = Number.NEGATIVE_INFINITY;
   const gap = bot.gapOrbs[k - 1];
   if (gap) {
      for (const i of gap) {
         const o = c.orbs[i];
         if (run.collected[i] || o.z > h.z + 0.2) continue;
         ax = o.x;
         az = o.z;
         wantY = o.y - ORB.centerY;
         break;
      }
   }
   // the boss's ring: fly through it while it is open (level 5)
   if (run.boss && run.eye.live && run.boss.phase >= 1 && run.eye.z < h.z + 0.5 && run.eye.z > h.z - 8) {
      ax = run.eye.x;
      wantY = Math.max(wantY, run.eye.y - ORB.centerY - 0.4);
   }
   steerTo(run, ax, az, input);
   const top = cloudTop(run, c.route[k], ms);
   const goalTop = top === top ? top : t.top;
   // the distance still to cover to the target's near edge, and the time a plain fall takes to reach its crown
   const dx = Math.max(0, Math.abs(h.x - tx) - t.hw - FOOT + 0.3);
   const dz = Math.max(0, h.z - (t.cz + t.hd + FOOT) + 0.3);
   const d = Math.sqrt(dx * dx + dz * dz);
   const vy = heroVy(h, ms);
   const dy = h.y - goalTop;
   const disc = vy * vy + 2 * G * dy;
   const fallS = disc < 0 ? Infinity : (vy + Math.sqrt(disc)) / G;
   let glide = d > (V_RUN - 0.4) * fallS;
   if (h.y < wantY + 0.2 && d > 0.5) glide = true;
   input.jumpHeld = glide;
}

function steer(bot: Bot, run: CloudRun, input: StepInput): void {
   const h = run.hero;
   input.jumpPressed = false;
   input.actionPressed = false;
   input.jumpHeld = false;
   // the bot steers in world space: no camera turn
   input.yaw = 0;
   const c = run.course;
   if (!h.grounded) {
      air(bot, run, input);
      return;
   }
   const here = bot.routePos[h.support];
   const ms = run.simMs;
   if (here !== NONE) {
      for (const i of bot.cloudOrbs[here]) {
         if (run.collected[i]) continue;
         const o = c.orbs[i];
         steerTo(run, o.x, o.z, input);
         return;
      }
      const f = bot.cloudFeather[here];
      if (f !== NONE && h.glideMs < 3000) {
         const at = run.featherAt[f];
         if (at < 0 || ms - at >= 4000) {
            const fd = c.feathers[f];
            steerTo(run, fd.x, fd.z, input);
            return;
         }
      }
   }
   // on the bridge before the boss is down: walk into its ring when it opens, else stay near the start of the bridge
   if (run.boss && h.support === c.goal) {
      const g = c.clouds[c.goal];
      if (run.eye.live) steerTo(run, run.eye.x, run.eye.z - 1, input);
      else steerTo(run, g.cx, g.cz + g.hd - 1.5, input);
      return;
   }
   const t = c.clouds[c.route[targetPos(bot, run)]];
   steerTo(run, cloudX(t, ms), t.cz, input);
}

/** Does a jump now land on the target (or further along the route) within 4 s? */
function jumpLands(bot: Bot, run: CloudRun): boolean {
   const sim = bot.scratch;
   const input = bot.scratchInput;
   copyRun(run, sim);
   const target = targetPos(bot, run);
   const save = bot.reached;
   steer(bot, sim, input);
   input.jumpPressed = true;
   let left = 4000;
   let first = true;
   let ok = false;
   while (left > 0 && sim.ended === null) {
      step(sim, bot.frameMs, input);
      left -= bot.frameMs;
      if (first) {
         first = false;
         if (sim.hero.grounded && !sim.events.jumped) break;
      }
      input.jumpPressed = false;
      if (sim.hero.state !== "play") break;
      if (sim.events.landedOn !== NONE || sim.hero.grounded) {
         const p = bot.routePos[sim.hero.support];
         ok = p !== NONE && p >= target;
         break;
      }
      steer(bot, sim, input);
   }
   if (sim.ended === "win") ok = true;
   bot.reached = save;
   return ok;
}

function runsOff(bot: Bot, run: CloudRun, frames: number): boolean {
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
export function botInput(bot: Bot, run: CloudRun, input: StepInput): void {
   const h = run.hero;
   if (h.grounded && h.support !== NONE && h.state === "play") {
      const p = bot.routePos[h.support];
      if (p !== NONE) bot.reached = p;
   }
   if (run.events.respawned) bot.reached = bot.routePos[run.course.checkpoints[run.checkpoint]];
   steer(bot, run, input);
   if (h.state !== "play" || !h.grounded) return;
   const c = run.course;
   if (h.support === c.goal) return;
   // still busy on this cloud (an orb or the feather): no jump yet unless the cloud is about to go
   const here = bot.routePos[h.support];
   if (here !== NONE) {
      const busy = bot.cloudOrbs[here].some((i) => !run.collected[i]);
      if (busy) return;
   }
   if (jumpLands(bot, run)) {
      input.jumpPressed = true;
      return;
   }
   if (runsOff(bot, run, 4)) {
      input.moveX = 0;
      input.moveZ = 0;
   }
}
