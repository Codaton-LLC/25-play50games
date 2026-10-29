// Toy Room Run's models. The five heroes are the shared Menu 2 heroes (menu2/heroModels.ts). This
// game's toys are in public/models/3d/toy-room-run (from ready/menu2/toy-room-run); the gem is
// Color City Sprint's m2EnergyGem and the checkpoint the menu2 beacon (reused by url, already in the
// manifest). Every GLB is one mesh, feet on y = 0, centred on x and z, facing +z. GLB_SIZE is the
// measured raw bounds; each fit below turns it into the rules' metres.
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { CAR_HALF_L, CAR_HALF_W, CAR_ROOF, DRUM_R, DRUM_TOP, PENCIL_H, PENCIL_LEN, TOP_R } from "./room";

export const GLB_SIZE = {
   domino: { x: 1.9052, y: 0.8379, z: 1.8863 },
   book: { x: 1.4878, y: 1.8984, z: 1.7057 },
   pencil: { x: 0.4076, y: 0.289, z: 1.9026 },
   key: { x: 1.8988, y: 0.6375, z: 1.7037 },
   blocks: { x: 1.6801, y: 1.3797, z: 1.8997 },
   top: { x: 1.8477, y: 1.2767, z: 1.8989 },
   drum: { x: 1.8609, y: 1.3384, z: 1.8877 },
   car: { x: 1.0918, y: 0.7762, z: 1.9072 },
   castle: { x: 1.8798, y: 1.9002, z: 1.5956 },
   jack: { x: 1.523, y: 1.9065, z: 1.8921 },
   windKey: { x: 1.138, y: 1.8995, z: 0.2677 },
} as const;

const own = (id: string, color: string, budget: { tris: number; bytes: number } = PROP_BUDGET): ModelAsset => ({
   id,
   url: `/models/3d/toy-room-run/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget,
});

const CAR_S = (CAR_HALF_L * 2) / GLB_SIZE.car.z;
const DRUM_S = (DRUM_R * 2) / GLB_SIZE.drum.x;
const PENCIL_S = PENCIL_LEN / GLB_SIZE.pencil.z;
const TOP_S = (TOP_R * 1.8) / GLB_SIZE.top.x;

/**
 * The chain pieces carry no asset scale: Course.tsx places each one through its own standing matrix
 * (PIECE_W x PIECE_H x the slab thickness), the domino and the keyboard turned up on end, the books
 * as they stand.
 */
export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("zuno"),
   domino: own("m2ToyDomino", "#f5deb3"),
   book: own("m2BookStack", "#b45309"),
   key: own("m2KeyboardKeyV2", "#e5e7eb"),
   pencil: { ...own("m2GiantPencil", "#facc15"), scale: PENCIL_S, stretch: [1.8 / (GLB_SIZE.pencil.x * PENCIL_S), (PENCIL_H * 0.6) / (GLB_SIZE.pencil.y * PENCIL_S), 1] },
   blocks: own("m2ToyBlocks", "#38bdf8"),
   top: { ...own("m2SpinningTop", "#ef4444"), scale: TOP_S },
   drum: { ...own("m2ToyDrum", "#dc2626"), scale: DRUM_S, stretch: [1, DRUM_TOP / (GLB_SIZE.drum.y * DRUM_S), 1] },
   car: { ...own("m2ToyRaceCar", "#ef4444"), scale: CAR_S, stretch: [(CAR_HALF_W * 2) / (GLB_SIZE.car.x * CAR_S), CAR_ROOF / (GLB_SIZE.car.y * CAR_S), 1] },
   castle: own("m2ToyCastleBg", "#facc15"),
   jack: { ...own("m2JackBoxBoss", "#60a5fa", CHARACTER_BUDGET), scale: 3.4 / GLB_SIZE.jack.y },
   windKey: { ...own("m2WindUpKey", "#d4a373"), scale: 2.4 / GLB_SIZE.windKey.y },
   gem: { id: "m2EnergyGem", url: "/models/3d/color-city-sprint/m2EnergyGem.glb", fallback: "box", fallbackColor: "#fde68a", budget: PROP_BUDGET, scale: 0.6 / 1.8655 },
   beacon: { id: "checkpointBeacon", url: "/models/3d/menu2/checkpointBeacon.glb", fallback: "box", fallbackColor: "#38bdf8", budget: PROP_BUDGET },
};
