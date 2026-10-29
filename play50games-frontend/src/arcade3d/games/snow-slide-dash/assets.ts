import type { ModelAsset } from "../../core/types";
import { PROP_BUDGET, CHARACTER_BUDGET } from "../../core/sharedAssets";
import { heroModelAsset, M2_HERO_IDS } from "../../menu2/heroModels";

// Bounds are from the committed GLB POSITION accessors (29 Oct). Nodes put every sole at y=0.
export const GLB_SIZE = {
   pine: [1.763798, 1.802488, 1.895764], rock: [1.908058, 1.389473, 1.642364],
   gate: [1.895989, 1.624946, 0.658634], ramp: [1.531183, 0.459869, 1.888694],
   star: [1.680689, 1.899154, 0.403060], snowman: [1.656825, 1.898938, 1.442050],
   cabin: [1.900028, 1.280935, 1.871304], sled: [0.847887, 0.632834, 1.904606],
   yeti: [1.549706, 1.903382, 1.009992], ball: [1.836071, 1.906621, 1.872277],
   crack: [1.901954, 0.187204, 1.371867],
} as const;
function prop(id: string, scale: number, folder = "snow-slide-dash"): ModelAsset {
   return { id, url: `/models/3d/${folder}/${id}.glb`, scale, fallback: "box", fallbackColor: "#b9e2ed", budget: PROP_BUDGET };
}
export const ASSETS: Record<string, ModelAsset> = {
   ...Object.fromEntries(M2_HERO_IDS.map((id) => [`hero-${id}`, heroModelAsset(id)])),
   pine: prop("m2SnowPine", 5 / GLB_SIZE.pine[1]),
   rock: prop("m2SnowRock", 1.8 / GLB_SIZE.rock[1]),
   gate: { ...prop("m2IceGate", 1), stretch: [8 / GLB_SIZE.gate[0], 4.3 / GLB_SIZE.gate[1], 1.2 / GLB_SIZE.gate[2]] },
   ramp: { ...prop("m2SnowJumpRamp", 1), stretch: [6.5 / GLB_SIZE.ramp[0], 1.2 / GLB_SIZE.ramp[1], 4 / GLB_SIZE.ramp[2]] },
   star: prop("m2FrostStar", 0.7 / GLB_SIZE.star[1]),
   snowman: prop("m2Snowman", 2.4 / GLB_SIZE.snowman[1]),
   cabin: prop("m2SnowCabinBg", 12 / GLB_SIZE.cabin[0]),
   sled: prop("m2ToySled", 2.8 / GLB_SIZE.sled[2]),
   yeti: { ...prop("m2SnowYeti", 3 * 2.4 / GLB_SIZE.yeti[1], "ice-peak-jumper"), budget: CHARACTER_BUDGET },
   ball: prop("m2Snowball", 1.5 / GLB_SIZE.ball[1], "ice-peak-jumper"),
   crack: prop("m2CrackedIcePlatform", 5, "ice-peak-jumper"),
};
