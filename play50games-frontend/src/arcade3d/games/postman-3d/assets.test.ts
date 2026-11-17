import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { fitView } from "@/arcade3d/core/view";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, FIT, GLB_SIZE, GLB_TRIS } from "./assets";
import { LEVELS } from "./levels";
import { FOV, GLB_FENCE_HOUSES, SOUTH_DECOR_MAX_H, VIEW, WINDOW, decorSpots, fogFor, lampSpots } from "./looks";
import { CAR_HX, CAR_HZ, HOUSE_HX, HOUSE_HZ, OFFICE_BOX, STREET_GAP, VAN_BOX, boundsFor } from "./rules";

async function bounds(url: string) {
   const { cloud } = await readCharacterGlb(url);
   const min = [Infinity, Infinity, Infinity];
   const max = [-Infinity, -Infinity, -Infinity];
   for (let i = 0; i < cloud.length; i++) {
      const a = i % 3;
      min[a] = Math.min(min[a], cloud[i]);
      max[a] = Math.max(max[a], cloud[i]);
   }
   return { min, max, width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
}
const k = (a: ModelAsset) => a.scale ?? 1;
const st = (a: ModelAsset, i: 0 | 1 | 2) => (a.stretch ? a.stretch[i] : 1);

describe("postman-3d GLB fits (real meshes)", () => {
   it("every adopted GLB is listed and measures as recorded, pivot on the floor centre", async () => {
      const urls: Record<keyof typeof GLB_SIZE, string> = {
         charPostman: ASSETS.postman.url,
         letter: ASSETS.letter.url,
         mailbag: ASSETS.mailbag.url,
         mailbox: ASSETS.mailbox.url,
         houseA: ASSETS.houseAN.url,
         houseB: ASSETS.houseBN.url,
         houseC: ASSETS.houseCN.url,
         postOffice: ASSETS.office.url,
         postVan: ASSETS.van.url,
         streetLampVictorian: ASSETS.lamp.url,
         bicycle: ASSETS.bicycle.url,
         holidayTree: ASSETS.holidayTree.url,
         trafficLight: ASSETS.trafficLight.url,
         dog: ASSETS.dog.url,
         picketFence: ASSETS.picketFence.url,
      };
      for (const [id, url] of Object.entries(urls) as [keyof typeof GLB_SIZE, string][]) {
         expect(hasModel(url), url).toBe(true);
         const b = await bounds(url);
         expect(b.width, id).toBeCloseTo(GLB_SIZE[id].width, 3);
         expect(b.height, id).toBeCloseTo(GLB_SIZE[id].height, 3);
         expect(b.depth, id).toBeCloseTo(GLB_SIZE[id].depth, 3);
         expect(b.min[1], id).toBeCloseTo(0, 3);
      }
      expect(hasModel("/models/3d/postman-3d/hero.glb")).toBe(false);
   });

   it("houses fill their solid boxes: 5.0 x 3.0 m, two storeys on the north row, bungalows on the camera side", () => {
      for (const [n, s, id] of [[ASSETS.houseAN, ASSETS.houseAS, "houseA"], [ASSETS.houseBN, ASSETS.houseBS, "houseB"], [ASSETS.houseCN, ASSETS.houseCS, "houseC"]] as const) {
         for (const a of [n, s]) {
            expect(GLB_SIZE[id].width * k(a) * st(a, 0)).toBeCloseTo(2 * HOUSE_HX, 6);
            expect(GLB_SIZE[id].depth * k(a) * st(a, 2)).toBeCloseTo(2 * HOUSE_HZ, 6);
            expect(a.url).toBe(`/models/3d/postman-3d/${id}.glb`);
         }
         expect(GLB_SIZE[id].height * k(n) * st(n, 1)).toBeCloseTo(FIT.houseHeightNorth, 6);
         expect(GLB_SIZE[id].height * k(s) * st(s, 1)).toBeCloseTo(FIT.houseHeightSouth, 6);
      }
   });

   it("street pieces at their rules sizes: office, van, car, mailbox, lamp, traffic light, dog", () => {
      const o = ASSETS.office;
      expect(GLB_SIZE.postOffice.width * k(o)).toBeCloseTo(2 * OFFICE_BOX.hx, 6);
      expect(GLB_SIZE.postOffice.depth * k(o) * st(o, 2)).toBeCloseTo(2 * OFFICE_BOX.hz, 6);
      expect(GLB_SIZE.postOffice.height * k(o) * st(o, 1)).toBeCloseTo(FIT.officeHeight, 6);
      // the van inside its solid box
      expect(GLB_SIZE.postVan.depth * k(ASSETS.van)).toBeCloseTo(VAN_BOX.maxZ - VAN_BOX.minZ, 6);
      expect(GLB_SIZE.postVan.width * k(ASSETS.van)).toBeLessThan(VAN_BOX.maxX - VAN_BOX.minX);
      // the car (its length turned along x) matches the rules' 2.8 x 1.3 box within 5 %
      expect(REUSED_GLB_SIZE.car.depth * k(ASSETS.car)).toBeCloseTo(2 * CAR_HX, 6);
      expect(Math.abs(REUSED_GLB_SIZE.car.width * k(ASSETS.car) - 2 * CAR_HZ)).toBeLessThan(0.07);
      expect(ASSETS.car.rotationY).toBeCloseTo(Math.PI / 2, 9);
      expect(GLB_SIZE.mailbox.height * k(ASSETS.mailbox)).toBeCloseTo(FIT.mailboxHeight, 6);
      expect(GLB_SIZE.streetLampVictorian.height * k(ASSETS.lamp)).toBeCloseTo(FIT.lampHeight, 6);
      expect(GLB_SIZE.trafficLight.height * k(ASSETS.trafficLight)).toBeCloseTo(FIT.trafficLightHeight, 6);
      expect(GLB_SIZE.dog.depth * k(ASSETS.dog)).toBeCloseTo(FIT.dogLength, 6);
      expect(GLB_SIZE.mailbag.height * k(ASSETS.mailbag)).toBeCloseTo(FIT.bagHeight, 6);
   });

   it("decor GLBs are fitted to 1 m, so a decor spot's scale is its size (never scaled twice)", () => {
      expect(GLB_SIZE.bicycle.height * k(ASSETS.bicycle)).toBeCloseTo(1, 6);
      expect(GLB_SIZE.holidayTree.height * k(ASSETS.holidayTree)).toBeCloseTo(1, 6);
      expect(REUSED_GLB_SIZE.bench.height * k(ASSETS.bench)).toBeCloseTo(1, 6);
      for (const a of [ASSETS.bicycle, ASSETS.holidayTree, ASSETS.bench] as ModelAsset[]) expect(a.stretch).toBeUndefined();
   });
});

describe("postman-3d triangle budget", () => {
   it("pins every GLB's triangles", async () => {
      const urls: Record<string, [string, number]> = {
         charPostman: [ASSETS.postman.url, GLB_TRIS.charPostman], mailbag: [ASSETS.mailbag.url, GLB_TRIS.mailbag], mailbox: [ASSETS.mailbox.url, GLB_TRIS.mailbox],
         houseA: [ASSETS.houseAN.url, GLB_TRIS.house], houseB: [ASSETS.houseBN.url, GLB_TRIS.house], houseC: [ASSETS.houseCN.url, GLB_TRIS.house],
         office: [ASSETS.office.url, GLB_TRIS.postOffice], van: [ASSETS.van.url, GLB_TRIS.postVan], lamp: [ASSETS.lamp.url, GLB_TRIS.streetLampVictorian],
         bicycle: [ASSETS.bicycle.url, GLB_TRIS.bicycle], tree: [ASSETS.holidayTree.url, GLB_TRIS.holidayTree], light: [ASSETS.trafficLight.url, GLB_TRIS.trafficLight],
         picketFence: [ASSETS.picketFence.url, GLB_TRIS.picketFence],
         dog: [ASSETS.dog.url, GLB_TRIS.dog], bench: [ASSETS.bench.url, GLB_TRIS.bench], car: [ASSETS.car.url, GLB_TRIS.car],
      };
      for (const [id, [url, tris]] of Object.entries(urls)) expect((await readCharacterGlb(url)).indices.length / 3, id).toBe(tris);
   });
   for (const id of LEVEL_IDS) {
      it(`L${id}: every GLB copy drawn at full decor quality, plus the code pieces, stays under ${FRAME_TRIS} triangles`, () => {
         const total = levelTriangles(id);
         console.info(`postman-3d L${id} frame triangles ${total}`);
         expect(total).toBeLessThanOrEqual(FRAME_TRIS);
      });
   }
});

/** Triangles of everything the scene draws on a level at decor quality 1 (GLB copies x measured tris + the code pieces). */
const FRAME_TRIS = 300_000;
function levelTriangles(id: (typeof LEVEL_IDS)[number]): number {
   const level = LEVELS[id];
   const houses = level.streets * level.housesPerStreet;
   const d = decorSpots(id);
   const boxTris = 12; // the scene's code pieces are plain unit boxes (Boxes without `rounded`)
   // code pieces as the scene builds them: per street roads, dashes, pavements, kerbs, zebra; per house path, door frame and leaf, 2 x (2 rails + 9 posts)
   const lines = level.streets * Math.ceil((boundsFor(level).max.x + 28 + 13) / 4);
   // the fenced houses' +x fence (11 code boxes) is the picket GLB instead (GLB_FENCE_HOUSES, looks.ts)
   const fenced = Math.min(GLB_FENCE_HOUSES, houses);
   const codeBoxes = level.streets * (1 + 2 + 2 + 7) + 1 + lines + houses * (1 + 2 + 22) - fenced * 11;
   return (
      GLB_TRIS.charPostman + GLB_TRIS.mailbag + GLB_TRIS.postOffice + GLB_TRIS.postVan +
      houses * (GLB_TRIS.house + GLB_TRIS.mailbox) + fenced * GLB_TRIS.picketFence +
      lampSpots(level).length * GLB_TRIS.streetLampVictorian +
      level.dogs * GLB_TRIS.dog +
      level.traffic * GLB_TRIS.car +
      (level.traffic > 0 ? level.streets * GLB_TRIS.trafficLight : 0) +
      d.benches.length * GLB_TRIS.bench + d.bicycles.length * GLB_TRIS.bicycle + d.trees.length * GLB_TRIS.holidayTree +
      codeBoxes * boxTris + 10_000 // plates, lamp glows, bulbs, the parcel, the lawn, rings, fx
   );
}

describe("postman-3d decor and fog", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: decor outside the play area, short on the camera side; trees only on the holiday level`, () => {
         const level = LEVELS[id];
         const b = boundsFor(level);
         const d = decorSpots(id);
         const southEdge = (level.streets - 1) * STREET_GAP + 11;
         for (const s of [...d.benches, ...d.bicycles, ...d.trees]) {
            // outside the streets and yards: west of the houses, north of the first street's houses or past the street ends
            const inside = s.x > -1 && s.x < b.max.x && s.z > b.min.z && s.z < b.max.z;
            expect(inside).toBe(false);
            if (s.z > southEdge) expect(s.scale ?? 1).toBeLessThanOrEqual(SOUTH_DECOR_MAX_H);
            expect(s.sx ?? s.sy ?? s.sz).toBeUndefined();
         }
         expect(d.trees.length > 0).toBe(level.lighting === "night");
      });
   }
   it("the fog starts past the fitted camera on a 390 x 844 phone and at 1280 x 800, on every level", () => {
      for (const [width, height] of [[390, 844], [1280, 800]] as const) {
         const view = fitView({ ...VIEW, width, height, fov: FOV, avoid: [] });
         for (const id of LEVEL_IDS) {
            const fog = fogFor(LEVELS[id], view.distance);
            // the whole window (its far edge, WINDOW.z past the aim) stays out of the fog
            expect(fog.near).toBeGreaterThanOrEqual(view.distance + WINDOW.z);
            expect(fog.far).toBeGreaterThan(fog.near + 30);
         }
         // the window is a 12 x 12 m patch: the postman (1.78 m) is at least ~1/10 of the screen height
         expect(view.distance).toBeLessThan(40);
      }
   });
});
