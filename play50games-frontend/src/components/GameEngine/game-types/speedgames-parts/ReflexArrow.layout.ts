// Pure layout numbers for Reflex Arrow (no React): how big the prompt circle and the direction pad are
// drawn, from the live viewport. The rules are untouched (arrow interval, required answers, the 5-wrong
// limit, timing): only the sizes and whether the prompt sits above or beside the pad change.

export interface ReflexViewport {
   width: number;
   height: number;
   /** phones (< 640 px wide) */
   isMobile: boolean;
   /** tablets (640-1023 px wide) */
   isTablet: boolean;
   /** a short viewport (< 560 px tall): landscape phone */
   isShort: boolean;
}

export interface ReflexLayout {
   /** "stack": prompt above the pad (the classic look); "row": prompt beside the pad when the height is short */
   arrangement: "stack" | "row";
   /** the square direction pad's side in px (3 cells + 2 gaps) */
   padSize: number;
   /** one direction button's side in px */
   cell: number;
   /** the grid gap inside the pad */
   gap: number;
   /** the prompt circle's diameter in px */
   promptSize: number;
   /** the arrow icon inside the prompt */
   promptIcon: number;
   /** the arrow icon inside a direction button */
   cellIcon: number;
   /** the gap between the prompt and the pad */
   stageGap: number;
}

/** Direction buttons: at least 64 px on phones and tablets (fingers), 56 px with a mouse; never under 44. */
export const REFLEX_MIN_CELL_TOUCH = 64;
export const REFLEX_MIN_CELL_DESKTOP = 56;

/** The classic pad sizes (phone 280, tablet 320, desktop 360) stay the maximum. */
export const REFLEX_MAX_PAD = { mobile: 280, tablet: 320, desktop: 360 } as const;
/** The classic prompt circle (phone 120, else 160) stays the maximum. */
export const REFLEX_MAX_PROMPT = { mobile: 120, tablet: 160, desktop: 160 } as const;
export const REFLEX_MIN_PROMPT = { mobile: 84, tablet: 96, desktop: 96 } as const;
export const REFLEX_PAD_GAP = { mobile: 10, tablet: 12, desktop: 14 } as const;

/**
 * Everything on the screen that is not the prompt + pad, in px, once the run has scrolled the engine's
 * score bar to the top: the engine bar (~102 on phones, where its stats wrap; ~70 wider), the game's
 * header card, the stats chips, the gaps and card paddings, the Replay / Share row and the bottom room
 * kept for the cookie banner (~190 px on phones, ~110 elsewhere).
 */
export const REFLEX_CHROME = { mobile: 520, tablet: 504, desktop: 532 } as const;
/** The compact short-viewport layout: one header line with the chips, no stats row, no description. */
export const REFLEX_CHROME_SHORT = 444;

/** The horizontal room inside the board card (root padding + card padding on both sides). */
export const REFLEX_SIDE_CHROME = { mobile: 48, tablet: 72, desktop: 96 } as const;
/** The board card's max width (the classic 800 px). */
export const REFLEX_MAX_BOARD = 800;

type Tier = "mobile" | "tablet" | "desktop";

function tierOf(vp: ReflexViewport): Tier {
   if (vp.isMobile) return "mobile";
   if (vp.isTablet) return "tablet";
   return "desktop";
}

function clamp(value: number, min: number, max: number): number {
   return Math.max(min, Math.min(max, value));
}

/**
 * The prompt + pad sizes for a viewport. The pad has priority (it is what the player hits); the prompt takes
 * what is left, both clamped to [min, classic max]. When the two stacked at their minimums would not end
 * above the cookie banner, the prompt moves beside the pad ("row"), which needs only the pad's height.
 */
export function reflexLayout(vp: ReflexViewport): ReflexLayout {
   const tier = tierOf(vp);
   const gap = REFLEX_PAD_GAP[tier];
   const minCell = tier === "desktop" ? REFLEX_MIN_CELL_DESKTOP : REFLEX_MIN_CELL_TOUCH;
   const padMin = minCell * 3 + gap * 2;
   const padMax = Math.max(padMin, REFLEX_MAX_PAD[tier]);
   const promptMin = REFLEX_MIN_PROMPT[tier];
   const promptMax = REFLEX_MAX_PROMPT[tier];
   const stageGap = tier === "mobile" ? 10 : 16;

   const chrome = vp.isShort ? REFLEX_CHROME_SHORT : REFLEX_CHROME[tier];
   const budget = Math.max(0, vp.height - chrome);
   const innerWidth = Math.min(REFLEX_MAX_BOARD, vp.width) - REFLEX_SIDE_CHROME[tier];

   let arrangement: "stack" | "row" = "stack";
   let padSize: number;
   let promptSize: number;
   if (budget >= promptMin + stageGap + padMin) {
      padSize = clamp(budget - promptMin - stageGap, padMin, padMax);
      promptSize = clamp(budget - padSize - stageGap, promptMin, promptMax);
   } else {
      // too short to stack: the prompt goes beside the pad, both bounded by the card's inner width
      arrangement = "row";
      padSize = clamp(Math.min(budget, innerWidth - promptMin - stageGap), padMin, padMax);
      // on a very narrow phone the prompt may go under its minimum (never under 56) so the row still fits
      const rowPromptMin = Math.min(promptMin, Math.max(56, innerWidth - padSize - stageGap));
      promptSize = clamp(Math.min(padSize, innerWidth - padSize - stageGap), rowPromptMin, promptMax);
   }

   // whole-pixel cells: the pad is exactly 3 cells + 2 gaps
   const cell = Math.floor((padSize - gap * 2) / 3);
   padSize = cell * 3 + gap * 2;
   promptSize = Math.round(promptSize);

   return {
      arrangement,
      padSize,
      cell,
      gap,
      promptSize,
      promptIcon: Math.round(promptSize * 0.56),
      cellIcon: clamp(Math.round(cell * 0.5), 28, 44),
      stageGap,
   };
}
