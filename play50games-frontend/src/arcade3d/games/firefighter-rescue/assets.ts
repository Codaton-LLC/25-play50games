// Models for Firefighter Rescue. GLBs are not in the manifest yet, so every url under
// /models/3d/firefighter-rescue/ draws its fallback. The door is the shared escape-room mesh.
// Claude's assets PR copies the GLBs, lists them, and replaces these placeholder scales.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET, REUSED_ASSETS, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({
   id,
   url: `/models/3d/firefighter-rescue/${id}.glb`,
   fallback,
   fallbackColor,
   budget,
});

/** Door leaf 1.10 m wide and 2.05 m tall (REUSED_GLB_SIZE.door). */
const DOOR_HEIGHT = 2.05;
const DOOR_SCALE = DOOR_HEIGHT / REUSED_GLB_SIZE.door.height;
const DOOR_WIDTH = REUSED_GLB_SIZE.door.width * DOOR_SCALE;

export const FIREFIGHTER_HEIGHT = 1.82;

export const ASSETS = {
   firefighter: {
      ...local("charFirefighter", "capsule", "#b91c1c", CHARACTER_BUDGET),
      humanoid: {},
   },
   extinguisher: local("fireExtinguisher", "cylinder", "#dc2626"),
   hydrant: local("fireHydrant", "cylinder", "#b91c1c"),
   hoseReel: local("hoseReel", "cylinder", "#44403c"),
   truck: local("fireTruck", "box", "#ef4444"),
   exitSign: local("exitSignV2", "box", "#16a34a"),
   sofa: local("sofa", "box", "#78716c"),
   bed: local("bed", "box", "#a8a29e"),
   cabinet: local("cabinet", "box", "#57534e"),
   chair: local("woodenChair", "box", "#92400e"),
   civilian: local("civilianNpc", "capsule", "#e7e5e4", CHARACTER_BUDGET),
   door: {
      ...REUSED_ASSETS.door,
      scale: DOOR_SCALE,
      stretch: [1.1 / DOOR_WIDTH, 1, 1] as const,
   },
} satisfies Record<string, ModelAsset>;
