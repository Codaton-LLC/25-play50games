// An honest street bot. It follows the centre line to the lit beacon (the ramp, when that beacon
// is the bus), waits out a shut colour gate, and on level 5 plays Greyout's three windows: jump
// the brushes, roll the valves, stand past the ram gate. It never uses a hero power. Pure.
import { BUS_ROOF, closestNode, gateOpenLeft, nodeX, nodeZ, routeNodes, type Edge } from "./city";
import { createRun, step, type CityRun, type StepInput } from "./rules";

export interface Bot {
   frameMs: number;
   node: number;
   still: number;
   lastX: number;
   lastZ: number;
}

export function createBot(run: CityRun, frameMs = 1000 / 60): Bot {
   return { frameMs, node: run.course.start, still: 0, lastX: run.hero.x, lastZ: run.hero.z };
}

function allowStreet(e: Edge): boolean {
   return e.kind === "street" || e.kind === "alley";
}

function goalOf(run: CityRun): { x: number; z: number; node: number; hold: boolean } {
   const c = run.course;
   const b = run.boss;
   if (b && b.hp > 0) {
      if (b.phase === 0) return { x: c.rampLip.x, z: c.rampLip.z, node: c.beacons[0]?.node ?? c.start, hold: true };
      if (b.phase === 1) {
         if (b.step === "vulnerable") return { x: c.rear.x, z: c.rear.z, node: c.start, hold: false };
         return { x: c.rear.x - 4, z: c.rear.z, node: c.start, hold: true };
      }
      return { x: c.far.x, z: c.far.z, node: c.start + c.nx, hold: true };
   }
   const quota = c.laps * c.beacons.length;
   if (run.beaconIndex >= quota) return { x: c.startX, z: c.startZ, node: c.start, hold: true };
   const beacon = c.beacons[run.beaconIndex % c.beacons.length];
   if (beacon.bus) {
      if (run.hero.onBus) return { x: run.busX, z: run.busZ, node: beacon.node, hold: true };
      const ramp = c.ramps[0];
      const lip = c.rampLip;
      if (ramp) {
         const baseX = lip.x - ramp.dx * (ramp.len + 0.5);
         const baseZ = lip.z - ramp.dz * (ramp.len + 0.5);
         const along = (lip.x - run.hero.x) * ramp.dx + (lip.z - run.hero.z) * ramp.dz;
         const climbing = run.hero.y > 0.3 && along > 0 && along < ramp.len + 1.2;
         if (!climbing && Math.hypot(run.hero.x - baseX, run.hero.z - baseZ) > 1.4) {
            return { x: baseX, z: baseZ, node: closestNode(c, baseX, baseZ), hold: false };
         }
      }
      return { x: lip.x, z: lip.z, node: closestNode(c, lip.x, lip.z), hold: true };
   }
   return { x: nodeX(c, beacon.node), z: nodeZ(c, beacon.node), node: beacon.node, hold: false };
}

function steer(x: number, z: number, tx: number, tz: number, input: StepInput, stop: number): boolean {
   const dx = tx - x;
   const dz = tz - z;
   const d = Math.hypot(dx, dz);
   if (d < stop) {
      input.moveX = 0;
      input.moveZ = 0;
      return true;
   }
   input.moveX = dx / d;
   input.moveZ = dz / d;
   return false;
}

export function botInput(bot: Bot, run: CityRun, input: StepInput): void {
   input.yaw = 0;
   input.jumpPressed = false;
   input.jumpHeld = false;
   input.actionPressed = false;
   const c = run.course;
   const h = run.hero;
   const goal = goalOf(run);
   const route = routeNodes(c, bot.node, goal.node, allowStreet);
   const next = route.length > 1 ? route[1] : route[0];
   const nx = nodeX(c, next);
   const nz = nodeZ(c, next);
   if (Math.hypot(h.x - nx, h.z - nz) < 0.8) bot.node = next;
   const atGoalNode = bot.node === goal.node;
   const destX = atGoalNode ? goal.x : nx;
   const destZ = atGoalNode ? goal.z : nz;
   const stop = goal.hold ? 0.55 : 0.45;

   let waiting = false;
   if (!atGoalNode) {
      for (const e of c.edges) {
         if (e.gate < 0) continue;
         const on = (e.a === bot.node && e.b === next) || (e.b === bot.node && e.a === next);
         if (!on) continue;
         const g = c.gates[e.gate];
         const dist = Math.hypot(h.x - g.x, h.z - g.z);
         const past = Math.hypot(h.x - destX, h.z - destZ) + 0.4 < Math.hypot(g.x - destX, g.z - destZ);
         if (!past && dist < 4.6 && gateOpenLeft(run.simMs) < 1200) waiting = true;
      }
   }
   if (waiting) {
      input.moveX = 0;
      input.moveZ = 0;
   } else {
      steer(h.x, h.z, destX, destZ, input, stop);
   }

   const beaconNow = c.beacons[run.beaconIndex % Math.max(1, c.beacons.length)];
   if (h.onBus && !run.boss && beaconNow && !beaconNow.bus) input.jumpPressed = true;

   const boss = run.boss;
   if (boss && boss.phase === 0 && (boss.step === "vulnerable" || boss.step === "attack") && h.grounded) {
      const dx = h.x - c.rampLip.x;
      const dz = h.z - c.rampLip.z;
      if (dx * dx + dz * dz < 2.2 * 2.2 && h.y >= BUS_ROOF - 0.4) input.jumpPressed = true;
   }

   const arrived = Math.hypot(h.x - destX, h.z - destZ) < 0.9;
   const moved = Math.hypot(h.x - bot.lastX, h.z - bot.lastZ);
   if (moved < 0.015 && !waiting && !arrived && !input.jumpPressed) bot.still += bot.frameMs;
   else bot.still = 0;
   bot.lastX = h.x;
   bot.lastZ = h.z;
   if (bot.still > 900 && h.grounded) {
      input.jumpPressed = true;
      bot.still = 0;
   }
}

/** Runs the honest bot until the level ends. */
export function botRun(level: CityRun["level"], fps = 60, hero: CityRun["heroId"] = "riko"): CityRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms);
   const input = { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
   const cap = Math.ceil(run.course.timerMs / fms) + 5;
   for (let f = 0; f < cap && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}
