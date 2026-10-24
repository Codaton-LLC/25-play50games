// Phone landscape with the cookie banner open: the fitted camera keeps goblins >= 24 CSS px tall.
// Rects as measured in the headless playtest (shell chips, Mute / Pause, the HUD's left column,
// Rock, banner). The old one-row panel (to x 594) pushed the camera back to ~20 px goblins.
import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { fitView, type ScreenRect } from "@/arcade3d/core/view";
import { FOCUS, VIEW } from "./camera";
import { pointAt } from "@/arcade3d/core/path";
import { LANES } from "./rules";

const rect = (left: number, top: number, right: number, bottom: number): ScreenRect => ({ left, top, right, bottom });
const W = 844, H = 390, GOBLIN_H = 1.6;
const SHELL = [rect(10, 10, 68, 52), rect(74, 10, 137, 52), rect(143, 10, 200, 52), rect(W - 104, 10, W - 60, 54), rect(W - 54, 10, W - 10, 54)];
const ROCK = rect(W - 92, 213, W - 20, 285), BANNER = rect(0, 305, W, H);

/** On-screen height (CSS px) of a standing goblin at (0, z) from the fitted camera. */
function goblinPx(avoid: ScreenRect[], z: number): number {
   const view = fitView({ ...VIEW, width: W, height: H, avoid });
   const cam = new PerspectiveCamera(VIEW.fov, W / H, 0.1, 1000);
   const flat = Math.cos(VIEW.pitch) * view.distance;
   cam.position.set(FOCUS.x, FOCUS.y + Math.sin(VIEW.pitch) * view.distance, FOCUS.z + flat);
   cam.lookAt(FOCUS.x, FOCUS.y, FOCUS.z);
   cam.updateMatrixWorld();
   const foot = new Vector3(0, 0, z).project(cam), head = new Vector3(0, GOBLIN_H, z).project(cam);
   return ((head.y - foot.y) / 2) * H;
}

describe("castle fit, 844 x 390 landscape, banner open", () => {
   it("keeps the farthest goblin (lane start) at least 24 CSS px tall", () => {
      const spawnZ = pointAt(LANES[1], 0).z;
      expect(goblinPx([...SHELL, rect(12, 55, 168, 172), ROCK, BANNER], spawnZ)).toBeGreaterThanOrEqual(24);
      // the old full-width row is what shrank them
      expect(goblinPx([...SHELL, rect(12, 55, 594, 84), ROCK, BANNER], spawnZ)).toBeLessThan(24);
   });
});
