import { EXPANSION_ASSETS, EXPANSION_GLB_POINTS, EXPANSION_GLB_SIZE, ROCKET_FEET_GLB } from "@/arcade3d/core/sharedAssets";

export const ROCKET_SCALE = 2.2 / EXPANSION_GLB_SIZE.rocket.height;
export const ASSETS = { rocket: { ...EXPANSION_ASSETS.rocket, scale: ROCKET_SCALE } };
export const BELL = { x: EXPANSION_GLB_POINTS.rocketBell.x * ROCKET_SCALE, y: EXPANSION_GLB_POINTS.rocketBell.y * ROCKET_SCALE, z: EXPANSION_GLB_POINTS.rocketBell.z * ROCKET_SCALE };
export const FEET_3D = ROCKET_FEET_GLB.map((p) => ({ x: p.x * ROCKET_SCALE, y: p.y * ROCKET_SCALE, z: p.z * ROCKET_SCALE }));
export const SUPPORT = [[-0.64138, 0.0005], [0.66023, 0.00989]] as const;
export const HULL_SKIN = 0.012;
// Full counter-clockwise convex hull decoded from all 4,877 fitted mesh vertices.
export const MESH_HULL = [
   [-0.75547, 0.42181], [-0.74458, 0.34241], [-0.73514, 0.29466], [-0.64138, 0.0005],
   [-0.55202, 0.00001], [0.04659, 0], [0.55311, 0], [0.57046, 0.00013],
   [0.65539, 0.00146], [0.66023, 0.00989], [0.74559, 0.33762], [0.75547, 0.45364],
   [0.74283, 0.52723], [0.72965, 0.59397], [0.45731, 1.59772], [0.40644, 1.73089],
   [0.40336, 1.7388], [0.35908, 1.83953], [0.29565, 1.94939], [0.20006, 2.07154],
   [0.07714, 2.18545], [0.05111, 2.19454], [-0.02036, 2.20005], [-0.03095, 2.19594],
   [-0.11446, 2.14901], [-0.22185, 2.02712], [-0.2958, 1.91694], [-0.34618, 1.83198],
   [-0.40852, 1.68597], [-0.42703, 1.63583], [-0.7148, 0.63074], [-0.73604, 0.55634],
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
