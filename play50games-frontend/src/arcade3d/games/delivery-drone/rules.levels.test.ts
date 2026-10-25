import { describe } from "vitest";
import { levelRows } from "./testing/levelBot";

// Bot proofs for levels 1-3. Levels 4 and 5 run in rules.levels-late.test.ts.

describe("delivery-drone levels: bots", () => levelRows([1, 2, 3]));
