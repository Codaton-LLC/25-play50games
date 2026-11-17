// The honest bot (tests, `?autoplay=1` on preview builds): it plays the way a player who reads the
// trajectory preview does. Standing on a body it first walks to the main orbs on that body's surface,
// then weighs its launches: a jump from 16 points round the body and every pod cradle at four charges and
// five aims, each run through the same preview the HUD draws (predictArc: gravity, moving moons, the
// hazards, the dock), and picks the one that lands farthest along the route (or on the dock), with the most
// orbs on the way, soonest. On level 5 it lands on the Orbit Warden's free vents, walks to its thruster
// through the belt's gap, and hits it fast. It never uses the jets. With `mash` it also presses the power
// every frame (tests). Pure: it only reads the run and writes the step input.
import { NONE } from "./system";
import {
   POD,
   V_JUMP,
   WALK,
   WARDEN_PLAY,
   angleDiff,
   bodyAt,
   bossAlive,
   bossPhase,
   createArcResult,
   createStepInput,
   launchSpeed,
   predictArc,
   thrusterAngle,
   ventAngle,
   type PodRun,
   type StepInput,
} from "./rules";

export interface Plan {
   /** "walk": to an angle and stop; "jump": walk there and jump; "pod": walk to the cradle, charge, launch */
   kind: "walk" | "jump" | "pod";
   body: number;
   angle: number;
   chargeMs: number;
   /** the stick at launch (-1..1) */
   aim: number;
}

export interface PodBot {
   frameMs: number;
   mash: boolean;
   plan: Plan | null;
   /** pod: frames of Jump held so far (NONE: not started) */
   held: number;
   lastGrounded: boolean;
   lastBody: number;
}

export function createBot(_run: PodRun, frameMs = 1000 / 60): PodBot {
   return { frameMs, mash: false, plan: null, held: NONE, lastGrounded: true, lastBody: NONE };
}

const B = { x: 0, y: 0, vx: 0, vy: 0 };
const RES = createArcResult();
const AIMS = [-1, -0.5, 0, 0.5, 1];
const CHARGES = [200, 500, POD.chargeMs];

function routeOf(run: PodRun, b: number): number {
   const r = run.course.bodies[b].route;
   return r === NONE ? -1 : r;
}

/** The score of a predicted flight (higher is better; -Infinity: never). */
function scoreArc(run: PodRun, from: number, now: number): number {
   const c = run.course;
   const r = RES;
   const ph = bossPhase(run);
   const alive = bossAlive(run);
   if (r.kind === 4) return 1e8 - r.ms;
   if (r.kind !== 1) return -Infinity;
   const t = r.ms - now;
   if (c.boss && run.bossOn && alive) {
      const onWarden = r.body === c.warden;
      if (ph === 0 && onWarden) {
         for (let k = 0; k < 3; k++) if (!run.ventUsed[k] && Math.abs(angleDiff(r.angle, ventAngle(k, r.ms))) <= WARDEN_PLAY.ventHalf * 0.8) return 1e7 - t;
      }
      if (ph === 1 && onWarden) return 1e7 - t;
      if (ph === 2 && onWarden && r.speed >= WARDEN_PLAY.fastHit * 1.04) return 1e7 - t;
      if (r.body === from) return -1e6;
      // reposition on a launch planetoid (a body with pods; never a moon)
      const tb = c.bodies[r.body];
      if (c.arenaBodies.includes(r.body) && tb.pods.length > 0 && r.body !== c.warden) return 1e5 + r.orbs * 200 - t / 10;
      if (c.arenaBodies.includes(r.body) && tb.pods.length > 0) return 5e4 - t / 10;
      return -1e6;
   }
   const cur = routeOf(run, from);
   let progress = routeOf(run, r.body);
   if (r.body === from) progress = cur - 0.5;
   else if (progress < 0) progress = c.bodies[r.body].kind === "moon" ? cur + 0.3 : cur - 0.6;
   return progress * 10000 + r.orbs * 200 - t / 10;
}

const HITS = new Uint8Array(512);

/** Weighs every launch from the body the hero stands on (and walks to its surface orbs first). */
export function choosePlan(bot: PodBot, run: PodRun): Plan {
   const h = run.hero;
   const c = run.course;
   const b = c.bodies[h.body];
   const now = run.simMs;
   // level 5, phase 2, on the Warden: walk to its thruster
   if (c.boss && run.bossOn && bossAlive(run) && h.body === c.warden && bossPhase(run) === 1) return { kind: "walk", body: h.body, angle: thrusterAngle(run, now + 400), chargeMs: 0, aim: 0 };
   // the main orbs on this body's surface (a static body; not on the Warden)
   if (!b.orbit && b.kind !== "warden") {
      let best = NONE;
      let bestD = Infinity;
      for (let i = 0; i < c.orbs.length; i++) {
         const o = c.orbs[i];
         if (run.collected[i] || o.kind !== "main") continue;
         const d = Math.hypot(o.x - b.x, o.y - b.y);
         if (d > b.R + 1.0) continue;
         const a = Math.atan2(o.y - b.y, o.x - b.x);
         const dd = Math.abs(angleDiff(a, h.angle));
         if (dd < bestD) {
            bestD = dd;
            best = i;
         }
      }
      if (best !== NONE) {
         const o = c.orbs[best];
         return { kind: "walk", body: h.body, angle: Math.atan2(o.y - b.y, o.x - b.x), chargeMs: 0, aim: 0 };
      }
   }
   const cands: Array<{ plan: Plan; score: number }> = [];
   const evalLaunch = (kind: "jump" | "pod", angle: number, chargeMs: number, aim: number, stepMs: number): number => {
      const walkMs = (Math.abs(angleDiff(angle, h.angle)) * b.R * 1000) / WALK + bot.frameMs;
      // the charge the bot will really hold: whole frames
      const held = kind === "pod" ? Math.max(1, Math.ceil(chargeMs / bot.frameMs)) * bot.frameMs : 0;
      const t = Math.round(now + walkMs + (kind === "pod" ? held + bot.frameMs : bot.frameMs));
      bodyAt(c, h.body, t, B);
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      let vx: number;
      let vy: number;
      if (kind === "jump") {
         vx = B.vx + V_JUMP * nx;
         vy = B.vy + V_JUMP * ny;
      } else {
         const a = angle - aim * POD.aim;
         const v = launchSpeed(held) + run.launchBonus;
         vx = B.vx + v * Math.cos(a);
         vy = B.vy + v * Math.sin(a);
      }
      HITS.fill(0, 0, c.orbs.length);
      predictArc(run, B.x + b.R * nx, B.y + b.R * ny, vx, vy, t, 12_000, null, RES, HITS, stepMs, h.body);
      return scoreArc(run, h.body, now) - walkMs / 20;
   };
   for (const pa of b.pods)
      for (const ch of CHARGES)
         for (const aim of AIMS) {
            const plan: Plan = { kind: "pod", body: h.body, angle: pa, chargeMs: ch, aim };
            cands.push({ plan, score: evalLaunch("pod", pa, ch, aim, 5) });
         }
   for (let k = 0; k < 16; k++) {
      const angle = h.angle + (k * Math.PI) / 8;
      cands.push({ plan: { kind: "jump", body: h.body, angle, chargeMs: 0, aim: 0 }, score: evalLaunch("jump", angle, 0, 0, 5) });
   }
   // the best few again at the rules' own 1 ms step (a grazing arrival must really land)
   cands.sort((p, q) => q.score - p.score);
   let bestPlan: Plan | null = null;
   let bestScore = -Infinity;
   for (let i = 0; i < Math.min(6, cands.length); i++) {
      if (!Number.isFinite(cands[i].score)) break;
      const p = cands[i].plan;
      const sc = evalLaunch(p.kind as "jump" | "pod", p.angle, p.chargeMs, p.aim, 1);
      if (sc > bestScore) {
         bestScore = sc;
         bestPlan = p;
      }
   }
   if (bestPlan) return bestPlan;
   return b.pods.length ? { kind: "pod", body: h.body, angle: b.pods[0], chargeMs: POD.chargeMs, aim: 0 } : { kind: "jump", body: h.body, angle: h.angle, chargeMs: 0, aim: 0 };
}

export function botInput(bot: PodBot, run: PodRun, out: StepInput = createStepInput()): StepInput {
   const h = run.hero;
   out.moveX = 0;
   out.up = false;
   out.jump = false;
   out.jumpPressed = false;
   out.actionPressed = bot.mash;
   out.yaw = 0;
   // the camera rolled to the local up: a right press is always clockwise
   out.roll = h.grounded ? h.angle - Math.PI / 2 : 0;
   if (run.ended !== null) return out;
   if (!h.grounded || h.chordFrom !== NONE) {
      bot.lastGrounded = false;
      bot.plan = null;
      bot.held = NONE;
      return out;
   }
   if (!bot.lastGrounded || bot.lastBody !== h.body) bot.plan = null;
   bot.lastGrounded = true;
   bot.lastBody = h.body;
   if (!bot.plan || bot.plan.body !== h.body) {
      bot.plan = choosePlan(bot, run);
      bot.held = NONE;
   }
   const p = bot.plan;
   // charging a pod: hold Jump, then let go with the aim
   if (p.kind === "pod" && bot.held !== NONE) {
      const want = Math.max(1, Math.ceil(p.chargeMs / bot.frameMs));
      if (bot.held < want) {
         out.jump = true;
         bot.held++;
      } else {
         out.moveX = p.aim;
         bot.plan = null;
         bot.held = NONE;
      }
      return out;
   }
   const b = run.course.bodies[h.body];
   const diff = angleDiff(p.angle, h.angle);
   const step = (WALK * bot.frameMs) / 1000 / b.R;
   const reach = p.kind === "pod" ? POD.reach * 0.6 : 0.03;
   if (Math.abs(diff) > reach) {
      // a right press turns clockwise: to turn counter-clockwise press left
      out.moveX = -Math.sign(diff) * Math.min(1, Math.abs(diff) / step);
      return out;
   }
   if (p.kind === "walk") {
      bot.plan = null;
      return out;
   }
   if (p.kind === "jump") {
      out.jumpPressed = true;
      bot.plan = null;
      return out;
   }
   out.jumpPressed = true;
   out.jump = true;
   bot.held = 1;
   return out;
}
