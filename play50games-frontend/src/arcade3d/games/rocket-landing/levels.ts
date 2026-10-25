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
      title: "Moon Pad",
      planets: 2,
      durationMs: 120_000,
      windAmplitude: 0.4,
      padAmplitude: 2.0,
      contactVy: 2.0,
      contactAngle: Math.PI / 18,
      cleanBonus: 300,
      clearScore: 800,
   },
   2: {
      id: 2,
      title: "Wide Crater",
      planets: 3,
      durationMs: 150_000,
      windAmplitude: 0.4,
      padAmplitude: 2.0,
      contactVy: 2.0,
      contactAngle: Math.PI / 18,
      cleanBonus: 300,
      clearScore: 1200,
   },
   3: {
      id: 3,
      title: "Mars Ridge",
      planets: 4,
      durationMs: 180_000,
      windAmplitude: 0.6,
      padAmplitude: 3.0,
      contactVy: 2.0,
      contactAngle: Math.PI / 18,
      cleanBonus: 300,
      clearScore: 1600,
   },
   4: {
      id: 4,
      title: "Asteroid Base",
      planets: 5,
      durationMs: 180_000,
      windAmplitude: 0.4,
      padAmplitude: 2.0,
      contactVy: 2.0,
      contactAngle: Math.PI / 18,
      cleanBonus: 300,
      clearScore: 2000,
   },
   5: {
      id: 5,
      title: "Precision Landing",
      planets: 5,
      durationMs: 180_000,
      windAmplitude: 0.4,
      padAmplitude: 2.0,
      contactVy: 1.5,
      contactAngle: Math.PI / 24,
      cleanBonus: 450,
      clearScore: 2000,
   },
};
