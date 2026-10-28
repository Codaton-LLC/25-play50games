// guide.ts: one line from the ring quota and boost stats.
import { describe, expect, it } from "vitest";
import { hintFor } from "./guide";

describe("magic-carpet-ride guide", () => {
   it("counts the rings still needed, then points at the palace", () => {
      expect(hintFor(4, false).text).toMatch(/4 more/);
      expect(hintFor(0, false).text).toMatch(/palace/);
      expect(hintFor(0, false).tone).toBe("ready");
      expect(hintFor(3, true).text).toMatch(/boost/i);
   });
});
