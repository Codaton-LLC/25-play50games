// The World 6 hero tag-switch (rules.ts): the wheel, the cooldown and the lock, the bench recharge,
// hand-offs and the linger, fresh legs once per airtime, the spectrum ring, roster limits and co-op.
import { describe, expect, it } from "vitest";
import { clearTag, requestTag, tagForKey, tagIndexOf, takeTag } from "./tagInput";
import {
   BENCH_RECHARGE,
   TAG_COOLDOWN_MS,
   HANDOFF_MS,
   HERO_OF_COLOUR,
   TAG_COLOUR,
   activeColour,
   createTagState,
   freshLegs,
   fullPrism,
   isHandOff,
   lingering,
   neighbour,
   noteSpectrum,
   prismLock,
   stepTagMs,
   tagTo,
   usePowerTag,
} from "./rules";

describe("hero tag-switch", () => {
   it("the active hero's colour is the player's colour; the wheel runs R -> B -> G -> Y -> P from the lead", () => {
      const s = createTagState({ lead: "kiro" });
      expect(activeColour(s)).toBe("green");
      expect(neighbour(s, 1)).toBe("zuno");
      expect(neighbour(s, -1)).toBe("nami");
      expect(tagTo(s, "next", 1000)).toEqual({ ok: true, handOff: false });
      expect(s.active).toBe("zuno");
      for (const h of Object.keys(TAG_COLOUR) as (keyof typeof TAG_COLOUR)[]) expect(HERO_OF_COLOUR[TAG_COLOUR[h]]).toBe(h);
   });

   it("a 0.5 s global cooldown after every tag, a Prism Lock blocks tagging, the same hero is no tag", () => {
      const s = createTagState({ lead: "riko" });
      expect(tagTo(s, "nami", 1000).ok).toBe(true);
      expect(tagTo(s, "kiro", 1400)).toEqual({ ok: false, reason: "cooldown" });
      expect(tagTo(s, "kiro", 1500).ok).toBe(true);
      expect(tagTo(s, "kiro", 3000)).toEqual({ ok: false, reason: "same" });
      prismLock(s, 3000, 2000);
      expect(tagTo(s, "riko", 4999)).toEqual({ ok: false, reason: "locked" });
      expect(tagTo(s, "riko", 5000).ok).toBe(true);
   });

   it("a restricted roster (a teaching level) keeps the lead and never tags outside it", () => {
      const s = createTagState({ lead: "nami", roster: ["riko"] });
      expect(s.roster).toEqual(["riko", "nami"]);
      expect(tagTo(s, "zuno", 1000)).toEqual({ ok: false, reason: "roster" });
      expect(tagTo(s, "next", 1000)).toEqual({ ok: true, handOff: false });
      expect(s.active).toBe("riko");
   });

   it("the bench recharges 2x faster than the active hero", () => {
      const s = createTagState({ lead: "riko" });
      expect(usePowerTag(s, 0, 300, 3000)).toBe(true);
      expect(usePowerTag(s, 1, 300, 3000)).toBe(false);
      for (let t = 0; t < 1000; t++) stepTagMs(s);
      expect(s.cooldown.riko).toBe(2000);
      tagTo(s, "nami", 1000);
      for (let t = 0; t < 1000; t++) stepTagMs(s);
      expect(s.cooldown.riko).toBe(0);
   });

   it("hand-off: a tag while the power is on or within 0.4 s after; the outgoing effect lingers 0.3 s", () => {
      const s = createTagState({ lead: "kiro" });
      usePowerTag(s, 1000, 1500, 5000);
      expect(isHandOff(s, 2500 + HANDOFF_MS)).toBe(true);
      expect(isHandOff(s, 2500 + HANDOFF_MS + 1)).toBe(false);
      expect(tagTo(s, "zuno", 2600)).toEqual({ ok: true, handOff: true });
      expect(lingering(s, "kiro", 2800)).toBe(true);
      expect(lingering(s, "kiro", 2901)).toBe(false);
      expect(s.handOffs).toBe(1);
   });

   it("fresh legs: one fresh air action per airtime, only for a hero tagged in mid-air", () => {
      const s = createTagState({ lead: "riko" });
      expect(freshLegs(s, 1, false)).toBe(false);
      expect(freshLegs(s, 1, true)).toBe(true);
      expect(freshLegs(s, 1, true)).toBe(false);
      expect(freshLegs(s, 2, true)).toBe(true);
   });

   it("the spectrum ring lights a segment per distinct hero in a window; five is a Full Prism", () => {
      const s = createTagState({ lead: "riko" });
      expect(noteSpectrum(s, "riko", false)).toBe(1);
      expect(noteSpectrum(s, "riko", true)).toBe(1);
      for (const h of ["nami", "kiro", "zuno", "vexa"] as const) noteSpectrum(s, h, true);
      expect(fullPrism(s)).toBe(true);
      expect(noteSpectrum(s, "nami", false)).toBe(1);
   });

   it("co-op: a cycle skips heroes other players own; a direct tag to one is refused", () => {
      const s = createTagState({ lead: "riko" });
      expect(tagTo(s, "nami", 1000, ["nami"])).toEqual({ ok: false, reason: "taken" });
      expect(tagTo(s, "next", 1000, ["nami", "kiro"]).ok).toBe(true);
      expect(s.active).toBe("zuno");
   });
});


describe("tag input (keys 1-5, T, the portrait strip)", () => {
   it("maps physical keys to requests and latches one request until taken", () => {
      expect(tagForKey("Digit1")).toBe("riko");
      expect(tagForKey("Numpad5")).toBe("vexa");
      expect(tagForKey("KeyT")).toBe("next");
      expect(tagForKey("KeyT", true)).toBe("prev");
      expect(tagForKey("KeyT", true, { shiftPrev: false })).toBe("next");
      expect(tagForKey("Digit6")).toBeNull();
      expect(tagForKey("KeyE")).toBeNull();
      expect(tagIndexOf("kiro")).toEqual({ hero: 2, cycle: 0 });
      expect(tagIndexOf("next")).toEqual({ hero: -1, cycle: 1 });
      expect(tagIndexOf("prev")).toEqual({ hero: -1, cycle: -1 });
      clearTag();
      expect(takeTag()).toBeNull();
      requestTag("kiro");
      requestTag("zuno");
      expect(takeTag()).toBe("zuno");
      expect(takeTag()).toBeNull();
   });

   it("the defaults are the named constants", () => {
      const s = createTagState({ lead: "riko" });
      expect(s.tagCooldownMs).toBe(TAG_COOLDOWN_MS);
      expect(s.benchRecharge).toBe(BENCH_RECHARGE);
   });
});
