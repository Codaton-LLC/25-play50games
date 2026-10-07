import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHECKPOINT_NOTICE_MS, HINT_SLOT, towerHint } from "./hint";
import { HOLD_MS } from "./rules";

describe("tower-climb HUD hint", () => {
   it("is transient: guidance in the countdown and hold, a short checkpoint notice, the fall message, else nothing", () => {
      expect(towerHint("countdown", 0, false, 0, 0)).toBe("Left / right, then Jump");
      expect(towerHint("playing", HOLD_MS - 1, false, 0, 0)).toBe("Left / right, then Jump");
      expect(towerHint("paused", 100, false, 0, 0)).toBe("Left / right, then Jump");
      // nothing for the rest of a normal climb: no permanent row
      for (const ms of [HOLD_MS, 5000, 60000, 1799000]) expect(towerHint("playing", ms, false, 0, 0)).toBeNull();
      // a checkpoint reached at 20 s: shown for CHECKPOINT_NOTICE_MS, then gone, and not before it was reached
      expect(towerHint("playing", 20000, false, 3, 20000)).toBe("Checkpoint 3 · safe ledge");
      expect(towerHint("paused", 20000 + CHECKPOINT_NOTICE_MS - 1, false, 3, 20000)).toBe("Checkpoint 3 · safe ledge");
      expect(towerHint("playing", 20000 + CHECKPOINT_NOTICE_MS, false, 3, 20000)).toBeNull();
      expect(towerHint("playing", 19000, false, 3, 20000)).toBeNull();
      // the early fall: up through the wait to 3 s and the 800 ms result delay; nothing after other ends
      expect(towerHint("playing", 1200, true, 0, 0)).toBe("You fell! Nice climb.");
      expect(towerHint("over", 3000, true, 2, 2900)).toBe("You fell! Nice climb.");
      expect(towerHint("over", 1800000, false, 2, 1799900)).toBeNull();
   });

   it("Hud.module.css places the slot where HINT_SLOT says (camera.test.ts fits around these numbers)", () => {
      const css = readFileSync(new URL("./Hud.module.css", import.meta.url), "utf8").replace(/\r/g, "");
      const [fine, coarse] = css.split("@media (pointer: coarse)");
      const px = (block: string, property: string) => {
         const match = new RegExp(`\\n\\s*${property}:\\s*([^;]+);`).exec(block);
         if (!match) throw new Error(`${property} missing`);
         return match[1];
      };
      expect(px(fine, "top")).toBe(`calc(env(safe-area-inset-top, 0px) + ${HINT_SLOT.fine.top}px)`);
      expect(px(fine, "left")).toBe(`calc(env(safe-area-inset-left, 0px) + ${HINT_SLOT.fine.left}px)`);
      expect(px(fine, "width")).toBe(`${HINT_SLOT.fine.width}px`);
      expect(px(fine, "height")).toBe(`${HINT_SLOT.fine.height}px`);
      expect(px(coarse, "left")).toBe(`calc(env(safe-area-inset-left, 0px) + ${HINT_SLOT.coarse.left}px)`);
      expect(px(coarse, "right")).toBe(`calc(env(safe-area-inset-right, 0px) + ${HINT_SLOT.coarse.right}px)`);
      expect(px(coarse, "bottom")).toBe(`calc(${HINT_SLOT.coarse.bottom}px + env(safe-area-inset-bottom, 0px) + var(--arcade-bottom-obstruction, 0px))`);
      expect(px(coarse, "height")).toBe(`${HINT_SLOT.coarse.height}px`);
   });
});
