// Floating score popups ("+200", "Combo x3"): the slot pool behind useFx().score. Pure, no
// allocation after createScoreSlots(): FloatingScores (FxLayer.tsx) draws each live slot as one
// sprite with its own canvas texture, redrawn only when the slot gets new text.

/** how long a popup lives, s */
export const SCORE_LIFE = 0.95;
/** how far it rises over its life, m */
export const SCORE_RISE = 1.1;
/** popups on screen at once; the oldest is reused beyond this */
export const SCORE_SLOTS = 8;

export interface ScoreSlot {
   active: boolean;
   x: number;
   y: number;
   z: number;
   age: number;
   text: string;
   color: string;
   /** on-screen height as a fraction of the canvas height's half (sprite scale, sizeAttenuation off) */
   size: number;
   /** the text or colour changed: the slot's canvas must be redrawn */
   dirty: boolean;
   /** emit order, to find the oldest slot */
   serial: number;
}

export interface ScoreSlots {
   readonly slots: ScoreSlot[];
   serial: number;
}

export function createScoreSlots(count = SCORE_SLOTS): ScoreSlots {
   const slots: ScoreSlot[] = [];
   for (let i = 0; i < count; i++) {
      slots.push({ active: false, x: 0, y: 0, z: 0, age: 0, text: "", color: "#ffffff", size: 0, dirty: false, serial: 0 });
   }
   return { slots, serial: 0 };
}

/** Starts a popup in a free slot (or the oldest one). Returns the slot index. */
export function emitScore(
   pool: ScoreSlots,
   x: number,
   y: number,
   z: number,
   text: string,
   color: string,
   size: number
): number {
   let index = -1;
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
   if (slot.text !== text || slot.color !== color) slot.dirty = true;
   slot.active = true;
   slot.x = x;
   slot.y = y;
   slot.z = z;
   slot.age = 0;
   slot.text = text;
   slot.color = color;
   slot.size = size;
   pool.serial += 1;
   slot.serial = pool.serial;
   return index;
}

/** Ages every popup by `dt` s (0 = frozen) and frees the finished ones. */
export function stepScores(pool: ScoreSlots, dt: number): void {
   if (!(dt > 0)) return;
   for (const slot of pool.slots) {
      if (!slot.active) continue;
      slot.age += dt;
      if (slot.age >= SCORE_LIFE) slot.active = false;
   }
}

/** Rise (m), opacity and scale factor of a popup at `age` s. */
export function scoreLook(age: number, out: { rise: number; opacity: number; pop: number }): typeof out {
   const t = Math.min(1, Math.max(0, age / SCORE_LIFE));
   const ease = 1 - (1 - t) * (1 - t);
   out.rise = SCORE_RISE * ease;
   out.opacity = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
   // a quick pop: 0.6 -> 1.15 -> 1 over the first 0.2 of its life
   out.pop = t < 0.1 ? 0.6 + 5.5 * t : t < 0.2 ? 1.15 - 1.5 * (t - 0.1) : 1;
   return out;
}
