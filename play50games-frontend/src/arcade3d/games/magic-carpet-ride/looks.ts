// One palette and the chase camera. Pure: no React. The band is in the eye's view frame.
import type { AABB } from "@/arcade3d/core/collision";
import type { CarpetTheme } from "./levels";

export const COLORS = {
   sand: "#fcd34d",
   sandDeep: "#f59e0b",
   roof: "#c2410c",
   roofDark: "#9a3412",
   roofTrim: "#fdba74",
   ring: "#fbbf24",
   ringHot: "#fffbeb",
   accent: "#a78bfa",
   carpet: "#6d28d9",
   carpetTrim: "#c4b5fd",
   carpetGold: "#fbbf24",
   cloth: "#4c1d95",
   clothDark: "#2e1065",
   skin: "#f1d0b4",
   scarf: "#a78bfa",
   rock: "#78716c",
   rockDark: "#44403c",
   rockTop: "#d6d3d1",
   cloud: "#f8fafc",
   cloudShade: "#bae6fd",
   cloudSea: "#e0f2fe",
   mesa: "#9a3412",
   mesaDark: "#7c2d12",
   mesaCap: "#fdba74",
   lantern: "#fbbf24",
   lanternGlow: "#fde68a",
   palace: "#f5f3ff",
   palaceTrim: "#a78bfa",
   palaceGold: "#fbbf24",
   nightGround: "#1e1b4b",
   duskGround: "#7c2d12",
   arch: "#fbbf24",
   archPost: "#44403c",
} as const;

export const FOV = 62;
/** 12° down. The eye never rolls. */
export const PITCH = (12 * Math.PI) / 180;
export const EYE_Y = 1.8;
export const FOG_NEAR = 22;

/**
 * Carpet and the lane just ahead, in the eye frame. The eye sits 1.8 m above the carpet
 * and 5 m behind it, so the carpet is near y = 0, z = 5.
 */
export const BAND: AABB = {
   min: { x: -3.4, y: -0.8, z: 3.6 },
   max: { x: 3.4, y: 2.4, z: 15 },
};

export function groundColor(theme: CarpetTheme): string {
   if (theme === "canyon") return COLORS.mesaDark;
   if (theme === "cloud") return COLORS.cloudSea;
   if (theme === "night") return COLORS.nightGround;
   if (theme === "palace") return COLORS.duskGround;
   return COLORS.sand;
}
