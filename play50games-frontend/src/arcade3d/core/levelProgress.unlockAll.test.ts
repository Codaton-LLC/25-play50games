// The preview-only "unlock every level" switch (NEXT_PUBLIC_ARCADE_UNLOCK_ALL): a fresh player sees
// all five levels open; without it only level 1 is.
import { describe, expect, it } from "vitest";
import { getGameMeta } from "../registry";
import { levelProgress } from "./levelProgress";

describe("levelProgress unlockAll", () => {
   const meta = getGameMeta("mars-rover-mission")!;

   it("opens only level 1 for a new player by default", () => {
      const levels = levelProgress(meta, null, true, false).levels;
      expect(levels.map((level) => level.unlocked)).toEqual([true, false, false, false, false]);
   });

   it("opens every level with the preview switch on", () => {
      const levels = levelProgress(meta, null, true, true).levels;
      expect(levels.every((level) => level.unlocked)).toBe(true);
   });
});
