// Test-only bots for Haunted Mansion Keys (never imported by runtime code). They drive the real rules
// through a fresh store exactly like the canvas (core/testing/botHarness simulateRun).
import { createRng } from "@/arcade3d/core/math";
import { createGrid, fixedFrames, followPath, freeGrid, randomFrames, simulateRun, steer, type Grid, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { ACTION_RANGE, HERO_RADIUS, ROOM_D, ROOM_W, createRun, idleInput, step, type MansionInput, type Run } from "../rules";

export type BotKind = "oracle" | "oracleLever" | "honest" | "idle" | "spam";
export type FrameKind = 30 | 60 | 144 | "random";

export interface BotResult {
   run: Run;
   store: ArcadeStore;
   endReason: ArcadeStore["endReason"];
   elapsedMs: number;
   score: number;
}

interface Goal {
   kind: "key" | "door" | "lever" | "exit";
   id: number;
   x: number;
   z: number;
}

/** Nodes the hero's centre may stand on: clear of walls, furniture and closed doors. */
function navGrid(run: Run, margin: number): { grid: Grid; free: Uint8Array } {
   const halfX = (run.level.cols * ROOM_W) / 2;
   const halfZ = (run.level.rows * ROOM_D) / 2;
   const grid = createGrid({ cell: 0.25, halfX, halfZ });
   const r = HERO_RADIUS + margin;
   const free = freeGrid(grid, (gx, gz) => {
      const x = gx + halfX;
      const z = gz + halfZ;
      for (const b of run.solids) if (x > b.min.x - r && x < b.max.x + r && z > b.min.z - r && z < b.max.z + r) return false;
      for (const d of run.doors) if (!d.open && x > d.solid.min.x - r && x < d.solid.max.x + r && z > d.solid.min.z - r && z < d.solid.max.z + r) return false;
      return true;
   });
   return { grid, free };
}

/** The point next to a door on the side of the room the hero is in. */
function doorApproach(run: Run, doorId: number): { x: number; z: number } {
   const d = run.doors[doorId];
   const room = run.hero.currentRoom === d.roomA || run.hero.currentRoom === d.roomB ? run.rooms[run.hero.currentRoom] : run.rooms[d.roomA];
   const along = d.rotY === 0 ? { x: 0, z: Math.sign(room.cz - d.z) } : { x: Math.sign(room.cx - d.x), z: 0 };
   return { x: d.x + along.x * 0.75, z: d.z + along.z * 0.75 };
}

/** The goals in order: lever first when `useLever`, then key i and door i for every key the route needs. */
function plan(run: Run, useLever: boolean): Goal[] {
   const goals: Goal[] = [];
   let skipFrom = -1;
   let skipTo = -1;
   if (useLever && run.lever) {
      goals.push({ kind: "lever", id: 0, x: run.lever.x, z: run.lever.z });
      const sc = run.doors.find((d) => d.kind === "shortcut");
      if (sc) {
         // the shortcut skips the locked doors (and their keys) between the two wings it joins
         skipFrom = Math.min(run.rooms[sc.roomA].wing, run.rooms[sc.roomB].wing);
         skipTo = Math.max(run.rooms[sc.roomA].wing, run.rooms[sc.roomB].wing);
      }
   }
   for (let i = 0; i < run.keys.length; i++) {
      if (i >= skipFrom && i < skipTo) continue;
      goals.push({ kind: "key", id: i, x: run.keys[i].x, z: run.keys[i].z });
      const door = run.doors.find((d) => d.kind === "locked" && d.keyIndex === i)!;
      goals.push({ kind: "door", id: door.id, x: door.x, z: door.z });
   }
   const exit = run.rooms[run.rooms.length - 1];
   goals.push({ kind: "exit", id: -1, x: exit.cx, z: exit.cz });
   return goals;
}

function done(run: Run, g: Goal): boolean {
   if (g.kind === "key") return run.keys[g.id].collected;
   if (g.kind === "door") return run.doors[g.id].open;
   if (g.kind === "lever") return !!run.lever?.pulled;
   return false;
}

/** Rooms from `from` to `to` through open doors (BFS), or null. */
function roomRoute(run: Run, from: number, to: number): number[] | null {
   if (from === to) return [from];
   const prev = new Map<number, number>([[from, from]]);
   const q = [from];
   while (q.length > 0) {
      const u = q.shift()!;
      for (const d of run.doors) {
         if (!d.open) continue;
         const v = d.roomA === u ? d.roomB : d.roomB === u ? d.roomA : -1;
         if (v < 0 || prev.has(v)) continue;
         prev.set(v, u);
         if (v === to) {
            const route = [to];
            while (route[0] !== from) route.unshift(prev.get(route[0])!);
            return route;
         }
         q.push(v);
      }
   }
   return null;
}

/** An honest player's next waypoint: through the room centre, then door to door, then to the goal. */
function roomWaypoint(run: Run, gx: number, gz: number, goalRoom: number, out: { x: number; z: number }): void {
   const here = run.hero.currentRoom;
   const room = run.rooms[here];
   const route = roomRoute(run, here, goalRoom);
   if (!route || route.length < 2) {
      // same room: straight at the goal unless the hero stands by a wall slot far from the centre lanes
      out.x = gx;
      out.z = gz;
      return;
   }
   const next = route[1];
   const d = run.doors.find((dr) => dr.open && ((dr.roomA === here && dr.roomB === next) || (dr.roomB === here && dr.roomA === next)))!;
   const nearX = d.rotY === 0 ? d.x : d.x + Math.sign(room.cx - d.x) * 0.9;
   const nearZ = d.rotY === 0 ? d.z + Math.sign(room.cz - d.z) * 0.9 : d.z;
   const farRoom = run.rooms[next];
   const farX = d.rotY === 0 ? d.x : d.x + Math.sign(farRoom.cx - d.x) * 0.9;
   const farZ = d.rotY === 0 ? d.z + Math.sign(farRoom.cz - d.z) * 0.9 : d.z;
   const onLane = d.rotY === 0 ? Math.abs(run.hero.x - d.x) < 0.25 : Math.abs(run.hero.z - d.z) < 0.25;
   const offCentre = Math.hypot(run.hero.x - room.cx, run.hero.z - room.cz) > 0.4;
   if (!onLane && offCentre) {
      // back to the centre first (the furniture slots are off the lanes)
      out.x = room.cx;
      out.z = room.cz;
   } else if (Math.hypot(run.hero.x - nearX, run.hero.z - nearZ) > 0.3 && !onLane) {
      out.x = nearX;
      out.z = nearZ;
   } else {
      out.x = farX;
      out.z = farZ;
   }
}

function makeDriver(run: Run, kind: BotKind, seed: number): (input: MansionInput, dt: number) => void {
   if (kind === "idle") return () => {};
   if (kind === "spam") {
      const rng = createRng(seed ^ 0x51a7);
      return (input) => {
         input.moveX = rng() * 2 - 1;
         input.moveY = rng() * 2 - 1;
         input.action = rng() < 0.6;
      };
   }
   const oracle = kind !== "honest";
   const goals = plan(run, kind === "oracleLever");
   if (!oracle) {
      const wp = { x: 0, z: 0 };
      let gi = 0;
      return (input) => {
         while (gi < goals.length - 1 && done(run, goals[gi])) gi++;
         const g = goals[gi];
         let tx = g.x;
         let tz = g.z;
         let goalRoom = run.rooms.length - 1;
         if (g.kind === "key") goalRoom = run.keys[g.id].room;
         else if (g.kind === "lever") goalRoom = run.lever!.room;
         else if (g.kind === "door") {
            const d = run.doors[g.id];
            goalRoom = roomRoute(run, run.hero.currentRoom, d.roomA) ? d.roomA : d.roomB;
            const r = run.rooms[goalRoom];
            tx = d.rotY === 0 ? d.x : d.x + Math.sign(r.cx - d.x) * 0.75;
            tz = d.rotY === 0 ? d.z + Math.sign(r.cz - d.z) * 0.75 : d.z;
         }
         roomWaypoint(run, tx, tz, goalRoom, wp);
         const dist = Math.hypot(g.x - run.hero.x, g.z - run.hero.z);
         const inRange = g.kind !== "exit" && dist <= ACTION_RANGE - 0.1 && run.hero.currentRoom === goalRoom;
         input.action = inRange;
         const dx = wp.x - run.hero.x;
         const dz = wp.z - run.hero.z;
         const len = Math.hypot(dx, dz) || 1;
         const speed = 0.85 * Math.min(1, len / 0.3);
         input.moveX = inRange ? 0 : (dx / len) * speed;
         input.moveY = inRange ? 0 : (dz / len) * speed;
         // keep away from the armour: back off while it is close
         if (run.armour) {
            const ax = run.hero.x - run.armour.agent.x;
            const az = run.hero.z - run.armour.agent.z;
            const da = Math.hypot(ax, az);
            if (da < 1.6) {
               input.moveX = (ax / da) * 0.85;
               input.moveY = (az / da) * 0.85;
            }
         }
      };
   }
   let gi = 0;
   let nav = navGrid(run, oracle ? 0.03 : 0.12);
   let openDoors = run.doors.filter((d) => d.open).length;
   let follower: PathFollower | null = null;
   let replanIn = 0;
   const dir = { dirX: 0, dirZ: 0 };
   const halfX = (run.level.cols * ROOM_W) / 2;
   const halfZ = (run.level.rows * ROOM_D) / 2;
   let lastGoal = -1;
   return (input, dt) => {
      while (gi < goals.length - 1 && done(run, goals[gi])) gi++;
      const g = goals[gi];
      const nowOpen = run.doors.filter((d) => d.open).length;
      if (nowOpen !== openDoors) {
         openDoors = nowOpen;
         nav = navGrid(run, oracle ? 0.03 : 0.12);
         follower = null;
      }
      let tx = g.x;
      let tz = g.z;
      if (g.kind === "door") ({ x: tx, z: tz } = doorApproach(run, g.id));
      const dist = Math.hypot(g.x - run.hero.x, g.z - run.hero.z);
      replanIn -= dt;
      if (!follower || gi !== lastGoal || replanIn <= 0 || run.ev.hitArmour) {
         lastGoal = gi;
         replanIn = 2;
         follower = followPath(nav.grid, nav.free, run.hero.x - halfX, run.hero.z - halfZ, tx - halfX, tz - halfZ);
      }
      steer(nav.grid, follower, run.hero.x - halfX, run.hero.z - halfZ, dir, 0.3);
      const inRange = g.kind !== "exit" && dist <= ACTION_RANGE - 0.05;
      // the oracle holds Use the whole way (a windup starts the moment a target is in range);
      // an honest player stops in range and holds it
      input.action = oracle ? true : inRange;
      const stop = !oracle && inRange;
      const speed = oracle ? 1 : 0.85;
      input.moveX = stop ? 0 : dir.dirX * speed;
      input.moveY = stop ? 0 : dir.dirZ * speed;
      // the honest player keeps away from the armour: it backs off while it is close
      if (!oracle && run.armour) {
         const ax = run.hero.x - run.armour.agent.x;
         const az = run.hero.z - run.armour.agent.z;
         const da = Math.hypot(ax, az);
         if (da < 1.6) {
            input.moveX = (ax / da) * speed;
            input.moveY = (az / da) * speed;
         }
      }
   };
}

const frameOf = (frames: FrameKind, seed: number) => (frames === "random" ? randomFrames(seed) : fixedFrames(1000 / frames));

/** One run of `kind` on level `id`. The bots steer in world axes (camera yaw 0: up = -z). */
export function playBot(id: LevelId, seed: number, kind: BotKind, frames: FrameKind = 60): BotResult {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const drive = makeDriver(run, kind, seed);
   const input = idleInput();
   const end = simulateRun(createArcadeStore(), {
      durationMs: level.durationMs,
      lives: level.lives,
      resultDelayMs: 900,
      frame: frameOf(frames, seed),
      step: (dt, _time, store) => {
         drive(input, dt);
         const s = store.getState();
         const ev = step(run, input, dt, s.timeLeftMs ?? 0);
         if (ev.lifeLost) s.loseLife();
         if (ev.won) {
            s.setScore(run.score);
            s.end("win");
         } else if (run.over === "lose") s.end("lose");
         else if (run.over === "timeup") s.end("timeup");
      },
   });
   return { run, store: end, endReason: end.endReason, elapsedMs: end.elapsedMs, score: end.score };
}

/** The oracle's best: with and without the lever, whichever wins sooner. */
export function playOracle(id: LevelId, seed: number, frames: FrameKind): BotResult {
   const plain = playBot(id, seed, "oracle", frames);
   if (!LEVELS[id].lever) return plain;
   const lever = playBot(id, seed, "oracleLever", frames);
   if (lever.endReason !== "win") return plain;
   if (plain.endReason !== "win") return lever;
   return lever.elapsedMs < plain.elapsedMs ? lever : plain;
}
