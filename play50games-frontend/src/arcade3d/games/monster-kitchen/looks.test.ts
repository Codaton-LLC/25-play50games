import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { fitView } from "@/arcade3d/core/view";
import { LIGHTING_PRESETS } from "@/arcade3d/core/lighting";
import {
   COLORS,
   DECOR,
   LEVEL_LOOKS,
   PLAY_BOUNDS,
   contrastRatio,
   decorOf,
   inPlayArea,
} from "./looks";
import { HATCH_X, HATCH_Z, MONSTER_Z } from "./Kitchen";
import { CHEF_POS } from "./poses";
import { WHEEL } from "./rules";

const VIEW_CONFIG = {
   area: {
      min: { x: -3.0, y: 0, z: -2.0 },
      max: { x: 1.6, y: 2.9, z: 0.9 },
   },
   pitch: (22 * Math.PI) / 180,
   yaws: [0],
   focus: [{ x: -0.7, y: 0, z: -0.55 }],
   margin: { top: 0.17, bottom: 0.1, left: 0.02, right: 0.02 },
   padding: 8,
   shift: true,
   fov: 42,
};

const VIEWPORTS = [
   { name: "1280x800 desktop", w: 1280, h: 800 },
   { name: "390x844 mobile portrait", w: 390, h: 844 },
   { name: "844x390 mobile landscape", w: 844, h: 390 },
] as const;

describe("monster-kitchen look pass (looks.ts)", () => {
   it("contains valid hex codes for every color in COLORS", () => {
      for (const [key, hex] of Object.entries(COLORS)) {
         expect(hex, `COLORS.${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
   });

   it("defines all 5 level looks with valid lighting presets and colors", () => {
      for (let lvl = 1; lvl <= 5; lvl++) {
         const look = LEVEL_LOOKS[lvl as 1 | 2 | 3 | 4 | 5];
         expect(look, `level ${lvl}`).toBeDefined();
         expect(look.lighting in LIGHTING_PRESETS, `level ${lvl} preset`).toBe(true);
         expect(look.skyTop, `level ${lvl} skyTop`).toMatch(/^#[0-9a-fA-F]{6}$/);
         expect(look.skyBottom, `level ${lvl} skyBottom`).toMatch(/^#[0-9a-fA-F]{6}$/);
         expect(look.fog, `level ${lvl} fog`).toMatch(/^#[0-9a-fA-F]{6}$/);
         expect(look.background, `level ${lvl} background`).toMatch(/^#[0-9a-fA-F]{6}$/);
         expect(look.stoveGlow).toBeGreaterThan(0);
      }
   });

   it("keeps every decor spot strictly outside the play bounds", () => {
      expect(DECOR.length).toBeGreaterThanOrEqual(25);
      for (const spot of DECOR) {
         const inside = inPlayArea(spot.x, spot.z, spot.y);
         expect(
            inside,
            `decor spot ${spot.kind} at (${spot.x.toFixed(2)}, ${spot.y.toFixed(2)}, ${spot.z.toFixed(2)}) must not be inside play bounds`,
         ).toBe(false);
         // Every spot is either to the left (<= -3.2), right (>= 1.8), back (<= -3.0), or overhead (>= 3.0)
         const safe =
            spot.x <= -3.2 || spot.x >= 1.8 || spot.z <= -3.0 || spot.y >= 3.0;
         expect(
            safe,
            `decor spot ${spot.kind} (${spot.x.toFixed(2)}, ${spot.y.toFixed(2)}, ${spot.z.toFixed(2)}) must clear play corridor`,
         ).toBe(true);
      }
   });

   it("has decor instances across all required categories", () => {
      expect(decorOf("crate").length).toBeGreaterThanOrEqual(8);
      expect(decorOf("pan").length).toBeGreaterThanOrEqual(4);
      expect(decorOf("pot").length).toBeGreaterThanOrEqual(3);
      expect(decorOf("jar").length).toBeGreaterThanOrEqual(4);
      expect(decorOf("barrel").length).toBeGreaterThanOrEqual(2);
      expect(decorOf("pumpkin").length).toBeGreaterThanOrEqual(2);
      expect(decorOf("garlic").length).toBeGreaterThanOrEqual(2);
      expect(decorOf("window").length).toBe(2);
   });

   it("ensures no decor instance occludes play elements from the fitted camera at 1280x800, 390x844 and 844x390", () => {
      const focus = VIEW_CONFIG.focus[0];
      const targets = [
         { name: "chef", pos: new Vector3(CHEF_POS.x, 1.2, CHEF_POS.z) },
         { name: "wheel centre", pos: new Vector3(WHEEL.x, WHEEL.y + 0.1, WHEEL.z) },
         { name: "front slot", pos: new Vector3(WHEEL.x, WHEEL.y + 0.1, WHEEL.z + WHEEL.ringR) },
         { name: "cauldron", pos: new Vector3(0, 1.35, -0.1) },
         { name: "left monster", pos: new Vector3(HATCH_X[0], 1.2, MONSTER_Z) },
         { name: "right monster", pos: new Vector3(HATCH_X[1], 1.2, MONSTER_Z) },
         { name: "serving hatch left", pos: new Vector3(HATCH_X[0], 1.5, HATCH_Z) },
         { name: "serving hatch right", pos: new Vector3(HATCH_X[1], 1.5, HATCH_Z) },
      ];

      for (const vp of VIEWPORTS) {
         const view = fitView({ ...VIEW_CONFIG, width: vp.w, height: vp.h });
         const camPos = new Vector3(
            focus.x + view.offset[0],
            focus.y + view.offset[1],
            focus.z + view.offset[2],
         );

         for (const target of targets) {
            // Ray segment from camera to target
            const rayDir = new Vector3().subVectors(target.pos, camPos);
            const rayLen = rayDir.length();
            rayDir.normalize();

            for (const spot of DECOR) {
               // Bounding radius for each decor spot
               const radius = Math.max(spot.sx, spot.sy, spot.sz) * 0.45;
               const spotCenter = new Vector3(spot.x, spot.y, spot.z);

               // Distance from spot to the line segment between camPos and target.pos
               const toSpot = new Vector3().subVectors(spotCenter, camPos);
               const proj = toSpot.dot(rayDir);

               // Only check if spot is in front of camera and before the target
               if (proj > 0.1 && proj < rayLen - 0.2) {
                  const closest = new Vector3().copy(camPos).addScaledVector(rayDir, proj);
                  const dist = closest.distanceTo(spotCenter);
                  expect(
                     dist,
                     `Decor ${spot.kind} at (${spot.x.toFixed(2)}, ${spot.y.toFixed(2)}, ${spot.z.toFixed(2)}) occludes ${target.name} at ${vp.name}`,
                  ).toBeGreaterThan(radius);
               }
            }
         }
      }
   });

   it("proves the tiled kitchen floor covers the view at all three screen sizes without void/sky", () => {
      // Floor spans x in [-22, 22], z in [-23, 21] at y = 0
      const floorBounds = { xMin: -22, xMax: 22, zMin: -23, zMax: 21 };
      const focus = VIEW_CONFIG.focus[0];

      for (const vp of VIEWPORTS) {
         const view = fitView({ ...VIEW_CONFIG, width: vp.w, height: vp.h });
         const cam = new PerspectiveCamera(VIEW_CONFIG.fov, vp.w / vp.h, 0.1, 1000);
         cam.position.set(
            focus.x + view.offset[0],
            focus.y + view.offset[1],
            focus.z + view.offset[2],
         );
         cam.lookAt(focus.x, focus.y, focus.z);
         cam.updateMatrixWorld();

         // Sample along bottom of the screen (NDC y = -1, x from -1 to 1)
         for (let k = 0; k <= 10; k++) {
            const ndcX = -1 + (2 * k) / 10;
            const ndcY = -1; // bottom edge

            // Unproject NDC point into world space
            const pointNear = new Vector3(ndcX, ndcY, 0).unproject(cam);
            const dir = new Vector3().subVectors(pointNear, cam.position).normalize();

            // Find intersection with floor plane y = 0
            expect(dir.y, `ray at ${vp.name} ndcX=${ndcX.toFixed(1)} must point down toward floor`).toBeLessThan(0);
            const t = -cam.position.y / dir.y;
            const hitX = cam.position.x + t * dir.x;
            const hitZ = cam.position.z + t * dir.z;

            expect(
               hitX,
               `bottom screen ray hitX at ${vp.name} (x=${hitX.toFixed(1)}) must be within floor bounds`,
            ).toBeGreaterThanOrEqual(floorBounds.xMin);
            expect(
               hitX,
               `bottom screen ray hitX at ${vp.name} (x=${hitX.toFixed(1)}) must be within floor bounds`,
            ).toBeLessThanOrEqual(floorBounds.xMax);
            expect(
               hitZ,
               `bottom screen ray hitZ at ${vp.name} (z=${hitZ.toFixed(1)}) must be within floor bounds`,
            ).toBeLessThanOrEqual(floorBounds.zMax);
         }
      }
   });

   it("ensures strong contrast for readability of monsters, ingredients and HUD cues", () => {
      // Monster tints vs hatch wall and floor
      const monsterTints = ["#a78bfa", "#4ade80", "#f472b6"];
      for (const tint of monsterTints) {
         expect(
            contrastRatio(tint, COLORS.wallBase),
            `monster tint ${tint} vs wallBase`,
         ).toBeGreaterThanOrEqual(2.2);
         expect(
            contrastRatio(tint, COLORS.floorTile),
            `monster tint ${tint} vs floorTile`,
         ).toBeGreaterThanOrEqual(2.2);
      }

      // Ingredients vs wheel wood surface
      const ingredientColors = [
         "#ef4444", // apple
         "#facc15", // banana
         "#d97706", // burger
         "#a78bfa", // sock
         "#94a3b8", // tinCan
         "#f97316", // fish
         COLORS.eyeballWhite,
         COLORS.slimeBase,
      ];
      for (const color of ingredientColors) {
         expect(
            contrastRatio(color, COLORS.wheelWood),
            `ingredient ${color} vs wheelWood`,
         ).toBeGreaterThanOrEqual(2.2);
      }

      // Selector ring/arrow yes (green) and no (red) vs wheel wood
      expect(contrastRatio(COLORS.yes, COLORS.wheelWood)).toBeGreaterThanOrEqual(3.0);
      expect(contrastRatio(COLORS.no, COLORS.wheelWood)).toBeGreaterThanOrEqual(2.5);

      // Fire glow vs cast iron stove
      expect(contrastRatio(COLORS.fireGlow, COLORS.stoveIron)).toBeGreaterThanOrEqual(3.5);
   });
});
