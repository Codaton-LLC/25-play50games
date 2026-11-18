// Which hero a Menu 2 game starts with, and the player's own pick (README.md). Plain TS, no React.
//
// - defaultHeroFor(slug): the game's world's lead hero (menu2/worldMap worlds.ts): W1 Riko, W2 Nami,
//   W3 Kiro, W4 Zuno, W5 Vexa; W6 (all five) the player's last pick in any game, or Riko. A slug in
//   no world gets Riko.
// - The player's own last pick per game wins over that default: initialHeroFor(slug).
// - createHeroPick(slug): a tiny live store a game's picker and Scene share (get / set / subscribe).
//   The pick is a run option: a game reads it when a run starts, never mid-run.
// Storage lives here only, behind a never-throwing adapter (localStorage in the browser, memory in
// tests), like core audio's mute: game code never writes localStorage.
import type { M2HeroId } from "../heroModels";
import { worldOfSlug } from "../worldMap/worlds";

export const HERO_PICK_KEY = "play50games_m2_hero";

export interface HeroPickStorage {
   read(key: string): string | null;
   write(key: string, value: string): void;
}

export const localHeroStorage: HeroPickStorage = {
   read(key) {
      try {
         return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      } catch {
         return null;
      }
   },
   write(key, value) {
      try {
         if (typeof window !== "undefined") window.localStorage.setItem(key, value);
      } catch {
         // blocked: the pick holds for this visit only
      }
   },
};

export function memoryHeroStorage(seed: Record<string, string> = {}): HeroPickStorage & { items: Record<string, string> } {
   const items = { ...seed };
   return {
      items,
      read: (key) => (key in items ? items[key] : null),
      write: (key, value) => {
         items[key] = value;
      },
   };
}

interface Stored {
   /** the last pick in any game (W6's default) */
   last: M2HeroId | null;
   /** the last pick per game slug */
   bySlug: Record<string, M2HeroId>;
}

// the same list as heroModels M2_HERO_IDS, kept here so rules-side imports stay free of model data
const HERO_IDS: readonly string[] = ["riko", "nami", "kiro", "zuno", "vexa"];
const isHero = (v: unknown): v is M2HeroId => typeof v === "string" && HERO_IDS.includes(v);

export function parseHeroPicks(raw: string | null): Stored {
   const out: Stored = { last: null, bySlug: {} };
   if (!raw) return out;
   try {
      const v = JSON.parse(raw) as { last?: unknown; bySlug?: Record<string, unknown> } | null;
      if (isHero(v?.last)) out.last = v.last;
      if (v?.bySlug && typeof v.bySlug === "object") {
         for (const [slug, id] of Object.entries(v.bySlug)) if (isHero(id)) out.bySlug[slug] = id;
      }
   } catch {
      // bad data: no picks
   }
   return out;
}

let storage: HeroPickStorage = localHeroStorage;

/** Tests: swap the storage. */
export function setHeroPickStorage(next: HeroPickStorage): void {
   storage = next;
}

const read = (): Stored => parseHeroPicks(storage.read(HERO_PICK_KEY));

/** The game's default hero: its world's lead hero; in W6 (no lead) the last pick anywhere, or Riko. */
export function defaultHeroFor(slug: string, lastPick: M2HeroId | null = read().last): M2HeroId {
   const world = worldOfSlug(slug);
   if (world?.hero) return world.hero;
   if (world && lastPick) return lastPick;
   return "riko";
}

/** The hero a game preselects: the player's own last pick in this game, else defaultHeroFor(slug). */
export function initialHeroFor(slug: string): M2HeroId {
   const s = read();
   return s.bySlug[slug] ?? defaultHeroFor(slug, s.last);
}

/** Remembers a pick for this game (and as the last pick anywhere). */
export function rememberHeroPick(slug: string, id: M2HeroId): void {
   if (!isHero(id)) return;
   const s = read();
   s.last = id;
   s.bySlug[slug] = id;
   storage.write(HERO_PICK_KEY, JSON.stringify(s));
}

export interface HeroPick {
   /** the current pick (read lazily from storage on first use) */
   get(): M2HeroId;
   /** a new pick: remembered for this game, listeners told */
   set(id: M2HeroId): void;
   subscribe(listener: () => void): () => void;
   /** tests: forget the cached pick so the next get() reads storage again */
   reset(): void;
}

export function createHeroPick(slug: string): HeroPick {
   let current: M2HeroId | null = null;
   const listeners = new Set<() => void>();
   return {
      get() {
         if (current === null) current = initialHeroFor(slug);
         return current;
      },
      set(id) {
         if (!isHero(id)) return;
         const changed = this.get() !== id;
         current = id;
         rememberHeroPick(slug, id);
         if (changed) listeners.forEach((l) => l());
      },
      subscribe(listener) {
         listeners.add(listener);
         return () => {
            listeners.delete(listener);
         };
      },
      reset() {
         current = null;
      },
   };
}
