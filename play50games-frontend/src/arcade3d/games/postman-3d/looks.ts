import type { PostLevel } from "./levels";
import { OFFICE } from "./rules";

export const COLORS = {
   road: "#64748b", pavement: "#cbd5e1", lawn: "#86efac", accent: "#ef4444",
   navy: "#1e293b", ink: "#0f172a", cream: "#fff7ed", white: "#f8fafc",
   roof: "#475569", glass: "#bae6fd", skin: "#e8b893", bag: "#92400e",
   red: "#ef4444", blue: "#3b82f6", yellow: "#facc15", glow: "#fde68a",
   dog: "#b45309", tree: "#15803d", trim: "#94a3b8",
} as const;
export const HOUSE_COLORS = [COLORS.red, COLORS.blue, COLORS.yellow];
export const FOV = 48;
export const LOOK_AHEAD = 2;
export const CAMERA = { position: [OFFICE.x, 18, 14] as [number, number, number], lookAt: [OFFICE.x, 0, OFFICE.z] as [number, number, number], fov: FOV };
// Fit a local window, translated by the follow rig: address plates stay readable.
export const VIEW = {
   area: { min: { x: OFFICE.x - 8, y: 0, z: OFFICE.z - 9 }, max: { x: OFFICE.x + 8, y: 2, z: OFFICE.z + 9 } },
   pitch: 52 * Math.PI / 180, yaws: [0], shift: true, fov: FOV, padding: 8,
};
export function environmentFor(level: PostLevel) {
   return { background: level.background, fog: [level.background, 32, 95] as [string, number, number], lighting: level.lighting };
}
