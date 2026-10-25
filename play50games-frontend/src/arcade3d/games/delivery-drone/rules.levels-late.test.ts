import { describe } from "vitest";
import { levelRows } from "./testing/levelBot";

// Bot proofs for levels 4 and 5, split from rules.levels.test.ts so the two files run in parallel.

describe("delivery-drone levels: bots", () => levelRows([4, 5]));
