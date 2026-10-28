// Color City Sprint rules. Pure and deterministic: one seeded run, stepped in whole milliseconds
// (the fraction carries, so 30, 60 and 144 fps agree). The signature is route-making laps. Streets
// travelled between beacons are painted red; on a later lap a red lane raises the cap from V_RUN to
// V_RED (exactly +30%, 8.5 m/s). Nothing exceeds V_RED, so the proof is Dijkstra over the street
// graph at red-lane speed on every edge, including every hero shortcut, minus early beacon pickups,
// every orb and the flow bonus. Level 5's floor is Greyout's least defeat time (each hit on the
// first instant of its window) with travel ignored, because travel only adds time.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "../../types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "../../menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "../../menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "../../menu2/secrets/secrets";
import {
   BRUSH_Y,
   BUS_ROOF,
   CELL,
   RAIL_Y,
   allowAll,
   busAt,
   closestNode,
   courseFor,
   distToSeg,
   gateClosed,
   nearestEdge,
   nodeX,
   nodeZ,
   onBusRoof,
   pathMetres,
   rampY,
   resolveXZ,
   type Course,
} from "./city";
import { DEFAULT_HERO, POWER_MS, heroById, type HeroId } from "./heroes";
import { COMBO, COMBO_BASE_MS, GREYOUT, SECRETS } from "./progression";

export const V_RED = 8.5;
/** A grey street. A red lane is exactly 30% faster (the card). */
export const V_RUN = V_RED / 1.3;
export const SLUDGE = 0.6;
export const G = 28;
export const V_JUMP = 9.2;
export const V_AIR = 8.4;
export const ORB_BONUS_MS = 200;
export const PICKUP_R = 1.5;
export const MAGNET_R = 6;
const ACCEL_G = 52;
const ACCEL_A = 24;
const COYOTE = 100;
const BUFFER = 130;
const ERASE_R = 4.2;
const ERASE_PAUSE = 5000;

export interface HeroBody {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   grounded: boolean;
   coyote: number;
   buffer: number;
   airJumps: number;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   powerReadyAt: number;
   onBus: boolean;
   stunUntil: number;
   edge: number;
}

export interface StepInput {
   moveX: number;
   moveZ: number;
   yaw: number;
   jumpPressed: boolean;
   jumpHeld: boolean;
   actionPressed: boolean;
}

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   powered: boolean;
   wallBroken: number;
   beacon: boolean;
   lap: boolean;
   orbCount: number;
   orbList: number[];
   secretCount: number;
   secretList: number[];
   comboLinked: boolean;
   redEnter: boolean;
   bossHit: boolean;
   bossDefeated: boolean;
   struck: boolean;
   finished: boolean;
   timeup: boolean;
}

export interface CityRun {
   seed: number;
   level: LevelId;
   heroId: HeroId;
   course: Course;
   hero: HeroBody;
   simMs: number;
   frac: number;
   lap: number;
   beaconIndex: number;
   painted: Uint8Array;
   leg: Uint8Array;
   redUsed: Uint8Array;
   collected: Uint8Array;
   cutOpen: boolean;
   orbs: number;
   mainOrbs: number;
   strikes: number;
   erasePause: number;
   struckStep: number;
   combo: ComboState;
   secrets: SecretTracker;
   boss: BossState | null;
   bossEv: BossEvents;
   ended: "win" | "timeup" | null;
   finishMs: number;
   events: StepEvents;
   wish: { x: number; z: number };
   scratch: { x: number; z: number };
   busX: number;
   busZ: number;
   busVx: number;
   busVz: number;
   truckX: number;
   truckZ: number;
   truckYaw: number;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
}

function clearEvents(e: StepEvents): void {
   e.jumped = e.airJumped = e.landed = e.powered = e.beacon = e.lap = false;
   e.comboLinked = e.redEnter = e.bossHit = e.bossDefeated = e.struck = e.finished = e.timeup = false;
   e.wallBroken = -1;
   e.orbCount = 0;
   e.secretCount = 0;
}

function makeEvents(): StepEvents {
   return {
      jumped: false, airJumped: false, landed: false, powered: false, wallBroken: -1,
      beacon: false, lap: false, orbCount: 0, orbList: new Array<number>(16).fill(0),
      secretCount: 0, secretList: new Array<number>(4).fill(0),
      comboLinked: false, redEnter: false, bossHit: false, bossDefeated: false,
      struck: false, finished: false, timeup: false,
   };
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): CityRun {
   const course = courseFor(level);
   const painted = new Uint8Array(course.edges.length);
   for (const i of course.prePaint) painted[i] = 1;
   const hero: HeroBody = {
      x: course.startX, y: 0, z: course.startZ, vx: 0, vy: 0, vz: 0,
      grounded: true, coyote: COYOTE, buffer: 0, airJumps: 0,
      dashUntil: -1, dashX: 1, dashZ: 0, shieldUntil: -1, magnetUntil: -1, phaseUntil: -1,
      powerReadyAt: 0, onBus: false, stunUntil: -1, edge: -1,
   };
   return {
      seed, level, heroId, course, hero, simMs: 0, frac: 0, lap: 0, beaconIndex: 0,
      painted, leg: new Uint8Array(course.edges.length), redUsed: new Uint8Array(course.edges.length),
      collected: new Uint8Array(course.orbs.length), cutOpen: false, orbs: 0, mainOrbs: 0, strikes: 0,
      erasePause: 0, struckStep: -1, combo: createCombo(), secrets: createSecretTracker(SECRETS[level]),
      boss: course.boss ? createBoss(GREYOUT) : null, bossEv: createBossEvents(),
      ended: null, finishMs: 0, events: makeEvents(), wish: { x: 0, z: 0 }, scratch: { x: 0, z: 0 },
      busX: course.rampLip.x, busZ: course.rampLip.z, busVx: 0, busVz: 0,
      truckX: course.rear.x, truckZ: course.rear.z, truckYaw: 0,
   };
}

function approach(v: number, target: number, maxDelta: number): number {
   const d = target - v;
   if (d > maxDelta) return v + maxDelta;
   if (d < -maxDelta) return v - maxDelta;
   return target;
}

function capInto(vx: number, vz: number, max: number, out: { x: number; z: number }): void {
   const s = Math.hypot(vx, vz);
   if (s > max && s > 0) {
      const k = max / s;
      out.x = vx * k;
      out.z = vz * k;
   } else {
      out.x = vx;
      out.z = vz;
   }
}

function inSludge(c: Course, x: number, z: number): boolean {
   for (const s of c.sludge) {
      const dx = x - s.x;
      const dz = z - s.z;
      if (dx * dx + dz * dz < s.r * s.r) return true;
   }
   return false;
}

function onRail(c: Course, x: number, z: number): boolean {
   const north = (c.nz - 1) * CELL;
   return Math.abs(z - north) <= 1.15 && x >= -0.4 && x <= (c.nx - 1) * CELL + 0.4;
}

function ringReady(run: CityRun): boolean {
   const ring = run.course.ringEdges;
   if (ring.length === 0) return false;
   for (let i = 0; i < ring.length; i++) if (!run.painted[ring[i]]) return false;
   return true;
}

/** Where the sweeper is this millisecond. It parks for each window so a hit can land. */
export function truckPose(run: CityRun): { x: number; z: number; yaw: number } {
   const b = run.boss;
   const c = run.course;
   const out = { x: c.rear.x, z: c.rear.z, yaw: 0 };
   if (!b) return out;
   const open = b.step === "attack" || b.step === "vulnerable";
   if (b.phase === 0 && open) return { x: c.brush.x, z: c.brush.z - 2.4, yaw: 0 };
   if (b.phase === 1 && open) return { x: c.rear.x + 3.4, z: c.rear.z, yaw: Math.PI / 2 };
   if (b.phase === 2) {
      if (run.hero.z > c.slam.z + 1.05) return { x: c.slam.x, z: c.slam.z, yaw: 0 };
      const dx = run.hero.x - c.slam.x;
      const dz = run.hero.z - c.slam.z;
      return { x: c.slam.x + dx * 0.35, z: c.slam.z + dz * 0.35, yaw: Math.atan2(dx, dz) };
   }
   const span = (c.nx - 1) * CELL;
   const t = (run.simMs % 8000) / 8000;
   const side = Math.floor(t * 4);
   const u = t * 4 - side;
   if (side === 0) return { x: u * span, z: CELL, yaw: 0 };
   if (side === 1) return { x: span, z: CELL + u * CELL, yaw: Math.PI / 2 };
   if (side === 2) return { x: span - u * span, z: CELL * 2, yaw: Math.PI };
   return { x: 0, z: CELL * 2 - u * CELL, yaw: -Math.PI / 2 };
}

function placeBus(run: CityRun, ms: number): void {
   const c = run.course;
   const b = run.boss;
   if (c.bus && b && b.phase === 0 && (b.step === "attack" || b.step === "vulnerable")) {
      run.busX = c.rampLip.x;
      run.busZ = c.rampLip.z;
      run.busVx = 0;
      run.busVz = 0;
      return;
   }
   if (!c.bus) {
      run.busX = c.rampLip.x;
      run.busZ = c.rampLip.z;
      run.busVx = 0;
      run.busVz = 0;
      return;
   }
   const p = busAt(c.bus, ms);
   run.busX = p.x;
   run.busZ = p.z;
   run.busVx = p.vx;
   run.busVz = p.vz;
}

function tryPower(run: CityRun, input: StepInput, ev: StepEvents): void {
   const h = run.hero;
   const ms = run.simMs;
   if (ms < h.powerReadyAt) return;
   const def = heroById(run.heroId);
   if (def.power === "doubleJump") return;
   inputToWorld(input.moveX, input.moveZ, input.yaw, run.wish);
   let dx = run.wish.x;
   let dz = run.wish.z;
   const m = Math.hypot(dx, dz);
   if (m < 0.2) {
      const s = Math.hypot(h.vx, h.vz);
      if (s > 0.2) {
         dx = h.vx / s;
         dz = h.vz / s;
      } else {
         dx = 1;
         dz = 0;
      }
   } else {
      dx /= m;
      dz /= m;
   }
   if (def.power === "dash") {
      h.dashX = dx;
      h.dashZ = dz;
      h.dashUntil = ms + POWER_MS.dash;
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else h.phaseUntil = ms + POWER_MS.phase;
   h.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

function win(run: CityRun, ev: StepEvents): void {
   run.ended = "win";
   run.finishMs = run.simMs;
   ev.finished = true;
}

function land(run: CityRun, surf: number, busHere: boolean, ev: StepEvents, fresh: boolean): void {
   const h = run.hero;
   if (fresh || !h.grounded) ev.landed = true;
   h.y = surf;
   h.vy = 0;
   h.grounded = true;
   h.coyote = COYOTE;
   h.onBus = busHere && surf >= BUS_ROOF - 0.08;
}

function stepMs(run: CityRun, input: StepInput, ev: StepEvents): void {
   if (run.ended) return;
   const c = run.course;
   if (run.simMs >= c.timerMs) {
      run.ended = "timeup";
      ev.timeup = true;
      return;
   }
   run.simMs += 1;
   const ms = run.simMs;
   const h = run.hero;
   comboTick(run.combo, COMBO, ms);

   const shut = c.gates.length > 0 && gateClosed(ms);
   const phaseOn = h.phaseUntil >= ms;
   const shield = h.shieldUntil >= ms;
   const magnet = h.magnetUntil >= ms;
   const dashing = h.dashUntil >= ms;
   if (h.buffer > 0) h.buffer -= 1;

   inputToWorld(input.moveX, input.moveZ, input.yaw, run.wish);
   let dirX = run.wish.x;
   let dirZ = run.wish.z;
   const mag = Math.hypot(dirX, dirZ);
   const stick = mag > 1 ? 1 : mag;
   if (mag > 1e-6) {
      dirX /= mag;
      dirZ /= mag;
   }
   const edge = nearestEdge(c, h.x, h.z);
   h.edge = edge;
   let vmax = V_RUN;
   if (run.lap >= 1 && edge >= 0 && run.painted[edge]) vmax = V_RED;
   if (h.grounded && inSludge(c, h.x, h.z) && !shield) vmax *= SLUDGE;

   if (ms < h.stunUntil) {
      h.vx *= 0.86;
      h.vz *= 0.86;
   } else if (dashing) {
      h.vx = h.dashX * V_RED;
      h.vz = h.dashZ * V_RED;
   } else {
      const accel = (h.grounded ? ACCEL_G : ACCEL_A) * 0.001;
      h.vx = approach(h.vx, dirX * stick * vmax, accel);
      h.vz = approach(h.vz, dirZ * stick * vmax, accel);
   }
   capInto(h.vx, h.vz, V_RED, run.scratch);
   h.vx = run.scratch.x;
   h.vz = run.scratch.z;

   placeBus(run, ms);
   let carryX = 0;
   let carryZ = 0;
   const parked = !!(run.boss && run.boss.phase === 0 && (run.boss.step === "attack" || run.boss.step === "vulnerable"));
   if (h.onBus && c.bus && !parked) {
      carryX = run.busVx;
      carryZ = run.busVz;
   }
   capInto(h.vx + carryX, h.vz + carryZ, V_RED, run.scratch);
   const moved = resolveXZ(c, h.x + run.scratch.x * 0.001, h.z + run.scratch.z * 0.001, phaseOn, run.cutOpen, dashing, shut);
   h.x = moved.x;
   h.z = moved.z;

   if (dashing && c.cut && !run.cutOpen) {
      const d = distToSeg(h.x, h.z, c.cut.ax, c.cut.az, c.cut.bx, c.cut.bz);
      if (d.dist < 1.35 && d.t > 0.15 && d.t < 0.85) {
         run.cutOpen = true;
         ev.wallBroken = c.cut.edge;
      }
   }

   const canGround = h.grounded || h.coyote > 0;
   if (h.buffer > 0 && canGround && h.vy <= 0) {
      h.vy = V_JUMP;
      h.grounded = false;
      h.coyote = 0;
      h.buffer = 0;
      h.airJumps = run.heroId === "nami" ? 1 : 0;
      h.onBus = false;
      ev.jumped = true;
   } else if (h.buffer > 0 && !h.grounded && h.airJumps > 0 && run.heroId === "nami" && ms >= h.powerReadyAt) {
      h.vy = V_AIR;
      h.airJumps = 0;
      h.buffer = 0;
      h.powerReadyAt = ms + heroById("nami").cooldownMs;
      ev.airJumped = true;
      ev.powered = true;
   }

   const ramp = rampY(c, h.x, h.z);
   const busHere = c.bus ? onBusRoof(h.x, h.z, run.busX, run.busZ, run.busVx, run.busVz) : false;
   let surf = ramp;
   if (busHere && h.y >= BUS_ROOF - 0.45) surf = Math.max(surf, BUS_ROOF);
   // within 0.2 m of the deck: a single jump off a bus roof (apex ~4.66) misses, Nami's second jump does not
   if (onRail(c, h.x, h.z) && h.y >= RAIL_Y - 0.2) surf = Math.max(surf, RAIL_Y);
   if (c.boss && h.y >= BRUSH_Y - 0.5) {
      const dx = h.x - c.brush.x;
      const dz = h.z - c.brush.z;
      if (dx * dx + dz * dz < 2.2 * 2.2) surf = Math.max(surf, BRUSH_Y);
   }
   if (h.vy <= 0 && h.y <= surf + 0.14 && h.y >= surf - 0.6) {
      land(run, surf, busHere, ev, false);
   } else {
      const was = h.grounded;
      h.grounded = false;
      h.onBus = false;
      if (was) h.coyote = COYOTE;
      h.vy -= G * 0.001;
      h.y += h.vy * 0.001;
      if (h.y <= surf) land(run, surf, busHere, ev, true);
      else if (h.coyote > 0) h.coyote -= 1;
   }

   const stand = nearestEdge(c, h.x, h.z);
   h.edge = stand;
   if (h.grounded && stand >= 0) run.leg[stand] = 1;
   if (run.lap >= 1 && stand >= 0 && run.painted[stand] && !run.redUsed[stand]) {
      run.redUsed[stand] = 1;
      if (comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.lane) > 0) ev.comboLinked = true;
      ev.redEnter = true;
   }

   const quota = c.laps * c.beacons.length;
   if (run.beaconIndex < quota) {
      const b = c.beacons[run.beaconIndex % c.beacons.length];
      let bx = nodeX(c, b.node);
      let bz = nodeZ(c, b.node);
      let by = 0;
      let ok = true;
      if (b.bus) {
         bx = run.busX;
         bz = run.busZ;
         by = BUS_ROOF;
         ok = h.onBus;
      }
      const dx = h.x - bx;
      const dz = h.z - bz;
      if (ok && dx * dx + dz * dz <= PICKUP_R * PICKUP_R && Math.abs(h.y - by) < 2.2) {
         for (let i = 0; i < run.leg.length; i++) {
            if (run.leg[i]) {
               run.painted[i] = 1;
               run.leg[i] = 0;
            }
         }
         const before = run.lap;
         run.beaconIndex += 1;
         run.lap = Math.min(c.laps, Math.floor(run.beaconIndex / c.beacons.length));
         if (comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.beacon) > 0) ev.comboLinked = true;
         ev.beacon = true;
         if (run.lap > before) ev.lap = true;
         if (!c.boss && run.beaconIndex >= quota) win(run, ev);
      }
   }

   const reach = magnet ? MAGNET_R : PICKUP_R;
   const reach2 = reach * reach;
   const oy = h.y + 0.55;
   for (let i = 0; i < c.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = c.orbs[i];
      const dx = h.x - o.x;
      const dy = oy - o.y;
      const dz = h.z - o.z;
      if (dx * dx + dy * dy + dz * dz > reach2) continue;
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.main) run.mainOrbs += 1;
      ev.orbList[ev.orbCount++] = i;
      if (comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.orb) > 0) ev.comboLinked = true;
   }

   const spots = c.secrets;
   for (let i = 0; i < spots.length; i++) {
      if (run.secrets.found[i]) continue;
      if (c.ringEdges.length > 0 && i === spots.length - 1 && !ringReady(run)) continue;
      const s = spots[i];
      const dx = h.x - s.x;
      const dy = oy - s.y;
      const dz = h.z - s.z;
      if (dx * dx + dy * dy + dz * dz > PICKUP_R * PICKUP_R) continue;
      if (collectSecret(run.secrets, i)) ev.secretList[ev.secretCount++] = i;
   }

   if (run.boss && !run.ended) {
      const boss = run.boss;
      const pose = truckPose(run);
      run.truckX = pose.x;
      run.truckZ = pose.z;
      run.truckYaw = pose.yaw;
      if (ms >= run.erasePause) {
         for (let i = 0; i < run.painted.length; i++) {
            if (!run.painted[i]) continue;
            const e = c.edges[i];
            const dx = e.mx - pose.x;
            const dz = e.mz - pose.z;
            if (dx * dx + dz * dz < ERASE_R * ERASE_R) run.painted[i] = 0;
         }
      }
      if (boss.step === "vulnerable") {
         const phase = boss.phase;
         let hit = false;
         if (phase === 0) {
            const dx = h.x - c.brush.x;
            const dz = h.z - c.brush.z;
            hit = h.y >= BRUSH_Y - 0.15 && dx * dx + dz * dz < 1.7 * 1.7;
         } else if (phase === 1) {
            const dx = h.x - c.rear.x;
            const dz = h.z - c.rear.z;
            hit = h.grounded && h.y < 1.6 && Math.hypot(h.vx, h.vz) >= V_RUN * 0.9 && dx * dx + dz * dz < 2.3 * 2.3;
         } else {
            const dx = pose.x - c.slam.x;
            const dz = pose.z - c.slam.z;
            hit = shut && dx * dx + dz * dz < 1.6 * 1.6;
         }
         if (hit) {
            const result = hitBoss(boss, GREYOUT, 1, run.bossEv);
            if (result !== "ignored") {
               ev.bossHit = true;
               if (phase === 0) run.erasePause = ms + ERASE_PAUSE;
               if (comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.hit) > 0) ev.comboLinked = true;
               if (result === "defeated") {
                  ev.bossDefeated = true;
                  win(run, ev);
               }
            }
         }
      } else if (boss.phase === 2 && boss.step === "attack" && run.struckStep !== boss.attack) {
         const dx = h.x - pose.x;
         const dz = h.z - pose.z;
         if (dx * dx + dz * dz < 1.7 * 1.7 && h.z < c.slam.z) {
            run.struckStep = boss.attack;
            run.strikes += 1;
            h.stunUntil = ms + 350;
            comboBreak(run.combo);
            ev.struck = true;
         }
      }
      if (boss.step !== "done" && boss.step !== "defeat") stepBoss(boss, GREYOUT, 1, run.bossEv);
   }

   if (!run.ended && run.simMs >= c.timerMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
}

export function step(run: CityRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   clearEvents(ev);
   if (run.ended || !(dtMs > 0)) return ev;
   if (input.jumpPressed) run.hero.buffer = BUFFER;
   if (input.actionPressed) tryPower(run, input, ev);
   run.frac += dtMs;
   let n = Math.floor(run.frac);
   run.frac -= n;
   const room = run.course.timerMs - run.simMs;
   if (n > room) n = room;
   for (let i = 0; i < n; i++) stepMs(run, input, ev);
   return ev;
}

/** The least rules-time to beat Greyout, hitting each window on the instant it opens. */
export function bossMinMs(): number {
   const s = createBoss(GREYOUT);
   const ev = createBossEvents();
   let t = 0;
   for (let guard = 0; guard < 80000 && s.step !== "defeat" && s.step !== "done"; guard++) {
      if (s.step === "vulnerable") {
         const r = hitBoss(s, GREYOUT, 1, ev);
         if (r === "defeated") return t;
         continue;
      }
      stepBoss(s, GREYOUT, 1, ev);
      t += 1;
   }
   return t;
}

const BOSS_FLOOR = bossMinMs();

export function travelMs(c: Course): number {
   if (c.boss) return BOSS_FLOOR;
   let metres = 0;
   let prev = c.start;
   const lip = c.ramps.length ? closestNode(c, c.rampLip.x, c.rampLip.z) : c.start;
   const total = c.laps * c.beacons.length;
   for (let i = 0; i < total; i++) {
      const b = c.beacons[i % c.beacons.length];
      const goal = b.bus ? lip : b.node;
      const leg = pathMetres(c, prev, goal, allowAll);
      metres += Math.max(0, leg - 2 * PICKUP_R);
      prev = goal;
   }
   return (metres / V_RED) * 1000;
}

export function comboSpecOf(c: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: c.laps * c.beacons.length, base: COMBO_BASE_MS.beacon },
         { count: c.edges.length, base: COMBO_BASE_MS.lane },
         { count: c.orbs.length, base: COMBO_BASE_MS.orb },
         { count: c.boss ? GREYOUT.maxHp : 0, base: COMBO_BASE_MS.hit },
      ],
   };
}

export function minDurationMsOf(c: Course): number {
   const bonus = c.orbs.length * ORB_BONUS_MS + comboMaxBonus(comboSpecOf(c));
   return Math.max(0, travelMs(c) - bonus);
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

export function proposeLimits(_id: LevelId, c: Course): LevelLimits {
   const least = minDurationMsOf(c);
   const minDurationMs = Math.floor((least * 0.95) / 100) * 100;
   const timeBaseMs = c.timerMs;
   return {
      kind: "time",
      maxScore: Math.floor((timeBaseMs - minDurationMs) / 10),
      minDurationMs,
      maxDurationMs: timeBaseMs,
      timeBaseMs,
   };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(1, courseFor(1)),
   2: proposeLimits(2, courseFor(2)),
   3: proposeLimits(3, courseFor(3)),
   4: proposeLimits(4, courseFor(4)),
   5: proposeLimits(5, courseFor(5)),
};

export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB_BONUS_MS - comboMs);
}

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The no-hit badge fails once Greyout clips the hero. A clean lap is zero. */
export function badgeHits(run: CityRun): number {
   return run.strikes > 0 ? 1 : 0;
}

/** The lit beacon, or the boss spot the hero should be chasing. */
export function guidePoint(run: CityRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const c = run.course;
   if (c.boss && run.boss && run.boss.hp > 0) {
      if (run.boss.phase === 0) {
         out.x = c.brush.x;
         out.y = BRUSH_Y;
         out.z = c.brush.z;
      } else if (run.boss.phase === 1) {
         out.x = c.rear.x;
         out.y = 1;
         out.z = c.rear.z;
      } else {
         out.x = c.far.x;
         out.y = 1;
         out.z = c.far.z;
      }
      return out;
   }
   const quota = c.laps * c.beacons.length;
   if (run.beaconIndex >= quota) {
      out.x = c.startX;
      out.y = 1.2;
      out.z = c.startZ;
      return out;
   }
   const b = c.beacons[run.beaconIndex % c.beacons.length];
   if (b.bus) {
      out.x = run.busX;
      out.y = BUS_ROOF + 1;
      out.z = run.busZ;
      return out;
   }
   out.x = nodeX(c, b.node);
   out.y = 1.4;
   out.z = nodeZ(c, b.node);
   return out;
}

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   lap: "lap",
   beacons: "beacons",
   hero: "hero",
   power: "power",
   finishMs: "finishMs",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   yaw: "yaw",
   guideX: "guideX",
   guideZ: "guideZ",
   speed: "speed",
   clock: "clock",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
   strikes: "strikes",
} as const;

export { courseFor };
