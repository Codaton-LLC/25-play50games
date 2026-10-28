// The honest bot (tests, the limit proof, and ?autoplay=1 on preview builds): it plays like a good
// player with the stick, Dive and nothing else. It leaps at once, steers for the next main ring or orb
// below it (aiming where a moving ring will be when it gets there), dives on long aligned drops and
// spreads to steer near a target, keeps to the centre of level 4's slots (the blades sweep the rim),
// takes level 3's slow wide line (more rings), and on level 5 threads the wake rings, dives into the
// fin and the open belly, keeps between the lightning lanes and drops onto the tail pad.
// It reads the run only (never changes it) and writes a StepInput in world space (yaw 0).
import { NONE, RAY, STEER_DIVE, STEER_SPREAD, V_DIVE, V_SPREAD, createRayPose, eyeHolds, ringPos, rayPose, type RingRun, type StepInput } from "./rules";

export interface Bot {
   /** the route: course ring (>= 0) or orb (-1 - i) targets, high to low */
   route: number[];
   cursor: number;
   frameMs: number;
}

const POS = { x: 0, z: 0 };
const RAY_POSE = createRayPose();

export function createBot(run: RingRun, frameMs = 1000 / 60): Bot {
   const c = run.course;
   const items: { y: number; id: number }[] = [];
   c.rings.forEach((r, i) => {
      if (!r.main) return;
      // level 3: the slow wide line (its speed rings are the other line)
      if (run.level === 3 && r.kind === "speed") return;
      items.push({ y: r.y, id: i });
   });
   c.orbs.forEach((o, i) => {
      if (o.gate !== "none") return;
      items.push({ y: o.y, id: -1 - i });
   });
   items.sort((a, b) => b.y - a.y);
   return { route: items.map((t) => t.id), cursor: 0, frameMs };
}

function targetY(run: RingRun, id: number): number {
   return id >= 0 ? run.course.rings[id].y : run.course.orbs[-1 - id].y;
}

function done(run: RingRun, id: number): boolean {
   return id >= 0 ? run.threaded[id] === 1 : run.taken[-1 - id] === 1;
}

/** Steers the hero so it is over (tx, tz) in `t` seconds; returns the stick written into input (world). */
function steerTo(run: RingRun, tx: number, tz: number, t: number, input: StepInput, diving: boolean): number {
   const h = run.hero;
   const dx = tx - h.x;
   const dz = tz - h.z;
   const d = Math.hypot(dx, dz);
   const steer = diving ? STEER_DIVE : STEER_SPREAD;
   // the speed that arrives in time, braking near the target
   const want = Math.min(steer, d / Math.max(0.08, t * 0.8), Math.sqrt(2 * 26 * d));
   const vx = d > 1e-6 ? (dx / d) * want : 0;
   const vz = d > 1e-6 ? (dz / d) * want : 0;
   // a little ahead of the current velocity error
   input.moveX = Math.max(-1, Math.min(1, (vx + (vx - h.vx) * 0.3) / steer));
   input.moveZ = Math.max(-1, Math.min(1, (vz + (vz - h.vz) * 0.3) / steer));
   return d;
}

export function botInput(bot: Bot, run: RingRun, input: StepInput): void {
   const h = run.hero;
   input.yaw = 0;
   input.actionPressed = false;
   input.jumpPressed = false;
   input.moveX = input.moveZ = 0;
   if (h.mode === "perch") {
      input.jumpPressed = true;
      input.jumpHeld = false;
      return;
   }
   if (h.mode !== "fall") {
      input.jumpHeld = false;
      return;
   }
   const c = run.course;
   const fall = Math.max(6, -h.vy);
   if (run.boss && eyeHolds(run)) {
      bossInput(run, input);
      return;
   }
   // the next target below that is not taken and can still be reached
   while (bot.cursor < bot.route.length && (done(run, bot.route[bot.cursor]) || targetY(run, bot.route[bot.cursor]) > h.y - 0.05)) bot.cursor++;
   let k = bot.cursor;
   let tx = c.pad.x;
   let tz = c.pad.z;
   let ty = c.pad.y;
   let found = false;
   for (; k < bot.route.length && k < bot.cursor + 4; k++) {
      const id = bot.route[k];
      if (done(run, id)) continue;
      const y = targetY(run, id);
      const t = (h.y - y) / fall;
      let x: number;
      let z: number;
      if (id >= 0) {
         ringPos(c.rings[id], run.simMs + t * 1000, POS);
         x = POS.x;
         z = POS.z;
      } else {
         const o = c.orbs[-1 - id];
         x = o.x;
         z = o.z;
      }
      let d = Math.hypot(x - h.x, z - h.z);
      const reach = STEER_SPREAD * t;
      if (id >= 0 && d > reach) {
         // the centre is too far: any point well inside the ring still threads it
         const r = c.rings[id].r * 0.6;
         if (d - r > reach) continue;
         x -= ((x - h.x) / d) * r;
         z -= ((z - h.z) / d) * r;
         d -= r;
      } else if (id < 0 && d > reach + 1) continue;
      tx = x;
      tz = z;
      ty = y;
      found = true;
      break;
   }
   if (!found && c.boss) {
      if (run.boss) {
         // the final drop: over the tail pad where it will be (it circles slowly)
         rayPose(run, run.simMs, RAY_POSE);
         const t = Math.max(0.1, (h.y - 3) / fall);
         const a = Math.atan2(RAY_POSE.z, RAY_POSE.x) + 0.25 * Math.min(t, 4);
         const rad = Math.hypot(RAY_POSE.x, RAY_POSE.z);
         tx = Math.cos(a) * rad;
         tz = Math.sin(a) * rad;
         ty = 3;
      } else {
         // level 5's opening done: wait over the centre for the eye
         tx = 0;
         tz = 0;
         ty = c.arena ? c.arena.top : c.pad.y;
      }
   }
   const below = h.y - ty;
   const tSpread = below / Math.max(fall, 1);
   const off = Math.hypot(tx - h.x, tz - h.z);
   // dive only while every target in the next 34 m lies on this vertical line (a dive needs ~0.7 s,
   // about 20 m, to slow back down to steer); spread to steer near a target
   let lined = found || below > 30;
   for (let j = k + 1; lined && found && j < bot.route.length; j++) {
      const id = bot.route[j];
      const y = targetY(run, id);
      if (h.y - y > 34) break;
      if (done(run, id)) continue;
      let x: number;
      let z: number;
      if (id >= 0) {
         ringPos(c.rings[id], run.simMs + ((h.y - y) / V_DIVE) * 1000, POS);
         x = POS.x;
         z = POS.z;
      } else {
         x = c.orbs[-1 - id].x;
         z = c.orbs[-1 - id].z;
      }
      if (Math.hypot(x - tx, z - tz) > 1.5) lined = false;
   }
   if (found && k + 1 >= bot.route.length && below < 30 && !c.boss) lined = Math.hypot(c.pad.x - tx, c.pad.z - tz) < 1.5;
   const dive = lined && off < 1.0 && !h.inUpdraft && below > 6;
   input.jumpHeld = dive;
   steerTo(run, tx, tz, dive ? below / V_DIVE : Math.max(tSpread, below / V_SPREAD), input, dive);
}

/** Level 5 in the eye: wake rings, the fin, the lanes, the belly, the tail pad. */
function bossInput(run: RingRun, input: StepInput): void {
   const h = run.hero;
   const b = run.boss!;
   rayPose(run, run.simMs, RAY_POSE);
   input.jumpHeld = false;
   if (!eyeHolds(run)) {
      // the final drop: over the tail pad (it circles slowly), spread so it surfaces in time
      const t = Math.max(0.1, (h.y - 3) / Math.max(6, -h.vy));
      const a = Math.atan2(RAY_POSE.z, RAY_POSE.x) + 0.25 * Math.min(t, 4);
      const rad = Math.hypot(RAY_POSE.x, RAY_POSE.z);
      steerTo(run, Math.cos(a) * rad, Math.sin(a) * rad, t, input, false);
      return;
   }
   if (b.phase === 0) {
      if (b.step === "vulnerable" && run.charged) {
         const d = steerTo(run, RAY_POSE.hx, RAY_POSE.hz, 0.4, input, false);
         input.jumpHeld = d < 2.2;
         return;
      }
      // the soonest wake ring below
      let best = NONE;
      for (let i = 0; i < run.wake.length; i++) {
         const w = run.wake[i];
         if (!w.alive || w.y > h.y - 0.05) continue;
         if (best < 0 || w.y > run.wake[best].y) best = i;
      }
      if (best >= 0) {
         const w = run.wake[best];
         steerTo(run, w.x, w.z, Math.max(0.15, (h.y - w.y) / 8), input, false);
      } else {
         // follow the Ray's path a little ahead of it
         const a = Math.atan2(RAY_POSE.z, RAY_POSE.x) - 0.4;
         steerTo(run, Math.cos(a) * RAY.spiral.radius, Math.sin(a) * RAY.spiral.radius, 0.8, input, false);
      }
      return;
   }
   if (b.step === "vulnerable") {
      const d = steerTo(run, RAY_POSE.hx, RAY_POSE.hz, 0.3, input, false);
      input.jumpHeld = d < 2.6;
      return;
   }
   // between the lanes (they cross at the axis): 8 m out, half way between two of them
   const th = run.lanes[0] + Math.PI / 6;
   const sx = Math.cos(th) * 8;
   const sz = Math.sin(th) * 8;
   const ox = -sx;
   const oz = -sz;
   const near = Math.hypot(h.x - sx, h.z - sz) < Math.hypot(h.x - ox, h.z - oz);
   steerTo(run, near ? sx : ox, near ? sz : oz, 0.5, input, false);
}
