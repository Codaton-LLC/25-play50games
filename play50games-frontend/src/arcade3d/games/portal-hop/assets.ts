// Portal Hop's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts, each its
// own GLB). This game's props live in public/models/3d/portal-hop (copied from
// ~/.play50/hyper3d/ready/menu2/portal-hop): the entry frames, the exit frame, the anchor obelisks and
// their pads, the void crystals (cargo and the Wyrm's body), the beacon spikes, the floating ruins and
// the Portal Wyrm's head. The floating islands are the shared menu2 islandA-D, the colour orb menu2's
// scoreOrb. Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds
// (assets.test.ts measures each mesh with the repo's own GLB reader).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   /** m2PortalFrame: an entry frame (its opening faces z) */
   frame: { x: 1.899, y: 1.823, z: 1.877 },
   /** m2PortalFrameV2: the exit frame, opened in front of the selected anchor */
   exitFrame: { x: 1.895, y: 1.818, z: 1.884 },
   /** m2GlowObelisk: an anchor */
   obelisk: { x: 1.206, y: 1.891, z: 1.233 },
   /** m2PortalAnchorPad: the stone disc an obelisk stands on */
   anchorPad: { x: 1.892, y: 0.858, z: 1.889 },
   /** m2PortalIsle: the stone rim round a floor pad */
   isle: { x: 1.895, y: 0.389, z: 1.902 },
   /** m2VoidCrystal: a cargo block (level 4), a Wyrm body segment (level 5) */
   crystal: { x: 1.565, y: 1.487, z: 1.901 },
   /** m2ColorBeacon: a beacon spike (level 5) */
   beacon: { x: 0.485, y: 1.91, z: 0.448 },
   /** m2FloatingRuinBg: ruins drifting in the void */
   ruin: { x: 1.902, y: 1.106, z: 1.563 },
   /** m2PortalWyrmBoss: the Wyrm's head (its snout along z) */
   wyrmHead: { x: 0.902, y: 1.652, z: 1.902 },
   /** the shared menu2 floating islands; islandA's grass top is 0.46 over its foot */
   islandA: { x: 1.892, y: 0.51, z: 1.9, top: 0.46 },
   islandB: { x: 1.918, y: 1.439, z: 1.816 },
   islandC: { x: 1.498, y: 1.849, z: 1.666 },
   islandD: { x: 1.761, y: 1.571, z: 1.89 },
   /** the shared menu2 colour orb */
   orb: { x: 1.767, y: 1.901, z: 1.77 },
} as const;

/** A frame is drawn 2.4 m wide (its opening the rules' FRAME_HALF_W); an obelisk 2.4 m tall. */
export const FRAME_W = 2.4;
export const OBELISK_H = 2.4;
/** An island's slab is drawn this thick under its top; the orb 0.55 m; the Wyrm's head 3 m long. */
export const ISLAND_SY = 1.6;
export const ORB_SIZE = 0.55;
export const WYRM_HEAD_LEN = 3;
export const WYRM_SEG = 1.4;

const prop = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/portal-hop/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

const menu2 = (id: string, color: string): ModelAsset => ({ id, url: `/models/3d/menu2/${id}.glb`, fallback: "box", fallbackColor: color, budget: PROP_BUDGET });

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("vexa"),
   frame: prop("m2PortalFrame", "#6d28d9"),
   exitFrame: prop("m2PortalFrameV2", "#22d3ee"),
   obelisk: prop("m2GlowObelisk", "#4c1d95"),
   anchorPad: prop("m2PortalAnchorPad", "#334155"),
   isle: prop("m2PortalIsle", "#475569"),
   crystal: prop("m2VoidCrystal", "#7c3aed"),
   beacon: prop("m2ColorBeacon", "#f0abfc"),
   ruin: prop("m2FloatingRuinBg", "#64748b"),
   wyrmHead: { id: "m2PortalWyrmBoss", url: "/models/3d/portal-hop/m2PortalWyrmBoss.glb", fallback: "box", fallbackColor: "#6d28d9", budget: CHARACTER_BUDGET },
   islandA: menu2("islandA", "#64748b"),
   islandB: menu2("islandB", "#64748b"),
   islandC: menu2("islandC", "#64748b"),
   islandD: menu2("islandD", "#64748b"),
   orb: { id: "scoreOrb", url: "/models/3d/menu2/scoreOrb.glb", fallback: "sphere", fallbackColor: "#c084fc", budget: PROP_BUDGET },
};
