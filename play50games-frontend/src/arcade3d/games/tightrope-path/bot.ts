// An honest player for Tightrope Path (tests, proofs and `?autoplay=1`): it reads what a player sees
// (the needle and its motion, the gust leaves, the sandbags' swing, Umbra's tells) and answers through
// the real StepInput, camera-relative like a thumb on the stick. It walks (sprints only on the safe
// planks and pillars), holds the needle with the stick, stops when it leans far, waits for a sandbag to
// pass and crouches under one it is caught by, stops at a gap's edge and jumps, and fires its hero's
// power where the card puts it. It never sets the run's state.
import { DASH_START } from "./heroes";
import { isBalance } from "./course";
import { CORRECT, DRIFT, BAG, SPIN_FORCE, SWAY_FORCE, SWAY_MS, STILL_MUL, SPRINT_MUL, CROUCH_MUL, UMBRA_R, OUTBALANCE_MS, bagCrossing, gustState, wander, arenaLink, type StepInput, type TightRun } from "./rules";

export interface Bot {
   frameMs: number;
   jumpWait: number;
}

export function createBot(_run: TightRun, frameMs = 1000 / 60): Bot {
   return { frameMs, jumpWait: 0 };
}

/** The needle's drift now (needle per s) at the hero's speed: what the needle's motion shows. */
function driftNow(run: TightRun): number {
   const h = run.hero;
   const c = run.course;
   const l = c.links[h.link];
   if (!isBalance(l) || run.simMs <= h.shieldUntil) return 0;
   let rate = DRIFT[l.kind] * (Math.abs(h.v) <= 0.1 ? STILL_MUL : h.sprint ? SPRINT_MUL : 1) * (h.crouch ? CROUCH_MUL : 1);
   if (run.boss && run.bossAwake && run.boss.phase === 1 && (l.arena === 1 || l.arena === 2)) rate *= 1.6;
   let f = l.spin * SPIN_FORCE + l.sway * SWAY_FORCE * Math.sin((2 * Math.PI * run.simMs) / SWAY_MS);
   for (const g of c.gusts) if (g.link === l.id && h.s >= g.s0 && h.s <= g.s1 && gustState(g, run.simMs) === 2) f += g.sign * g.force;
   return rate * (0.9 * h.lean + 0.45 * wander(run, run.simMs)) + f;
}

/** ms until sandbag b next crosses the walk (0 while it is over it). */
function untilCrossing(b: TightRun["course"]["sandbags"][number], ms: number): number {
   for (let t = 0; t < b.periodMs; t += 10) if (!Number.isNaN(bagCrossing(b, ms + t))) return t;
   return b.periodMs;
}

export function botInput(bot: Bot, run: TightRun, input: StepInput): void {
   const h = run.hero;
   const c = run.course;
   const l = c.links[h.link];
   const ms = run.simMs;
   input.jumpPressed = false;
   input.actionPressed = false;
   input.actionHeld = false;
   if (h.fallMs >= 0 || run.ended !== null) {
      input.moveX = 0;
      input.moveZ = 0;
      return;
   }
   const balance = isBalance(l);
   const lean = h.lean;
   // the stick across: bring the needle back (a firm PD on what the needle shows)
   let side = Math.max(-1, Math.min(1, (-6 * lean - driftNow(run)) / CORRECT));
   if (!balance) side = 0;
   // the stick along: sprint on the safe links, walk on the narrow ones (under the sprint threshold)
   let along = balance && l.kind !== "plank" && l.kind !== "ghost" ? 0.5 : 1;
   if (Math.abs(lean) > 0.45 || h.wobbleMs > 0) along = 0;
   const ready = ms >= run.powerReadyAt;
   const hero = run.heroId;

   // sandbags: wait for one to pass, crouch under one we are caught by
   for (const b of c.sandbags) {
      if (b.link !== l.id) continue;
      const d = b.s - h.s;
      const until = untilCrossing(b, ms);
      if (Math.abs(d) <= BAG.reach + 0.08 && until < 140) input.actionHeld = true;
      else if (d > BAG.reach && d < BAG.reach + 0.6 && until < 950) along = 0;
   }

   // the gap: the rules stop us at its edge; jump when steady
   if (l.gap > 0 && h.s >= l.len - 0.02 && !h.air) {
      along = 0;
      bot.jumpWait += bot.frameMs;
      if (Math.abs(lean) < 0.3 && bot.jumpWait > 120) {
         input.jumpPressed = true;
         bot.jumpWait = 0;
      }
   } else bot.jumpWait = 0;
   // Nami: the second jump at the top, for a high orb over this gap
   if (hero === "nami" && h.air && h.jumps === 1 && h.vy < 0.6 && c.orbs.some((o) => o.high && o.link === l.id && !run.taken[o.id])) input.jumpPressed = true;

   // powers
   if (ready && !h.air) {
      if (hero === "riko" && l.kind === "dash" && h.s <= DASH_START - 0.1) input.actionPressed = true;
      if (hero === "vexa" && l.kind === "pillar" && l.alt >= 0 && h.s > l.len - 1.2 && ms > h.phaseUntil) input.actionPressed = true;
      if (hero === "kiro" && c.gusts.some((g) => g.link === l.id && gustState(g, ms) === 1 && h.s < g.s1)) input.actionPressed = true;
      if (hero === "zuno" && c.coins.some((k) => k.link === l.id && !run.coinTaken[k.id] && Math.abs(k.s - h.s) < 3)) input.actionPressed = true;
   }

   // Umbra's joust
   const b = run.boss;
   if (b && run.bossAwake && b.step !== "defeat" && b.step !== "done") {
      const ul = arenaLink(c, run.umbraArena);
      if (h.link === ul.id) {
         const gap = run.umbraS - h.s;
         const stopAt = b.phase === 0 ? 3 : 1.3;
         if (gap <= stopAt) along = Math.min(along, 0);
         const step = b.step;
         const late = step === "telegraph" && b.stepMs > (b.phase === 0 ? 1000 : 700);
         if ((late || step === "attack") && (b.phase === 0 || b.phase === 2)) input.actionHeld = true;
         if (step === "vulnerable" && !h.air && Math.abs(lean) < 0.6) {
            if (b.phase === 0 && gap <= UMBRA_R.stomp) input.jumpPressed = true;
            if (b.phase === 1 && gap <= UMBRA_R.shove) input.actionPressed = true;
            if (b.phase === 2 && gap <= UMBRA_R.shove && run.steadyMs >= OUTBALANCE_MS) input.actionPressed = true;
         }
      }
   }
   if (input.actionHeld) along = 0;

   // camera-relative: invert inputToWorld for the camera's yaw
   const wx = along * l.dx + side * -l.dz;
   const wz = along * l.dz + side * l.dx;
   const cy = Math.cos(input.yaw);
   const sy = Math.sin(input.yaw);
   input.moveX = cy * wx - sy * wz;
   input.moveZ = sy * wx + cy * wz;
}
