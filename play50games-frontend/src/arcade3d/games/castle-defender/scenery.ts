// Pure scenery layouts. Radius conservatively encloses each model/fallback in world metres.
// All solid props stay outside FIELD: no new collision or camera solids in the fixed play view.
import type { LevelId } from "@/arcade3d/types";
import { DECOR, COLORS, type DecorSpot } from "./looks";

export interface SceneryProp {
   kind: "tower" | "gate" | "brazier" | "standard" | "barricade";
   x: number;
   z: number;
   scale: number;
   radius: number;
}

const prop = (kind: SceneryProp["kind"], x: number, z: number, scale = 1): SceneryProp => ({
   kind, x, z, scale, radius: (kind === "tower" ? 2.5 : kind === "gate" ? 1.1 : kind === "barricade" ? 0.8 : 0.5) * scale,
});

const PROPS: Record<LevelId, readonly SceneryProp[]> = {
   1: [],
   2: [prop("gate", 0, -9.5), ...[-1, 1].flatMap((s) => [
      prop("tower", s * 2.5, -10.5, 0.42), prop("barricade", s * 6.6, -4),
      prop("barricade", s * 6.6, -1.5), prop("standard", s * 6.6, -6.5),
   ])],
   3: [-1, 1].flatMap((s) => [prop("tower", s * 7.1, -5.5, 0.5),
      prop("barricade", s * 6.6, -2.4), prop("standard", s * 7.1, -8.5)]),
   4: [-1, 1].flatMap((s) => [prop("brazier", s * 6.5, -6.8),
      prop("brazier", s * 6.5, -3.8), prop("barricade", s * 7, -8.5),
      prop("standard", s * 7.4, -1.5)]),
   5: [-1, 1].flatMap((s) => [prop("standard", s * 6.5, -6.8),
      prop("standard", s * 6.5, -3.6), prop("standard", s * 6.5, -0.4),
      prop("tower", s * 4.2, -10.5, 0.38), prop("brazier", s * 2, -8.8)]),
};

// Keep L1's exact scatter. Later maps deliberately replace the near forest with architecture,
// leaving a distant treeline; each has a different silhouette and planting pattern.
function decorFor(id: LevelId): readonly DecorSpot[] {
   if (id === 1) return DECOR;
   const far = DECOR.filter((p) => p.kind === "cloud" || p.z < -12 || p.x < -16 || p.x > 12);
   const planting: DecorSpot[] = [];
   const rows = id === 2 ? [-6, -2] : id === 3 ? [-7, -4, -1] : id === 4 ? [-6, -1] : [-6.8, -3.6, -0.4];
   for (const side of [-1, 1]) for (const z of rows) {
      planting.push({ kind: id === 4 ? "rock" : id === 5 ? "flower" : "round",
         x: side * (id === 3 ? 9.2 : 7.8), y: 0, z, tone: id === 5 ? 1 : 0,
         rotY: 0, sx: 0.85, sy: id === 3 ? 1.35 : 0.85, sz: 0.85 });
   }
   return [...far, ...planting];
}

const SCENERY = {
   1: { decor: decorFor(1), props: PROPS[1], stone: COLORS.stone, accent: COLORS.banner, floor: undefined },
   2: { decor: decorFor(2), props: PROPS[2], stone: "#c9d5d9", accent: "#287a8d", floor: "#c8d1d2" },
   3: { decor: decorFor(3), props: PROPS[3], stone: "#c6b0a8", accent: "#8c4164", floor: "#c5caab" },
   4: { decor: decorFor(4), props: PROPS[4], stone: "#7c879e", accent: "#e4a955", floor: "#b4c3bb" },
   5: { decor: decorFor(5), props: PROPS[5], stone: "#e9d4b2", accent: "#77335b", floor: "#e0d0b9" },
};

export const sceneryFor = (id: LevelId) => SCENERY[id];
