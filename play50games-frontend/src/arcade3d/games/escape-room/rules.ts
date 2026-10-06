// Tiny Escape Room: pure seeded rules. Scene supplies the run seed and world-mapped input.
// dtMs is useRunFrame's counted dt * 1000. All gameplay uses whole ms with the fraction carried.
// Every pool, collision box, action and event record is allocated in createRun, never in step.
import { clampToBounds, distanceToBoxXZ, resolveSphereAabb, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import { rngNext } from "@/arcade3d/core/math";

// ---------- approved tuning and proof ----------

export const DURATION_MS = 600000;
export const MAX_STEP_MS = 50;
export const ARENA = { halfX: 6, halfZ: 5 } as const;
export const RUNNER = { radius: 0.35, speed: 1.8, accel: 6, brake: 8 } as const;
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
export const MIN_ROUTE = 13.5;
export const MIN_FINISH_MS = Math.ceil(MIN_ROUTE / RUNNER.speed * 1000) + 3 * (OPEN_MS + RETRIEVE_MS) + UNLOCK_MS + DOOR_OPEN_MS;
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
   if (!Number.isInteger(id) || id < 0 || id > DOOR_ID || !Number.isFinite(x) || !Number.isFinite(z)) return false;
   const p = id === DOOR_ID ? DOOR_POSITION : layout.stations[id];
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
   layout: Layout;
   simMs: number;
   remainder: number;
   stepMs: number;
   lockedMs: number;
   player: Vec3Like & { vx: number; vz: number };
   stations: { phase: StationPhase; progressMs: number }[];
   items: { id: number; station: number; visible: boolean; found: boolean }[];
   action: { kind: "none" | "open" | "retrieve" | "door"; target: number; remainingMs: number; progressMs: number };
   door: { phase: "locked" | "unlocking" | "opening" | "open"; progressMs: number };
   found: number;
   foundMask: number;
   message: "none" | "locked" | "empty";
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
}

/** Optional layout injection is for the fallback/adversarial tests; caller data is never retained. */
export function createRun(seed: number, options: { layout?: Layout } = {}): EscapeRun {
   const source = options.layout ?? generateLayout(seed);
   const layout = allocateLayout(seed);
   if (isValidLayout(source)) {
      layout.fallback = source.fallback;
      for (let i = 0; i < 4; i++) {
         layout.stations[i].x = source.stations[i].x;
         layout.stations[i].z = source.stations[i].z;
         layout.stations[i].item = source.stations[i].item;
         positionBox(layout.stations[i]);
      }
   } else fillFallback(layout);
   if (!isValidLayout(layout)) throw new Error("Invalid escape-room fallback");
   const items = ITEM_NAMES.map((_name, id) => ({ id, station: layout.stations.findIndex((s) => s.item === id), visible: false, found: false }));
   return {
      seed: seed >>> 0, layout, simMs: 0, remainder: 0, stepMs: 0, lockedMs: 0,
      player: { x: START.x, y: 0, z: START.z, vx: 0, vz: 0 },
      stations: STATION_ANCHORS.map(() => ({ phase: "closed", progressMs: 0 })), items,
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
   for (let id = 0; id <= DOOR_ID; id++) {
      if (id !== DOOR_ID) {
         const phase = run.stations[id].phase;
         if (phase !== "closed" && !(phase === "open" && run.layout.stations[id].item !== NONE)) continue;
      } else if (run.door.phase === "open") continue;
      if (!inReach(run.layout, id, run.player.x, run.player.z)) continue;
      const p = id === DOOR_ID ? DOOR_POSITION : run.layout.stations[id];
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
   if (id === DOOR_ID) {
      if (run.door.phase === "open") return;
      run.events.inspected = id;
      if (run.foundMask !== ALL_ITEMS) { run.message = "locked"; return; }
      run.action.kind = "door";
      run.door.phase = "unlocking";
      duration = UNLOCK_MS + DOOR_OPEN_MS;
   } else {
      const s = run.stations[id];
      if (s.phase === "closed") {
         run.action.kind = "open";
         s.phase = "opening";
         duration = OPEN_MS;
      } else if (s.phase === "open" && run.layout.stations[id].item !== NONE) {
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
         if (action.kind === "open") {
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

/** One ms of circle/AABB movement, with the README's net speed guard and blocked-position rollback. */
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
   let corrected = false;
   for (let i = 0; i < run.layout.obstacles.length; i++) {
      const b = run.layout.obstacles[i];
      const gap = distanceToBoxXZ(p.x, p.z, b);
      if (gap >= RUNNER.radius) continue;
      corrected = true;
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
      corrected = true;
   }
   if (corrected && !isWalkable(run.layout, p.x, p.z)) { p.x = fromX; p.z = fromZ; }
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
   if (run.simMs + whole >= DURATION_MS) {
      run.stepMs = DURATION_MS - run.simMs;
      run.simMs = DURATION_MS;
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
