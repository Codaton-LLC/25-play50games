// The Hyper3D fits on the real meshes: each GLB's raw bounds equal GLB_SIZE (the fits derive from it),
// it stands on y = 0 centred on x / z, every url is in the manifest, and the drawn sizes match the
// rules' blockers (desk, sofa, planter) so nothing drawn is walked through.
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { ASSETS, BELLBOY_HEIGHT, DESK_DEPTH, DESK_TOP, DESK_WIDTH, ELEVATOR_HEIGHT, ELEVATOR_WIDTH, GLB_SIZE, GUEST_HEIGHT, ROOM_DOOR_HEIGHT, SUITCASE_HEIGHT, TROLLEY_HEIGHT } from "./assets";
import spec from "./assets.spec.json";
import { DESK, PLANTER_SIZE, SOFA_SIZE } from "./rules";

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

const BY_ID: Record<keyof typeof GLB_SIZE, string> = {
   charBellboy: ASSETS.bellboy.url,
   bellboyTrolleyV3T: ASSETS.trolley.url,
   elevatorDoorsSliding: ASSETS.elevator.url,
   hotelRoomDoor: ASSETS.door.url,
   keyCard: ASSETS.keyCard.url,
   receptionDesk: ASSETS.desk.url,
   serviceBellV2: ASSETS.bell.url,
   lobbyPlanterR: ASSETS.planter.url,
   sofa: ASSETS.sofa.url,
   travellerNpc: ASSETS.guest.url,
};

const k = (a: { scale?: number }) => a.scale ?? 1;

describe("hotel-bellboy-rush GLB fits", () => {
   it("every asset is listed in the manifest and named in assets.spec.json", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      const ids = spec.assets.map((a: { id: string }) => a.id).sort();
      expect(ids).toEqual(Object.keys(GLB_SIZE).sort());
   });

   for (const [id, url] of Object.entries(BY_ID)) {
      it(`${id}: raw bounds equal GLB_SIZE, feet on y = 0, centred`, async () => {
         const b = await bounds(url);
         const size = GLB_SIZE[id as keyof typeof GLB_SIZE];
         expect(b.width).toBeCloseTo(size.width, 3);
         expect(b.height).toBeCloseTo(size.height, 3);
         expect(b.depth).toBeCloseTo(size.depth, 3);
         expect(b.min[1]).toBeCloseTo(0, 3);
         expect((b.min[0] + b.max[0]) / 2).toBeCloseTo(0, 2);
         expect((b.min[2] + b.max[2]) / 2).toBeCloseTo(0, 2);
      });
   }

   it("draws every model at its size in metres, and the blockers at the rules' boxes", () => {
      expect(GLB_SIZE.charBellboy.height * k(ASSETS.bellboy)).toBeCloseTo(BELLBOY_HEIGHT, 6);
      expect(GLB_SIZE.bellboyTrolleyV3T.height * k(ASSETS.trolley)).toBeCloseTo(TROLLEY_HEIGHT, 6);
      expect(GLB_SIZE.elevatorDoorsSliding.height * k(ASSETS.elevator) * ASSETS.elevator.stretch[1]).toBeCloseTo(ELEVATOR_HEIGHT, 6);
      expect(GLB_SIZE.elevatorDoorsSliding.width * k(ASSETS.elevator)).toBeCloseTo(ELEVATOR_WIDTH, 6);
      expect(GLB_SIZE.hotelRoomDoor.height * k(ASSETS.door)).toBeCloseTo(ROOM_DOOR_HEIGHT, 6);
      expect(GLB_SIZE.travellerNpc.height * k(ASSETS.guest)).toBeCloseTo(GUEST_HEIGHT, 6);
      expect(EXPANSION_GLB_SIZE.suitcase.height * k(ASSETS.suitcase)).toBeCloseTo(SUITCASE_HEIGHT, 6);
      // the desk fills its blocker: 2.2 x 0.9 m, about 1 m tall
      expect(GLB_SIZE.receptionDesk.width * k(ASSETS.desk)).toBeCloseTo(DESK.max.x - DESK.min.x, 6);
      expect(GLB_SIZE.receptionDesk.depth * k(ASSETS.desk) * ASSETS.desk.stretch[2]).toBeCloseTo(DESK.max.z - DESK.min.z, 6);
      expect(DESK_WIDTH).toBe(DESK.max.x - DESK.min.x);
      expect(DESK_DEPTH).toBeCloseTo(DESK.max.z - DESK.min.z, 9);
      expect(DESK_TOP).toBeGreaterThan(0.95);
      expect(DESK_TOP).toBeLessThan(1.1);
      // sofa and planter: their long side (GLB x) along the wall after the quarter turn, the depth stretched to the box
      expect(GLB_SIZE.sofa.width * k(ASSETS.sofa)).toBeCloseTo(SOFA_SIZE.z, 6);
      expect(GLB_SIZE.sofa.depth * k(ASSETS.sofa) * ASSETS.sofa.stretch[2]).toBeCloseTo(SOFA_SIZE.x, 6);
      expect(GLB_SIZE.lobbyPlanterR.width * k(ASSETS.planter)).toBeCloseTo(PLANTER_SIZE.z, 6);
      expect(GLB_SIZE.lobbyPlanterR.depth * k(ASSETS.planter) * ASSETS.planter.stretch[2]).toBeCloseTo(PLANTER_SIZE.x, 6);
      // none of them is stretched more than 25 % (proportions stay the mesh's)
      for (const s of [ASSETS.desk.stretch[2], ASSETS.sofa.stretch[2], ASSETS.planter.stretch[2]]) {
         expect(s).toBeGreaterThan(0.75);
         expect(s).toBeLessThan(1.25);
      }
   });
});
