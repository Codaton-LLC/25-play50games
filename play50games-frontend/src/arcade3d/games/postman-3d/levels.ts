import type { LevelId } from "@/arcade3d/types";

export interface PostLevel {
   streets: number;
   housesPerStreet: number;
   letters: number;
   parcels: number;
   bagCap: number;
   dogs: number;
   traffic: number;
   trafficSpeed: number;
   markers: boolean;
   durationMs: number;
   lives?: number;
   lighting: "day" | "sunset" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, PostLevel> = {
   1: { streets: 1, housesPerStreet: 6, letters: 4, parcels: 0, bagCap: 4, dogs: 0, traffic: 0, trafficSpeed: 0, markers: true, durationMs: 120_000, lighting: "day", background: "#bae6fd" },
   2: { streets: 2, housesPerStreet: 6, letters: 4, parcels: 2, bagCap: 4, dogs: 0, traffic: 0, trafficSpeed: 0, markers: true, durationMs: 150_000, lighting: "day", background: "#7dd3fc" },
   3: { streets: 2, housesPerStreet: 8, letters: 6, parcels: 2, bagCap: 6, dogs: 2, traffic: 0, trafficSpeed: 0, markers: false, durationMs: 180_000, lighting: "sunset", background: "#fdba74" },
   4: { streets: 3, housesPerStreet: 8, letters: 7, parcels: 3, bagCap: 4, dogs: 2, traffic: 3, trafficSpeed: 4, markers: false, durationMs: 180_000, lives: 3, lighting: "day", background: "#93c5fd" },
   5: { streets: 3, housesPerStreet: 10, letters: 10, parcels: 4, bagCap: 5, dogs: 3, traffic: 4, trafficSpeed: 4.5, markers: false, durationMs: 210_000, lives: 3, lighting: "night", background: "#0f172a" },
};

export const LEVEL_TITLES: Record<LevelId, string> = { 1: "Small Street", 2: "Neighborhood", 3: "Village", 4: "City District", 5: "Holiday Rush" };
export const LEVEL_LINES: Record<LevelId, string> = { 1: "Four letters, one street.", 2: "Parcels go to the door.", 3: "Find the numbers yourself. Mind the dogs.", 4: "Traffic, and a refill halfway.", 5: "Fourteen deliveries after dark." };
