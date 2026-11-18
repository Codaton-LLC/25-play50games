// Floating score popups ("+200", "Checkpoint!") for Menu 2, drawn as glyph quads from one atlas in
// ONE instanced draw call (JuiceLayer.tsx), unlike core/fx's one sprite (one draw call) per popup.
// Pure: the slots, the layout of each text into glyph cells, and the rise / fade / pop look. No
// allocation after createPopupPool() (a popup's text is copied into a fixed glyph array).

/** The atlas covers printable ASCII (32 ' ' .. 126 '~'): 95 glyphs, 16 per row, 6 rows. */
export const GLYPH_FIRST = 32;
export const GLYPH_COUNT = 95;
export const ATLAS_COLS = 16;
export const ATLAS_ROWS = 6;
/** A glyph cell's width over its height. */
export const GLYPH_ASPECT = 0.62;

/** The longest text (more is cut). */
export const POPUP_MAX_CHARS = 16;
/** Popups alive at once; the oldest is reused beyond this. */
export const POPUP_SLOTS = 12;
/** Glyph quads in the instanced mesh: every slot's every character. */
export const POPUP_GLYPHS = POPUP_SLOTS * POPUP_MAX_CHARS;

/** How long a popup lives (s) and how far it rises (m). */
export const POPUP_LIFE = 0.9;
export const POPUP_RISE = 1.1;

export interface PopupSlot {
   active: boolean;
   x: number;
   y: number;
   z: number;
   age: number;
   /** glyph indices (0 .. GLYPH_COUNT - 1) and how many */
   readonly glyphs: Uint8Array;
   length: number;
   /** each glyph's centre along the line, in glyph heights from the text's centre */
   readonly offsets: Float32Array;
   /** colour 0..1 and size (on-screen height as a fraction of half the canvas height) */
   r: number;
   g: number;
   b: number;
   size: number;
   serial: number;
}

export interface PopupPool {
   readonly slots: PopupSlot[];
   serial: number;
}

export function createPopupPool(count = POPUP_SLOTS): PopupPool {
   const slots: PopupSlot[] = [];
   for (let i = 0; i < count; i++) {
      slots.push({
         active: false,
         x: 0,
         y: 0,
         z: 0,
         age: 0,
         glyphs: new Uint8Array(POPUP_MAX_CHARS),
         length: 0,
         offsets: new Float32Array(POPUP_MAX_CHARS),
         r: 1,
         g: 1,
         b: 1,
         size: 0.06,
         serial: 0,
      });
   }
   return { slots, serial: 0 };
}

/** A character's glyph index (anything outside printable ASCII draws as '?'). */
export function glyphIndex(code: number): number {
   if (code < GLYPH_FIRST || code >= GLYPH_FIRST + GLYPH_COUNT) return "?".charCodeAt(0) - GLYPH_FIRST;
   return code - GLYPH_FIRST;
}

/** A glyph's atlas cell: column and row (row 0 = the top row of the atlas). */
export function glyphCell(glyph: number, out: { col: number; row: number }): { col: number; row: number } {
   out.col = glyph % ATLAS_COLS;
   out.row = Math.floor(glyph / ATLAS_COLS);
   return out;
}

/**
 * Lays `text` out into the slot: glyph indices and each glyph's centre along the line (in glyph
 * heights), centred on 0. `advances` (per glyph, in glyph heights; measured from the atlas font) or a
 * monospace GLYPH_ASPECT.
 */
export function layoutPopup(slot: PopupSlot, text: string, advances?: ArrayLike<number>): void {
   const n = Math.min(POPUP_MAX_CHARS, text.length);
   let width = 0;
   for (let i = 0; i < n; i++) {
      const g = glyphIndex(text.charCodeAt(i));
      slot.glyphs[i] = g;
      const a = advances ? advances[g] : GLYPH_ASPECT;
      slot.offsets[i] = width + a / 2;
      width += a;
   }
   for (let i = 0; i < n; i++) slot.offsets[i] -= width / 2;
   slot.length = n;
}

/** Starts a popup in a free slot (or the oldest one). Returns the slot's index. */
export function emitPopup(
   pool: PopupPool,
   x: number,
   y: number,
   z: number,
   text: string,
   rgb: number,
   size: number,
   advances?: ArrayLike<number>
): number {
   let index = 0;
   let oldest = Infinity;
   for (let i = 0; i < pool.slots.length; i++) {
      const slot = pool.slots[i];
      if (!slot.active) {
         index = i;
         break;
      }
      if (slot.serial < oldest) {
         oldest = slot.serial;
         index = i;
      }
   }
   const slot = pool.slots[index];
   layoutPopup(slot, text, advances);
   slot.active = true;
   slot.x = x;
   slot.y = y;
   slot.z = z;
   slot.age = 0;
   slot.r = ((rgb >> 16) & 255) / 255;
   slot.g = ((rgb >> 8) & 255) / 255;
   slot.b = (rgb & 255) / 255;
   slot.size = size;
   pool.serial += 1;
   slot.serial = pool.serial;
   return index;
}

/** Ages every popup by `dt` s (0 = frozen) and frees the finished ones. */
export function stepPopups(pool: PopupPool, dt: number): void {
   if (!(dt > 0)) return;
   for (const slot of pool.slots) {
      if (!slot.active) continue;
      slot.age += dt;
      if (slot.age >= POPUP_LIFE) slot.active = false;
   }
}

export interface PopupLook {
   rise: number;
   opacity: number;
   pop: number;
}

/** A popup's rise (m), opacity and scale `age` s in: an ease-out rise, a pop 0.6 -> 1.2 -> 1, a fade in the last 40 %. */
export function popupLook(age: number, out: PopupLook): PopupLook {
   const t = Math.min(1, Math.max(0, age / POPUP_LIFE));
   out.rise = POPUP_RISE * (1 - (1 - t) * (1 - t));
   out.opacity = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
   out.pop = t < 0.1 ? 0.6 + 6 * t : t < 0.22 ? 1.2 - (0.2 * (t - 0.1)) / 0.12 : 1;
   return out;
}

/** How many glyph quads are live (what the instanced mesh draws). */
export function liveGlyphs(pool: PopupPool): number {
   let n = 0;
   for (const slot of pool.slots) if (slot.active) n += slot.length;
   return n;
}
