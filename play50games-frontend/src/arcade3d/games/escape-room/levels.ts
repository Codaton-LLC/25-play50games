import type { LevelId } from "../../types";
import { DEFAULT_LEVEL, type EscapeLevel } from "./rules";
export type { EscapeLevel } from "./rules";

export const LEVELS: Record<LevelId, EscapeLevel> = {
   1: DEFAULT_LEVEL,
   2: { id: 2, items: 3, containers: 5, durationMs: 210000, ordered: false, shuffledOrder: false, returnSwitch: false },
   3: { id: 3, items: 4, containers: 6, durationMs: 240000, ordered: true, shuffledOrder: false, returnSwitch: false },
   4: { id: 4, items: 4, containers: 7, durationMs: 240000, ordered: true, shuffledOrder: true, returnSwitch: false },
   5: { id: 5, items: 5, containers: 8, durationMs: 300000, ordered: true, shuffledOrder: true, returnSwitch: true },
};
export const LEVEL_TITLES = ["Office", "Workshop", "Laboratory", "Cabin", "Mini Spaceship"] as const;
export const ITEM_LABELS = ["Key", "Book", "Battery", "Spare key", "Power cell"] as const;
