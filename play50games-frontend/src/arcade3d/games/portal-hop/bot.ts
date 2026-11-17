// The honest bot (tests, and `?autoplay=1` in preview builds): it plays through the same StepInput a
// player gives, following its level's route (course.ts): walk to a point, open an exit on an anchor (a
// tap on the obelisk), run into a frame or off a ledge into a pad, ride the fling, wait for an orbiting
// anchor to face the right way (level 3), push a crystal (level 4). On level 5 it also opens pair A on an
// intact beacon before each dive, jumps the tail sweep, and runs to the knotted head.
import { L5_CENTRE, anchorYaw, wrapPi, type Cmd } from "./course";
import { GRAV, KNOT_HEAD, V_RUN, centreAngle, createStepInput, pairOpen, sweepAngle, type PortalRun, type StepInput } from "./rules";
import { SWEEP_R0, SWEEP_R1 } from "./progression";

export interface Bot {
   frameMs: number;
   route: readonly Cmd[];
   i: number;
   /** the current command's own state */
   started: boolean;
   teleports0: number;
   airborne: boolean;
   until: number;
}

export function createBot(run: PortalRun, frameMs = 1000 / 60): Bot {
   return { frameMs, route: run.course.route, i: 0, started: false, teleports0: 0, airborne: false, until: 0 };
}

const IDLE = createStepInput();

function next(bot: Bot): void {
   bot.i += 1;
   bot.started = false;
}

function steer(input: StepInput, dx: number, dz: number, scale = 1): void {
   const d = Math.hypot(dx, dz);
   if (d < 1e-6) return;
   input.moveX = (dx / d) * scale;
   input.moveZ = (dz / d) * scale;
}

/** Level 5's standing jobs: open pair A on an intact beacon, jump the tail, go for the knotted head. Returns true when it took the input. */
function bossChores(run: PortalRun, input: StepInput): boolean {
   const b = run.boss;
   if (!b) return false;
   const h = run.hero;
   const c = run.course;
   if (b.phase === 0) {
      const sel = c.anchors[c.pairs[0].anchors[run.sel[0]]];
      if (pairOpen(run, 0) && !(sel.beacon >= 0 && run.beaconAlive[sel.beacon])) {
         const want = c.pairs[0].anchors.find((id) => c.anchors[id].beacon >= 0 && run.beaconAlive[c.anchors[id].beacon]);
         if (want !== undefined) input.pick = want;
      }
   }
   if (b.step === "attack" || (b.step === "telegraph" && b.stepMs > 800)) {
      const d = Math.hypot(h.x - L5_CENTRE.x, h.z - L5_CENTRE.z);
      const sw = sweepAngle(run);
      if (h.grounded && h.ground === 0 && d >= SWEEP_R0 - 0.2 && d <= SWEEP_R1 + 0.4) {
         const ahead = Number.isNaN(sw) ? Infinity : wrapPi(centreAngle(h.x, h.z) - sw);
         if (ahead > 0.75 && ahead < 1.6) input.jumpPressed = true;
      }
   }
   if (run.wyrm === "knot") {
      steer(input, KNOT_HEAD.x - h.x, KNOT_HEAD.z - h.z);
      return true;
   }
   return false;
}

export function botInput(bot: Bot, run: PortalRun, input: StepInput): void {
   input.moveX = IDLE.moveX;
   input.moveZ = IDLE.moveZ;
   input.yaw = 0;
   input.jumpPressed = false;
   input.actionPressed = false;
   input.digit = 0;
   input.cyclePressed = false;
   input.pick = -1;
   if (run.ended !== null) return;
   if (bossChores(run, input)) return;
   const h = run.hero;
   const c = run.course;
   for (let guard = 0; guard < 6 && bot.i < bot.route.length; guard++) {
      const cmd = bot.route[bot.i];
      const first = !bot.started;
      if (first) {
         bot.started = true;
         bot.teleports0 = run.teleports;
         bot.airborne = !h.grounded;
         bot.until = run.simMs;
      }
      if (!h.grounded) bot.airborne = true;
      switch (cmd.t) {
         case "go": {
            const dx = cmd.x - h.x;
            const dz = cmd.z - h.z;
            const d = Math.hypot(dx, dz);
            if (d <= (cmd.tol ?? 0.35) && h.grounded) {
               next(bot);
               continue;
            }
            steer(input, dx, dz, Math.max(0.2, Math.min(1, d / 0.9)));
            return;
         }
         case "pick": {
            const a = c.anchors[cmd.anchor];
            const idx = c.pairs[a.pair].anchors.indexOf(a.id);
            if (run.sel[a.pair] === idx && pairOpen(run, a.pair)) {
               next(bot);
               continue;
            }
            if (run.sel[a.pair] !== idx) input.pick = cmd.anchor;
            return;
         }
         case "push": {
            const done =
               cmd.until === "teleport"
                  ? run.teleports > bot.teleports0
                  : cmd.until === "land"
                    ? bot.airborne && h.grounded
                    : cmd.until === "ms"
                      ? run.simMs - bot.until >= (cmd.ms ?? 0)
                      : run.ev.blockPorted && !first;
            if (done) {
               next(bot);
               continue;
            }
            steer(input, cmd.dx, cmd.dz);
            return;
         }
         case "jump": {
            if (!bot.airborne) {
               // a running jump waits for full speed first
               const fast = !cmd.run || Math.hypot(h.vx, h.vz) >= V_RUN - 0.5;
               if (h.grounded && fast) input.jumpPressed = true;
               steer(input, cmd.dx, cmd.dz);
               return;
            }
            if (bot.airborne && h.grounded) {
               next(bot);
               continue;
            }
            steer(input, cmd.dx, cmd.dz);
            return;
         }
         case "fly": {
            if (h.grounded && (bot.airborne || run.teleports > bot.teleports0)) {
               next(bot);
               continue;
            }
            if (h.grounded && first) {
               next(bot);
               continue;
            }
            return;
         }
         case "wait": {
            if (run.simMs - bot.until >= cmd.ms) {
               next(bot);
               continue;
            }
            return;
         }
         case "power": {
            input.actionPressed = true;
            next(bot);
            return;
         }
         case "timing": {
            const a = c.anchors[cmd.anchor];
            const walk = Math.hypot(cmd.edgeX - h.x, cmd.edgeZ - h.z) / V_RUN + 0.12;
            const fall = Math.sqrt((2 * cmd.drop) / GRAV);
            const yaw = anchorYaw(c, a, run.simMs + (walk + fall) * 1000);
            if (Math.abs(wrapPi(yaw - cmd.yaw)) <= cmd.tol && pairOpen(run, a.pair)) {
               next(bot);
               continue;
            }
            return;
         }
         case "boss": {
            const b = run.boss;
            if (!b) {
               next(bot);
               continue;
            }
            const ok = cmd.until === "vulnerable" ? b.step === "vulnerable" && !run.windowDone : b.phase >= (cmd.phase ?? 0);
            if (ok) {
               next(bot);
               continue;
            }
            return;
         }
         case "loop": {
            if (run.boss && run.boss.phase === cmd.whileBoss) {
               bot.i = cmd.to;
               bot.started = false;
               continue;
            }
            next(bot);
            continue;
         }
      }
   }
}
