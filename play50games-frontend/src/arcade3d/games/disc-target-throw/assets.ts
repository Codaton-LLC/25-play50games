// Disc Target Throw's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts,
// each its own GLB); the disc is the shared code-built TrainingDisc (menu2/props). This game's props live
// in public/models/3d/disc-target-throw (Hyper3D, ~/.play50/hyper3d/ready/menu2): the hay and stone idol
// targets, the palisade, the score marker posts, the pavilion, the stone columns (from Wall Run Temple),
// the raft (from Tightrope Path), Mother Snapper (m2SnapperPlant at 5x) and the jungle monkey. The colour
// orb is the shared menu2 scoreOrb. Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is
// the real bounds (assets.test.ts measures each mesh with the repo's own GLB reader).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   /** m2HayBaleTarget: a round hay target on legs */
   hay: { x: 1.652, y: 1.889, z: 1.83 },
   /** m2StoneIdolTarget: a stone ring target on a carved pedestal, its face along z */
   idol: { x: 1.4, y: 1.899, z: 0.894 },
   /** m2PalisadeWall: a run of sharpened logs (x long) */
   palisade: { x: 1.88, y: 0.838, z: 0.806 },
   /** m2ScoreMarkerPost: a slim carved post */
   post: { x: 0.533, y: 1.899, z: 0.533 },
   /** m2TrainingPavilionBg: the training pavilion out past the north wall */
   pavilion: { x: 1.894, y: 1.474, z: 1.712 },
   /** m2StoneColumn: a carved stone column (the bank pillars) */
   column: { x: 1.057, y: 1.9, z: 1.055 },
   /** m2RaftPlatform: the drifting raft (level 4) */
   raft: { x: 1.903, y: 0.52, z: 1.892 },
   /** m2SnapperPlant: Mother Snapper (5x) and the potted snappers round the yard */
   snapper: { x: 1.208, y: 1.896, z: 1.38 },
   /** m2JungleMonkey: the disc thieves (level 4) */
   monkey: { x: 1.119, y: 1.901, z: 1.867 },
   /** the shared menu2 colour orb */
   orb: { x: 1.767, y: 1.901, z: 1.77 },
} as const;

/** A hay target is drawn 1.9 m tall; a stone idol 1.9 m; a post 1.7 m; a column 3.2 m (the walls' banks). */
export const HAY_SCALE = 1.9 / GLB_SIZE.hay.y;
export const IDOL_SCALE = 1.9 / GLB_SIZE.idol.y;
export const POST_SCALE = 1.7 / GLB_SIZE.post.y;
export const COLUMN_H = 3.2;
/** A column is drawn 2 r wide at the base (its own proportions up to COLUMN_H). */
export const columnScale = (r: number): [number, number, number] => [(2 * r) / GLB_SIZE.column.x, COLUMN_H / GLB_SIZE.column.y, (2 * r) / GLB_SIZE.column.z];
/** A palisade log run is drawn 1.9 m tall; it tiles along x. */
export const PALISADE_SCALE = 1.9 / GLB_SIZE.palisade.y;
/** The raft is drawn 2 half wide. */
export const raftScale = (half: number): number => (2 * half) / GLB_SIZE.raft.x;
/** Mother Snapper is drawn 9.5 m tall (5x the 1.9 m snapper); the potted ones 1.4 m. */
export const SNAPPER_H = 9.5;
export const SNAPPER_SCALE = SNAPPER_H / GLB_SIZE.snapper.y;
/** A monkey is drawn 1.1 m tall. */
export const MONKEY_SCALE = 1.1 / GLB_SIZE.monkey.y;
/** An orb is drawn 0.6 m tall, its centre on the disc's flight height. */
export const ORB_SIZE = 0.6;
/** The pavilion is drawn 9 m wide out past the north wall. */
export const PAVILION_SCALE = 9 / GLB_SIZE.pavilion.x;

const prop = (id: string, color: string, budget: ModelAsset["budget"] = PROP_BUDGET): ModelAsset => ({
   id,
   url: `/models/3d/disc-target-throw/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("kiro"),
   hay: prop("m2HayBaleTarget", "#d9b45a"),
   idol: prop("m2StoneIdolTarget", "#a89a74"),
   palisade: prop("m2PalisadeWall", "#7a5532"),
   post: prop("m2ScoreMarkerPost", "#8a6a42"),
   pavilion: prop("m2TrainingPavilionBg", "#9a8a6a"),
   column: prop("m2StoneColumn", "#b6a779"),
   raft: prop("m2RaftPlatform", "#8a6a42"),
   snapper: prop("m2SnapperPlant", "#3f7d3a"),
   monkey: prop("m2JungleMonkey", "#6b4a2b", CHARACTER_BUDGET),
   orb: { id: "scoreOrb", url: "/models/3d/menu2/scoreOrb.glb", fallback: "sphere", fallbackColor: "#4ade80", budget: PROP_BUDGET },
};
