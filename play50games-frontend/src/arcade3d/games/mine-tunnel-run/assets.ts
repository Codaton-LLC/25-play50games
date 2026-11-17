import type { ModelAsset } from "../../core/types";
import { heroModelAsset } from "../../menu2/heroModels";

// Bounds measured from the ready GLBs' POSITION accessors (GLB units). Each GLB's root node lifts its
// mesh so the base sits on y = 0: a spot's y is the prop's foot.
export const BOUNDS = {
   rock: { x: 1.831, y: 0.96, z: 1.907 },
   lantern: { x: 0.801, y: 1.895, z: 0.708 },
   lift: { x: 0.774, y: 1.895, z: 0.732 },
   cart: { x: 1.07, y: 1.018, z: 1.89 },
   rail: { x: 1.899, y: 0.151, z: 0.832 },
   beetle: { x: 1.744, y: 1.354, z: 1.893 },
   tunneller: { x: 1.896, y: 1.167, z: 1.826 },
   boss: { x: 1.55, y: 1.317, z: 1.902 },
   pile: { x: 1.861, y: 0.804, z: 1.902 },
   crystal: { x: 1.912, y: 1.421, z: 1.857 },
   mushrooms: { x: 1.9, y: 1.265, z: 1.518 },
   hanging: { x: 1.414, y: 1.887, z: 0.956 },
   stalagmites: { x: 1.908, y: 1.661, z: 1.169 },
   scaffold: { x: 1.899, y: 1.504, z: 1.812 },
   entrance: { x: 1.878, y: 1.553, z: 1.878 },
   beam: { x: 1.352, y: 1.892, z: 1.483 },
   soilSet: { x: 1.896, y: 0.467, z: 1.815 },
   crate: { x: 1.885, y: 1.229, z: 1.832 },
};

const prop = (id: string, scale: number, color: string, tris: number, bytes: number, extra: Partial<ModelAsset> = {}): ModelAsset => ({
   id,
   url: `/models/3d/mine-tunnel-run/${id}.glb`,
   scale,
   fallback: "box",
   fallbackColor: color,
   budget: { tris, bytes },
   ...extra,
});

/** Metres as drawn (a cell is 1.6 m). */
export const SIZE = {
   boulder: 1.42,
   lantern: 0.62,
   liftH: 1.75,
   liftW: 1.45,
   cart: 1.35,
   beetle: 1.05,
   boss: 4.6,
   pile: 1.7,
} as const;

export const ASSETS = {
   hero: heroModelAsset("riko"),
   boulder: prop("m2CaveRock", SIZE.boulder / BOUNDS.rock.z, "#6b5b73", 1500, 87628, { stretch: [1, 1.65, 1] }),
   lantern: prop("m2MineLanternPost", SIZE.lantern / BOUNDS.lantern.y, "#ea580c", 3000, 140860),
   lift: prop("m2MineLiftCage", SIZE.liftH / BOUNDS.lift.y, "#1f2937", 3000, 97684, {
      stretch: [SIZE.liftW / (BOUNDS.lift.x * (SIZE.liftH / BOUNDS.lift.y)), 1, SIZE.liftW / (BOUNDS.lift.z * (SIZE.liftH / BOUNDS.lift.y))],
   }),
   cart: prop("m2OreCart", SIZE.cart / BOUNDS.cart.z, "#2563eb", 3000, 171588, { rotationY: Math.PI / 2 }),
   rail: prop("mineRailI", 1.6 / BOUNDS.rail.x, "#78350f", 3000, 166624),
   beetle: prop("m2CaveBeetle", SIZE.beetle / BOUNDS.beetle.z, "#0f766e", 3000, 145212),
   tunneller: prop("m2CaveBeetleR", SIZE.beetle / BOUNDS.tunneller.x, "#115e59", 3000, 119908),
   // the drained giant: one stone-grey material over the whole beetle (the GLB's teal glow spots would
   // survive a tint), its shape read from the geometry and the lights
   boss: prop("caveBeetleI", SIZE.boss / BOUNDS.boss.z, "#6b7280", 3000, 182600, { material: { color: "#8a8480", roughness: 0.72, metalness: 0.18 } }),
   pile: prop("m2RockfallPile", SIZE.pile / BOUNDS.pile.x, "#78716c", 3000, 159968),
   crystal: prop("m2CrystalCluster", 0.9 / BOUNDS.crystal.x, "#7c3aed", 1500, 118740),
   mushrooms: prop("m2GlowMushrooms", 0.95 / BOUNDS.mushrooms.x, "#a855f7", 1500, 115228),
   hanging: prop("m2HangingCrystal", 0.9 / BOUNDS.hanging.y, "#38bdf8", 1500, 130436),
   stalagmites: prop("m2Stalagmites", 1.0 / BOUNDS.stalagmites.x, "#6d28d9", 1500, 112768),
   scaffold: prop("m2MineScaffold", 4.2 / BOUNDS.scaffold.x, "#a16207", 1500, 108928),
   entrance: prop("m2MineEntranceBg", 6 / BOUNDS.entrance.x, "#a8a29e", 3000, 155712),
   beam: prop("m2MineBeam", 4.2 / BOUNDS.beam.y, "#92400e", 1500, 101844),
   soilSet: prop("m2SoilBlockSet", 2.4 / BOUNDS.soilSet.x, "#78350f", 1500, 78828),
   crate: prop("m2FactoryCrate", 0.9 / BOUNDS.crate.x, "#9ca3af", 1500, 84460),
};
