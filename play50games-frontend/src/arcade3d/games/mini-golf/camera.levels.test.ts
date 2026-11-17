import { expect, it } from "vitest";
import { fitView } from "../../core/view";
import { buildHole } from "./course";
import { FOV, MIN_PX_PER_M, feltRects, fixedView, followViews, minPxPerMetre, pickCamera } from "./looks";
import { BALL, CUP } from "./physics";

// the master holes (specs 6-8) and the level holes (specs 9-14: ramp, windmill and neon layouts)
for (let h = 6; h < 15; h++) it(`spec ${h}: felt and fitted camera work on desktop and both phone orientations`, () => {
   for (const mirrored of [false, true]) for (const [width, height] of [[1280, 800], [390, 844], [844, 390]]) {
      const hole = buildHole(h, mirrored), bottom = height - 122;
      const screen = { width, height, fov: FOV, avoid: [
         { left: 0, top: 0, right: width, bottom: 56 },
         { left: 12, top: bottom - 46, right: 226, bottom },
         { left: 0, top: height - 110, right: width, bottom: height },
      ] };
      const o = fixedView(hole), fixed = fitView({ ...o, ...screen });
      const fixedPx = minPxPerMetre(o, fixed, width, height);
      const follows = followViews(hole).map(f => minPxPerMetre(f.options, fitView({ ...f.options, ...screen }), width, height, f.window));
      const pick = pickCamera(fixedPx, follows), px = pick < 0 ? fixedPx : follows[pick];
      expect(px).toBeGreaterThanOrEqual(MIN_PX_PER_M);
      expect(px * 2 * BALL.drawnRadius).toBeGreaterThanOrEqual(10);
      expect(px * 2 * CUP.drawnRadius).toBeGreaterThanOrEqual(14);
      expect(feltRects(hole).length).toBeGreaterThanOrEqual(1);
   }
});
