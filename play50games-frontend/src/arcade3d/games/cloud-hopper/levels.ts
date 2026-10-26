// Cloud Hopper's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One pastel sky (clouds.ts) and five configurations. The course is a rising helix, not a
// roof zigzag and not a ruin shaft. A normal step stays under the jump apex. A step that
// leaves a bounce cloud is a high launch, still under the bounce apex.
import type { LevelId } from "@/arcade3d/types";

export interface CloudSpec {
   /** clouds including the start and the goal */
   surfaces: number;
   /** how many steps between them gain height (every step on these courses) */
   rises: number;
   /** the goal cloud's top (m). buildClouds scales the rises so the goal lands here. */
   goalTop: number;
   /** radians of helix per cloud */
   turn: number;
   /** helix radius (m) */
   radius: number;
   /** radius breathing (m): the helix swells and narrows, it does not stay a circle */
   wobble: number;
   /** cloud width (x) and depth (z), metres */
   width: number;
   depth: number;
   /** every Nth eligible cloud is a bounce launcher; 0 = none */
   bounceEvery: number;
   /** a step that leaves a bounce cloud (m), before the goalTop scale */
   bounceRise: number;
   /** any other rising step (m), before the goalTop scale */
   normalRise: number;
   /** a drift chain starts every Nth eligible cloud; 0 = none */
   driftEvery: number;
   driftTravel: number;
   driftPeriod: number;
   /** every Nth eligible cloud fades after a landing; 0 = none */
   fadeEvery: number;
   fadeMs: number;
   checkpointEvery: number;
   /** a star on every Nth gap */
   orbEvery: number;
   /** wind lanes between clouds */
   wind: boolean;
   /** sideways push in a lane (m/s²), clamped to V_RUN */
   windAccel: number;
   /** a rim spark on some clouds (shield and phase ignore it) */
   sparks: boolean;
}

export interface CloudLevel {
   id: LevelId;
   name: string;
   durationMs: number;
   spec: CloudSpec;
}

/** The run's level config. The name the shell and the HUD already use. */
export type RoofLevel = CloudLevel;

const launch = { bounceRise: 6.35, normalRise: 1.82, driftTravel: 0.85, driftPeriod: 4600, fadeMs: 2000, windAccel: 2.4 } as const;

const soft: CloudSpec = {
   ...launch,
   surfaces: 12,
   rises: 11,
   goalTop: 33.6,
   turn: 0.7,
   radius: 6.8,
   wobble: 0.35,
   width: 4.2,
   depth: 3.8,
   bounceEvery: 3,
   driftEvery: 0,
   fadeEvery: 0,
   checkpointEvery: 5,
   orbEvery: 2,
   wind: false,
   sparks: false,
};

const moving: CloudSpec = {
   ...launch,
   surfaces: 16,
   rises: 15,
   goalTop: 45.4,
   turn: 0.96,
   radius: 7.1,
   wobble: 0.3,
   width: 3.6,
   depth: 3.4,
   driftTravel: 1.5,
   driftPeriod: 4600,
   bounceEvery: 3,
   driftEvery: 4,
   fadeEvery: 0,
   checkpointEvery: 5,
   orbEvery: 2,
   wind: false,
   sparks: false,
};

const wind: CloudSpec = {
   ...launch,
   surfaces: 20,
   rises: 19,
   goalTop: 52.7,
   turn: 0.92,
   radius: 7.4,
   wobble: 0.3,
   width: 3.6,
   depth: 3.4,
   bounceEvery: 3,
   driftEvery: 0,
   fadeEvery: 0,
   checkpointEvery: 5,
   orbEvery: 3,
   wind: true,
   windAccel: 2.6,
   sparks: false,
};

const fading: CloudSpec = {
   ...launch,
   surfaces: 24,
   rises: 23,
   goalTop: 60,
   turn: 0.98,
   radius: 7.6,
   wobble: 0.25,
   width: 3.6,
   depth: 3.4,
   bounceEvery: 4,
   driftEvery: 0,
   fadeEvery: 3,
   checkpointEvery: 5,
   orbEvery: 3,
   wind: false,
   sparks: true,
};

const sprint: CloudSpec = {
   ...launch,
   surfaces: 30,
   rises: 29,
   goalTop: 89,
   turn: 0.91,
   radius: 7.8,
   wobble: 0.25,
   width: 3.6,
   depth: 3.4,
   bounceEvery: 3,
   driftEvery: 7,
   driftTravel: 0.75,
   driftPeriod: 4000,
   fadeEvery: 4,
   checkpointEvery: 5,
   orbEvery: 3,
   wind: true,
   windAccel: 3.1,
   sparks: true,
};

export const LEVELS: Record<LevelId, CloudLevel> = {
   1: { id: 1, name: "Soft Clouds", durationMs: 90_000, spec: soft },
   2: { id: 2, name: "Moving Clouds", durationMs: 120_000, spec: moving },
   3: { id: 3, name: "Wind Zone", durationMs: 150_000, spec: wind },
   4: { id: 4, name: "Fading Clouds", durationMs: 180_000, spec: fading },
   5: { id: 5, name: "Sky Sprint", durationMs: 210_000, spec: sprint },
};
