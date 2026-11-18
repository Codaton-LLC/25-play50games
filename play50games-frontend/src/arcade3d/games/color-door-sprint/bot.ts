// The honest bot (tests, `?autoplay=1` on preview builds): it reads the rule the way a player does
// (the true door of the next wall once its lamp is in view; a sliding wall again after it slides), then
// steers for the main orbs only while there is time left before the lock, jumps the floor bars, rolls
// under the low beams, keeps out of the flame vents, and on level 5 fires the red rush while Flicker is
// open and dodges his fire. It uses no hero power unless `mash` (tests: the power pressed every frame).
// Pure: it only reads the run and writes the step input.
import { BAR_CLEAR, LANE_V, LOCK_MS, NONE, bossVulnerable, createStepInput, nextWallGap, type DoorRun, type StepInput } from "./rules";
import { LAMP_AHEAD, LANE_W, laneX } from "./halls";

export interface DoorBot {
   frameMs: number;
   mash: boolean;
   /** the ms of the bot's last lane press (one press per 70 ms) */
   lastPress: number;
   lastJump: number;
   lastRoll: number;
}

export function createBot(_run: DoorRun, frameMs = 1000 / 60): DoorBot {
   return { frameMs, mash: false, lastPress: -1e9, lastJump: -1e9, lastRoll: -1e9 };
}

/** The lane the bot wants: the next wall's true door once its lamp is read, else a main orb ahead, else stay. */
export function botTargetLane(run: DoorRun): number {
   const h = run.hero;
   const c = run.course;
   const v = Math.max(1, h.v || c.speed);
   const gap = nextWallGap(run);
   const w = run.nextWall;
   // the lamp is read (the lamp hangs LAMP_AHEAD before its wall; echo lamps earlier still)
   const readAt = LAMP_AHEAD + v * 1.2;
   const want = w < run.wallCount ? run.trueLane[w] : h.lane;
   let lane = gap < readAt ? want : h.lane;
   // a main orb ahead, if the true lane is still reachable after it, before the lock
   let best = Infinity;
   for (let i = 0; i < c.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = c.orbs[i];
      if (o.kind !== "main") continue;
      const d = h.z - o.z;
      if (d < 0 || d > 22 || d >= best) continue;
      const ol = Math.round(o.x / LANE_W + (c.lanes - 1) / 2);
      const left = (gap - d) / v - LOCK_MS / 1000 - Math.abs(want - ol) * 0.2 - 0.25;
      if (gap < Infinity && left < 0) continue;
      best = d;
      lane = ol;
   }
   // keep out of a flame vent ahead (unless the next wall's true door needs this lane soon)
   for (const vt of c.vents) {
      if (vt.lane !== lane) continue;
      const d = h.z - vt.z0;
      if (d > -(vt.z0 - vt.z1) && d < 30 && gap > (vt.z0 - vt.z1) + 10) lane = lane === 0 ? 1 : lane - 1;
   }
   const hz = run.hazard;
   // level 5: leave a lane of fire (only when there is room to come back before the next wall's lock)
   const wz = w < run.wallCount ? run.wallZ[w] : -Infinity;
   if (hz.live && hz.kind === 2 && hz.lane === lane && h.z - hz.z < 30 && hz.z - wz > v * (LOCK_MS / 1000 + 0.45)) lane = lane === 0 ? 1 : lane - 1;
   return Math.max(0, Math.min(c.lanes - 1, lane));
}

export function botInput(bot: DoorBot, run: DoorRun, out: StepInput = createStepInput()): StepInput {
   const h = run.hero;
   const c = run.course;
   const ms = run.simMs;
   out.left = false;
   out.right = false;
   out.up = false;
   out.down = false;
   out.jumpPressed = false;
   out.actionPressed = bot.mash;
   out.yaw = 0;
   if (run.ended !== null || h.state !== "play") return out;
   const v = Math.max(1, h.v || c.speed);
   const lead = (bot.frameMs / 1000) * v;
   // lanes
   if (h.side === NONE && !h.locked && ms - bot.lastPress >= 70) {
      const want = botTargetLane(run);
      if (want !== h.lane && Math.abs(h.x - laneX(h.lane, c.lanes)) < LANE_W * 0.6 + (LANE_V * bot.frameMs) / 1000) {
         if (want > h.lane) out.right = true;
         else out.left = true;
         bot.lastPress = ms;
      }
   }
   // floor bars and the fire wave: jump about 0.3 s before; low beams and the flame arc: roll 0.3 s before
   const near = (z: number) => {
      const d = h.z - z - lead;
      return d > 0 && d < v * 0.32;
   };
   let jump = false;
   let roll = false;
   if (h.side === NONE) {
      for (const b of c.bars) {
         if (!near(b.z)) continue;
         if (b.kind === "bar") jump = true;
         else roll = true;
      }
      const hz = run.hazard;
      if (hz.live && near(hz.z)) {
         if (hz.kind === 0) jump = true;
         else if (hz.kind === 1) roll = true;
      }
   }
   if (jump && h.grounded && h.y < BAR_CLEAR && ms - bot.lastJump > 250 && ms >= h.rollUntil) {
      out.jumpPressed = true;
      bot.lastJump = ms;
   }
   if (roll && ms - bot.lastRoll > 500 && ms >= h.rollUntil) {
      out.down = true;
      bot.lastRoll = ms;
   }
   // level 5: the red rush while Flicker is open
   if (run.rushReady && bossVulnerable(run)) out.actionPressed = true;
   return out;
}
