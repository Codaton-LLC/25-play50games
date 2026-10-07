// The start card and the overlays' first focus: Play sits in the pinned bar, after the card's
// text and before the top 10; nothing in the shell uses autoFocus (it scrolls the overlay, so a
// landscape phone opened the start card ~300 px down with its title off screen); the wheel over
// the backdrop scrolls the panel. FocusButton's mount focus: overlayFocus.test.ts.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ArcadeGameMeta } from "../types";
import { foodCatcherMeta } from "../games/food-catcher/meta";
import type { GameDefinition } from "./types";
import type { LeaderboardState } from "./useLeaderboard";
import { focusWithoutScroll } from "./overlayFocus";
import { StartCard, scrollPanelFromBackdrop, type BackdropWheel, type ScrollBox } from "./ShellOverlays";
import styles from "./GameShell.module.css";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

const META: ArcadeGameMeta = { ...foodCatcherMeta, title: "Food Catcher" };

const DEFINITION = {
   instructions: ["Move the chef left and right.", "Three junk items end the run."],
} as unknown as GameDefinition;

const leaderboard = (enabled: boolean): LeaderboardState =>
   ({ enabled, data: { entries: [], me: null }, loading: false, error: null, retry: () => {} }) as unknown as LeaderboardState;

const render = (enabled: boolean) =>
   renderToStaticMarkup(
      createElement(StartCard, {
         meta: META,
         definition: DEFINITION,
         coarse: true,
         exitHref: "/3d",
         leaderboard: leaderboard(enabled),
         onPlay: () => {},
      })
   );

/** the start of the element carrying `className` (CSS module class) in the markup */
const at = (html: string, className: string) => html.search(new RegExp(`class="[^"]*\\b${className}\\b`));

describe("start card", () => {
   it("pins Play in the action bar after the card's text and before the top 10", () => {
      const html = render(true);
      const title = html.indexOf("<h1");
      const instructions = html.indexOf("Three junk items end the run.");
      const bar = at(html, styles.startAction);
      const play = html.indexOf(">Play</button>");
      const top10 = html.indexOf('aria-label="Food Catcher top 10"');
      expect(styles.startAction).toBeTruthy();
      expect(title).toBeGreaterThan(-1);
      expect(instructions).toBeGreaterThan(title);
      expect(bar).toBeGreaterThan(instructions);
      expect(play).toBeGreaterThan(bar);
      expect(top10).toBeGreaterThan(play);
      // the bar holds only Play: nothing else is pinned over the card
      expect(html.slice(bar, play).match(/<button/g)).toHaveLength(1);
   });

   it("ends with the Play bar when the leaderboard is off", () => {
      const html = render(false);
      expect(html).not.toContain("top 10");
      expect(html.endsWith("Play</button></div></div></div>")).toBe(true);
   });

   it("marks the panel as the start card's and never asks for autofocus", () => {
      const html = render(true);
      expect(at(html, styles.startPanel)).toBeGreaterThan(-1);
      expect(html.toLowerCase()).not.toContain("autofocus");
      expect(html).toContain('aria-label="Food Catcher: start"');
   });

   // the layout itself is measured in a browser; this guards the rules it rests on
   it("keeps the panel's scrolling rules in the stylesheet", () => {
      const css = readFileSync(path.join(__dirname, "GameShell.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      const rule = (selector: string) => {
         const found = css.match(new RegExp(`(?:^|\\n)${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`));
         return (found?.[1] ?? "").replace(/\s+/g, " ");
      };
      const panel = rule(".panel");
      expect(panel).toContain("max-height: 100%;");
      expect(panel).toContain("overflow-y: auto;");
      // absolutely positioned content (the top 10's hidden caption) stays inside the scrolling panel
      expect(panel).toContain("position: relative;");
      expect(rule(".startAction")).toContain("position: sticky;");
      expect(rule(".startAction")).toContain("bottom: 0;");
   });
});

describe("overlay focus", () => {
   it("focuses without scrolling", () => {
      const calls: (FocusOptions | undefined)[] = [];
      expect(focusWithoutScroll({ focus: (options) => calls.push(options) })).toBe(true);
      expect(calls).toEqual([{ preventScroll: true }]);
   });

   it("ignores a missing element", () => {
      expect(focusWithoutScroll(null)).toBe(false);
      expect(focusWithoutScroll(undefined)).toBe(false);
   });

   it("is the only way the shell focuses an overlay: no autoFocus, no bare focus() anywhere in core", () => {
      // every source file under core/, its subfolders (render/, rig/) included
      const sources = (dir: string): string[] =>
         readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
            entry.isDirectory() ? sources(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
         );
      const files = sources(__dirname)
         .map((file) => path.relative(__dirname, file).split(path.sep).join("/"))
         .filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".test.ts"));
      expect(files).toContain("GameShell.tsx");
      expect(files).toContain("rig/HumanoidModel.tsx");
      expect(files).toContain("render/Instanced.tsx");
      const offenders: string[] = [];
      for (const file of files) {
         const source = readFileSync(path.join(__dirname, file), "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/(^|[^:])\/\/.*$/gm, "$1");
         // the JSX prop, not the "autoFocus" key FocusButton leaves out of its props
         if (/(?<!["'])\bautoFocus\b(?!["'])/.test(source)) offenders.push(`${file}: autoFocus`);
         if (/\.focus\(\s*\)/.test(source)) offenders.push(`${file}: focus()`);
      }
      expect(offenders).toEqual([]);
   });
});

describe("wheel over the backdrop", () => {
   const box = (scrollHeight: number, clientHeight: number) => {
      const calls: ScrollToOptions[] = [];
      const target: ScrollBox & { calls: ScrollToOptions[] } = {
         scrollHeight,
         clientHeight,
         calls,
         scrollBy: (options) => {
            calls.push(options);
         },
      };
      return target;
   };
   const overlay = box(740, 740);
   const wheel = (patch: Partial<BackdropWheel> = {}): BackdropWheel => ({
      target: overlay,
      currentTarget: overlay,
      deltaY: 100,
      deltaMode: 0,
      ctrlKey: false,
      ...patch,
   });

   it("scrolls a panel taller than its box by the wheel's distance", () => {
      const panel = box(1400, 700);
      expect(scrollPanelFromBackdrop(wheel(), overlay, panel)).toBe(true);
      expect(scrollPanelFromBackdrop(wheel({ deltaY: -3, deltaMode: 1 }), overlay, panel)).toBe(true);
      expect(scrollPanelFromBackdrop(wheel({ deltaY: 1, deltaMode: 2 }), overlay, panel)).toBe(true);
      expect(panel.calls).toEqual([{ top: 100 }, { top: -48 }, { top: 700 }]);
   });

   it("leaves the panel alone over the panel, on a zoom, without a vertical delta or with nothing to scroll", () => {
      const panel = box(1400, 700);
      expect(scrollPanelFromBackdrop(wheel({ target: panel }), overlay, panel)).toBe(false);
      expect(scrollPanelFromBackdrop(wheel({ ctrlKey: true }), overlay, panel)).toBe(false);
      expect(scrollPanelFromBackdrop(wheel({ deltaY: 0 }), overlay, panel)).toBe(false);
      expect(scrollPanelFromBackdrop(wheel(), overlay, box(300, 300))).toBe(false);
      expect(scrollPanelFromBackdrop(wheel(), overlay, null)).toBe(false);
      // an overlay that scrolls itself already moves under the wheel: no second scroll
      expect(scrollPanelFromBackdrop(wheel(), box(1600, 740), panel)).toBe(false);
      expect(panel.calls).toEqual([]);
   });
});
