// Models for Submarine Treasure Dive (public/models/3d/submarine-treasure-dive/*.glb, all in the manifest).
// Every fit comes from the measured GLB bounds below (Rodin makes the longest side about 1.9);
// assets.test.ts checks the drawn size on the real meshes.
//
// Two kinds of fit. Treasures, the sub, the jellies, the fish, the dock and the columns are drawn at
// their size in metres (`scale`). The reef (rocks, coral, arches, anchors, kelp, wrecks) is instanced
// from spots in Scene.tsx whose `scale` is the object's size in metres, so those assets are UNIT
// models: `scale` makes the longest side 1 m and the spot scales it, never twice.
import type { ModelAsset } from "@/arcade3d/core/types";
import { COIN_GLB_SIZE, EXPANSION_ASSETS, EXPANSION_GLB_SIZE, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

/** Measured GLB bounds (width x height x depth, GLB units). */
export const GLB_SIZE = {
   sub: { x: 0.736, y: 0.857, z: 1.898 },
   amphora: { x: 1.323, y: 1.899, z: 1.216 },
   anchor: { x: 1.276, y: 1.912, z: 0.349 },
   shell: { x: 1.902, y: 1.3, z: 1.751 },
   arch: { x: 1.894, y: 1.347, z: 1.228 },
   column: { x: 0.842, y: 1.903, z: 0.829 },
   wreck: { x: 0.864, y: 1.237, z: 1.86 },
   jellyfish: { x: 1.503, y: 1.896, z: 1.413 },
   dock: { x: 1.835, y: 1.09, z: 1.905 },
   coral: { x: 1.913, y: 1.609, z: 1.754 },
   seaweed: { x: 1.362, y: 1.69, z: 1.586 },
   fish: { x: 0.533, y: 1.262, z: 1.897 },
   reefRock: { x: 1.892, y: 1.283, z: 1.778 },
} as const;

type Size = { x: number; y: number; z: number };
const longest = (s: Size) => Math.max(s.x, s.y, s.z);

/** The sub's length in metres (its collision radius is 0.9). */
export const SUB_LENGTH = 1.8;
export const AMPHORA_HEIGHT = 0.8;
export const SHELL_WIDTH = 0.7;
export const JELLY_HEIGHT = 1.5;
export const DOCK_WIDTH = 4;
export const FISH_LENGTH = 0.55;
/** A fallen ruin column's drawn length and its width, metres. */
export const COLUMN_SCALE = 1.15;
/** The wreck's height next to its length (the GLB's own is taller than the box it stands in). */
export const WRECK_SQUASH = 0.72;

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   extra: Partial<ModelAsset> = {},
): ModelAsset => ({ id, url: `/models/3d/submarine-treasure-dive/${id}.glb`, fallback, fallbackColor, budget: PROP_BUDGET, ...extra });

export const ASSETS = {
   miniSubmarine: local("miniSubmarine", "capsule", "#e2e8f0", { scale: SUB_LENGTH / GLB_SIZE.sub.z }),
   amphora: local("amphora", "cylinder", "#d6b48a", { scale: AMPHORA_HEIGHT / GLB_SIZE.amphora.y }),
   pearlShell: local("pearlShellV2", "sphere", "#f8fafc", { scale: SHELL_WIDTH / GLB_SIZE.shell.x }),
   anchor: local("anchor", "box", "#1e293b", { scale: 1 / longest(GLB_SIZE.anchor) }),
   rockArch: local("rockArch", "box", "#57534e", { scale: 1 / longest(GLB_SIZE.arch) }),
   ruinColumn: local("ruinColumn", "cylinder", "#e7e5e4", { scale: COLUMN_SCALE, yOffset: -(GLB_SIZE.column.y * COLUMN_SCALE) / 2 }),
   /** shipwreckI lists on its side on rocks; its long axis (z) is turned to the box's x. */
   wreck: local("shipwreckI", "box", "#44403c", { scale: 1 / longest(GLB_SIZE.wreck), rotationY: Math.PI / 2 }),
   jellyfish: local("jellyfish", "sphere", "#e879f9", { scale: JELLY_HEIGHT / GLB_SIZE.jellyfish.y }),
   subDock: local("subDock", "cylinder", "#0f766e", { scale: DOCK_WIDTH / GLB_SIZE.dock.z }),
   coral: local("coralI", "sphere", "#fb7185", { scale: 1 / longest(GLB_SIZE.coral) }),
   seaweed: local("seaweedKelp", "cylinder", "#15803d", { scale: 1 / longest(GLB_SIZE.seaweed) }),
   tropicalFish: local("tropicalFish", "capsule", "#fb923c", { scale: FISH_LENGTH / GLB_SIZE.fish.z }),
   aquariumRock: local("aquariumRock", "sphere", "#78716c", { scale: 1 / longest(GLB_SIZE.reefRock) }),
   chest: EXPANSION_ASSETS.chest,
   coin: { ...SHARED_ASSETS.coin, scale: 0.34 / COIN_GLB_SIZE.width, stretch: [1, 1, 0.55] as const },
   /** the boulders: the shared rock as a unit model (the spot sets its size) */
   rock: { ...EXPANSION_ASSETS.rock, id: "sub-boulder", scale: 1 / longest({ x: EXPANSION_GLB_SIZE.rock.width, y: EXPANSION_GLB_SIZE.rock.height, z: EXPANSION_GLB_SIZE.rock.depth }) },
   fish: EXPANSION_ASSETS.fish,
} satisfies Record<string, ModelAsset>;
