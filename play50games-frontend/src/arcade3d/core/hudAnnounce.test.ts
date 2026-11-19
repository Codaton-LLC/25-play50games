// The HUD's spoken status (hudAnnounce.ts): lives lost, the 30 / 10 second marks, objective progress.
import { describe, expect, it } from "vitest";
import { hudAnnouncement, type HudSnapshot } from "./hudAnnounce";

const snap = (over: Partial<HudSnapshot> = {}): HudSnapshot => ({ time: 60, timed: true, lives: 3, stats: {}, ...over });
const STATS = [
   { key: "batteries", label: "Batteries", max: 5 },
   { key: "combo", label: "Combo" },
];

describe("hudAnnouncement", () => {
   it("reads a lost life, singular at one", () => {
      expect(hudAnnouncement(snap(), snap({ lives: 2 }))).toEqual({ text: "2 lives left", minor: false });
      expect(hudAnnouncement(snap({ lives: 2 }), snap({ lives: 1 }))?.text).toBe("1 life left");
      expect(hudAnnouncement(snap({ lives: 1 }), snap({ lives: 2 }))).toBeNull();
   });

   it("reads the 30 and 10 second marks once, on timed runs only", () => {
      expect(hudAnnouncement(snap({ time: 31 }), snap({ time: 30 }))?.text).toBe("30 seconds left");
      expect(hudAnnouncement(snap({ time: 30 }), snap({ time: 29 }))).toBeNull();
      expect(hudAnnouncement(snap({ time: 11 }), snap({ time: 10 }))).toEqual({ text: "10 seconds left", minor: false });
      expect(hudAnnouncement(snap({ time: 1 }), snap({ time: 0 }))).toBeNull();
      expect(hudAnnouncement(snap({ timed: false, time: 9 }), snap({ timed: false, time: 10 }))).toBeNull();
   });

   it("reads progress on a stat with a target; the last one is never dropped", () => {
      const a = snap({ stats: { batteries: 2 } });
      expect(hudAnnouncement(a, snap({ stats: { batteries: 3 } }), STATS)).toEqual({ text: "Batteries 3 of 5", minor: true });
      expect(hudAnnouncement(a, snap({ stats: { batteries: 5 } }), STATS)).toEqual({ text: "Batteries 5 of 5", minor: false });
      expect(hudAnnouncement(snap(), snap({ stats: { combo: 4 } }), STATS)).toBeNull();
   });

   it("says nothing when nothing that matters changed", () => {
      expect(hudAnnouncement(snap(), snap({ time: 59 }), STATS)).toBeNull();
   });
});
