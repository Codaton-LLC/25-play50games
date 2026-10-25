import type { LevelId } from "@/arcade3d/types";

export interface RocketLevel {
   id: LevelId;
   title: string;
   planets: number;
   durationMs: number;
   windAmplitude: number;
   padAmplitude: number;
   contactVy: number;
   contactAngle: number;
   cleanBonus: number;
   clearScore: number;
}

export const LEVELS: Record<LevelId, RocketLevel> = {
   1: {
      id: 1,
      title: "Five Worlds",
      planets: 5,
      durationMs: 240_000,
      windAmplitude: 0.4,
      padAmplitude: 2.0,
      contactVy: 2.0,
      contactAngle: Math.PI / 18,
      cleanBonus: 300,
      clearScore: 2000,
   },
   2: {
      id: 2,
      title: "Breezy Approach",
      planets: 5,
      durationMs: 240_000,
      windAmplitude: 0.44,
      padAmplitude: 2.1,
      contactVy: 1.85,
      contactAngle: Math.PI / 19,
      cleanBonus: 500,
      clearScore: 2050,
   },
   3: {
      id: 3,
      title: "Turbulent Orbit",
      planets: 5,
      durationMs: 240_000,
      windAmplitude: 0.48,
      padAmplitude: 2.2,
      contactVy: 1.75,
      contactAngle: Math.PI / 20,
      cleanBonus: 700,
      clearScore: 2100,
   },
   4: {
      id: 4,
      title: "High Winds & Cavern",
      planets: 5,
      durationMs: 240_000,
      windAmplitude: 0.52,
      padAmplitude: 2.3,
      contactVy: 1.65,
      contactAngle: Math.PI / 22,
      cleanBonus: 900,
      clearScore: 2150,
   },
   5: {
      id: 5,
      title: "Precision Landing",
      planets: 5,
      durationMs: 240_000,
      windAmplitude: 0.55,
      padAmplitude: 2.4,
      contactVy: 1.5,
      contactAngle: Math.PI / 24,
      cleanBonus: 1100,
      clearScore: 2200,
   },
};
