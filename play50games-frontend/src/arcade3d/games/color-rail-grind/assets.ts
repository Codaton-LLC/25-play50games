// Color Rail Grind's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts).
// This game's props live in public/models/3d/color-rail-grind, copied from ready/menu2/color-rail-grind
// (the rail, the track, the switch lever, the junction frog, the buffer stop, the launch ramp, the grind
// ring, the support pillar, the elevated rail viaduct, the Clockwork Express, the toy wagon) and from
// ready/menu2/snow-slide-dash (the snow pine and the snow cabin, the card's village). The icicle is
// ice-peak-jumper's, by its manifest line (no copy). Every GLB is one mesh, feet on y = 0, centred on x
// and z. GLB_SIZE is the real bounds (assets.test.ts).
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";

/** Raw GLB bounds (x, y, z), measured on the meshopt-decoded meshes. */
export const GLB_SIZE = {
   // a single grind rail beam (the rails, stretched along z)
   rail: { x: 0.3875, y: 0.4965, z: 1.9054 },
   // a section of track with its sleepers (under the branches)
   track: { x: 1.7366, y: 1.22, z: 1.8975 },
   // a switch lever box
   lever: { x: 1.9065, y: 0.6828, z: 1.7599 },
   // a junction frog
   frog: { x: 1.5168, y: 0.5228, z: 1.9031 },
   // a buffer stop beam (a dead end's)
   buffer: { x: 1.8987, y: 0.33, z: 0.163 },
   // a launch ramp
   ramp: { x: 1.3531, y: 0.3652, z: 1.8918 },
   // a grind ring lying flat (stood up on its rail)
   ring: { x: 1.8954, y: 0.6197, z: 1.8922 },
   // a support pillar
   pillar: { x: 0.821, y: 1.886, z: 0.8333 },
   // an elevated rail viaduct (background)
   viaduct: { x: 0.7649, y: 0.7652, z: 1.8984 },
   // the Clockwork Express, front towards +z
   express: { x: 0.6741, y: 1.2015, z: 1.9027 },
   // a toy train wagon
   wagon: { x: 1.0301, y: 0.9864, z: 1.881 },
   // the village
   pine: { x: 1.7638, y: 1.8025, z: 1.8958 },
   cabin: { x: 1.9, y: 1.2809, z: 1.8713 },
   // ice-peak-jumper's icicle cluster
   icicle: { x: 1.8697, y: 1.9069, z: 1.0013 },
} as const;

/** The rails stand this high over the snow (m: on their pillars); the snow at -RAIL_LIFT. */
export const RAIL_LIFT = 1.5;
/** A rail beam drawn per this many metres of rail (the GLB stretched along z). */
export const RAIL_STRETCH = 4;
export const RAIL_PIECE_M = GLB_SIZE.rail.z * RAIL_STRETCH;
/** A wagon drawn 1.25 m tall (TRAIN.roof: a jump clears it); two make a toy train (4.7 m: TRAIN.half). */
export const WAGON_SCALE = 1.25 / GLB_SIZE.wagon.y;
/** The Clockwork Express drawn 3.4 m tall (its roof at EXPRESS.roofY ~ 2.5 m over the rail), 5.4 m long. */
export const EXPRESS_SCALE = 2.85;
/** A grind ring 2.6 m across, stood up over its rail. */
export const RING_SCALE = 2.6 / GLB_SIZE.ring.x;

const prop = (id: string, color: string, budget: { tris: number; bytes: number } = PROP_BUDGET, folder = "color-rail-grind"): ModelAsset => ({
   id,
   url: `/models/3d/${folder}/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("zuno"),
   rail: prop("m2RailSegmentV2", "#b8c2cc"),
   track: prop("m2RailSegment", "#8a5a3a"),
   lever: prop("m2RailSwitch", "#c99a3a"),
   frog: prop("m2RailJunction", "#9aa6b8"),
   buffer: prop("m2RailJunctionV2", "#ef4444"),
   ramp: prop("m2RailLaunchRamp", "#c99a3a"),
   ring: { ...prop("m2GrindRing", "#ffd257"), fallback: "cylinder" },
   pillar: prop("m2SupportPillar", "#8a5a3a"),
   viaduct: prop("m2ElevatedRailBg", "#8a7f6c"),
   // the Express is a 15k-triangle character-class model: the character budget
   express: { ...prop("m2ClockworkTrainBoss", "#b8c2cc", CHARACTER_BUDGET), fallback: "box" },
   wagon: prop("m2ToyTrainWagon", "#d6a542"),
   pine: prop("m2SnowPine", "#2f6f4a"),
   cabin: prop("m2SnowCabinBg", "#94603c"),
   icicle: prop("m2Icicle", "#bfe3f7", PROP_BUDGET, "ice-peak-jumper"),
};
