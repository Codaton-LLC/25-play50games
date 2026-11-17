// guide.ts: one line from the catch and bamboo stats.
import { describe, expect, it } from "vitest";
import { hintFor } from "./guide";

describe("zoo-escape guide", () => {
   it("teaches sneaking, mentions bamboo only while there is some, warns on the last chance", () => {
      expect(hintFor(0, 3, 2).text).toMatch(/Sneak.*bamboo/);
      expect(hintFor(0, 3, 0).text).not.toMatch(/bamboo/);
      expect(hintFor(2, 3, 2)).toMatchObject({ tone: "warn" });
      expect(hintFor(1, 3, 2).tone).toBe("info");
   });
});
