// useSafeArea(selector): the memoised selection that keeps a Scene from re-rendering when only
// unrelated rects change (e.g. a HUD chip that grows with the score), driven with the real store.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
   SafeAreaProvider,
   createSafeAreaSelection,
   createSafeAreaStore,
   bottomCover,
   bottomStrip,
   sameSafeArea,
   sameScreenRects,
   useSafeArea,
   type SafeArea,
   type ScreenRect,
} from "./safeArea";

const rect = (left: number, top: number, right: number, bottom: number): ScreenRect => ({ left, top, right, bottom });
const layout = (hudRight: number, controlsTop: number): SafeArea => ({
   width: 375,
   height: 812,
   hud: [rect(8, 8, hudRight, 48)],
   controls: [rect(16, controlsTop, 136, controlsTop + 120)],
   obstructions: [],
});

describe("useSafeArea selection", () => {
   it("calls the selector once per layout and selector, and keeps an equal value's identity", () => {
      const select = createSafeAreaSelection<ScreenRect[]>();
      const selector = vi.fn((area: SafeArea) => area.controls);
      const a = layout(120, 600);
      const first = select(a, selector, sameScreenRects);
      expect(select(a, selector, sameScreenRects)).toBe(first);
      expect(selector).toHaveBeenCalledTimes(1);
      // the HUD grew (a new layout), the controls did not move: same value back, no re-render
      const b = layout(160, 600);
      expect(select(b, selector, sameScreenRects)).toBe(first);
      expect(selector).toHaveBeenCalledTimes(2);
      // the controls moved: the new rects
      const c = layout(160, 440);
      const moved = select(c, selector, sameScreenRects);
      expect(moved).not.toBe(first);
      expect(moved).toBe(c.controls);
   });

   it("recomputes for a new selector on the same layout (selectors that close over props)", () => {
      const select = createSafeAreaSelection<number>();
      const a = layout(120, 600);
      expect(select(a, (area) => area.hud[0].right, Object.is)).toBe(120);
      expect(select(a, (area) => area.hud[0].right + 10, Object.is)).toBe(130);
   });

   it("with the real store: a subscriber only sees the changes its selection cares about", () => {
      const store = createSafeAreaStore();
      const select = createSafeAreaSelection<number>();
      const selector = (area: SafeArea) => (area.controls.length > 0 ? area.controls[0].top : -1);
      let value = select(store.get(), selector, Object.is);
      let renders = 0;
      store.subscribe(() => {
         const next = select(store.get(), selector, Object.is);
         if (!Object.is(next, value)) {
            value = next;
            renders += 1;
         }
      });
      store.set(layout(120, 600));
      expect(renders).toBe(1);
      for (const hudRight of [130, 140, 150, 160]) store.set(layout(hudRight, 600));
      expect(renders).toBe(1);
      store.set(layout(160, 438));
      expect(renders).toBe(2);
      expect(value).toBe(438);
   });

   it("sameScreenRects compares within half a px", () => {
      expect(sameScreenRects([rect(0, 0, 10, 10)], [rect(0.4, 0, 10, 9.6)])).toBe(true);
      expect(sameScreenRects([rect(0, 0, 10, 10)], [rect(0.6, 0, 10, 10)])).toBe(false);
      expect(sameScreenRects([], [rect(0, 0, 1, 1)])).toBe(false);
   });

   it("the hook works with and without a selector (server render: the empty layout outside GameShell)", () => {
      const store = createSafeAreaStore();
      store.set(layout(120, 600));
      function Probe() {
         const all = useSafeArea();
         const width = useSafeArea((area) => area.width);
         return createElement("span", null, `${all.hud.length}:${width}`);
      }
      expect(renderToString(createElement(Probe))).toContain("0:0");
      expect(renderToString(createElement(SafeAreaProvider, { store, children: createElement(Probe) }))).toContain("0:0");
   });
});

describe("bottom safe-area inset (L12)", () => {
   it("covers the taller of the banner and the home-indicator inset", () => {
      expect(bottomCover(0, 0)).toBe(0);
      expect(bottomCover(0, 34)).toBe(34);
      expect(bottomCover(120, 34)).toBe(120);
      expect(bottomCover(-5, Number.NaN)).toBe(0);
      // the inset alone becomes an obstruction strip the camera fit avoids
      expect(bottomStrip({ top: 0, width: 390, height: 844 }, 844, bottomCover(0, 34))).toEqual([rect(0, 810, 390, 844)]);
   });

   it("treats a changed inset as a new layout, and a missing one as 0", () => {
      const a = layout(120, 600);
      expect(sameSafeArea(a, { ...a, insetBottom: 0 })).toBe(true);
      expect(sameSafeArea(a, { ...a, insetBottom: 34 })).toBe(false);
   });
});
