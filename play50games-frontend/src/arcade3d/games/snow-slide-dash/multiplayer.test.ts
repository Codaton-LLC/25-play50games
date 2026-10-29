import { describe, expect, it } from "vitest";
import { createMultiRun, stepMulti, needsSplit, sharedSimMs } from "./multiplayer";
import { botInput } from "./bot";
import { idleInput } from "./rules";
import { isRankedRun } from "../../core/scores";
import { LIMITS } from "./rules";

describe("local downhill race", () => {
   it("moving hazards follow the remaining active clocks after P1 stops", () => {
      const m = createMultiRun(1, 4, ["zuno", "nami"], "versus");
      m.runs[0].ended = "lose"; m.runs[0].simMs = 100;
      m.runs[1].simMs = 1000;
      expect(sharedSimMs(m.runs)).toBe(1000);
      stepMulti(m, 100, m.runs.map(idleInput));
      expect(m.runs[0].simMs).toBe(100);
      expect(sharedSimMs(m.runs)).toBeGreaterThan(1000);
   });
   it("two-player camera splits after 35 m; the larger pack uses a leash", () => {
      const m = createMultiRun(1, 1, ["zuno", "nami"], "versus");
      m.runs[0].distance = 36;
      expect(needsSplit(m)).toBe(true);
      const pack = createMultiRun(1, 1, ["zuno", "nami", "kiro"], "coop");
      pack.runs[0].distance = 290; pack.runs[0].checkpoint = 1;
      stepMulti(pack, 16, pack.runs.map(idleInput));
      expect(pack.runs[0].distance - pack.runs[1].distance).toBeCloseTo(20);
      const before = pack.runs[1].distance;
      stepMulti(pack, 16, pack.runs.map(idleInput));
      expect(pack.runs[1].distance).toBeGreaterThan(before);
      expect(needsSplit(pack)).toBe(false);
   });
   it("co-op drafting gives a follower ten percent extra speed, and twin gates boost the team", () => {
      const m = createMultiRun(1, 1, ["zuno", "nami"], "coop");
      m.runs[0].distance = 4;
      m.runs[0].hero.x = m.runs[1].hero.x = 0;
      stepMulti(m, 100, m.runs.map(idleInput));
      expect(m.runs[1].draft).toBe(true);
      expect(m.runs[1].speed).toBeGreaterThan(m.runs[0].speed);
      m.runs.forEach((r) => { r.distance = r.course.gates[0].d - 0.01; r.hero.x = 0; });
      stepMulti(m, 16, m.runs.map(idleInput));
      expect(m.runs.every((r) => r.twinUntil > m.simMs)).toBe(true);
   });
   for (const mode of ["coop", "versus"] as const) it(`${mode}: four honest players finish and cannot rank on the solo board`, () => {
      const m = createMultiRun(11, 1, ["zuno", "riko", "kiro", "vexa"], mode);
      for (let f = 0; f < 10_000 && !m.ended; f++) stepMulti(m, 1000 / 60, m.runs.map((r) => botInput(r)));
      expect(m.ended).toBe("win");
      expect(m.runs.every((r) => r.ended === "win")).toBe(true);
      expect(isRankedRun(LIMITS[1], "win", 4)).toBe(false);
   });
});
