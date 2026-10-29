// Each level's room dressing (sets.ts): the reused GLBs measure what sets.ts says and are in the
// manifest; every piece stands outside PLAY_BOUNDS (by its footprint) and off every camera line to
// the chef, the wheel, the cauldron, the monsters and the hatches at 1280 x 800, 390 x 844 and
// 844 x 390; the five levels are five different rooms.
import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { fitView } from "@/arcade3d/core/view";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { LEVEL_IDS } from "@/arcade3d/types";
import { HATCH_X, HATCH_Z, MONSTER_Z } from "./Kitchen";
import { PLAY_BOUNDS } from "./looks";
import { CHEF_POS } from "./poses";
import { WHEEL } from "./rules";
import { SETS, SET_GLB, type SetKind, type SetSpot } from "./sets";

const VIEW = {
   area: { min: { x: -3.0, y: 0, z: -2.0 }, max: { x: 1.6, y: 2.9, z: 0.9 } },
   pitch: (22 * Math.PI) / 180,
   yaws: [0],
   focus: [{ x: -0.7, y: 0, z: -0.55 }],
   margin: { top: 0.17, bottom: 0.1, left: 0.02, right: 0.02 },
   padding: 8,
   shift: true as const,
   fov: 42,
};

/** A spot's footprint half-extents along x and z (quarter turns swap them; other turns take the larger) and its top. */
function extent(s: SetSpot): { hx: number; hz: number; top: number } {
   const g = SET_GLB[s.kind];
   const k = s.h / g.height;
   const w = (g.width * (s.wide ?? 1) * k) / 2;
   const d = (g.depth * k) / 2;
   const turn = Math.abs(((s.rotY ?? 0) / (Math.PI / 2)) % 2);
   const square = Math.abs(turn - Math.round(turn)) < 1e-6;
   if (!square) return { hx: Math.max(w, d), hz: Math.max(w, d), top: s.y + s.h };
   return Math.round(turn) === 1 ? { hx: d, hz: w, top: s.y + s.h } : { hx: w, hz: d, top: s.y + s.h };
}

describe("monster-kitchen level rooms", () => {
   it("every GLB is in the manifest and measures what sets.ts says", async () => {
      for (const kind of Object.keys(SET_GLB) as SetKind[]) {
         const g = SET_GLB[kind];
         expect(hasModel(g.url), g.url).toBe(true);
         const { cloud } = await readCharacterGlb(g.url);
         const mn = [Infinity, Infinity, Infinity];
         const mx = [-Infinity, -Infinity, -Infinity];
         for (let i = 0; i < cloud.length; i++) {
            mn[i % 3] = Math.min(mn[i % 3], cloud[i]);
            mx[i % 3] = Math.max(mx[i % 3], cloud[i]);
         }
         expect(mx[0] - mn[0], `${kind} width`).toBeCloseTo(g.width, 2);
         expect(mx[1] - mn[1], `${kind} height`).toBeCloseTo(g.height, 2);
         expect(mx[2] - mn[2], `${kind} depth`).toBeCloseTo(g.depth, 2);
         expect(mn[1]).toBeCloseTo(0, 2);
      }
   }, 120_000);

   for (const id of LEVEL_IDS) {
      it(`L${id}: every piece stands outside the play area and hides nothing from the camera`, () => {
         const targets = [
            new Vector3(CHEF_POS.x, 1.2, CHEF_POS.z),
            new Vector3(WHEEL.x, WHEEL.y + 0.1, WHEEL.z),
            new Vector3(WHEEL.x, WHEEL.y + 0.1, WHEEL.z + WHEEL.ringR),
            new Vector3(0, 1.35, -0.1),
            new Vector3(HATCH_X[0], 1.2, MONSTER_Z),
            new Vector3(HATCH_X[1], 1.2, MONSTER_Z),
            new Vector3(HATCH_X[0], 1.5, HATCH_Z),
            new Vector3(HATCH_X[1], 1.5, HATCH_Z),
         ];
         for (const s of SETS[id].spots) {
            const { hx, hz, top } = extent(s);
            const outside = s.x + hx <= PLAY_BOUNDS.xMin || s.x - hx >= PLAY_BOUNDS.xMax || s.z + hz <= PLAY_BOUNDS.zMin || s.y >= PLAY_BOUNDS.yMax;
            const hanging = s.y > 1.8 && (s.x <= PLAY_BOUNDS.xMin - 0.3 || s.x >= PLAY_BOUNDS.xMax + 0.3 || s.z <= PLAY_BOUNDS.zMin);
            expect(outside || hanging, `${s.kind} at (${s.x}, ${s.z})`).toBe(true);
            for (const [w, h] of [[1280, 800], [390, 844], [844, 390]]) {
               const view = fitView({ ...VIEW, width: w, height: h });
               const cam = new Vector3(VIEW.focus[0].x + view.offset[0], view.offset[1], VIEW.focus[0].z + view.offset[2]);
               for (const t of targets) {
                  const p = new Vector3();
                  for (let i = 0; i <= 200; i++) {
                     p.lerpVectors(cam, t, i / 200);
                     const inside = p.y >= s.y && p.y <= top && Math.abs(p.x - s.x) <= hx && Math.abs(p.z - s.z) <= hz;
                     expect(inside, `${s.kind} at (${s.x}, ${s.z}) hides (${t.x.toFixed(1)}, ${t.y.toFixed(1)}, ${t.z.toFixed(1)}) at ${w}x${h}`).toBe(false);
                  }
               }
            }
         }
      });
   }

   it("the five levels are five different rooms", () => {
      expect(SETS[1].spots).toHaveLength(0);
      const rooms = LEVEL_IDS.map((id) => JSON.stringify(SETS[id]));
      expect(new Set(rooms).size).toBe(5);
      expect(SETS[2].extras.menu && SETS[5].extras.bunting && SETS[4].extras.lanternLight).toBe(true);
      expect(SETS[4].spots.filter((s) => s.kind === "lantern").length).toBeGreaterThanOrEqual(4);
   });
});
