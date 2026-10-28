// The start card's "How to play" data (core/README.md "How to play"). Pure, no React.
// - resolveHowTo(source) is what the card draws: the game's own `meta.howTo` when it has one,
//   otherwise one derived from the text every game already has (meta.controls.keyboard / touch,
//   the definition's touchControls / touchLabels and its instructions), so every game gets the
//   keyboard and phone illustrations and a 3-5 step wizard without a change to its folder.
// - The shell always owns Esc / P (pause): resolveHowTo adds that key and the HUD's Pause button.
// - Menu 2 adopts it by building a HowToSource from its own meta and definition.
import type { ControlScheme, HowTo, HowToKey, HowToStep, HowToTouch } from "../../types";
import type { TouchControl } from "../types";

export type { HowTo, HowToKey, HowToStep, HowToTouch } from "../../types";

/** Everything the derivation reads: plain data from meta and the definition. */
export interface HowToSource {
   controls: { scheme: ControlScheme; keyboard: string; touch: string };
   howTo?: HowTo;
   touchControls?: readonly TouchControl[];
   touchLabels?: { jump?: string; action?: string };
   /** the start card's instruction lines (the picked level's, if it has its own) */
   instructions: readonly string[];
   /** meta.description: the Goal step when the first instruction is about the keys */
   description?: string;
   /** five levels: the tips step mentions unlocking */
   levels?: boolean;
}

export const PAUSE_ID = "pause";

const PAUSE_KEY: HowToKey = { id: PAUSE_ID, keys: ["Esc", "P"], label: "Pause", role: "pause" };

// ---------- cap specs ----------

const DIRECTIONS = ["Up", "Left", "Down", "Right"] as const;
const MOVE_LETTERS = new Set(["W", "A", "S", "D"]);
const NAMED: Record<string, string> = {
   space: "Space",
   spacebar: "Space",
   enter: "Enter",
   esc: "Esc",
   escape: "Esc",
   shift: "Shift",
   tab: "Tab",
};

/** One cap spec split into the caps it draws: "A/D" -> ["A", "D"], "1-3" -> ["1", "2", "3"]. */
export function capsOf(spec: string): string[] {
   if (spec === "WASD") return ["W", "A", "S", "D"];
   if (spec === "Arrows") return ["Up", "Left", "Down", "Right"];
   const range = /^([0-9])\s*[-–]\s*([0-9])$/.exec(spec);
   if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      const caps: string[] = [];
      for (let n = from; n <= to && caps.length < 9; n++) caps.push(String(n));
      return caps;
   }
   return spec.split("/").map((cap) => cap.trim()).filter(Boolean);
}

/** true when every cap of `spec` moves (WASD letters or arrows). */
const isMoveSpec = (spec: string): boolean =>
   capsOf(spec).every((cap) => MOVE_LETTERS.has(cap) || (DIRECTIONS as readonly string[]).includes(cap));

/** The role of a key hint: its own, else from its keys. */
export function keyRole(key: HowToKey): NonNullable<HowToKey["role"]> {
   if (key.role) return key.role;
   if (key.keys.length > 0 && key.keys.every(isMoveSpec)) return "move";
   if (key.keys.length > 0 && key.keys.every((spec) => spec === "Mouse")) return "pointer";
   return "action";
}

/** How a cap spec reads in a sentence: "WASD", "the arrow keys", "A / D", "← / →". */
export function specText(spec: string): string {
   if (spec === "Arrows") return "the arrow keys";
   if (spec === "WASD") return "WASD";
   if (spec === "Mouse") return "the mouse";
   const arrows: Record<string, string> = { Up: "↑", Down: "↓", Left: "←", Right: "→" };
   return capsOf(spec)
      .map((cap) => arrows[cap] ?? cap)
      .join(spec.includes("-") && /^[0-9]/.test(spec) ? "-" : " / ")
      .replace(/^(\d)-.*-(\d)$/, "$1-$2");
}

/** "WASD or the arrow keys" */
export const keysText = (key: HowToKey): string => key.keys.map(specText).join(" or ");

// ---------- parsing a controls line ----------

interface Word {
   text: string;
   /** a cap spec when this word names a key */
   spec?: string;
   /** "click" / "drag": a mouse word that reads as the caption's verb ("click a part") */
   verb?: string;
}

const STOP = new Set(["to", "hold", "press", "tap", "or", "and", "the", "a", "an", "keys", "key", "/", "+", "then", "with", "in", "at", "on"]);
/** a caption ends before these ("Harvest at peak glow" -> "Harvest") */
const PREPOSITIONS = new Set(["at", "in", "per", "into", "from", "of", "after", "while", "on", "with", "when", "until", "for"]);
const KEYISH = /^(?:[A-Z]|(?:wasd|arrows?|left|right|up|down|space|enter|esc))$/i;

const bare = (word: string | undefined) => (word ?? "").replace(/^[("']+|[)"':,]+$/g, "");

function classify(words: string[]): Word[] {
   const out: Word[] = [];
   for (let i = 0; i < words.length; i++) {
      const raw = words[i];
      const word = raw.replace(/^[("']+|[)"':,]+$/g, "");
      const prev = words[i - 1];
      const next = words[i + 1];
      const nextBare = next?.replace(/[):,]+$/, "");
      let spec: string | undefined;
      if (/^wasd$/i.test(word)) spec = "WASD";
      else if (/^arrows?$/i.test(word)) spec = "Arrows";
      else if (
         /^(left|right|up|down)$/i.test(word) &&
         ((prev === "/" && KEYISH.test(bare(words[i - 2]))) ||
            (next === "/" && KEYISH.test(bare(words[i + 2]))) ||
            /^arrows?$/i.test(nextBare ?? "") ||
            // "Space, W or Up to jump": a capitalised direction after "or" is the arrow key
            (/^[A-Z]/.test(word) && prev === "or"))
      ) {
         spec = word[0].toUpperCase() + word.slice(1).toLowerCase();
      } else if (/^[A-Z]$/.test(word) && word !== "I") spec = word;
      else if (/^(Space|Spacebar|Enter|Esc|Escape|Shift|Tab)$/.test(word)) spec = NAMED[word.toLowerCase()];
      else if (/^[0-9]([-–][0-9])?$/.test(word) && (prev === undefined || /^(\/|keys?|press|or|and)$/i.test(prev) || !!out[i - 1]?.spec)) {
         spec = word.replace("–", "-");
      }
      else if (/^(mouse|click|drag)$/i.test(word)) spec = "Mouse";
      out.push({ text: word, spec, verb: /^(click|drag)$/i.test(word) ? word.toLowerCase() : undefined });
   }
   return out;
}

/** The key alternatives a clause names: "A / D or left / right" -> ["A/D", "Left/Right"]. */
function alternativesOf(words: Word[]): string[] {
   const alts: string[] = [];
   let group: string[] = [];
   let family = "";
   const familyOf = (spec: string) =>
      /^[A-Z]$/.test(spec) ? "letter" : /^[0-9]$/.test(spec) ? "digit" : (DIRECTIONS as readonly string[]).includes(spec) ? "dir" : "other";
   const flush = () => {
      if (group.length > 0) alts.push(group.join("/"));
      group = [];
      family = "";
   };
   let joined = false;
   for (const word of words) {
      if (word.text === "/" || word.text === "") {
         joined = true;
         continue;
      }
      if (!word.spec) {
         if (group.length > 0 && word.text !== "") flush();
         joined = false;
         continue;
      }
      const fam = familyOf(word.spec);
      // "A / D", "A D", "1 / 2", "left / right": one group; "WASD / arrows", "W / Up": alternatives
      const sameGroup = group.length > 0 && fam === family && fam !== "other";
      if (!sameGroup || (!joined && fam !== "letter")) flush();
      group.push(word.spec);
      family = fam;
      joined = false;
   }
   flush();
   // "left / right arrows": the directions already say it
   const hasDirections = alts.some((alt) => alt.split("/").every((cap) => (DIRECTIONS as readonly string[]).includes(cap)));
   const unique = Array.from(new Set(alts.filter((alt) => !(hasDirections && alt === "Arrows"))));
   return unique.map((alt) => (alt === "W/A/S/D" ? "WASD" : alt === "Up/Left/Down/Right" ? "Arrows" : alt));
}

const capitalise = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);

/** "Flashes" -> "Flash", "Drives" -> "Drive": a caption reads as a command. */
const baseVerb = (word: string): string =>
   /(sh|ch|ss|x)es$/i.test(word) ? word.slice(0, -2) : /[^s]s$/i.test(word) && word.length > 3 ? word.slice(0, -1) : word;

/** Trims a caption to its head: no leading stop words, nothing from a preposition on, four words at most. */
export function shortLabel(words: string[], command = false): string {
   let picked = words.map((word) => (word === "/" ? "or" : word)).filter(Boolean);
   while (picked.length > 0 && STOP.has(picked[0].toLowerCase())) picked = picked.slice(1);
   const cut = picked.findIndex((word, index) => index > 0 && PREPOSITIONS.has(word.toLowerCase()));
   if (cut > 0) picked = picked.slice(0, cut);
   picked = picked.slice(0, 4);
   while (picked.length > 1 && STOP.has(picked[picked.length - 1].toLowerCase())) picked = picked.slice(0, -1);
   if (command) picked = picked.map((word, index) => (index === 0 || /^(and|or)$/i.test(picked[index - 1]) ? baseVerb(word) : word));
   return capitalise(picked.join(" "));
}

/** The words after the keys, as a short caption: "to steer" -> "Steer", "rotate" -> "Rotate". */
function labelOf(words: Word[]): string {
   let lastKey = -1;
   words.forEach((word, index) => {
      if (word.spec) lastKey = index;
   });
   const after = words.slice(lastKey + 1).map((word) => word.text).filter(Boolean);
   const to = after.indexOf("to");
   if (to >= 0) return shortLabel(after.slice(to + 1));
   // "in the repair arc": no verb of its own (resolveHowTo falls back to the touch button's text)
   if (after[0] && PREPOSITIONS.has(after[0].toLowerCase())) return "";
   const label = shortLabel(after, true);
   // "click a part": the mouse word is the verb
   const verb = words[lastKey]?.verb;
   if (verb && label) return capitalise(`${verb} ${after.slice(0, 3).join(" ")}`);
   return label;
}

interface Clause {
   alts: string[];
   label: string;
   hold: boolean;
   text: string;
}

/** Splits a controls line into clauses (";", ".", ","), dropping symbols such as a camera emoji. */
function clausesOf(text: string): string[] {
   return text
      .replace(/\([^)]*\)/g, " ")
      // "WASD / arrows: left, right, up and down": the directions after the colon are no caption
      .replace(/:\s*(left|right|up|down)\b[^;.]*/gi, "")
      .replace(/[^\x20-\x7E–]/g, " ")
      .split(/[;.]|,\s|\s\+\s/)
      .map((part) => part.trim())
      .filter(Boolean);
}

function parseClause(text: string): Clause {
   const words = classify(text.replace(/\//g, " / ").split(/\s+/).filter(Boolean));
   return { alts: alternativesOf(words), label: labelOf(words), hold: /\bhold\b/i.test(text), text };
}

/**
 * The keys a `controls.keyboard` line names, with their captions. "WASD / arrows to steer, hold
 * Space to ride" -> [{ keys: ["WASD", "Arrows"], label: "Steer" }, { keys: ["Space"], label: "Ride", hold }].
 * A clause with keys but no words of its own ("Space, E or Enter to drop") lends its keys to the next.
 */
export function parseKeyboard(text: string): HowToKey[] {
   const clauses = clausesOf(text).map(parseClause);
   const merged: Clause[] = [];
   for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      if (clause.alts.length === 0) continue;
      const next = clauses[i + 1];
      if (!clause.label && next) {
         // only keys of the same kind join ("Space, E or Enter to drop"; never "WASD" into "C changes the view")
         if (next.alts.length > 0 && !(clause.alts.every(isMoveSpec) && !next.alts.every(isMoveSpec))) {
            next.alts = Array.from(new Set([...clause.alts, ...next.alts]));
            next.hold = next.hold || clause.hold;
            continue;
         }
         // "WASD / arrows: left, right, up and down" lends no caption (the default "Move" reads better)
         if (next.alts.length === 0) {
            if (!/^(left|right|up|down)\b/i.test(next.text)) clause.label = shortLabel(next.text.split(/\s+/), true);
            i++;
         }
      }
      merged.push(clause);
   }
   const keys: HowToKey[] = [];
   for (const clause of merged) {
      const key: HowToKey = { id: "", keys: clause.alts, label: clause.label, hold: clause.hold || undefined };
      const role = keyRole(key);
      if (role === "pause") continue;
      if (!key.label) key.label = role === "move" ? "Move" : role === "pointer" ? "Aim" : "Action";
      // the same keys twice ("arrows aim", later "arrows + Space"): keep the first caption
      if (keys.some((other) => other.keys.join() === key.keys.join())) continue;
      key.id = `key-${keys.length + 1}`;
      keys.push(key);
   }
   const firstMove = keys.find((key) => keyRole(key) === "move");
   const firstAction = keys.find((key) => keyRole(key) === "action");
   if (firstMove) firstMove.main = true;
   if (firstAction) firstAction.main = true;
   if (!firstMove && keys[0]) keys[0].main = true;
   return keys;
}

// ---------- touch ----------

/** The touch line's clause mentioning `pattern`, as a short sentence-case caption. */
function touchClause(text: string, pattern: RegExp): string | undefined {
   const clauses = clausesOf(text);
   const index = clauses.findIndex((clause) => pattern.test(clause));
   if (index < 0) return undefined;
   let caption = clauses[index];
   // "Pull back from anywhere" + "release to putt"
   if (!/\bto\b/.test(caption) && clauses[index + 1] && !/joystick|tap|swipe/i.test(clauses[index + 1])) {
      caption = `${caption}, ${clauses[index + 1]}`;
   }
   const words = caption.split(/\s+/);
   return capitalise(words.slice(0, 7).join(" ") + (words.length > 7 ? "…" : ""));
}

/** The touch buttons' texts (as TouchControls draws them). */
export function buttonTexts(labels?: HowToSource["touchLabels"]): { jump: string; action: string } {
   const pick = (value: string | undefined, fallback: string) => (value && value.trim() ? value.trim() : fallback);
   return { jump: pick(labels?.jump, "Jump"), action: pick(labels?.action, "Action") };
}

/** The keyboard hint a touch button stands for: Jump = Space, Action = E / Enter. */
function keyForButton(keys: HowToKey[], button: "jump" | "action"): HowToKey | undefined {
   const wanted = button === "jump" ? ["Space"] : ["E", "Enter"];
   return keys.find((key) => keyRole(key) === "action" && key.keys.some((spec) => capsOf(spec).some((cap) => wanted.includes(cap))));
}


export function deriveTouch(source: HowToSource, keys: HowToKey[]): HowToTouch[] {
   const text = source.controls.touch;
   const texts = buttonTexts(source.touchLabels);
   const move = keys.find((key) => keyRole(key) === "move");
   const touch: HowToTouch[] = [];
   const controls = source.touchControls ?? [];
   if (controls.includes("joystick")) {
      const fromTouch = /joystick\s+to\s+(\w+)/i.exec(text)?.[1];
      touch.push({ id: "joystick", control: "joystick", label: move?.label ?? capitalise(fromTouch ?? "Move") });
   }
   for (const button of ["action", "jump"] as const) {
      if (!controls.includes(button)) continue;
      const key = keyForButton(keys, button);
      const escaped = escapeRegExp(texts[button]);
      const hold = key?.hold || new RegExp(`hold\\s+${escaped}`, "i").test(text) || undefined;
      // "Action to drop": the touch line names what the button does
      const said = new RegExp(`${escaped}\\s+to\\s+(\\w+(?:\\s\\w+)?)`, "i").exec(text)?.[1];
      touch.push({ id: button, control: button, label: key?.label ?? (said ? shortLabel(said.split(" ")) : texts[button]), hold });
   }
   // a game without on-screen gestures in touchControls (swipes and taps are read from the canvas anyway)
   const none = !controls.some((control) => control === "tap" || control === "swipe");
   const swipe = controls.includes("swipe") || (none && /\bswipe/i.test(text));
   if (controls.includes("tap")) touch.push({ id: "tap", control: "tap", label: touchClause(text, /\btap/i) ?? "Tap to play" });
   if (swipe) touch.push({ id: "swipe", control: "swipe", label: touchClause(text, /\bswipe/i) ?? "Swipe to move" });
   if (!controls.includes("joystick") && !swipe && /\b(drag|pull back)\b/i.test(text)) {
      touch.push({ id: "drag", control: "drag", label: touchClause(text, /\b(drag|pull back)\b/i) ?? "Drag" });
   }
   if (touch.length === 0) touch.push({ id: "tap", control: "tap", label: touchClause(text, /./) ?? "Tap to play" });
   return touch;
}

// ---------- steps ----------

const WIN_WORDS = /\b(win|clear|before|collect|finish|reach|score|deliver|sink|bring|survive|points?|land)\b/i;
/** an instruction line that is about the controls, not the goal */
const CONTROL_WORDS = /\b(WASD|arrows?|Space|Enter|press|stick|joystick|swipe|click|keys?)\b|\b[A-Z] ?\/ ?[A-Z]\b/;

function escapeRegExp(text: string): string {
   return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const lower = (text: string) => (text ? text[0].toLowerCase() + text.slice(1) : text);
const sentence = (text: string) => (/[.!?…]$/.test(text) ? text : `${text}.`);

/** The instruction line about `words` (a caption or a key), if any. */
function lineAbout(lines: readonly string[], used: Set<string>, words: string[]): string | undefined {
   return lines.find(
      (line) => !used.has(line) && words.some((word) => word.length > 1 && new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(line))
   );
}

/** "Tap Ride to ride", "Hold Dig", "Swipe to strike" */
function touchSentence(t: HowToTouch, labels: HowToSource["touchLabels"]): string {
   if (t.control !== "jump" && t.control !== "action") return t.label;
   const text = buttonTexts(labels)[t.control];
   const verb = t.hold ? "Hold" : "Tap";
   return t.label.toLowerCase() === text.toLowerCase() ? `${verb} ${text}` : `${verb} ${text} to ${lower(t.label)}`;
}

export function deriveSteps(source: HowToSource, keys: HowToKey[], touch: HowToTouch[]): HowToStep[] {
   const lines = source.instructions.filter((line) => line.trim());
   const used = new Set<string>();
   const steps: HowToStep[] = [];
   // the goal: the first instruction, unless it is about the keys (then the game's description)
   const first = lines[0];
   const goal = first && (!CONTROL_WORDS.test(first) || !source.description) ? first : source.description;
   if (goal) {
      if (goal === first) used.add(first);
      steps.push({ title: "Goal", text: goal });
   }

   const move = keys.find((key) => keyRole(key) === "move");
   const stick = touch.find((t) => t.control === "joystick");
   const gestures = touch.filter((t) => t.control === "swipe" || t.control === "drag" || t.control === "tap");
   // the gesture that moves: the one that shares a word with the move caption, else a swipe or a drag
   const moveWords = (move?.label ?? "").toLowerCase().split(/\s+/);
   const moveGesture = stick
      ? undefined
      : gestures.find((t) => moveWords.some((word) => word.length > 2 && t.label.toLowerCase().includes(word))) ??
        gestures.find((t) => t.control !== "tap") ??
        gestures[0];
   if (move) {
      const pad = stick ?? moveGesture;
      steps.push({
         title: move.label,
         text: `Use ${keysText(move)} to ${lower(move.label)}.`,
         touchText: stick ? `Push the joystick to ${lower(stick.label)}.` : moveGesture ? sentence(moveGesture.label) : undefined,
         keys: [move.id],
         touch: pad ? [pad.id] : [],
      });
   }

   const byRole = (role: string) => keys.filter((key) => keyRole(key) === role);
   const candidates = byRole("action").length > 0 ? byRole("action") : byRole("pointer");
   const actions = candidates.filter((key, index) => candidates.findIndex((other) => other.label === key.label) === index).slice(0, 2);
   if (actions.length > 0) {
      const titles = actions.map((key) => key.label);
      const lit = touch.filter((t) => t !== stick && t !== moveGesture);
      const line = lineAbout(lines, used, [...titles, ...actions.flatMap((key) => key.keys.flatMap(capsOf))]);
      if (line) used.add(line);
      const press = actions.map((key) => `${key.hold ? "Hold" : "Press"} ${keysText(key)} to ${lower(key.label)}`).join(". ");
      const tapText = lit.map((t) => touchSentence(t, source.touchLabels)).join(". ");
      steps.push({
         title: titles.join(" & "),
         text: line ?? sentence(press),
         touchText: tapText ? sentence(tapText) : undefined,
         keys: actions.map((key) => key.id),
         touch: lit.map((t) => t.id),
      });
   } else if (!move && gestures[0]) {
      steps.push({ title: "Play", text: sentence(source.controls.keyboard), touchText: sentence(gestures[0].label), touch: [gestures[0].id] });
   }

   const rest = lines.filter((line) => !used.has(line));
   if (rest.length > 0) {
      const text = rest[0].length > 90 ? rest[0] : rest.slice(0, 2).join(" ");
      steps.push({ title: WIN_WORDS.test(text) ? "Win" : "Watch out", text });
   }

   const unlock = source.levels ? " Clear a level to unlock the next one." : "";
   steps.push({
      title: "Tips",
      text: `Esc or P pauses the run any time.${unlock}`,
      touchText: `Tap Pause, top right, any time.${unlock}`,
      keys: [PAUSE_ID],
      touch: [PAUSE_ID],
   });
   return steps.slice(0, 5);
}

/** The keyboard hints, touch hints and steps the start card draws for this game. */
export function resolveHowTo(source: HowToSource): HowTo {
   const own = source.howTo;
   const keys = own ? own.keys.map((key) => ({ ...key })) : parseKeyboard(source.controls.keyboard);
   if (!own) {
      // "E or Enter" with no words of its own: the touch button's text ("Use", "Repair") says it
      for (const button of ["action", "jump"] as const) {
         const key = keyForButton(keys, button);
         if (key && key.label === "Action" && (source.touchControls ?? []).includes(button)) key.label = buttonTexts(source.touchLabels)[button];
      }
   }
   if (!keys.some((key) => key.id === PAUSE_ID || keyRole(key) === "pause")) keys.push({ ...PAUSE_KEY });
   const touch = own ? own.touch.map((t) => ({ ...t })) : deriveTouch(source, keys);
   const steps = own ? own.steps : deriveSteps(source, keys, touch);
   return { keys, touch, steps };
}
