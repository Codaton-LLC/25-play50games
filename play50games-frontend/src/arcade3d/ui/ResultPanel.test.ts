import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ScoringRules } from "../types";
import { formatScore } from "../core/format";
import ResultPanel, { resultBestText, resultScoreText, type ResultPanelProps } from "./ResultPanel";
import styles from "./ResultPanel.module.css";

const TIME: ScoringRules = {
   kind: "time",
   maxScore: 30000,
   minDurationMs: 15000,
   maxDurationMs: 300000,
   base: 0,
   maxPointsPerSec: 0,
   timeBaseMs: 300000,
   unitLabel: "time",
   display: "time",
};

const POINTS: ScoringRules = {
   kind: "points",
   maxScore: 5000,
   minDurationMs: 3000,
   maxDurationMs: 75000,
   base: 600,
   maxPointsPerSec: 120,
   unitLabel: "pts",
   display: "int",
};

describe("result panel text", () => {
   it("shows Not ranked and No best yet for an unranked time run with no best", () => {
      expect(formatScore(0, TIME, 300000)).toBe("5:00.00");
      expect(formatScore(0, TIME, null)).toBe("0 time");
      expect(resultScoreText(0, TIME, 300000, "unranked")).toBe("Not ranked");
      expect(resultBestText(0, TIME, 300000, null, false)).toBe("No best yet");
   });

   it("keeps an existing best on an unranked time run and does not show this run's clock", () => {
      expect(resultScoreText(0, TIME, 300000, "unranked")).toBe("Not ranked");
      expect(resultBestText(21000, TIME, 300000, 90000, false)).toBe("Best 1:30.00");
   });

   it("shows the finish time for a ranked time win, including a first best", () => {
      expect(resultScoreText(21000, TIME, 90000, "login-required")).toBe("1:30.00");
      expect(resultBestText(21000, TIME, 90000, 90000, true)).toBe("Best 1:30.00");
      expect(resultScoreText(18000, TIME, 120000, "synced")).toBe("2:00.00");
      expect(resultBestText(21000, TIME, 120000, 90000, false)).toBe("Best 1:30.00");
   });

   it("leaves points games on the number, with or without a best", () => {
      expect(resultScoreText(0, POINTS, 75000, "unranked")).toBe("0 pts");
      expect(resultBestText(0, POINTS, 75000, null, false)).toBe("Best 0 pts");
      expect(resultScoreText(1250, POINTS, 40000, "saved-local")).toBe("1,250 pts");
      expect(resultBestText(1600, POINTS, 40000, null, false)).toBe("Best 1,600 pts");
      expect(resultBestText(1250, POINTS, 40000, null, true)).toBe("Best 1,250 pts");
   });
});

// The card scrolls inside its overlay and pins its actions on view, so the cookie banner never
// covers Log in / Save, Retry or Exit (measured in headless Chrome at 360 x 740, 390 x 844,
// 740 x 360, 844 x 390, 1280 x 720 and 1280 x 800, banner open and closed). These guard the
// markup and the rules that layout rests on.
describe("result card layout", () => {
   const noop = () => {};
   const render = (props: Partial<ResultPanelProps> = {}, extra = true) =>
      renderToStaticMarkup(
         createElement(
            ResultPanel,
            {
               title: "You did it!",
               score: 860,
               durationMs: 30000,
               best: 860,
               isNewBest: true,
               status: "login-required",
               scoring: POINTS,
               onRetry: noop,
               onExit: noop,
               onLogin: noop,
               ...props,
            },
            extra ? createElement("section", { "aria-label": "Robot Collector top 10" }, "Top 10") : undefined
         )
      );
   /** the start of the element carrying `className` (CSS module class) in the markup */
   const at = (html: string, className: string) => html.search(new RegExp(`class="[^"]*\\b${className}\\b`));
   /** the button labels inside the action bar, in order */
   const barButtons = (html: string) => {
      const start = at(html, styles.actions);
      const end = html.indexOf("</div>", start);
      return [...html.slice(start, end).matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
   };

   it("puts every action in the bar, after the message and before the top 10", () => {
      const html = render();
      expect(styles.actions).toBeTruthy();
      expect(barButtons(html)).toEqual(["Log in", "Retry", "Exit"]);
      const message = html.indexOf("Log in to put this on the leaderboard.");
      expect(message).toBeGreaterThan(-1);
      expect(at(html, styles.actions)).toBeGreaterThan(message);
      expect(html.indexOf("Robot Collector top 10")).toBeGreaterThan(at(html, styles.actions));
      // the card is the overlay's only child: the bar scrolls and pins within it
      expect(at(html, styles.card)).toBeGreaterThan(at(html, styles.overlay));
   });

   it("keeps Save, Retry and Exit together in the bar for a logged-in player", () => {
      const html = render({ onLogin: undefined, onSaveToAccount: noop });
      expect(barButtons(html)).toEqual(["Save this score to my account", "Retry", "Exit"]);
      expect(barButtons(render({ status: "synced", onLogin: undefined }))).toEqual(["Retry", "Exit"]);
   });

   it("ends with the bar when there is no extra content", () => {
      const html = render({}, false);
      expect(html.endsWith("Exit</button></div></div></div>")).toBe(true);
      expect(html).not.toContain(styles.extra);
   });

   it("keeps the scrolling and pinning rules in the stylesheet", () => {
      const css = readFileSync(path.join(__dirname, "ResultPanel.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      // the rule for exactly `selector` (not a selector list it ends)
      const rule = (selector: string) => {
         const escaped = selector.replace(/[.:]/g, (c) => `\\${c}`);
         return (css.match(new RegExp(`(?<!,\\s*)(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "").replace(/\s+/g, " ");
      };
      // the overlay never scrolls: the card does, at most as tall as the free area above the banner
      expect(rule(".overlay")).toContain("overflow: hidden;");
      const card = rule(".card");
      expect(card).toContain("max-height: 100%;");
      expect(card).toContain("overflow-y: auto;");
      expect(card).toContain("position: relative;");
      // no top / bottom padding (it would keep the pinned bar off the card's edges); boxes stand in
      expect(card).toMatch(/padding: 0 var\(--card-pad-x\);/);
      expect(rule(".card::before")).toContain("height: 1.15rem;");
      expect(rule(".card::after")).toContain("height: 1.05rem;");
      // the bar sticks to both edges, opaque, above the scrolling content
      const bar = rule(".actions");
      expect(bar).toContain("position: sticky;");
      expect(bar).toContain("top: 0;");
      expect(bar).toContain("bottom: 0;");
      expect(bar).toContain("z-index: 1;");
      expect(bar).toContain("background: var(--bg);");
      // short landscape screens: one row of buttons. Only the block itself (it ends at the first
      // `}` in column 0; inner rules are indented), wherever it sits in the file
      const short = css.match(/@media \(max-height: 520px\) and \(min-width: 560px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
      expect(short.replace(/\s+/g, " ")).toMatch(/\.primary, \.secondary \{ flex-basis: 0; \}/);
   });
});
