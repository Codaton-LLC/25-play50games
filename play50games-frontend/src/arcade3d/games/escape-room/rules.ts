// Tiny Escape Room: pure seeded rules. Scene supplies the run seed and world-mapped input.
// dtMs is useRunFrame's counted dt * 1000. All gameplay uses whole ms with the fraction carried.
// Every pool, collision box, action and event record is allocated in createRun, never in step.
import { clampToBounds, distanceToBoxXZ, resolveSphereAabb, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import { rngNext } from "@/arcade3d/core/math";

// ---------- approved tuning and proof ----------

export const DURATION_MS = 600000;
export const MAX_STEP_MS = 50;
export const ARENA = { halfX: 6, halfZ: 5 } as const;
export const RUNNER = { radius: 0.35, speed: 2.6, accel: 8.5, brake: 11 } as const;
export const START = { x: 0, z: 4 } as const;
export const INSPECT_REACH = 1;
export const OPEN_MS = 1100;
export const RETRIEVE_MS = 900;
export const UNLOCK_MS = 600;
export const DOOR_OPEN_MS = 1200;
export const NONE = -1;
export const DOOR_ID = 4;
export const ITEM_NAMES = ["Key", "Book", "Battery"] as const;
export const ALL_ITEMS = (1 << ITEM_NAMES.length) - 1;
export const STATION_ANCHORS = [{ x: -4, z: -3 }, { x: 4, z: -3 }, { x: -4, z: 3 }, { x: 4, z: 3 }] as const;
export const STATION_KINDS = ["drawer", "cupboard", "under-desk", "cupboard"] as const;
export const STATION_BODY = { offset: 1, halfX: 0.6, halfZ: 0.7, height: 1.4 } as const;
export const DOOR_POSITION = { x: 0, z: -4.2 } as const;
/**
 * README proof: the shortest route over every layout and visit order (start, the three item stations'
 * reach circles, the door's), 15.48396 m, rounded down. With the speed cap and the 7800 ms of actions
 * a win needs at least 13754 ms (acceleration and obstacles only add time); meta.scoring's
 * minDurationMs (13654) is 100 ms below it.
 */
export const MIN_ROUTE = 15.48;
export const MIN_FINISH_MS = Math.ceil(MIN_ROUTE / RUNNER.speed * 1000) + 3 * (OPEN_MS + RETRIEVE_MS) + UNLOCK_MS + DOOR_OPEN_MS;
/** Only variable level data; kept here so the frozen pure-import contract stays intact. */
export interface EscapeLevel {
   id: 1 | 2 | 3 | 4 | 5;
   items: number;
   containers: number;
   durationMs: number;
   ordered: boolean;
   shuffledOrder: boolean;
   returnSwitch: boolean;
}
export const DEFAULT_LEVEL: EscapeLevel = {
   id: 1, items: 3, containers: 4, durationMs: DURATION_MS,
   ordered: false, shuffledOrder: false, returnSwitch: false,
};
/** L1 keeps its exhaustive tour proof. L2-5 use serial actions + start/exit displacement.
 * Bounds ignore furniture, acceleration and clue travel, so all can only add time.
 */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 58634, minDurationMs: 13654, maxDurationMs: 600000, timeBaseMs: 600000, base: 0, maxPointsPerSec: 0, unitLabel: "time", display: "time" },
   2: { kind: "time", maxScore: 60775, minDurationMs: 12250, maxDurationMs: 210000, timeBaseMs: 620000, base: 0, maxPointsPerSec: 0, unitLabel: "time", display: "time" },
   3: { kind: "time", maxScore: 62585, minDurationMs: 14150, maxDurationMs: 240000, timeBaseMs: 640000, base: 0, maxPointsPerSec: 0, unitLabel: "time", display: "time" },
   4: { kind: "time", maxScore: 64480, minDurationMs: 15200, maxDurationMs: 240000, timeBaseMs: 660000, base: 0, maxPointsPerSec: 0, unitLabel: "time", display: "time" },
   5: { kind: "time", maxScore: 67180, minDurationMs: 18200, maxDurationMs: 300000, timeBaseMs: 690000, base: 0, maxPointsPerSec: 0, unitLabel: "time", display: "time" },
} as const;

/** More searchable branches in the same room; all centre-facing anchors stay clear. */
function levelLayout(seed: number, level: EscapeLevel): Layout {
   const layout = allocateLayout(seed);
   layout.stations.length = 0;
   layout.obstacles.length = 0;
   const rng = { s: seed >>> 0 };
   for (let id = 0; id < level.containers; id++) {
      const s: LayoutStation = {
         id, kind: id === 0 ? "drawer" : id === 2 ? "under-desk" : "cupboard",
         x: (id % 2 ? 1 : -1) * (3.5 + (level.shuffledOrder ? Math.floor(rngNext(rng) * 3) * 0.1 : 0)),
         z: [-3, -1, 1, 3][Math.floor(id / 2)],
         item: id < level.items ? id : NONE, bounds: groundBox(0, 0, 0, 0),
      };
      positionBox(s);
      layout.stations.push(s);
      layout.obstacles.push(s.bounds);
   }
   for (let i = layout.stations.length - 1; i > 0; i--) {
      const j = Math.floor(rngNext(rng) * (i + 1));
      const item = layout.stations[i].item;
      layout.stations[i].item = layout.stations[j].item;
      layout.stations[j].item = item;
   }
   // The blocked central route: the existing chair assets mark this collision strip.
   layout.obstacles.push(groundBox(-1.2, 1.2, -0.4, 0.4));
   return layout;
}

const EDGE_EPS = 1e-9;

// Tall ground boxes make the core sphere push horizontal, as in the reference games.
function groundBox(minX: number, maxX: number, minZ: number, maxZ: number): AABB {
   return { min: { x: minX, y: -10, z: minZ }, max: { x: maxX, y: 10, z: maxZ } };
}

export const BOUNDS = groundBox(-ARENA.halfX, ARENA.halfX, -ARENA.halfZ, ARENA.halfZ);

export interface LayoutStation {
   id: number;
   kind: typeof STATION_KINDS[number];
   x: number;
   z: number;
   /** 0 Key, 1 Book, 2 Battery, NONE empty. */
   item: number;
   bounds: AABB;
}

export interface Layout {
   seed: number;
   fallback: boolean;
   stations: LayoutStation[];
   /** Four station boxes, then the chairs at (±5,0); box identities never change. */
   obstacles: AABB[];
}

function positionBox(station: LayoutStation): void {
   const cx = station.x + Math.sign(station.x) * STATION_BODY.offset;
   const box = station.bounds;
   box.min.x = cx - STATION_BODY.halfX;
   box.max.x = cx + STATION_BODY.halfX;
   box.min.z = station.z - STATION_BODY.halfZ;
   box.max.z = station.z + STATION_BODY.halfZ;
}

function allocateLayout(seed: number): Layout {
   const stations: LayoutStation[] = [];
   const obstacles: AABB[] = [];
   for (let i = 0; i < 4; i++) {
      const s: LayoutStation = {
         id: i, kind: STATION_KINDS[i], x: STATION_ANCHORS[i].x, z: STATION_ANCHORS[i].z,
         item: i < 3 ? i : NONE, bounds: groundBox(0, 0, 0, 0),
      };
      positionBox(s);
      stations.push(s);
      obstacles.push(s.bounds);
   }
   obstacles.push(groundBox(-5.4, -4.6, -0.4, 0.4), groundBox(4.6, 5.4, -0.4, 0.4));
   return { seed: seed >>> 0, fallback: false, stations, obstacles };
}

/** Fills the existing records; never retries random generation until lucky. */
function fillFallback(layout: Layout): void {
   layout.fallback = true;
   for (let i = 0; i < 4; i++) {
      const s = layout.stations[i];
      s.x = STATION_ANCHORS[i].x;
      s.z = STATION_ANCHORS[i].z;
      s.item = i < 3 ? i : NONE;
      positionBox(s);
   }
}

export function fallbackLayout(seed: number): Layout {
   const layout = allocateLayout(seed);
   fillFallback(layout);
   return layout;
}

/** Eight equal-weight integer jitter draws, then Fisher-Yates, from the shared mulberry32. */
export function generateLayout(seed: number): Layout {
   const layout = allocateLayout(seed);
   const rng = { s: seed >>> 0 };
   for (let i = 0; i < 4; i++) {
      const s = layout.stations[i];
      s.x += (Math.floor(rngNext(rng) * 3) - 1) * 0.25;
      s.z += (Math.floor(rngNext(rng) * 3) - 1) * 0.25;
      positionBox(s);
   }
   for (let i = 3; i > 0; i--) {
      const j = Math.floor(rngNext(rng) * (i + 1));
      const item = layout.stations[i].item;
      layout.stations[i].item = layout.stations[j].item;
      layout.stations[j].item = item;
   }
   if (!isValidLayout(layout)) fillFallback(layout);
   return layout;
}

/** The complete construction contract implies the clear centre/axis routes in the README. */
export function isValidLayout(layout: Layout): boolean {
   if (layout.stations.length !== 4 || layout.obstacles.length !== 6) return false;
   let items = 0;
   for (let i = 0; i < 4; i++) {
      const s = layout.stations[i], base = STATION_ANCHORS[i], b = s.bounds;
      if (s.id !== i || s.kind !== STATION_KINDS[i] || !Number.isFinite(s.x) || !Number.isFinite(s.z)) return false;
      const dx = s.x - base.x, dz = s.z - base.z;
      if ((dx !== -0.25 && dx !== 0 && dx !== 0.25) || (dz !== -0.25 && dz !== 0 && dz !== 0.25)) return false;
      if (!Number.isInteger(s.item) || s.item < NONE || s.item >= 3) return false;
      const bit = 1 << (s.item + 1);
      if (items & bit) return false;
      items |= bit;
      const cx = s.x + Math.sign(s.x);
      if (layout.obstacles[i] !== b || b.min.y !== -10 || b.max.y !== 10
         || b.min.x !== cx - 0.6 || b.max.x !== cx + 0.6 || b.min.z !== s.z - 0.7 || b.max.z !== s.z + 0.7) return false;
      // Defensive only: with the current constants the exact jitter/box checks above already imply
      // a clear anchor, >= 3.75 m to the door and >= 5.5 m between anchors, so these branches (and
      // the start/door walkability checks below) cannot fire and no test can cover them. They stay
      // as the README's start/door/anchor contract, a guard against future constant changes.
      if (!isWalkable(layout, s.x, s.z) || Math.hypot(s.x, s.z + 4.2) <= 2 * INSPECT_REACH) return false;
      for (let j = 0; j < i; j++) if (Math.hypot(s.x - layout.stations[j].x, s.z - layout.stations[j].z) <= 2 * INSPECT_REACH) return false;
   }
   for (let i = 4; i < 6; i++) {
      const cx = i === 4 ? -5 : 5, b = layout.obstacles[i];
      if (b.min.x !== cx - 0.4 || b.max.x !== cx + 0.4 || b.min.z !== -0.4 || b.max.z !== 0.4 || b.min.y !== -10 || b.max.y !== 10) return false;
   }
   return items === 15 && isWalkable(layout, START.x, START.z) && isWalkable(layout, DOOR_POSITION.x, DOOR_POSITION.z);
}

export function isWalkable(layout: Layout, x: number, z: number): boolean {
   if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > ARENA.halfX - RUNNER.radius + EDGE_EPS
      || Math.abs(z) > ARENA.halfZ - RUNNER.radius + EDGE_EPS) return false;
   for (let i = 0; i < layout.obstacles.length; i++) {
      if (distanceToBoxXZ(x, z, layout.obstacles[i]) < RUNNER.radius - EDGE_EPS) return false;
   }
   return true;
}

/** Reach is the anchor's circle, independent of furniture/model size or visual badge projection. */
export function inReach(layout: Layout, id: number, x: number, z: number): boolean {
   if (!Number.isInteger(id) || id < 0 || id > layout.stations.length || !Number.isFinite(x) || !Number.isFinite(z)) return false;
   const p = id === layout.stations.length ? DOOR_POSITION : layout.stations[id];
   const dx = x - p.x, dz = z - p.z;
   return dx * dx + dz * dz <= INSPECT_REACH * INSPECT_REACH + EDGE_EPS;
}

export interface StepInput {
   /** World x / world z, already mapped in Scene. Analog length >1 is normalized. */
   moveX: number;
   moveY: number;
   /** E/Enter edge, not a held key. No swipe/pressed branch for continuous movement. */
   actionPressed: boolean;
   /** Scene's projected tap: station 0..3 or door 4. Explicit invalid taps never fall back to a key. */
   tappedTarget?: number | null;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveY: 0, actionPressed: false, tappedTarget: null };
}

export type StationPhase = "closed" | "opening" | "open" | "retrieving" | "collected";
export interface StepEvents {
   inspected: number;
   opened: number;
   /** Item ID, NONE without a first retrieval. Scene reports the new run.found count. */
   found: number;
   doorOpened: boolean;
   ended: "win" | "timeup" | null;
}

export interface EscapeRun {
   seed: number;
   level: EscapeLevel;
   order: number[];
   exitReady: boolean;
   layout: Layout;
   simMs: number;
   remainder: number;
   stepMs: number;
   lockedMs: number;
   player: Vec3Like & { vx: number; vz: number };
   stations: { phase: StationPhase; progressMs: number }[];
   items: { id: number; station: number; visible: boolean; found: boolean }[];
   action: { kind: "none" | "open" | "retrieve" | "door" | "reset"; target: number; remainingMs: number; progressMs: number };
   door: { phase: "locked" | "unlocking" | "opening" | "open"; progressMs: number };
   found: number;
   foundMask: number;
   message: "none" | "locked" | "empty";
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
}

/** Optional layout injection is for the fallback/adversarial tests; caller data is never retained. */
export function createRun(seed: number, options: { layout?: Layout } | EscapeLevel = {}): EscapeRun {
   const level = "id" in options ? options : DEFAULT_LEVEL;
   const custom = level.id !== 1;
   const source = ("layout" in options ? options.layout : undefined) ?? generateLayout(seed);
   const layout = custom ? levelLayout(seed, level) : allocateLayout(seed);
   if (!custom && isValidLayout(source)) {
      layout.fallback = source.fallback;
      for (let i = 0; i < 4; i++) {
         layout.stations[i].x = source.stations[i].x;
         layout.stations[i].z = source.stations[i].z;
         layout.stations[i].item = source.stations[i].item;
         positionBox(layout.stations[i]);
      }
   } else if (!custom) fillFallback(layout);
   if (!custom && !isValidLayout(layout)) throw new Error("Invalid escape-room fallback");
   const items = Array.from({ length: level.items }, (_name, id) => ({ id, station: layout.stations.findIndex((s) => s.item === id), visible: false, found: false }));
   const order = items.map((item) => item.id);
   if (level.shuffledOrder) {
      const rng = { s: (seed ^ 0x9e3779b9) >>> 0 };
      for (let i = order.length - 1; i > 0; i--) {
         const j = Math.floor(rngNext(rng) * (i + 1));
         const item = order[i]; order[i] = order[j]; order[j] = item;
      }
   }
   return {
      seed: seed >>> 0, level, order, exitReady: !level.returnSwitch, layout, simMs: 0, remainder: 0, stepMs: 0, lockedMs: 0,
      player: { x: START.x, y: 0, z: START.z, vx: 0, vz: 0 },
      stations: layout.stations.map(() => ({ phase: "closed", progressMs: 0 })), items,
      action: { kind: "none", target: NONE, remainingMs: 0, progressMs: 0 },
      door: { phase: "locked", progressMs: 0 }, found: 0, foundMask: 0, message: "none",
      finishMs: NONE, ended: null,
      events: { inspected: NONE, opened: NONE, found: NONE, doorOpened: false, ended: null },
   };
}

/** Eligible highlighted object; distance ties use ID. Valid layouts have disjoint reach circles. */
export function targetInReach(run: EscapeRun): number {
   if (run.ended || run.action.kind !== "none") return NONE;
   let target = NONE, distance = Infinity;
   for (let id = 0; id <= run.layout.stations.length; id++) {
      if (id !== run.layout.stations.length) {
         const phase = run.stations[id].phase;
         if (phase !== "closed" && !(phase === "open" && run.layout.stations[id].item !== NONE)
            && !(id === 0 && run.found === run.level.items && !run.exitReady)) continue;
      } else if (run.door.phase === "open") continue;
      if (!inReach(run.layout, id, run.player.x, run.player.z)) continue;
      const p = id === run.layout.stations.length ? DOOR_POSITION : run.layout.stations[id];
      const d = (run.player.x - p.x) ** 2 + (run.player.z - p.z) ** 2;
      if (d < distance) { distance = d; target = id; }
   }
   return target;
}

function resetEvents(ev: StepEvents): void {
   ev.inspected = NONE;
   ev.opened = NONE;
   ev.found = NONE;
   ev.doorOpened = false;
   ev.ended = null;
}

/** Once at frame start, before movement; presses during an existing action are discarded. */
function beginInspect(run: EscapeRun, input: StepInput): void {
   if (run.action.kind !== "none") return;
   const id = input.tappedTarget !== undefined && input.tappedTarget !== null
      ? input.tappedTarget : input.actionPressed ? targetInReach(run) : NONE;
   if (!inReach(run.layout, id, run.player.x, run.player.z)) return;
   let duration: number;
   if (id === run.layout.stations.length) {
      if (run.door.phase === "open") return;
      run.events.inspected = id;
      if (run.found !== run.level.items || !run.exitReady) { run.message = "locked"; return; }
      if (run.level.id !== 1) {
         for (let i = 0; i < run.stations.length; i++) {
            if (run.stations[i].phase === "closed") { run.message = "locked"; return; }
         }
      }
      run.action.kind = "door";
      run.door.phase = "unlocking";
      duration = UNLOCK_MS + DOOR_OPEN_MS;
   } else {
      const s = run.stations[id];
      if (id === 0 && run.found === run.level.items && !run.exitReady) {
         run.action.kind = "reset";
         duration = OPEN_MS;
      } else if (s.phase === "closed") {
         run.action.kind = "open";
         s.phase = "opening";
         duration = OPEN_MS;
      } else if (s.phase === "open" && run.layout.stations[id].item !== NONE) {
         if (run.level.ordered && run.layout.stations[id].item !== run.order[run.found]) {
            run.message = "locked"; return;
         }
         run.action.kind = "retrieve";
         s.phase = "retrieving";
         duration = RETRIEVE_MS;
      } else return;
      s.progressMs = 0;
      run.events.inspected = id;
   }
   run.message = "none";
   run.action.target = id;
   run.action.remainingMs = duration;
   run.action.progressMs = 0;
   run.player.vx = 0;
   run.player.vz = 0;
}

function tickAction(run: EscapeRun): void {
   const action = run.action;
   if (action.kind === "none") return;
   action.remainingMs--;
   action.progressMs++;
   const id = action.target;
   if (action.kind === "door") {
      run.door.progressMs = action.progressMs;
      if (action.progressMs >= UNLOCK_MS) run.door.phase = "opening";
      if (action.remainingMs === 0) {
         run.door.phase = "open";
         run.finishMs = run.simMs;
         run.ended = "win";
         run.events.doorOpened = true;
         run.events.ended = "win";
      }
   } else {
      const s = run.stations[id], item = run.layout.stations[id].item;
      s.progressMs = action.progressMs;
      if (action.remainingMs === 0) {
         if (action.kind === "reset") {
            run.exitReady = true;
            run.events.opened = id;
         } else if (action.kind === "open") {
            s.phase = "open";
            run.events.opened = id;
            if (item === NONE) run.message = "empty";
            else run.items[item].visible = true;
         } else {
            s.phase = "collected";
            run.items[item].visible = false;
            if (!(run.foundMask & (1 << item))) {
               run.foundMask |= 1 << item;
               run.found++;
               run.items[item].found = true;
               run.events.found = item;
            }
         }
      }
   }
   if (action.remainingMs === 0) { action.kind = "none"; action.target = NONE; }
}

/**
 * One ms of circle/AABB movement, with the README's net speed guard and blocked-position rollback.
 * The rollback check runs on every moved ms: the wall clamp alone can pull the runner back into a
 * chair's radius at the chair/side-wall corner, so "nothing was pushed" does not mean "clear".
 */
function movePlayer(run: EscapeRun, mx: number, mz: number): void {
   const p = run.player;
   if (mx === 0 && mz === 0 && p.vx === 0 && p.vz === 0) return;
   const fromX = p.x, fromZ = p.z;
   let dvx = mx * RUNNER.speed - p.vx, dvz = mz * RUNNER.speed - p.vz;
   const dv = Math.hypot(dvx, dvz);
   const maxDv = (Math.hypot(mx, mz) > 0.01 ? RUNNER.accel : RUNNER.brake) / 1000;
   if (dv > maxDv) { dvx *= maxDv / dv; dvz *= maxDv / dv; }
   p.vx += dvx;
   p.vz += dvz;
   p.x += p.vx / 1000;
   p.z += p.vz / 1000;
   p.y = 0;
   for (let i = 0; i < run.layout.obstacles.length; i++) {
      const b = run.layout.obstacles[i];
      const gap = distanceToBoxXZ(p.x, p.z, b);
      if (gap >= RUNNER.radius) continue;
      // An invalid caller position must not use the core's allocating inside-box recovery path.
      if (gap <= 1e-6) { p.x = fromX; p.z = fromZ; p.vx = 0; p.vz = 0; return; }
      resolveSphereAabb(p, RUNNER.radius, b, p);
   }
   clampToBounds(p, BOUNDS, RUNNER.radius, p);
   const dx = p.x - fromX, dz = p.z - fromZ, moved = Math.hypot(dx, dz);
   const maxMove = RUNNER.speed / 1000;
   if (moved > maxMove) {
      p.x = fromX + dx * maxMove / moved;
      p.z = fromZ + dz * maxMove / moved;
   }
   if (!isWalkable(run.layout, p.x, p.z)) { p.x = fromX; p.z = fromZ; }
   p.vx = (p.x - fromX) * 1000;
   p.vz = (p.z - fromZ) * 1000;
}

/**
 * dtMs, not seconds. A non-finite/nonpositive dt does nothing; long frames clamp like core.
 * Input is consumed once before movement, even for a positive sub-ms frame. Busy edges are dropped.
 * The frame reaching the shell cap is time-up before any action, just like advanceRunClock.
 * An action locks this entire frame, including leftover ms after completion. Returns reused events.
 */
export function step(run: EscapeRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   run.stepMs = 0;
   if (run.ended || !Number.isFinite(dtMs) || !(dtMs > 0)) return ev;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   if (run.simMs + whole >= run.level.durationMs) {
      run.stepMs = run.level.durationMs - run.simMs;
      run.simMs = run.level.durationMs;
      run.remainder = 0;
      run.ended = "timeup";
      ev.ended = "timeup";
      return ev;
   }
   beginInspect(run, input);
   const locked = run.action.kind !== "none";
   let mx = Number.isFinite(input.moveX) ? input.moveX : 0;
   let mz = Number.isFinite(input.moveY) ? input.moveY : 0;
   const len = Math.hypot(mx, mz);
   if (len > 1) { mx /= len; mz /= len; }
   for (let i = 0; i < whole; i++) {
      run.simMs++;
      run.stepMs++;
      if (locked) { run.lockedMs++; tickAction(run); }
      else movePlayer(run, mx, mz);
      if (run.ended) break;
   }
   return ev;
}
