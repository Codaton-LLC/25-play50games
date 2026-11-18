// The honest bot (the tests, the proof and ?autoplay=1): it plays through the same StepInput a player
// has, with no knowledge the player lacks. Each link of the main route is one slide-launch along a
// compass direction: on snow it walks to the edge and jumps; on ice it brakes, slides back to the
// run-up start, then builds exactly the speed the gap needs and jumps when that speed lands it on the
// next platform's centre (a straight continuation keeps its slide). In the air it steers a little
// towards the target. On level 5 it climbs the golem's slope, steps or cairn, one target per phase,
// and waits in the arena while he is not open.
import { DIRS, dirBetween, halfAlong, type Plat } from "./course";
import { flightMs, grips, platSolid, ICE_ACCEL, V_ICE, V_LAUNCH_MIN, V_WALK, type PeakRun, type StepInput } from "./rules";

/** the bot lands at most this far inside a platform's near edge */
export const AIM_IN = 2.2;

export interface Bot {
   frameMs: number;
   /** ice: "settle" (stop, then go to the run-up start) or "run" */
   mode: "settle" | "run";
   /** the platform the plan is for (re-plans on a change) */
   plat: number;
   target: number;
   jumpCooldown: number;
}

export function createBot(_run: PeakRun, frameMs = 1000 / 60): Bot {
   return { frameMs, mode: "settle", plat: -1, target: -1, jumpCooldown: 0 };
}

/** The camera-relative stick for a world direction (yaw 0: the stick's up is -z). */
function stickFor(wx: number, wz: number, yaw: number, input: StepInput): void {
   // inverse of core/math inputToWorld: x = c mx + s my, z = -s mx + c my
   const c = Math.cos(yaw);
   const s = Math.sin(yaw);
   input.moveX = c * wx - s * wz;
   input.moveZ = s * wx + c * wz;
   const m = Math.hypot(input.moveX, input.moveZ);
   if (m > 1) {
      input.moveX /= m;
      input.moveZ /= m;
   }
}

/** The next platform the bot goes for from `p` (the route's next; level 5's arena: the current target). */
function nextTarget(run: PeakRun, p: Plat): Plat | null {
   const co = run.course;
   const a = co.arena;
   const arenaId = a ? co.route[co.route.length - 2] : -1;
   if (a && run.boss && run.bossAwake && run.boss.step !== "done") {
      // the boss chain for this phase, from the arena (or from where it stands on it)
      const chain = bossChain(run, run.boss.phase);
      const i = chain.indexOf(p.id);
      if (p.id === arenaId) return co.plats[chain[0]];
      if (i >= 0 && i + 1 < chain.length) return co.plats[chain[i + 1]];
      return null;
   }
   const i = co.route.indexOf(p.id);
   if (i >= 0 && i + 1 < co.route.length) {
      // level 5: the summit only once the golem is free
      if (a && co.route[i + 1] === co.goal && !(run.boss && run.boss.step === "done")) return null;
      return co.plats[co.route[i + 1]];
   }
   if (a && run.boss && run.boss.step === "done") {
      const chain = bossChain(run, 2);
      const j = chain.indexOf(p.id);
      if (j >= 0) return j + 1 < chain.length ? co.plats[chain[j + 1]] : co.plats[co.goal];
   }
   return null;
}

/** Level 5: the platforms (in order) up to a phase's target. */
export function bossChain(run: PeakRun, phase: number): number[] {
   const co = run.course;
   return co.plats.filter((p) => p.kind === "boss" && p.phase === phase).map((p) => p.id);
}

export function botInput(bot: Bot, run: PeakRun, input: StepInput): void {
   const h = run.hero;
   const co = run.course;
   input.moveX = 0;
   input.moveZ = 0;
   input.jumpPressed = false;
   input.actionPressed = false;
   input.brake = false;
   const yaw = input.yaw;
   bot.jumpCooldown -= bot.frameMs;
   if (h.state !== "play") return;
   if (h.riding >= 0) return;

   if (h.ground < 0) {
      // in the air: steer gently at the target's centre
      const t = bot.target >= 0 ? co.plats[bot.target] : null;
      if (t) {
         const dx = t.x - h.x;
         const dz = t.z - h.z;
         const d = Math.hypot(dx, dz);
         // only correct sideways drift (the launch set the along-speed)
         const sp = Math.hypot(h.vx, h.vz) || 1;
         const ux = h.vx / sp;
         const uz = h.vz / sp;
         const side = dx * -uz + dz * ux;
         if (d > 0.3) stickFor(-uz * Math.sign(side) * Math.min(1, Math.abs(side)), ux * Math.sign(side) * Math.min(1, Math.abs(side)), yaw, input);
      }
      return;
   }

   const p = co.plats[h.ground];
   if (bot.plat !== p.id) {
      bot.plat = p.id;
      bot.mode = "settle";
   }
   const q = nextTarget(run, p);
   if (!q) {
      // nothing to go for (waiting for the golem's window, or done): stand still on the centre
      park(run, p, input, yaw);
      return;
   }
   bot.target = q.id;
   if (!platSolid(run, q)) {
      park(run, p, input, yaw);
      return;
   }
   // a slam slope from the arena floor: walk to its foot, then up it
   if (q.ramp && !p.ramp) {
      const rd = DIRS[q.ramp.dir];
      const fx = q.x - rd.x * (halfAlong(q, q.ramp.dir) + 0.6);
      const fz = q.z - rd.z * (halfAlong(q, q.ramp.dir) + 0.6);
      const ex = fx - h.x;
      const ez = fz - h.z;
      const dist = Math.hypot(ex, ez);
      if (dist > 0.5 && bot.mode !== "run") stickFor(ex / Math.max(dist, 1), ez / Math.max(dist, 1), yaw, input);
      else {
         bot.mode = "run";
         stickFor(rd.x, rd.z, yaw, input);
      }
      return;
   }
   const dir = dirBetween(p, q);
   const d = DIRS[dir];
   const rise = q.y - (p.ramp && p.ramp.dir === dir ? p.y + p.ramp.rise : p.y);
   const t = flightMs(Math.max(-3, Math.min(rise, 2.0))) / 1000;
   // distance along the link from the hero to the target's centre, and to this platform's exit edge
   // aim at most 2.2 m inside the target's near edge (its centre when it is small)
   const along = (q.x - h.x) * d.x + (q.z - h.z) * d.z - halfAlong(q, dir) + Math.min(halfAlong(q, dir), AIM_IN);
   const lat = (q.x - h.x) * -d.z + (q.z - h.z) * d.x;
   // the exit: this platform's edge, or (a block standing on it) the block's near side
   const toEdge = Math.min(
      halfAlong(p, dir) - ((h.x - p.x) * d.x + (h.z - p.z) * d.z),
      (q.x - h.x) * d.x + (q.z - h.z) * d.z - halfAlong(q, dir) - 0.5,
   );
   const vNeed = along / t;
   const u = h.vx * d.x + h.vz * d.z;

   // a yeti's snowball about to land where we stand: on snow, step off its mark (the shadow shows it)
   const threat = run.throws.find((t) => !t.done && t.landAt - run.ms < 1000 && Math.hypot(t.x - h.x, t.z - h.z) < 1.7);
   if (threat && grips(run, p)) {
      const ax = h.x - threat.x;
      const az = h.z - threat.z;
      const am = Math.hypot(ax, az);
      // sideways to the link, away from the mark
      const sd = am > 0.05 ? Math.sign(ax * -d.z + az * d.x) || 1 : 1;
      stickFor(-d.z * sd, d.x * sd, yaw, input);
      return;
   }
   // on ice: never stand still on a mark; start the run from here
   if (threat && bot.mode === "settle") bot.mode = "run";

   if (grips(run, p)) {
      // snow: walk to the edge at the speed the gap wants (at least the launch floor), jump at the edge
      const want = Math.max(V_LAUNCH_MIN, Math.min(V_WALK, (toEdge + (along - toEdge)) / t));
      const vEdge = Math.max(V_LAUNCH_MIN, Math.min(V_WALK, (along - toEdge) / t));
      const v = toEdge > 1.2 ? Math.min(V_WALK, Math.max(want, 2.5)) : vEdge;
      const latFix = Math.max(-1, Math.min(1, lat * 1.5));
      stickFor((d.x * v + -d.z * latFix * 2) / V_WALK, (d.z * v + d.x * latFix * 2) / V_WALK, yaw, input);
      const reach = Math.max(Math.hypot(h.vx, h.vz), V_LAUNCH_MIN) * t;
      if (bot.jumpCooldown <= 0 && (toEdge < 0.35 || (reach >= along - 0.3 && toEdge < 1.2 && reach <= along + q.hx * 0.5 + q.hz * 0.5))) {
         input.jumpPressed = true;
         bot.jumpCooldown = 250;
      }
      return;
   }

   // ice: can the slide we have (plus the run left to the edge) make the speed the gap needs?
   const vAtEdge = Math.sqrt(Math.max(0, u * Math.abs(u) + 2 * ICE_ACCEL * Math.max(0, toEdge - 0.3)));
   const needEdge = Math.max(V_LAUNCH_MIN, (along - toEdge) / t);
   // keep the slide straight on through only off cracked ice (it shatters); else settle at the back
   if (bot.mode === "settle" && (p.surface === "cracked" || p.ramp) && u > -0.2 && vAtEdge >= needEdge && Math.abs(lat) < 0.6 && needEdge <= V_ICE) bot.mode = "run";
   if (bot.mode === "settle") {
      // stop, then slide to the run-up start (as far back as the platform allows, or as the speed needs)
      const runUp = 2 * halfAlong(p, dir) - 0.8;
      const sx = p.x + d.x * (halfAlong(p, dir) - 0.3 - runUp);
      const sz = p.z + d.z * (halfAlong(p, dir) - 0.3 - runUp);
      const ex = sx - h.x;
      const ez = sz - h.z;
      const dist = Math.hypot(ex, ez);
      const sp = Math.hypot(h.vx, h.vz);
      if (dist < 0.35 && sp < 0.5) {
         bot.mode = "run";
      } else {
         const vmax = Math.min(3, dist * 1.4);
         const tx = dist > 0.01 ? (ex / dist) * vmax : 0;
         const tz = dist > 0.01 ? (ez / dist) * vmax : 0;
         const cx = tx - h.vx;
         const cz = tz - h.vz;
         const cm = Math.hypot(cx, cz);
         if (cm > 0.05) stickFor(cx / Math.max(cm, 0.6), cz / Math.max(cm, 0.6), yaw, input);
         if (sp > 0.4 && (h.vx * ex + h.vz * ez < 0 || sp > vmax + 0.6)) input.brake = true;
      }
      return;
   }
   // run: hold the speed the remaining gap needs along the link, kill the sideways slide
   const vTarget = Math.max(needEdge, V_LAUNCH_MIN) + 0.15;
   const side = h.vx * -d.z + h.vz * d.x;
   const latV = Math.max(-1.5, Math.min(1.5, lat * 1.2)) - side;
   const ax = d.x * (vTarget - u) + -d.z * latV;
   const az = d.z * (vTarget - u) + d.x * latV;
   const am = Math.hypot(ax, az);
   if (am > 0.05) stickFor(ax / Math.max(am, 0.3), az / Math.max(am, 0.3), yaw, input);
   if (u > vTarget + 0.4) input.brake = true;
   const reach = Math.max(Math.hypot(h.vx, h.vz), V_LAUNCH_MIN) * t;
   if (bot.jumpCooldown <= 0 && (toEdge < 0.3 || (u > 0 && reach >= along - 0.2 && Math.abs(lat) < 0.5))) {
      input.jumpPressed = true;
      bot.jumpCooldown = 250;
   }
}

/** Stop on a platform's centre (ice: brake and steer; snow: walk). */
function park(run: PeakRun, p: Plat, input: StepInput, yaw: number): void {
   const h = run.hero;
   const ex = p.x - h.x;
   const ez = p.z - h.z;
   const dist = Math.hypot(ex, ez);
   if (grips(run, p)) {
      if (dist > 0.3) stickFor(ex / Math.max(dist, 1), ez / Math.max(dist, 1), yaw, input);
      return;
   }
   const vmax = Math.min(2.5, dist * 1.2);
   const tx = dist > 0.01 ? (ex / dist) * vmax : 0;
   const tz = dist > 0.01 ? (ez / dist) * vmax : 0;
   const cx = tx - h.vx;
   const cz = tz - h.vz;
   const cm = Math.hypot(cx, cz);
   if (cm > 0.05) stickFor(cx / Math.max(cm, 0.6), cz / Math.max(cm, 0.6), yaw, input);
   if (Math.hypot(h.vx, h.vz) > vmax + 0.4) input.brake = true;
}
