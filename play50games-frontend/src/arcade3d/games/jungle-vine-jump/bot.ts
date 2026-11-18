// The honest bot (README "Server limits and why they hold"): it climbs the route stop by stop the way a
// careful player does. On a platform it walks to the next vine and jumps into it (or hops to the next
// branch). On a vine it slides to a 4.4 m grip (the orbs hang at the chest there), pumps with the swing
// and lets go the moment the flight it would make reaches the next vine's grip range or lands on the
// next platform (a look-ahead of the plain ballistic flight, nothing the rules hide). On level 5 it
// fights the Howler King from the arena vine. It never uses a power or a secret, and is the same at any
// frame rate. Used by proof.test.ts and by `?autoplay=1` (preview).
import { BOB, ORB_GRIP, padY, type Pad, type Vine } from "./course";

/** A bobbing anchor's lift at `ms` (course BOB). */
function anchorBob(v: Vine, ms: number): number {
   return v.bob * Math.sin(((ms / BOB.periodMs) + v.phase) * Math.PI * 2);
}
import { GRAB_R, GRAV, GRIP_MAX, HANG, HIT_SPEED, KING_R, CHEST, V_JUMP, V_WALK, anchorOf, kingPos, padTop, pumpSense, vineDown, type StepInput, type VineRun } from "./rules";

export interface Bot {
   /** the route stop last occupied (pad stood on or vine held) */
   cur: number;
   /** ms the current vine has been held without a good release */
   heldMs: number;
   /** the vine held last frame (to reset heldMs) */
   held: number;
   /** run.hits last seen: a fall puts the bot back at its checkpoint */
   hitsSeen: number;
   /** the frame length last seen (ms): ignored, kept for the Scene's call */
   frameMs: number;
}

export function createBot(_run: VineRun, frameMs = 1000 / 60): Bot {
   return { cur: 0, heldMs: 0, held: -1, hitsSeen: 0, frameMs };
}

const A = { x: 0, y: 0, z: 0 };
const K = { x: 0, y: 0, z: 0 };

/** The time (s) a jump from a pad takes to come back down to a pad `rise` m higher (or the apex time). */
function jumpTime(rise: number): number {
   const disc = V_JUMP * V_JUMP - 2 * GRAV * rise;
   return disc < 0 ? V_JUMP / GRAV : (V_JUMP + Math.sqrt(disc)) / GRAV;
}

type Goal = { kind: "vine"; vine: Vine } | { kind: "pad"; pad: Pad } | { kind: "point"; x: number; y: number; z: number };

/**
 * Would a release now reach the goal? The hands fly the plain ballistic arc from their place and
 * velocity (no steering), sampled every 1/120 s for 1.6 s.
 */
export function releaseReaches(run: VineRun, goal: Goal): boolean {
   const h = run.hero;
   let x = h.x;
   let y = h.y + HANG;
   let z = h.z;
   const vx = h.vx;
   let vy = h.vy;
   const vz = h.vz;
   const dt = 1 / 120;
   if (goal.kind === "vine") anchorOf(run, goal.vine, A);
   const restY = A.y;
   for (let i = 0; i < 192; i++) {
      // bobbing branches and anchors: where they will be when the flight gets there
      const at = run.simMs + (i + 1) * dt * 1000;
      if (goal.kind === "vine" && goal.vine.bob > 0) A.y = restY - (anchorBob(goal.vine, run.simMs)) + anchorBob(goal.vine, at);
      x += vx * dt;
      vy -= GRAV * dt;
      y += vy * dt;
      z += vz * dt;
      if (goal.kind === "vine") {
         const v = goal.vine;
         const ox = x - A.x;
         const oz = z - A.z;
         const along = Math.abs(ox * v.dx + oz * v.dz);
         const side = Math.abs(-ox * v.dz + oz * v.dx);
         const below = A.y - y;
         if (along < 0.35 && side < GRAB_R * 0.6 && below > 2 && below < GRIP_MAX - 0.3) return true;
      } else if (goal.kind === "pad") {
         const p = goal.pad;
         const feet = y - HANG;
         const top = padY(p, at);
         if (vy < 0 && feet <= top + 0.05 && feet > top - 0.4) return Math.hypot(x - p.x, z - p.z) <= p.r * 0.6;
         if (feet < top - 0.4) return false;
      } else {
         const cy = y - HANG + CHEST;
         if (Math.hypot(x - goal.x, cy - goal.y, z - goal.z) <= KING_R * 0.7) return Math.hypot(vx, vy, vz) >= HIT_SPEED + 0.3;
      }
   }
   return false;
}

function stopGoal(run: VineRun, k: number): Goal | null {
   const s = run.course.route[k];
   if (!s) return null;
   return s.pad >= 0 ? { kind: "pad", pad: run.course.pads[s.pad] } : { kind: "vine", vine: run.course.vines[s.vine] };
}

/** Walks / jumps from the pad the hero stands on toward a goal (a vine to jump into or a pad to hop to). */
function fromPad(run: VineRun, stand: Pad, goal: Goal, input: StepInput): void {
   const h = run.hero;
   let tx: number;
   let tz: number;
   let rise = 0;
   if (goal.kind === "vine") {
      anchorOf(run, goal.vine, A);
      tx = A.x;
      tz = A.z;
   } else if (goal.kind === "pad") {
      tx = goal.pad.x;
      tz = goal.pad.z;
      rise = padTop(run, goal.pad) - padTop(run, stand);
   } else {
      tx = goal.x;
      tz = goal.z;
   }
   const dx = tx - h.x;
   const dz = tz - h.z;
   const d = Math.hypot(dx, dz);
   if (d > 1e-6) {
      input.moveX = dx / d;
      input.moveZ = dz / d;
   }
   if (!h.grounded) return;
   if (goal.kind === "vine") {
      // jump into the vine from close by, or from the platform's edge
      const edge = Math.hypot(h.x - stand.x, h.z - stand.z) >= stand.r - 0.35;
      if (d <= 2.3 || (edge && d < 4.6)) input.jumpPressed = true;
   } else {
      const reach = V_WALK * jumpTime(Math.max(0, rise));
      if (d <= reach - 0.2 || rise > 1.2) input.jumpPressed = d <= reach + 0.4;
   }
}

/** Steers a flight toward the goal (the air control). */
function steerAir(run: VineRun, goal: Goal, input: StepInput): void {
   const h = run.hero;
   let tx: number;
   let tz: number;
   if (goal.kind === "vine") {
      anchorOf(run, goal.vine, A);
      tx = A.x;
      tz = A.z;
   } else if (goal.kind === "pad") {
      tx = goal.pad.x;
      tz = goal.pad.z;
   } else {
      tx = goal.x;
      tz = goal.z;
   }
   const dx = tx - h.x;
   const dz = tz - h.z;
   const d = Math.hypot(dx, dz);
   if (d < 0.15) return;
   input.moveX = dx / d;
   input.moveZ = dz / d;
}

/** On a vine: grip to `want`, pump with the swing, and let go when the flight reaches `goal`. */
function onVine(run: VineRun, bot: Bot, want: number, goal: Goal | null, input: StepInput): void {
   const h = run.hero;
   const v = run.course.vines[h.vine];
   // the stick is screen-relative here (yaw 0): Up shortens the grip
   if (h.grip > want + 0.12) input.moveZ = -1;
   else if (h.grip < want - 0.12) input.moveZ = 1;
   const sense = pumpSense(v, 0);
   const dir = Math.abs(h.omega) < 0.25 ? 1 : Math.sign(h.omega);
   input.moveX = dir * sense;
   if (goal && h.theta * h.omega > 0 && releaseReaches(run, goal)) {
      input.jumpPressed = true;
      input.moveX = 0;
      input.moveZ = 0;
   }
   void bot;
}

/** Writes the bot's input for this frame. */
export function botInput(bot: Bot, run: VineRun, input: StepInput): void {
   const c = run.course;
   const h = run.hero;
   input.moveX = 0;
   input.moveZ = 0;
   input.yaw = 0;
   input.jumpPressed = false;
   input.actionPressed = false;
   if (run.ended) return;
   if (run.hits !== bot.hitsSeen) {
      bot.hitsSeen = run.hits;
      bot.cur = Math.max(0, c.pads[run.checkpoint].node);
   }
   // where on the route: the pad stood on or the vine held
   if (h.standing >= 0 && c.pads[h.standing].node >= 0) bot.cur = c.pads[h.standing].node;
   if (h.vine >= 0 && c.vines[h.vine].node >= 0) bot.cur = c.vines[h.vine].node;
   if (h.vine !== bot.held) {
      bot.held = h.vine;
      bot.heldMs = 0;
   } else if (h.vine >= 0) bot.heldMs += bot.frameMs;

   // level 5's fight, once the King is awake and the hero is in the arena
   const a = c.arena;
   if (a && run.bossActive && run.boss && run.boss.step !== "done") {
      const main = c.vines[a.main];
      if (h.vine === a.main) {
         const b = run.boss;
         let goal: Goal | null = null;
         if (b.phase === 1 && b.step === "vulnerable") {
            kingPos(run, K);
            goal = { kind: "point", x: K.x, y: K.y, z: K.z };
         }
         onVine(run, bot, 4, goal, input);
         return;
      }
      if (h.vine >= 0) {
         input.jumpPressed = true;
         return;
      }
      if (h.grounded && h.standing === a.pad && !vineDown(run, a.main)) {
         fromPad(run, c.pads[a.pad], { kind: "vine", vine: main }, input);
         return;
      }
      if (!h.grounded) steerAir(run, { kind: "pad", pad: c.pads[a.pad] }, input);
      return;
   }

   const goal = stopGoal(run, bot.cur + 1);
   if (!goal) return;
   if (h.vine >= 0) {
      // a long hold without a good release: slide down for reach
      const want = bot.heldMs > 6000 ? GRIP_MAX : bot.heldMs > 3500 ? 5.2 : ORB_GRIP;
      onVine(run, bot, want, goal, input);
      return;
   }
   if (h.grounded && h.standing >= 0) {
      fromPad(run, c.pads[h.standing], goal, input);
      return;
   }
   steerAir(run, goal, input);
}
