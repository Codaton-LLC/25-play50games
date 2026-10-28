// guide.ts: one line from the ammo and health stats.
import { describe, expect, it } from "vitest";
import { hintFor } from "./guide";

describe("snowball-battle guide", () => {
   it("scoops with no ammo, throws with ammo, warns on low health", () => {
      expect(hintFor(0, 5).text).toMatch(/Hold Scoop/);
      expect(hintFor(2, 5)).toMatchObject({ tone: "carry" });
      expect(hintFor(1, 5).text).toMatch(/1 snowball ready/);
      expect(hintFor(3, 1)).toMatchObject({ tone: "warn" });
      expect(hintFor(3, 1).text).toMatch(/1 mitt left/);
   });
});
