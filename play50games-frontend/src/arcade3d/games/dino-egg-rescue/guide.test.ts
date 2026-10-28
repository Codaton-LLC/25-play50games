// guide.ts: one line from the egg stats.
import { describe, expect, it } from "vitest";
import { hintFor } from "./guide";

describe("dino-egg-rescue guide", () => {
   it("says pick up with empty hands, carry with eggs, and full at the stack limit", () => {
      expect(hintFor(0, 3, false)).toMatchObject({ tone: "info" });
      expect(hintFor(0, 3, false).text).toMatch(/pick it up/);
      expect(hintFor(2, 3, false).text).toMatch(/Carrying 2\/3.*or grab more/);
      expect(hintFor(3, 3, true).text).toMatch(/hands full.*golden/);
      expect(hintFor(3, 3, true).tone).toBe("carry");
   });
});
