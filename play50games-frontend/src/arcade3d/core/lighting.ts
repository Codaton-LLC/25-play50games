"use client";

// Stage lighting: the preset table behind environment.lighting and a crossfade between presets.
// ShellStage draws ONE ambient + hemisphere + directional light (the same lights for every preset,
// so a fade never recompiles a shader) from LIGHTING_PRESETS, and owns a StageLighting state that
// a Scene steers with useStageLighting(preset, fadeS): the colours, intensities, sun position,
// background and fog colour ease to the request over fadeS seconds of game time (stops while
// paused). The request lives while the calling component is mounted; its unmount (Retry remounts
// the Scene) resets the stage to the game's environment at once.
import { createContext, useContext, useEffect } from "react";
import { Color, Vector3 } from "three";
import type { GameDefinition, LightingPreset } from "./types";
import { useGameTime, type GameTime } from "./gameTime";

type Environment = NonNullable<GameDefinition["environment"]>;

export interface LightingSpec {
   ambient: number;
   /** sky colour, ground colour, intensity */
   hemisphere: readonly [sky: string, ground: string, intensity: number];
   sun: { position: readonly [number, number, number]; intensity: number; color: string };
   /** background (and default fog) colour when a game fades to this preset without its own */
   background: string;
}

export const LIGHTING_PRESETS: Record<LightingPreset, LightingSpec> = {
   day: { ambient: 0.2, hemisphere: ["#e0f2fe", "#334155", 1.1], sun: { position: [6, 10, 4], intensity: 1.6, color: "#ffffff" }, background: "#bae6fd" },
   indoor: { ambient: 0.35, hemisphere: ["#fff7ed", "#1e293b", 0.9], sun: { position: [3, 8, 2], intensity: 1.1, color: "#fde68a" }, background: "#1f2937" },
   night: { ambient: 0.15, hemisphere: ["#1e3a8a", "#020617", 0.55], sun: { position: [-4, 8, 2], intensity: 0.75, color: "#c7d2fe" }, background: "#0b1020" },
   sunset: { ambient: 0.25, hemisphere: ["#fed7aa", "#3b0764", 0.85], sun: { position: [-8, 4, 3], intensity: 1.5, color: "#fdba74" }, background: "#fdba74" },
   snow: { ambient: 0.35, hemisphere: ["#f0f9ff", "#94a3b8", 1.05], sun: { position: [4, 9, 3], intensity: 1.2, color: "#e0f2fe" }, background: "#e2e8f0" },
   space: { ambient: 0.1, hemisphere: ["#a5b4fc", "#020617", 0.35], sun: { position: [6, 6, 8], intensity: 2, color: "#ffffff" }, background: "#020617" },
};

/** The table entry of a preset (unknown names fall back to "day", like ShellStage always did). */
export function lightingSpec(name: LightingPreset): LightingSpec {
   return LIGHTING_PRESETS[name] ?? LIGHTING_PRESETS.day;
}

/** Live lighting values: what ShellStage copies into its lights, background and fog. */
export interface LightingValues {
   ambientIntensity: number;
   skyColor: Color;
   groundColor: Color;
   hemisphereIntensity: number;
   sunColor: Color;
   sunIntensity: number;
   sunPosition: Vector3;
   background: Color;
   fog: Color;
}

export function createLightingValues(): LightingValues {
   return {
      ambientIntensity: 0,
      skyColor: new Color(),
      groundColor: new Color(),
      hemisphereIntensity: 0,
      sunColor: new Color(),
      sunIntensity: 0,
      sunPosition: new Vector3(),
      background: new Color(),
      fog: new Color(),
   };
}

/**
 * A preset's values written into `out` (allocated when omitted). The background defaults to the
 * table's, the fog colour to the background.
 */
export function lightingPreset(name: LightingPreset, out = createLightingValues(), background?: string, fog?: string): LightingValues {
   const spec = lightingSpec(name);
   out.ambientIntensity = spec.ambient;
   out.skyColor.set(spec.hemisphere[0]);
   out.groundColor.set(spec.hemisphere[1]);
   out.hemisphereIntensity = spec.hemisphere[2];
   out.sunColor.set(spec.sun.color);
   out.sunIntensity = spec.sun.intensity;
   out.sunPosition.set(spec.sun.position[0], spec.sun.position[1], spec.sun.position[2]);
   out.background.set(background ?? spec.background);
   out.fog.set(fog ?? background ?? spec.background);
   return out;
}

export function copyLighting(from: LightingValues, out: LightingValues): LightingValues {
   out.ambientIntensity = from.ambientIntensity;
   out.skyColor.copy(from.skyColor);
   out.groundColor.copy(from.groundColor);
   out.hemisphereIntensity = from.hemisphereIntensity;
   out.sunColor.copy(from.sunColor);
   out.sunIntensity = from.sunIntensity;
   out.sunPosition.copy(from.sunPosition);
   out.background.copy(from.background);
   out.fog.copy(from.fog);
   return out;
}

/** from + (to - from) · k into `out` (k clamped to 0..1; out may be from or to). */
export function lerpLighting(from: LightingValues, to: LightingValues, k: number, out: LightingValues): LightingValues {
   const t = k <= 0 ? 0 : k >= 1 ? 1 : k;
   out.ambientIntensity = from.ambientIntensity + (to.ambientIntensity - from.ambientIntensity) * t;
   out.skyColor.lerpColors(from.skyColor, to.skyColor, t);
   out.groundColor.lerpColors(from.groundColor, to.groundColor, t);
   out.hemisphereIntensity = from.hemisphereIntensity + (to.hemisphereIntensity - from.hemisphereIntensity) * t;
   out.sunColor.lerpColors(from.sunColor, to.sunColor, t);
   out.sunIntensity = from.sunIntensity + (to.sunIntensity - from.sunIntensity) * t;
   out.sunPosition.lerpVectors(from.sunPosition, to.sunPosition, t);
   out.background.lerpColors(from.background, to.background, t);
   out.fog.lerpColors(from.fog, to.fog, t);
   return out;
}

/** ShellStage's crossfade state (pure: tests drive it with plain times). */
export interface StageLighting {
   /** the game's environment.lighting, background and fog colour */
   base: LightingValues;
   baseName: LightingPreset;
   current: LightingValues;
   from: LightingValues;
   to: LightingValues;
   start: number;
   fadeS: number;
   /** a fade is running */
   active: boolean;
   /** `current` changed since ShellStage last copied it */
   dirty: boolean;
   /** the requesting run's clock (set by useStageLighting) */
   time: GameTime | null;
}

export function createStageLighting(): StageLighting {
   return {
      base: createLightingValues(),
      baseName: "day",
      current: createLightingValues(),
      from: createLightingValues(),
      to: createLightingValues(),
      start: 0,
      fadeS: 0,
      active: false,
      dirty: false,
      time: null,
   };
}

/** Sets the game's environment as the base and resets to it. */
export function setStageEnvironment(state: StageLighting, environment: Environment): void {
   state.baseName = environment.lighting;
   lightingPreset(environment.lighting, state.base, environment.background, environment.fog?.[0] ?? environment.background);
   resetStageLighting(state);
}

/** Back to the base at once (Retry, Scene remount). */
export function resetStageLighting(state: StageLighting): void {
   copyLighting(state.base, state.current);
   state.active = false;
   state.dirty = true;
   state.time = null;
}

/**
 * Starts a fade from the current values to `preset` at time `now` (seconds). `null`, or the
 * environment's own preset without colours, fades back to the environment exactly.
 */
export function requestStageLighting(state: StageLighting, preset: LightingPreset | null, fadeS: number, now: number, background?: string, fog?: string): void {
   copyLighting(state.current, state.from);
   if (preset === null || (preset === state.baseName && background === undefined && fog === undefined)) copyLighting(state.base, state.to);
   else lightingPreset(preset, state.to, background, fog);
   state.start = now;
   state.fadeS = fadeS;
   state.active = true;
}

/** Advances the fade to `now`; true when `current` changed since the last call (copy it then). */
export function stepStageLighting(state: StageLighting, now: number): boolean {
   if (state.active) {
      const k = state.fadeS > 0 ? (now - state.start) / state.fadeS : 1;
      lerpLighting(state.from, state.to, k, state.current);
      if (k >= 1) state.active = false;
      state.dirty = true;
   }
   const changed = state.dirty;
   state.dirty = false;
   return changed;
}

export const StageLightingContext = createContext<StageLighting | null>(null);

/**
 * Fades the stage lights (and background / fog colour) to `preset` over `fadeS` seconds of game
 * time whenever the arguments change; `null` = the game's own environment. Optional `background` /
 * `fog` colours override the preset's. Inside a GameShell Scene only.
 */
export function useStageLighting(preset: LightingPreset | null, fadeS = 1, background?: string, fog?: string): void {
   const stage = useContext(StageLightingContext);
   const time = useGameTime();
   useEffect(() => {
      if (!stage) return;
      return () => resetStageLighting(stage);
   }, [stage]);
   useEffect(() => {
      if (!stage) return;
      stage.time = time;
      requestStageLighting(stage, preset, fadeS, time.now, background, fog);
   }, [stage, time, preset, fadeS, background, fog]);
}
