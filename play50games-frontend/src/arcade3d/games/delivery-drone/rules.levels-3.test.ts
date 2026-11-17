import { describe } from "vitest";
import { levelRows } from "./testing/levelBot";

// Bot proofs for level 3 (one file per level, run in parallel; see rules.levels.test.ts).

describe("delivery-drone levels: bots", () => levelRows([3]));
