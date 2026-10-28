// Color City Sprint's look: an ember day over a pastel city, and a neon night for levels 4 and 5.
export const COLORS = {
   sky: "#fde7df",
   fog: "#f6d2c8",
   background: "#f3c7bc",
   street: "#3f3a48",
   streetLine: "#f8d7c4",
   lane: "#ef4444",
   laneDim: "#7f1d1d",
   building: "#fb7185",
   buildingAlt: "#fdba74",
   sludge: "#64748b",
   rail: "#fecdd3",
   nightSky: "#1e1b4b",
   nightFog: "#312e81",
   nightStreet: "#1c1917",
} as const;

export const FOG = { color: COLORS.fog, near: 28, far: 92 } as const;

export const NIGHT = {
   background: "#1e1b4b",
   fog: "#312e81",
   near: 18,
   far: 70,
   lighting: "night" as const,
};

export function isNightLevel(id: number): boolean {
   return id === 4 || id === 5;
}

export function levelEnvironment(id: number): { background: string; fog: [string, number, number]; lighting: "night" } | null {
   if (!isNightLevel(id)) return null;
   return { background: NIGHT.background, fog: [NIGHT.fog, NIGHT.near, NIGHT.far], lighting: "night" };
}
