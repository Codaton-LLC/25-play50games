// Temple Gong Timing's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts).
// This game's props live in public/models/3d/temple-gong-timing (copied from
// ~/.play50/hyper3d/ready/menu2/temple-gong-timing), and so does its copy of World 3's shared guardian
// pair m2CoilstoneHead / m2CoilstoneSegment (ready/menu2/shared). The Great Gong is the code-built
// menu2/props GreatGong (the m2GreatGong GLB is not used). The echo orb is menu2's scoreOrb.
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds (assets.test.ts).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

export const GLB_SIZE = {
   /** m2TempleGong: a bronze gong in its stone frame (face along z) */
   gong: { x: 1.895, y: 1.895, z: 0.957 },
   /** m2StrikerPost: the carved post a gong stands on */
   post: { x: 1.229, y: 1.899, z: 1.204 },
   /** m2GongStage: the round ruin stage floor */
   stage: { x: 1.899, y: 0.169, z: 1.894 },
   /** m2CeremonyDrum: a hold-note drum */
   drum: { x: 1.901, y: 1.892, z: 1.866 },
   /** m2RuinLanternPillar: a lantern pillar (Nami's high gongs sit on top; the lanterns call the patterns) */
   pillar: { x: 1.085, y: 1.898, z: 1.115 },
   /** m2TimingRing: the flat ring that shrinks onto a gong */
   ring: { x: 1.879, y: 0.334, z: 1.903 },
   /** m2JungleRuinBg: ruin walls round the arena (the hidden ninth gong is among them) */
   ruin: { x: 1.896, y: 1.075, z: 1.052 },
   /** World 3's guardian (level 5) */
   coilHead: { x: 1.372, y: 1.549, z: 1.909 },
   coilSegment: { x: 1.917, y: 1.795, z: 1.619 },
   /** the shared menu2 colour orb (the echo orbs) */
   orb: { x: 1.767, y: 1.901, z: 1.77 },
} as const;

/** A gong is drawn 2.4 m across; its post 1.6 m tall, the gong's centre at about 1.9 m. */
export const GONG_W = 2.4;
export const POST_H = 1.4;
/** The stage floor is drawn as wide as the stage (STAGE_R x 2), 0.3 m thick. */
export const STAGE_H = 0.3;
/** A drum is drawn 1.6 m wide; a pillar 3.4 m tall; an echo orb 0.45 m. */
export const DRUM_W = 1.6;
export const ECHO_SIZE = 0.45;

const prop = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/temple-gong-timing/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("kiro"),
   gong: prop("m2TempleGong", "#c08a3c"),
   post: prop("m2StrikerPost", "#7d7158"),
   stage: prop("m2GongStage", "#b7a98a"),
   drum: prop("m2CeremonyDrum", "#a8784a"),
   pillar: prop("m2RuinLanternPillar", "#8f8b80"),
   ring: prop("m2TimingRing", "#fef3c7"),
   ruin: prop("m2JungleRuinBg", "#7d7158"),
   coilHead: { id: "m2CoilstoneHead", url: "/models/3d/temple-gong-timing/m2CoilstoneHead.glb", fallback: "box", fallbackColor: "#2f6f55", budget: CHARACTER_BUDGET },
   coilSegment: { id: "m2CoilstoneSegment", url: "/models/3d/temple-gong-timing/m2CoilstoneSegment.glb", fallback: "sphere", fallbackColor: "#2f6f55", budget: CHARACTER_BUDGET },
   orb: { id: "scoreOrb", url: "/models/3d/menu2/scoreOrb.glb", fallback: "sphere", fallbackColor: "#86efac", budget: PROP_BUDGET },
};
