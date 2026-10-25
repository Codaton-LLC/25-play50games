// Level 1 is today's game, bit for bit: every frame's float state hashed (l1Replay.fixture.ts) and
// compared with digests recorded from main's pre-level rules.ts (2026-10-25). Random frame rates;
// "random" presses and taps, "timed" shots in the band (goals, saves, streaks), "idle" timeouts.
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { createRun, reticleOffset, step } from "./rules";
import { replayDigest } from "./l1Replay.fixture";

const TODAY = {
   random: [
      "50633f18:672252c6:100:1:25557", "4011a0e7:4d6f6c9:600:5:28114", "63e10643:c14882e5:250:2:24357", "3663af7d:6f57e973:500:4:29784",
      "3ef34813:70188f35:500:4:21568", "644a7954:2667791a:200:2:24301", "fd9c9a4:c32e81d2:100:1:21393", "62def934:e8d8a26a:200:2:25772",
      "4cb99375:4a5c304b:250:2:25988", "fda4a796:8824ad08:100:1:21674",
   ],
   timed: [
      "d39aaf19:664894bf:1100:8:18178", "6486b64c:884185da:1450:10:17856", "13860717:10f00d09:700:6:17930", "7b9a888e:f19e98b8:1250:9:17276",
      "37a290c0:9a66d9f6:1250:9:17791", "af79f0da:4dee127c:1250:9:18016", "6ad1a70a:fae488d4:1250:9:18160", "f9cc1c2c:ae4e38f2:1300:9:18593",
      "dd848fab:1ae30e0d:1450:10:17040", "a082b84d:33310f3:1100:8:17810",
   ],
   idle: ["2a42da9d:b8f8b943:0:0:216007", "75651e9a:71a5c3c4:0:0:216005", "6d2953c2:3686a42c:0:0:216032"],
};

describe("penalty-hero level 1 = today's createRun, bit-exact", () => {
   const api = { createRun: (seed: number) => createRun(seed, LEVELS[1]), step, reticleOffset };
   for (const mode of ["random", "timed", "idle"] as const) it(`${mode}: replays main's digests`, () => {
      expect(TODAY[mode].map((_d, seed) => replayDigest(api as never, seed, mode))).toEqual(TODAY[mode]);
   });
   it("the default createRun(seed) is level 1", () => {
      expect(replayDigest({ createRun: (seed: number) => createRun(seed), step, reticleOffset } as never, 1, "timed")).toBe(TODAY.timed[1]);
   });
});
