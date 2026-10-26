import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { EXPANSION_GLB_SIZE, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { fitView } from "@/arcade3d/core/view";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, FIT, GLB_SIZE } from "./assets";
import { LEVELS } from "./levels";
import { FOG_MIN_NEAR, FOV, SOUTH_DECOR_MAX_H, decorSpots, fenceSpots, fogFor, railSpots, viewFor, viewWindow } from "./looks";
import { BENCH_R, DOG_R, FOUNTAIN_R, MOWER_R, TREE_R, propsOf } from "./rules";

async function measure(url: string) {
   const { cloud, indices } = await readCharacterGlb(url);
   const min = [Infinity, Infinity, Infinity];
   const max = [-Infinity, -Infinity, -Infinity];
   for (let i = 0; i < cloud.length; i++) {
      const a = i % 3;
      min[a] = Math.min(min[a], cloud[i]);
      max[a] = Math.max(max[a], cloud[i]);
   }
   return { cloud, min, max, width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2], tris: indices.length / 3 };
}

const URLS: Record<keyof typeof GLB_SIZE, string> = {
   dog: ASSETS.dog.url,
   tennisBall: ASSETS.ball.url,
   frisbee: ASSETS.frisbee.url,
   fetchStick: ASSETS.stick.url,
   parkFountain: ASSETS.fountain.url,
   agilityTunnel: ASSETS.tunnel.url,
   agilityHurdleR: ASSETS.hurdle.url,
   lawnMower: ASSETS.mower.url,
   parkBush: ASSETS.bush.url,
   festivalTent: ASSETS.tent.url,
   civilianNpc: ASSETS.owner.url,
};

describe("dog-park-fetch GLB fits (real meshes)", () => {
   it("every adopted GLB is listed and measures as recorded (bounds and triangles), pivot on the floor centre", async () => {
      for (const [id, url] of Object.entries(URLS) as [keyof typeof GLB_SIZE, string][]) {
         expect(hasModel(url), id).toBe(true);
         const m = await measure(url);
         expect(m.width, id).toBeCloseTo(GLB_SIZE[id].width, 3);
         expect(m.height, id).toBeCloseTo(GLB_SIZE[id].height, 3);
         expect(m.depth, id).toBeCloseTo(GLB_SIZE[id].depth, 3);
         expect(m.tris, id).toBe(GLB_SIZE[id].tris);
         expect(m.min[1], id).toBeCloseTo(0, 3);
      }
      for (const skipped of ["dogHouse", "dogHouseR", "dogBone", "dogBoneV2", "agilityHurdle", "dogOwnerNpc"]) expect(hasModel(`/models/3d/dog-park-fetch/${skipped}.glb`)).toBe(false);
   });

   it("the dog faces +z (its head, the tall end, is at +z) and is drawn 0.9 m long, about its 0.32 m radius", async () => {
      const m = await measure(ASSETS.dog.url);
      let front = 0;
      let back = 0;
      for (let i = 0; i < m.cloud.length; i += 3) {
         if (m.cloud[i + 2] > 0.2) front = Math.max(front, m.cloud[i + 1]);
         if (m.cloud[i + 2] < -0.2) back = Math.max(back, m.cloud[i + 1]);
      }
      expect(front).toBeGreaterThan(back);
      const k = ASSETS.dog.scale!;
      expect(GLB_SIZE.dog.depth * k).toBeCloseTo(FIT.dogLength, 6);
      expect((GLB_SIZE.dog.width * k) / 2).toBeLessThanOrEqual(DOG_R);
      expect(ASSETS.dog.rotationY).toBeUndefined();
   });

   it("gameplay sizes: owner 1.75 m, toys centred at their size, fountain and mower match their circles", () => {
      expect(GLB_SIZE.civilianNpc.height * ASSETS.owner.scale!).toBeCloseTo(FIT.ownerHeight, 6);
      expect(GLB_SIZE.tennisBall.height * ASSETS.ball.scale!).toBeCloseTo(FIT.ball, 6);
      expect(GLB_SIZE.fetchStick.width * ASSETS.stick.scale!).toBeCloseTo(FIT.stick, 6);
      expect(GLB_SIZE.frisbee.depth * ASSETS.frisbee.scale!).toBeCloseTo(FIT.frisbee, 6);
      for (const [a, id] of [[ASSETS.ball, "tennisBall"], [ASSETS.stick, "fetchStick"], [ASSETS.frisbee, "frisbee"]] as const) {
         expect(a.yOffset! + (GLB_SIZE[id].height * a.scale!) / 2).toBeCloseTo(0, 9);
      }
      expect((GLB_SIZE.parkFountain.width * ASSETS.fountain.scale!) / 2).toBeCloseTo(FOUNTAIN_R, 6);
      expect(GLB_SIZE.lawnMower.depth * ASSETS.mower.scale!).toBeCloseTo(FIT.mowerLength, 6);
      expect((GLB_SIZE.lawnMower.width * ASSETS.mower.scale!) / 2).toBeLessThan(MOWER_R + 0.05);
      expect(REUSED_GLB_SIZE.bench.width * ASSETS.bench.scale!).toBeCloseTo(FIT.bench, 6);
      expect((REUSED_GLB_SIZE.bench.depth * ASSETS.bench.scale!) / 2).toBeLessThanOrEqual(BENCH_R);
      // the in-lawn bushes are 2 x TREE_R wide (the spot scale) and low enough never to hide the dog
      expect(GLB_SIZE.parkBush.height * ASSETS.bush.scale! * TREE_R * 2).toBeLessThan(0.6);
   });

   it("decor GLBs are fitted to 1 m, so a decor spot's scale is its size (never scaled twice)", () => {
      expect(GLB_SIZE.parkBush.width * ASSETS.bush.scale!).toBeCloseTo(1, 9);
      expect(GLB_SIZE.festivalTent.height * ASSETS.tent.scale!).toBeCloseTo(1, 9);
      expect(GLB_SIZE.agilityTunnel.depth * ASSETS.tunnel.scale!).toBeCloseTo(1, 9);
      expect(GLB_SIZE.agilityHurdleR.width * ASSETS.hurdle.scale!).toBeCloseTo(1, 9);
      expect(EXPANSION_GLB_SIZE.leafyTree.height * ASSETS.tree.scale!).toBeCloseTo(1, 9);
      for (const a of [ASSETS.bush, ASSETS.tent, ASSETS.tunnel, ASSETS.hurdle, ASSETS.tree] as ModelAsset[]) expect(a.stretch).toBeUndefined();
   });
});

/** Every triangle a level draws at full decor quality: GLB copies x measured tris + the code pieces. */
function frameTris(id: (typeof LEVEL_IDS)[number]): number {
   const level = LEVELS[id];
   const props = propsOf(level);
   const d = decorSpots(id);
   const g = (k: keyof typeof GLB_SIZE, n: number) => GLB_SIZE[k].tris * n;
   const fountains = props.filter((p) => p.r === FOUNTAIN_R).length;
   const benches = props.filter((p) => p.r === BENCH_R).length;
   const bushes = props.filter((p) => p.r === TREE_R).length + d.bushes.length;
   const BENCH_TRIS = 2000;
   const TREE_TRIS = 1500;
   const code = 12 * (fenceSpots(level).length + railSpots(level).length) + 2 * 48 * 2 + 8000; // fence, rails, ground, sky + blanket/stripes/fx
   return (
      g("dog", 1) + g("civilianNpc", 1) + g("tennisBall", 1) + g("fetchStick", 1) + g("frisbee", 1) +
      g("lawnMower", level.mowers) + g("parkFountain", fountains) + BENCH_TRIS * benches + g("parkBush", bushes) +
      TREE_TRIS * d.trees.length + g("festivalTent", d.tents.length) + g("agilityTunnel", d.tunnels.length) + g("agilityHurdleR", d.hurdles.length) + code
   );
}

describe("dog-park-fetch look: budget, decor, camera and fog", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: at most 300k triangles a frame`, () => {
         const t = frameTris(id);
         console.info(`dog-park-fetch L${id} frame triangles ${t}`);
         expect(t).toBeLessThanOrEqual(300_000);
      });
      it(`L${id}: decor stands outside the fence, low on the camera (south) side, festival pieces only on L5`, () => {
         const level = LEVELS[id];
         const hw = level.width / 2;
         const hd = level.depth / 2;
         const d = decorSpots(id);
         expect(JSON.stringify(decorSpots(id))).toBe(JSON.stringify(d));
         const heightOf = { trees: 1, bushes: GLB_SIZE.parkBush.height / GLB_SIZE.parkBush.width, tents: 1, tunnels: GLB_SIZE.agilityTunnel.height / GLB_SIZE.agilityTunnel.depth, hurdles: GLB_SIZE.agilityHurdleR.height / GLB_SIZE.agilityHurdleR.width } as const;
         for (const [kind, spots] of Object.entries(d) as [keyof typeof heightOf, typeof d.trees][]) {
            for (const s of spots) {
               expect(Math.abs(s.x) > hw + 0.6 || Math.abs(s.z) > hd + 0.6, `${kind} ${s.x},${s.z}`).toBe(true);
               if (s.z > hd) expect((s.scale ?? 1) * heightOf[kind]).toBeLessThanOrEqual(SOUTH_DECOR_MAX_H);
               expect(s.sx ?? s.sy ?? s.sz).toBeUndefined();
            }
         }
         for (const t of d.trees) expect(t.z).toBeLessThan(hd - 3);
         expect(d.tents.length + d.tunnels.length + d.hurdles.length > 0).toBe(id === 5);
      });
      it(`L${id}: the fog starts past the fitted camera's window on a phone and a desktop; portrait comes in closer`, () => {
         const level = LEVELS[id];
         for (const [w, h] of [[390, 844], [1280, 800]] as const) {
            const portrait = w < h;
            const { distance } = fitView({ ...viewFor(id, portrait), width: w, height: h, fov: FOV });
            const fog = fogFor(level, distance, portrait);
            expect(fog.near).toBeGreaterThanOrEqual(distance + viewWindow(level, portrait).z * 0.5 - 1e-9);
            expect(fog.near).toBeGreaterThanOrEqual(FOG_MIN_NEAR);
            if (portrait) {
               const wide = fitView({ ...viewFor(id, false), width: w, height: h, fov: FOV }).distance;
               expect(distance).toBeLessThanOrEqual(wide + 1e-9);
               expect(viewWindow(level, true).x * 2).toBeLessThanOrEqual(10);
            }
         }
      });
   }
});
