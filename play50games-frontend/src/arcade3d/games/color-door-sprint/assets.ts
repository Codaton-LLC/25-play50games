// Color Door Sprint's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts).
// This game's props live in public/models/3d/color-door-sprint, copied from ready/menu2/color-door-sprint
// (the doorway, the sliding door, the arch wall, the arch corridor, the chevron speed pad, the orb) and
// ready/menu2/shared (m2FireSpirit: Flicker; m2MineLanternPost: the rule lamp). Every GLB is one mesh,
// feet on y = 0, centred on x and z, front towards +z. GLB_SIZE is the real bounds (assets.test.ts).
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { LANE_W } from "./halls";

/** Raw GLB bounds (x, y, z), measured on the meshopt-decoded meshes. */
export const GLB_SIZE = {
   // a steel door in its frame (the coloured doors, tinted per door)
   doorway: { x: 1.1886, y: 1.8936, z: 0.5928 },
   // a double sliding steel door in its frame (the shut doors)
   sliding: { x: 1.2444, y: 1.8982, z: 0.1686 },
   // a slab of stone blocks with a rounded top (the hall's side walls)
   archWall: { x: 1.9076, y: 1.8475, z: 0.1578 },
   // a stone arcade (the galleries beyond the side walls)
   arcade: { x: 1.898, y: 0.7222, z: 0.7244 },
   // a glowing-rimmed floor pad
   pad: { x: 1.657, y: 0.1943, z: 1.8974 },
   // an old lantern with a ring on top (the rule lamp)
   lantern: { x: 0.801, y: 1.895, z: 0.7082 },
   // a caged orb on a little base
   orb: { x: 1.7668, y: 1.9012, z: 1.77 },
   // Flicker, the Fire Spirit, front towards +z
   spirit: { x: 1.2972, y: 1.8982, z: 0.4854 },
} as const;

/** A door is drawn this wide (m): the lane less its pillars. Its height follows the GLB. */
export const DOOR_W = LANE_W - 0.42;
export const DOOR_SCALE = DOOR_W / GLB_SIZE.doorway.x;
export const DOOR_H = GLB_SIZE.doorway.y * DOOR_SCALE;
/** The shut doors fill the same opening. */
export const SHUT_SCALE_X = DOOR_W / GLB_SIZE.sliding.x;
export const SHUT_SCALE_Y = DOOR_H / GLB_SIZE.sliding.y;
/** An orb is drawn 0.75 m tall; the rule lamp 1.5 m; Flicker x4 (the card) = 7.6 m. */
export const ORB_H = 0.75;
export const LANTERN_H = 1.5;
export const SPIRIT_SCALE = 4;
/** A side-wall slab is drawn 9 m wide and 4 m tall (3k triangles each: few, wide slabs keep the frame light). */
export const SLAB = { w: 9, h: 4 } as const;

const prop = (id: string, color: string, budget: { tris: number; bytes: number } = PROP_BUDGET): ModelAsset => ({
   id,
   url: `/models/3d/color-door-sprint/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   // the coloured doors: one bright steel look tinted per door
   doorway: { ...prop("m2DoorwayV2", "#cbd5e1"), material: { color: "#ffffff", roughness: 0.38, metalness: 0.25 } },
   sliding: prop("m2SlidingDoor", "#64748b"),
   archWall: prop("m2ArchWallV2", "#a8a29e"),
   arcade: prop("m2ArchCorridorBgV2", "#a8a29e"),
   pad: prop("m2ChevronSpeedPad", "#f59e0b"),
   lantern: prop("m2MineLanternPost", "#b45309"),
   orb: { ...prop("m2ScoreOrb", "#38bdf8"), fallback: "sphere" },
   // Flicker is an 18k-triangle character model: the character budget
   spirit: { ...prop("m2FireSpirit", "#f97316", CHARACTER_BUDGET), fallback: "capsule" },
};
