import type { BurgerLevel } from "./levels";
export const COLORS = {
   road: "#475569", shop: "#fb7185", bag: "#fbbf24", cream: "#fff1e6",
   dark: "#1e293b", glass: "#bae6fd", wet: "#25374b", building: "#cbd5e1",
   trim: "#94a3b8", target: "#34d399", skin: "#e8b99a",
};
export function environment(level: BurgerLevel) {
   return { background: level.background, lighting: level.lighting,
      fog: [level.background, level.wet ? 24 : 48, level.wet ? 72 : 110] as [string, number, number] };
}
export const CAMERA = { position: [0, 20, 16.782] as [number, number, number], lookAt: [0, 0, 0] as [number, number, number], fov: 50 };
