import { describe } from "vitest";
import { levelRows } from "./testing/levelBot";

// Bot proofs for level 5 (one file per level, run in parallel; see rules.levels.test.ts).

describe("delivery-drone levels: bots", () => levelRows([5]));
