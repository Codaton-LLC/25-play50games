// Level 1 is today's game, bit for bit: every frame's float state hashed (l1Replay.fixture.ts) and
// compared with digests recorded from main's pre-level rules.ts / physics.ts / course.ts
// (2026-10-25, before the levels PR). Random frame rates; "spam" covers water, pick-ups and the
// pick-up wins, "par" today's par lines through the windmill and the turntable.
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { advanceRun, canPutt, createRun } from "./rules";
import { replayDigest } from "./l1Replay.fixture";

const TODAY = {
   spam: [
      "a091e0bd:1dfcac7b:0:6,6,7,7,7,8:W", "4063f503:95eeee8d:0:6,6,7,7,7,8:W", "6b5648cf:122df8b9:0:6,6,7,7,7,8:W",
      "94a5380e:c96e9958:0:5,6,7,7,7,8:W", "3b2eef:2d1ab549:0:6,6,7,7,7,8:W", "b0dbccf8:a388620e:0:6,5,7,7,7,8:W",
      "2e4e1a2b:c26fce6d:0:6,6,7,7,7,8:W", "6992a36a:8d96f8d4:0:6,6,7,7,7,8:W", "e4125264:df7a6652:0:6,6,7,7,7,8:W",
      "d1e8545c:a64e849a:0:6,6,7,7,7,8:W", "7394d930:b355dae6:0:6,6,7,7,7,8:W", "cf87d743:b18575fd:0:6,6,7,7,7,8:W",
   ],
   par: [
      "e7f3c203:782eb3fd:2300:2,2,2,2,2,2:W", "ac217576:8f248600:2300:2,2,2,2,2,2:W", "137a29c2:a62e24b4:2300:2,2,2,2,2,2:W",
      "25b3f0bc:532d6c5a:2300:2,2,2,2,2,2:W", "fdf2da19:94686587:2300:2,2,2,2,2,2:W", "b066a7bb:bfbd0305:2300:2,2,2,2,2,2:W",
      "22e24938:564130ce:2300:2,2,2,2,2,2:W", "32821e44:c213a502:2300:2,2,2,2,2,2:W", "238bb7b:8c05942d:2300:2,2,2,2,2,2:W",
      "d3eac513:618b7205:2300:2,2,2,2,2,2:W", "dee013cb:89c9a6a5:2300:2,2,2,2,2,2:W", "62e960ae:17bc3da8:2300:2,2,2,2,2,2:W",
   ],
};

describe("mini-golf level 1 = today's createRun, bit-exact", () => {
   const api = { createRun: (seed: number) => createRun(seed, LEVELS[1]), advanceRun, canPutt };
   for (const mode of ["spam", "par"] as const) it(`${mode}: 12 seeds replay main's digests`, () => {
      expect(TODAY[mode].map((_d, seed) => replayDigest(api as never, seed, mode))).toEqual(TODAY[mode]);
   });
   it("the default createRun(seed) is level 1", () => {
      const api0 = { createRun: (seed: number) => createRun(seed), advanceRun, canPutt };
      expect(replayDigest(api0 as never, 3, "par")).toBe(TODAY.par[3]);
   });
});
