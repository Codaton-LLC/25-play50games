import type { ModelAsset } from "../../core/types";
import { heroModelAsset } from "../../menu2/heroModels";

export const GLB_BOUNDS = {
   "m2AirVent": {
      "size": [
         1.886865,
         0.401006,
         1.875335
      ],
      "minY": 0.0,
      "tris": 1500,
      "bytes": 95500
   },
   "m2AnemometerPost": {
      "size": [
         1.409876,
         1.890965,
         1.429713
      ],
      "minY": 0.0,
      "tris": 3000,
      "bytes": 111280
   },
   "m2FanLiftPlatform": {
      "size": [
         1.896161,
         0.424653,
         1.827365
      ],
      "minY": 0.0,
      "tris": 3000,
      "bytes": 160616
   },
   "m2FlyingCrate": {
      "size": [
         1.885363,
         1.158966,
         1.893707
      ],
      "minY": 0.0,
      "tris": 3000,
      "bytes": 115604
   },
   "m2GaleEngineBoss": {
      "size": [
         1.896189,
         1.579474,
         1.2027
      ],
      "minY": 0.0,
      "tris": 15000,
      "bytes": 797168
   },
   "m2WindFan": {
      "size": [
         1.70362,
         1.90129,
         0.962681
      ],
      "minY": 0.0,
      "tris": 3000,
      "bytes": 89280
   },
   "m2WindTubeBg": {
      "size": [
         1.899533,
         1.473002,
         1.463314
      ],
      "minY": 0.0,
      "tris": 3000,
      "bytes": 159524
   },
   "m2FactoryDrone": {
      "size": [
         1.900123,
         1.819927,
         0.856706
      ],
      "minY": 0.0,
      "tris": 18000,
      "bytes": 520636
   }
} as const;
const prop = (id: keyof typeof GLB_BOUNDS, width: number): ModelAsset => ({
   id, url: `/models/3d/wind-tunnel-escape/${id}.glb`,
   scale: width / GLB_BOUNDS[id].size[0], fallback: "cylinder", fallbackColor: "#54cce7",
   budget: { tris: Math.max(18000, GLB_BOUNDS[id].tris), bytes: 1100000 },
});
export const ASSETS = {
   hero: heroModelAsset("nami"),
   fan: prop("m2WindFan", 2.1),
   vent: prop("m2AirVent", 2.6),
   post: prop("m2AnemometerPost", 1.3),
   lift: prop("m2FanLiftPlatform", 4.4),
   crate: prop("m2FlyingCrate", 1.4),
   boss: prop("m2GaleEngineBoss", 8),
   tube: prop("m2WindTubeBg", 18),
   drone: prop("m2FactoryDrone", 1.4),
};
