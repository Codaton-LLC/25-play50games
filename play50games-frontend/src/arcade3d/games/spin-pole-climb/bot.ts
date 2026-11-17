// The honest bot (tests, `?autoplay=1` in preview builds): it plays through the same StepInput a player
// gives (the stick at camera yaw 0, Jump, Action), never touches the run. It follows the course's route
// (climb a stair, hop to the next one once high enough and facing it) and reads the hazards about
// 0.9 s ahead the way a player does: for each choice (run on, jump now, wait, step back) it predicts the
// next moments of the hero against the sweepers, spikes, spore puffs, gaps and Coilstone's coil, and
// takes the first safe one. Level 5: it stomps the plated segment, hops onto the crown's side pole and
// climbs to the gong.
import { TAU, dirTo, helixEnd, helixTop, isVeil, sporeOn, stairY, stretchAt, sweeperAngle, wrapPi } from "./course";
import { COILSTONE } from "./progression";
import { BODY_H, BODY_W, COIL_HALF, COIL_SPEED, GRAV, HOP_FACING, STEP_MS, V_JUMP, V_RUN, createStepInput, floorY, heroAngle, helixOf, hopTarget, poleOmega, type Hop, type SpinRun, type StepInput } from "./rules";

export interface Bot {
   frameMs: number;
   scratch: Hop;
   /** a jump was pressed this many ms ago (the bot never double-taps) */
   lastJumpMs: number;
}

export function createBot(_run: SpinRun, frameMs = 1000 / 60): Bot {
   return {
      frameMs,
      scratch: { active: false, t: 0, fromX: 0, fromY: 0, fromZ: 0, helix: 0, a: 0, cap: false, capA: 0, toX: 0, toY: 0, toZ: 0 },
      lastJumpMs: -1e9,
   };
}

type Choice = "run" | "jump" | "wait" | "back";
const RANGE = { from: 0, to: 0 };
const HORIZON = 0.9;

/** Does the hero, doing `choice` from now, run into anything within the horizon? */
function safe(run: SpinRun, choice: Choice, jumpAt = 0): boolean {
   const h = run.hero;
   if (h.cap) return true;
   const c = run.course;
   const hx = helixOf(run);
   const pole = c.poles[hx.pole];
   const omega = poleOmega(run, hx.pole);
   let a = h.a;
   let air = h.air;
   let vAir = h.vAir;
   let grounded = h.grounded;
   let jumpLeft = choice === "jump" ? jumpAt : Number.POSITIVE_INFINITY;
   const tang = choice === "run" || choice === "jump" ? 1 : choice === "back" ? -1 : 0;
   const dt = 1 / 60;
   const b = run.boss;
   for (let t = dt; t <= HORIZON; t += dt) {
      const ms = run.simMs + t * 1000;
      if (jumpLeft <= 0 && grounded) {
         grounded = false;
         vAir = V_JUMP;
         jumpLeft = Number.POSITIVE_INFINITY;
      }
      jumpLeft -= dt;
      a += (tang * V_RUN) / pole.walk * dt + (grounded ? omega * dt : 0);
      if (a < hx.a0) a = hx.a0;
      if (a >= helixEnd(hx)) return true;
      if (!grounded) {
         vAir -= GRAV * dt;
         air += vAir * dt;
         if (air <= 0) {
            air = 0;
            grounded = true;
         }
      }
      if (grounded) for (const g of c.gaps) if (g.helix === hx.id && a >= g.from - 0.05 && a <= g.to + 0.05) return false;
      const feet = stairY(hx, a) + air;
      for (const s of c.sweepers) {
         if (s.pole !== pole.id) continue;
         if (feet >= s.y + 0.2 || feet + BODY_H <= s.y - 0.2) continue;
         if (Math.abs(wrapPi(a - sweeperAngle(s, ms))) < 0.2 + BODY_W / pole.walk) return false;
      }
      for (const s of c.spikes) {
         if (s.helix !== hx.id || air > 0.2) continue;
         stretchAt(s, ms, RANGE);
         if (a >= RANGE.from - 0.08 && a <= RANGE.to + 0.08) return false;
      }
      for (const s of c.spores) {
         if (s.helix !== hx.id || isVeil(s) || !sporeOn(s, ms) || air > 1.4) continue;
         if (a >= s.from - 0.08 && a <= s.to + 0.08) return false;
      }
      if (b && b.phase === 0 && hx.id === 0 && !Number.isNaN(run.coilA) && (b.step === "attack" || b.step === "telegraph")) {
         // the coil sits still through the telegraph, then slides down the stair through the attack
         const wait = b.step === "telegraph" ? Math.max(0, COILSTONE.phases[0].attacks[0].telegraphMs - b.stepMs) / 1000 : 0;
         const coil = run.coilA - COIL_SPEED * Math.max(0, t - wait);
         if (Math.abs(a - coil) < COIL_HALF + 0.15 && air < 0.8) return false;
      }
   }
   return true;
}

/** The stick that pushes towards world direction d (camera yaw 0: the stick is the world). */
function pushTowards(input: StepInput, d: number): void {
   input.moveX = Math.sin(d);
   input.moveZ = Math.cos(d);
}

/** The stick that runs up the stair (round the pole the climbing way). */
function runUp(input: StepInput, a: number, sign = 1): void {
   input.moveX = Math.cos(a) * sign;
   input.moveZ = -Math.sin(a) * sign;
}

export function botInput(bot: Bot, run: SpinRun, input: StepInput): void {
   const fresh = createStepInput();
   input.moveX = fresh.moveX;
   input.moveZ = fresh.moveZ;
   input.yaw = 0;
   input.jumpPressed = false;
   input.actionPressed = false;
   const h = run.hero;
   if (run.ended !== null || h.hop.active) return;
   const c = run.course;
   const hx = helixOf(run);
   const pole = c.poles[hx.pole];
   const a = heroAngle(run);
   const y = floorY(run);
   const ms = run.simMs;
   const jump = () => {
      if (ms - bot.lastJumpMs < 250) return;
      bot.lastJumpMs = ms;
      input.jumpPressed = true;
   };

   // a planned hop: to the next stair of the route, or (level 5) onto the crown's side pole and back
   let hopTo = -1;
   const b = run.boss;
   if (b) {
      if (b.phase === 1 && b.step === "vulnerable" && hx.pole === 0) {
         const side = c.helices.find((q) => q.pole === run.crownPole);
         if (side && y >= helixTop(side)) hopTo = side.id;
      } else if (hx.pole !== 0) hopTo = 0;
   } else {
      const step = c.route.find((s) => s.helix === h.helix);
      if (step && step.to >= 0 && y >= step.minY - 1e-6) hopTo = step.to;
      if (!step) hopTo = c.route[0].helix;
   }
   if (hopTo >= 0 && h.grounded) {
      const target = c.helices[hopTo];
      if (target.pole === pole.id) {
         // the wide tower: push in
         const ix = -Math.sin(a);
         const iz = -Math.cos(a);
         if (hopTarget(run, ix, iz, bot.scratch) && bot.scratch.helix === hopTo) {
            input.moveX = ix;
            input.moveZ = iz;
            jump();
            return;
         }
      } else {
         const tp = c.poles[target.pole];
         const d = dirTo(pole, tp.x, tp.z);
         if (Math.abs(wrapPi(a - d)) < HOP_FACING * 0.6) {
            const sx = Math.sin(d);
            const sz = Math.cos(d);
            if (hopTarget(run, sx, sz, bot.scratch) && bot.scratch.helix === hopTo) {
               pushTowards(input, d);
               jump();
               return;
            }
         }
      }
   }

   // level 5 phase 1: stomp the plated segment ahead
   if (b && b.phase === 0 && b.step === "vulnerable" && hx.id === 0 && !h.cap && !Number.isNaN(run.plateA) && h.grounded) {
      const ahead = run.plateA - h.a;
      if (ahead > 1.62 && ahead < 1.95) {
         runUp(input, a);
         jump();
         return;
      }
      if (ahead <= 1.62 && ahead > -0.5) {
         // too close: step back down for a run-up
         runUp(input, a, -1);
         return;
      }
   }
   // level 5: wait on the central cap (the gong) or on a side cap until it is time
   if (b && h.cap && hx.pole === 0 && b.phase === 2) return;

   if (h.cap) {
      runUp(input, a);
      return;
   }
   // run on if it is safe, or if a jump a little later makes it safe (jump at the last good moment)
   if (h.grounded && !safe(run, "run") && !safe(run, "jump", 0)) {
      for (let k = 1; k <= 8; k++) {
         if (safe(run, "jump", k * 0.06)) {
            runUp(input, a);
            return;
         }
      }
   }
   for (const choice of ["run", "jump", "wait", "back"] as Choice[]) {
      if (choice === "jump" && !h.grounded) continue;
      if (safe(run, choice)) {
         if (choice === "run") runUp(input, a);
         else if (choice === "jump") {
            runUp(input, a);
            jump();
         } else if (choice === "back") runUp(input, a, -1);
         return;
      }
   }
   runUp(input, a);
   void TAU;
   void STEP_MS;
}
