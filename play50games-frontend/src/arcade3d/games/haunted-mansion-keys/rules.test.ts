// Haunted Mansion Keys rules: the generator on many seeds, every interaction, the level reads.
// The bot proofs per level are in rules.levels.test.ts.
import { describe, expect, it } from "vitest";
import { computeTimeScore } from "@/arcade3d/core/scores";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   ACTION_RANGE,
   ACTION_WINDUP_S,
   DOOR_HALF,
   KEY_SHAPES,
   MERCY_S,
   PROPOSED_LEVEL_LIMITS,
   ROOM_D,
   ROOM_W,
   createRun,
   idleInput,
   step,
   validateLevelSolvability,
   type Run,
} from "./rules";

const SEEDS = 200;
const wingOf = (run: Run, room: number) => run.rooms[room].wing;

describe("haunted-mansion-keys generator (200 seeds per level)", () => {
   it("is deterministic: same seed and level, same mansion", () => {
      for (const id of LEVEL_IDS) {
         const a = createRun(77, LEVELS[id]);
         const b = createRun(77, LEVELS[id]);
         expect(JSON.stringify({ ...a, armour: null })).toBe(JSON.stringify({ ...b, armour: null }));
      }
   });

   it("every seed is solvable with the lever unused; key i lies in wing i (behind door i-1, before door i); shapes unique", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (let seed = 0; seed < SEEDS; seed++) {
            const run = createRun(seed, level);
            expect(validateLevelSolvability(run), `L${id} seed ${seed}`).toBe(true);
            expect(run.rooms).toHaveLength(level.cols * level.rows);
            expect(run.keys).toHaveLength(level.keys);
            expect(new Set(run.keys.map((k) => k.shape)).size).toBe(level.keys);
            run.keys.forEach((k, i) => {
               expect(k.shape).toBe(KEY_SHAPES[i]);
               expect(wingOf(run, k.room)).toBe(i);
            });
            const locked = run.doors.filter((d) => d.kind === "locked");
            expect(locked).toHaveLength(level.keys);
            for (const d of locked) expect(Math.abs(wingOf(run, d.roomA) - wingOf(run, d.roomB))).toBe(1);
            expect(locked.filter((d) => d.isExit)).toHaveLength(1);
            const exit = locked.find((d) => d.isExit)!;
            expect([exit.roomA, exit.roomB]).toContain(run.rooms.length - 1);
            expect(run.rooms[0].col + run.rooms[0].row).toBe(0);
         }
      }
   });

   it("the lever (L3+) stands in the start wing; its shortcut joins the closest wings through a real doorway", () => {
      const gaps = new Map<number, number>();
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < SEEDS; seed++) {
            const run = createRun(seed, LEVELS[id]);
            const sc = run.doors.filter((d) => d.kind === "shortcut");
            if (!LEVELS[id].lever) {
               expect(run.lever).toBeNull();
               expect(sc).toHaveLength(0);
               continue;
            }
            expect(run.lever).not.toBeNull();
            expect(wingOf(run, run.lever!.room)).toBe(0);
            expect(sc).toHaveLength(1);
            const gap = Math.abs(wingOf(run, sc[0].roomA) - wingOf(run, sc[0].roomB));
            expect(gap).toBeGreaterThanOrEqual(1);
            expect(gap).toBeLessThanOrEqual(2);
            gaps.set(gap, (gaps.get(gap) ?? 0) + 1);
            // no wall fills the shortcut's doorway (only the door itself until the lever opens it)
            const d = sc[0];
            for (const w of run.walls) {
               const overlaps = d.solid.min.x < w.max.x - 1e-6 && d.solid.max.x > w.min.x + 1e-6 && d.solid.min.z < w.max.z - 1e-6 && d.solid.max.z > w.min.z + 1e-6;
               expect(overlaps, `L${id} seed ${seed}`).toBe(false);
            }
         }
      }
      // one skipped door is the rule, two the exception (a grid where the wings only touch that way)
      expect(gaps.get(1) ?? 0).toBeGreaterThan(4 * (gaps.get(2) ?? 0));
   });

   it("furniture keeps clear of every doorway lane and of the room centre; keys and the lever stay reachable (1.2 m)", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < SEEDS; seed++) {
            const run = createRun(seed, LEVELS[id]);
            for (const p of run.props) {
               const room = run.rooms[p.room];
               const turned = Math.abs(Math.sin(p.rotY)) > 0.5;
               const hw = (turned ? p.d : p.w) / 2;
               const hd = (turned ? p.w : p.d) / 2;
               // the lanes through the doorways (x within DOOR_HALF of the centre column, z of the centre row)
               // carry the whole hero: no furniture reaches into them
               expect(Math.abs(p.x - room.cx) - hw, `L${id} s${seed} ${p.kind}`).toBeGreaterThanOrEqual(DOOR_HALF - 1e-9);
               expect(Math.abs(p.z - room.cz) - hd, `L${id} s${seed} ${p.kind}`).toBeGreaterThanOrEqual(DOOR_HALF - 1e-9);
            }
            for (const k of run.keys) {
               const room = run.rooms[k.room];
               // the hero stands on the centre row facing the key's slot: within reach
               expect(Math.hypot(k.x - room.cx, k.z - room.cz) - 0.3).toBeLessThan(ACTION_RANGE + 1.2);
            }
         }
      }
   });

   it("each level reads its own config (mutation probes: rooms, keys, lever, armour, speed, lives, timer, time base)", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const run = createRun(5, level);
         const maxX = Math.max(...run.rooms.map((r) => r.cx)) + ROOM_W / 2;
         const maxZ = Math.max(...run.rooms.map((r) => r.cz)) + ROOM_D / 2;
         expect(maxX).toBe(level.cols * ROOM_W);
         expect(maxZ).toBe(level.rows * ROOM_D);
         expect(run.keys).toHaveLength(level.keys);
         expect(run.lever !== null).toBe(level.lever);
         expect(run.armour !== null).toBe(level.armour);
         expect(run.lives).toBe(level.lives ?? null);
         if (run.armour) {
            const a = run.armour.agent;
            const x0 = a.x, z0 = a.z;
            for (let i = 0; i < 6; i++) step(run, idleInput(), 0.05, 1e9);
            expect(Math.hypot(a.x - x0, a.z - z0)).toBeCloseTo(level.armourSpeed * 0.3, 1);
         }
         // the win pays the level's own time base
         const won = createRun(5, level);
         won.exitDoorOpen = true;
         const exit = won.rooms[won.rooms.length - 1];
         won.hero.x = exit.cx;
         won.hero.z = exit.cz;
         won.elapsedMs = 30_000 - 50;
         step(won, idleInput(), 0.05, 1e9);
         expect(won.over).toBe("win");
         expect(won.score).toBe(Math.floor((level.timeBaseMs - 30_000) / 10));
         expect(won.score).toBe(computeTimeScore(PROPOSED_LEVEL_LIMITS[id as LevelId], 30_000));
         // the timer: timeup when the shell's clock runs out
         const late = createRun(5, level);
         step(late, idleInput(), 0.05, 0);
         expect(late.over).toBe("timeup");
         expect(level.timeBaseMs).toBe(level.durationMs);
      }
   });
});

describe("haunted-mansion-keys interactions", () => {
   const nearKey = (run: Run, i = 0) => {
      const k = run.keys[i];
      const room = run.rooms[k.room];
      // stand between the key and the room centre, 0.7 m from the key
      const len = Math.hypot(room.cx - k.x, room.cz - k.z);
      run.hero.x = k.x + ((room.cx - k.x) / len) * 0.7;
      run.hero.z = k.z + ((room.cz - k.z) / len) * 0.7;
      run.hero.currentRoom = k.room;
   };

   it("the windup is 0.20 s of held Use, the same counter for a key, a door and the lever; a release resets it", () => {
      const run = createRun(1, LEVELS[1]);
      nearKey(run);
      const input = idleInput();
      input.action = true;
      for (let i = 0; i < 11; i++) step(run, input, 1 / 60, 1e9);
      expect(run.keys[0].collected).toBe(false);
      expect(run.windup).toBeCloseTo(11 / 60, 5);
      input.action = false;
      step(run, input, 1 / 60, 1e9);
      expect(run.windup).toBe(0);
      input.action = true;
      for (let i = 0; i < 11; i++) step(run, input, 1 / 60, 1e9);
      expect(run.keys[0].collected).toBe(false);
      step(run, input, 1 / 60, 1e9);
      expect(run.keys[0].collected).toBe(true);
      expect(ACTION_WINDUP_S).toBe(0.2);
   });

   it("the windup counts play time, not frames: 30, 60 and 144 Hz pick the key at the same 0.20 s", () => {
      for (const hz of [30, 60, 144]) {
         const run = createRun(1, LEVELS[1]);
         nearKey(run);
         const input = idleInput();
         input.action = true;
         let t = 0;
         while (!run.keys[0].collected) {
            step(run, input, 1 / hz, 1e9);
            t += 1 / hz;
         }
         expect(t).toBeGreaterThanOrEqual(0.2 - 1e-3);
         expect(t).toBeLessThan(0.2 + 1 / hz + 1e-6);
      }
   });

   it("nothing happens out of reach (1.2 m)", () => {
      const run = createRun(1, LEVELS[1]);
      const k = run.keys[0];
      const room = run.rooms[k.room];
      const len = Math.hypot(room.cx - k.x, room.cz - k.z);
      run.hero.x = k.x + ((room.cx - k.x) / len) * (ACTION_RANGE + 0.15);
      run.hero.z = k.z + ((room.cz - k.z) / len) * (ACTION_RANGE + 0.15);
      const input = idleInput();
      input.action = true;
      for (let i = 0; i < 30; i++) step(run, input, 1 / 60, 1e9);
      expect(k.collected).toBe(false);
   });

   it("a door opens only with its own key, in any order the keys were found", () => {
      const run = createRun(1, LEVELS[2]);
      const door1 = run.doors.find((d) => d.keyIndex === 1)!;
      const input = idleInput();
      input.action = true;
      run.hero.x = door1.x + (door1.rotY === 0 ? 0 : -0.7);
      run.hero.z = door1.z + (door1.rotY === 0 ? -0.7 : 0);
      run.heldKeys[0] = true;
      for (let i = 0; i < 20; i++) step(run, input, 1 / 60, 1e9);
      expect(door1.open).toBe(false);
      run.heldKeys[1] = true;
      for (let i = 0; i < 20; i++) step(run, input, 1 / 60, 1e9);
      expect(door1.open).toBe(true);
   });

   it("the armour costs a life only where the level has one, sends the detective to the room entrance and has 0.80 s mercy", () => {
      const l1 = createRun(1, LEVELS[1]);
      expect(l1.armour).toBeNull();
      expect(l1.lives).toBeNull();
      const run = createRun(1, LEVELS[4]);
      const armour = run.armour!;
      run.hero.x = armour.agent.x;
      run.hero.z = armour.agent.z;
      step(run, idleInput(), 1 / 60, 1e9);
      expect(run.lives).toBe(2);
      expect(run.ev.lifeLost).toBe(true);
      const room = run.rooms[run.hero.currentRoom];
      expect(run.hero.x).toBeCloseTo(room.entranceX, 1);
      expect(run.hero.mercy).toBeCloseTo(MERCY_S - 1 / 60, 5);
      run.hero.x = armour.agent.x;
      run.hero.z = armour.agent.z;
      step(run, idleInput(), 1 / 60, 1e9);
      expect(run.lives).toBe(2);
      for (let i = 0; i < 3; i++) {
         run.hero.mercy = 0;
         run.hero.x = armour.agent.x;
         run.hero.z = armour.agent.z;
         step(run, idleInput(), 1 / 60, 1e9);
      }
      expect(run.over).toBe("lose");
   });

   it("the lever opens the shortcut door after its windup", () => {
      const run = createRun(3, LEVELS[3]);
      const lever = run.lever!;
      const room = run.rooms[lever.room];
      const len = Math.hypot(room.cx - lever.x, room.cz - lever.z);
      run.hero.x = lever.x + ((room.cx - lever.x) / len) * 0.6;
      run.hero.z = lever.z + ((room.cz - lever.z) / len) * 0.6;
      const input = idleInput();
      input.action = true;
      const sc = run.doors.find((d) => d.kind === "shortcut")!;
      for (let i = 0; i < 11; i++) step(run, input, 1 / 60, 1e9);
      expect(sc.open).toBe(false);
      step(run, input, 1 / 60, 1e9);
      expect(run.leverPulled).toBe(true);
      expect(sc.open).toBe(true);
   });
});
