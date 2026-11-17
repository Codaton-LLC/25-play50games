// guide.ts: one line from the dock, wait and power stats.
import { describe, expect, it } from "vitest";
import { hintFor } from "./guide";

describe("space-repair guide", () => {
   it("flies to a dock, repairs in the arc once docked, warns on low power", () => {
      expect(hintFor(-1, false, 100).text).toMatch(/lit dock/);
      expect(hintFor(2, false, 100)).toMatchObject({ tone: "ready" });
      expect(hintFor(2, false, 10).text).toMatch(/green arc/);
      expect(hintFor(-1, false, 10)).toMatchObject({ tone: "warn" });
      expect(hintFor(-1, true, 100).text).toMatch(/not ready/);
   });
});
