// Temple Lantern Jump's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts,
// each its own GLB); the Soot Bat Queen is the shared m2CaveBat at 4x. This game's props live in
// public/models/3d/temple-lantern-jump (the colour orb is the shared menu2 scoreOrb).
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds
// (assets.test.ts measures each mesh with the repo's own GLB reader).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   /** m2StoneCageLantern: the bronze-and-stone cage lantern, the bounce pad (its top is the cage's lid) */
   lantern: { x: 1.193, y: 1.898, z: 1.398 },
   /** m2LanternDeck: a lantern post that stands on the checkpoint decks */
   deck: { x: 0.936, y: 1.897, z: 0.897 },
   /** m2TempleLedge: the sun-glyph / plain stone slab */
   ledge: { x: 1.9, y: 0.402, z: 1.798 },
   /** m2WoodenBalconyV2: the crumbling wooden balcony */
   balcony: { x: 1.806, y: 1.496, z: 1.9 },
   /** m2StoneBrazier: a gallery brazier (and the giant roof brazier at 2.4x) */
   brazier: { x: 1.896, y: 1.049, z: 1.881 },
   /** m2RuinRoofSection: the golden roof over the arena */
   roof: { x: 1.899, y: 0.792, z: 1.654 },
   /** m2TempleBeam: a roof beam the Queen perches on */
   beam: { x: 1.902, y: 0.533, z: 0.405 },
   /** m2TempleTowerBg: a tower out in the dark */
   tower: { x: 1.345, y: 1.811, z: 1.893 },
   /** m2CaveBat: the soot bat (and the Queen at 4x); wings span x */
   bat: { x: 1.9, y: 1.353, z: 0.567 },
   /** the shared menu2 colour orb */
   orb: { x: 1.767, y: 1.901, z: 1.77 },
} as const;

/** The cage lantern is drawn 1 m tall, its lid on the rules' pad top. */
export const LANTERN_H = 1;
export const LANTERN_SCALE = LANTERN_H / GLB_SIZE.lantern.y;
/** A ledge slab is drawn 2 r wide: scale = 2 r / GLB_SIZE.ledge.x; its top on the pad. */
export const ledgeScale = (r: number): number => (2 * r) / GLB_SIZE.ledge.x;
/** A balcony is drawn 2 r wide. */
export const balconyScale = (r: number): number => (2 * r) / GLB_SIZE.balcony.x;
/** The deck's lantern post is drawn 1.5 m tall. */
export const POST_SCALE = 1.5 / GLB_SIZE.deck.y;
/** A gallery brazier is drawn 0.9 m wide; the roof brazier 4.4 m. */
export const BRAZIER_SCALE = 0.9 / GLB_SIZE.brazier.x;
export const ROOF_BRAZIER_SCALE = 4.4 / GLB_SIZE.brazier.x;
/** A colour orb is drawn 0.62 m tall, its centre on the rules' pickup point. */
export const ORB_SIZE = 0.62;
/** A soot bat is drawn 1.3 m across; the Queen 5.6 m (4x). */
export const BAT_WIDTH = 1.3;
export const QUEEN_WIDTH = BAT_WIDTH * 4.3;
/** The Queen is a character-sized GLB (its own Hyper3D budget): the bat's. */
export const BAT_BUDGET = { ...CHARACTER_BUDGET } as const;

const prop = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/temple-lantern-jump/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("kiro"),
   lantern: prop("m2StoneCageLantern", "#c08a3c"),
   deck: prop("m2LanternDeck", "#9a8a6a"),
   ledge: prop("m2TempleLedge", "#b6a779"),
   balcony: prop("m2WoodenBalconyV2", "#8a5a2b"),
   brazier: prop("m2StoneBrazier", "#7a7468"),
   roof: prop("m2RuinRoofSection", "#c9a23a"),
   beam: prop("m2TempleBeam", "#6b5a3a"),
   tower: prop("m2TempleTowerBg", "#5a6a5a"),
   bat: { id: "m2CaveBat", url: "/models/3d/menu2/m2CaveBat.glb", fallback: "sphere", fallbackColor: "#504758", budget: BAT_BUDGET },
   orb: { id: "scoreOrb", url: "/models/3d/menu2/scoreOrb.glb", fallback: "sphere", fallbackColor: "#4ade80", budget: PROP_BUDGET },
};
