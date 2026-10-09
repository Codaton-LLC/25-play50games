import { EXPANSION_ASSETS, EXPANSION_GLB_POINTS, EXPANSION_GLB_SIZE, ROCKET_FEET_GLB } from "@/arcade3d/core/sharedAssets";

export const ROCKET_SCALE = 2.2 / EXPANSION_GLB_SIZE.rocket.height;
export const ASSETS = { rocket: { ...EXPANSION_ASSETS.rocket, scale: ROCKET_SCALE } };
export const BELL = { x: EXPANSION_GLB_POINTS.rocketBell.x * ROCKET_SCALE, y: EXPANSION_GLB_POINTS.rocketBell.y * ROCKET_SCALE, z: EXPANSION_GLB_POINTS.rocketBell.z * ROCKET_SCALE };
export const FEET_3D = ROCKET_FEET_GLB.map((p) => ({ x: p.x * ROCKET_SCALE, y: p.y * ROCKET_SCALE, z: p.z * ROCKET_SCALE }));
export const SUPPORT = [[-0.6414, 0.0005], [0.6602, 0.0099]] as const;
export const HULL_SKIN = 0.012;
// Claude measured all 4,877 fitted vertices; the simplification error is <= 10 mm.
export const MESH_HULL = [
   [-0.7555, 0.4218], [-0.7351, 0.2947], [-0.6414, 0.0005], [0.6602, 0.0099],
   [0.7456, 0.3376], [0.7555, 0.4536], [0.7296, 0.594], [0.4573, 1.5977],
   [0.3591, 1.8395], [0.2001, 2.0715], [0.0511, 2.1945], [-0.031, 2.1959],
   [-0.1145, 2.149], [-0.3462, 1.832], [-0.427, 1.6358], [-0.736, 0.5563],
] as const;
// Intersections of adjacent outward-offset halfplanes. Made once, never in a frame.
export const HULL = MESH_HULL.map((p, i, a) => {
   const prev = a[(i + a.length - 1) % a.length], next = a[(i + 1) % a.length];
   const ax = p[0] - prev[0], ay = p[1] - prev[1], bx = next[0] - p[0], by = next[1] - p[1];
   const al = Math.hypot(ax, ay), bl = Math.hypot(bx, by);
   const nx = ay / al, ny = -ax / al, mx = by / bl, my = -bx / bl;
   const d = nx * my - ny * mx;
   return [p[0] + HULL_SKIN * (my - ny) / d, p[1] + HULL_SKIN * (nx - mx) / d] as const;
});
