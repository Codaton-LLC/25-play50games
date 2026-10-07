// The AudioContext starts only inside a real user gesture (no autoplay warnings), plays once it
// runs, and mute still silences it. Each test loads a fresh audio module against a fake window.
import { afterEach, describe, expect, it, vi } from "vitest";
import { isAudioGesture } from "./audio";

type Listener = (event: { isTrusted: boolean; type: string; key?: string }) => void;

function setup(muted = false) {
   const activation = { isActive: false };
   const listeners = new Map<string, Set<Listener>>();
   const made: FakeContext[] = [];
   let oscillators = 0;
   const param = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} };

   class FakeContext {
      state: "running" | "suspended" | "closed";
      currentTime = 0;
      sampleRate = 8000;
      destination = {};
      resumes = 0;
      constructor() {
         // like a browser: a context made outside user activation starts suspended
         this.state = activation.isActive ? "running" : "suspended";
         made.push(this);
      }
      createGain() {
         return { gain: { ...param }, connect() {} };
      }
      createOscillator() {
         oscillators++;
         return { type: "sine", frequency: { ...param }, connect() {}, start() {}, stop() {} };
      }
      resume() {
         this.resumes++;
         if (activation.isActive) this.state = "running";
         return Promise.resolve();
      }
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
   return { made, fire, listeners, oscillators: () => oscillators };
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
