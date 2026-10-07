// The overlays' first focus on mount: FocusButton hands its own ref to useInitialFocus, whose
// effect focuses that element once, without scrolling (preventScroll). There is no DOM here, so
// React's useRef / useEffect are stubbed and the component and the hook run as plain functions:
// the effects they register are collected and run by hand, as React runs them after mounting.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { useInitialFocus, type Focusable } from "./overlayFocus";
import { FocusButton } from "./ShellOverlays";

const hooks = vi.hoisted(() => ({
   effects: [] as { run: () => void; deps: readonly unknown[] | undefined }[],
   ref: { current: null as unknown },
}));

vi.mock("react", async (importOriginal) => {
   const actual = await importOriginal<typeof import("react")>();
   return {
      ...actual,
      useEffect: (run: () => void, deps?: readonly unknown[]) => {
         hooks.effects.push({ run, deps });
      },
      useRef: () => hooks.ref,
   };
});

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

const focusable = () => {
   const calls: (FocusOptions | undefined)[] = [];
   const element: Focusable & { calls: typeof calls } = { calls, focus: (options) => calls.push(options) };
   return element;
};

beforeEach(() => {
   hooks.effects.length = 0;
   hooks.ref.current = null;
});

describe("useInitialFocus", () => {
   it("focuses the element once, after mounting, without scrolling", () => {
      const button = focusable();
      const ref = { current: button };
      useInitialFocus(ref);
      expect(hooks.effects).toHaveLength(1);
      // the effect, not the render, focuses: nothing yet
      expect(button.calls).toEqual([]);
      // runs again only if the ref object changes, never on a re-render
      expect(hooks.effects[0].deps).toEqual([ref]);
      hooks.effects[0].run();
      expect(button.calls).toEqual([{ preventScroll: true }]);
   });

   it("does nothing when the element is gone", () => {
      useInitialFocus({ current: null });
      expect(() => hooks.effects[0].run()).not.toThrow();
   });
});

describe("FocusButton", () => {
   it("takes the focus when it mounts, without scrolling, through its own button", () => {
      const onClick = () => {};
      const element = FocusButton({ className: "primary", onClick, children: "Play" }) as ReactElement & {
         ref: unknown;
      };
      expect(element.type).toBe("button");
      expect(element.ref).toBe(hooks.ref);
      expect(element.props).toMatchObject({ className: "primary", onClick, children: "Play", type: "button" });
      expect(element.props).not.toHaveProperty("autoFocus");

      // React fills the ref with the mounted button, then runs the effects
      const button = focusable();
      hooks.ref.current = button;
      expect(hooks.effects).toHaveLength(1);
      hooks.effects[0].run();
      expect(button.calls).toEqual([{ preventScroll: true }]);
   });
});
