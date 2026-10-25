import { describe } from "vitest";
import { levelRows } from "./testing/levelBot";

// Bot proofs for level 1. One file per level (rules.levels-2/-3/-4/-5) so vitest runs them in parallel.

describe("delivery-drone levels: bots", () => levelRows([1]));
