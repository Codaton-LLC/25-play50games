// The honest bots (pure). The plain bot plays like a careful player with no hero power: it plans a
// line round the buildings to the lit beacon (a visibility graph over what is solid for it, kept
// half a metre off every wall), cuts corners, waits for a green gate, times a ramp jump onto a
// moving bus for a bus beacon, and on level 5 plays Greyout's three phases: up the ramp onto the
// brushes, a roll down the red avenue into the valves, and laps of the plaza that bring the truck
// under a gate as it shuts. `mash` adds the hero power whenever it is ready (the proof's
// power-mashing check); it never changes the line.
import {
   BUS_HALF_L,
   BUS_HALF_W,
   CELL,
   GATE_GREEN,
   HERO_R,
   RAMP_HALF_W,
   RAMP_LEN,
   TRUCK_HALF_L,
   TRUCK_HALF_W,
   VALVE_BACK,
   blockIndexAt,
   busAt,
   createBusPose,
   gateChangeIn,
   gateShut,
   inBox,
   visible,
   type Course,
   type Ramp,
} from "./city";
import { V_RUN, beaconPoint, beaconQuota, createRun, createStepInput, litBeacon, step, type CityRun, type StepInput } from "./rules";
import { heroById, type HeroId } from "./heroes";
import type { LevelId } from "../../types";

interface Rect {
   x0: number;
   z0: number;
   x1: number;
   z1: number;
}

interface Nav {
   key: string;
   rects: Rect[];
   corners: { x: number; z: number }[];
   cc: Float64Array;
}

/** Bot-side clearance off every wall (beyond the hero's radius). */
const CLEAR = 0.5;

function buildNav(key: string, rects: Rect[], c: Course): Nav {
   const corners: { x: number; z: number }[] = [];
   const inside = (x: number, z: number) => x <= c.minX + HERO_R || x >= c.maxX - HERO_R || z <= c.minZ + HERO_R || z >= c.maxZ - HERO_R || rects.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
   for (const r of rects) {
      const pts = [
         { x: r.x0 - 0.01, z: r.z0 - 0.01 },
         { x: r.x1 + 0.01, z: r.z0 - 0.01 },
         { x: r.x1 + 0.01, z: r.z1 + 0.01 },
         { x: r.x0 - 0.01, z: r.z1 + 0.01 },
      ];
      for (const p of pts) if (!inside(p.x, p.z)) corners.push(p);
   }
   const n = corners.length;
   const cc = new Float64Array(n * n).fill(Infinity);
   for (let i = 0; i < n; i++) {
      cc[i * n + i] = 0;
      for (let j = i + 1; j < n; j++) {
         const d = visible(rects, corners[i].x, corners[i].z, corners[j].x, corners[j].z) ? Math.hypot(corners[i].x - corners[j].x, corners[i].z - corners[j].z) : Infinity;
         cc[i * n + j] = cc[j * n + i] = d;
      }
   }
   return { key, rects, corners, cc };
}

/** The shortest line from a to b round the nav's walls (a list of waypoints ending at b). */
function navPath(nav: Nav, ax: number, az: number, bx: number, bz: number): { x: number; z: number }[] {
   if (visible(nav.rects, ax, az, bx, bz)) return [{ x: bx, z: bz }];
   const n = nav.corners.length;
   const dist = new Float64Array(n + 1).fill(Infinity);
   const prev = new Int16Array(n + 1).fill(-1);
   const done = new Uint8Array(n + 1);
   for (let i = 0; i < n; i++) {
      const c = nav.corners[i];
      if (visible(nav.rects, ax, az, c.x, c.z)) dist[i] = Math.hypot(c.x - ax, c.z - az);
   }
   const toGoal = new Float64Array(n).fill(Infinity);
   for (let i = 0; i < n; i++) {
      const c = nav.corners[i];
      if (visible(nav.rects, c.x, c.z, bx, bz)) toGoal[i] = Math.hypot(bx - c.x, bz - c.z);
   }
   for (let iter = 0; iter < n + 1; iter++) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i <= n; i++) {
         if (!done[i] && dist[i] < best) {
            best = dist[i];
            u = i;
         }
      }
      if (u < 0 || u === n) break;
      done[u] = 1;
      if (toGoal[u] < Infinity && best + toGoal[u] < dist[n]) {
         dist[n] = best + toGoal[u];
         prev[n] = u;
      }
      for (let v = 0; v < n; v++) {
         const w = nav.cc[u * n + v];
         if (w === Infinity || done[v]) continue;
         if (best + w < dist[v]) {
            dist[v] = best + w;
            prev[v] = u;
         }
      }
   }
   if (dist[n] === Infinity) return [{ x: bx, z: bz }];
   const out: { x: number; z: number }[] = [{ x: bx, z: bz }];
   for (let v = prev[n]; v >= 0; v = prev[v]) out.push(nav.corners[v]);
   return out.reverse();
}

function grow(x0: number, z0: number, x1: number, z1: number, g: number): Rect {
   return { x0: x0 - g, z0: z0 - g, x1: x1 + g, z1: z1 + g };
}

function rampRect(r: Ramp, g: number): Rect {
   const bx = r.x - r.dx * RAMP_LEN;
   const bz = r.z - r.dz * RAMP_LEN;
   const hw = RAMP_HALF_W;
   return grow(Math.min(r.x, bx) - (r.dx === 0 ? hw : 0), Math.min(r.z, bz) - (r.dz === 0 ? hw : 0), Math.max(r.x, bx) + (r.dx === 0 ? hw : 0), Math.max(r.z, bz) + (r.dz === 0 ? hw : 0), g);
}

export interface Bot {
   frameMs: number;
   mash: boolean;
   navs: Map<string, Nav>;
   path: { x: number; z: number }[];
   pathFor: string;
   replanAt: number;
   still: number;
   lastX: number;
   lastZ: number;
   /** bus beacon / brush ramp: "approach" to the ramp's foot, "run" up it */
   rampMode: "approach" | "run";
   /** level 5 phase 3: which plaza corner it heads to next, and which way round */
   lapCorner: number;
   lapDir: 1 | -1;
}

export function createBot(run: CityRun, frameMs = 1000 / 60): Bot {
   return { frameMs, mash: false, navs: new Map(), path: [], pathFor: "", replanAt: 0, still: 0, lastX: run.hero.x, lastZ: run.hero.z, rampMode: "approach", lapCorner: 0, lapDir: 1 };
}

function navFor(bot: Bot, run: CityRun, useRamp: number): Nav {
   const c = run.course;
   const h = run.hero;
   const phase = h.phaseUntil >= run.simMs;
   const t = run.truck;
   const parked = !!run.boss && !t.moving && run.boss.step !== "done";
   const key = `${run.siteOpen ? 1 : 0}${phase ? 1 : 0}${useRamp}${parked ? `${Math.round(t.x)},${Math.round(t.z)},${Math.round(t.yaw * 10)}` : "-"}`;
   let nav = bot.navs.get(key);
   if (nav) return nav;
   const g = HERO_R + CLEAR;
   const rects: Rect[] = [];
   for (const b of c.blocks) {
      const solid = b.kind === "building" || b.kind === "lot" || (b.kind === "site" && !run.siteOpen) || (b.kind === "ghost" && !phase);
      if (solid) rects.push(grow(b.x0, b.z0, b.x1, b.z1, g));
   }
   c.ramps.forEach((r, i) => {
      if (i !== useRamp) rects.push(rampRect(r, g - 0.2));
   });
   const pose = createBusPose();
   c.buses.forEach((b) => {
      if (!b.parked) return;
      busAt(b, 0, pose);
      const along = Math.abs(Math.sin(pose.yaw)) > 0.5;
      const hl = along ? BUS_HALF_L : BUS_HALF_W;
      const hw = along ? BUS_HALF_W : BUS_HALF_L;
      rects.push(grow(pose.x - hl, pose.z - hw, pose.x + hl, pose.z + hw, g));
   });
   if (parked) {
      const along = Math.abs(Math.sin(t.yaw)) > 0.5;
      const hl = along ? TRUCK_HALF_L : TRUCK_HALF_W;
      const hw = along ? TRUCK_HALF_W : TRUCK_HALF_L;
      rects.push(grow(t.x - hl, t.z - hw, t.x + hl, t.z + hw, g));
   }
   nav = buildNav(key, rects, c);
   bot.navs.set(key, nav);
   return nav;
}

function steer(h: { x: number; z: number }, tx: number, tz: number, input: StepInput, k = 1): number {
   const dx = tx - h.x;
   const dz = tz - h.z;
   const d = Math.hypot(dx, dz);
   if (d < 1e-6) {
      input.moveX = 0;
      input.moveZ = 0;
      return 0;
   }
   input.moveX = (dx / d) * k;
   input.moveZ = (dz / d) * k;
   return d;
}

/** Follows a planned line to (tx, tz); replans when the goal moves or every 400 ms. */
function goTo(bot: Bot, run: CityRun, tx: number, tz: number, input: StepInput, useRamp = -1, k = 1): number {
   const h = run.hero;
   const nav = navFor(bot, run, useRamp);
   const tag = `${nav.key}:${Math.round(tx * 2)},${Math.round(tz * 2)}`;
   if (tag !== bot.pathFor || run.simMs >= bot.replanAt || bot.path.length === 0) {
      bot.path = navPath(nav, h.x, h.z, tx, tz);
      bot.pathFor = tag;
      bot.replanAt = run.simMs + 400;
   }
   while (bot.path.length > 1 && Math.hypot(bot.path[0].x - h.x, bot.path[0].z - h.z) < 0.7) bot.path.shift();
   const wp = bot.path[0];
   // look past a waypoint that is already in sight (smooth corners)
   if (bot.path.length > 1 && visible(nav.rects, h.x, h.z, bot.path[1].x, bot.path[1].z)) bot.path.shift();
   steer(h, bot.path[0].x, bot.path[0].z, input, k);
   return Math.hypot(tx - h.x, tz - h.z) + (wp === bot.path[0] ? 0 : 0);
}

/** Waits for green: stops short of a gate on the way that is red, or turns red before it is reached. */
function holdForGate(run: CityRun, nx: number, nz: number, input: StepInput): boolean {
   const c = run.course;
   const h = run.hero;
   for (const g of c.gates) {
      const r = grow(g.x - g.hx, g.z - g.hz, g.x + g.hx, g.z + g.hz, HERO_R + 0.05);
      if (h.x > r.x0 && h.x < r.x1 && h.z > r.z0 && h.z < r.z1) continue;
      if (visible([r], h.x, h.z, nx, nz)) continue;
      const d = Math.hypot(g.x - h.x, g.z - h.z);
      if (d > 5) continue;
      const eta = ((d + 1.5) / V_RUN) * 1000;
      const shut = gateShut(g, run.simMs);
      if (shut || gateChangeIn(g, run.simMs) < eta + 250) {
         if (d < 3.4) {
            input.moveX = 0;
            input.moveZ = 0;
            return true;
         }
      }
   }
   return false;
}

const pt = { x: 0, y: 0, z: 0 };
const pose = createBusPose();

/** Runs a ramp: approach its foot, then (when `go` says) up it and jump at the lip. */
function rampRun(bot: Bot, run: CityRun, ri: number, input: StepInput, go: () => boolean): void {
   const c = run.course;
   const h = run.hero;
   const r = c.ramps[ri];
   const footX = r.x - r.dx * (RAMP_LEN + 2.2);
   const footZ = r.z - r.dz * (RAMP_LEN + 2.2);
   const along = (h.x - r.x) * r.dx + (h.z - r.z) * r.dz;
   const side = Math.abs((h.x - r.x) * r.dz - (h.z - r.z) * r.dx);
   if (bot.rampMode === "run") {
      const onLine = side < RAMP_HALF_W - 0.3 && along > -(RAMP_LEN + 3) && along < 0.5;
      if (!onLine && h.grounded) {
         bot.rampMode = "approach";
      } else {
         input.moveX = r.dx;
         input.moveZ = r.dz;
         if (h.grounded && along > -0.35 && along < 0.4 && h.y > 1) input.jumpPressed = true;
         return;
      }
   }
   const d = goTo(bot, run, footX, footZ, input, ri);
   if (d < 0.6) {
      input.moveX = 0;
      input.moveZ = 0;
      if (go()) {
         bot.rampMode = "run";
         input.moveX = r.dx;
         input.moveZ = r.dz;
      }
   }
}

/** The ramp whose landing (3 m past the lip) lies on a bus's loop. */
function rampForBus(c: Course, bus: number): number {
   const b = c.buses[bus];
   let best = -1;
   let bestD = 1.2;
   c.ramps.forEach((r, i) => {
      const lx = r.x + r.dx * 3;
      const lz = r.z + r.dz * 3;
      for (let k = 0; k < b.pts.length; k++) {
         const p = b.pts[k];
         const q = b.pts[(k + 1) % b.pts.length];
         const t = Math.max(0, Math.min(1, ((lx - p.x) * (q.x - p.x) + (lz - p.z) * (q.z - p.z)) / Math.max(1e-9, (q.x - p.x) ** 2 + (q.z - p.z) ** 2)));
         const d = Math.hypot(p.x + (q.x - p.x) * t - lx, p.z + (q.z - p.z) * t - lz);
         if (d < bestD) {
            bestD = d;
            best = i;
         }
      }
   });
   return best;
}

function busBeacon(bot: Bot, run: CityRun, bus: number, input: StepInput): void {
   const c = run.course;
   const h = run.hero;
   if (h.onBus === bus) {
      const p = run.buses[bus];
      // ride it: stand at its middle
      steer(h, p.x, p.z, input, Math.min(1, Math.hypot(p.x - h.x, p.z - h.z)));
      return;
   }
   const ri = rampForBus(c, bus);
   if (ri < 0) return;
   const r = c.ramps[ri];
   const lx = r.x + r.dx * 2.8;
   const lz = r.z + r.dz * 2.8;
   rampRun(bot, run, ri, input, () => {
      // up the ramp (RAMP_LEN + 2.2 m at run speed) plus the flight to the landing
      const lead = ((RAMP_LEN + 2.2) / V_RUN) * 1000 + 560;
      busAt(c.buses[bus], run.simMs + lead, pose);
      return inBox(lx, lz, pose.x, pose.z, pose.yaw, BUS_HALF_L - 1, BUS_HALF_W - 0.3);
   });
}

function bossPlay(bot: Bot, run: CityRun, input: StepInput): void {
   const c = run.course;
   const h = run.hero;
   const b = run.boss!;
   const t = run.truck;
   if (b.phase === 0 || b.step === "intro") {
      const stop = c.brushStops[b.step === "intro" ? 0 : t.stop];
      rampRun(bot, run, stop.ramp, input, () => b.step === "vulnerable" || (b.step === "attack" && b.stepMs > 500));
      return;
   }
   if (b.phase === 1) {
      const stop = c.valveStops[t.stop];
      const fx = Math.sin(stop.yaw);
      const fz = Math.cos(stop.yaw);
      const vx = stop.x - fx * VALVE_BACK;
      const vz = stop.z - fz * VALVE_BACK;
      const runX = vx - fx * 12;
      const runZ = vz - fz * 12;
      if (bot.rampMode === "run") {
         // roll down the avenue into the valves
         steer(h, vx + fx, vz + fz, input);
         const along = (h.x - vx) * fx + (h.z - vz) * fz;
         if (along > 0.5 || b.step !== "vulnerable") bot.rampMode = "approach";
         return;
      }
      const d = goTo(bot, run, runX, runZ, input);
      if (d < 0.8) {
         input.moveX = 0;
         input.moveZ = 0;
         if (b.step === "vulnerable" && b.stepMs < 1800) bot.rampMode = "run";
      }
      return;
   }
   // phase 3: lap the plaza (its corners), timing each gate so the truck is under it as it shuts
   const plaza = c.blocks.find((k) => k.kind === "plaza");
   if (!plaza) return;
   const corners = [
      { x: plaza.bx * CELL, z: plaza.bz * CELL },
      { x: plaza.bx * CELL, z: (plaza.bz + 1) * CELL },
      { x: (plaza.bx + 1) * CELL, z: (plaza.bz + 1) * CELL },
      { x: (plaza.bx + 1) * CELL, z: plaza.bz * CELL },
   ];
   const at = (i: number) => corners[((i % 4) + 4) % 4];
   const target = at(bot.lapCorner);
   if (Math.hypot(target.x - h.x, target.z - h.z) < 1.4) bot.lapCorner += bot.lapDir;
   let next = at(bot.lapCorner);
   // the truck held or spun out on the street ahead: lap the other way
   if (!t.moving && Math.abs(t.x - (h.x + next.x) / 2) + Math.abs(t.z - (h.z + next.z) / 2) < CELL / 2 && Math.hypot(t.x - h.x, t.z - h.z) < CELL) {
      bot.lapDir = bot.lapDir === 1 ? -1 : 1;
      bot.lapCorner += bot.lapDir;
      next = at(bot.lapCorner);
   }
   let k = 1;
   for (const g of c.gates) {
      // a gate on the street ahead: pass it about half a second before it turns red (the truck, a
      // second behind, barges under the red bar); if it would be red on arrival, lap the other way
      const ahead = Math.abs(g.x - next.x) + Math.abs(g.z - next.z) < CELL / 2 + 0.1 && Math.abs(g.x - h.x) + Math.abs(g.z - h.z) < CELL;
      const before = (g.x - h.x) * (next.x - h.x) + (g.z - h.z) * (next.z - h.z) > 0;
      if (!ahead || !before) continue;
      const d = Math.hypot(g.x - h.x, g.z - h.z);
      const eta = (d / V_RUN) * 1000;
      const shut = gateShut(g, run.simMs);
      const shutIn = shut ? 0 : gateChangeIn(g, run.simMs);
      if (shut || shutIn < eta + 150) {
         if (d < 4.5) {
            bot.lapDir = bot.lapDir === 1 ? -1 : 1;
            bot.lapCorner += bot.lapDir;
         }
         continue;
      }
      if (b.step === "vulnerable" || b.step === "attack") {
         const want = shutIn - 500;
         const need = (d / Math.max(0.2, want)) * 1000;
         if (need < V_RUN) k = Math.max(0.6, need / V_RUN);
      }
   }
   goTo(bot, run, next.x, next.z, input, -1, k);
}

export function botInput(bot: Bot, run: CityRun, input: StepInput): void {
   input.yaw = 0;
   input.jumpPressed = false;
   input.jumpHeld = false;
   input.actionPressed = false;
   const c = run.course;
   const h = run.hero;
   if (run.ended) return;
   if (run.boss && run.boss.hp > 0) {
      bossPlay(bot, run, input);
   } else if (run.beaconIndex < beaconQuota(c)) {
      const bi = litBeacon(run);
      const beacon = c.beacons[bi];
      if (beacon.bus >= 0) busBeacon(bot, run, beacon.bus, input);
      else {
         if (h.onBus >= 0 && h.grounded) input.jumpPressed = true;
         bot.rampMode = "approach";
         beaconPoint(run, bi, pt);
         // a main gem within a few metres of the line is worth the detour
         let tx = pt.x;
         let tz = pt.z;
         const dB = Math.hypot(pt.x - h.x, pt.z - h.z);
         for (let i = 0; i < c.orbs.length; i++) {
            const o = c.orbs[i];
            if (run.collected[i] || !o.main || o.y > 2 || blockIndexAt(c, o.x, o.z) >= 0) continue;
            const dO = Math.hypot(o.x - h.x, o.z - h.z);
            if (dO < 9 && dO + Math.hypot(pt.x - o.x, pt.z - o.z) < dB + 7) {
               tx = o.x;
               tz = o.z;
               break;
            }
         }
         goTo(bot, run, tx, tz, input);
         if (bot.path.length > 0) holdForGate(run, bot.path[0].x, bot.path[0].z, input);
      }
   }
   if (bot.mash && run.simMs >= h.powerReadyAt && heroById(run.heroId).power !== "doubleJump") input.actionPressed = true;
   if (bot.mash && run.heroId === "nami" && !h.grounded && h.vy < 0) input.jumpPressed = true;
   // unstick: a jump after 700 ms without moving while trying to
   const moved = Math.hypot(h.x - bot.lastX, h.z - bot.lastZ);
   const trying = Math.abs(input.moveX) + Math.abs(input.moveZ) > 0.1;
   if (moved < 0.01 && trying && h.grounded) bot.still += bot.frameMs;
   else bot.still = 0;
   bot.lastX = h.x;
   bot.lastZ = h.z;
   if (bot.still > 700) {
      input.jumpPressed = true;
      bot.still = 0;
      bot.replanAt = 0;
   }
}

/** Runs a bot until the level ends (tests and the preview's ?autoplay=1). */
export function botRun(level: LevelId, fps = 60, hero: HeroId = "riko", mash = false, seed = 1): CityRun {
   const fms = 1000 / fps;
   const run = createRun(seed, level, hero);
   const bot = createBot(run, fms);
   bot.mash = mash;
   const input = createStepInput();
   const cap = Math.ceil(run.course.timerMs / fms) + 5;
   for (let f = 0; f < cap && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}
