// The honest bot (tests, ?autoplay=1 on preview builds): it plays only through StepInput, like a player.
// It reads the next gate and switches to the colour it will show in its lane when it gets there (for a
// split gate it may change lane instead), keeps out of lanes with energy blocks ahead, jumps walls, gaps
// and sweepers and slides under beams with a player's timing, and picks up a pickup line when its lane is
// free. It never uses a power.
import { LANES, gateColor, type Gate } from "./track";
import { NONE, WALL_H, createStepInput, laneOf, type StepInput, type SwitchRun } from "./rules";

export interface Bot {
   /** the last frame a jump or slide was pressed (no double presses) */
   actedZ: number;
}

export function createBot(_run?: SwitchRun): Bot {
   return { actedZ: 1e9 };
}

const IDLE = createStepInput();

function clear(i: StepInput): void {
   Object.assign(i, IDLE, { yaw: 0 });
   i.colorPick = NONE;
}

function nextGate(run: SwitchRun): Gate | null {
   const h = run.hero;
   let best: Gate | null = run.track.gates[run.gateIdx] ?? null;
   for (const a of run.arena) if (a.live && a.z < h.z && (!best || a.z > best.z)) best = a;
   return best;
}

export function botInput(bot: Bot, run: SwitchRun, input: StepInput): void {
   clear(input);
   const h = run.hero;
   if (run.ended || h.mode === "fall" || h.mode === "spawn") return;
   // a respawn put the hero back behind its last jump: forget it
   if (h.z > bot.actedZ + 0.5) bot.actedZ = 1e9;
   const v = run.speed + (h.surgeUntil >= run.simMs ? 3 : 0);
   const t = run.track;
   // lanes: avoid energy blocks in the next 14 m (and low walls when another lane is free)
   const blocked = [false, false, false];
   const walled = [false, false, false];
   for (let i = 0; i < t.obstacles.length; i++) {
      const o = t.obstacles[i];
      if (run.smashed[i]) continue;
      const ahead = h.z - o.z;
      if (ahead < -0.5 || ahead > 16) continue;
      if (o.kind === "block") blocked[o.lane] = true;
      if (o.kind === "wall") walled[o.lane] = true;
   }
   const g = nextGate(run);
   let want = h.lane;
   if (blocked[want]) want = [1, 0, 2].find((l) => !blocked[l]) ?? want;
   else if (walled[want]) {
      const free = [1, 0, 2].find((l) => !blocked[l] && !walled[l] && Math.abs(l - h.lane) === 1);
      if (free !== undefined) want = free;
   }
   if (want === h.lane && g && h.z - g.z < 20 && g.kind !== "split") {
      // drift to a pickup line in a free lane before the gate
      const p = t.pickups.find((q, i) => !run.collected[i] && q.main && h.z - q.z > 2 && h.z - q.z < 14);
      if (p) {
         const pl = laneOf(p.x);
         if (!blocked[pl] && !walled[pl] && Math.abs(pl - h.lane) <= 1) want = pl;
      }
   }
   if (want !== h.lane) {
      if (want > h.lane) input.right = true;
      else input.left = true;
   }
   // colour: what the gate will show in the lane the bot will be in when it gets there
   if (g) {
      const dist = h.z - g.z;
      const lane = want;
      const at = run.simMs + Math.max(0, (dist / v) * 1000);
      input.colorPick = gateColor(g, lane, at);
   }
   // jumps and slides with a player's timing
   if (h.mode === "run" && Math.abs(bot.actedZ - h.z) > 1.5) {
      for (const o of t.obstacles) {
         const ahead = h.z - o.z;
         if (o.kind === "gap" && ahead > 0 && ahead < v * 0.12 + 0.6) {
            input.jumpPressed = true;
            break;
         }
         if (o.kind === "wall" && laneOf(LANES[o.lane]) === laneOf(h.x) && ahead > 0 && ahead < v * 0.3 && ahead > v * 0.18) {
            input.jumpPressed = true;
            break;
         }
         if (o.kind === "sweeper" && ahead > v * 0.16 && ahead < v * 0.32) {
            input.jumpPressed = true;
            break;
         }
         if (o.kind === "beam" && ahead > 0 && ahead < v * 0.3) {
            input.slidePressed = true;
            break;
         }
      }
      for (const s of run.sweeps) {
         const ahead = h.z - s.z;
         if (s.live && ahead > v * 0.18 && ahead < v * 0.3) input.jumpPressed = true;
      }
      if (input.jumpPressed || input.slidePressed) bot.actedZ = h.z;
   }
   void WALL_H;
}
