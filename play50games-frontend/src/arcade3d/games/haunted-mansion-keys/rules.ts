// Haunted Mansion Keys rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. Same seed + level + inputs = same run.
//
// Grid cols x rows of 6 x 5 m rooms. Find coloured keys, open matching doors, pull lever for shortcuts,
// avoid patrolling armour on L4-L5, and escape through the exit door.
import { resolveSphereAabb, sphereAabbOverlap, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import { createPath, type Path } from "@/arcade3d/core/path";
import { stepPatrol, type PatrolState } from "@/arcade3d/core/ai/patrol";
import type { Agent } from "@/arcade3d/core/ai/steering";
import { createRng, inputToWorld } from "@/arcade3d/core/math";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, type MansionLevel } from "./levels";

// ---------- tuning ----------

export const ROOM_W = 6;
export const ROOM_D = 5;
export const WALL_T = 0.2;
export const WALL_H = 2.4;
export const DOOR_WIDTH = 1.4;
export const DOOR_HALF = DOOR_WIDTH / 2;

export const HERO_RADIUS = 0.36;
export const ARMOUR_RADIUS = 0.36;
export const HERO_SPEED = 4.4;
export const HERO_ACCEL = 22;
export const HERO_BRAKE = 28;

export const ACTION_RANGE = 1.2;
export const ACTION_WINDUP_S = 0.2;
export const MERCY_S = 0.8;

export const KEY_SHAPES = ["circle", "square", "triangle", "diamond", "star"] as const;
export type KeyShape = (typeof KEY_SHAPES)[number];

export const KEY_COLORS = [
   "#f59e0b", // circle: amber
   "#10b981", // square: emerald
   "#3b82f6", // triangle: sapphire
   "#ef4444", // diamond: ruby
   "#a855f7", // star: amethyst
] as const;

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: { kind: "time", maxScore: 17_800, minDurationMs: 2000, maxDurationMs: 180_000, base: 0, maxPointsPerSec: 0, timeBaseMs: 180_000, unitLabel: "time", display: "time" },
   2: { kind: "time", maxScore: 20_750, minDurationMs: 2500, maxDurationMs: 210_000, base: 0, maxPointsPerSec: 0, timeBaseMs: 210_000, unitLabel: "time", display: "time" },
   3: { kind: "time", maxScore: 23_600, minDurationMs: 4000, maxDurationMs: 240_000, base: 0, maxPointsPerSec: 0, timeBaseMs: 240_000, unitLabel: "time", display: "time" },
   4: { kind: "time", maxScore: 23_500, minDurationMs: 5000, maxDurationMs: 240_000, base: 0, maxPointsPerSec: 0, timeBaseMs: 240_000, unitLabel: "time", display: "time" },
   5: { kind: "time", maxScore: 29_500, minDurationMs: 5000, maxDurationMs: 300_000, base: 0, maxPointsPerSec: 0, timeBaseMs: 300_000, unitLabel: "time", display: "time" },
};

// ---------- state types ----------

export interface Room {
   col: number;
   row: number;
   index: number;
   wing: number;
   cx: number;
   cz: number;
   entranceX: number;
   entranceZ: number;
}

export type DoorKind = "open" | "locked" | "shortcut";

export interface Door {
   id: number;
   roomA: number;
   roomB: number;
   x: number;
   z: number;
   rotY: number; // 0 = wall along X, PI/2 = wall along Z
   kind: DoorKind;
   keyIndex: number; // -1 for open/shortcut
   shape: KeyShape | null;
   color: string | null;
   open: boolean;
   isExit: boolean;
   solid: AABB;
}

export interface KeyItem {
   id: number;
   shape: KeyShape;
   color: string;
   room: number;
   x: number;
   y: number;
   z: number;
   collected: boolean;
}

export interface Lever {
   room: number;
   x: number;
   y: number;
   z: number;
   rotY: number;
   pulled: boolean;
}

export interface ArmourAgent {
   agent: Agent;
   state: PatrolState;
   route: Path;
   speed: number;
}

export interface Hero {
   x: number;
   y: number;
   z: number;
   vx: number;
   vz: number;
   yaw: number;
   currentRoom: number;
   mercy: number;
}

export interface MansionInput {
   moveX: number;
   moveY: number;
   action: boolean;
   actionPressed?: boolean;
   yaw: number;
}

export interface StepEvents {
   keyPickup: number; // key id or -1
   doorOpen: number; // door id or -1
   leverPulled: boolean;
   hitArmour: boolean;
   lifeLost: boolean;
   won: boolean;
}

export interface Run {
   seed: number;
   level: MansionLevel;
   hero: Hero;
   rooms: Room[];
   doors: Door[];
   keys: KeyItem[];
   lever: Lever | null;
   armour: ArmourAgent | null;
   solids: AABB[];
   heldKeys: boolean[];
   keysCount: number;
   leverPulled: boolean;
   exitDoorOpen: boolean;
   windup: number;
   windupTargetKind: "key" | "door" | "lever" | null;
   windupTargetId: number;
   time: number;
   elapsedMs: number;
   score: number;
   lives: number | null;
   over: "win" | "lose" | "timeup" | null;
   ev: StepEvents;
}

export function idleInput(): MansionInput {
   return { moveX: 0, moveY: 0, action: false, actionPressed: false, yaw: 0 };
}

// ---------- generation ----------

export function roomIndexOf(cols: number, col: number, row: number): number {
   return row * cols + col;
}

export function roomOf(cols: number, rows: number, x: number, z: number): number {
   const col = Math.max(0, Math.min(cols - 1, Math.floor(x / ROOM_W)));
   const row = Math.max(0, Math.min(rows - 1, Math.floor(z / ROOM_D)));
   return row * cols + col;
}

export function createRun(seed: number, level: MansionLevel): Run {
   const rng = createRng(seed * 7919 + level.keys * 101);
   const cols = level.cols;
   const rows = level.rows;
   const totalRooms = cols * rows;
   const K = level.keys;

   // 1. Generate backbone path from (0,0) to (cols-1, rows-1)
   const pathRooms: number[] = [];
   let currCol = 0;
   let currRow = 0;
   pathRooms.push(roomIndexOf(cols, currCol, currRow));

   while (currCol < cols - 1 || currRow < rows - 1) {
      const canRight = currCol < cols - 1;
      const canDown = currRow < rows - 1;
      let goRight = false;
      if (canRight && canDown) {
         goRight = rng() < 0.5;
      } else if (canRight) {
         goRight = true;
      } else {
         goRight = false;
      }

      if (goRight) currCol++;
      else currRow++;
      pathRooms.push(roomIndexOf(cols, currCol, currRow));
   }

   // 2. Assign wings (0..K) to path rooms
   // pathRooms has length L = (cols - 1) + (rows - 1) + 1.
   // We have K + 1 wings: Wing 0 to Wing K.
   const roomWings = new Int32Array(totalRooms).fill(-1);
   const L = pathRooms.length;

   for (let i = 0; i < L; i++) {
      const rIdx = pathRooms[i];
      // Distribute evenly so index 0 is wing 0, index L-1 is wing K
      const w = Math.min(K, Math.floor((i / (L - 1)) * K));
      roomWings[rIdx] = w;
   }
   // Guarantee start is wing 0 and exit is wing K
   roomWings[pathRooms[0]] = 0;
   roomWings[pathRooms[L - 1]] = K;

   // Ensure each wing 0..K is present on the path
   // If any wing got skipped due to rounding, fix it:
   let currW = 0;
   for (let i = 0; i < L; i++) {
      const rIdx = pathRooms[i];
      if (roomWings[rIdx] < currW) roomWings[rIdx] = currW;
      else currW = roomWings[rIdx];
   }
   roomWings[pathRooms[L - 1]] = K;

   // 3. Assign wings to remaining rooms via BFS growth
   const queue: number[] = [...pathRooms];
   while (queue.length > 0) {
      const u = queue.shift()!;
      const uCol = u % cols;
      const uRow = Math.floor(u / cols);
      const uWing = roomWings[u];

      const neighbors: [number, number][] = [
         [uCol + 1, uRow],
         [uCol - 1, uRow],
         [uCol, uRow + 1],
         [uCol, uRow - 1],
      ];

      for (const [nc, nr] of neighbors) {
         if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
            const nIdx = roomIndexOf(cols, nc, nr);
            if (roomWings[nIdx] === -1) {
               roomWings[nIdx] = uWing;
               queue.push(nIdx);
            }
         }
      }
   }

   // 4. Construct Room structs
   const rooms: Room[] = [];
   for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
         const idx = roomIndexOf(cols, c, r);
         const cx = c * ROOM_W + ROOM_W / 2;
         const cz = r * ROOM_D + ROOM_D / 2;
         rooms.push({
            col: c,
            row: r,
            index: idx,
            wing: roomWings[idx],
            cx,
            cz,
            entranceX: cx,
            entranceZ: cz,
         });
      }
   }

   // 5. Build Doors and Walls
   const doors: Door[] = [];
   const solids: AABB[] = [];
   let doorIdSeq = 0;

   // Track which wing transitions already have locked doors
   const lockedDoorForTransition = new Map<string, number>();

   // Find backbone transitions between wing i and wing i+1
   const transitionEdges = new Set<string>();
   for (let i = 0; i < L - 1; i++) {
      const u = pathRooms[i];
      const v = pathRooms[i + 1];
      const wU = roomWings[u];
      const wV = roomWings[v];
      if (wU !== wV) {
         const key = `${Math.min(u, v)}-${Math.max(u, v)}`;
         transitionEdges.add(key);
      }
   }

   // We also collect possible candidates for the lever shortcut door
   interface CandidateShortcut {
      u: number;
      v: number;
      x: number;
      z: number;
      rotY: number;
      solid: AABB;
   }
   const candidateShortcuts: CandidateShortcut[] = [];

   // Horizontal internal edges (shared walls along X between (c, r) and (c, r+1))
   for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
         const u = roomIndexOf(cols, c, r);
         const v = roomIndexOf(cols, c, r + 1);
         const wU = roomWings[u];
         const wV = roomWings[v];
         const edgeKey = `${Math.min(u, v)}-${Math.max(u, v)}`;
         const wallZ = (r + 1) * ROOM_D;
         const doorX = c * ROOM_W + ROOM_W / 2;

         const doorSolid: AABB = {
            min: { x: doorX - DOOR_HALF, y: 0, z: wallZ - WALL_T / 2 },
            max: { x: doorX + DOOR_HALF, y: WALL_H, z: wallZ + WALL_T / 2 },
         };

         if (wU === wV) {
            // Same wing: always open door
            doors.push({
               id: doorIdSeq++,
               roomA: u,
               roomB: v,
               x: doorX,
               z: wallZ,
               rotY: 0,
               kind: "open",
               keyIndex: -1,
               shape: null,
               color: null,
               open: true,
               isExit: false,
               solid: doorSolid,
            });
            // Side wall segments
            solids.push({
               min: { x: c * ROOM_W, y: 0, z: wallZ - WALL_T / 2 },
               max: { x: doorX - DOOR_HALF, y: WALL_H, z: wallZ + WALL_T / 2 },
            });
            solids.push({
               min: { x: doorX + DOOR_HALF, y: 0, z: wallZ - WALL_T / 2 },
               max: { x: (c + 1) * ROOM_W, y: WALL_H, z: wallZ + WALL_T / 2 },
            });
         } else if (transitionEdges.has(edgeKey) && !lockedDoorForTransition.has(`${Math.min(wU, wV)}-${Math.max(wU, wV)}`)) {
            // Backbone locked door!
            const lowerW = Math.min(wU, wV);
            lockedDoorForTransition.set(`${Math.min(wU, wV)}-${Math.max(wU, wV)}`, lowerW);
            const isExit = lowerW === K - 1;
            doors.push({
               id: doorIdSeq++,
               roomA: u,
               roomB: v,
               x: doorX,
               z: wallZ,
               rotY: 0,
               kind: "locked",
               keyIndex: lowerW,
               shape: KEY_SHAPES[lowerW],
               color: KEY_COLORS[lowerW],
               open: false,
               isExit,
               solid: doorSolid,
            });
            // Side walls
            solids.push({
               min: { x: c * ROOM_W, y: 0, z: wallZ - WALL_T / 2 },
               max: { x: doorX - DOOR_HALF, y: WALL_H, z: wallZ + WALL_T / 2 },
            });
            solids.push({
               min: { x: doorX + DOOR_HALF, y: 0, z: wallZ - WALL_T / 2 },
               max: { x: (c + 1) * ROOM_W, y: WALL_H, z: wallZ + WALL_T / 2 },
            });
         } else {
            // Solid wall between different wings
            solids.push({
               min: { x: c * ROOM_W, y: 0, z: wallZ - WALL_T / 2 },
               max: { x: (c + 1) * ROOM_W, y: WALL_H, z: wallZ + WALL_T / 2 },
            });
            if (Math.abs(wU - wV) >= 1) {
               candidateShortcuts.push({ u, v, x: doorX, z: wallZ, rotY: 0, solid: doorSolid });
            }
         }
      }
   }

   // Vertical internal edges (shared walls along Z between (c, r) and (c+1, r))
   for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
         const u = roomIndexOf(cols, c, r);
         const v = roomIndexOf(cols, c + 1, r);
         const wU = roomWings[u];
         const wV = roomWings[v];
         const edgeKey = `${Math.min(u, v)}-${Math.max(u, v)}`;
         const wallX = (c + 1) * ROOM_W;
         const doorZ = r * ROOM_D + ROOM_D / 2;

         const doorSolid: AABB = {
            min: { x: wallX - WALL_T / 2, y: 0, z: doorZ - DOOR_HALF },
            max: { x: wallX + WALL_T / 2, y: WALL_H, z: doorZ + DOOR_HALF },
         };

         if (wU === wV) {
            doors.push({
               id: doorIdSeq++,
               roomA: u,
               roomB: v,
               x: wallX,
               z: doorZ,
               rotY: Math.PI / 2,
               kind: "open",
               keyIndex: -1,
               shape: null,
               color: null,
               open: true,
               isExit: false,
               solid: doorSolid,
            });
            solids.push({
               min: { x: wallX - WALL_T / 2, y: 0, z: r * ROOM_D },
               max: { x: wallX + WALL_T / 2, y: WALL_H, z: doorZ - DOOR_HALF },
            });
            solids.push({
               min: { x: wallX - WALL_T / 2, y: 0, z: doorZ + DOOR_HALF },
               max: { x: wallX + WALL_T / 2, y: WALL_H, z: (r + 1) * ROOM_D },
            });
         } else if (transitionEdges.has(edgeKey) && !lockedDoorForTransition.has(`${Math.min(wU, wV)}-${Math.max(wU, wV)}`)) {
            const lowerW = Math.min(wU, wV);
            lockedDoorForTransition.set(`${Math.min(wU, wV)}-${Math.max(wU, wV)}`, lowerW);
            const isExit = lowerW === K - 1;
            doors.push({
               id: doorIdSeq++,
               roomA: u,
               roomB: v,
               x: wallX,
               z: doorZ,
               rotY: Math.PI / 2,
               kind: "locked",
               keyIndex: lowerW,
               shape: KEY_SHAPES[lowerW],
               color: KEY_COLORS[lowerW],
               open: false,
               isExit,
               solid: doorSolid,
            });
            solids.push({
               min: { x: wallX - WALL_T / 2, y: 0, z: r * ROOM_D },
               max: { x: wallX + WALL_T / 2, y: WALL_H, z: doorZ - DOOR_HALF },
            });
            solids.push({
               min: { x: wallX - WALL_T / 2, y: 0, z: doorZ + DOOR_HALF },
               max: { x: wallX + WALL_T / 2, y: WALL_H, z: (r + 1) * ROOM_D },
            });
         } else {
            solids.push({
               min: { x: wallX - WALL_T / 2, y: 0, z: r * ROOM_D },
               max: { x: wallX + WALL_T / 2, y: WALL_H, z: (r + 1) * ROOM_D },
            });
            if (Math.abs(wU - wV) >= 1) {
               candidateShortcuts.push({ u, v, x: wallX, z: doorZ, rotY: Math.PI / 2, solid: doorSolid });
            }
         }
      }
   }

   // Exterior perimeter walls
   // Bottom (z = 0)
   solids.push({ min: { x: -WALL_T, y: 0, z: -WALL_T }, max: { x: cols * ROOM_W + WALL_T, y: WALL_H, z: 0 } });
   // Top (z = rows * ROOM_D)
   solids.push({ min: { x: -WALL_T, y: 0, z: rows * ROOM_D }, max: { x: cols * ROOM_W + WALL_T, y: WALL_H, z: rows * ROOM_D + WALL_T } });
   // Left (x = 0)
   solids.push({ min: { x: -WALL_T, y: 0, z: -WALL_T }, max: { x: 0, y: WALL_H, z: rows * ROOM_D + WALL_T } });
   // Right (x = cols * ROOM_W)
   solids.push({ min: { x: cols * ROOM_W, y: 0, z: -WALL_T }, max: { x: cols * ROOM_W + WALL_T, y: WALL_H, z: rows * ROOM_D + WALL_T } });

   // Set room entrance coordinates based on door connections into that room
   for (const d of doors) {
      if (d.rotY === 0) {
         // wall along X: door between roomA (bottom) and roomB (top)
         rooms[d.roomB].entranceX = d.x;
         rooms[d.roomB].entranceZ = d.z + 0.8;
      } else {
         // wall along Z: door between roomA (left) and roomB (right)
         rooms[d.roomB].entranceX = d.x + 0.8;
         rooms[d.roomB].entranceZ = d.z;
      }
   }
   // Room 0 entrance is its center
   rooms[0].entranceX = rooms[0].cx;
   rooms[0].entranceZ = rooms[0].cz;

   // 6. Keys placement:
   // Place key i in a room reachable before Door i opens (in Wing 0..i, preferably Wing i)
   const keys: KeyItem[] = [];
   for (let i = 0; i < K; i++) {
      // Find candidate rooms in Wing i (or Wing 0..i)
      const candidateRooms = rooms.filter((r) => r.wing <= i);
      const chosenRoom = candidateRooms.find((r) => r.wing === i) ?? candidateRooms[0];

      // Key position in room: offset from room center to sit on a prop/pedestal
      const offsetX = ((i % 2 === 0 ? 1 : -1) * 1.5);
      const offsetZ = ((i % 3 === 0 ? 1 : -1) * 1.0);
      keys.push({
         id: i,
         shape: KEY_SHAPES[i],
         color: KEY_COLORS[i],
         room: chosenRoom.index,
         x: chosenRoom.cx + offsetX,
         y: 0.6,
         z: chosenRoom.cz + offsetZ,
         collected: false,
      });
   }

   // 7. Lever & Shortcut Door
   let lever: Lever | null = null;
   if (level.lever && candidateShortcuts.length > 0) {
      // Pick a candidate shortcut edge
      const scIdx = Math.floor(rng() * candidateShortcuts.length);
      const sc = candidateShortcuts[scIdx];

      const shortcutDoor: Door = {
         id: doorIdSeq++,
         roomA: sc.u,
         roomB: sc.v,
         x: sc.x,
         z: sc.z,
         rotY: sc.rotY,
         kind: "shortcut",
         keyIndex: -1,
         shape: null,
         color: null,
         open: false,
         isExit: false,
         solid: sc.solid,
      };
      doors.push(shortcutDoor);

      // Place lever in a reachable room (e.g. wing 1 or 0)
      const reachableRooms = rooms.filter((r) => r.wing === 1 || r.wing === 0);
      const leverRoom = reachableRooms[Math.min(reachableRooms.length - 1, 1)] ?? rooms[0];

      lever = {
         room: leverRoom.index,
         x: leverRoom.cx + 2.4,
         y: 1.2,
         z: leverRoom.cz,
         rotY: -Math.PI / 2,
         pulled: false,
      };
   }

   // 8. Armour Agent
   let armour: ArmourAgent | null = null;
   if (level.armour) {
      // Patrol route along backbone rooms in the far half
      const patrolPoints: Vec3Like[] = [];
      const halfL = Math.floor(L / 2);
      for (let i = L - 1; i >= halfL; i--) {
         const r = rooms[pathRooms[i]];
         patrolPoints.push({ x: r.cx, y: 0, z: r.cz });
      }
      for (let i = halfL + 1; i < L - 1; i++) {
         const r = rooms[pathRooms[i]];
         patrolPoints.push({ x: r.cx, y: 0, z: r.cz });
      }
      if (patrolPoints.length < 2) {
         const farR = rooms[pathRooms[L - 1]];
         patrolPoints.push({ x: farR.cx - 1.5, y: 0, z: farR.cz }, { x: farR.cx + 1.5, y: 0, z: farR.cz });
      }
      const route = createPath(patrolPoints, { closed: true });
      const startP = route.points[0];

      const agent: Agent = {
         x: startP.x,
         y: 0,
         z: startP.z,
         vx: 0,
         vy: 0,
         vz: 0,
         yaw: 0,
      };

      const state: PatrolState = {
         index: 1,
         wait: 0,
         mode: "patrol",
         target: { x: route.points[1].x, y: 0, z: route.points[1].z },
      };

      armour = {
         agent,
         state,
         route,
         speed: level.armourSpeed,
      };
   }

   // 9. Hero
   const startRoom = rooms[0];
   const hero: Hero = {
      x: startRoom.cx,
      y: 0,
      z: startRoom.cz,
      vx: 0,
      vz: 0,
      yaw: 0,
      currentRoom: 0,
      mercy: 0,
   };

   return {
      seed,
      level,
      hero,
      rooms,
      doors,
      keys,
      lever,
      armour,
      solids,
      heldKeys: new Array(K).fill(false),
      keysCount: 0,
      leverPulled: false,
      exitDoorOpen: false,
      windup: 0,
      windupTargetKind: null,
      windupTargetId: -1,
      time: 0,
      elapsedMs: 0,
      score: 0,
      lives: level.lives ?? null,
      over: null,
      ev: {
         keyPickup: -1,
         doorOpen: -1,
         leverPulled: false,
         hitArmour: false,
         lifeLost: false,
         won: false,
      },
   };
}

// ---------- step simulation ----------

export function step(run: Run, input: MansionInput, dt: number, timeLeftMs: number): StepEvents {
   run.ev = {
      keyPickup: -1,
      doorOpen: -1,
      leverPulled: false,
      hitArmour: false,
      lifeLost: false,
      won: false,
   };

   if (run.over !== null || !(dt > 0)) return run.ev;

   run.time += dt;
   run.elapsedMs += dt * 1000;

   // Check clock expiry
   if (timeLeftMs <= 0 && run.level.durationMs > 0) {
      run.over = "timeup";
      return run.ev;
   }

   // 1. Hero Movement
   const { moveX, moveY, action } = input;
   const { x: wishX, z: wishZ } = inputToWorld(moveX, moveY, input.yaw);
   const wishLen = Math.hypot(wishX, wishZ);

   if (wishLen > 0.05) {
      const targetSpeed = Math.min(1, wishLen) * HERO_SPEED;
      const targetVx = (wishX / wishLen) * targetSpeed;
      const targetVz = (wishZ / wishLen) * targetSpeed;
      const ax = (targetVx - run.hero.vx) * Math.min(1, HERO_ACCEL * dt);
      const az = (targetVz - run.hero.vz) * Math.min(1, HERO_ACCEL * dt);
      run.hero.vx += ax;
      run.hero.vz += az;
      run.hero.yaw = Math.atan2(wishX, wishZ);
   } else {
      const brake = Math.min(1, HERO_BRAKE * dt);
      run.hero.vx *= 1 - brake;
      run.hero.vz *= 1 - brake;
   }

   // Integrate position
   run.hero.x += run.hero.vx * dt;
   run.hero.z += run.hero.vz * dt;

   // 2. Collision resolution against walls and closed doors
   const heroPos: Vec3Like = { x: run.hero.x, y: 0.9, z: run.hero.z };

   // Static walls
   for (const wall of run.solids) {
      resolveSphereAabb(heroPos, HERO_RADIUS, wall, heroPos);
   }
   // Closed doors
   for (const door of run.doors) {
      if (!door.open) {
         resolveSphereAabb(heroPos, HERO_RADIUS, door.solid, heroPos);
      }
   }

   run.hero.x = heroPos.x;
   run.hero.z = heroPos.z;

   // Update hero room
   run.hero.currentRoom = roomOf(run.level.cols, run.level.rows, run.hero.x, run.hero.z);

   // 3. Interactions (Key pickup, Door unlock, Lever pull)
   let inRangeTarget: { kind: "key" | "door" | "lever"; id: number } | null = null;

   // Check Keys
   for (const key of run.keys) {
      if (!key.collected) {
         const d = Math.hypot(key.x - run.hero.x, key.z - run.hero.z);
         if (d <= ACTION_RANGE) {
            inRangeTarget = { kind: "key", id: key.id };
            break;
         }
      }
   }

   // Check Doors (locked door where player holds matching key)
   if (!inRangeTarget) {
      for (const door of run.doors) {
         if (!door.open && door.kind === "locked" && door.keyIndex >= 0) {
            if (run.heldKeys[door.keyIndex]) {
               const d = Math.hypot(door.x - run.hero.x, door.z - run.hero.z);
               if (d <= ACTION_RANGE) {
                  inRangeTarget = { kind: "door", id: door.id };
                  break;
               }
            }
         }
      }
   }

   // Check Lever
   if (!inRangeTarget && run.lever && !run.lever.pulled) {
      const d = Math.hypot(run.lever.x - run.hero.x, run.lever.z - run.hero.z);
      if (d <= ACTION_RANGE) {
         inRangeTarget = { kind: "lever", id: 0 };
      }
   }

   // Windup handling
   if (action && inRangeTarget) {
      if (run.windupTargetKind === inRangeTarget.kind && run.windupTargetId === inRangeTarget.id) {
         run.windup += dt;
      } else {
         run.windupTargetKind = inRangeTarget.kind;
         run.windupTargetId = inRangeTarget.id;
         run.windup = dt;
      }

      if (run.windup >= ACTION_WINDUP_S - 1e-4) {
         // Execute interaction!
         if (inRangeTarget.kind === "key") {
            const key = run.keys[inRangeTarget.id];
            key.collected = true;
            run.heldKeys[key.id] = true;
            run.keysCount += 1;
            run.ev.keyPickup = key.id;
         } else if (inRangeTarget.kind === "door") {
            const door = run.doors.find((d) => d.id === inRangeTarget!.id);
            if (door) {
               door.open = true;
               run.ev.doorOpen = door.id;
               if (door.isExit) {
                  run.exitDoorOpen = true;
               }
            }
         } else if (inRangeTarget.kind === "lever") {
            if (run.lever) {
               run.lever.pulled = true;
               run.leverPulled = true;
               run.ev.leverPulled = true;
               // Open shortcut door
               for (const d of run.doors) {
                  if (d.kind === "shortcut") {
                     d.open = true;
                     run.ev.doorOpen = d.id;
                  }
               }
            }
         }
         run.windup = 0;
         run.windupTargetKind = null;
         run.windupTargetId = -1;
      }
   } else {
      run.windup = 0;
      run.windupTargetKind = null;
      run.windupTargetId = -1;
   }

   // 4. Armour simulation & overlap check
   if (run.armour && run.level.armour) {
      stepPatrol(run.armour.agent, run.armour.state, run.armour.route, dt, { speed: run.level.armourSpeed });

      const dArmour = Math.hypot(run.armour.agent.x - run.hero.x, run.armour.agent.z - run.hero.z);
      if (dArmour < HERO_RADIUS + ARMOUR_RADIUS) {
         if (run.hero.mercy <= 0) {
            run.ev.hitArmour = true;
            run.hero.mercy = MERCY_S;

            // Reset hero position to current room entrance
            const curRoom = run.rooms[run.hero.currentRoom];
            run.hero.x = curRoom.entranceX;
            run.hero.z = curRoom.entranceZ;
            run.hero.vx = 0;
            run.hero.vz = 0;

            if (run.lives !== null) {
               run.lives = Math.max(0, run.lives - 1);
               run.ev.lifeLost = true;
               if (run.lives === 0) {
                  run.over = "lose";
                  return run.ev;
               }
            }
         }
      }
   }

   if (run.hero.mercy > 0) {
      run.hero.mercy = Math.max(0, run.hero.mercy - dt);
   }

   // 5. Check Win Condition
   // Win: the exit door is open and the player is in the exit room (end("win"))
   const exitRoom = run.rooms[run.rooms.length - 1];
   if (run.exitDoorOpen && run.hero.currentRoom === exitRoom.index) {
      run.over = "win";
      run.ev.won = true;
      run.score = Math.max(0, Math.floor((run.level.timeBaseMs - run.elapsedMs) / 10));
   }

   return run.ev;
}

// ---------- flood fill & solver helpers for tests ----------

/**
 * Validates that from room (0,0), without using the lever, the player can
 * reach every key before needing to open its matching door, and reach the exit.
 */
export function validateLevelSolvability(run: Run): boolean {
   const cols = run.level.cols;
   const rows = run.level.rows;
   const exitRoomIdx = run.rooms.length - 1;

   const reachableRooms = new Set<number>([0]);
   const heldKeys = new Set<number>();

   let changed = true;
   while (changed) {
      changed = false;

      // 1. Pick up any reachable keys
      for (const key of run.keys) {
         if (!heldKeys.has(key.id) && reachableRooms.has(key.room)) {
            heldKeys.add(key.id);
            changed = true;
         }
      }

      // 2. Expand reachable rooms through open doors or unlocked doors with held keys
      // (ignoring shortcut door as lever is unused)
      for (const door of run.doors) {
         if (door.kind === "shortcut") continue; // lever unused!

         const canPass = door.kind === "open" || (door.kind === "locked" && heldKeys.has(door.keyIndex));
         if (canPass) {
            if (reachableRooms.has(door.roomA) && !reachableRooms.has(door.roomB)) {
               reachableRooms.add(door.roomB);
               changed = true;
            }
            if (reachableRooms.has(door.roomB) && !reachableRooms.has(door.roomA)) {
               reachableRooms.add(door.roomA);
               changed = true;
            }
         }
      }
   }

   // Verify all keys were collected and exit room was reached
   if (heldKeys.size < run.level.keys) return false;
   if (!reachableRooms.has(exitRoomIdx)) return false;

   return true;
}
