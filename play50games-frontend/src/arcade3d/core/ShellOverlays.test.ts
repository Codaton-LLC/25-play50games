// The start card and the overlays' first focus: Play sits in the pinned bar, after the card's
// text and before the top 10; nothing in the shell uses autoFocus (it scrolls the overlay, so a
// landscape phone opened the start card ~300 px down with its title off screen).
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
import { StartCard } from "./ShellOverlays";
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

   it("is the only way the shell focuses an overlay: no autoFocus, no bare focus() in core", () => {
      const dir = __dirname;
      const offenders: string[] = [];
      for (const file of readdirSync(dir)) {
         if (!/\.tsx?$/.test(file) || file.endsWith(".test.ts")) continue;
         const source = readFileSync(path.join(dir, file), "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/(^|[^:])\/\/.*$/gm, "$1");
         // the JSX prop, not the "autoFocus" key FocusButton leaves out of its props
         if (/(?<!["'])\bautoFocus\b(?!["'])/.test(source)) offenders.push(`${file}: autoFocus`);
         if (/\.focus\(\s*\)/.test(source)) offenders.push(`${file}: focus()`);
      }
      expect(offenders).toEqual([]);
   });
});
