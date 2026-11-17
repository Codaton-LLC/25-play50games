// guide.ts: one line from the ladder, rock and offer stats.
import { describe, expect, it } from "vitest";
import { hintFor } from "./guide";

describe("castle-defender guide", () => {
   it("teaches the aim first, in the words of the input in use", () => {
      expect(hintFor(0, 0, false, true).text).toMatch(/^Tap the field/);
      expect(hintFor(0, 0, false, false).text).toMatch(/^Click the field/);
      expect(hintFor(0, 0, false, false).tone).toBe("info");
   });

   it("warns about a ladder, says Rock when it is ready and is quiet during the upgrade offer", () => {
      expect(hintFor(30, 0, false, true).text).toMatch(/tap Rock/);
      expect(hintFor(30, 0, false, false).text).toMatch(/E \/ Enter/);
      expect(hintFor(30, 40, false, true).text).toMatch(/reloads/);
      expect(hintFor(30, 0, true, true).text).toBeNull();
   });
});
