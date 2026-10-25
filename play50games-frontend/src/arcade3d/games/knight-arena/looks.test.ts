import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { LIGHTING_PRESETS } from "../../core/lighting";
import { fitView, setLensShift, type ScreenRect } from "../../core/view";
import {
   COLORS,
   DECOR,
   DECOR_LOCAL,
   FIT,
   GROUND,
   LEVEL_LOOKS,
   PLAY_BOUNDS,
   boxHitsPlay,
   contrastRatio,
   decorAABB,
   decorOf,
   inPlayArea,
   luminance,
   segmentHitsBox,
} from "./looks";
import { ARENA, COLORS as CUE, POSTS } from "./rules";

const VIEWPORTS = [
   { name: "1280x800", w: 1280, h: 800 },
   { name: "390x844", w: 390, h: 844 },
   { name: "844x390", w: 844, h: 390 },
] as const;

type Hud = "bare" | "open" | "harsh";

function avoidFor(w: number, h: number, hud: Hud): ScreenRect[] {
   if (hud === "bare") return [];
   const top = hud === "harsh" ? 120 : 96;
   const bottom = hud === "harsh" ? 220 : 150;
   const rects: ScreenRect[] = [
      { left: 0, top: 0, right: w, bottom: top },
      { left: 0, top: h - bottom, right: w, bottom: h },
   ];
   if (w > h && h <= 520) {
      const column = hud === "harsh" ? 240 : 220;
      rects.push({ left: w - column, top, right: w, bottom: Math.min(h, top + 180) });
   }
   return rects;
}

function fittedCamera(w: number, h: number, hud: Hud): PerspectiveCamera {
   const view = fitView({
      width: w,
      height: h,
      fov: FIT.fov,
      area: {
         min: { x: PLAY_BOUNDS.x0, y: PLAY_BOUNDS.y0, z: PLAY_BOUNDS.z0 },
         max: { x: PLAY_BOUNDS.x1, y: PLAY_BOUNDS.y1, z: PLAY_BOUNDS.z1 },
      },
      pitch: FIT.pitch,
      yaws: FIT.yaws,
      focus: FIT.focus,
      padding: FIT.padding,
      shift: FIT.shift,
      avoid: avoidFor(w, h, hud),
   });
   const focus = FIT.focus[0];
   const cam = new PerspectiveCamera(FIT.fov, w / h, 0.1, 400);
   cam.position.set(focus.x + view.offset[0], focus.y + view.offset[1], focus.z + view.offset[2]);
   cam.lookAt(focus.x, focus.y, focus.z);
   cam.updateMatrixWorld();
   setLensShift(cam, view.shift[0], view.shift[1], w, h);
   cam.updateProjectionMatrix();
   return cam;
}

const TARGETS = [
   { name: "knight", x: 0, y: 1.1, z: 0 },
   { name: "plume", x: 0, y: 1.75, z: 0 },
   ...POSTS.flatMap((post) =>
      [0.25, 1.1, 1.85].map((y) => ({ name: `post ${post.index}`, x: post.x, y, z: post.z })),
   ),
   ...[PLAY_BOUNDS.x0, PLAY_BOUNDS.x1].flatMap((x) =>
      [PLAY_BOUNDS.z0, PLAY_BOUNDS.z1].map((z) => ({ name: "corner", x, y: 1.1, z })),
   ),
];

describe("knight-arena look", () => {
   it("uses one hex palette and the same play square as the arena radius", () => {
      for (const hex of Object.values(COLORS)) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(PLAY_BOUNDS.x1).toBe(ARENA.RADIUS_M);
      expect(PLAY_BOUNDS.z1).toBe(ARENA.RADIUS_M);
      expect(FIT.fov).toBe(45);
      expect(FIT.pitch).toBeCloseTo(Math.PI / 3);
      expect(FIT.shift).toBe(true);
   });

   it("keeps every decor spot, including its bounds, outside the play square", () => {
      expect(DECOR.length).toBeGreaterThanOrEqual(40);
      expect(decorOf("wall").length).toBeGreaterThanOrEqual(4);
      expect(decorOf("tent").length).toBeGreaterThanOrEqual(6);
      expect(decorOf("rack").length).toBeGreaterThanOrEqual(4);
      expect(decorOf("house").length).toBeGreaterThanOrEqual(5);
      expect(decorOf("hill").length).toBeGreaterThanOrEqual(8);
      expect(decorOf("tuft").length).toBeGreaterThanOrEqual(8);
      expect(decorOf("rock").length).toBeGreaterThanOrEqual(4);
      for (const spot of DECOR) {
         expect(inPlayArea(spot.x, spot.z), `${spot.kind} centre`).toBe(false);
         expect(boxHitsPlay(decorAABB(spot)), `${spot.kind} at ${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}`).toBe(false);
         expect(Number.isFinite(spot.x + spot.y + spot.z)).toBe(true);
         expect(spot.y).toBe(0);
      }
   });

   it("keeps decor, including every large mesh, off the fitted sight lines at the three sizes", () => {
      const boxes = DECOR.map((spot) => ({ spot, box: decorAABB(spot) }));
      for (const vp of VIEWPORTS) {
         for (const hud of ["bare", "open", "harsh"] as const) {
            const cam = fittedCamera(vp.w, vp.h, hud);
            const eye = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
            for (const target of TARGETS) {
               for (const { spot, box } of boxes) {
                  const hit = segmentHitsBox(eye, target, box);
                  expect(hit, `${vp.name} ${hud}: ${spot.kind} blocks ${target.name}`).toBe(false);
               }
            }
         }
      }
      // Walls, tents, houses and hills are the large meshes. Tufts and rocks share the same test.
      for (const kind of ["wall", "tent", "house", "hill"] as const) {
         expect(DECOR_LOCAL[kind].hy).toBeGreaterThan(0.8);
      }
   });

   it("covers the ground under the whole view at 1280x800, 390x844 and 844x390", () => {
      for (const vp of VIEWPORTS) {
         for (const hud of ["bare", "open", "harsh"] as const) {
            const cam = fittedCamera(vp.w, vp.h, hud);
            for (let ix = 0; ix <= 4; ix++) {
               for (const ny of [-1, -0.5, 0, 0.5, 1]) {
                  const ndcX = -1 + ix * 0.5;
                  const point = new Vector3(ndcX, ny, 0.5).unproject(cam);
                  const dir = point.sub(cam.position);
                  dir.normalize();
                  if (dir.y >= -1e-4) continue;
                  const t = (GROUND.y - cam.position.y) / dir.y;
                  expect(t, `${vp.name} ${hud} ndc ${ndcX},${ny}`).toBeGreaterThan(0);
                  expect(t, `${vp.name} ${hud} stays inside camera far`).toBeLessThan(390);
                  const x = cam.position.x + dir.x * t;
                  const z = cam.position.z + dir.z * t;
                  expect(Math.abs(x), `${vp.name} ${hud} x ${x.toFixed(1)}`).toBeLessThanOrEqual(GROUND.half);
                  expect(Math.abs(z), `${vp.name} ${hud} z ${z.toFixed(1)}`).toBeLessThanOrEqual(GROUND.half);
               }
            }
         }
      }
   });

   it("keeps the afternoon presets and a fog colour at least as bright as the definition", () => {
      const order = [1, 2, 3, 4, 5] as const;
      expect(order.map((id) => LEVEL_LOOKS[id].lighting)).toEqual(["sunset", "day", "sunset", "night", "sunset"]);
      for (const id of order) {
         expect(LEVEL_LOOKS[id].lighting in LIGHTING_PRESETS).toBe(true);
         expect(LEVEL_LOOKS[id].skyTop).toMatch(/^#[0-9a-f]{6}$/);
         expect(LEVEL_LOOKS[id].fog).toMatch(/^#[0-9a-f]{6}$/);
      }
      expect(LEVEL_LOOKS[4].background).toBe("#0b1020");
      expect(luminance(LEVEL_LOOKS[1].fog)).toBeGreaterThan(luminance("#3b2038"));
      expect(luminance(LEVEL_LOOKS[3].fog)).toBeGreaterThan(luminance("#4a2030"));
      expect(luminance(LEVEL_LOOKS[4].fog)).toBeGreaterThan(luminance("#0b1020"));
      expect(luminance(LEVEL_LOOKS[5].fog)).toBeGreaterThan(luminance("#3b1028"));
   });

   it("keeps the knight, the dummies and the cue colours readable on the sand", () => {
      // The old floor was #c7a36e. Cue rings are light on purpose (unlit); the sand must not
      // wash them out past that floor, and the armour / wood / banner stay clearly darker.
      const oldSand = "#c7a36e";
      expect(contrastRatio(COLORS.woodDark, COLORS.sand)).toBeGreaterThan(4);
      expect(contrastRatio(COLORS.banner, COLORS.sand)).toBeGreaterThan(2.5);
      expect(contrastRatio(COLORS.steelDark, COLORS.sand)).toBeGreaterThan(3);
      for (const hex of [CUE.tomato, CUE.shield, CUE.activeRing, CUE.approachRing, CUE.regular]) {
         expect(contrastRatio(hex, COLORS.sand) + 0.02).toBeGreaterThanOrEqual(contrastRatio(hex, oldSand));
      }
   });
});
