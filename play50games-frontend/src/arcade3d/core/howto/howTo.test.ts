// The start card's "How to play" data: the derivation from the text every game already has (so
// every game gets keycaps, a phone and a 3-5 step wizard on day one), the explicit meta.howTo of
// the games that have one, and the start card drawing the right view per device.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ARCADE_GAMES } from "../../registry";
import { shoppingCartMeta } from "../../games/shopping-cart/meta";
import type { ArcadeGameMeta } from "../../types";
import type { GameDefinition } from "../types";
import type { LeaderboardState } from "../useLeaderboard";
import { StartCard } from "../ShellOverlays";
import { capsOf, deriveTouch, keyRole, parseKeyboard, resolveHowTo, specText, PAUSE_ID, type HowToSource } from "./howTo";
import { defaultMode } from "./ControlsPanel";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

const source = (keyboard: string, extra: Partial<HowToSource> = {}): HowToSource => ({
   controls: { scheme: "joystick", keyboard, touch: extra.controls?.touch ?? "" },
   instructions: [],
   ...extra,
});

const parsed = (keyboard: string) => parseKeyboard(keyboard).map((key) => ({ keys: key.keys, label: key.label, hold: !!key.hold }));

describe("parseKeyboard", () => {
   it("reads the common lines: movement cluster, a held action, alternatives", () => {
      expect(parsed("WASD / arrows to steer, hold Space to ride")).toEqual([
         { keys: ["WASD", "Arrows"], label: "Steer", hold: false },
         { keys: ["Space"], label: "Ride", hold: true },
      ]);
      expect(parsed("WASD / arrows to move, E or Enter to grab")).toEqual([
         { keys: ["WASD", "Arrows"], label: "Move", hold: false },
         { keys: ["E", "Enter"], label: "Grab", hold: false },
      ]);
   });

   it("keeps key pairs together and reads a verb without 'to' as a command", () => {
      expect(parsed("A / D rotate, W / S trolley, Space drop, 1-5 pick a pile")).toEqual([
         { keys: ["A/D"], label: "Rotate", hold: false },
         { keys: ["W/S"], label: "Trolley", hold: false },
         { keys: ["Space"], label: "Drop", hold: false },
         { keys: ["1-5"], label: "Pick a pile", hold: false },
      ]);
      expect(parsed("Arrows / WASD to strike, Space to spin")[0].keys).toEqual(["Arrows", "WASD"]);
      expect(parsed("Move the mouse left or right, or hold A / D or the arrows, to turn; Space or E flashes")).toContainEqual({
         keys: ["Space", "E"],
         label: "Flash",
         hold: false,
      });
   });

   it("lends a bare key clause to the next one of the same kind, never movement to an action", () => {
      expect(parsed("WASD / arrows to fly, Space, E or Enter to drop")[1]).toEqual({ keys: ["Space", "E", "Enter"], label: "Drop", hold: false });
      expect(parsed("A/D or Left/Right to move; Space, W or Up to jump")).toEqual([
         { keys: ["A/D", "Left/Right"], label: "Move", hold: false },
         { keys: ["Space", "W", "Up"], label: "Jump", hold: false },
      ]);
      // "WASD / arrows: left, right, up and down. C changes the view": no direction caption, C stays its own
      expect(parsed("WASD / arrows: left, right, up and down. 📷 or C changes the view")).toEqual([
         { keys: ["WASD", "Arrows"], label: "Move", hold: false },
         { keys: ["C"], label: "Change the view", hold: false },
      ]);
   });

   it("does not take words for keys: 'enter the beam', 'pick up / drop', 'diverters 1-3'", () => {
      expect(parsed("WASD / arrows to move; press E, Enter or Space to harvest at peak glow; enter the beam to deliver")).toEqual([
         { keys: ["WASD", "Arrows"], label: "Move", hold: false },
         { keys: ["E", "Enter", "Space"], label: "Harvest", hold: false },
      ]);
      expect(parsed("WASD / arrows to move, E or Enter to pick up / drop")[1]).toEqual({ keys: ["E", "Enter"], label: "Pick up or drop", hold: false });
      expect(parseKeyboard("A / left, S / down and D / right flip diverters 1–3").flatMap((key) => key.keys)).not.toContain("1-3");
   });

   it("marks the first movement and the first action as the main keys", () => {
      const keys = parseKeyboard("WASD / arrows to move, mouse to aim; hold E or Enter to scoop, Space to throw");
      expect(keys.filter((key) => key.main).map((key) => key.label)).toEqual(["Move", "Scoop"]);
      expect(keys.map(keyRole)).toEqual(["move", "pointer", "action", "action"]);
   });
});

describe("cap specs", () => {
   it("splits specs into caps and reads them in a sentence", () => {
      expect(capsOf("WASD")).toEqual(["W", "A", "S", "D"]);
      expect(capsOf("1-5")).toEqual(["1", "2", "3", "4", "5"]);
      expect(capsOf("Left/Right")).toEqual(["Left", "Right"]);
      expect(specText("Arrows")).toBe("the arrow keys");
      expect(specText("Left/Right")).toBe("← / →");
      expect(specText("1-5")).toBe("1-5");
   });
});

describe("deriveTouch", () => {
   it("captions the joystick with the move key and the buttons with their key's action", () => {
      const src = source("WASD / arrows to steer, hold Space to ride", {
         controls: { scheme: "joystick", keyboard: "", touch: "Joystick to steer, hold Ride to ride" },
         touchControls: ["joystick", "jump"],
         touchLabels: { jump: "Ride" },
      });
      const touch = deriveTouch(src, parseKeyboard(src.controls.keyboard));
      expect(touch).toEqual([
         { id: "joystick", control: "joystick", label: "Steer" },
         { id: "jump", control: "jump", label: "Ride", hold: true },
      ]);
   });

   it("finds gestures in the touch line when touchControls has none (swipes, pull back)", () => {
      const run = deriveTouch(source("", { controls: { scheme: "runner", keyboard: "", touch: "Swipe to switch lanes, jump and slide" }, touchControls: [] }), []);
      expect(run.map((t) => t.control)).toEqual(["swipe"]);
      const golf = deriveTouch(source("", { controls: { scheme: "aim-drag", keyboard: "", touch: "Pull back from anywhere, release to putt" }, touchControls: [] }), []);
      expect(golf).toEqual([{ id: "drag", control: "drag", label: "Pull back from anywhere, release to putt" }]);
   });

   it("uses the touch line's 'Action to drop' when no key names the button", () => {
      const touch = deriveTouch(
         source("", { controls: { scheme: "joystick", keyboard: "", touch: "Joystick, Action to drop, tap a pile" }, touchControls: ["joystick", "action", "tap"] }),
         []
      );
      expect(touch.find((t) => t.control === "action")?.label).toBe("Drop");
      expect(touch.find((t) => t.control === "tap")?.label).toBe("Tap a pile");
   });
});

describe("resolveHowTo: every game works on day one", () => {
   for (const meta of ARCADE_GAMES) {
      it(`${meta.slug}: keys, touch and 3-5 steps whose highlights all exist`, () => {
         const howTo = resolveHowTo({
            controls: meta.controls,
            howTo: meta.howTo,
            touchControls: [],
            instructions: ["Do the thing.", "Win by doing it fast."],
            description: meta.description,
            levels: !!meta.levels,
         });
         expect(howTo.keys.length).toBeGreaterThan(1);
         expect(howTo.keys.filter((key) => key.id === PAUSE_ID)).toHaveLength(1);
         expect(howTo.touch.length).toBeGreaterThan(0);
         expect(howTo.steps.length).toBeGreaterThanOrEqual(3);
         expect(howTo.steps.length).toBeLessThanOrEqual(5);
         const keyIds = new Set(howTo.keys.map((key) => key.id));
         const touchIds = new Set([...howTo.touch.map((t) => t.id), PAUSE_ID]);
         expect(keyIds.size).toBe(howTo.keys.length);
         for (const step of howTo.steps) {
            expect(step.title.trim()).not.toBe("");
            expect(step.text.trim()).not.toBe("");
            for (const id of step.keys ?? []) expect(keyIds, `${meta.slug} step "${step.title}" key ${id}`).toContain(id);
            for (const id of step.touch ?? []) expect(touchIds, `${meta.slug} step "${step.title}" touch ${id}`).toContain(id);
         }
         for (const key of howTo.keys) {
            expect(key.keys.length).toBeGreaterThan(0);
            expect(key.label.trim()).not.toBe("");
            expect(key.label.split(/\s+/).length).toBeLessThanOrEqual(4);
         }
      });
   }

   it("every Menu 1 game carries its own howTo (the derivation is the fallback for new games and Menu 2)", () => {
      expect(ARCADE_GAMES.filter((meta) => !meta.howTo).map((meta) => meta.slug)).toEqual([]);
   });

   it("every explicit howTo uses real control kinds and ends on the pause tip", () => {
      for (const meta of ARCADE_GAMES) {
         for (const t of meta.howTo?.touch ?? []) expect(["joystick", "jump", "action", "tap", "swipe", "drag"]).toContain(t.control);
         expect(meta.howTo?.steps.at(-1)?.keys, meta.slug).toEqual([PAUSE_ID]);
      }
   });

   it("derives goal, move, main action, win and tips from the text when there is no howTo", () => {
      const howTo = resolveHowTo({
         controls: { scheme: "joystick", keyboard: "WASD / arrows to steer, hold Space to ride", touch: "Joystick to steer, hold Ride to ride" },
         touchControls: ["joystick", "jump"],
         touchLabels: { jump: "Ride" },
         instructions: [
            "Steer the runaway cart through aisles to grab all 6 items on your list.",
            "Hold Ride (Space or Ride button) to drift faster; dodge shoppers, spills & pyramids.",
            "Collect all 6 items and dash to checkout before 75 s runs out!",
         ],
         levels: true,
      });
      expect(howTo.steps.map((step) => step.title)).toEqual(["Goal", "Steer", "Ride", "Win", "Tips"]);
      expect(howTo.steps[1]).toMatchObject({ text: "Use WASD or the arrow keys to steer.", touchText: "Push the joystick to steer.", touch: ["joystick"] });
      // the button says it: "Hold Ride", not "Hold Ride to ride"
      expect(howTo.steps[2].touchText).toBe("Hold Ride.");
      expect(howTo.steps[4]).toMatchObject({ keys: [PAUSE_ID], touch: [PAUSE_ID] });
      expect(howTo.steps[4].text).toContain("unlock");
   });

   it("takes the description as the goal when the first instruction is about the keys", () => {
      const howTo = resolveHowTo({
         ...source("WASD / arrows drive"),
         instructions: ["WASD or the stick drives. There is no button.", "Stop inside the gold pad."],
         description: "Drive a cab on a small street grid.",
      });
      expect(howTo.steps[0]).toEqual({ title: "Goal", text: "Drive a cab on a small street grid." });
   });
});

describe("start card controls", () => {
   const leaderboard = { enabled: false, data: null, loading: false, error: null, retry: () => {} } as unknown as LeaderboardState;
   const definition = { instructions: ["Grab the list."], touchControls: ["joystick", "jump"], touchLabels: { jump: "Ride" } } as unknown as GameDefinition;
   const render = (coarse: boolean, meta: ArcadeGameMeta = shoppingCartMeta) =>
      renderToStaticMarkup(createElement(StartCard, { meta, definition, coarse, exitHref: "/3d", leaderboard, onPlay: () => {} }));

   it("shows the keycaps on a desktop and the phone on a touch device, with the switch and the wizard button", () => {
      expect(defaultMode(false)).toBe("keyboard");
      expect(defaultMode(true)).toBe("touch");
      const desk = render(false);
      expect(desk).toContain('aria-label="Keyboard controls"');
      expect(desk).not.toContain('aria-label="Touch controls on a phone"');
      expect(desk).toMatch(/aria-pressed="true"[^>]*aria-label="Keyboard"/);
      expect(desk).toContain(">How to play<");
      const phone = render(true);
      expect(phone).toContain('aria-label="Touch controls on a phone"');
      expect(phone).toContain(">Ride<");
      expect(phone).toMatch(/aria-pressed="true"[^>]*aria-label="Touch"/);
   });

   it("labels every keycap for screen readers and never renders the wizard closed", () => {
      const html = render(false);
      expect(html).toContain('role="img" aria-label="Space"');
      expect(html).toContain('aria-label="Escape"');
      expect(html).not.toContain('role="dialog" aria-modal="true" aria-labelledby="howto-title"');
   });
});
