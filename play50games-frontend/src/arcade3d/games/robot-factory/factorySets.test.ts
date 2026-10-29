// Each level's own bay (factorySets.ts): every prop stands outside PLAY_BOUNDS and hides no gameplay
// target from the fitted camera on any viewport; the five bays differ in light, screens and props.
import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { fitView } from "@/arcade3d/core/view";
import { LEVEL_IDS } from "@/arcade3d/types";
import { CAMERA, FOCUS, viewFor } from "./camera";
import { FACTORY_PROPS, FACTORY_THEMES, SPARK_SPOTS } from "./factorySets";
import { PLAY_BOUNDS } from "./looks";

const TARGETS = [
   new Vector3(0, 0.9, 0), new Vector3(-2.2, 0.9, 0), new Vector3(2.2, 0.9, 0),
   new Vector3(0, 0.9, -1.0), new Vector3(-2.2, 0.9, -1.0), new Vector3(2.2, 0.9, -1.0),
   new Vector3(0, 1.6, 0.6), new Vector3(2.6, 1.0, -0.5),
];

describe("robot-factory level bays", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: every prop stands outside the play area and hides nothing from the camera`, () => {
         for (const p of FACTORY_PROPS[id]) {
            const outside = p.x + p.hw <= PLAY_BOUNDS.xMin || p.x - p.hw >= PLAY_BOUNDS.xMax || p.z + p.hd <= PLAY_BOUNDS.zMin || p.z - p.hd >= PLAY_BOUNDS.zMax;
            expect(outside, `${p.kind} at (${p.x}, ${p.z})`).toBe(true);
            for (const [w, h] of [[1280, 800], [390, 844], [844, 390]]) {
               const view = fitView({ ...viewFor(w, h), fov: viewFor(w, h).fov ?? CAMERA.fov, width: w, height: h });
               const cam = new Vector3(FOCUS.x + view.offset[0], FOCUS.y + view.offset[1], FOCUS.z + view.offset[2]);
               for (const t of TARGETS) {
                  const q = new Vector3();
                  for (let i = 0; i <= 200; i++) {
                     q.lerpVectors(cam, t, i / 200);
                     const inside = q.y >= 0 && q.y <= p.h && Math.abs(q.x - p.x) <= p.hw && Math.abs(q.z - p.z) <= p.hd;
                     expect(inside, `${p.kind} at (${p.x}, ${p.z}) hides (${t.x}, ${t.y}, ${t.z}) at ${w}x${h}`).toBe(false);
                  }
               }
            }
         }
         for (const s of SPARK_SPOTS) expect(s.z).toBeLessThan(PLAY_BOUNDS.zMin);
      });
   }

   it("the five bays differ: light, screens and props; level 1 is today's", () => {
      expect(FACTORY_THEMES[1]).toMatchObject({ lighting: "indoor", background: "#0f172a", screen: "telemetry", accent: null, alarm: false });
      expect(FACTORY_PROPS[1]).toHaveLength(0);
      expect(new Set(LEVEL_IDS.map((id) => FACTORY_THEMES[id].screen)).size).toBe(5);
      expect(new Set(LEVEL_IDS.map((id) => FACTORY_THEMES[id].background)).size).toBe(5);
      expect(FACTORY_THEMES[5].alarm).toBe(true);
      expect(FACTORY_PROPS[4].some((p) => p.kind === "rack")).toBe(true);
   });
});
