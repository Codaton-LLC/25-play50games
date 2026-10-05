// Tiny synthesized sound effects for the 3D Arcade (Web Audio, no files to download).
// Owned by Claude. The AudioContext is created lazily on the first user gesture (browser
// autoplay rules); until then playSfx() is a silent no-op. Mute is remembered per device.
//
//    import { playSfx } from "@/arcade3d/core/audio";
//    playSfx("pickup");
import { useSyncExternalStore } from "react";

export type SfxName = "pickup" | "hit" | "jump" | "win" | "lose" | "countdown" | "go";

export const MUTED_KEY = "play50games_3d_muted";
const MASTER_VOLUME = 0.22;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted: boolean | null = null;
const listeners = new Set<() => void>();

function readMuted(): boolean {
   try {
      return typeof window !== "undefined" && window.localStorage.getItem(MUTED_KEY) === "1";
   } catch {
      return false;
   }
}

export function isMuted(): boolean {
   if (muted === null) muted = readMuted();
   return muted;
}

export function setMuted(value: boolean): void {
   muted = value;
   try {
      if (value) window.localStorage.setItem(MUTED_KEY, "1");
      else window.localStorage.removeItem(MUTED_KEY);
   } catch {
      // storage blocked: mute still works for this visit
   }
   if (master && ctx) master.gain.setValueAtTime(value ? 0 : MASTER_VOLUME, ctx.currentTime);
   listeners.forEach((listener) => listener());
}

export function toggleMuted(): boolean {
   setMuted(!isMuted());
   return isMuted();
}

function subscribeMuted(listener: () => void): () => void {
   listeners.add(listener);
   return () => listeners.delete(listener);
}

/** Current mute state for a button; updates when any component toggles it. */
export function useMuted(): boolean {
   return useSyncExternalStore(subscribeMuted, isMuted, () => false);
}

/** Creates (or resumes) the AudioContext. Must run inside a user gesture handler. */
function unlock(): void {
   if (typeof window === "undefined") return;
   try {
      if (!ctx) {
         const Ctor: typeof AudioContext | undefined =
            window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
         if (!Ctor) return;
         ctx = new Ctor();
         master = ctx.createGain();
         master.gain.value = isMuted() ? 0 : MASTER_VOLUME;
         master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") void ctx.resume();
   } catch {
      ctx = null;
      master = null;
   }
}

/**
 * Listens for the first user gestures and unlocks audio then. Call once while a game is mounted;
 * the returned function removes the listeners.
 */
export function initAudio(): () => void {
   if (typeof window === "undefined") return () => {};
   // only events that grant user activation on every browser (a touch pointerdown does not)
   const events = ["pointerup", "click", "keydown", "touchend"] as const;
   const onGesture = () => unlock();
   events.forEach((name) => window.addEventListener(name, onGesture, { passive: true }));
   return () => events.forEach((name) => window.removeEventListener(name, onGesture));
}

function tone(
   audio: AudioContext,
   out: AudioNode,
   { type = "sine", from, to, start = 0, duration, volume = 1 }: {
      type?: OscillatorType;
      from: number;
      to?: number;
      start?: number;
      duration: number;
      volume?: number;
   }
): void {
   const t0 = audio.currentTime + start;
   const osc = audio.createOscillator();
   const gain = audio.createGain();
   osc.type = type;
   osc.frequency.setValueAtTime(from, t0);
   if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
   gain.gain.setValueAtTime(0.0001, t0);
   gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
   gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
   osc.connect(gain);
   gain.connect(out);
   osc.start(t0);
   osc.stop(t0 + duration + 0.02);
}

function burst(audio: AudioContext, out: AudioNode, duration: number, volume: number): void {
   if (!noise) {
      noise = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.3), audio.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
   }
   const src = audio.createBufferSource();
   const gain = audio.createGain();
   const t0 = audio.currentTime;
   src.buffer = noise;
   gain.gain.setValueAtTime(volume, t0);
   gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
   src.connect(gain);
   gain.connect(out);
   src.start(t0);
   src.stop(t0 + duration);
}

/** Plays a short effect. Silent when muted or before the first user gesture. */
export function playSfx(name: SfxName): void {
   if (!ctx || !master || isMuted() || ctx.state !== "running") return;
   const audio = ctx;
   const out = master;
   try {
      switch (name) {
         case "pickup":
            tone(audio, out, { type: "square", from: 880, to: 1320, duration: 0.08, volume: 0.35 });
            tone(audio, out, { type: "square", from: 1760, start: 0.07, duration: 0.07, volume: 0.25 });
            break;
         case "hit":
            burst(audio, out, 0.14, 0.5);
            tone(audio, out, { type: "square", from: 160, to: 70, duration: 0.16, volume: 0.4 });
            break;
         case "jump":
            tone(audio, out, { type: "sine", from: 300, to: 760, duration: 0.16, volume: 0.6 });
            break;
         case "win":
            [523, 659, 784, 1047].forEach((freq, i) =>
               tone(audio, out, { type: "triangle", from: freq, start: i * 0.1, duration: 0.16, volume: 0.6 })
            );
            break;
         case "lose":
            [440, 349, 262].forEach((freq, i) =>
               tone(audio, out, { type: "triangle", from: freq, start: i * 0.16, duration: 0.2, volume: 0.6 })
            );
            break;
         case "countdown":
            tone(audio, out, { type: "sine", from: 660, duration: 0.12, volume: 0.6 });
            break;
         case "go":
            tone(audio, out, { type: "sine", from: 990, duration: 0.28, volume: 0.7 });
            break;
      }
   } catch {
      // audio is a nice-to-have: never break the game over it
   }
}
