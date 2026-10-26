// The picker updates the hero live: selectHero notifies subscribers (the Scene re-makes its run, so the
// start card and the intro show the picked hero before Play) and does nothing when the pick is unchanged.
import { afterEach, describe, expect, it } from "vitest";
import * as roof from "./heroes";
import * as sky from "../sky-tower-jump/heroes";

for (const [name, h] of [["temple-lantern-jump", roof], ["sky-tower-jump", sky]] as const) {
   describe(`${name}: live hero pick`, () => {
      afterEach(() => h.selectHero("riko"));

      it("notifies a subscriber on a new pick, not on the same pick, and stops after unsubscribe", () => {
         let calls = 0;
         const off = h.subscribeHero(() => calls++);
         h.selectHero("nami");
         expect(h.pickedHero()).toBe("nami");
         expect(calls).toBe(1);
         h.selectHero("nami");
         expect(calls).toBe(1);
         h.selectHero("vexa");
         expect(calls).toBe(2);
         off();
         h.selectHero("kiro");
         expect(calls).toBe(2);
         expect(h.pickedHero()).toBe("kiro");
      });
   });
}
