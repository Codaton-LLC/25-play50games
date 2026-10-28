import { describe, expect, it } from "vitest";
import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack } from "three";
import { HERO_SCALE } from "./assets";
import { JOG_DOWN, JOG_UP, STILL, WOBBLE_SECONDS, gaitFor, inPlace, strideRate, wobble } from "./heroAnim";

const walk = () => new AnimationClip("HumanWalking", 1, [
   new VectorKeyframeTrack("Hips.position", [0, 0.5, 1], [0, 0.7, 0.1, 0.02, 0.66, 0.7, 0, 0.7, 1.3]),
   new QuaternionKeyframeTrack("Spine.quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
]);

describe("tidy-up robot clips", () => {
   it("inPlace strips the hips' straight-line drift, keeps the bob and reports the clip's root speed", () => {
      const source = walk();
      const { clip, speed } = inPlace(source);
      expect(speed).toBeCloseTo(1.2, 6);
      const v = clip.tracks.find((t) => t.name === "Hips.position")!.values;
      expect(v[2]).toBeCloseTo(0.1, 6);
      expect(v[8]).toBeCloseTo(0.1, 6); // ends where it started
      expect(v[5]).toBeCloseTo(0.7 - 0.6, 6); // mid-cycle sway kept, drift removed
      expect(v[4]).toBeCloseTo(0.66, 6); // the bob stays
      // the source clip is untouched (the GLB's cached clips are shared)
      expect(source.tracks[0].values[8]).toBeCloseTo(1.3, 6);
      expect(inPlace(new AnimationClip("idle", 2, [])).speed).toBe(0);
   });

   it("matches the playback rate to the ground speed, so the planted foot stays put", () => {
      const clipSpeed = 1.2; // GLB units / s
      for (const speed of [0.8, 2, 4.4]) {
         const rate = strideRate(speed, clipSpeed, HERO_SCALE);
         // root travel per second at that rate = the ground speed
         expect(rate * clipSpeed * HERO_SCALE).toBeCloseTo(speed, 6);
      }
      expect(strideRate(0, clipSpeed, HERO_SCALE)).toBe(0.35);
      expect(strideRate(1, 0, HERO_SCALE)).toBe(1);
   });

   it("idle when still, walk / jog by speed with hysteresis", () => {
      expect(gaitFor(STILL / 2, "walk")).toBe("idle");
      expect(gaitFor(1, "idle")).toBe("walk");
      expect(gaitFor(JOG_UP + 0.1, "walk")).toBe("jog");
      expect(gaitFor((JOG_UP + JOG_DOWN) / 2, "jog")).toBe("jog");
      expect(gaitFor((JOG_UP + JOG_DOWN) / 2, "walk")).toBe("walk");
      expect(gaitFor(JOG_DOWN - 0.1, "jog")).toBe("walk");
   });

   it("the stun wobble dies out", () => {
      expect(wobble(-1)).toBe(0);
      expect(wobble(WOBBLE_SECONDS)).toBe(0);
      expect(Math.abs(wobble(0.05))).toBeGreaterThan(0.1);
      expect(Math.abs(wobble(WOBBLE_SECONDS * 0.95))).toBeLessThan(0.01);
   });
});
