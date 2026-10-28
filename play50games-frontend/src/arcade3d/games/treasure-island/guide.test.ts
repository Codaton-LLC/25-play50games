// guide.ts: one line from the found count.
import { describe, expect, it } from "vitest";
import { hintFor } from "./guide";

describe("treasure-island guide", () => {
   it("starts with the detector, counts what is found, and ends on a ready line", () => {
      expect(hintFor(0, 5).text).toMatch(/detector ring turns gold/);
      expect(hintFor(2, 5).text).toMatch(/2 of 5 found/);
      expect(hintFor(5, 5).tone).toBe("ready");
   });
});
