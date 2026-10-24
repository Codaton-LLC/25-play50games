import { describe } from "vitest";
import { levelRows } from "./levelBots";

// Bot proofs per level: levelBots.ts (the bots, the 200-seed sweeps and the real-store runs).
// Levels 4 and 5 run in rules.levels-late.test.ts.

describe("castle-defender levels: bots", () => levelRows([1, 2, 3]));
