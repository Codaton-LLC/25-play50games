// The tidy-up robot's baked clips (toyRobotHero.glb: a real Hyper3D skeleton, six clips). Pure helpers
// on three.js clips, no React: HeroRobot.tsx drives an AnimationMixer with them.
import { AnimationClip, VectorKeyframeTrack } from "three";

/** The six baked clips of toyRobotHero.glb, by what the game uses them for. */
export const HERO_CLIPS = {
   idle: "HumanStandingIdle",
   walk: "HumanWalking",
   jog: "HumanJogging",
   crouch: "HumanCrouchedWalking",
   happy: "HumanHappyIdle",
   point: "HumanPointingForward",
} as const;

export type HeroClip = keyof typeof HERO_CLIPS;

/** The root bone whose track carries the clips' root motion. */
export const ROOT_BONE = "Hips";

/** PointingForward points (left arm up and forward) from about 1.3 s to 2.9 s of its 4.7 s. */
export const POINT_WINDOW = { from: 1.3, to: 2.9 } as const;
/** How long a right drop's point lasts on screen (s). */
export const POINT_SECONDS = 1.1;
/** A wrong drop / wind-up hit wobble (s). */
export const WOBBLE_SECONDS = 0.55;

/** Walk below this speed (m/s), jog above JOG_UP; between them keep the current one (no flicker). */
export const JOG_UP = 2.0;
export const JOG_DOWN = 1.6;
/** Standing still below this speed (m/s). */
export const STILL = 0.12;

export interface InPlace {
   clip: AnimationClip;
   /** the root's travel per second in the clip (GLB units/s): 0 for a clip that stands still */
   speed: number;
}

/**
 * A copy of `clip` without its root motion: the root bone's position track keeps its bob and sway but
 * loses the straight-line drift from the first key to the last (the game moves the body itself).
 * `speed` is that drift per second, so timeScale = ground speed / (speed x scale) keeps the feet planted.
 */
export function inPlace(clip: AnimationClip, root = ROOT_BONE): InPlace {
   const out = clip.clone();
   const name = `${root}.position`;
   const track = out.tracks.find((t) => t.name === name);
   if (!track || track.times.length < 2) return { clip: out, speed: 0 };
   const n = track.times.length;
   const v = track.values;
   const t0 = track.times[0];
   const span = track.times[n - 1] - t0;
   const dx = v[(n - 1) * 3] - v[0];
   const dz = v[(n - 1) * 3 + 2] - v[2];
   const values = new Float32Array(v.length);
   for (let i = 0; i < n; i++) {
      const k = span > 0 ? (track.times[i] - t0) / span : 0;
      values[i * 3] = v[i * 3] - dx * k;
      values[i * 3 + 1] = v[i * 3 + 1];
      values[i * 3 + 2] = v[i * 3 + 2] - dz * k;
   }
   const flat = new VectorKeyframeTrack(name, Array.from(track.times), Array.from(values));
   out.tracks[out.tracks.indexOf(track)] = flat;
   const duration = clip.duration > 0 ? clip.duration : span;
   return { clip: out, speed: duration > 0 ? Math.hypot(dx, dz) / duration : 0 };
}

/** The legs' clip for this ground speed (m/s), with hysteresis between walk and jog. */
export function gaitFor(speed: number, prev: HeroClip): "idle" | "walk" | "jog" {
   if (speed < STILL) return "idle";
   if (speed > JOG_UP) return "jog";
   if (speed < JOG_DOWN) return "walk";
   return prev === "jog" ? "jog" : "walk";
}

/**
 * The clip's playback rate so its feet stay planted: ground speed over the clip's own root speed in
 * metres (GLB units/s x the model's scale). Never below `min` (a crossfade into a slow start).
 */
export function strideRate(speed: number, clipSpeed: number, scale: number, min = 0.35): number {
   const own = clipSpeed * scale;
   if (own <= 0) return 1;
   return Math.max(min, speed / own);
}

/** A damped wobble for the stun: roll (rad) at `age` seconds after the hit, 0 once it is over. */
export function wobble(age: number, length = WOBBLE_SECONDS): number {
   if (age < 0 || age >= length) return 0;
   const k = 1 - age / length;
   return Math.sin(age * 34) * 0.32 * k * k;
}
