// Zoo Escape rules: pure and seeded (no three.js, React, DOM, Math.random or Date.now). The Scene
// calls stepRun once per useRunFrame and turns run.events into store calls, sound and effects.
// Every gameplay number lives here or in level.ts and is pinned in rules.test.ts.
import { clampToBounds, circlesOverlapXZ, distanceToBoxXZ, resolveSphereAabb, sphereAabbOverlap, type AABB } from "@/arcade3d/core/collision";
import { hasLineOfSightXZ, inViewCone, investigate, stepPatrol, type Agent, type Box, type PatrolOptions, type PatrolState } from "@/arcade3d/core/ai";
import type { Path } from "@/arcade3d/core/path";
import { launchForTime } from "@/arcade3d/core/ballistics";
import { rngNext, turnTowards } from "@/arcade3d/core/math";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, type ZooLevel } from "./levels";
import { BAR_DROP, CORNER_WAIT, LIGHT_1, MAP_1, ROUTE_SPEED, stageOf, type Jeep, type Searchlight, type StageIndex, type ZooMap } from "./level";

const DEG = Math.PI / 180;

export const PANDA = { radius: 0.5, walk: 3.2, sneak: 1.6, accel: 20, brake: 28, turn: 12, moving: 0.2 } as const;
export const KEEPER = {
   radius: 0.35,
   speed: ROUTE_SPEED,
   investigateSpeed: 2.0,
   wait: CORNER_WAIT,
   lookAngle: 0.6,
   investigateLook: 0.7,
   lookSpeed: 2.2,
   /** seeded phase steps per cycle: offset = C · k / 6 */
   offsets: 6,
   waits: { seen: 2.5, heard: 2.0, bamboo: 3.0, radio: 2.5 },
} as const;
export const VISION = { halfAngle: 30 * DEG, range: [7, 7, 9] as readonly number[] } as const;
export const HEARING = { walk: 3.0, sneak: 1.2, cooldown: 2 } as const;
/** One catch time for every device (user decision 2026-10-24). */
export const SUSPICION = { catchS: 1.35, decay: 0.5 } as const;
export const TOSS = { perStage: 2, distance: 4, march: 0.1, clearance: 0.3, flight: 0.6, launchHeight: 0.6, gravity: 9.81, lureRange: 10 } as const;
export const CATCH = { penalty: 5, max: 3, cardS: 1.2, graceS: 1.0 } as const;
export const CLOCK = { startS: 180 } as const;
/** Level 1's searchlight (level.ts LIGHT_1); every map lists its own (ZooMap.lights). */
export const SEARCHLIGHT: Readonly<Searchlight> = LIGHT_1;
/** Birds (Bird Garden): a panda walking (not sneaking, > 0.2 m/s) within `range` squawks the bird; the nearest calm keeper of the stage within `alertRange` comes to look; then the bird settles for `cooldown` s. */
export const BIRDS = { range: 1.6, cooldown: 4, alertRange: 12 } as const;
export const SNACK = { perStage: 4, reach: 0.8, minGap: 3 } as const;
export const SCORE = { win: 1000, perSecond: 10, snack: 50, catch: 100 } as const;
export const SNACK_COUNT = SNACK.perStage * 3;

/**
 * The proven server limits (README "Server limits and why they hold"). meta.scoring keeps the
 * provisional values until Claude's go-live PR copies these into meta.ts and arcade-games.json.
 */
export const PROPOSED_LIMITS: ScoringRules = {
   kind: "points",
   maxScore: 3290,
   minDurationMs: 5000,
   maxDurationMs: 182000,
   base: 0,
   maxPointsPerSec: 163,
   unitLabel: "pts",
   display: "int",
};

/**
 * Per-level proven limits (README "Levels"): a level changes only the catch time, the meter decay, the
 * keepers' investigate speed, the bundles and the catch penalty. The bound B(k) uses only the route
 * floor, the walk speed, the snacks, the win bonus and the clock; catches only take points and time
 * away, and the earliest end is still three bump catches after 1 s grace with two 1.2 s cards (5.4 s).
 * So every level keeps PROPOSED_LIMITS. meta.ts still serves the provisional block on every level
 * until Claude's go-live PR switches all five together.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = { 1: PROPOSED_LIMITS, 2: PROPOSED_LIMITS, 3: PROPOSED_LIMITS, 4: PROPOSED_LIMITS, 5: PROPOSED_LIMITS };

export type Kind = "seen" | "heard" | "bamboo" | "radio";
const PRIORITY: Record<Kind, number> = { bamboo: 1, heard: 2, radio: 2, seen: 3 };
export type CatchReason = "seen" | "light" | "found" | "bump" | "jeep";
export type EndKind = "win" | "lose" | "timeup";

/** Level 1's routes (every map has its own: ZooMap.routes). */
export const ROUTES: readonly Path[] = MAP_1.routes;

const PATROL: PatrolOptions = { speed: KEEPER.speed, wait: KEEPER.wait, lookAngle: KEEPER.lookAngle, lookSpeed: KEEPER.lookSpeed };
const INVESTIGATE: Record<Kind, PatrolOptions> = {
   seen: { speed: KEEPER.investigateSpeed, investigateWait: KEEPER.waits.seen, lookAngle: KEEPER.investigateLook, lookSpeed: KEEPER.lookSpeed },
   heard: { speed: KEEPER.investigateSpeed, investigateWait: KEEPER.waits.heard, lookAngle: KEEPER.investigateLook, lookSpeed: KEEPER.lookSpeed },
   bamboo: { speed: KEEPER.investigateSpeed, investigateWait: KEEPER.waits.bamboo, lookAngle: KEEPER.investigateLook, lookSpeed: KEEPER.lookSpeed },
   radio: { speed: KEEPER.investigateSpeed, investigateWait: KEEPER.waits.radio, lookAngle: KEEPER.investigateLook, lookSpeed: KEEPER.lookSpeed },
};

export interface Keeper {
   /** the run's investigate options (the level's investigate speed) */
   inv: Record<Kind, PatrolOptions>;
   index: number;
   stage: StageIndex;
   /** its map's route, zone (investigations are clamped into it) and stage cycle */
   route: Path;
   zone: AABB;
   cycle: number;
   agent: Agent;
   patrol: PatrolState;
   /** seeded schedule offset (s) */
   offset: number;
   /** suspicion 0..1 */
   meter: number;
   seeing: boolean;
   lastSeen: { x: number; y: number; z: number };
   /** what it is investigating (null on its route) */
   kind: Kind | null;
   hearCooldown: number;
}

export interface Snack {
   x: number;
   z: number;
   stage: StageIndex;
   eaten: boolean;
}

export interface Bundle {
   shown: boolean;
   x: number;
   z: number;
}

export interface RunEvents {
   snack: number;
   caught: CatchReason | null;
   catcher: number;
   stage: number;
   thrown: boolean;
   landed: boolean;
   lured: number;
   heard: number;
   alerts: number;
   /** the bird that squawked this step (-1 none) */
   squawk: number;
   rustle: boolean;
   bar: number;
   cardEnd: boolean;
   end: EndKind | null;
}

export interface JeepState {
   x: number;
   z: number;
   yaw: number;
}

export interface BirdState {
   /** seconds until it can squawk again */
   cool: number;
   /** seconds since its last squawk (drawing: the flap) */
   since: number;
}

export interface RunState {
   /** the level this run was built from; level 1 is the module constants */
   level: ZooLevel;
   /** the level's map */
   map: ZooMap;
   /** schedule phase per stage: its first keeper's offset (its searchlight and jeeps run on it) */
   phases: number[];
   jeeps: JeepState[];
   birds: BirdState[];
   seed: number;
   time: number;
   timeLeft: number;
   panda: { x: number; y: number; z: number; vx: number; vz: number; facing: number; speed: number; sneaking: boolean; hidden: number };
   stage: StageIndex;
   reached: StageIndex;
   bars: boolean[];
   keepers: Keeper[];
   light: { yaw: number; meter: number; seeing: boolean; lastSeen: { x: number; y: number; z: number }; phase: number };
   snacks: Snack[];
   eaten: number;
   catches: number;
   bundlesLeft: number;
   toss: { active: boolean; t: number; from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; v: { x: number; y: number; z: number } };
   bundles: Bundle[];
   card: number;
   grace: number;
   lastCatch: CatchReason | null;
   /** the keeper (or -1 the searchlight) of the last catch */
   lastCatcher: number;
   over: EndKind | null;
   events: RunEvents;
}

export interface StepInput {
   /** world direction (inputToWorld), length <= 1 */
   dirX: number;
   dirZ: number;
   sneak: boolean;
   toss: boolean;
}

// ---------- keepers ----------

/** Puts a keeper where its undisturbed patrol is at schedule time tau (s): on corner 0 at tau = 0, starting its wait. */
export function placeOnSchedule(agent: Agent, patrol: PatrolState, keeper: number, tau: number, map: ZooMap = MAP_1): void {
   const pts = map.keepers[keeper].route;
   const first = pts[0];
   const last = pts[pts.length - 1];
   agent.x = first.x; agent.y = 0; agent.z = first.z; agent.vx = 0; agent.vy = 0; agent.vz = 0;
   agent.yaw = Math.atan2(first.x - last.x, first.z - last.z);
   patrol.index = 1 % pts.length;
   patrol.wait = KEEPER.wait;
   patrol.mode = "patrol";
   patrol.lookYaw = agent.yaw;
   patrol.lookPhase = 0;
   const c = map.cycles[map.keepers[keeper].stage];
   const t = ((tau % c) + c) % c;
   if (t > 0) stepPatrol(agent, patrol, map.routes[keeper], t, PATROL);
}

function newKeeper(index: number, offset: number, map: ZooMap): Keeper {
   const agent: Agent = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0 };
   const patrol: PatrolState = { index: 1, wait: 0, mode: "patrol", target: { x: 0, y: 0, z: 0 } };
   placeOnSchedule(agent, patrol, index, offset, map);
   const def = map.keepers[index];
   return {
      inv: INVESTIGATE, index, stage: def.stage, route: map.routes[index], zone: def.zone, cycle: map.cycles[def.stage],
      agent, patrol, offset, meter: 0, seeing: false, lastSeen: { x: 0, y: 0, z: 0 }, kind: null, hearCooldown: 0,
   };
}

const SCRATCH = { p: { x: 0, y: 0, z: 0 }, one: [null as unknown as Box], o: { x: 0, y: 0, z: 0 }, d: { x: 0, y: 0, z: 0 } };

/** Sends a keeper to `point` (clamped into its zone) unless it is on a more important lead. */
export function sendKeeper(k: Keeper, point: { x: number; z: number }, kind: Kind): boolean {
   if (k.kind && PRIORITY[kind] < PRIORITY[k.kind]) return false;
   const zone = k.zone;
   SCRATCH.p.x = point.x; SCRATCH.p.y = 0; SCRATCH.p.z = point.z;
   clampToBounds(SCRATCH.p, zone, 0, SCRATCH.p);
   SCRATCH.p.y = 0;
   investigate(k.patrol, SCRATCH.p);
   k.kind = kind;
   return true;
}

function stepKeeper(k: Keeper, dt: number): void {
   stepPatrol(k.agent, k.patrol, k.route, dt, k.patrol.mode === "investigate" && k.kind ? k.inv[k.kind] : PATROL);
   if (k.patrol.mode !== "investigate") k.kind = null;
   if (k.hearCooldown > 0) k.hearCooldown = Math.max(0, k.hearCooldown - dt);
}

// ---------- sight ----------

const containsXZ = (b: AABB, x: number, z: number) => x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z;

/** hasLineOfSightXZ over every blocker except the boxes holding the eye (a keeper standing in a bush, the tower). */
export function clearSight(eye: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }, blockers: readonly Box[] = MAP_1.blockers): boolean {
   const one = SCRATCH.one;
   for (let i = 0; i < blockers.length; i++) {
      const b = blockers[i];
      if (containsXZ(b, eye.x, eye.z)) continue;
      one[0] = b;
      if (!hasLineOfSightXZ(eye, target, one)) return false;
   }
   return true;
}

/** Does a keeper (feet, yaw) of `stage` see the point? (cone ∧ sight; hiding is the caller's) */
export function keeperSees(feet: { x: number; y: number; z: number }, yaw: number, stage: StageIndex, p: { x: number; y: number; z: number }, map: ZooMap = MAP_1): boolean {
   return inViewCone(feet, yaw, VISION.halfAngle, map.vision[stage], p) && clearSight(feet, p, map.blockers);
}

export const searchlightYaw = (time: number, phase: number, light: Searchlight = LIGHT_1) => light.baseYaw + light.sweep * Math.sin((2 * Math.PI * (time + phase)) / light.period);
const TOWER_EYE = { x: 0, y: 0, z: 0 };
export function searchlightSees(yaw: number, p: { x: number; y: number; z: number }, light: Searchlight = LIGHT_1, map: ZooMap = MAP_1): boolean {
   TOWER_EYE.x = light.x; TOWER_EYE.z = light.z;
   return inViewCone(TOWER_EYE, yaw, light.halfAngle, light.range, p) && clearSight(TOWER_EYE, p, map.blockers);
}

/** The stage whose searchlight the run sweeps on `stage`: its own, else the last stage that has one (-1 none). */
export function lightStageFor(map: ZooMap, stage: StageIndex): number {
   if (map.lights[stage]) return stage;
   for (let s = map.lights.length - 1; s >= 0; s--) if (map.lights[s]) return s;
   return -1;
}

/** The bush whose box holds the point (-1 = none). */
export function bushAt(x: number, z: number, map: ZooMap = MAP_1): number {
   const bushes = map.bushes;
   for (let i = 0; i < bushes.length; i++) if (containsXZ(bushes[i].box, x, z)) return i;
   return -1;
}

// ---------- jeeps ----------

/** Where a jeep is at schedule time t (s; once round its loop per `cycle`), written into `out`: centre and heading (0 = +z). */
export function jeepPose(j: Jeep, cycle: number, t: number, out: JeepState): JeepState {
   const pts = j.route;
   let total = 0;
   for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; total += Math.hypot(b.x - a.x, b.z - a.z); }
   let d = ((((t / cycle) % 1) + 1) % 1) * total;
   for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (d <= len || i === pts.length - 1) {
         const k = len > 0 ? Math.min(1, d / len) : 0;
         out.x = a.x + (b.x - a.x) * k; out.z = a.z + (b.z - a.z) * k;
         out.yaw = Math.atan2(b.x - a.x, b.z - a.z);
         return out;
      }
      d -= len;
   }
   return out;
}

/** A jeep's body box at its pose (its loop is axis-aligned, so the box is too), written into `out`. */
export function jeepBox(j: Jeep, pose: JeepState, out: AABB): AABB {
   const alongX = Math.abs(Math.sin(pose.yaw)) > 0.5;
   const hx = (alongX ? j.length : j.width) / 2, hz = (alongX ? j.width : j.length) / 2;
   out.min.x = pose.x - hx; out.max.x = pose.x + hx; out.min.z = pose.z - hz; out.max.z = pose.z + hz;
   out.min.y = 0; out.max.y = 1.8;
   return out;
}

// ---------- the run ----------

/** Seeded keeper offset steps (k in 0..5 each) and the 4 snack picks per stage. */
export function seedLayout(seed: number, map: ZooMap = MAP_1): { offsets: number[]; snacks: number[][] } {
   const rng = { s: seed };
   const offsets = map.keepers.map(() => Math.floor(rngNext(rng) * KEEPER.offsets));
   const snacks = map.snacks.map((cands) => {
      const order = cands.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
         const j = Math.floor(rngNext(rng) * (i + 1));
         [order[i], order[j]] = [order[j], order[i]];
      }
      const picked: number[] = [];
      for (const i of order) {
         if (picked.length === SNACK.perStage) break;
         if (picked.every((j) => Math.hypot(cands[i].x - cands[j].x, cands[i].z - cands[j].z) >= SNACK.minGap)) picked.push(i);
      }
      return picked;
   });
   return { offsets, snacks };
}

/** The investigate options of a level (level 1: INVESTIGATE itself). */
export function investigateFor(level: ZooLevel): Record<Kind, PatrolOptions> {
   if (level.investigate === KEEPER.investigateSpeed) return INVESTIGATE;
   return {
      seen: { ...INVESTIGATE.seen, speed: level.investigate },
      heard: { ...INVESTIGATE.heard, speed: level.investigate },
      bamboo: { ...INVESTIGATE.bamboo, speed: level.investigate },
      radio: { ...INVESTIGATE.radio, speed: level.investigate },
   };
}

export function createRun(seed: number, layoutIn?: { offsets: number[]; snacks: number[][] }, level: ZooLevel = LEVELS[1]): RunState {
   const map = level.map;
   const layout = layoutIn ?? seedLayout(seed, map);
   const keepers = map.keepers.map((def, i) => newKeeper(i, (map.cycles[def.stage] * layout.offsets[i]) / KEEPER.offsets, map));
   const inv = investigateFor(level);
   for (const k of keepers) k.inv = inv;
   const snacks: Snack[] = [];
   layout.snacks.forEach((picks, s) => {
      for (const i of picks) snacks.push({ x: map.snacks[s][i].x, z: map.snacks[s][i].z, stage: s as StageIndex, eaten: false });
   });
   const phases = [0, 1, 2].map((s) => (map.stageKeepers[s].length ? keepers[map.stageKeepers[s][0]].offset : 0));
   const ls = lightStageFor(map, 0);
   const start = map.stages[0].start;
   const jeeps = map.jeeps.map((j) => jeepPose(j, map.cycles[j.stage], phases[j.stage], { x: 0, z: 0, yaw: 0 }));
   return {
      level,
      map,
      phases,
      jeeps,
      birds: map.birds.map(() => ({ cool: 0, since: 99 })),
      seed,
      time: 0,
      timeLeft: CLOCK.startS,
      panda: { x: start.x, y: 0, z: start.z, vx: 0, vz: 0, facing: Math.PI, speed: 0, sneaking: false, hidden: bushAt(start.x, start.z, map) },
      stage: 0,
      reached: 0,
      bars: map.stages.map(() => false),
      keepers,
      light: { yaw: ls >= 0 ? map.lights[ls]!.baseYaw : 0, meter: 0, seeing: false, lastSeen: { x: 0, y: 0, z: 0 }, phase: ls >= 0 ? phases[ls] : 0 },
      snacks,
      eaten: 0,
      catches: 0,
      bundlesLeft: level.bundles,
      toss: { active: false, t: 0, from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 } },
      bundles: [{ shown: false, x: 0, z: 0 }, { shown: false, x: 0, z: 0 }],
      card: 0,
      grace: CATCH.graceS,
      lastCatch: null,
      lastCatcher: -2,
      over: null,
      events: { snack: -1, caught: null, catcher: -1, stage: -1, thrown: false, landed: false, lured: -1, heard: -1, alerts: 0, squawk: -1, rustle: false, bar: -1, cardEnd: false, end: null },
   };
}

export const liveScore = (run: Pick<RunState, "eaten" | "catches">) => Math.max(0, SCORE.snack * run.eaten - SCORE.catch * run.catches);
export function finalScore(run: Pick<RunState, "eaten" | "catches" | "over" | "timeLeft">): number {
   if (run.over !== "win") return liveScore(run);
   return Math.max(0, SCORE.win + SCORE.perSecond * Math.floor(Math.max(0, run.timeLeft)) + SCORE.snack * run.eaten - SCORE.catch * run.catches);
}

function clearEvents(e: RunEvents) {
   e.snack = -1; e.caught = null; e.catcher = -1; e.stage = -1; e.thrown = false; e.landed = false; e.lured = -1; e.heard = -1; e.alerts = 0; e.squawk = -1; e.rustle = false; e.bar = -1; e.cardEnd = false; e.end = null;
}

// ---------- movement ----------

function overlapsSolid(run: RunState, x: number, z: number, r: number): boolean {
   const p = SCRATCH.o;
   const { solids, bars } = run.map;
   p.x = x; p.y = 0.5; p.z = z;
   for (let i = 0; i < solids.length; i++) if (sphereAabbOverlap(p, r, solids[i])) return true;
   for (let i = 0; i < bars.length; i++) if (run.bars[i] && sphereAabbOverlap(p, r, bars[i])) return true;
   return false;
}

const MAP_BOX: AABB = { min: { x: 0, y: -10, z: 0 }, max: { x: 0, y: 10, z: 0 } };

function resolve(run: RunState, p: { x: number; y: number; z: number }) {
   const { solids, bars, box } = run.map;
   for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < solids.length; i++) resolveSphereAabb(p, PANDA.radius, solids[i], p);
      for (let i = 0; i < bars.length; i++) if (run.bars[i]) resolveSphereAabb(p, PANDA.radius, bars[i], p);
      p.y = 0.5;
   }
   MAP_BOX.min.x = box.x0; MAP_BOX.min.z = box.z0; MAP_BOX.max.x = box.x1; MAP_BOX.max.z = box.z1;
   clampToBounds(p, MAP_BOX, PANDA.radius, p);
   p.y = 0.5;
}

/** Moves the panda one step: eased velocity, collisions, the map clamp, never faster than the walk. */
export function movePanda(run: RunState, input: StepInput, dt: number): void {
   const pd = run.panda;
   const len = Math.hypot(input.dirX, input.dirZ);
   const amount = Math.min(1, len);
   const top = input.sneak ? PANDA.sneak : PANDA.walk;
   const tx = len > 1e-6 ? (input.dirX / len) * amount * top : 0;
   const tz = len > 1e-6 ? (input.dirZ / len) * amount * top : 0;
   const rate = Math.hypot(tx, tz) >= Math.hypot(pd.vx, pd.vz) ? PANDA.accel : PANDA.brake;
   let dx = tx - pd.vx;
   let dz = tz - pd.vz;
   const dl = Math.hypot(dx, dz);
   const maxDv = rate * dt;
   if (dl > maxDv) { dx *= maxDv / dl; dz *= maxDv / dl; }
   pd.vx += dx; pd.vz += dz;
   const v = Math.hypot(pd.vx, pd.vz);
   if (v > PANDA.walk) { pd.vx *= PANDA.walk / v; pd.vz *= PANDA.walk / v; }
   const ox = pd.x, oz = pd.z;
   const p = SCRATCH.d;
   p.x = ox + pd.vx * dt; p.y = 0.5; p.z = oz + pd.vz * dt;
   resolve(run, p);
   let mx = p.x - ox, mz = p.z - oz;
   const moved = Math.hypot(mx, mz);
   const cap = PANDA.walk * dt;
   if (moved > cap) {
      mx *= cap / moved; mz *= cap / moved;
      if (overlapsSolid(run, ox + mx, oz + mz, PANDA.radius - 1e-6)) { mx = 0; mz = 0; }
   }
   pd.x = ox + mx; pd.z = oz + mz;
   pd.vx = mx / dt; pd.vz = mz / dt;
   pd.speed = Math.hypot(mx, mz) / dt;
   pd.sneaking = input.sneak;
   if (len > 0.05) pd.facing = turnTowards(pd.facing, Math.atan2(input.dirX, input.dirZ), Math.min(1, PANDA.turn * dt));
}

// ---------- toss ----------

function freeForBundle(stage: StageIndex, x: number, z: number, map: ZooMap): boolean {
   const b = map.stages[stage].bounds;
   const c = TOSS.clearance;
   if (x < b.x0 + c || x > b.x1 - c || z < b.z0 + c || z > b.z1 - c) return false;
   const solids = map.solids;
   for (let i = 0; i < solids.length; i++) if (distanceToBoxXZ(x, z, solids[i]) < c) return false;
   return true;
}

/** Where a bundle thrown from (x, z) along `facing` lands: the last free point of the 4 m segment (0.1 m march). */
export function tossLanding(stage: StageIndex, x: number, z: number, facing: number, out: { x: number; z: number }, map: ZooMap = MAP_1): { x: number; z: number } {
   const sx = Math.sin(facing), sz = Math.cos(facing);
   out.x = x; out.z = z;
   const steps = Math.round(TOSS.distance / TOSS.march);
   for (let i = 1; i <= steps; i++) {
      const px = x + sx * TOSS.march * i, pz = z + sz * TOSS.march * i;
      if (!freeForBundle(stage, px, pz, map)) break;
      out.x = px; out.z = pz;
   }
   return out;
}

/** The nearest calm keeper of the run's stage within `range` of (x, z) (-1 none): it investigates there as `kind`. */
function callKeeper(run: RunState, x: number, z: number, range: number, kind: Kind): number {
   let best = -1, bestD = Infinity;
   for (const i of run.map.stageKeepers[run.stage]) {
      const k = run.keepers[i];
      if (k.meter > 0 || (k.kind && PRIORITY[k.kind] > PRIORITY[kind])) continue;
      const d = Math.hypot(k.agent.x - x, k.agent.z - z);
      if (d <= range && d < bestD) { best = i; bestD = d; }
   }
   if (best >= 0) sendKeeper(run.keepers[best], { x, z }, kind);
   return best;
}

function lure(run: RunState, x: number, z: number): number {
   let best = -1, bestD = Infinity;
   for (const i of run.map.stageKeepers[run.stage]) {
      const k = run.keepers[i];
      if (k.meter > 0 || (k.kind && PRIORITY[k.kind] > PRIORITY.bamboo)) continue;
      const d = Math.hypot(k.agent.x - x, k.agent.z - z);
      if (d <= TOSS.lureRange && d < bestD) { best = i; bestD = d; }
   }
   if (best >= 0) sendKeeper(run.keepers[best], { x, z }, "bamboo");
   return best;
}

function stepToss(run: RunState, wantToss: boolean, dt: number): void {
   const t = run.toss, e = run.events, pd = run.panda;
   if (wantToss && run.bundlesLeft > 0 && !t.active) {
      run.bundlesLeft--;
      t.active = true; t.t = 0;
      t.from.x = pd.x; t.from.y = TOSS.launchHeight; t.from.z = pd.z;
      const land = tossLanding(run.stage, pd.x, pd.z, pd.facing, SCRATCH.p, run.map);
      t.to.x = land.x; t.to.y = 0; t.to.z = land.z;
      launchForTime(t.from, t.to, TOSS.flight, { gravity: TOSS.gravity }, t.v);
      e.thrown = true;
      return;
   }
   if (!t.active) return;
   t.t += dt;
   if (t.t < TOSS.flight) return;
   t.active = false;
   const slot = run.bundles[0].shown ? 1 : 0;
   run.bundles[slot].shown = true; run.bundles[slot].x = t.to.x; run.bundles[slot].z = t.to.z;
   e.landed = true;
   e.lured = lure(run, t.to.x, t.to.z);
}

// ---------- detection and catches ----------

/** Does a keeper at `a` hear the panda? It must be moving (> 0.2 m/s), within 3.0 m walking or 1.2 m sneaking (in a bush too). */
export function hears(a: { x: number; z: number }, pd: { x: number; z: number; speed: number; sneaking: boolean }): boolean {
   return pd.speed > PANDA.moving && Math.hypot(a.x - pd.x, a.z - pd.z) <= (pd.sneaking ? HEARING.sneak : HEARING.walk);
}

const JEEP_BOX: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };

function detect(run: RunState, dt: number): void {
   const pd = run.panda, e = run.events, map = run.map;
   const active = run.grace <= 0;
   const hiddenBox = pd.hidden >= 0 ? map.bushes[pd.hidden].box : null;
   if (active) {
      for (let j = 0; j < map.jeeps.length && !e.caught; j++) {
         if (map.jeeps[j].stage !== run.stage) continue;
         if (distanceToBoxXZ(pd.x, pd.z, jeepBox(map.jeeps[j], run.jeeps[j], JEEP_BOX)) <= PANDA.radius) { e.caught = "jeep"; e.catcher = -3; }
      }
      for (let b = 0; b < map.birds.length; b++) {
         const bird = map.birds[b], st = run.birds[b];
         if (bird.stage !== run.stage || st.cool > 0) continue;
         if (pd.speed > PANDA.moving && !pd.sneaking && Math.hypot(bird.x - pd.x, bird.z - pd.z) <= BIRDS.range) {
            st.cool = BIRDS.cooldown; st.since = 0;
            e.squawk = b;
            const k = callKeeper(run, bird.x, bird.z, BIRDS.alertRange, "heard");
            if (k >= 0) e.heard = k;
         }
      }
   }
   for (const i of map.stageKeepers[run.stage]) {
      const k = run.keepers[i];
      const a = k.agent;
      if (active && !e.caught) {
         if (circlesOverlapXZ(a, KEEPER.radius, pd, PANDA.radius)) { e.caught = "bump"; e.catcher = i; }
         else if (hiddenBox && distanceToBoxXZ(a.x, a.z, hiddenBox) <= KEEPER.radius) { e.caught = "found"; e.catcher = i; }
      }
      const sees = active && pd.hidden < 0 && keeperSees(a, a.yaw, run.stage, pd, map);
      const was = k.meter;
      if (sees) {
         k.meter = Math.min(1, k.meter + dt / run.level.catchS);
         k.lastSeen.x = pd.x; k.lastSeen.z = pd.z;
         if (k.meter >= 1 && !e.caught) { e.caught = "seen"; e.catcher = i; }
      } else {
         k.meter = Math.max(0, k.meter - run.level.decay * dt);
         if (k.seeing && k.meter > 0 && k.meter < 1) sendKeeper(k, k.lastSeen, "seen");
      }
      if (was === 0 && k.meter > 0) e.alerts++;
      k.seeing = sees;
      if (active && k.hearCooldown <= 0 && hears(a, pd)) {
         k.hearCooldown = HEARING.cooldown;
         if (sendKeeper(k, pd, "heard")) e.heard = i;
      }
   }
   const light = map.lights[run.stage];
   if (light) {
      const l = run.light;
      const sees = active && pd.hidden < 0 && searchlightSees(l.yaw, pd, light, map);
      if (sees) {
         l.meter = Math.min(1, l.meter + dt / run.level.catchS);
         l.lastSeen.x = pd.x; l.lastSeen.z = pd.z;
         if (l.meter >= 1 && !e.caught) { e.caught = "light"; e.catcher = -1; }
      } else {
         if (l.seeing && l.meter > 0 && l.meter < 1) {
            let best = -1, bestD = Infinity;
            for (const i of map.stageKeepers[run.stage]) {
               const a = run.keepers[i].agent;
               const d = Math.hypot(a.x - l.lastSeen.x, a.z - l.lastSeen.z);
               if (d <= light.radioRange && d < bestD) { best = i; bestD = d; }
            }
            if (best >= 0) sendKeeper(run.keepers[best], l.lastSeen, "radio");
         }
         l.meter = Math.max(0, l.meter - run.level.decay * dt);
      }
      l.seeing = sees;
   }
}

function resetStage(run: RunState): void {
   const s = run.stage;
   const map = run.map;
   const start = map.stages[s].start;
   const pd = run.panda;
   pd.x = start.x; pd.z = start.z; pd.vx = 0; pd.vz = 0; pd.speed = 0; pd.facing = Math.PI;
   pd.hidden = bushAt(pd.x, pd.z, map);
   for (const i of map.stageKeepers[s]) {
      const k = run.keepers[i];
      placeOnSchedule(k.agent, k.patrol, i, run.time + k.offset, map);
      k.meter = 0; k.seeing = false; k.kind = null; k.hearCooldown = 0;
   }
   run.light.meter = 0; run.light.seeing = false;
   run.bundlesLeft = run.level.bundles;
   run.toss.active = false;
   for (const b of run.bundles) b.shown = false;
}

function caught(run: RunState): void {
   const e = run.events;
   run.catches++;
   run.lastCatch = e.caught;
   run.lastCatcher = e.catcher;
   run.timeLeft -= run.level.penalty;
   if (run.catches >= CATCH.max) { run.over = "lose"; e.end = "lose"; return; }
   if (run.timeLeft <= 0) { run.timeLeft = 0; run.over = "timeup"; e.end = "timeup"; return; }
   resetStage(run);
   run.card = CATCH.cardS;
   run.grace = 0;
}

/** One simulation step (dt s, > 0). Order: clock, keepers, card / movement, gates, snacks, toss, detection, catch. */
export function stepRun(run: RunState, input: StepInput, dt: number): void {
   const e = run.events;
   clearEvents(e);
   if (run.over) return;
   run.time += dt;
   run.timeLeft -= dt;
   if (run.timeLeft <= 0) { run.timeLeft = 0; run.over = "timeup"; e.end = "timeup"; return; }
   for (const k of run.keepers) stepKeeper(k, dt);
   const map = run.map;
   const ls = lightStageFor(map, run.stage);
   if (ls >= 0) {
      run.light.phase = run.phases[ls];
      run.light.yaw = searchlightYaw(run.time, run.light.phase, map.lights[ls]!);
   }
   for (let j = 0; j < map.jeeps.length; j++) jeepPose(map.jeeps[j], map.cycles[map.jeeps[j].stage], run.time + run.phases[map.jeeps[j].stage], run.jeeps[j]);
   for (const b of run.birds) { if (b.cool > 0) b.cool = Math.max(0, b.cool - dt); b.since += dt; }

   if (run.card > 0) {
      run.card -= dt;
      if (run.card <= 0) { run.card = 0; run.grace = CATCH.graceS; e.cardEnd = true; }
      return;
   }
   if (run.grace > 0) run.grace = Math.max(0, run.grace - dt);

   const pd = run.panda;
   movePanda(run, input, dt);
   const hidden = bushAt(pd.x, pd.z, map);
   if (hidden >= 0 && hidden !== pd.hidden) e.rustle = true;
   pd.hidden = hidden;

   const stages = map.stages;
   if (pd.z <= stages[2].gate.z) { run.over = "win"; e.end = "win"; return; }
   const stage = stageOf(map, pd.z);
   if (stage !== run.stage) {
      run.stage = stage;
      run.toss.active = false;
      for (const b of run.bundles) b.shown = false;
   }
   if (stage > run.reached) {
      run.reached = stage;
      run.bundlesLeft = run.level.bundles;
      e.stage = stage;
   }
   for (let g = 0; g < stages.length; g++) {
      if (!run.bars[g] && pd.z <= stages[g].gate.z - BAR_DROP) { run.bars[g] = true; e.bar = g; }
   }

   for (let i = 0; i < run.snacks.length; i++) {
      const s = run.snacks[i];
      if (s.eaten || s.stage !== run.stage) continue;
      if (Math.hypot(s.x - pd.x, s.z - pd.z) <= SNACK.reach) { s.eaten = true; run.eaten++; e.snack = i; }
   }

   stepToss(run, input.toss, dt);
   detect(run, dt);
   if (e.caught) caught(run);
}

// ---------- the store bridge (the Scene and the bots call the same code) ----------

export interface StoreLike {
   setScore(value: number): void;
   setStat(key: string, value: number): void;
   setLevel(level: number): void;
   end(reason: EndKind): void;
}

/** Store stats: the HUD chips (index.tsx hudStats) and the caught card's reason (0 = no card). */
export const STATS = { time: "time", snacks: "snacks", catches: "catches", bamboo: "bamboo", card: "card" } as const;
/** The caught card's reason as a store stat (1-based), for the DOM Hud. */
export const CARD_CODES: Record<CatchReason, number> = { seen: 1, light: 2, found: 3, bump: 4, jeep: 5 };

/**
 * This step's events into the store: the live score on every snack and catch, the HUD stats when
 * they change, the stage as the level, the caught card, and on the end the final score right before
 * end() (win: the formula with the time bonus; lose / time-up: the live score).
 */
export function applyToStore(run: RunState, store: StoreLike, shown: { time: number; bamboo: number }): void {
   const e = run.events;
   if (e.snack >= 0 || e.caught) store.setScore(liveScore(run));
   if (e.snack >= 0) store.setStat(STATS.snacks, run.eaten);
   if (e.caught) {
      store.setStat(STATS.catches, run.catches);
      if (!e.end) store.setStat(STATS.card, CARD_CODES[e.caught]);
   }
   if (e.cardEnd) store.setStat(STATS.card, 0);
   if (e.stage >= 0) store.setLevel(e.stage + 1);
   const time = Math.ceil(run.timeLeft);
   if (time !== shown.time) { shown.time = time; store.setStat(STATS.time, time); }
   if (run.bundlesLeft !== shown.bamboo) { shown.bamboo = run.bundlesLeft; store.setStat(STATS.bamboo, run.bundlesLeft); }
   if (e.end) {
      store.setScore(e.end === "win" ? finalScore(run) : liveScore(run));
      store.end(e.end);
   }
}
