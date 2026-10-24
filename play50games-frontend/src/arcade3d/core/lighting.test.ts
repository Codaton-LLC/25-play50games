import { readFileSync } from "node:fs";
import path from "node:path";
import { Color } from "three";
import { describe, expect, it } from "vitest";
import {
   LIGHTING_PRESETS,
   copyLighting,
   createLightingValues,
   createStageLighting,
   lerpLighting,
   lightingPreset,
   requestStageLighting,
   resetStageLighting,
   setStageEnvironment,
   stepStageLighting,
   type LightingValues,
} from "./lighting";

const hex = (c: Color) => `#${c.getHexString()}`;

function expectValues(v: LightingValues, w: LightingValues) {
   expect(v.ambientIntensity).toBeCloseTo(w.ambientIntensity, 9);
   expect(v.hemisphereIntensity).toBeCloseTo(w.hemisphereIntensity, 9);
   expect(v.sunIntensity).toBeCloseTo(w.sunIntensity, 9);
   for (const key of ["skyColor", "groundColor", "sunColor", "background", "fog"] as const) expect(hex(v[key])).toBe(hex(w[key]));
   expect(v.sunPosition.distanceTo(w.sunPosition)).toBeLessThan(1e-9);
}

describe("lighting presets", () => {
   it("keeps the values ShellStage always drew", () => {
      expect(Object.keys(LIGHTING_PRESETS).sort()).toEqual(["day", "indoor", "night", "snow", "space", "sunset"]);
      const day = lightingPreset("day");
      expect([day.ambientIntensity, day.hemisphereIntensity, day.sunIntensity]).toEqual([0.2, 1.1, 1.6]);
      expect([hex(day.skyColor), hex(day.groundColor), hex(day.sunColor)]).toEqual(["#e0f2fe", "#334155", "#ffffff"]);
      expect(day.sunPosition.toArray()).toEqual([6, 10, 4]);
      const sunset = lightingPreset("sunset", createLightingValues(), "#123456");
      expect(sunset.sunPosition.toArray()).toEqual([-8, 4, 3]);
      expect([hex(sunset.background), hex(sunset.fog)]).toEqual(["#123456", "#123456"]);
      // an unknown name falls back to day, like the old switch's default branch
      expectValues(lightingPreset("bogus" as "day"), day);
   });

   it("lerps every value: k = 0, 1, 0.5 and clamped", () => {
      const day = lightingPreset("day");
      const night = lightingPreset("night");
      const out = createLightingValues();
      expectValues(lerpLighting(day, night, 0, out), day);
      expectValues(lerpLighting(day, night, 1, out), night);
      expectValues(lerpLighting(day, night, 2, out), night);
      expectValues(lerpLighting(day, night, -1, out), day);
      lerpLighting(day, night, 0.5, out);
      expect(out.ambientIntensity).toBeCloseTo((0.2 + 0.15) / 2, 9);
      expect(out.sunIntensity).toBeCloseTo((1.6 + 0.75) / 2, 9);
      expect(out.sunPosition.toArray()).toEqual([1, 9, 3]);
      // colours mix per channel in the working (linear) space
      const sky = new Color().lerpColors(day.skyColor, night.skyColor, 0.5);
      expect(out.skyColor.r).toBeCloseTo((day.skyColor.r + night.skyColor.r) / 2, 9);
      expect(hex(out.skyColor)).toBe(hex(sky));
   });

   it("writes into out without allocating: the same objects come back", () => {
      const day = lightingPreset("day");
      const snow = lightingPreset("snow");
      const out = createLightingValues();
      const parts = [out.skyColor, out.groundColor, out.sunColor, out.sunPosition, out.background, out.fog];
      expect(lerpLighting(day, snow, 0.3, out)).toBe(out);
      expect(lightingPreset("space", out)).toBe(out);
      expect(copyLighting(day, out)).toBe(out);
      parts.forEach((part, i) => expect(part).toBe([out.skyColor, out.groundColor, out.sunColor, out.sunPosition, out.background, out.fog][i]));
      // lerp in place: out = from
      lerpLighting(out, snow, 1, out);
      expectValues(out, snow);
   });
});

describe("stage lighting crossfade", () => {
   const environment = { background: "#bae6fd", fog: ["#bae6fd", 30, 70] as [string, number, number], lighting: "day" as const };

   it("fades on the given clock and stops at the target", () => {
      const stage = createStageLighting();
      setStageEnvironment(stage, environment);
      expect(stepStageLighting(stage, 0)).toBe(true); // the first frame copies the base
      expect(stepStageLighting(stage, 0)).toBe(false); // nothing to do afterwards
      expect(hex(stage.current.background)).toBe("#bae6fd");
      const base = copyLighting(stage.current, createLightingValues());
      requestStageLighting(stage, "sunset", 1.5, 10);
      const sunset = lightingPreset("sunset");
      expect(stepStageLighting(stage, 10)).toBe(true);
      expectValues(stage.current, base);
      stepStageLighting(stage, 10.75);
      expectValues(stage.current, lerpLighting(base, sunset, 0.5, createLightingValues()));
      // a paused clock does not advance the fade
      stepStageLighting(stage, 10.75);
      expect(stage.active).toBe(true);
      stepStageLighting(stage, 11.5);
      expectValues(stage.current, sunset);
      expect(stage.active).toBe(false);
      expect(stepStageLighting(stage, 20)).toBe(false);
      // a zero fade jumps; null fades back to the environment's own background and fog
      requestStageLighting(stage, null, 0, 20);
      expect(stepStageLighting(stage, 20)).toBe(true);
      expectValues(stage.current, base);
   });

   it("a mid-fade request starts from the current values; the environment's preset keeps its colours", () => {
      const stage = createStageLighting();
      setStageEnvironment(stage, environment);
      stepStageLighting(stage, 0);
      requestStageLighting(stage, "night", 1, 0);
      stepStageLighting(stage, 0.5);
      const mid = copyLighting(stage.current, createLightingValues());
      requestStageLighting(stage, "day", 2, 0.5);
      stepStageLighting(stage, 0.5);
      expectValues(stage.current, mid);
      stepStageLighting(stage, 2.5);
      expectValues(stage.current, stage.base);
      expect(hex(stage.current.fog)).toBe("#bae6fd");
   });

   it("resets to environment.lighting on remount (Retry)", () => {
      const stage = createStageLighting();
      setStageEnvironment(stage, environment);
      stepStageLighting(stage, 0);
      requestStageLighting(stage, "sunset", 1.5, 3);
      stepStageLighting(stage, 3.6);
      expect(stage.active).toBe(true);
      resetStageLighting(stage); // the hook's unmount cleanup
      expect(stage.active).toBe(false);
      expect(stage.time).toBeNull();
      expect(stepStageLighting(stage, 0)).toBe(true);
      expectValues(stage.current, lightingPreset("day", createLightingValues(), "#bae6fd"));
   });

   it("ShellStage draws one ambient, one hemisphere and one directional light", () => {
      const source = readFileSync(path.join(__dirname, "ShellStage.tsx"), "utf8");
      expect(source.match(/<ambientLight\b/g)).toHaveLength(1);
      expect(source.match(/<hemisphereLight\b/g)).toHaveLength(1);
      expect(source.match(/<directionalLight\b/g)).toHaveLength(1);
   });
});
