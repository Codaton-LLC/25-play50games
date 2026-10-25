import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createRng } from "@/arcade3d/core/math";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   ACTION_RANGE,
   ACTION_WINDUP_S,
   DOOR_WIDTH,
   HERO_RADIUS,
   KEY_SHAPES,
   MERCY_S,
   PROPOSED_LEVEL_LIMITS,
   ROOM_D,
   ROOM_W,
   createRun,
   idleInput,
   roomOf,
   step,
   validateLevelSolvability,
   type Door,
   type MansionInput,
   type Run,
} from "./rules";

type Style = "oracle" | "human" | "idle" | "spam";

// ---------- navigation for bots ----------

/** BFS path of rooms from startRoom to targetRoom through currently open doors */
function pathOfRooms(run: Run, startRoom: number, targetRoom: number): number[] | null {
   if (startRoom === targetRoom) return [startRoom];
   const queue: number[] = [startRoom];
   const prev = new Map<number, { room: number; door: Door }>();
   const visited = new Set<number>([startRoom]);

   while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === targetRoom) break;

      for (const door of run.doors) {
         if (!door.open) continue;
         let next = -1;
         if (door.roomA === curr) next = door.roomB;
         else if (door.roomB === curr) next = door.roomA;

         if (next >= 0 && !visited.has(next)) {
            visited.add(next);
            prev.set(next, { room: curr, door });
            queue.push(next);
         }
      }
   }

   if (!visited.has(targetRoom)) return null;

   const path: number[] = [];
   let curr = targetRoom;
   while (curr !== startRoom) {
      path.push(curr);
      curr = prev.get(curr)!.room;
   }
   path.push(startRoom);
   path.reverse();
   return path;
}

/** Step through the doorway between fromRoom and toRoom towards toRoom center */
function doorwayBetween(run: Run, fromRoom: number, toRoom: number): { x: number; z: number } | null {
   for (const d of run.doors) {
      if ((d.roomA === fromRoom && d.roomB === toRoom) || (d.roomA === toRoom && d.roomB === fromRoom)) {
         const targetRoom = run.rooms[toRoom];
         const dx = targetRoom.cx - d.x;
         const dz = targetRoom.cz - d.z;
         const len = Math.hypot(dx, dz) || 1;
         return { x: d.x + (dx / len) * 0.9, z: d.z + (dz / len) * 0.9 };
      }
   }
   return null;
}

function drive(run: Run, input: MansionInput, dt: number, style: Style, rng: () => number): void {
   input.moveX = 0;
   input.moveY = 0;
   input.action = false;
   input.yaw = 0;

   if (style === "idle" || run.over) return;

   if (style === "spam") {
      input.moveX = rng() * 2 - 1;
      input.moveY = rng() * 2 - 1;
      input.action = rng() > 0.4;
      return;
   }

   const heroRoom = run.hero.currentRoom;
   const exitRoomIdx = run.rooms.length - 1;

   // 1. Target selection:
   let target: { x: number; z: number; room: number; isAction: boolean } | null = null;

   // Check if we are near an uncollected key
   for (const key of run.keys) {
      if (!key.collected) {
         const d = Math.hypot(key.x - run.hero.x, key.z - run.hero.z);
         if (d <= ACTION_RANGE) {
            target = { x: key.x, z: key.z, room: heroRoom, isAction: true };
            break;
         }
      }
   }

   // Check if near a locked door matching a held key
   if (!target) {
      for (const door of run.doors) {
         if (!door.open && door.kind === "locked" && door.keyIndex >= 0 && run.heldKeys[door.keyIndex]) {
            const d = Math.hypot(door.x - run.hero.x, door.z - run.hero.z);
            if (d <= ACTION_RANGE) {
               target = { x: door.x, z: door.z, room: heroRoom, isAction: true };
               break;
            }
         }
      }
   }

   // If not in action range, find uncollected keys that have a path from heroRoom
   if (!target) {
      for (const key of run.keys) {
         if (!key.collected) {
            const p = pathOfRooms(run, heroRoom, key.room);
            if (p) {
               target = { x: key.x, z: key.z, room: key.room, isAction: false };
               break;
            }
         }
      }
   }

   // If no keys to collect, find a locked door we can unlock
   if (!target) {
      for (const door of run.doors) {
         if (!door.open && door.kind === "locked" && door.keyIndex >= 0 && run.heldKeys[door.keyIndex]) {
            const pA = pathOfRooms(run, heroRoom, door.roomA);
            const pB = pathOfRooms(run, heroRoom, door.roomB);
            if (pA) {
               target = { x: door.x, z: door.z, room: door.roomA, isAction: false };
               break;
            } else if (pB) {
               target = { x: door.x, z: door.z, room: door.roomB, isAction: false };
               break;
            }
         }
      }
   }

   // If exit door is open or all doors open, go to exit room
   if (!target) {
      const exitRoom = run.rooms[exitRoomIdx];
      target = { x: exitRoom.cx, z: exitRoom.cz, room: exitRoomIdx, isAction: false };
   }

   // 2. Move towards target
   let waypoint = { x: target.x, z: target.z };
   if (heroRoom !== target.room) {
      const path = pathOfRooms(run, heroRoom, target.room);
      if (path && path.length > 1) {
         const nextRoom = path[1];
         const doorPoint = doorwayBetween(run, heroRoom, nextRoom);
         if (doorPoint) {
            waypoint = doorPoint;
         }
      }
   }

   const dx = waypoint.x - run.hero.x;
   const dz = waypoint.z - run.hero.z;
   const dist = Math.hypot(dx, dz);

   const speedFactor = style === "human" ? 0.92 : 1.0;

   if (target.isAction) {
      input.action = true;
      if (dist > 0.4) {
         input.moveX = (dx / dist) * 0.3 * speedFactor;
         input.moveY = (dz / dist) * 0.3 * speedFactor;
      }
   } else if (dist > 0.1) {
      input.moveX = (dx / dist) * speedFactor;
      input.moveY = (dz / dist) * speedFactor;
   }

   // Dodge armour if nearby
   if (run.armour && run.level.armour) {
      const dArmour = Math.hypot(run.armour.agent.x - run.hero.x, run.armour.agent.z - run.hero.z);
      if (dArmour < 1.4 && !target.isAction) {
         const awayX = run.hero.x - run.armour.agent.x;
         const awayZ = run.hero.z - run.armour.agent.z;
         const awayLen = Math.hypot(awayX, awayZ) || 1;
         input.moveX = (awayX / awayLen) * speedFactor;
         input.moveY = (awayZ / awayLen) * speedFactor;
      }
   }
}

function play(id: LevelId, seed: number, hz: number, style: Style) {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const store = createArcadeStore();
   store.getState().configure({ durationMs: level.durationMs, lives: level.lives ?? null, resultDelayMs: 900 });
   store.getState().markReady();
   store.getState().start();

   const input = idleInput();
   const rng = createRng((seed + 1) * 7919 + id * 31);
   const cap = Math.ceil((level.durationMs / 1000 + 4) * hz);

   for (let i = 0; i < cap; i++) {
      advanceRunClock(store, 1 / hz);
      const state = store.getState();
      if (state.phase === "over") break;
      const dt = playedFrameDt(state);
      if (!dt) continue;

      drive(run, input, dt, style, rng);
      step(run, input, dt, state.timeLeftMs ?? 0);

      if (run.ev.lifeLost) state.loseLife();
      if (run.ev.won) {
         state.setScore(run.score);
         state.end("win");
      }
      if (run.over === "lose") state.end("lose");
      if (run.over === "timeup") state.end("timeup");
      if (run.over) break;
   }

   const final = store.getState();
   return { run, score: final.score, ms: final.elapsedMs, reason: final.endReason ?? run.over };
}

describe("haunted-mansion-keys 200 seeds check", () => {
   it("passes flood fill with lever unused, key reachable before door, no duplicate shapes", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 40; seed++) {
            const run = createRun(seed, LEVELS[id]);
            // 1. Solvability proof
            expect(validateLevelSolvability(run)).toBe(true);

            // 2. Shape uniqueness: no two keys share a shape
            const shapes = run.keys.map((k) => k.shape);
            const uniqueShapes = new Set(shapes);
            expect(uniqueShapes.size).toBe(run.keys.length);

            // 3. Start room is (0,0), exit room is (cols-1, rows-1)
            expect(run.rooms[0].col).toBe(0);
            expect(run.rooms[0].row).toBe(0);
            const last = run.rooms[run.rooms.length - 1];
            expect(last.col).toBe(LEVELS[id].cols - 1);
            expect(last.row).toBe(LEVELS[id].rows - 1);
         }
      }
   });
});

describe("haunted-mansion-keys timing windows and interactions", () => {
   it("windup is exactly 0.20 s and resets when action is released before 0.20 s", () => {
      const run = createRun(1, LEVELS[1]);
      const key = run.keys[0];
      run.hero.x = key.x;
      run.hero.z = key.z;

      const input = idleInput();
      input.action = true;

      // Hold for 0.15 s (9 frames at 60 fps = 0.15 s)
      for (let i = 0; i < 9; i++) {
         step(run, input, 1 / 60, 180_000);
      }
      expect(key.collected).toBe(false);
      expect(run.heldKeys[key.id]).toBe(false);
      expect(run.windup).toBeCloseTo(0.15, 2);

      // Release action
      input.action = false;
      step(run, input, 1 / 60, 180_000);
      expect(run.windup).toBe(0);
      expect(key.collected).toBe(false);

      // Now hold for full 0.20 s (14 frames at 60 fps > 0.20 s)
      input.action = true;
      for (let i = 0; i < 14; i++) {
         step(run, input, 1 / 60, 180_000);
      }
      expect(key.collected).toBe(true);
      expect(run.heldKeys[key.id]).toBe(true);
      expect(run.keysCount).toBe(1);
   });

   it("does not trigger action when outside 1.2 m range", () => {
      const run = createRun(1, LEVELS[1]);
      const key = run.keys[0];
      // Place hero safely in room center, 1.4 m away along Z (key.z is 3.5, 3.5 - 1.4 = 2.1 in room 0)
      run.hero.x = key.x;
      run.hero.z = key.z - 1.4;

      const input = idleInput();
      input.action = true;
      for (let i = 0; i < 20; i++) {
         step(run, input, 1 / 60, 180_000);
      }
      expect(key.collected).toBe(false);
   });
});

describe("haunted-mansion-keys armour mechanics", () => {
   it("spends life on armour overlap only when armour is true and respects 0.80 s mercy", () => {
      // L1: armour is false, lives is null
      const l1 = createRun(1, LEVELS[1]);
      expect(l1.armour).toBeNull();
      expect(l1.lives).toBeNull();

      // L4: armour is true, lives = 3
      const run = createRun(1, LEVELS[4]);
      expect(run.armour).not.toBeNull();
      expect(run.lives).toBe(3);

      const armour = run.armour!;
      run.hero.x = armour.agent.x;
      run.hero.z = armour.agent.z;

      // Hit armour
      step(run, idleInput(), 1 / 60, 240_000);
      expect(run.lives).toBe(2);
      expect(run.ev.lifeLost).toBe(true);
      expect(run.hero.mercy).toBeCloseTo(MERCY_S - 1 / 60, 2);

      // Hero moved back to room entrance
      const entrance = run.rooms[run.hero.currentRoom];
      expect(run.hero.x).toBeCloseTo(entrance.entranceX, 2);
      expect(run.hero.z).toBeCloseTo(entrance.entranceZ, 2);

      // Immediately touching armour again during mercy spends NO life
      run.hero.x = armour.agent.x;
      run.hero.z = armour.agent.z;
      step(run, idleInput(), 1 / 60, 240_000);
      expect(run.lives).toBe(2);
      expect(run.ev.lifeLost).toBe(false);
   });
});

describe("haunted-mansion-keys order independence", () => {
   it("unlocks doors regardless of collection order if matching key is held", () => {
      const run = createRun(1, LEVELS[2]);
      // Give key 1 first
      run.heldKeys[1] = true;
      run.keysCount = 1;

      const door1 = run.doors.find((d) => d.keyIndex === 1);
      expect(door1).toBeDefined();

      run.hero.x = door1!.x;
      run.hero.z = door1!.z;

      const input = idleInput();
      input.action = true;
      for (let i = 0; i < 15; i++) {
         step(run, input, 1 / 60, 210_000);
      }
      expect(door1!.open).toBe(true);
   });
});

describe("haunted-mansion-keys bot and score limits proof", () => {
   it("honest bot, idle bot, and spam bot stay within each level limits", () => {
      for (const id of LEVEL_IDS) {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         let bestScore = 0;
         let bestMs = Infinity;
         let wins = 0;

         for (let seed = 0; seed < 4; seed++) {
            for (const hz of [30, 60]) {
               const oracle = play(id, seed, hz, "oracle");
               if (oracle.reason === "win") {
                  wins++;
                  expect(isRankedRun(limits, "win")).toBe(true);
                  expect(oracle.score).toBe(computeTimeScore(limits, oracle.ms));
                  expect(oracle.score).toBe(oracle.run.score);
                  expect(oracle.score).toBeLessThanOrEqual(limits.maxScore);
                  expect(oracle.ms).toBeGreaterThanOrEqual(limits.minDurationMs);
                  expect(oracle.ms).toBeLessThanOrEqual(limits.maxDurationMs);
                  if (oracle.score > bestScore) {
                     bestScore = oracle.score;
                     bestMs = oracle.ms;
                  }
               }
            }

            const human = play(id, seed, 30, "human");
            if (human.reason === "win") {
               expect(isRankedRun(limits, "win")).toBe(true);
               expect(human.score).toBe(computeTimeScore(limits, human.ms));
               expect(human.score).toBeLessThanOrEqual(limits.maxScore);
            }

            const idle = play(id, seed, 20, "idle");
            expect(idle.score).toBe(0);
            expect(idle.reason).not.toBe("win");
            expect(isRankedRun(limits, idle.reason)).toBe(false);

            const spam = play(id, seed, 30, "spam");
            if (spam.reason !== "win") {
               expect(spam.score).toBe(0);
               expect(isRankedRun(limits, spam.reason)).toBe(false);
            } else {
               expect(spam.score).toBeLessThanOrEqual(limits.maxScore);
            }
         }

         console.log(`L${id} oracle wins ${wins}/8 best ${bestScore} at ${bestMs} ms (maxScore: ${limits.maxScore})`);
         expect(wins).toBeGreaterThan(0);
         expect(bestMs).toBeGreaterThanOrEqual(limits.minDurationMs);
         expect(bestScore).toBeLessThanOrEqual(limits.maxScore);
      }
   }, 180_000);
});
