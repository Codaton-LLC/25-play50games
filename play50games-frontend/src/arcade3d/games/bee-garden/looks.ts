import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   lawn: "#65a30d",
   lawnDark: "#4d7c0f",
   lawnBorder: "#3f6212",
   soil: "#a16207",
   soilDark: "#78350f",
   nectar: "#fbbf24",
   nectarCore: "#fef08a",
   hive: "#f59e0b",
   hiveAccent: "#b45309",
   hiveSlot: "#451a03",
   flowerA: "#f43f5e",
   flowerB: "#8b5cf6",
   flowerC: "#38bdf8",
   flowerCenter: "#fef08a",
   stem: "#15803d",
   branch: "#78350f",
   branchBark: "#451a03",
   web: "#f8fafc",
   webStrand: "#cbd5e1",
   leaf: "#22c55e",
   leafDark: "#15803d",
   planter: "#ca8a04",
   wateringCan: "#0284c7",
   accent: "#fbbf24",
   hudBg: "rgba(15, 23, 42, 0.75)",
   hudBorder: "rgba(251, 191, 36, 0.4)",
} as const;

export interface LevelLook {
   background: string;
   fogColor: string;
   fogNear: number;
   fogFar: number;
   lighting: "day" | "sunset";
   beeTint: string;
}

export const LEVEL_LOOKS: Record<LevelId, LevelLook> = {
   1: { background: "#7dd3fc", fogColor: "#7dd3fc", fogNear: 25, fogFar: 60, lighting: "day", beeTint: "#fbbf24" },
   2: { background: "#86efac", fogColor: "#86efac", fogNear: 28, fogFar: 65, lighting: "day", beeTint: "#93c5fd" },
   3: { background: "#bbf7d0", fogColor: "#bbf7d0", fogNear: 22, fogFar: 55, lighting: "day", beeTint: "#f8fafc" },
   4: { background: "#166534", fogColor: "#166534", fogNear: 28, fogFar: 70, lighting: "sunset", beeTint: "#a3e635" },
   5: { background: "#14532d", fogColor: "#14532d", fogNear: 20, fogFar: 60, lighting: "day", beeTint: "#fcd34d" },
};
