import { describe } from "vitest";
import { levelRows } from "./testing/levelBots";

// Bot proofs per level: testing/levelBots.ts (the bots, the 200-seed sweeps and the real-store runs).

describe("castle-defender levels: bots", () => levelRows([4, 5]));
