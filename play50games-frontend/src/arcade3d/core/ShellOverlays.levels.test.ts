// The level UI in the shell: start-card tiles (locked / open / cleared, best per level, total),
// the HUD's L-chip, the result's Next level / Retry / Levels / Exit, and the gate that keeps all
// of it off unless the flag is on, the game has five levels and the server supports them. GameShell
// itself is not rendered in tests (R3F canvas), so its wiring is pinned in its source.
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ArcadeGameMeta } from "@/arcade3d/types";
import { describe, expect, it, vi } from "vitest";
import type { LevelId } from "../types";
import { robotCollectorMeta } from "../games/robot-collector/meta";
import { obstacleRaceMeta } from "../games/obstacle-race/meta";
import type { GameDefinition } from "./types";
import type { LeaderboardState } from "./useLeaderboard";
import { HudChips, StartCard, type StartCardLevels } from "./ShellOverlays";
import LevelTiles, { hasLongWord, unlockHint } from "./LevelTiles";
import ResultPanel, { type ResultPanelProps } from "../ui/ResultPanel";
import { levelUiEnabled } from "./levels";
import { levelCardText, levelProgress } from "./levelProgress";
import { normalizeEntry } from "./scores";
import { withLevels } from "./testing/levelFixtures";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../registry", async (importOriginal) => {
   const original = await importOriginal<typeof import("../registry")>();
   const { withLevels: add } = await import("./testing/levelFixtures");
   const five = new Map(["robot-collector", "obstacle-race"].map((slug) => [slug, add(original.getGameMeta(slug)!)]));
   return { ...original, getGameMeta: (slug: string) => five.get(slug) ?? original.getGameMeta(slug) };
});

const FIVE = withLevels(robotCollectorMeta);
/** robot-collector as it was before its levels: a one-level game */
const ONE: ArcadeGameMeta = { ...robotCollectorMeta, levels: undefined };
const DEFINITION = { instructions: ["Collect every battery."] } as unknown as GameDefinition;
const leaderboard = { enabled: false, data: null, loading: false, error: null, retry: () => {} } as unknown as LeaderboardState;

const lvl = (best: number, cleared = false) => ({ best, bestDurationMs: 40000, plays: 1, lastPlayed: "", cleared });
const ENTRY = normalizeEntry("robot-collector", { best: 0, bestDurationMs: null, plays: 3, lastPlayed: "", rank: null, levels: { "1": lvl(620), "2": lvl(250) } }, true);
const PROGRESS = levelProgress(FIVE, ENTRY, true);

const levelsProp = (selected: LevelId): StartCardLevels => ({
   progress: PROGRESS,
   selected,
   description: `Description of level ${selected}`,
   instructions: [`Instructions of level ${selected}`],
   onSelect: () => {},
});

const startCard = (levels?: StartCardLevels) =>
   renderToStaticMarkup(
      createElement(StartCard, { meta: FIVE, definition: DEFINITION, coarse: false, exitHref: "/3d", leaderboard, onPlay: () => {}, levels })
   );

describe("the gate", () => {
   it("shows the level UI only with the flag on, five levels and a server that supports them", () => {
      expect(levelUiEnabled(FIVE, true, true)).toBe(true);
      expect(levelUiEnabled(FIVE, true, false)).toBe(false);
      expect(levelUiEnabled(FIVE, null, true)).toBe(false);
      expect(levelUiEnabled(FIVE, false, true)).toBe(false);
      // a game without levels never shows it, flag on or not
      expect(levelUiEnabled(ONE, true, true)).toBe(false);
      // the default reads NEXT_PUBLIC_ARCADE_LEVELS, which is off here
      expect(levelUiEnabled(FIVE, true)).toBe(false);
   });

   it("GameShell passes the level UI only behind that gate", () => {
      const shell = readFileSync(path.join(__dirname, "GameShell.tsx"), "utf8");
      expect(shell).toContain("const levelsOn = levelUiEnabled(meta, levelsSupported);");
      expect(shell).toContain("const levelId: LevelId = levelsOn ? storeLevelId : 1;");
      expect(shell).toMatch(/levels=\{\s*levelsOn\s*\?/);
      expect(shell).toContain("level={levelsOn ? levelId : null}");
      expect(shell).toMatch(/level=\{\s*levelsOn\s*\?\s*\{ id: resultLevel/);
      expect(shell).toContain("totalText={levelsOn ? levelTotalText(meta, progress) : undefined}");
      expect(shell).toContain("onLevels={levelsOn ? () => arcadeStore.getState().menu() : undefined}");
      expect(shell).toContain("const nextLevel = levelsOn && resultLevel < levelCount(meta)");
      // analytics carry `level` only with the level UI on
      expect(shell).toContain("const levelField = (level: LevelId) => (levelsOnRef.current ? { level } : {});");
   });
});

describe("start card with levels", () => {
   it("without `levels` (flag off, one-level game) it has no tiles and keeps the best badge and the game's instructions", () => {
      const html = startCard();
      expect(html).not.toContain('role="radiogroup"');
      expect(html).not.toContain("levels cleared");
      expect(html).toContain("Collect every battery.");
      expect(html).toContain("No score yet");
      expect(html).toContain(">Play</button>");
      expect(html).not.toContain("disabled");
   });

   it("shows five tiles: cleared, open and locked, each with its best, then the total", () => {
      const html = startCard(levelsProp(2));
      expect(html).toContain('role="radiogroup"');
      expect(html.match(/role="radio"/g)).toHaveLength(5);
      expect(html).toContain('aria-label="Level 1, First Steps, cleared"');
      expect(html).toContain('aria-label="Level 2, Busy Floor"');
      expect(html).toContain('aria-label="Level 3, Copy Room, locked"');
      expect(html).toContain(">620 pts<");
      expect(html).toContain(">250 pts<");
      // one tab stop: the selected tile
      expect(html.match(/tabindex="0"/g)).toHaveLength(1);
      expect(html).toMatch(/aria-checked="true"[^>]*aria-label="Level 2/);
      expect(html).toContain("Description of level 2");
      expect(html).toContain("Total 870 pts · 1 of 5 levels cleared");
      // the level's instructions replace the game's; the badge gives way to the total
      expect(html).toContain("Instructions of level 2");
      expect(html).not.toContain("Collect every battery.");
      expect(html).not.toContain("No score yet");
      expect(html).toContain('aria-label="Play level 2"');
   });

   it("a locked level shows how it unlocks and disables Play", () => {
      const html = startCard(levelsProp(4));
      expect(html).toContain(unlockHint(4));
      expect(unlockHint(4)).toBe("Clear level 3 to unlock");
      expect(html).not.toContain("Description of level 4");
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Level 4 is locked"/);
   });

   it("time games show times per tile and no total until all 5 are finished", () => {
      const race = withLevels(obstacleRaceMeta);
      const entry = normalizeEntry("obstacle-race", { best: 0, bestDurationMs: null, plays: 1, lastPlayed: "", rank: null, levels: { "1": lvl(26000) } }, true);
      const progress = levelProgress(race, entry, true);
      const html = renderToStaticMarkup(createElement(LevelTiles, { meta: race, progress, selected: 1, onSelect: () => {} }));
      expect(html).toContain(">0:40.00<");
      expect(html).toContain("Finish all 5 levels to rank · 1 of 5 levels cleared");
      expect(levelCardText(race, progress)).toBe("Finish all 5 levels to rank · 1/5");
      expect(levelCardText(FIVE, PROGRESS)).toBe("Total 870 pts · 1/5");
   });
});

describe("tile titles", () => {
   it("a long title wraps (never cut with an ellipsis); a word too long for the tile gets the smaller size", () => {
      const css = readFileSync(path.join(__dirname, "LevelTiles.module.css"), "utf8");
      const title = /\.title \{[^}]*\}/.exec(css)![0];
      expect(title).not.toContain("nowrap");
      expect(title).not.toContain("ellipsis");
      expect(title).toContain("-webkit-line-clamp: 2");
      expect(hasLongWord("Royal Defense")).toBe(false);
      // a hyphen is a line break: "Closing-Time" wraps at it and keeps the normal size
      expect(hasLongWord("Closing-Time Rush")).toBe(false);
      expect(hasLongWord("Championship Course")).toBe(true);
      const race = withLevels(obstacleRaceMeta);
      const named = { ...race, levels: race.levels!.map((l, i) => (i === 4 ? { ...l, title: "Championship Course" } : l)) };
      const progress = levelProgress(named, normalizeEntry("obstacle-race", null, true), true);
      const html = renderToStaticMarkup(createElement(LevelTiles, { meta: named, progress, selected: 1, onSelect: () => {} }));
      expect(html).toMatch(/data-long=""[^>]*>Championship Course</);
      expect(html.match(/data-long/g)).toHaveLength(1);
   });
});

describe("HUD level chip", () => {
   const chips = (level?: LevelId | null) =>
      renderToStaticMarkup(
         createElement(HudChips, { scoring: robotCollectorMeta.scoring, score: 10, time: 30, timed: true, lives: null, stats: {}, level })
      );

   it("shows L3 first with the level UI on, nothing otherwise", () => {
      expect(chips(3)).toContain('aria-label="Level 3"');
      expect(chips(3)).toContain(">L3<");
      expect(chips(3).indexOf("Level 3")).toBeLessThan(chips(3).indexOf("Score"));
      expect(chips(null)).not.toContain("Level");
      expect(chips()).toBe(chips(null));
   });
});

describe("result panel with levels", () => {
   const base: ResultPanelProps = {
      title: "Time's up!",
      score: 620,
      durationMs: 40000,
      best: 620,
      bestDurationMs: 40000,
      isNewBest: true,
      status: "saved-local",
      scoring: robotCollectorMeta.scoring,
      onRetry: () => {},
      onExit: () => {},
   };
   const panel = (props: Partial<ResultPanelProps> = {}) => renderToStaticMarkup(createElement(ResultPanel, { ...base, ...props }));
   const buttons = (html: string) => [...html.matchAll(/<button[^>]*class="([^"]*)"[^>]*>([^<]*)<\/button>/g)].map((m) => m[2]);

   it("without level props it is the card as before: Retry and Exit only", () => {
      const html = panel();
      expect(buttons(html)).toEqual(["Retry", "Exit"]);
      expect(html).not.toContain("Level ");
      expect(html).not.toContain("Total");
   });

   it("with levels: the level line, the unlock note, the total and Next level / Retry / Levels / Exit", () => {
      const html = panel({
         level: { id: 1, title: "First Steps", count: 5 },
         totalText: "Total 870 pts",
         unlockedLevel: 2,
         onNextLevel: () => {},
         onLevels: () => {},
      });
      expect(html).toContain("Level 1 · First Steps");
      expect(html).toContain("Level 2 unlocked!");
      expect(html).toContain("Total 870 pts");
      expect(buttons(html)).toEqual(["Next level", "Retry", "Levels", "Exit"]);
      // Next level is the primary action, Retry steps back
      const next = html.match(/<button[^>]*class="([^"]*)"[^>]*>Next level</)![1];
      const retry = html.match(/<button[^>]*class="([^"]*)"[^>]*>Retry</)![1];
      expect(next).not.toBe(retry);
   });

   it("an uncleared level (or level 5) has no Next level, Retry stays primary", () => {
      const html = panel({ level: { id: 2, title: "Busy Floor", count: 5 }, totalText: "Total 870 pts", onLevels: () => {} });
      expect(buttons(html)).toEqual(["Retry", "Levels", "Exit"]);
      expect(html.match(/<button[^>]*class="([^"]*)"[^>]*>Retry</)![1]).toBe(panel().match(/<button[^>]*class="([^"]*)"[^>]*>Retry</)![1]);
   });
});

describe("tile row fit", () => {
   it("five tiles share the desktop card without a scrollbar; a phone row scrolls with its tiles clear of the card edge", () => {
      const css = readFileSync(path.join(__dirname, "LevelTiles.module.css"), "utf8");
      const row = /\.row \{[^}]*\}/.exec(css)![0];
      expect(row).toContain("overflow-x: auto");
      expect(row).toContain("scroll-padding-inline: var(--panel-pad-x");
      const desktop = /@media \(min-width: 640px\) \{([\s\S]*?)\n\}/.exec(css)![1];
      const tile = /\.tile \{[^}]*\}/.exec(desktop)![0];
      expect(tile).toContain("flex: 1 1 0");
      expect(tile).toContain("min-width: 0");
      // the desktop card: 520 px wide, 1 px border, 28 px padding, up to 12 px of scrollbar
      const content = 520 - 2 - 2 * 28 - 12;
      const gap = Number(/gap: (\d+)px/.exec(desktop)![1]);
      const pad = Number(/padding: (\d+)px/.exec(tile)![1]);
      const textWidth = (content - 4 * gap) / 5 - 2 * pad - 2;
      // "Warehouse", the longest word of any level title, at 12 px bold is about 62 px
      expect(textWidth).toBeGreaterThanOrEqual(64);
   });
});
