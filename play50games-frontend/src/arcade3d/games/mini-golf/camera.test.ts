// The cameras (pure fitView, the math useFittedView runs): every hole in view at the three test
// sizes with the banner open and closed, and the size rule on phones (ball >= 10 px, cup >= 14 px,
// banner open): the fixed view where it holds, else the gentle follow (README "Size rule").
import { describe, expect, it } from "vitest";
import { fitView, type ScreenRect } from "@/arcade3d/core/view";
import { HOLE_COUNT, buildHole } from "./course";
import { FOV, MIN_PX_PER_M, fixedView, followView, minPxPerMetre } from "./looks";
import { BALL, CUP } from "./physics";

/** The shell HUD strip, the game's power / scorecard panel (Hud.module.css) and the cookie banner. */
function avoid(width: number, height: number, banner: number): ScreenRect[] {
   const bottom = height - banner - 12;
   return [
      { left: 0, top: 0, right: width, bottom: 56 },
      { left: 12, top: bottom - 46, right: 12 + 214, bottom },
      ...(banner > 0 ? [{ left: 0, top: height - banner, right: width, bottom: height }] : []),
   ];
}

function views(index: number, mirrored: boolean, width: number, height: number, banner: number) {
   const hole = buildHole(index, mirrored);
   const fixedOpts = fixedView(hole);
   const fixed = fitView({ ...fixedOpts, width, height, fov: FOV, avoid: avoid(width, height, banner) });
   const followOpts = followView(hole);
   const follow = fitView({ ...followOpts, width, height, fov: FOV, avoid: avoid(width, height, banner) });
   const fixedPx = minPxPerMetre(fixedOpts, fixed, width, height);
   const followPx = minPxPerMetre(followOpts, follow, width, height);
   return { fixed, follow, fixedPx, followPx, useFollow: fixedPx < MIN_PX_PER_M };
}

describe("mini-golf cameras", () => {
   it("the size rule's scale: 56 px/m draws the 0.18 m ball 10 px and the 0.26 m cup 14 px", () => {
      expect(MIN_PX_PER_M * 2 * BALL.drawnRadius).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(MIN_PX_PER_M * 2 * CUP.drawnRadius).toBeGreaterThanOrEqual(14 - 1e-9);
   });

   for (const [w, h] of [[390, 844], [844, 390]]) {
      it(`every hole meets the size rule at ${w} x ${h} with the banner open (fixed view, or the follow)`, () => {
         const rows: string[] = [];
         for (let i = 0; i < HOLE_COUNT; i++) {
            for (const mirrored of [false, true]) {
               const v = views(i, mirrored, w, h, 110);
               const px = v.useFollow ? v.followPx : v.fixedPx;
               expect(px, `hole ${i + 1} ${v.useFollow ? "follow" : "fixed"}`).toBeGreaterThanOrEqual(MIN_PX_PER_M);
               if (!mirrored) rows.push(`${i + 1}:${v.useFollow ? "follow" : "fixed"} ball ${(px * 2 * BALL.drawnRadius).toFixed(1)} cup ${(px * 2 * CUP.drawnRadius).toFixed(1)}`);
            }
         }
         // eslint-disable-next-line no-console
         console.log(`${w}x${h}`, rows.join(" | "));
      });
   }

   it("desktop (1280 x 800) shows every whole hole with the fixed view, banner open or closed", () => {
      for (let i = 0; i < HOLE_COUNT; i++) {
         for (const banner of [0, 110]) expect(views(i, false, 1280, 800, banner).useFollow, `hole ${i + 1}`).toBe(false);
      }
   });
});
