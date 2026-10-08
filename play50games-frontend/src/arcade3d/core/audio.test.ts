// The AudioContext starts only inside a real user gesture (no autoplay warnings), plays once it
// runs, and mute still silences it. Each test loads a fresh audio module against a fake window.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
   clampPan,
   clampPitch,
   clampVolume,
   createLoopRegistry,
   isAudioGesture,
   rampValueAt,
   wobbleGainAt,
   type LoopName,
   type LoopRegistryEntry,
} from "./audio";

type Listener = (event: { isTrusted: boolean; type: string; key?: string }) => void;

function setup(muted = false) {
   const activation = { isActive: false };
   const listeners = new Map<string, Set<Listener>>();
   const made: FakeContext[] = [];
   let oscillators = 0;

   class FakeParam {
      value = 1;
      events: [string, number][] = [];
      setValueAtTime(v: number) { this.value = v; this.events.push(["set", v]); return this; }
      exponentialRampToValueAtTime(v: number) { this.value = v; this.events.push(["exp", v]); return this; }
      linearRampToValueAtTime(v: number) { this.value = v; this.events.push(["lin", v]); return this; }
      cancelScheduledValues() { return this; }
   }

   class FakeOscillator {
      type = "sine";
      frequency = new FakeParam();
      stopped = false;
      constructor() { oscillators++; }
      connect() {}
      disconnect() {}
      start() {}
      stop() { this.stopped = true; }
   }

   class FakeBufferSource {
      buffer: unknown = null;
      loop = false;
      stopped = false;
      connect() {}
      disconnect() {}
      start() {}
      stop() { this.stopped = true; }
   }

   class FakeGain {
      gain = new FakeParam();
      connect() {}
      disconnect() {}
   }

   class FakePanner {
      pan = new FakeParam();
      connect() {}
      disconnect() {}
   }

   class FakeFilter {
      type = "lowpass";
      frequency = new FakeParam();
      Q = new FakeParam();
      connect() {}
      disconnect() {}
   }

   class FakeContext {
      state: "running" | "suspended" | "closed";
      currentTime = 0;
      sampleRate = 8000;
      destination = {};
      resumes = 0;
      oscillators: FakeOscillator[] = [];
      buffers: FakeBufferSource[] = [];
      gains: FakeGain[] = [];
      panners: FakePanner[] = [];
      filters: FakeFilter[] = [];
      constructor() {
         // like a browser: a context made outside user activation starts suspended
         this.state = activation.isActive ? "running" : "suspended";
         made.push(this);
      }
      createGain() { const node = new FakeGain(); this.gains.push(node); return node; }
      createOscillator() { const node = new FakeOscillator(); this.oscillators.push(node); return node; }
      createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
      createBufferSource() { const node = new FakeBufferSource(); this.buffers.push(node); return node; }
      createStereoPanner() { const node = new FakePanner(); this.panners.push(node); return node; }
      createBiquadFilter() { const node = new FakeFilter(); this.filters.push(node); return node; }
      resume() { this.resumes++; if (activation.isActive) this.state = "running"; return Promise.resolve(); }
   }

   const storage = new Map<string, string>(muted ? [["play50games_3d_muted", "1"]] : []);
   vi.stubGlobal("window", {
      AudioContext: FakeContext,
      localStorage: {
         getItem: (key: string) => storage.get(key) ?? null,
         setItem: (key: string, value: string) => storage.set(key, value),
         removeItem: (key: string) => storage.delete(key),
      },
      addEventListener: (name: string, fn: Listener) => {
         if (!listeners.has(name)) listeners.set(name, new Set());
         listeners.get(name)!.add(fn);
      },
      removeEventListener: (name: string, fn: Listener) => listeners.get(name)?.delete(fn),
   });
   vi.stubGlobal("navigator", { userActivation: activation });

   /** dispatches `type` to the module's window listeners; `active`: the page has user activation */
   const fire = (type: string, { trusted = true, active = true, key }: { trusted?: boolean; active?: boolean; key?: string } = {}) => {
      activation.isActive = trusted && active;
      listeners.get(type)?.forEach((fn) => fn({ isTrusted: trusted, type, key }));
      activation.isActive = false;
   };
   return {
      made,
      fire,
      listeners,
      oscillators: () => oscillators,
      nodes: () => oscillators + made.reduce((n, c) => n + c.buffers.length, 0),
   };
}

async function loadAudio() {
   vi.resetModules();
   return import("./audio");
}

afterEach(() => {
   vi.unstubAllGlobals();
});

describe("isAudioGesture", () => {
   it("needs a trusted event while the page has user activation", () => {
      expect(isAudioGesture({ isTrusted: true, type: "pointerup" }, { isActive: true })).toBe(true);
      expect(isAudioGesture({ isTrusted: true, type: "keydown", key: "Escape" }, { isActive: true })).toBe(true);
      expect(isAudioGesture({ isTrusted: true, type: "keydown", key: "Escape" }, { isActive: false })).toBe(false);
      expect(isAudioGesture({ isTrusted: true, type: "click" }, { isActive: false })).toBe(false);
      // script-dispatched events never count
      expect(isAudioGesture({ isTrusted: false, type: "click" }, { isActive: true })).toBe(false);
      expect(isAudioGesture({ isTrusted: false, type: "click" }, null)).toBe(false);
   });

   it("without navigator.userActivation: any trusted event but Esc", () => {
      expect(isAudioGesture({ isTrusted: true, type: "touchend" }, undefined)).toBe(true);
      expect(isAudioGesture({ isTrusted: true, type: "keydown", key: "ArrowLeft" }, undefined)).toBe(true);
      expect(isAudioGesture({ isTrusted: true, type: "keydown", key: "Escape" }, undefined)).toBe(false);
   });
});

describe("initAudio", () => {
   it("makes no context before a real gesture, nor for Esc or script-dispatched events, and stays silent", async () => {
      const env = setup();
      const audio = await loadAudio();
      const stop = audio.initAudio();
      audio.playSfx("go");
      env.fire("click", { trusted: false });
      env.fire("pointerup", { trusted: false });
      env.fire("keydown", { key: "Escape", active: false });
      audio.playSfx("countdown");
      expect(env.made).toHaveLength(0);
      expect(env.oscillators()).toBe(0);
      stop();
   });

   it("starts a running context on the first activated gesture, then plays", async () => {
      const env = setup();
      const audio = await loadAudio();
      const stop = audio.initAudio();
      env.fire("pointerup");
      expect(env.made).toHaveLength(1);
      expect(env.made[0].state).toBe("running");
      audio.playSfx("go");
      expect(env.oscillators()).toBe(1);
      // later gestures neither make another context nor resume a running one
      env.fire("click");
      env.fire("keydown", { key: "ArrowLeft" });
      expect(env.made).toHaveLength(1);
      expect(env.made[0].resumes).toBe(0);
      stop();
   });

   it("resumes a context the browser suspended on the next activated gesture only", async () => {
      const env = setup();
      const audio = await loadAudio();
      const stop = audio.initAudio();
      env.fire("touchend");
      env.made[0].state = "suspended";
      env.fire("click", { trusted: false });
      env.fire("keydown", { key: "Escape", active: false });
      expect(env.made[0].resumes).toBe(0);
      env.fire("keydown", { key: "Enter" });
      expect(env.made[0].resumes).toBe(1);
      expect(env.made[0].state).toBe("running");
      expect(env.made).toHaveLength(1);
      stop();
   });

   it("mute silences it as before, whether set before or after the context starts", async () => {
      const env = setup(true);
      const audio = await loadAudio();
      const stop = audio.initAudio();
      env.fire("pointerup");
      expect(audio.isMuted()).toBe(true);
      audio.playSfx("go");
      expect(env.oscillators()).toBe(0);
      audio.toggleMuted();
      audio.playSfx("go");
      expect(env.oscillators()).toBe(1);
      audio.setMuted(true);
      audio.playSfx("pickup");
      expect(env.oscillators()).toBe(1);
      stop();
   });

   it("removes its listeners", async () => {
      const env = setup();
      const audio = await loadAudio();
      audio.initAudio()();
      for (const set of env.listeners.values()) expect(set.size).toBe(0);
      env.fire("pointerup");
      expect(env.made).toHaveLength(0);
   });
});

describe("option clamps and envelope maths", () => {
   it("clamps pitch, pan and volume to their ranges", () => {
      expect(clampPitch(0)).toBe(0.5);
      expect(clampPitch(5)).toBe(2);
      expect(clampPitch(1.5)).toBe(1.5);
      expect(clampPan(-9)).toBe(-1);
      expect(clampPan(0.25)).toBe(0.25);
      expect(clampVolume(2)).toBe(1);
      expect(clampVolume(-2)).toBe(0);
   });

   it("keeps a loop wobble between base×(1−depth) and base", () => {
      const base = 0.4;
      const depth = 0.5;
      const rate = 2; // 0.5 s period
      expect(wobbleGainAt(base, depth, rate, 0)).toBeCloseTo(base * 0.75);
      expect(wobbleGainAt(base, depth, rate, 0.125)).toBeCloseTo(base); // sin(π/2)
      expect(wobbleGainAt(base, depth, rate, 0.375)).toBeCloseTo(base * 0.5); // sin(3π/2)
   });

   it("ramps linearly over the 60 ms loop ramp", () => {
      expect(rampValueAt(0, 1, 0.06, 0)).toBe(0);
      expect(rampValueAt(0, 1, 0.06, 0.03)).toBe(0.5);
      expect(rampValueAt(0, 1, 0.06, 0.12)).toBe(1); // past the end: clamped
   });
});

describe("createLoopRegistry", () => {
   it("caps at 4 loops, stopping the oldest, and stopAll stops the rest", () => {
      const registry = createLoopRegistry(4);
      const entries: LoopRegistryEntry[] = [0, 1, 2, 3, 4].map((id) => ({ id, stop: vi.fn() }));
      entries.forEach((entry) => registry.add(entry));
      expect(entries[0].stop).toHaveBeenCalledTimes(1); // evicted by the 5th
      expect(registry.count()).toBe(4);
      expect(registry.has(4)).toBe(true);
      expect(registry.has(0)).toBe(false);
      registry.remove(2);
      expect(registry.count()).toBe(3);
      registry.stopAll();
      [1, 3, 4].forEach((id) => expect(entries[id].stop).toHaveBeenCalledTimes(1));
      expect(registry.count()).toBe(0);
   });

   it("survives a stop() that re-enters remove()", () => {
      const registry = createLoopRegistry(2);
      const a: LoopRegistryEntry = { id: 1, stop: vi.fn() };
      const b: LoopRegistryEntry = { id: 2, stop: vi.fn(() => registry.remove(2)) };
      registry.add(a);
      registry.add(b);
      registry.add({ id: 3, stop: vi.fn() }); // evicts a; a plain stop does not re-enter
      registry.stopAll(); // b's stop removes b: already out, no double stop
      expect(a.stop).toHaveBeenCalledTimes(1);
      expect(b.stop).toHaveBeenCalledTimes(1);
      expect(registry.count()).toBe(0);
   });
});

describe("new cues", () => {
   it("plays every new cue after the first gesture", async () => {
      const env = setup();
      const audio = await loadAudio();
      audio.initAudio();
      env.fire("pointerup");
      const names = ["whoosh", "splash", "thud", "chime", "combo", "buzz", "boom", "click", "pop", "zap", "alarm"] as const;
      for (const name of names) {
         const before = env.nodes();
         audio.playSfx(name);
         expect(env.nodes() - before, name).toBeGreaterThan(0);
      }
   });

   it("clamps out-of-range options instead of throwing", async () => {
      const env = setup();
      const audio = await loadAudio();
      audio.initAudio();
      env.fire("pointerup");
      expect(() => audio.playSfx("pop", { pitch: 9, pan: -4, volume: 2 })).not.toThrow();
      expect(env.made[0].panners[0].pan.value).toBe(-1);
      const handle = audio.startLoop("hum", { pitch: 0, pan: 3, volume: -1 });
      expect(env.made[0].panners[1].pan.value).toBe(1);
      expect(() => handle.set({ pitch: 99, pan: -99 })).not.toThrow();
      expect(env.made[0].panners).toHaveLength(2); // panned at start: set() ramps the same node
      expect(env.made[0].panners[1].pan.value).toBe(-1);
   });
});

describe("loops", () => {
   it("a loop started before the first gesture is silent and starts on unlock", async () => {
      const env = setup();
      const audio = await loadAudio();
      audio.initAudio();
      const handle = audio.startLoop("engine", { volume: 0.5 });
      handle.set({ pan: -0.4 }); // no nodes yet: applies when the loop starts
      expect(env.made).toHaveLength(0);
      env.fire("pointerup");
      expect(env.made).toHaveLength(1);
      const c = env.made[0];
      expect(c.oscillators).toHaveLength(2); // sawtooth + wobble lfo
      expect(c.panners).toHaveLength(1);
      expect(c.panners[0].pan.value).toBeCloseTo(-0.4);
      expect(c.gains[1].gain.value).toBeCloseTo(0.4 * 0.5 * 0.94, 5); // recipe × volume × (1 − depth/2)
   });

   it("starts a loop requested while the context was suspended once a gesture resumes it", async () => {
      const env = setup();
      const audio = await loadAudio();
      audio.initAudio();
      env.fire("pointerup");
      env.made[0].state = "suspended";
      audio.startLoop("surf");
      expect(env.made[0].buffers).toHaveLength(0);
      env.fire("keydown", { key: "Enter" });
      await Promise.resolve(); // resume().then(startPendingLoops)
      expect(env.made[0].buffers).toHaveLength(1);
   });

   it("keeps at most 4 loops: the oldest stops", async () => {
      const env = setup();
      const audio = await loadAudio();
      audio.initAudio();
      env.fire("pointerup");
      const names: LoopName[] = ["engine", "rotor", "vacuum", "belt", "surf"];
      names.forEach((name) => audio.startLoop(name));
      const c = env.made[0];
      expect(c.buffers).toHaveLength(4); // the four noise loops
      expect(c.buffers.filter((b) => b.stopped)).toHaveLength(0);
      expect(c.oscillators.filter((o) => o.stopped)).toHaveLength(2); // the evicted engine's pair
   });

   it("set() ramps pitch, volume and pan; stop() fades out without clicks", async () => {
      const env = setup();
      const audio = await loadAudio();
      audio.initAudio();
      env.fire("pointerup");
      const handle = audio.startLoop("surf", { volume: 0.4 });
      handle.set({ pitch: 1.6, volume: 0.7, pan: 0.8 });
      const c = env.made[0];
      expect(c.panners).toHaveLength(1);
      expect(c.panners[0].pan.value).toBeCloseTo(0.8);
      expect(c.filters[0].frequency.value).toBeCloseTo(480 * 1.6);
      expect(c.gains[1].gain.value).toBeCloseTo(0.35 * 0.7 * 0.75, 5);
      handle.stop();
      expect(c.gains[1].gain.value).toBeCloseTo(0.0001);
      expect(c.buffers[0].stopped).toBe(true);
      expect(c.oscillators.every((o) => o.stopped)).toBe(true);
   });

   it("mute silences loops at once through the master gain and restores them", async () => {
      const env = setup();
      const audio = await loadAudio();
      audio.initAudio();
      env.fire("pointerup");
      audio.startLoop("hum");
      expect(env.made[0].oscillators.filter((o) => !o.stopped)).toHaveLength(1);
      audio.setMuted(true);
      expect(env.made[0].gains[0].gain.value).toBe(0); // master
      audio.setMuted(false);
      expect(env.made[0].gains[0].gain.value).toBeCloseTo(0.22);
      expect(env.made[0].oscillators.filter((o) => !o.stopped)).toHaveLength(1); // loop kept playing
   });

   it("stopAllLoops stops every live loop for the shell", async () => {
      const env = setup();
      const audio = await loadAudio();
      audio.initAudio();
      env.fire("pointerup");
      audio.startLoop("hum");
      audio.startLoop("surf");
      audio.stopAllLoops();
      const c = env.made[0];
      expect(c.buffers[0].stopped).toBe(true);
      expect(c.oscillators.every((o) => o.stopped)).toBe(true);
      expect(() => audio.startLoop("hum")).not.toThrow(); // the slots are free again
   });
});
