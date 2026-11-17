// The honest bot (tests, ?autoplay=1 on preview builds): it plays only through StepInput. It looks at the
// live orbs and the ones its portals are telegraphing, and plans for the most urgent orb it can still
// stop: if its shield is not that orb's colour it first runs over the nearest zone of that colour, then to
// the point on the orb's lane where it gets there first, as far out as it can (an early block). It jumps
// the drone when it comes round. It never uses a power.
import { R_PORTAL, TELEGRAPH_MS, orbColor, type Arena } from "./arena";
import { DRONE_R, NONE, V_RUN, createStepInput, dronePos, type DefenseRun, type StepInput } from "./rules";
import { LEVELS } from "./levels";

export interface Bot {
   tx: number;
   tz: number;
   /** the zone it charges at first (-1 none) */
   via: number;
   has: boolean;
}

export function createBot(_run?: DefenseRun): Bot {
   return { tx: 0, tz: 5, via: NONE, has: false };
}

const D = { x: 0, z: 0 };
const SPEED = V_RUN * 0.92;
/** the closest to the core it will try to meet an orb (m) */
const MIN_R = 3.2;

interface Plan {
   ok: boolean;
   via: number;
   tx: number;
   tz: number;
   urgency: number;
}

interface OrbLike {
   lane: number;
   r: number;
   color: number;
   alt: number;
   periodMs: number;
   bornMs: number;
   core: boolean;
   speed: number;
}

function planFor(A: Arena, hx: number, hz: number, color: number, o: OrbLike, now: number): Plan {
   const lane = A.lanes[o.lane];
   const v = o.speed;
   const plan: Plan = { ok: false, via: NONE, tx: 0, tz: 0, urgency: ((o.r - MIN_R) / v) * 1000 };
   for (let r = Math.min(o.r - 0.6, 11.4); r >= MIN_R; r -= 0.5) {
      const tOrb = ((o.r - r) / v) * 1000;
      const c = orbColor(o.color, o.alt, o.periodMs, now + tOrb - o.bornMs);
      const px = lane.dx * r;
      const pz = lane.dz * r;
      let via = NONE;
      let dist: number;
      if (c === color) dist = Math.hypot(px - hx, pz - hz);
      else {
         dist = Infinity;
         for (let i = 0; i < A.zones.length; i++) {
            const z = A.zones[i];
            if (z.color !== c) continue;
            const d = Math.hypot(z.x - hx, z.z - hz) + Math.hypot(px - z.x, pz - z.z);
            if (d < dist) {
               dist = d;
               via = i;
            }
         }
      }
      if ((dist / SPEED) * 1000 + 250 <= tOrb) {
         plan.ok = true;
         plan.via = via;
         plan.tx = px;
         plan.tz = pz;
         return plan;
      }
   }
   return plan;
}

export function botInput(bot: Bot, run: DefenseRun, input: StepInput): void {
   Object.assign(input, createStepInput());
   const h = run.hero;
   if (run.ended) return;
   const A = run.arena;
   const v = LEVELS[run.level].orbSpeed;
   const list: OrbLike[] = [];
   for (const o of run.orbs) if (o.live) list.push({ lane: o.lane, r: o.r, color: o.color, alt: o.alt, periodMs: o.periodMs, bornMs: o.bornMs, core: o.core, speed: o.core ? v * 1.1 : v });
   for (let i = run.nextSpawn; i < A.spawns.length && A.spawns[i].t <= run.simMs + TELEGRAPH_MS; i++) {
      const s = A.spawns[i];
      list.push({ lane: s.lane, r: R_PORTAL + (v * (s.t - run.simMs)) / 1000, color: s.color, alt: s.alt, periodMs: s.periodMs, bornMs: s.t, core: false, speed: v });
   }
   let chosen: Plan | null = null;
   for (const o of list) {
      const p = planFor(A, h.x, h.z, h.color, o, run.simMs);
      if (!p.ok) continue;
      p.urgency -= o.core ? 3000 : 0;
      if (!chosen || p.urgency < chosen.urgency) chosen = p;
   }
   bot.has = !!chosen;
   let tx: number;
   let tz: number;
   if (chosen && chosen.via >= 0) {
      tx = A.zones[chosen.via].x;
      tz = A.zones[chosen.via].z;
   } else if (chosen) {
      tx = chosen.tx;
      tz = chosen.tz;
   } else {
      const r = Math.hypot(h.x, h.z) || 1;
      tx = (h.x / r) * 5;
      tz = (h.z / r) * 5;
   }
   bot.tx = tx;
   bot.tz = tz;
   bot.via = chosen?.via ?? NONE;
   const dx = tx - h.x;
   const dz = tz - h.z;
   const d = Math.hypot(dx, dz);
   if (d > 0.2) {
      // yaw 0: the stick's x is world x, its y world z
      const s = Math.min(1, d / 0.8);
      input.moveX = (dx / d) * s;
      input.moveZ = (dz / d) * s;
   }
   if (LEVELS[run.level].drone && h.grounded) {
      const p = dronePos(run, D);
      if (Math.hypot(h.x - p.x, h.z - p.z) < DRONE_R + 0.95) input.jumpPressed = true;
   }
   input.yaw = 0;
}
