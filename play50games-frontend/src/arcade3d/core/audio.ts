// Tiny synthesized sound effects for the 3D Arcade (Web Audio, no files to download).
// Owned by Claude. The AudioContext is created lazily on the first user gesture (browser
// autoplay rules); until then playSfx() is a silent no-op and a started loop is a silent
// handle that begins when audio unlocks. Mute is remembered per device. Only a gesture the
// browser counts as user activation creates or resumes it (isAudioGesture): a context made
// outside one starts suspended and every later attempt logs an autoplay warning (Esc, which
// grants no activation, or script-dispatched events used to log 1-12 per session).
//
//    import { playSfx } from "@/arcade3d/core/audio";
//    playSfx("pickup");
import { useSyncExternalStore } from "react";

export type SfxName =
   | "pickup" | "hit" | "jump" | "win" | "lose" | "countdown" | "go"
   | "whoosh" | "splash" | "thud" | "chime" | "combo" | "buzz" | "boom" | "click" | "pop"
   | "zap" | "alarm";

export type LoopName =
   | "engine" | "rotor" | "vacuum" | "belt" | "surf" | "bubbling" | "slide" | "thrust" | "hum"
   | "ambient";

export interface SfxOptions {
   /** multiplies every frequency, 0.5..2 (1 = the cue as designed) */
   pitch?: number;
   /** -1..1, drawn through a StereoPannerNode (omitted = centre) */
   pan?: number;
   /** scales the level, 0..1 (1 = as designed) */
   volume?: number;
}

export interface LoopOptions {
   pitch?: number;
   pan?: number;
   volume?: number;
}

/** What startLoop returns; set() ramps over 60 ms so nothing clicks. */
export interface LoopHandle {
   set(opts: { pitch?: number; volume?: number; pan?: number }): void;
   stop(): void;
}

export const MUTED_KEY = "play50games_3d_muted";
const MASTER_VOLUME = 0.22;
/** loops fade in/out and retune over this, so no click on set() or stop() */
export const LOOP_RAMP_S = 0.06;
/** at most this many loops at once; starting another stops the oldest */
export const MAX_LOOPS = 4;

// --- pure helpers (no Web Audio: unit-tested directly) ---

function clamp(value: number, min: number, max: number): number {
   return Math.min(max, Math.max(min, value));
}

/** playSfx/startLoop pitch option, 0.5..2. */
export function clampPitch(pitch: number): number {
   return clamp(pitch, 0.5, 2);
}

/** pan option, -1..1. */
export function clampPan(pan: number): number {
   return clamp(pan, -1, 1);
}

/** volume option, 0..1. */
export function clampVolume(volume: number): number {
   return clamp(volume, 0, 1);
}

/**
 * A wobbling loop's gain at t seconds: base × (1 − depth/2 + depth/2 × sin(2π·rate·t)), so it
 * breathes between base×(1−depth) and base. The loops build the same shape with an LFO.
 */
export function wobbleGainAt(base: number, depth: number, rate: number, t: number): number {
   return base * (1 - depth / 2 + (depth / 2) * Math.sin(2 * Math.PI * rate * t));
}

/** A linear ramp from `from` to `to` over `ramp` seconds, sampled at t (clamped at both ends). */
export function rampValueAt(from: number, to: number, ramp: number, t: number): number {
   return from + (to - from) * clamp(t / ramp, 0, 1);
}

export interface LoopRegistryEntry {
   readonly id: number;
   stop(): void;
}

export interface LoopRegistry {
   add(entry: LoopRegistryEntry): void;
   remove(id: number): void;
   stopAll(): void;
   has(id: number): boolean;
   count(): number;
}

/**
 * The loop slots. Adding past `limit` stops the oldest entry; stop() may re-enter remove()
 * (it is already out: a no-op), and stopAll() splices before stopping, so both are safe.
 * Entries are plain callbacks, no Web Audio, so the cap is testable with fakes.
 */
export function createLoopRegistry(limit: number): LoopRegistry {
   const entries: LoopRegistryEntry[] = [];
   return {
      add(entry) {
         entries.push(entry);
         while (entries.length > limit) entries.shift()!.stop();
      },
      remove(id) {
         const index = entries.findIndex((entry) => entry.id === id);
         if (index >= 0) entries.splice(index, 1);
      },
      stopAll() {
         entries.splice(0).forEach((entry) => entry.stop());
      },
      has(id) {
         return entries.some((entry) => entry.id === id);
      },
      count() {
         return entries.length;
      },
   };
}

// --- module state ---

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted: boolean | null = null;
const listeners = new Set<() => void>();
const loops = createLoopRegistry(MAX_LOOPS);
const liveLoops: ActiveLoop[] = [];
let nextLoopId = 1;

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
   // loops ride the master gain: mute silences them at once, unmute restores them
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
      if (ctx.state === "suspended") {
         void ctx.resume().then(
            () => startPendingLoops(),
            () => {}
         );
      } else {
         startPendingLoops();
      }
   } catch {
      ctx = null;
      master = null;
   }
}

export interface AudioGestureEvent {
   isTrusted: boolean;
   type: string;
   key?: string;
}

/**
 * May this event create or resume the AudioContext without an autoplay warning? Only a real
 * (trusted) event while the page has transient user activation (`navigator.userActivation`,
 * every current browser). Without that API: any trusted event but Esc, which never activates.
 */
export function isAudioGesture(event: AudioGestureEvent, activation?: { isActive: boolean } | null): boolean {
   if (!event.isTrusted) return false;
   if (activation) return activation.isActive;
   return !(event.type === "keydown" && event.key === "Escape");
}

/**
 * Listens for the first user gestures and unlocks audio then (and resumes it after the browser
 * suspended it). Call once while a game is mounted; the returned function removes the listeners.
 */
export function initAudio(): () => void {
   if (typeof window === "undefined") return () => {};
   // only events that grant user activation on every browser (a touch pointerdown does not)
   const events = ["pointerup", "click", "keydown", "touchend"] as const;
   const onGesture = (event: Event) => {
      if (ctx?.state === "running") return;
      if (isAudioGesture(event as KeyboardEvent, navigator.userActivation)) unlock();
   };
   events.forEach((name) => window.addEventListener(name, onGesture, { passive: true }));
   return () => events.forEach((name) => window.removeEventListener(name, onGesture));
}

// --- cue synthesis ---

function ensureNoise(audio: AudioContext): AudioBuffer {
   if (!noise) {
      noise = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.3), audio.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
   }
   return noise;
}

function tone(
   audio: AudioContext,
   out: AudioNode,
   { type = "sine", from, to, start = 0, duration, volume = 1, pitch = 1 }: {
      type?: OscillatorType;
      from: number;
      to?: number;
      start?: number;
      duration: number;
      volume?: number;
      pitch?: number;
   }
): void {
   const t0 = audio.currentTime + start;
   const osc = audio.createOscillator();
   const gain = audio.createGain();
   osc.type = type;
   osc.frequency.setValueAtTime(from * pitch, t0);
   if (to) osc.frequency.exponentialRampToValueAtTime(to * pitch, t0 + duration);
   gain.gain.setValueAtTime(0.0001, t0);
   gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
   gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
   osc.connect(gain);
   gain.connect(out);
   osc.start(t0);
   osc.stop(t0 + duration + 0.02);
}

function burst(audio: AudioContext, out: AudioNode, duration: number, volume: number): void {
   const src = audio.createBufferSource();
   const gain = audio.createGain();
   const t0 = audio.currentTime;
   src.buffer = ensureNoise(audio);
   gain.gain.setValueAtTime(volume, t0);
   gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
   src.connect(gain);
   gain.connect(out);
   src.start(t0);
   src.stop(t0 + duration);
}

/** Filtered noise that sweeps, for whooshes, splashes and low rumbles. */
function sweep(
   audio: AudioContext,
   out: AudioNode,
   { type = "bandpass", from, to, duration, volume = 1, q = 1, pitch = 1 }: {
      type?: BiquadFilterType;
      from: number;
      to: number;
      duration: number;
      volume?: number;
      q?: number;
      pitch?: number;
   }
): void {
   const src = audio.createBufferSource();
   const filter = audio.createBiquadFilter();
   const gain = audio.createGain();
   const t0 = audio.currentTime;
   src.buffer = ensureNoise(audio);
   src.loop = true;
   filter.type = type;
   filter.Q.value = q;
   filter.frequency.setValueAtTime(from * pitch, t0);
   filter.frequency.exponentialRampToValueAtTime(Math.max(1, to * pitch), t0 + duration);
   gain.gain.setValueAtTime(0.0001, t0);
   gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
   gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
   src.connect(filter);
   filter.connect(gain);
   gain.connect(out);
   src.start(t0);
   src.stop(t0 + duration + 0.02);
}

function createPanner(audio: AudioContext, pan: number): StereoPannerNode | null {
   if (pan === 0 || typeof audio.createStereoPanner !== "function") return null;
   const panner = audio.createStereoPanner();
   panner.pan.value = pan;
   panner.connect(master as GainNode);
   return panner;
}

/** The chain a cue plays through: its own panner when panned, else the master gain directly. */
function sfxOutput(audio: AudioContext, pan: number | null): AudioNode {
   if (pan === null) return master as GainNode;
   return createPanner(audio, pan) ?? (master as GainNode);
}

/** Plays a short effect (every cue is under 0.6 s). Silent when muted or before the first
 *  user gesture; with no opts it sounds exactly as before. */
export function playSfx(name: SfxName, opts?: SfxOptions): void {
   if (!ctx || !master || isMuted() || ctx.state !== "running") return;
   const audio = ctx;
   try {
      const pitch = clampPitch(opts?.pitch ?? 1);
      const level = clampVolume(opts?.volume ?? 1);
      const out = sfxOutput(audio, opts?.pan === undefined ? null : clampPan(opts.pan));
      const v = (volume: number) => volume * level;
      switch (name) {
         case "pickup":
            tone(audio, out, { type: "square", from: 880, to: 1320, duration: 0.08, volume: v(0.35), pitch });
            tone(audio, out, { type: "square", from: 1760, start: 0.07, duration: 0.07, volume: v(0.25), pitch });
            break;
         case "hit":
            burst(audio, out, 0.14, v(0.5));
            tone(audio, out, { type: "square", from: 160, to: 70, duration: 0.16, volume: v(0.4), pitch });
            break;
         case "jump":
            tone(audio, out, { type: "sine", from: 300, to: 760, duration: 0.16, volume: v(0.6), pitch });
            break;
         case "win":
            [523, 659, 784, 1047].forEach((freq, i) =>
               tone(audio, out, { type: "triangle", from: freq, start: i * 0.1, duration: 0.16, volume: v(0.6), pitch })
            );
            break;
         case "lose":
            [440, 349, 262].forEach((freq, i) =>
               tone(audio, out, { type: "triangle", from: freq, start: i * 0.16, duration: 0.2, volume: v(0.6), pitch })
            );
            break;
         case "countdown":
            tone(audio, out, { type: "sine", from: 660, duration: 0.12, volume: v(0.6), pitch });
            break;
         case "go":
            tone(audio, out, { type: "sine", from: 990, duration: 0.28, volume: v(0.7), pitch });
            break;
         case "whoosh":
            sweep(audio, out, { type: "bandpass", from: 300, to: 2400, q: 1, duration: 0.3, volume: v(0.55), pitch });
            break;
         case "splash":
            sweep(audio, out, { type: "lowpass", from: 1500, to: 240, duration: 0.42, volume: v(0.4), pitch });
            tone(audio, out, { type: "sine", from: 300, to: 85, duration: 0.2, volume: v(0.35), pitch });
            break;
         case "thud":
            tone(audio, out, { type: "sine", from: 130, to: 52, duration: 0.18, volume: v(0.5), pitch });
            burst(audio, out, 0.05, v(0.16));
            break;
         case "chime":
            tone(audio, out, { type: "sine", from: 1319, duration: 0.35, volume: v(0.28), pitch });
            tone(audio, out, { type: "sine", from: 1976, start: 0.05, duration: 0.3, volume: v(0.16), pitch });
            break;
         case "combo":
            [660, 880, 1320].forEach((freq, i) =>
               tone(audio, out, { type: "triangle", from: freq, start: i * 0.07, duration: 0.1, volume: v(0.36), pitch })
            );
            break;
         case "buzz":
            tone(audio, out, { type: "square", from: 104, duration: 0.09, volume: v(0.2), pitch });
            tone(audio, out, { type: "square", from: 104, start: 0.11, duration: 0.13, volume: v(0.2), pitch });
            break;
         case "boom":
            tone(audio, out, { type: "sine", from: 92, to: 36, duration: 0.5, volume: v(0.6), pitch });
            sweep(audio, out, { type: "lowpass", from: 420, to: 80, duration: 0.35, volume: v(0.28), pitch });
            break;
         case "click":
            tone(audio, out, { type: "square", from: 1900, duration: 0.03, volume: v(0.16), pitch });
            break;
         case "pop":
            tone(audio, out, { type: "sine", from: 600, to: 1150, duration: 0.07, volume: v(0.32), pitch });
            break;
         case "zap":
            tone(audio, out, { type: "sawtooth", from: 1500, to: 160, duration: 0.14, volume: v(0.28), pitch });
            break;
         case "alarm":
            [880, 659, 880, 659].forEach((freq, i) =>
               tone(audio, out, { type: "sine", from: freq, start: i * 0.1, duration: i === 3 ? 0.14 : 0.09, volume: v(0.28), pitch })
            );
            break;
      }
   } catch {
      // audio is a nice-to-have: never break the game over it
   }
}

// --- loops ---

interface LoopRecipe {
   kind: "osc" | "noise";
   type?: OscillatorType;
   /** oscillator base frequency (× pitch) */
   freq: number;
   /** filter for noise sources, and for oscillators that need rounding (× pitch) */
   filter?: { type: BiquadFilterType; freq: number; q?: number };
   /** amplitude LFO: gain breathes ×(1±depth/2) at `rate` Hz */
   wobble?: { rate: number; depth: number };
   /** base level (× the handle's volume option); quiet enough to layer under cues */
   volume: number;
}

const LOOP_RECIPES: Record<LoopName, LoopRecipe> = {
   engine: { kind: "osc", type: "sawtooth", freq: 70, filter: { type: "lowpass", freq: 320 }, wobble: { rate: 9, depth: 0.12 }, volume: 0.4 },
   rotor: { kind: "noise", freq: 0, filter: { type: "bandpass", freq: 500, q: 1.5 }, wobble: { rate: 13, depth: 0.5 }, volume: 0.28 },
   vacuum: { kind: "noise", freq: 0, filter: { type: "lowpass", freq: 750 }, wobble: { rate: 4, depth: 0.08 }, volume: 0.32 },
   belt: { kind: "noise", freq: 0, filter: { type: "bandpass", freq: 300, q: 2 }, wobble: { rate: 3, depth: 0.25 }, volume: 0.25 },
   surf: { kind: "noise", freq: 0, filter: { type: "lowpass", freq: 480 }, wobble: { rate: 0.35, depth: 0.5 }, volume: 0.35 },
   bubbling: { kind: "noise", freq: 0, filter: { type: "bandpass", freq: 850, q: 5 }, wobble: { rate: 7, depth: 0.55 }, volume: 0.25 },
   slide: { kind: "noise", freq: 0, filter: { type: "bandpass", freq: 1400, q: 4 }, wobble: { rate: 5, depth: 0.15 }, volume: 0.2 },
   thrust: { kind: "osc", type: "sawtooth", freq: 95, filter: { type: "lowpass", freq: 420 }, wobble: { rate: 6, depth: 0.2 }, volume: 0.38 },
   hum: { kind: "osc", type: "sine", freq: 120, volume: 0.22 },
   ambient: { kind: "osc", type: "triangle", freq: 220, filter: { type: "lowpass", freq: 600 }, wobble: { rate: 0.2, depth: 0.3 }, volume: 0.16 },
};

interface ActiveLoopSources {
   oscillators: OscillatorNode[];
   buffers: AudioBufferSourceNode[];
   filter: BiquadFilterNode | null;
   gain: GainNode;
   panner: StereoPannerNode | null;
}

interface ActiveLoop extends LoopRegistryEntry {
   name: LoopName;
   started: boolean;
   stopped: boolean;
   pitch: number;
   volume: number;
   pan: number;
   sources: ActiveLoopSources | null;
}

/** 60 ms linear ramp to `to`: cancels pending ramps first, so retunes never double up. */
function rampParam(param: AudioParam, to: number, t: number): void {
   param.cancelScheduledValues(t);
   param.setValueAtTime(param.value, t);
   param.linearRampToValueAtTime(to, t + LOOP_RAMP_S);
}

/** The loop's resting gain with its wobble centred: recipe × handle volume × (1 − depth/2). */
function loopBaseGain(loop: ActiveLoop): number {
   const recipe = LOOP_RECIPES[loop.name];
   return recipe.volume * loop.volume * (1 - (recipe.wobble?.depth ?? 0) / 2);
}

function startLoopNodes(loop: ActiveLoop): void {
   const audio = ctx;
   const out = master;
   if (!audio || !out || loop.started || loop.stopped) return;
   const recipe = LOOP_RECIPES[loop.name];
   try {
      const t0 = audio.currentTime;
      const gain = audio.createGain();
      const panner = createPanner(audio, loop.pan);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(Math.max(0.0001, loopBaseGain(loop)), t0 + LOOP_RAMP_S);
      const oscillators: OscillatorNode[] = [];
      const buffers: AudioBufferSourceNode[] = [];
      let filter: BiquadFilterNode | null = null;
      if (recipe.kind === "osc") {
         const osc = audio.createOscillator();
         osc.type = recipe.type ?? "sine";
         osc.frequency.value = recipe.freq * loop.pitch;
         oscillators.push(osc);
         if (recipe.filter) {
            filter = audio.createBiquadFilter();
            filter.type = recipe.filter.type;
            filter.frequency.value = recipe.filter.freq * loop.pitch;
            filter.Q.value = recipe.filter.q ?? 1;
            osc.connect(filter);
            filter.connect(gain);
         } else {
            osc.connect(gain);
         }
         osc.start(t0);
      } else {
         const src = audio.createBufferSource();
         src.buffer = ensureNoise(audio);
         src.loop = true;
         buffers.push(src);
         filter = audio.createBiquadFilter();
         filter.type = recipe.filter?.type ?? "lowpass";
         filter.frequency.value = (recipe.filter?.freq ?? 800) * loop.pitch;
         filter.Q.value = recipe.filter?.q ?? 1;
         src.connect(filter);
         filter.connect(gain);
         src.start(t0);
      }
      if (recipe.wobble) {
         // the LFO realises wobbleGainAt(): offset base×(1−depth/2) on the gain, ±base×depth/2
         const lfo = audio.createOscillator();
         lfo.type = "sine";
         lfo.frequency.value = recipe.wobble.rate;
         const lfoGain = audio.createGain();
         lfoGain.gain.value = recipe.volume * loop.volume * (recipe.wobble.depth / 2);
         lfo.connect(lfoGain);
         lfoGain.connect(gain.gain);
         lfo.start(t0);
         oscillators.push(lfo);
      }
      gain.connect(panner ?? out);
      loop.sources = { oscillators, buffers, filter, gain, panner };
      loop.started = true;
   } catch {
      loop.stopped = true;
      loops.remove(loop.id);
   }
}

/** Starts every loop requested before audio was available, now that it is. */
function startPendingLoops(): void {
   if (!ctx || !master || ctx.state !== "running") return;
   liveLoops.forEach((loop) => {
      if (!loop.started) startLoopNodes(loop);
   });
}

function stopLoop(loop: ActiveLoop): void {
   if (loop.stopped) return;
   loop.stopped = true;
   loops.remove(loop.id);
   const index = liveLoops.indexOf(loop);
   if (index >= 0) liveLoops.splice(index, 1);
   const sources = loop.sources;
   if (!sources || !ctx) return;
   try {
      rampParam(sources.gain.gain, 0.0001, ctx.currentTime);
      const stopAt = ctx.currentTime + LOOP_RAMP_S + 0.02;
      sources.oscillators.forEach((osc) => osc.stop(stopAt));
      sources.buffers.forEach((src) => src.stop(stopAt));
   } catch {
      // already stopped: fine
   }
}

function setLoop(loop: ActiveLoop, opts: { pitch?: number; volume?: number; pan?: number }): void {
   if (opts.pitch !== undefined) loop.pitch = clampPitch(opts.pitch);
   if (opts.volume !== undefined) loop.volume = clampVolume(opts.volume);
   if (opts.pan !== undefined) loop.pan = clampPan(opts.pan);
   const sources = loop.sources;
   if (!sources || !ctx || !master) return; // pending: the new values apply when it starts
   try {
      const t = ctx.currentTime;
      const recipe = LOOP_RECIPES[loop.name];
      rampParam(sources.gain.gain, Math.max(0.0001, loopBaseGain(loop)), t);
      if (sources.filter) rampParam(sources.filter.frequency, (recipe.filter?.freq ?? 1000) * loop.pitch, t);
      else rampParam(sources.oscillators[0].frequency, recipe.freq * loop.pitch, t);
      if (loop.pan !== 0 && !sources.panner) {
         const panner = createPanner(ctx, loop.pan);
         if (panner) {
            sources.gain.disconnect();
            sources.gain.connect(panner);
            sources.panner = panner;
         }
      } else if (sources.panner) {
         rampParam(sources.panner.pan, loop.pan, t);
      }
   } catch {
      // nice-to-have
   }
}

/**
 * Starts a looped sound (engine, water, machinery…). Before the first gesture it is a silent
 * handle that starts when audio unlocks; mute silences it through the master gain. At most 4
 * loops at once — starting a 5th stops the oldest.
 */
export function startLoop(name: LoopName, opts?: LoopOptions): LoopHandle {
   const loop: ActiveLoop = {
      id: nextLoopId++,
      name,
      started: false,
      stopped: false,
      pitch: clampPitch(opts?.pitch ?? 1),
      volume: clampVolume(opts?.volume ?? 1),
      pan: clampPan(opts?.pan ?? 0),
      sources: null,
      stop() {
         stopLoop(loop);
      },
   };
   loops.add(loop); // may evict the oldest live loop (its stop() runs here)
   liveLoops.push(loop);
   if (ctx && master && ctx.state === "running") startLoopNodes(loop);
   return {
      set(o) {
         setLoop(loop, o);
      },
      stop() {
         stopLoop(loop);
      },
   };
}

/** Stops every live loop (the shell calls it on pause, mute and unmount). */
export function stopAllLoops(): void {
   loops.stopAll();
}
