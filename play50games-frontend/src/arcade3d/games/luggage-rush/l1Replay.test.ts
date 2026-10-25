// Level 1 is today's game, bit for bit: every frame's float state hashed (l1Replay.fixture.ts) and
// compared with digests recorded from main's pre-level rules.ts (2026-10-25). Random frame rates;
// "random" covers strikes and the three-strike end, "greedy" the D3/D4 phases and the belt steps.
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { createRun, stepRun } from "./rules";
import { replayDigest } from "./l1Replay.fixture";

const TODAY = {
   random: [
      "48942fe2:b361a174:20:3:17.01", "af63d190:4d044746:20:3:12.79", "5521c466:936c45d0:0:3:13.33", "cf0c8d7f:8e0b4819:20:3:14.94",
      "243632d4:8cc50cea:40:3:17.03", "b093d087:54f45301:75:3:19.85", "fc12d603:279131d:20:3:13.47", "10af2dc8:dbc08556:0:3:13.47",
      "3252b382:605ef2c4:0:3:12.83", "114612ae:933b98f0:20:3:15.43", "87bf4814:24f40b92:0:3:10.62", "c529ed4:9b3b4d8a:40:3:14.94",
   ],
   greedy: [
      "2eb3eaf9:b4b7d537:2125:3:83.54", "52045f25:44d3febb:2910:3:102.03", "e5fb1be:a2ba74c0:2230:3:83.34", "1efe0bd0:5e69249e:2880:3:99.14",
      "7a04ce08:33acf936:2695:3:94.50", "3d76008f:bddefa19:2240:3:89.64", "78d29a2:fa70bd94:2940:3:102.06", "7d5a6b72:d0d410e4:2240:3:84.75",
      "6a07705f:78bbeb21:2200:3:82.15", "a3ecca72:7aabd414:2465:3:92.85", "94b12913:233a34ed:2545:3:94.21", "b0520f9b:431e3b05:2460:3:92.35",
   ],
};

describe("luggage-rush level 1 = today's createRun, bit-exact", () => {
   for (const mode of ["random", "greedy"] as const) it(`${mode}: 12 seeds replay main's digests`, () => {
      const api = { createRun: (seed: number) => createRun(seed, LEVELS[1]), stepRun };
      expect(TODAY[mode].map((_d, seed) => replayDigest(api as never, seed, mode))).toEqual(TODAY[mode]);
   });
   it("the default createRun(seed) is level 1", () => {
      expect(replayDigest({ createRun: (seed: number) => createRun(seed), stepRun } as never, 1, "greedy")).toBe(TODAY.greedy[1]);
   });
});
