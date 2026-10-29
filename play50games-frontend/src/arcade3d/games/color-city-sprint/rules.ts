// Color City Sprint rules. Pure and deterministic: one run, stepped in whole milliseconds (the
// fraction carries, so 30, 60 and 144 fps agree). The signature is route-making laps: one beacon is
// lit at a time and you pick the line; the streets you ran between two beacons turn red when you
// reach it, and from lap 2 a red street lets you run at V_RED (+30 %) and curl into the ball, a
// chain of red streets feeding the flow meter. So lap 1's choices build lap 2's speed network.
//
// The proof (README "Score limits"): the hero's centre never moves more than V_RED / 1000 m in a ms
// (clamped at the end of every ms, whatever pushed it: a dash, a bus, a collision), and stays out of
// every building. So a run takes at least (the shortest path round the buildings through every beacon
// in order, minus each beacon's pickup reach) / V_RED, whatever lanes are red, whatever hero; the
// submitted time takes off every orb and the most flow bonus. Level 5's floor is Greyout's least
// defeat time (every hit on the first instant of its window); travel only adds to it.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "../../types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "../../menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "../../menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "../../menu2/secrets/secrets";
import {
   BEACON_TOP,
   BRUSH_HIT_Y,
   BUS_HALF_L,
   BUS_HALF_W,
   BUS_PICK_R,
   BUS_ROOF,
   CELL,
   HERO_R,
   PICKUP_R,
   RAIL_Y,
   STREET_HALF,
   TRUCK_HALF_L,
   TRUCK_HALF_W,
   TRUCK_ROOF,
   VALVE_BACK,
   VALVE_HIT_R,
   blockIndexAt,
   buildCourse,
   buildGeodesic,
   busAt,
   closestNode,
   cornerDistances,
   courseFor,
   createBusPose,
   edgesNear,
   gateShut,
   geoDistance,
   inBox,
   inCircles,
   inGate,
   nodeX,
   nodeZ,
   overRail,
   rampY,
   resolveXZ,
   streetRoute,
   streetUnder,
   ventOn,
   type BusPose,
   type Course,
   type Passage,
} from "./city";
import { DEFAULT_HERO, POWER_MS, heroById, type HeroId } from "./heroes";
import { BOSS_BEACON_LINKS, COMBO, COMBO_BASE_MS, GREYOUT, SECRETS } from "./progression";

export { buildCourse, courseFor };

/** A grey street (the W1 run speed). */
export const V_RUN = 6.5;
/** A red lane: +30 % (the card's 8.5 m/s). Nothing moves the hero faster: the proof's speed. */
export const V_RED = 8.5;
/** At this ground speed or more the hero curls into the ball (a red lane, the rail or a dash). */
export const V_ROLL = 7.6;
/** Off the red, a curled ball keeps its speed, bleeding this much (m/s²) down to V_RUN. */
export const ROLL_BLEED = 3;
/** Grey sludge: -40 % (Kiro's shield ignores it). */
export const SLUDGE = 0.6;
export const G = 30;
export const V_JUMP = 14;
/** Nami's second jump. */
export const V_AIR = 10;
/** Leaving a ramp's lip on your feet kicks you up a little. */
export const V_KICK = 4;
export const ORB_BONUS_MS = 200;
export const MAGNET_R = 6;
const ACCEL_G = 60;
const ACCEL_A = 22;
const COYOTE = 100;
const BUFFER = 130;
const STEP_UP = 0.6;
const STUN_BUMP = 260;
const STUN_STRUCK = 500;
const STUN_VENT = 450;
/** Greyout's first-phase hits stop its sweeping for this long (the card). */
export const ERASE_PAUSE = 5000;
/** Greyout sweeps the red from streets this near its centre. */
export const ERASE_R = 3.6;
/** The trail Greyout hunts in phase 3: a sample every TRAIL_MS, TRAIL_N of them. */
const TRAIL_MS = 25;
const TRAIL_N = 200;

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
   /** horizontal speed at take-off: the air keeps it */
   airSpeed: number;
   /** curled into the ball (ground speed V_ROLL or more) */
   curled: boolean;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   powerReadyAt: number;
   stunUntil: number;
   /** the bus whose roof the hero stands on, -1 none */
   onBus: number;
   onRail: boolean;
   /** on a red lane this ms (lap 2+, or level 5), or on the rail */
   onRed: boolean;
   insideGhost: number;
   lastBumpMs: number;
   lastVentMs: number;
}

export interface StepInput {
   moveX: number;
   moveZ: number;
   /** the orbit camera's yaw: the stick is camera-relative (menu2/camera) */
   yaw: number;
   jumpPressed: boolean;
   jumpHeld: boolean;
   actionPressed: boolean;
}

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   landSpeed: number;
   kicked: boolean;
   powered: boolean;
   siteOpened: boolean;
   ghostIn: boolean;
   railOn: boolean;
   curled: boolean;
   uncurled: boolean;
   redEnter: boolean;
   beacon: boolean;
   /** the beacon index (0..) just taken, -1 none */
   beaconTaken: number;
   lap: boolean;
   /** streets that turned red with this beacon */
   painted: number;
   erased: number;
   orbCount: number;
   orbList: number[];
   secretCount: number;
   secretList: number[];
   comboLinked: boolean;
   comboBonus: number;
   bumped: boolean;
   vented: boolean;
   struck: boolean;
   shielded: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossOpen: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   slam: boolean;
   sprayed: boolean;
   finished: boolean;
   timeup: boolean;
}

export interface Drone {
   x: number;
   z: number;
   until: number;
}

export interface Puddle {
   x: number;
   z: number;
   r: number;
   until: number;
}

export interface Truck {
   x: number;
   z: number;
   yaw: number;
   /** the drive the truck is on (intro, telegraphs): polyline, its length */
   path: { x: number; z: number }[];
   pathLen: number;
   /** the brush / valve stop it is heading to or parked at */
   stop: number;
   /** phase 3: spun out by a slammed gate until this ms */
   spinUntil: number;
   /** phase 3: it backs off after clipping the hero until this ms */
   pauseUntil: number;
   /** phase 3: the trail sample it is driving to (a count of samples since the start) */
   cursor: number;
   moving: boolean;
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
   /** beacons taken so far (all laps) */
   beaconIndex: number;
   painted: Uint8Array;
   /** the streets run on since the last beacon */
   leg: Uint8Array;
   /** red streets already counted for the flow meter (once each per run) */
   redUsed: Uint8Array;
   collected: Uint8Array;
   siteOpen: boolean;
   orbs: number;
   mainOrbs: number;
   strikes: number;
   combo: ComboState;
   secrets: SecretTracker;
   boss: BossState | null;
   bossEv: BossEvents;
   truck: Truck;
   drones: Drone[];
   puddles: Puddle[];
   erasePause: number;
   trailX: Float32Array;
   trailZ: Float32Array;
   trailHead: number;
   /** trail samples taken so far */
   trailCount: number;
   /** phase 3's open window (the truck ignores red gates and gets slammed) */
   bossOpen: boolean;
   /** local co-op relay: this player may not take the lit beacon (the other player's turn) */
   beaconLocked: boolean;
   ended: "win" | "timeup" | null;
   finishMs: number;
   events: StepEvents;
   buses: BusPose[];
   wish: { x: number; z: number };
   scratch: { x: number; z: number };
   passage: Passage;
   near: Int16Array;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
}

function makeEvents(): StepEvents {
   return {
      jumped: false, airJumped: false, landed: false, landSpeed: 0, kicked: false, powered: false, siteOpened: false, ghostIn: false, railOn: false,
      curled: false, uncurled: false, redEnter: false, beacon: false, beaconTaken: -1, lap: false, painted: 0, erased: 0,
      orbCount: 0, orbList: new Array<number>(32).fill(0), secretCount: 0, secretList: new Array<number>(4).fill(0),
      comboLinked: false, comboBonus: 0, bumped: false, vented: false, struck: false, shielded: false,
      bossTelegraph: false, bossAttack: false, bossOpen: false, bossHit: false, bossPhase: false, bossDefeated: false, slam: false, sprayed: false,
      finished: false, timeup: false,
   };
}

function clearEvents(e: StepEvents): void {
   e.jumped = e.airJumped = e.landed = e.kicked = e.powered = e.siteOpened = e.ghostIn = e.railOn = false;
   e.curled = e.uncurled = e.redEnter = e.beacon = e.lap = e.comboLinked = e.bumped = e.vented = e.struck = e.shielded = false;
   e.bossTelegraph = e.bossAttack = e.bossOpen = e.bossHit = e.bossPhase = e.bossDefeated = e.slam = e.sprayed = false;
   e.finished = e.timeup = false;
   e.landSpeed = 0;
   e.beaconTaken = -1;
   e.painted = e.erased = e.orbCount = e.secretCount = e.comboBonus = 0;
}

/** Where Greyout rolls in from (the city's far corner). */
function truckSpawn(c: Course): { x: number; z: number } {
   return { x: (c.nx - 1) * CELL, z: 0 };
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): CityRun {
   const course = courseFor(level);
   const painted = new Uint8Array(course.edges.length);
   for (const e of course.permanentEdges) painted[e] = 1;
   const hero: HeroBody = {
      x: course.startX, y: 0, z: course.startZ, vx: 0, vy: 0, vz: 0, grounded: true, coyote: COYOTE, buffer: 0, airJumps: 0, airSpeed: 0,
      curled: false, dashUntil: -1, dashX: 1, dashZ: 0, shieldUntil: -1, magnetUntil: -1, phaseUntil: -1, powerReadyAt: 0, stunUntil: -1,
      onBus: -1, onRail: false, onRed: false, insideGhost: -1, lastBumpMs: -9999, lastVentMs: -9999,
   };
   const spawn = truckSpawn(course);
   const run: CityRun = {
      seed, level, heroId, course, hero, simMs: 0, frac: 0, lap: 0, beaconIndex: 0,
      painted, leg: new Uint8Array(course.edges.length), redUsed: new Uint8Array(course.edges.length), collected: new Uint8Array(course.orbs.length),
      siteOpen: false, orbs: 0, mainOrbs: 0, strikes: 0, combo: createCombo(), secrets: createSecretTracker(SECRETS[level]),
      boss: course.boss ? createBoss(GREYOUT) : null, bossEv: createBossEvents(),
      truck: { x: spawn.x, z: spawn.z, yaw: 0, path: [], pathLen: 0, stop: 0, spinUntil: -1, pauseUntil: -1, cursor: 0, moving: false },
      drones: [], puddles: [], erasePause: 0,
      trailX: new Float32Array(TRAIL_N).fill(course.startX), trailZ: new Float32Array(TRAIL_N).fill(course.startZ), trailHead: 0, trailCount: 0,
      bossOpen: false, beaconLocked: false, ended: null, finishMs: 0, events: makeEvents(),
      buses: course.buses.map(() => createBusPose()), wish: { x: 0, z: 0 }, scratch: { x: 0, z: 0 },
      passage: { phase: false, insideGhost: -1, siteOpen: false }, near: new Int16Array(8),
   };
   for (let i = 0; i < course.buses.length; i++) busAt(course.buses[i], 0, run.buses[i]);
   // Greyout rolls in from the far corner to the east end of its avenue
   if (run.boss) planDrive(run, { x: (course.nx - 1) * CELL, z: course.permanentEdges.length ? course.edges[course.permanentEdges[0]].az : 0, yaw: -Math.PI / 2 }, false);
   return run;
}

// ---------------------------------------------------------------------------------------------
// helpers

function approach(v: number, target: number, maxDelta: number): number {
   const d = target - v;
   if (d > maxDelta) return v + maxDelta;
   if (d < -maxDelta) return v - maxDelta;
   return target;
}

/** The beacon the run is chasing (index into course.beacons). */
export function litBeacon(run: CityRun): number {
   const n = run.course.beacons.length;
   return run.beaconIndex % n;
}

/** Beacons a level needs (all laps); level 5 never runs out (Greyout ends it). */
export function beaconQuota(c: Course): number {
   return c.boss ? Number.POSITIVE_INFINITY : c.laps * c.beacons.length;
}

/** The lit beacon's centre this ms (a bus beacon rides its bus). */
export function beaconPoint(run: CityRun, index: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const b = run.course.beacons[index];
   if (b.bus >= 0) {
      const p = run.buses[b.bus];
      out.x = p.x;
      out.y = BUS_ROOF;
      out.z = p.z;
   } else {
      out.x = b.x;
      out.y = 0;
      out.z = b.z;
   }
   return out;
}

/** Red counts from lap 2 (level 5: always, the avenue and your lanes). */
function redLive(run: CityRun): boolean {
   return run.lap >= 1 || run.course.boss;
}

function onPaintedStreet(run: CityRun, x: number, z: number): boolean {
   const n = edgesNear(run.course, x, z, run.near);
   for (let i = 0; i < n; i++) if (run.painted[run.near[i]]) return true;
   return false;
}

export function ringReady(run: CityRun): boolean {
   const ring = run.course.ringEdges;
   if (ring.length === 0) return false;
   for (let i = 0; i < ring.length; i++) if (!run.painted[ring[i]]) return false;
   return true;
}

function tryPower(run: CityRun, input: StepInput, ev: StepEvents): void {
   const h = run.hero;
   const ms = run.simMs;
   if (ms < h.powerReadyAt || ms < h.stunUntil) return;
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
         dx = Math.sin(run.course.startYaw + Math.PI);
         dz = Math.cos(run.course.startYaw + Math.PI);
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

function link(run: CityRun, ev: StepEvents, base: number): void {
   const bonus = comboHit(run.combo, COMBO, run.simMs, base);
   if (bonus > 0) ev.comboBonus += bonus;
   if (run.combo.chain > 1) ev.comboLinked = true;
}

function struck(run: CityRun, ev: StepEvents, pushX: number, pushZ: number): void {
   const h = run.hero;
   if (h.shieldUntil >= run.simMs) {
      ev.shielded = true;
      return;
   }
   run.strikes += 1;
   h.stunUntil = run.simMs + STUN_STRUCK;
   const m = Math.hypot(pushX, pushZ) || 1;
   h.vx = (pushX / m) * 4;
   h.vz = (pushZ / m) * 4;
   comboBreak(run.combo);
   ev.struck = true;
}

function win(run: CityRun, ev: StepEvents): void {
   run.ended = "win";
   run.finishMs = run.simMs;
   ev.finished = true;
}

// ---------------------------------------------------------------------------------------------
// Greyout (level 5)

const routePts: { x: number; z: number }[] = [];

/**
 * Plans the truck's drive along the streets from where it is to a stop. With `facing` it comes in
 * from behind the stop, so it arrives driving the way the stop faces.
 */
function planDrive(run: CityRun, stop: { x: number; z: number; yaw: number }, facing = true): void {
   const c = run.course;
   const t = run.truck;
   const a = closestNode(c, t.x, t.z);
   const b = facing ? closestNode(c, stop.x - Math.sin(stop.yaw) * 6, stop.z - Math.cos(stop.yaw) * 6) : closestNode(c, stop.x, stop.z);
   const nodes = streetRoute(c, a, b);
   routePts.length = 0;
   routePts.push({ x: t.x, z: t.z });
   for (const id of nodes) routePts.push({ x: nodeX(c, id), z: nodeZ(c, id) });
   routePts.push({ x: stop.x, z: stop.z });
   // drop a first node the truck already passed (it sits on the street beyond it)
   if (routePts.length >= 3) {
      const p0 = routePts[0];
      const p1 = routePts[1];
      const p2 = routePts[2];
      const along = (p1.x - p0.x) * (p2.x - p1.x) + (p1.z - p0.z) * (p2.z - p1.z);
      if (along < 0) routePts.splice(1, 1);
   }
   t.path = routePts.map((p) => ({ x: p.x, z: p.z }));
   let len = 0;
   for (let i = 1; i < t.path.length; i++) len += Math.hypot(t.path[i].x - t.path[i - 1].x, t.path[i].z - t.path[i - 1].z);
   t.pathLen = len;
}

function drive(run: CityRun, k: number): void {
   const t = run.truck;
   const path = t.path;
   if (path.length === 0) return;
   // eased: it pulls away and brakes into the stop
   const e = k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
   let left = e * t.pathLen;
   for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dz = path[i].z - path[i - 1].z;
      const seg = Math.hypot(dx, dz);
      if (left <= seg || i === path.length - 1) {
         const f = seg > 0 ? Math.min(1, left / seg) : 1;
         t.x = path[i - 1].x + dx * f;
         t.z = path[i - 1].z + dz * f;
         if (seg > 0.01) t.yaw = Math.atan2(dx, dz);
         return;
      }
      left -= seg;
   }
}

export function valvePoint(t: Truck, out: { x: number; z: number }): { x: number; z: number } {
   out.x = t.x - Math.sin(t.yaw) * VALVE_BACK;
   out.z = t.z - Math.cos(t.yaw) * VALVE_BACK;
   return out;
}

const bp = { x: 0, z: 0 };

function trailSample(run: CityRun, count: number, out: { x: number; z: number }): void {
   const back = run.trailCount - count;
   const i = (((run.trailHead - back) % TRAIL_N) + TRAIL_N) % TRAIL_N;
   out.x = run.trailX[i];
   out.z = run.trailZ[i];
}

const hunt = { x: 0, z: 0 };

/** The truck's footprint overlaps a gate's bar (its box turned with its heading), grown by `grow`. */
export function truckUnderGate(t: { x: number; z: number; yaw: number }, g: { x: number; z: number; hx: number; hz: number }, x = t.x, z = t.z): boolean {
   const s = Math.abs(Math.sin(t.yaw));
   const co = Math.abs(Math.cos(t.yaw));
   const ex = s * TRUCK_HALF_L + co * TRUCK_HALF_W;
   const ez = co * TRUCK_HALF_L + s * TRUCK_HALF_W;
   return Math.abs(x - g.x) < g.hx + ex && Math.abs(z - g.z) < g.hz + ez;
}

/** Phase 3: Greyout drives your own trail, sample by sample, `delayMs` behind you, at up to `speed`. */
function chase(run: CityRun, delayMs: number, speed: number): void {
   const t = run.truck;
   const c = run.course;
   const ms = run.simMs;
   const newest = run.trailCount - Math.round(delayMs / TRAIL_MS);
   const oldest = run.trailCount - TRAIL_N + 1;
   if (t.cursor < oldest) t.cursor = oldest;
   let left = speed * 0.001;
   for (let guard = 0; guard < 8 && left > 1e-6 && t.cursor <= newest; guard++) {
      trailSample(run, t.cursor, hunt);
      const dx = hunt.x - t.x;
      const dz = hunt.z - t.z;
      const d = Math.hypot(dx, dz);
      const go = Math.min(d, left);
      const nx = d > 1e-9 ? t.x + (dx / d) * go : t.x;
      const nz = d > 1e-9 ? t.z + (dz / d) * go : t.z;
      for (const g of c.gates) {
         if (!gateShut(g, ms)) continue;
         // a red gate holds it back, except in its open window: then it barges in and the bar slams it
         if (!run.bossOpen && truckUnderGate(t, g, nx, nz) && !truckUnderGate(t, g)) return;
      }
      if (go > 1e-6) {
         t.moving = true;
         if (d > 0.3) t.yaw = Math.atan2(dx, dz);
      }
      t.x = nx;
      t.z = nz;
      left -= go;
      if (go >= d - 1e-9) t.cursor += 1;
   }
}

function stepBossMs(run: CityRun, ev: StepEvents): void {
   const boss = run.boss!;
   const c = run.course;
   const h = run.hero;
   const t = run.truck;
   const ms = run.simMs;
   const be = run.bossEv;
   stepBoss(boss, GREYOUT, 1, be);
   if (be.telegraph) ev.bossTelegraph = true;
   if (be.attack) ev.bossAttack = true;
   if (be.vulnerable) ev.bossOpen = true;
   if (be.phaseChanged) ev.bossPhase = true;
   const phase = boss.phase;
   const step = boss.step;
   t.moving = false;
   if (be.telegraph && phase < 2) {
      if (phase === 0) {
         t.stop = boss.attack % c.brushStops.length;
         planDrive(run, c.brushStops[t.stop]);
      } else {
         t.stop = boss.attack % c.valveStops.length;
         planDrive(run, c.valveStops[t.stop]);
      }
   }
   if (step === "intro") {
      drive(run, boss.stepMs / GREYOUT.introMs);
      t.moving = true;
   } else if (step === "telegraph" && phase < 2) {
      const a = GREYOUT.phases[phase].attacks[0];
      drive(run, boss.stepMs / a.telegraphMs);
      t.moving = true;
   } else if ((step === "attack" || step === "vulnerable") && phase < 2) {
      const stop = phase === 0 ? c.brushStops[t.stop] : c.valveStops[t.stop];
      t.x = stop.x;
      t.z = stop.z;
      t.yaw = stop.yaw;
   } else if (phase === 2 && step !== "defeat" && step !== "done" && step !== "transition") {
      // phase 3: it hunts your trail through the plaza; a red gate holds it, and a gate that shuts on it slams it
      if (be.telegraph && boss.attack === 0) t.cursor = run.trailCount - 40;
      if (ms >= t.spinUntil && ms >= t.pauseUntil) {
         run.bossOpen = step === "vulnerable";
         if (step === "attack") chase(run, 450, 10);
         else if (step === "vulnerable") chase(run, 1200, 6);
         else chase(run, 1200, 5.5);
      }
   }
   // phase 1: its brushes sweep the red off the streets it drives over (a brush hit stops it for 5 s)
   if (phase === 0 && t.moving && ms >= run.erasePause) {
      const n = edgesNear(c, t.x, t.z, run.near);
      for (let i = 0; i < n; i++) {
         const e = run.near[i];
         if (!run.painted[e] || c.edges[e].permanent) continue;
         run.painted[e] = 0;
         ev.erased += 1;
      }
   }
   // phase 2's attack: sludge sprayed out behind it, drone cones dropped ahead
   if (be.attack && phase === 1) {
      ev.sprayed = true;
      const fx = Math.sin(t.yaw);
      const fz = Math.cos(t.yaw);
      for (let k = -1; k <= 1; k++) {
         run.puddles.push({ x: t.x - fx * (6 + Math.abs(k) * 1.5) + fz * k * 2, z: t.z - fz * (6 + Math.abs(k) * 1.5) - fx * k * 2, r: 1.5, until: ms + 7000 });
      }
      for (const side of [-1, 1]) run.drones.push({ x: t.x + fx * 7 + fz * side * 2, z: t.z + fz * 7 - fx * side * 2, until: ms + 5500 });
   }
   for (let i = run.puddles.length - 1; i >= 0; i--) if (run.puddles[i].until <= ms) run.puddles.splice(i, 1);
   for (let i = run.drones.length - 1; i >= 0; i--) if (run.drones[i].until <= ms) run.drones.splice(i, 1);

   if (step === "defeat" || step === "done") return;
   // contact: the truck's body pushes the hero out; its sweep (phase 1), its hunt (phase 3) and the drones strike
   const inside = h.y < TRUCK_ROOF - 0.5 && inBox(h.x, h.z, t.x, t.z, t.yaw, TRUCK_HALF_L, TRUCK_HALF_W, HERO_R + 0.2);
   if (inside) {
      const fx = Math.sin(t.yaw);
      const fz = Math.cos(t.yaw);
      const side = (h.x - t.x) * fz - (h.z - t.z) * fx >= 0 ? 1 : -1;
      // only a sweeping brush or a hunting (moving) truck hurts; a parked or held truck is just in the way
      const hurts = (phase === 0 && step === "attack") || (phase === 2 && t.moving);
      if (hurts && ms >= h.stunUntil) {
         struck(run, ev, fz * side, -fx * side);
         t.pauseUntil = ms + 1500;
      }
   }
   if (h.y < 2.4) {
      for (const d of run.drones) {
         const dx = h.x - d.x;
         const dz = h.z - d.z;
         if (dx * dx + dz * dz < 1.1 * 1.1 && ms >= h.stunUntil) {
            struck(run, ev, dx, dz);
            d.until = ms;
         }
      }
   }
   if (step !== "vulnerable") return;
   let hit = false;
   if (phase === 0) {
      // off a ramp onto its roof brush units (a plain jump never gets this high)
      hit = h.y >= BRUSH_HIT_Y && h.y <= BRUSH_HIT_Y + 2.5 && inBox(h.x, h.z, t.x, t.z, t.yaw, TRUCK_HALF_L, TRUCK_HALF_W, 0.3);
      if (hit) {
         run.erasePause = ms + ERASE_PAUSE;
         // bounced off the brushes, back the way you came
         h.vy = 9;
         h.vx = -h.vx * 0.5;
         h.vz = -h.vz * 0.5;
         h.airSpeed = Math.hypot(h.vx, h.vz);
         h.grounded = false;
      }
   } else if (phase === 1) {
      valvePoint(t, bp);
      const dx = h.x - bp.x;
      const dz = h.z - bp.z;
      const fx = Math.sin(t.yaw);
      const fz = Math.cos(t.yaw);
      const toward = h.vx * fx + h.vz * fz;
      if (h.grounded && h.curled && toward > 0 && dx * dx + dz * dz <= VALVE_HIT_R * VALVE_HIT_R) {
         hit = true;
         h.vx = -fx * 4;
         h.vz = -fz * 4;
         h.stunUntil = ms + 200;
      }
   } else if (ms >= t.spinUntil) {
      for (const g of c.gates) {
         // a red bar comes down on it (it shut on the truck, or the truck barged under it)
         if (!gateShut(g, ms)) continue;
         if (truckUnderGate(t, g)) {
            hit = true;
            ev.slam = true;
            t.spinUntil = ms + 2200;
         }
      }
   }
   if (!hit) return;
   const result = hitBoss(boss, GREYOUT, 1, be);
   if (result === "ignored") return;
   ev.bossHit = true;
   if (result === "phase") ev.bossPhase = true;
   link(run, ev, COMBO_BASE_MS.hit);
   if (result === "defeated") {
      ev.bossDefeated = true;
      // the whole city repaints red
      run.painted.fill(1);
      run.drones.length = 0;
      run.puddles.length = 0;
      win(run, ev);
   }
}

// ---------------------------------------------------------------------------------------------
// one millisecond

const busPoseTmp = createBusPose();
const resolved = { x: 0, z: 0 };

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
   for (let i = 0; i < c.buses.length; i++) busAt(c.buses[i], ms, run.buses[i]);

   const shield = h.shieldUntil >= ms;
   const dashing = h.dashUntil >= ms;
   const stunned = ms < h.stunUntil;
   if (h.buffer > 0) h.buffer -= 1;

   // --- horizontal
   inputToWorld(input.moveX, input.moveZ, input.yaw, run.wish);
   let dirX = run.wish.x;
   let dirZ = run.wish.z;
   const mag = Math.hypot(dirX, dirZ);
   const stick = mag > 1 ? 1 : mag;
   if (mag > 1e-6) {
      dirX /= mag;
      dirZ /= mag;
   }
   const wasRed = h.onRed;
   h.onRed = h.onRail || (redLive(run) && h.y < 0.6 && onPaintedStreet(run, h.x, h.z));
   if (h.onRed && !wasRed && !h.onRail) ev.redEnter = true;
   let vmax = h.onRed ? V_RED : V_RUN;
   const sludged = h.grounded && !shield && (inCircles(c.sludge, h.x, h.z) >= 0 || inCircles(run.puddles, h.x, h.z) >= 0);
   if (sludged) vmax *= SLUDGE;
   const speed = Math.hypot(h.vx, h.vz);
   if (stunned) {
      h.vx *= 0.993;
      h.vz *= 0.993;
   } else if (dashing) {
      h.vx = h.dashX * V_RED;
      h.vz = h.dashZ * V_RED;
   } else if (h.grounded) {
      // a curled ball coasting off the red keeps its speed and bleeds it; sludge bleeds it fast
      const coasting = speed > vmax;
      const target = coasting ? Math.max(vmax, speed - (sludged ? 25 : ROLL_BLEED) * 0.001) : stick * vmax;
      const accel = (stick > 0 || !coasting ? ACCEL_G : 25) * 0.001;
      if (stick > 0) {
         h.vx = approach(h.vx, dirX * target, accel * 1.6);
         h.vz = approach(h.vz, dirZ * target, accel * 1.6);
      } else {
         h.vx = approach(h.vx, 0, accel);
         h.vz = approach(h.vz, 0, accel);
      }
   } else {
      const cap = Math.max(V_RUN, h.airSpeed);
      h.vx = approach(h.vx, dirX * stick * cap, ACCEL_A * 0.001);
      h.vz = approach(h.vz, dirZ * stick * cap, ACCEL_A * 0.001);
   }
   let carryX = 0;
   let carryZ = 0;
   if (h.onBus >= 0) {
      carryX = run.buses[h.onBus].vx;
      carryZ = run.buses[h.onBus].vz;
   }
   const px = h.x;
   const pz = h.z;
   let nx = px + (h.vx + carryX) * 0.001;
   let nz = pz + (h.vz + carryZ) * 0.001;
   // a shut gate stops you entering its bar (one already under it walks out)
   for (const g of c.gates) {
      if (!gateShut(g, ms) || inGate(g, px, pz) || !inGate(g, nx, nz)) continue;
      if (Math.abs(nx - g.x) < g.hx + HERO_R && Math.abs(px - g.x) >= g.hx + HERO_R) {
         nx = px;
         h.vx = 0;
      }
      if (Math.abs(nz - g.z) < g.hz + HERO_R && Math.abs(pz - g.z) >= g.hz + HERO_R) {
         nz = pz;
         h.vz = 0;
      }
   }
   const pass = run.passage;
   pass.phase = h.phaseUntil >= ms;
   pass.insideGhost = h.insideGhost;
   pass.siteOpen = run.siteOpen;
   resolveXZ(c, nx, nz, pass, resolved);
   nx = resolved.x;
   nz = resolved.z;
   // a bus is solid at street level: it shoves you aside (a horn and a stumble)
   for (let i = 0; i < c.buses.length; i++) {
      if (i === h.onBus) continue;
      const b = run.buses[i];
      if (h.y >= BUS_ROOF - 0.5 || !inBox(nx, nz, b.x, b.z, b.yaw, BUS_HALF_L, BUS_HALF_W, HERO_R)) continue;
      const fx = Math.sin(b.yaw);
      const fz = Math.cos(b.yaw);
      const dx = nx - b.x;
      const dz = nz - b.z;
      const along = dx * fx + dz * fz;
      const side = dx * fz - dz * fx;
      const s = side >= 0 ? 1 : -1;
      const out = BUS_HALF_W + HERO_R + 0.01;
      if (Math.abs(along) > BUS_HALF_L + HERO_R - 0.35) {
         // at its nose or tail
         const a = (along >= 0 ? 1 : -1) * (BUS_HALF_L + HERO_R + 0.01);
         nx = b.x + fx * a + fz * side;
         nz = b.z + fz * a - fx * side;
      } else {
         nx = b.x + fx * along + fz * out * s;
         nz = b.z + fz * along - fx * out * s;
      }
      if (ms - h.lastBumpMs > 700 && (b.vx !== 0 || b.vz !== 0)) {
         h.lastBumpMs = ms;
         h.stunUntil = Math.max(h.stunUntil, ms + STUN_BUMP);
         h.vx = fz * s * 3;
         h.vz = -fx * s * 3;
         ev.bumped = true;
      }
   }
   if (run.boss && run.boss.step !== "done") {
      const t = run.truck;
      if (h.y < TRUCK_ROOF - 0.5 && inBox(nx, nz, t.x, t.z, t.yaw, TRUCK_HALF_L, TRUCK_HALF_W, HERO_R)) {
         const fx = Math.sin(t.yaw);
         const fz = Math.cos(t.yaw);
         const dx = nx - t.x;
         const dz = nz - t.z;
         const along = dx * fx + dz * fz;
         const side = dx * fz - dz * fx;
         const outL = TRUCK_HALF_L + HERO_R + 0.01 - Math.abs(along);
         const outW = TRUCK_HALF_W + HERO_R + 0.01 - Math.abs(side);
         if (outL < outW) {
            const a = (along >= 0 ? 1 : -1) * (TRUCK_HALF_L + HERO_R + 0.01);
            nx = t.x + fx * a + fz * side;
            nz = t.z + fz * a - fx * side;
         } else {
            const s = (side >= 0 ? 1 : -1) * (TRUCK_HALF_W + HERO_R + 0.01);
            nx = t.x + fx * along + fz * s;
            nz = t.z + fz * along - fx * s;
         }
      }
   }
   // a ramp's side is a wall to a hero below its surface
   const rampHere = rampY(c, nx, nz);
   if (rampHere - h.y > STEP_UP && h.vy <= 0.5) {
      nx = px;
      nz = pz;
   }
   // the proof's one invariant: never more than V_RED / 1000 m in a ms
   const mx = nx - px;
   const mz = nz - pz;
   const moved = Math.hypot(mx, mz);
   const limit = V_RED * 0.001;
   if (moved > limit) {
      nx = px + (mx / moved) * limit;
      nz = pz + (mz / moved) * limit;
   }
   h.x = nx;
   h.z = nz;

   if (dashing && !run.siteOpen) {
      for (const b of c.blocks) {
         if (b.kind !== "site") continue;
         const dx = Math.max(b.x0 - h.x, 0, h.x - b.x1);
         const dz = Math.max(b.z0 - h.z, 0, h.z - b.z1);
         if (dx * dx + dz * dz < 0.7 * 0.7) {
            run.siteOpen = true;
            ev.siteOpened = true;
         }
      }
   }
   const gi = blockIndexAt(c, h.x, h.z);
   const ghostNow = gi >= 0 && c.blocks[gi].kind === "ghost" ? gi : -1;
   if (ghostNow >= 0 && h.insideGhost < 0) ev.ghostIn = true;
   h.insideGhost = ghostNow;

   // --- vertical
   const canGround = h.grounded || h.coyote > 0;
   if (!stunned && h.buffer > 0 && canGround && h.vy <= 0.01) {
      h.vy = V_JUMP;
      h.grounded = false;
      h.coyote = 0;
      h.buffer = 0;
      h.airJumps = run.heroId === "nami" ? 1 : 0;
      h.airSpeed = Math.hypot(h.vx, h.vz);
      if (h.onBus >= 0) {
         // a jump off a moving roof keeps the bus's way (never past the hero's own cap)
         h.vx += carryX;
         h.vz += carryZ;
         const s = Math.hypot(h.vx, h.vz);
         if (s > V_RED) {
            h.vx *= V_RED / s;
            h.vz *= V_RED / s;
         }
         h.airSpeed = Math.min(V_RED, s);
      }
      h.onBus = -1;
      h.onRail = false;
      ev.jumped = true;
   } else if (!stunned && h.buffer > 0 && !h.grounded && h.airJumps > 0) {
      h.vy = V_AIR;
      h.airJumps = 0;
      h.buffer = 0;
      ev.airJumped = true;
      ev.powered = true;
   }
   let surf = rampHere;
   let busHere = -1;
   for (let i = 0; i < c.buses.length; i++) {
      const b = run.buses[i];
      if (h.y >= BUS_ROOF - 0.5 && inBox(h.x, h.z, b.x, b.z, b.yaw, BUS_HALF_L, BUS_HALF_W, 0.1)) {
         if (BUS_ROOF > surf) {
            surf = BUS_ROOF;
            busHere = i;
         }
      }
   }
   const railHere = overRail(c, h.x, h.z) && h.y >= RAIL_Y - 0.25;
   if (railHere && RAIL_Y > surf) {
      surf = RAIL_Y;
      busHere = -1;
   }
   if (h.grounded) {
      if (surf <= h.y + STEP_UP && surf >= h.y - 0.3) {
         h.y = surf;
         h.vy = 0;
      } else {
         // walked off a ledge (a ramp's lip, a roof, the rail's end)
         const offLip = h.onBus < 0 && !h.onRail && h.y > 0.8 && h.y <= 1.6;
         h.grounded = false;
         h.coyote = COYOTE;
         h.airSpeed = Math.hypot(h.vx, h.vz);
         h.airJumps = run.heroId === "nami" ? 1 : 0;
         if (h.onBus >= 0) {
            h.vx += carryX;
            h.vz += carryZ;
            const s = Math.hypot(h.vx, h.vz);
            if (s > V_RED) {
               h.vx *= V_RED / s;
               h.vz *= V_RED / s;
            }
            h.airSpeed = Math.min(V_RED, s);
         }
         if (offLip && h.airSpeed > 2) {
            h.vy = V_KICK;
            ev.kicked = true;
         }
      }
   }
   if (!h.grounded) {
      h.vy -= G * 0.001;
      h.y += h.vy * 0.001;
      if (h.coyote > 0) h.coyote -= 1;
      if (h.vy <= 0 && h.y <= surf && h.y >= surf - 0.9) {
         ev.landed = true;
         ev.landSpeed = -h.vy;
         h.y = surf;
         h.vy = 0;
         h.grounded = true;
         h.coyote = COYOTE;
      } else if (h.y < surf - 0.9 && h.y < 0) {
         h.y = 0;
         h.vy = 0;
         h.grounded = true;
      }
   }
   const wasRail = h.onRail;
   h.onBus = h.grounded ? busHere : -1;
   h.onRail = h.grounded && Math.abs(h.y - RAIL_Y) < 0.01;
   if (h.onRail && !wasRail) ev.railOn = true;

   const gs = Math.hypot(h.vx, h.vz);
   const curled = h.grounded ? gs >= V_ROLL || (h.curled && gs > V_RUN + 0.3) : h.curled;
   if (curled && !h.curled) ev.curled = true;
   if (!curled && h.curled) ev.uncurled = true;
   h.curled = curled;

   // --- paint: the streets under your feet join this leg
   if (h.grounded && h.y < 0.3) {
      const e = streetUnder(c, h.x, h.z);
      if (e >= 0) run.leg[e] = 1;
   }
   if (h.onRed && !h.onRail && redLive(run)) {
      const n = edgesNear(c, h.x, h.z, run.near);
      for (let i = 0; i < n; i++) {
         const e = run.near[i];
         if (run.painted[e] && !run.redUsed[e]) {
            run.redUsed[e] = 1;
            link(run, ev, COMBO_BASE_MS.lane);
         }
      }
   }

   // --- the lit beacon
   const quota = beaconQuota(c);
   if (run.beaconIndex < quota && !run.beaconLocked) {
      const bi = litBeacon(run);
      const b = c.beacons[bi];
      let ok = false;
      if (b.bus >= 0) {
         const p = run.buses[b.bus];
         ok = h.onBus === b.bus && (h.x - p.x) ** 2 + (h.z - p.z) ** 2 <= BUS_PICK_R * BUS_PICK_R;
      } else {
         ok = (h.x - b.x) ** 2 + (h.z - b.z) ** 2 <= PICKUP_R * PICKUP_R && h.y < BEACON_TOP;
      }
      if (ok) takeBeacon(run, ev, bi);
   }

   // --- orbs (a drain's coins only come out for the magnet)
   const magnet = h.magnetUntil >= ms;
   const oy = h.y + 0.6;
   for (let i = 0; i < c.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = c.orbs[i];
      if (o.drain >= 0 && !magnet) continue;
      const reach = magnet ? MAGNET_R : PICKUP_R;
      const dx = h.x - o.x;
      const dy = oy - o.y;
      const dz = h.z - o.z;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.main) run.mainOrbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
      link(run, ev, COMBO_BASE_MS.orb);
   }

   // --- secrets
   const spots = c.secrets;
   const list = SECRETS[run.level];
   for (let i = 0; i < spots.length; i++) {
      if (run.secrets.found[i]) continue;
      if (list[i].id === "perfect-loop" && !ringReady(run)) continue;
      const s = spots[i];
      const dx = h.x - s.x;
      const dy = oy - s.y;
      const dz = h.z - s.z;
      if (dx * dx + dy * dy + dz * dz > PICKUP_R * PICKUP_R) continue;
      if (collectSecret(run.secrets, i)) ev.secretList[ev.secretCount++] = i;
   }

   // --- steam vents (Kiro's shield walks through)
   if (h.y < 1.2 && ms - h.lastVentMs > 900) {
      for (let i = 0; i < c.vents.length; i++) {
         const v = c.vents[i];
         if (!ventOn(ms, i)) continue;
         const dx = h.x - v.x;
         const dz = h.z - v.z;
         if (dx * dx + dz * dz > v.r * v.r) continue;
         h.lastVentMs = ms;
         if (shield) {
            ev.shielded = true;
            break;
         }
         h.stunUntil = Math.max(h.stunUntil, ms + STUN_VENT);
         h.vx *= 0.2;
         h.vz *= 0.2;
         h.vy = 6;
         h.grounded = false;
         h.airSpeed = 1;
         comboBreak(run.combo);
         ev.vented = true;
         break;
      }
   }

   if (run.boss) {
      if (ms % TRAIL_MS === 0) {
         run.trailHead = (run.trailHead + 1) % TRAIL_N;
         run.trailCount += 1;
         run.trailX[run.trailHead] = h.x;
         run.trailZ[run.trailHead] = h.z;
      }
      stepBossMs(run, ev);
   }

   if (!run.ended && run.simMs >= c.timerMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
}

function takeBeacon(run: CityRun, ev: StepEvents, bi: number): void {
   const c = run.course;
   let painted = 0;
   for (let i = 0; i < run.leg.length; i++) {
      if (!run.leg[i]) continue;
      if (!run.painted[i]) painted += 1;
      run.painted[i] = 1;
      run.leg[i] = 0;
   }
   ev.painted = painted;
   const before = run.lap;
   run.beaconIndex += 1;
   if (!c.boss) run.lap = Math.min(c.laps - 1, Math.floor(run.beaconIndex / c.beacons.length));
   ev.beacon = true;
   ev.beaconTaken = bi;
   if (run.lap > before) ev.lap = true;
   if (!c.boss || run.beaconIndex <= BOSS_BEACON_LINKS) link(run, ev, COMBO_BASE_MS.beacon);
   if (!c.boss && run.beaconIndex >= c.laps * c.beacons.length) win(run, ev);
}

/**
 * Advances the run by dtMs (any frame time): whole ms are simulated, the fraction carries. The jump
 * and power presses of the frame count once.
 */
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
   if (n > room) n = room + 1;
   for (let i = 0; i < n && !run.ended; i++) stepMs(run, input, ev);
   return ev;
}

// ---------------------------------------------------------------------------------------------
// the proof

/** The least rules-time to beat Greyout: every hit on the first instant of its window. */
export function bossMinMs(): number {
   const s = createBoss(GREYOUT);
   const ev = createBossEvents();
   let t = 0;
   for (let guard = 0; guard < 400_000 && s.step !== "defeat" && s.step !== "done"; guard++) {
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

/** The sample spacing of a bus loop in the proof (m). */
const BUS_SAMPLE = 0.5;

/**
 * The least distance (m) any run of the level must cover: the beacons in order, every lap, round the
 * buildings, each beacon taken from the edge of its reach. A bus beacon is taken somewhere on its
 * bus's loop (sampled every BUS_SAMPLE m, so its reach grows by half of that).
 */
export function travelMetres(c: Course): number {
   const geo = buildGeodesic(c);
   const seq: { x: number; z: number; r: number; bus: number }[] = [];
   const n = c.beacons.length;
   for (let lap = 0; lap < c.laps; lap++) {
      for (let i = 0; i < n; i++) {
         const b = c.beacons[i];
         seq.push(b.bus >= 0 ? { x: 0, z: 0, r: BUS_PICK_R + BUS_SAMPLE / 2, bus: b.bus } : { x: b.x, z: b.z, r: PICKUP_R, bus: -1 });
      }
   }
   // candidates per point: one centre, or the bus loop's samples
   const cands = seq.map((p) => {
      if (p.bus < 0) return [{ x: p.x, z: p.z }];
      const bus = c.buses[p.bus];
      if (bus.parked) return [{ x: bus.pts[0].x, z: bus.pts[0].z }];
      const out: { x: number; z: number }[] = [];
      for (let i = 0; i < bus.pts.length; i++) {
         const a = bus.pts[i];
         const b = bus.pts[(i + 1) % bus.pts.length];
         const steps = Math.ceil(bus.segs[i] / BUS_SAMPLE);
         for (let k = 0; k < steps; k++) out.push({ x: a.x + ((b.x - a.x) * k) / steps, z: a.z + ((b.z - a.z) * k) / steps });
      }
      return out;
   });
   let prevPts = [{ x: c.startX, z: c.startZ }];
   let prevCost = [0];
   let prevR = 0;
   for (let k = 0; k < seq.length; k++) {
      const next = cands[k];
      const cost = new Array<number>(next.length).fill(Infinity);
      for (let i = 0; i < prevPts.length; i++) {
         const from = cornerDistances(geo, prevPts[i].x, prevPts[i].z);
         for (let j = 0; j < next.length; j++) {
            const d = geoDistance(geo, from, prevPts[i].x, prevPts[i].z, next[j].x, next[j].z);
            // the leg starts within prevR of the last centre and ends within r of this one
            const leg = Math.max(0, d - prevR - seq[k].r);
            if (prevCost[i] + leg < cost[j]) cost[j] = prevCost[i] + leg;
         }
      }
      prevPts = next;
      prevCost = cost;
      prevR = seq[k].r;
   }
   return Math.min(...prevCost);
}

/** The least finish time (rules ms) before any bonus. */
export function minFinishMs(c: Course): number {
   if (c.boss) return bossMinMs();
   return (travelMetres(c) / V_RED) * 1000;
}

export function comboSpecOf(c: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: c.boss ? BOSS_BEACON_LINKS : c.laps * c.beacons.length, base: COMBO_BASE_MS.beacon },
         { count: c.edges.length, base: COMBO_BASE_MS.lane },
         { count: c.orbs.length, base: COMBO_BASE_MS.orb },
         { count: c.boss ? GREYOUT.maxHp : 0, base: COMBO_BASE_MS.hit },
      ],
   };
}

/** The least submitted duration: the least finish less every orb and the most flow bonus. */
export function minDurationMsOf(c: Course): number {
   const bonus = c.orbs.length * ORB_BONUS_MS + comboMaxBonus(comboSpecOf(c));
   return Math.max(0, minFinishMs(c) - bonus);
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/** 95 % of the bound, floored to 100 ms; maxScore from it (the server's time formula). */
export function proposeLimits(_id: LevelId, c: Course): LevelLimits {
   const least = minDurationMsOf(c);
   const minDurationMs = Math.floor((least * 0.95) / 100) * 100;
   const timeBaseMs = c.timerMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}

/** The shipped limits (meta.ts, arcade-games.json and the pinned test agree with these). */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: { kind: "time", maxScore: 8290, minDurationMs: 17100, maxDurationMs: 100000, timeBaseMs: 100000 },
   2: { kind: "time", maxScore: 10360, minDurationMs: 26400, maxDurationMs: 130000, timeBaseMs: 130000 },
   3: { kind: "time", maxScore: 12710, minDurationMs: 32900, maxDurationMs: 160000, timeBaseMs: 160000 },
   4: { kind: "time", maxScore: 16130, minDurationMs: 38700, maxDurationMs: 200000, timeBaseMs: 200000 },
   5: { kind: "time", maxScore: 17390, minDurationMs: 26100, maxDurationMs: 200000, timeBaseMs: 200000 },
};

export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB_BONUS_MS - comboMs);
}

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The no-hit badge: never clipped by a bus horn, a vent, a drone or Greyout. Bumps count too. */
export function badgeHits(run: CityRun): number {
   return run.strikes;
}

/** Where the hero should head: the lit beacon, or on level 5 the spot Greyout is open at. */
export function guidePoint(run: CityRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const c = run.course;
   const b = run.boss;
   if (b && b.hp > 0 && b.step !== "intro") {
      if (b.phase === 0) {
         const stop = c.brushStops[run.truck.stop];
         const r = c.ramps[stop.ramp];
         out.x = r.x - r.dx * 5;
         out.y = 0;
         out.z = r.z - r.dz * 5;
         return out;
      }
      if (b.phase === 1) {
         valvePoint(run.truck, bp);
         out.x = bp.x;
         out.y = 0;
         out.z = bp.z;
         return out;
      }
      const g = c.gates[0];
      out.x = g.x;
      out.y = 0;
      out.z = g.z;
      return out;
   }
   if (!c.boss && run.beaconIndex >= beaconQuota(c)) {
      out.x = run.hero.x;
      out.y = 0;
      out.z = run.hero.z;
      return out;
   }
   return beaconPoint(run, litBeacon(run), out);
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
   bossOn: "bossOn",
   red: "red",
   speed: "speed",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
   strikes: "strikes",
} as const;
