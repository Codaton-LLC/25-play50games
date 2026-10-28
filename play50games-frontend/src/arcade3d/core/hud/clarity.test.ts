// The clarity pieces' pure parts: TargetBeacon's motion and size floor, HintLine's timing and the
// HUD signal, the toss arc and the pop styles.
import { describe, expect, it } from "vitest";
import { BEACON_MAX_SCALE, BEACON_STYLES, beaconLabel, beaconMotion, beaconScale, type BeaconMotion } from "./beacon";
import { EMPTY_HINT, HINT_AGAIN_MS, HINT_FIRST_MS, createHudSignal, hintVisible, nextHintMark, sameHint, type HintState } from "./hintTiming";
import { createToss, startToss, stepToss, tossAt, type TossFrame } from "../fx/tossArc";
import { POP_STYLES } from "../fx/actionPop";

const motion = (): BeaconMotion => ({ bob: 0, pulse: 0, pulseOpacity: 0, ringOpacity: 0 });

describe("beaconMotion", () => {
   it("bobs and pulses inside its bounds for every variant", () => {
      for (const variant of ["pick", "drop-here", "danger"] as const) {
         const out = motion();
         for (let t = 0; t < 4; t += 0.037) {
            beaconMotion(t, variant, false, out);
            expect(Math.abs(out.bob)).toBeLessThanOrEqual(BEACON_STYLES[variant].bob + 1e-9);
            expect(out.pulse).toBeGreaterThanOrEqual(1 - 1e-9);
            expect(out.pulse).toBeLessThanOrEqual(1.8 + 1e-9);
            expect(out.pulseOpacity).toBeGreaterThanOrEqual(0);
            expect(out.pulseOpacity).toBeLessThanOrEqual(0.7 + 1e-9);
            expect(out.ringOpacity).toBeGreaterThan(0.4);
         }
      }
   });

   it("pick pulses outward, drop-here inward onto the spot", () => {
      const a = beaconMotion(0.05, "pick", false, motion()).pulse;
      const b = beaconMotion(0.5, "pick", false, motion()).pulse;
      expect(b).toBeGreaterThan(a);
      const c = beaconMotion(0.05, "drop-here", false, motion()).pulse;
      const d = beaconMotion(0.5, "drop-here", false, motion()).pulse;
      expect(d).toBeLessThan(c);
   });

   it("holds still with reduced motion", () => {
      const out = motion();
      for (const t of [0, 0.3, 1.7]) {
         beaconMotion(t, "pick", true, out);
         expect(out.bob).toBe(0);
         expect(out.pulse).toBe(1);
         expect(out.pulseOpacity).toBe(0);
      }
   });

   it("danger has no arrow (keep away), pick and drop-here do", () => {
      expect(BEACON_STYLES.danger.arrow).toBe(false);
      expect(BEACON_STYLES.pick.arrow).toBe(true);
      expect(BEACON_STYLES["drop-here"].arrow).toBe(true);
   });
});

describe("beaconScale", () => {
   it("keeps the world size near the camera", () => {
      expect(beaconScale(3, 50, 800, 26)).toBe(1);
   });

   it("grows far away so the arrow stays at least minPx tall", () => {
      const s = beaconScale(40, 50, 844, 34, 0.62);
      const worldPerPx = (2 * 40 * Math.tan((50 * Math.PI) / 360)) / 844;
      expect((0.62 * s) / worldPerPx).toBeGreaterThanOrEqual(34 - 1e-6);
   });

   it("grows more on a touch screen's larger floor and is capped", () => {
      expect(beaconScale(30, 50, 844, 34)).toBeGreaterThan(beaconScale(30, 50, 844, 26));
      expect(beaconScale(1000, 50, 844, 34)).toBe(BEACON_MAX_SCALE);
   });

   it("is 1 for a bad input (orthographic camera: fov 0)", () => {
      expect(beaconScale(20, 0, 800, 26)).toBe(1);
      expect(beaconScale(NaN, 50, 800, 26)).toBe(1);
   });
});

describe("beaconLabel", () => {
   it("shows numbers and trims long names", () => {
      expect(beaconLabel(3)).toBe("3");
      expect(beaconLabel(null)).toBe("");
      expect(beaconLabel("  Milk ")).toBe("Milk");
      expect(beaconLabel("A very long product name").length).toBe(14);
   });
});

describe("HintLine timing", () => {
   it("shows the first hint for HINT_FIRST_MS from the countdown on", () => {
      const mark = nextHintMark(null, "a", 1, 0);
      expect(hintVisible("countdown", 0, mark)).toBe(true);
      expect(hintVisible("playing", HINT_FIRST_MS - 1, mark)).toBe(true);
      expect(hintVisible("playing", HINT_FIRST_MS, mark)).toBe(false);
   });

   it("shows a new objective again for HINT_AGAIN_MS, then hides it", () => {
      const first = nextHintMark(null, "a", 1, 0);
      expect(nextHintMark(first, "a", 1, 12000)).toBe(first);
      const next = nextHintMark(first, "b", 1, 12000);
      expect(next).toEqual({ key: "b", runId: 1, atMs: 12000, first: false });
      expect(hintVisible("playing", 12000, next)).toBe(true);
      expect(hintVisible("playing", 12000 + HINT_AGAIN_MS - 1, next)).toBe(true);
      expect(hintVisible("playing", 12000 + HINT_AGAIN_MS, next)).toBe(false);
   });

   it("starts over on a new run and after Back to the levels (elapsed went back)", () => {
      const old = nextHintMark(nextHintMark(null, "a", 1, 0), "b", 1, 20000);
      expect(nextHintMark(old, "b", 2, 0)).toEqual({ key: "b", runId: 2, atMs: 0, first: true });
      expect(nextHintMark(old, "b", 1, 0).first).toBe(true);
   });

   it("is hidden on the start card and the result, and a sticky hint stays up", () => {
      const mark = nextHintMark(null, "a", 1, 0);
      expect(hintVisible("ready", 0, mark)).toBe(false);
      expect(hintVisible("over", 0, mark)).toBe(false);
      expect(hintVisible("paused", 100000, mark, true)).toBe(true);
   });
});

describe("createHudSignal", () => {
   it("notifies only on a real change", () => {
      const signal = createHudSignal<HintState>(EMPTY_HINT, sameHint);
      let calls = 0;
      const off = signal.subscribe(() => (calls += 1));
      signal.set({ text: "Grab the key", key: "k0" });
      signal.set({ text: "Grab the key", key: "k0" });
      expect(calls).toBe(1);
      signal.set({ text: "Grab the key", key: "k0", tone: "carry" });
      expect(calls).toBe(2);
      signal.reset();
      expect(signal.get()).toBe(EMPTY_HINT);
      expect(calls).toBe(3);
      off();
      signal.set({ text: "x" });
      expect(calls).toBe(3);
   });
});

describe("toss", () => {
   const out = (): TossFrame => ({ x: 0, y: 0, z: 0, scale: 0 });

   it("starts at the item, arcs above the line and lands on the live target", () => {
      const from = { x: 0, y: 1, z: 0 };
      const to = { x: 4, y: 1, z: 0 };
      expect(tossAt(from, to, 0, 1, 1, 0.5, out())).toEqual({ x: 0, y: 1, z: 0, scale: 1 });
      expect(tossAt(from, to, 0.5, 1, 1, 0.5, out()).y).toBeCloseTo(2, 6);
      expect(tossAt(from, to, 1, 1, 1, 0.5, out())).toEqual({ x: 4, y: 1, z: 0, scale: 0.5 });
   });

   it("follows a moving target and ends after its duration", () => {
      const state = createToss();
      const hand = { x: 2, y: 1, z: 0 };
      startToss(state, { x: 0, y: 0, z: 0 }, hand, { duration: 0.4 });
      const f = out();
      let steps = 0;
      while (stepToss(state, 0.05, f)) {
         hand.x += 0.1;
         steps += 1;
         if (steps > 50) break;
      }
      expect(steps).toBe(8);
      expect(f.x).toBeCloseTo(hand.x - 0.1, 6);
      expect(state.active).toBe(false);
   });

   it("copies the start point (the item may be reused)", () => {
      const state = createToss();
      const from = { x: 1, y: 2, z: 3 };
      startToss(state, from, { x: 0, y: 0, z: 0 });
      from.x = 99;
      expect(state.from.x).toBe(1);
   });
});

describe("POP_STYLES", () => {
   it("a fail pop reads differently from a success pop", () => {
      expect(POP_STYLES.fail.color).not.toBe(POP_STYLES.good.color);
      expect(POP_STYLES.fail.puff).toBeGreaterThan(0);
      expect(POP_STYLES.good.shake).toBe(0);
   });
});
