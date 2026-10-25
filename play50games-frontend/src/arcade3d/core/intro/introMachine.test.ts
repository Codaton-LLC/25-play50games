// Intro timings, skip, first-view memory, reduced motion, the run-clock gate and the camera spline.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clampFrameDt } from "../frameLoop";
import { COUNTDOWN_MS, createArcadeStore } from "../useArcadeStore";
import { GameIntroOverlay } from "./GameIntroOverlay";
import {
   advanceIntro,
   browserIntroStorage,
   cameraProgress,
   createIntro,
   createIntroSession,
   createIntroSpline,
   easeIntro,
   FULL_INTRO,
   gateIntroKey,
   gateIntroPointer,
   gatedRunDt,
   heroProgress,
   introDurations,
   introReady,
   introShowsTitle,
   introStorageKey,
   introTargetAllowsSkip,
   introTotalMs,
   loadIntroVariant,
   markIntroSeen,
   readIntroSeen,
   readReducedMotion,
   requestIntroSkip,
   resolveIntroVariant,
   sampleIntroCamera,
   SHORT_INTRO,
   stepGatedClock,
   type IntroCameraPose,
   type IntroInputLatch,
   type IntroKeyGate,
   type IntroPhase,
   type IntroPointerGate,
   type IntroState,
   type IntroStorage,
} from "./introMachine";

function memory(): IntroStorage {
   const data = new Map<string, string>();
   return {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => {
         data.set(key, value);
      },
   };
}

function lengthOf(state: IntroState): number {
   const d = introDurations(state.variant);
   if (state.phase === "fly-through") return d.flyThrough;
   if (state.phase === "hero-landing") return d.heroLanding;
   if (state.phase === "title") return d.title;
   return 0;
}

/** The first instant of a full-intro phase (phaseMs 0). */
function seek(phase: IntroPhase): IntroState {
   let state = createIntro("full");
   let guard = 0;
   while (state.phase !== phase) {
      const dur = lengthOf(state);
      state = advanceIntro(state, dur > 0 ? dur : 1);
      if (++guard > 8) throw new Error(`stuck in ${state.phase} looking for ${phase}`);
   }
   return state;
}

function latched(): IntroInputLatch {
   return {
      moveX: 1,
      moveY: -1,
      jump: true,
      action: true,
      jumpPressed: true,
      actionPressed: true,
      pressed: { left: true, right: true, up: true, down: true },
      swipe: "up",
      tap: { x: 0.2, y: 0.4 },
      tapDown: { x: 0.2, y: 0.4 },
      pointer: { x: 0.2, y: 0.4, down: true },
      digit: 3,
      drag: { active: true, released: true, cancelled: false, power: 0.8 },
   };
}

function pose(): IntroCameraPose {
   return { position: { x: 0, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } };
}

const PLAY = { position: [3, 4, 5] as const, lookAt: [0, 1, 2] as const };
const KEYS = [
   { position: [10, 8, 20] as const, lookAt: [0, 2, 0] as const },
   { position: [6, 6, 12] as const, lookAt: [1, 2, 1] as const },
   { position: [4, 5, 8] as const, lookAt: [0, 1.5, 1] as const },
];

function expectPlay(out: IntroCameraPose): void {
   expect(out.position.x).toBe(PLAY.position[0]);
   expect(out.position.y).toBe(PLAY.position[1]);
   expect(out.position.z).toBe(PLAY.position[2]);
   expect(out.lookAt.x).toBe(PLAY.lookAt[0]);
   expect(out.lookAt.y).toBe(PLAY.lookAt[1]);
   expect(out.lookAt.z).toBe(PLAY.lookAt[2]);
}

describe("intro timings", () => {
   it("plays the full 7 s schedule inside the 5–8 s bar, phase by phase", () => {
      expect(introTotalMs("full")).toBe(7000);
      expect(introTotalMs("full")).toBeGreaterThanOrEqual(5000);
      expect(introTotalMs("full")).toBeLessThanOrEqual(8000);
      expect(introDurations("full")).toEqual({ flyThrough: 4000, heroLanding: 1600, title: 1400 });
      expect(introDurations("full")).toBe(FULL_INTRO);

      let state = createIntro("full");
      expect(state.phase).toBe("fly-through");
      expect(introShowsTitle(state)).toBe(false);
      expect(heroProgress(state)).toBe(0);
      expect(cameraProgress(state)).toBe(0);

      state = advanceIntro(state, 3999);
      expect(state.phase).toBe("fly-through");
      expect(state.elapsedMs).toBe(3999);

      state = advanceIntro(state, 1);
      expect(state.phase).toBe("hero-landing");
      expect(state.phaseMs).toBe(0);
      expect(cameraProgress(state)).toBe(1);
      expect(heroProgress(state)).toBe(0);

      state = advanceIntro(state, 800);
      expect(heroProgress(state)).toBe(0.5);
      expect(state.phase).toBe("hero-landing");

      state = advanceIntro(state, 800);
      expect(state.phase).toBe("title");
      expect(introShowsTitle(state)).toBe(true);
      expect(heroProgress(state)).toBe(1);

      state = advanceIntro(state, 1399);
      expect(state.phase).toBe("title");
      state = advanceIntro(state, 1);
      expect(state).toMatchObject({ phase: "done", elapsedMs: 7000, skipped: false });
      expect(introShowsTitle(state)).toBe(false);
      expect(introReady(state)).toBe(true);
   });

   it("plays the short intro in 1.5 s: title up, no landing phase, hero already down", () => {
      expect(introTotalMs("short")).toBe(1500);
      expect(introTotalMs("short")).toBeGreaterThanOrEqual(1400);
      expect(introTotalMs("short")).toBeLessThanOrEqual(1600);
      expect(introDurations("short")).toEqual({ flyThrough: 500, heroLanding: 0, title: 1000 });
      expect(introDurations("short")).toBe(SHORT_INTRO);

      let state = createIntro("short");
      expect(state.phase).toBe("fly-through");
      expect(introShowsTitle(state)).toBe(true);
      expect(heroProgress(state)).toBe(1);

      const seen = new Set<string>();
      while (state.phase !== "done") {
         seen.add(state.phase);
         state = advanceIntro(state, 1);
      }
      expect([...seen]).toEqual(["fly-through", "title"]);
      expect(state.elapsedMs).toBe(1500);

      const settled = advanceIntro(createIntro("short"), 500);
      expect(settled.phase).toBe("title");
      expect(settled.phaseMs).toBe(0);
      expect(cameraProgress(settled)).toBe(1);
   });

   it("crosses a phase boundary in one step, ignores a bad dt, and a capped hitch cannot finish it", () => {
      const crossed = advanceIntro(createIntro("full"), 4100);
      expect(crossed).toMatchObject({ phase: "hero-landing", phaseMs: 100, elapsedMs: 4100 });

      const fresh = createIntro("full");
      expect(advanceIntro(fresh, Number.NaN)).toEqual(fresh);
      expect(advanceIntro(fresh, -5)).toEqual(fresh);
      expect(fresh.phaseMs).toBe(0);

      const done = advanceIntro(fresh, 99999);
      expect(done).toMatchObject({ phase: "done", elapsedMs: 7000 });

      // GameIntro feeds the machine clampFrameDt(delta) * 1000, so a 2 s hitch moves 50 ms.
      const hitch = clampFrameDt(2) * 1000;
      expect(hitch).toBe(50);
      expect(advanceIntro(createIntro("full"), hitch).phase).toBe("fly-through");
      expect(advanceIntro(createIntro("short"), hitch).phase).toBe("fly-through");
   });

   it("uses the same durations on the low tier and does not publish every frame", () => {
      expect(introDurations("full", "low")).toBe(introDurations("full", "high"));
      expect(introDurations("full", "mid")).toBe(FULL_INTRO);
      expect(introDurations("short", "low")).toBe(introDurations("short", "high"));

      let calls = 0;
      const session = createIntroSession("full");
      session.subscribe(() => {
         calls += 1;
      });
      session.advance(100);
      expect(calls).toBe(0);
      expect(session.state.phase).toBe("fly-through");
      session.advance(3900);
      expect(session.state.phase).toBe("hero-landing");
      expect(calls).toBe(1);
      expect(easeIntro(0)).toBe(0);
      expect(easeIntro(1)).toBe(1);
      expect(cameraProgress(advanceIntro(createIntro("full"), 2000))).toBe(easeIntro(0.5));
   });
});

describe("skip", () => {
   const phases: IntroPhase[] = ["fly-through", "hero-landing", "title"];

   it("ends the intro from a key, a tap or the button in every phase and clears the latched input", () => {
      for (const phase of phases) {
         for (const source of ["key", "tap", "button"] as const) {
            const state = advanceIntro(seek(phase), 10);
            expect(state.phase).toBe(phase);
            const input = latched();
            const next = requestIntroSkip(state, source, input);
            expect(state.phase).toBe(phase);
            expect(next).toMatchObject({ phase: "done", skipped: true, skipSource: source, elapsedMs: 7000 });
            expect(cameraProgress(next)).toBe(1);
            expect(heroProgress(next)).toBe(1);
            expect(input).toMatchObject({
               moveX: 0,
               moveY: 0,
               jump: false,
               action: false,
               jumpPressed: false,
               actionPressed: false,
               swipe: null,
               tap: null,
               tapDown: null,
               digit: null,
               pressed: { left: false, right: false, up: false, down: false },
               pointer: { x: 0.2, y: 0.4, down: false },
            });
            expect(input.drag).toMatchObject({ active: false, released: false, cancelled: true, power: 0 });
         }
      }
   });

   it("swallows the skipping key's repeat and keyup, and the tap's pointer-up, then lets the next press through", () => {
      for (const phase of phases) {
         const keys: IntroKeyGate = { held: new Set() };
         expect(gateIntroKey(keys, phase, { type: "down", code: "Space" })).toBe("skip");
         expect(gateIntroKey(keys, phase, { type: "down", code: "Space", repeat: true })).toBe("swallow");
         expect(gateIntroKey(keys, "done", { type: "down", code: "Space", repeat: true })).toBe("swallow");
         expect(gateIntroKey(keys, "done", { type: "up", code: "Space" })).toBe("swallow");
         expect(gateIntroKey(keys, "done", { type: "down", code: "Space" })).toBe("pass");

         const pointer: IntroPointerGate = { down: false };
         expect(gateIntroPointer(pointer, phase, { type: "down", button: 0 })).toBe("skip");
         expect(gateIntroPointer(pointer, "done", { type: "up" })).toBe("swallow");
         expect(gateIntroPointer(pointer, "done", { type: "down" })).toBe("pass");
      }

      const keys: IntroKeyGate = { held: new Set() };
      expect(gateIntroKey(keys, "title", { type: "down", code: "KeyS", ctrlKey: true })).toBe("pass");
      expect(gateIntroKey(keys, "title", { type: "down", code: "ShiftLeft" })).toBe("pass");
      expect(keys.held.size).toBe(0);

      const pointer: IntroPointerGate = { down: false };
      expect(gateIntroPointer(pointer, "fly-through", { type: "down", button: 2 })).toBe("pass");
      expect(pointer.down).toBe(false);
   });

   it("leaves a control outside the intro alone, and leaves the Skip button's click to the button", () => {
      const outside = { inIntro: false, onSkipControl: false, outsideControl: true, editable: false };
      expect(introTargetAllowsSkip("key", outside)).toBe(false);
      expect(introTargetAllowsSkip("tap", outside)).toBe(false);
      expect(introTargetAllowsSkip("key", { inIntro: false, onSkipControl: false, outsideControl: false, editable: true })).toBe(false);
      expect(introTargetAllowsSkip("tap", { inIntro: true, onSkipControl: false, outsideControl: false, editable: false })).toBe(true);
      expect(introTargetAllowsSkip("tap", { inIntro: true, onSkipControl: true, outsideControl: false, editable: false })).toBe(false);
      expect(introTargetAllowsSkip("key", { inIntro: false, onSkipControl: false, outsideControl: false, editable: false })).toBe(true);

      const done = advanceIntro(createIntro("full"), 99999);
      const input = latched();
      expect(requestIntroSkip(done, "key", input)).toBe(done);
      expect(input.jumpPressed).toBe(true);
   });
});

describe("first view", () => {
   afterEach(() => {
      vi.unstubAllGlobals();
   });

   it("remembers slug + level when the intro finishes, and a throw falls back to the full intro", () => {
      const store = memory();
      expect(introStorageKey("sky-tower-jump", 1)).toBe("play50games_3d_intro:sky-tower-jump:1");
      expect(readIntroSeen(store, "sky-tower-jump", 1)).toBe(false);
      expect(loadIntroVariant(store, "sky-tower-jump", 1, false)).toBe("full");

      let done = 0;
      const session = createIntroSession(loadIntroVariant(store, "sky-tower-jump", 1, false), () => {
         markIntroSeen(store, "sky-tower-jump", 1);
         done += 1;
      });
      expect(session.getSnapshot()).toMatchObject({ ready: false, variant: "full", showsTitle: false });
      session.advance(introTotalMs("full"));
      expect(session.getSnapshot().ready).toBe(true);
      expect(done).toBe(1);
      session.advance(50);
      session.skip("key");
      expect(done).toBe(1);

      expect(readIntroSeen(store, "sky-tower-jump", 1)).toBe(true);
      expect(loadIntroVariant(store, "sky-tower-jump", 1, false)).toBe("short");
      expect(loadIntroVariant(store, "sky-tower-jump", 2, false)).toBe("full");
      expect(loadIntroVariant(store, "crystal-cave-run", 1, false)).toBe("full");
      expect(createIntroSession("short").getSnapshot().showsTitle).toBe(true);

      const bomb: IntroStorage = {
         getItem() {
            throw new Error("blocked");
         },
         setItem() {
            throw new Error("blocked");
         },
      };
      expect(loadIntroVariant(bomb, "sky-tower-jump", 1, false)).toBe("full");
      expect(() => markIntroSeen(bomb, "sky-tower-jump", 1)).not.toThrow();
      expect(readIntroSeen(bomb, "sky-tower-jump", 1)).toBe(false);

      const denied: IntroStorage = {
         get getItem(): IntroStorage["getItem"] {
            throw new Error("denied");
         },
         setItem() {
            throw new Error("denied");
         },
      };
      expect(readIntroSeen(denied, "sky-tower-jump", 3)).toBe(false);
      expect(() => markIntroSeen(denied, "sky-tower-jump", 3)).not.toThrow();
      expect(loadIntroVariant(null, "sky-tower-jump", 1, false)).toBe("full");

      vi.stubGlobal("window", {
         get localStorage(): Storage {
            throw new Error("blocked");
         },
      });
      expect(browserIntroStorage()).toBeNull();
      expect(resolveIntroVariant(false, false)).toBe("full");
   });
});

describe("reduced motion", () => {
   it("plays the short intro even on a first view", () => {
      expect(readReducedMotion(() => ({ matches: true }))).toBe(true);
      expect(readReducedMotion(() => ({ matches: false }))).toBe(false);
      expect(readReducedMotion(null)).toBe(false);
      expect(readReducedMotion(() => {
         throw new Error("no matchMedia");
      })).toBe(false);

      const store = memory();
      expect(readIntroSeen(store, "sky-tower-jump", 1)).toBe(false);
      expect(loadIntroVariant(store, "sky-tower-jump", 1, true)).toBe("short");
      expect(resolveIntroVariant(true, false)).toBe("short");
      expect(resolveIntroVariant(false, false)).toBe("full");

      const session = createIntroSession(loadIntroVariant(store, "sky-tower-jump", 1, true));
      expect(session.state.variant).toBe("short");
      expect(session.getSnapshot().showsTitle).toBe(true);
      session.advance(1499);
      expect(session.state.phase).not.toBe("done");
      session.advance(1);
      expect(session.getSnapshot().ready).toBe(true);
      expect(session.state.elapsedMs).toBe(1500);
   });
});

describe("run clock gate", () => {
   it("does not advance a fake run clock during the intro, then counts the frames after it", () => {
      let intro = createIntro("full");
      let clock = { elapsedMs: 0 };
      while (!introReady(intro)) {
         const stepped = stepGatedClock(clock, intro, 50);
         expect(stepped.clock.elapsedMs).toBe(0);
         clock = stepped.clock;
         intro = stepped.intro;
      }
      expect(intro.elapsedMs).toBe(7000);
      expect(clock.elapsedMs).toBe(0);
      const next = stepGatedClock(clock, intro, 50);
      expect(next.clock.elapsedMs).toBe(50);
      expect(next.intro.phase).toBe("done");

      // A skip spends that frame on the intro too. The following frame is the first play frame.
      let skipped = advanceIntro(createIntro("full"), 800);
      const parked = { elapsedMs: 0 };
      expect(gatedRunDt(skipped, 50)).toBe(0);
      skipped = requestIntroSkip(skipped, "tap");
      expect(introReady(skipped)).toBe(true);
      expect(stepGatedClock(parked, skipped, 40).clock.elapsedMs).toBe(40);
   });

   it("leaves the real run clock at ready with elapsedMs 0 until the intro is done", () => {
      const store = createArcadeStore();
      store.getState().configure({ durationMs: 30000 });
      store.getState().markReady();
      let intro = createIntro("full");
      let gated = 0;
      while (!introReady(intro)) {
         const dt = 50;
         const runDt = gatedRunDt(intro, dt);
         gated += runDt;
         if (runDt > 0) store.getState().tick(runDt);
         intro = advanceIntro(intro, dt);
      }
      expect(gated).toBe(0);
      expect(store.getState()).toMatchObject({ phase: "ready", elapsedMs: 0 });

      store.getState().start();
      // tick() caps a frame at 250 ms, so the 3 s countdown takes several frames. None of them
      // are play time, and none of them came from the intro.
      let guard = 0;
      while (store.getState().phase === "countdown" && guard < 20) {
         store.getState().tick(gatedRunDt(intro, COUNTDOWN_MS));
         guard += 1;
      }
      expect(guard).toBeGreaterThan(0);
      expect(store.getState()).toMatchObject({ phase: "playing", elapsedMs: 0 });
      store.getState().tick(gatedRunDt(intro, 40));
      expect(store.getState().elapsedMs).toBe(40);
   });
});

describe("camera spline", () => {
   it("ends exactly on the play camera for the full fly, the short settle and a skip", () => {
      const spline = createIntroSpline(KEYS, PLAY);
      const out = pose();
      const position = out.position;
      const lookAt = out.lookAt;

      sampleIntroCamera(spline, "full", 0, out);
      expect(out.position.x).toBe(KEYS[0].position[0]);
      expect(out.position.y).toBe(KEYS[0].position[1]);
      expect(out.position.z).toBe(KEYS[0].position[2]);
      expect(out.lookAt.x).toBe(KEYS[0].lookAt[0]);

      // the middle keyframe is a knot of the spline, so it is exact
      sampleIntroCamera(spline, "full", 1 / (spline.count - 1), out);
      expect(out.position.x).toBe(KEYS[1].position[0]);
      expect(out.position.y).toBe(KEYS[1].position[1]);
      expect(out.position.z).toBe(KEYS[1].position[2]);
      expect(out.lookAt.y).toBe(KEYS[1].lookAt[1]);

      sampleIntroCamera(spline, "full", 1, out);
      expectPlay(out);
      sampleIntroCamera(spline, "short", 1, out);
      expectPlay(out);

      sampleIntroCamera(spline, "short", 0, out);
      expect(out.position.x).toBe(KEYS[2].position[0]);
      expect(out.position.z).toBe(KEYS[2].position[2]);
      expect(out.position.x).not.toBe(PLAY.position[0]);

      let flown = createIntro("full");
      while (flown.phase !== "done") flown = advanceIntro(flown, 50);
      sampleIntroCamera(spline, flown.variant, cameraProgress(flown), out);
      expectPlay(out);

      const skipped = requestIntroSkip(advanceIntro(createIntro("full"), 250), "button");
      sampleIntroCamera(spline, skipped.variant, cameraProgress(skipped), out);
      expectPlay(out);

      let settled = createIntro("short");
      while (settled.phase === "fly-through") settled = advanceIntro(settled, 50);
      sampleIntroCamera(spline, "short", cameraProgress(settled), out);
      expectPlay(out);

      const only = createIntroSpline([], PLAY);
      sampleIntroCamera(only, "full", 0, out);
      expectPlay(out);
      sampleIntroCamera(only, "short", 0.4, out);
      expectPlay(out);

      for (let i = 0; i <= 20; i++) sampleIntroCamera(spline, "full", i / 20, out);
      expect(out.position).toBe(position);
      expect(out.lookAt).toBe(lookAt);
   });
});

describe("overlay", () => {
   it("shows the title and the level name with Skip, and hides the title before that phase", () => {
      const shown = renderToStaticMarkup(
         createElement(GameIntroOverlay, {
            title: "Sky Tower Jump",
            levelName: "First Landing",
            showsTitle: true,
            onSkip: () => {},
         })
      );
      expect(shown).toContain("Sky Tower Jump");
      expect(shown).toContain("First Landing");
      expect(shown).toContain("Skip");
      expect(shown).toContain("data-arcade-intro");
      expect(shown).toContain('type="button"');

      const flying = renderToStaticMarkup(
         createElement(GameIntroOverlay, {
            title: "Sky Tower Jump",
            levelName: "First Landing",
            showsTitle: false,
            onSkip: () => {},
         })
      );
      expect(flying).not.toContain("Sky Tower Jump");
      expect(flying).not.toContain("First Landing");
      expect(flying).toContain("Skip");
   });
});
