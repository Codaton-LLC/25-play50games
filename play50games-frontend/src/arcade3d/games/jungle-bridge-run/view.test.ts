// What the player sees: the triangle budget per level, the runner on screen above the cookie banner,
// and the gate row the runner passes fading so it never hides the runner.
import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { fitView, setLensShift, type ScreenRect } from "@/arcade3d/core/view";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, FIT } from "./assets";
import { LEVELS } from "./levels";
import {
   FOV,
   GATE_FADE_AFTER,
   GATE_FADE_BEFORE,
   GATE_FADE_MIN,
   LOOK_AHEAD_Z,
   PITCH,
   TILE,
   VIEW_CONFIG,
   VISIBLE_BACK,
   backdropFor,
   decorSpots,
   gateOpacity,
   gateSpots,
   pillarSpots,
   poolSize,
   trackSpots,
   visibleAhead,
} from "./looks";
import { STAND_HEIGHT, createRun } from "./rules";

/** Per frame on the high tier (decor 1): every GLB's triangles times the most copies its pool draws. */
const BUDGET = 300_000;

describe("jungle-bridge-run triangle budget", () => {
   it(`every level stays under ${BUDGET / 1000}k triangles per frame (40 seeds, the pools' largest counts)`, async () => {
      const tris: Record<string, number> = {};
      for (const [k, a] of Object.entries(ASSETS)) tris[k] = (await readCharacterGlb(a.url)).indices.length / 3;
      const report: string[] = [];
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const ahead = visibleAhead(level);
         const d = decorSpots(id, level);
         let worst = 0;
         for (let seed = 1; seed <= 40; seed++) {
            const run = createRun(seed, level, id);
            const track = trackSpots(run);
            const logs = run.sections.reduce((n, s) => n + s.obstacles.filter((o) => o.kind === "log").length, 0);
            const backdrop = backdropFor(level) ? 1 : 0;
            const total =
               tris.explorer +
               tris.deck * poolSize(track.deck, VISIBLE_BACK, ahead, TILE / 2) +
               tris.ropeBridge * poolSize(track.rope, VISIBLE_BACK, ahead, 1.5) +
               // the pooled rows plus the fading row's own three gates
               tris.gate * (poolSize(gateSpots(run), VISIBLE_BACK, ahead, 0.5) + 3) +
               tris.pillar * poolSize(pillarSpots(run), VISIBLE_BACK, ahead, 0.6) +
               tris.log * logs +
               tris.rock * d.rocks.length +
               tris.tree * d.trees.length +
               tris.fern * d.ferns.length +
               tris.plant * d.plants.length +
               tris.hangingVine * d.vines.length +
               tris.volcano * backdrop;
            worst = Math.max(worst, total);
         }
         report.push(`L${id} ${Math.round(worst / 1000)}k`);
         expect(worst, `L${id}`).toBeLessThanOrEqual(BUDGET);
      }
      console.info("jungle-bridge-run triangles per frame:", report.join(", "));
   });
});

/** Pixel position of a world point (relative to the aim) on a w x h canvas with the fitted camera. */
function projector(w: number, h: number, avoid: ScreenRect[]) {
   const fit = fitView({ ...VIEW_CONFIG, fov: FOV, width: w, height: h, avoid });
   const cam = new PerspectiveCamera(FOV, w / h, 0.1, 1000);
   cam.position.set(fit.offset[0], fit.offset[1], fit.offset[2]);
   cam.lookAt(0, 0, 0);
   cam.updateMatrixWorld();
   setLensShift(cam, fit.shift[0], fit.shift[1], w, h);
   cam.updateMatrixWorld();
   return (x: number, y: number, z: number) => {
      const p = new Vector3(x, y, z).project(cam);
      return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
   };
}

describe("jungle-bridge-run chase view", () => {
   const screens = [
      // a 390 x 844 phone with the cookie banner open (its measured strip) and the HUD's two chip rows
      { name: "p390 + banner", w: 390, h: 844, avoid: [{ left: 0, top: 0, right: 390, bottom: 110 }, { left: 0, top: 676, right: 390, bottom: 844 }] },
      { name: "p390", w: 390, h: 844, avoid: [{ left: 0, top: 0, right: 390, bottom: 110 }] },
      { name: "desk + banner", w: 1280, h: 800, avoid: [{ left: 0, top: 0, right: 1280, bottom: 60 }, { left: 0, top: 700, right: 1280, bottom: 800 }] },
      { name: "landscape phone + banner", w: 844, h: 390, avoid: [{ left: 0, top: 0, right: 844, bottom: 56 }, { left: 0, top: 300, right: 844, bottom: 390 }] },
   ];
   for (const s of screens) {
      it(`${s.name}: the runner (every lane, standing and mid-jump) is on screen clear of the banner and the HUD`, () => {
         const px = projector(s.w, s.h, s.avoid as ScreenRect[]);
         const banner = s.avoid.find((r) => r.top > 0);
         const hud = s.avoid.find((r) => r.top === 0)!;
         for (const x of [2, 0, -2]) {
            const feet = px(x, 0, -LOOK_AHEAD_Z);
            const head = px(x, STAND_HEIGHT + 1.3, -LOOK_AHEAD_Z);
            if (banner) expect(feet.y, s.name).toBeLessThan(banner.top - 24);
            expect(feet.y).toBeLessThan(s.h - 24);
            expect(head.y).toBeGreaterThan(hud.bottom);
            expect(feet.x).toBeGreaterThan(0);
            expect(feet.x).toBeLessThan(s.w);
         }
      });
   }
   it("the window keeps track under the runner (3 m) and 10 m past the aim", () => {
      expect(-LOOK_AHEAD_Z - VIEW_CONFIG.area.min.z).toBeGreaterThanOrEqual(3);
      expect(VIEW_CONFIG.focus).toEqual([{ x: 0, y: 0, z: 0 }]);
      expect(VIEW_CONFIG.pitch).toBe(PITCH);
   });
});

describe("jungle-bridge-run gate fade", () => {
   it("the gate row fades to 25 % from 4 m before the runner reaches it until 4 m past it, solid otherwise", () => {
      expect(gateOpacity(100, 100 - GATE_FADE_BEFORE)).toBe(GATE_FADE_MIN);
      expect(gateOpacity(100, 100)).toBe(GATE_FADE_MIN);
      expect(gateOpacity(100, 100 + GATE_FADE_AFTER)).toBe(GATE_FADE_MIN);
      expect(gateOpacity(100, 90)).toBe(1);
      expect(gateOpacity(100, 110)).toBe(1);
      for (let z = 90; z < 104; z += 0.05) {
         const a = gateOpacity(100, z);
         expect(a).toBeGreaterThanOrEqual(GATE_FADE_MIN);
         expect(a).toBeLessThanOrEqual(1);
      }
   });
   it("the fade covers every distance at which the gate hides the runner from the chase camera (all screens)", () => {
      // the camera is behind and above: once the runner is past a gate, the row stands between them and
      // covers the runner's chest only while the runner is less than this far past it
      for (const [w, h] of [[390, 844], [1280, 800], [844, 390]]) {
         const fit = fitView({ ...VIEW_CONFIG, fov: FOV, width: w, height: h });
         const camBack = -fit.offset[2] - LOOK_AHEAD_Z; // camera's horizontal distance behind the runner
         const camUp = fit.offset[1];
         const gateTop = FIT.gateLintel / 1.2 * 1.66; // the GLB's full height at the gate's scale
         const chest = 1.2;
         const hides = ((gateTop - chest) / (camUp - chest)) * camBack;
         expect(hides).toBeLessThanOrEqual(GATE_FADE_AFTER);
      }
   });
});
