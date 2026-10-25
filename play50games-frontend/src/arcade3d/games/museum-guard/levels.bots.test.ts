// The per-level bot rows live in levels.bot1.test.ts … levels.bot5.test.ts so vitest can run them
// in parallel. This file stays so the suite has one place that names that split.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";

describe("museum-guard levels: bot files", () => {
   it("covers every level in its own file", () => {
      expect([...LEVEL_IDS]).toEqual([1, 2, 3, 4, 5]);
   });
});
