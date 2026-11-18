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
/**
 * The row arrangement on a phone (prompt beside the pad) may shrink the cells to 56 px with an 8 px gap and
 * the prompt to 56 px, so the pair still fits a 360 px screen's card; all still well over the 44 px minimum.
 */
export const REFLEX_MIN_CELL_ROW_PHONE = 56;
export const REFLEX_ROW_GAP_PHONE = 8;
export const REFLEX_MIN_PROMPT_ROW_PHONE = 56;

/** The classic pad sizes (phone 280, tablet 320, desktop 360) stay the maximum. */
export const REFLEX_MAX_PAD = { mobile: 280, tablet: 320, desktop: 360 } as const;
/** The classic prompt circle (phone 120, else 160) stays the maximum. */
export const REFLEX_MAX_PROMPT = { mobile: 120, tablet: 160, desktop: 160 } as const;
export const REFLEX_MIN_PROMPT = { mobile: 84, tablet: 96, desktop: 96 } as const;
export const REFLEX_PAD_GAP = { mobile: 10, tablet: 12, desktop: 14 } as const;

/**
 * Everything on the screen that is not the prompt + pad, in px, once the run has scrolled the engine's
 * score bar to the top: the engine bar (146 on phones, where its stats wrap; 69 wider), the game's header
 * card, the stats chips, the gaps and card paddings, the Replay / Share row and the cookie banner
 * (162 px on a 390 px phone, 79-83 px wider). Measured in the real page at 390x844, 820x1180, 1180x820.
 */
export const REFLEX_CHROME = { mobile: 520, tablet: 504, desktop: 532 } as const;
/** The compact short-viewport layout: one header line with the chips, no stats row, no description. */
export const REFLEX_CHROME_SHORT = 444;
/** Under 375 px the cookie banner's text wraps to one more line (183 px instead of 162). */
export const REFLEX_NARROW_WIDTH = 375;
export const REFLEX_NARROW_EXTRA = 21;

/** The engine's own side room around the game (its padding, the same on every width; measured 51 px). */
export const REFLEX_ENGINE_SIDE = 51;
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

/** The room inside the board card for a viewport (what a row of prompt + pad must fit). */
export function reflexInnerWidth(vp: ReflexViewport): number {
   return Math.min(REFLEX_MAX_BOARD, vp.width - REFLEX_ENGINE_SIDE) - REFLEX_SIDE_CHROME[tierOf(vp)];
}

/** The vertical room for the prompt + pad (the viewport minus everything else on the page). */
export function reflexBudget(vp: ReflexViewport): number {
   let chrome: number = vp.isShort ? REFLEX_CHROME_SHORT : REFLEX_CHROME[tierOf(vp)];
   if (vp.width < REFLEX_NARROW_WIDTH) chrome += REFLEX_NARROW_EXTRA;
   return Math.max(0, vp.height - chrome);
}

/**
 * The prompt + pad sizes for a viewport. The pad has priority (it is what the player hits); the prompt takes
 * what is left, both clamped to [min, classic max]. When the two stacked at their minimums would not end
 * above the cookie banner, the prompt moves beside the pad ("row"), which needs only the pad's height; on a
 * phone the row may use the smaller row minimums. When even that row would not fit the card's width (very
 * narrow phones), the classic stack at its minimums is kept and the page scrolls the rest.
 */
export function reflexLayout(vp: ReflexViewport): ReflexLayout {
   const tier = tierOf(vp);
   let gap: number = REFLEX_PAD_GAP[tier];
   const minCell = tier === "desktop" ? REFLEX_MIN_CELL_DESKTOP : REFLEX_MIN_CELL_TOUCH;
   const padMin = minCell * 3 + gap * 2;
   const padMax = Math.max(padMin, REFLEX_MAX_PAD[tier]);
   const promptMin = REFLEX_MIN_PROMPT[tier];
   const promptMax = REFLEX_MAX_PROMPT[tier];
   const stageGap = tier === "mobile" ? 10 : 16;

   const budget = reflexBudget(vp);
   const innerWidth = reflexInnerWidth(vp);

   let arrangement: "stack" | "row" = "stack";
   let padSize: number;
   let promptSize: number;
   if (budget >= promptMin + stageGap + padMin) {
      padSize = clamp(budget - promptMin - stageGap, padMin, padMax);
      promptSize = clamp(budget - padSize - stageGap, promptMin, promptMax);
   } else {
      const rowGap = tier === "mobile" ? REFLEX_ROW_GAP_PHONE : gap;
      const rowMinCell = tier === "mobile" ? REFLEX_MIN_CELL_ROW_PHONE : minCell;
      const rowPadMin = rowMinCell * 3 + rowGap * 2;
      const rowPromptMin = tier === "mobile" ? REFLEX_MIN_PROMPT_ROW_PHONE : promptMin;
      if (rowPadMin + stageGap + rowPromptMin <= innerWidth) {
         // too short to stack: the prompt goes beside the pad, both bounded by the card's inner width
         arrangement = "row";
         gap = rowGap;
         padSize = clamp(Math.min(budget, innerWidth - rowPromptMin - stageGap), rowPadMin, padMax);
         const rowCell = Math.floor((padSize - gap * 2) / 3);
         padSize = rowCell * 3 + gap * 2;
         promptSize = clamp(Math.min(padSize, innerWidth - padSize - stageGap), rowPromptMin, promptMax);
      } else {
         // too narrow for a row as well: the classic stack at its minimums, the page scrolls
         padSize = padMin;
         promptSize = promptMin;
      }
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
