// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = the spec's base game,
// monotone difficulty, the clear rate of an honest human-paced bot, and mutation probes showing every
// level knob reaches the simulation.
import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { playBot } from "./bots.testing";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES, type HotelLevel } from "./levels";
import { hotelBellboyRushMeta as meta } from "./meta";
import {
   DOOR_X,
   DESK_POINT,
   PAD_POINT,
   PROPOSED_LEVEL_LIMITS,
   RIDE_S,
   createRun,
   corridorLength,
   doorZ,
   earliestWinS,
   idleInput,
   step,
   targetAt,
   type Run,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const prev = (id: LevelId) => LEVELS[(id - 1) as LevelId];

/** Delivers the run's next bag by teleporting through the Use points (the walking is the bots'). */
function deliverNext(run: Run): void {
   const bag = run.bags[run.next];
   const press = () => {
      const input = idleInput();
      input.actionPressed = true;
      return step(run, input, 1 / 60, 50_000);
   };
   const at = (x: number, z: number) => {
      run.hero.x = x;
      run.hero.z = z;
      run.hero.vx = run.hero.vz = 0;
   };
   at(DESK_POINT.x, DESK_POINT.z + 0.5);
   press();
   if (run.floor !== bag.floor) {
      at(PAD_POINT.x - 0.25, PAD_POINT.z);
      press();
      for (let t = 0; t < RIDE_S + 0.05; t += 1 / 60) step(run, idleInput(), 1 / 60, 50_000);
   }
   at(DOOR_X - 1.05, doorZ(bag.index - 1));
   press();
}

describe("hotel levels: declarations", () => {
   it("declares five levels in meta and definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) {
         expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(meta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(meta.levels?.[id - 1].clearScore).toBeUndefined();
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
      }
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(meta).toMatchObject({ slug: "hotel-bellboy-rush", status: "dev", owner: "claude", order: 37, collection: "skill", difficulty: 2 });
      expect(definition.touchControls).toEqual(["joystick", "action"]);
      expect(definition.touchLabels).toEqual({ action: "Use" });
      expect(definition.lives).toBe(3);
      expect(definition.resultDelayMs).toBe(900);
   });

   it("level 1 is the spec's base game: 4 doors, the dark pad, 3 bags, 120 s, indoor, lobby theme", () => {
      expect(LEVELS[1]).toEqual({ doors: 4, floors: 1, bags: 3, durationMs: 120_000, lighting: "indoor", background: "#44403c", theme: "lobby" });
      expect(levelRunConfig(definition, 1).durationMs).toBe(120_000);
      expect(levelEnvironment(definition, 1)).toEqual({ background: "#44403c", fog: ["#44403c", 16, 38], lighting: "indoor" });
      expect(levelHudStats(definition, 1)).toEqual([{ key: "bags", label: "Bags", max: 3 }]);
      expect(levelInstructions(definition, 1)).toEqual(definition.instructions);
      expect(corridorLength(LEVELS[1])).toBeCloseTo(18.8, 9);
   });

   it("each level's clock, HUD maxima, light and instructions come from its config", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         const hud = levelHudStats(definition, id)!;
         expect(hud.find((s) => s.key === "bags")?.max).toBe(level.bags);
         if (level.floors > 1) expect(hud.find((s) => s.key === "floor")?.max).toBe(level.floors);
         if (id > 1) expect(levelInstructions(definition, id).some((line) => line.includes("elevator"))).toBe(true);
      }
      expect(LEVEL_IDS.map((id) => LEVELS[id].lighting)).toEqual(["indoor", "indoor", "indoor", "sunset", "night"]);
   });
});

describe("hotel levels: difficulty and points", () => {
   it("is monotone: doors, floors and bags never drop, less clock per bag every level, more work every level", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = prev(id);
         const b = LEVELS[id];
         expect(b.doors).toBeGreaterThanOrEqual(a.doors);
         expect(b.floors).toBeGreaterThanOrEqual(a.floors);
         expect(b.bags).toBeGreaterThan(a.bags);
         expect(b.durationMs / b.bags).toBeLessThan(a.durationMs / a.bags);
         expect(earliestWinS(b)).toBeGreaterThan(earliestWinS(a));
      }
   });

   it("every level offers at least level 1's points, and level 5 at most 3x level 1", () => {
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
         if (id > 1) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as LevelId].maxScore);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   for (const id of LEVEL_IDS) {
      it(`L${id}: an honest human-paced bot clears it on >= 99 % of 200 seeds (60 Hz), inside the limits; idle never clears`, () => {
         const level = LEVELS[id];
         let wins = 0;
         for (let seed = 0; seed < 200; seed++) {
            const r = playBot(level, (seed * 40503 + 17) >>> 0, 60, "honest");
            if (r.won) wins += 1;
            expect(withinServerLimits(r.score, r.ms, PROPOSED_LEVEL_LIMITS[id])).toBe(true);
         }
         expect(wins / 200).toBeGreaterThanOrEqual(0.99);
         for (let seed = 0; seed < 5; seed++) {
            const idle = playBot(level, seed, 30, "idle");
            expect(idle.won).toBe(false);
            expect(idle.score).toBe(0);
         }
      });
   }
});

describe("hotel levels: the simulation reads every level knob (mutation probes)", () => {
   const with_ = (id: LevelId, patch: Partial<HotelLevel>): HotelLevel => ({ ...LEVELS[id], ...patch });

   it("doors: the hall's length, the doors Use reaches and the rooms on the cards", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const run = createRun(1, level);
         expect(run.length).toBeCloseTo(level.doors * 3.2 + 6, 9);
         expect(targetAt(run, DOOR_X - 1, doorZ(level.doors - 1))).toEqual({ kind: "door", index: level.doors - 1 });
         expect(targetAt(run, DOOR_X - 1, doorZ(level.doors))).toBeNull();
         const more = createRun(1, with_(id, { doors: level.doors + 2 }));
         expect(more.length).toBeCloseTo(run.length + 6.4, 9);
         expect(targetAt(more, DOOR_X - 1, doorZ(level.doors))).toEqual({ kind: "door", index: level.doors });
         const indexes = new Set<number>();
         for (let seed = 0; seed < 60; seed++) for (const bag of createRun(seed, level).bags) indexes.add(bag.index);
         expect(Math.max(...indexes)).toBe(level.doors);
      }
   });

   it("floors: level 1's pad never rides; with floors > 1 every bag is for another floor and needs one ride", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const run = createRun(2, level);
         const rides = { n: 0 };
         for (let k = 0; k < level.bags; k++) {
            const before = run.floor;
            deliverNext(run);
            if (run.floor !== before) rides.n += 1;
         }
         expect(run.over).toBe("win");
         expect(rides.n).toBe(level.floors > 1 ? level.bags : 0);
         const flat = createRun(2, with_(id, { floors: 1 }));
         expect(flat.bags.every((b) => b.floor === 1)).toBe(true);
         const tall = createRun(2, with_(id, { floors: 4 }));
         expect(new Set(tall.bags.map((b) => b.floor)).size).toBeGreaterThan(1);
      }
   });

   it("bags: the queue length and the win after exactly that many deliveries", () => {
      for (const id of LEVEL_IDS) {
         for (const bags of [LEVELS[id].bags, LEVELS[id].bags + 1]) {
            const run = createRun(5, with_(id, { bags }));
            expect(run.bags).toHaveLength(bags);
            for (let k = 0; k < bags - 1; k++) deliverNext(run);
            expect(run.over).toBeNull();
            deliverNext(run);
            expect(run.over).toBe("win");
            expect(run.delivered).toBe(bags);
         }
      }
   });

   it("durationMs and floors / bags change the proven earliest win and so the limits", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(earliestWinS(with_(id, { bags: level.bags + 1 }))).toBeGreaterThan(earliestWinS(level));
         expect(earliestWinS(with_(id, { floors: level.floors > 1 ? 1 : 3 }))).not.toBe(earliestWinS(level));
         const idle = playBot(with_(id, { durationMs: 20_000 }), 1, 30, "idle");
         expect(idle.ms).toBeCloseTo(20_000, -2);
      }
   });
});
