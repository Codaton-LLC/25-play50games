// The Hyper3D fits on the real meshes: each GLB's raw bounds equal GLB_SIZE (the fits derive from it),
// it stands on y = 0 centred on x / z, every url is in the manifest, and the drawn sizes match the
// rules' tracks and blockers (the carriage inside its track bed, the canopy, sign, bench, ticket
// machine and trolley inside or on their solids).
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { EXPANSION_GLB_SIZE, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import {
   ASSETS,
   BACKPACK_HEIGHT,
   CANOPY_DEPTH,
   CANOPY_HEIGHT,
   CANOPY_WIDTH,
   CAR_HEIGHT,
   CAR_LENGTH,
   CAR_WIDTH,
   GLB_SIZE,
   LAMP_HEIGHT,
   LOCO_WIDTH,
   SUITCASE_HEIGHT,
   TICKET_HEIGHT,
   TRAVELLER_HEIGHT,
   WORKER_HEIGHT,
} from "./assets";
import spec from "./assets.spec.json";
import { LEVELS } from "./levels";
import { LOCO_LEN } from "./looks";
import { PLATFORM_W, TRACK_W, solidsFor } from "./rules";

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
   charStationWorker: ASSETS.worker.url,
   trainCarV2: ASSETS.car.url,
   locomotiveFront: ASSETS.loco.url,
   platformCanopy: ASSETS.canopy.url,
   platformSign: ASSETS.sign.url,
   stationBench: ASSETS.bench.url,
   stationClock: ASSETS.clock.url,
   stationTrolley: ASSETS.trolley.url,
   backpack: ASSETS.backpack.url,
   ticketMachine: ASSETS.ticket.url,
   travellerNpc: ASSETS.traveller.url,
};

const k = (a: { scale?: number }) => a.scale ?? 1;

describe("train-station-rush GLB fits", () => {
   it("every asset is listed in the manifest and named in assets.spec.json", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      expect(spec.assets.map((a: { id: string }) => a.id).sort()).toEqual(Object.keys(GLB_SIZE).sort());
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

   it("draws every model at its size in metres, inside the rules' tracks and blockers", () => {
      expect(GLB_SIZE.charStationWorker.height * k(ASSETS.worker)).toBeCloseTo(WORKER_HEIGHT, 6);
      expect(GLB_SIZE.travellerNpc.height * k(ASSETS.traveller)).toBeCloseTo(TRAVELLER_HEIGHT, 6);
      expect(GLB_SIZE.backpack.height * k(ASSETS.backpack)).toBeCloseTo(BACKPACK_HEIGHT, 6);
      expect(EXPANSION_GLB_SIZE.suitcase.height * k(ASSETS.suitcase)).toBeCloseTo(SUITCASE_HEIGHT, 6);
      expect(REUSED_GLB_SIZE.lamp.height * k(ASSETS.lamp)).toBeCloseTo(LAMP_HEIGHT, 6);
      expect(GLB_SIZE.ticketMachine.height * k(ASSETS.ticket)).toBeCloseTo(TICKET_HEIGHT, 6);
      // the carriage: 2.0 m wide inside its 2.4 m track bed, about 14 m long and 2.5 m tall
      expect(GLB_SIZE.trainCarV2.width * k(ASSETS.car)).toBeCloseTo(CAR_WIDTH, 6);
      expect(CAR_WIDTH).toBeLessThan(TRACK_W);
      // the engine: as tall as a carriage, inside the track bed, exactly LOCO_LEN long
      expect(GLB_SIZE.locomotiveFront.height * k(ASSETS.loco)).toBeCloseTo(CAR_HEIGHT, 6);
      expect(LOCO_WIDTH).toBeLessThan(TRACK_W);
      expect(GLB_SIZE.locomotiveFront.depth * k(ASSETS.loco) * ASSETS.loco.stretch[2]).toBeCloseTo(LOCO_LEN, 6);
      expect(CAR_LENGTH).toBeGreaterThan(12);
      // the canopy spans the island (two platforms) without reaching the tracks
      expect(GLB_SIZE.platformCanopy.depth * k(ASSETS.canopy)).toBeCloseTo(CANOPY_WIDTH, 6);
      expect(GLB_SIZE.platformCanopy.height * k(ASSETS.canopy) * ASSETS.canopy.stretch[1]).toBeCloseTo(CANOPY_HEIGHT, 6);
      expect(CANOPY_WIDTH).toBeLessThan(PLATFORM_W * 2);
      const solids = solidsFor(LEVELS[5]);
      const of = (kind: string) => solids.find((s) => s.kind === kind)!;
      // blockers no bigger than what is drawn (the worker stops at the drawn prop, never short of it by much)
      expect(of("canopy").hx * 2).toBeLessThanOrEqual(CANOPY_WIDTH);
      expect(of("canopy").hz * 2).toBeLessThanOrEqual(CANOPY_DEPTH);
      expect(of("sign").hx * 2).toBeLessThanOrEqual(GLB_SIZE.platformSign.width * k(ASSETS.sign) + 1e-9);
      expect(of("ticket").hx * 2).toBeCloseTo(GLB_SIZE.ticketMachine.width * k(ASSETS.ticket), 1);
      expect(of("bench").hz * 2).toBeCloseTo(GLB_SIZE.stationBench.width * k(ASSETS.bench), 1);
      expect(of("trolley").hx * 2).toBeCloseTo(GLB_SIZE.stationTrolley.depth * k(ASSETS.trolley), 1);
   });
});
