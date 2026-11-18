// Menu 2 secrets (00-framework.md pillar 6): 1 to 3 hidden things per level, colour shards and
// stickers, found by exploring or with a hero power. Each has a stable id; progress (menu2/progress)
// keeps the ones a player found. Secrets never add score, so they never touch a maxScore proof.
import type { M2HeroId } from "../heroModels";

export type SecretKind = "shard" | "sticker";

export interface SecretSpec {
   /** short id, unique inside its level ("pad-sky", "ledge") */
   id: string;
   kind: SecretKind;
   /** the name on the star screen ("Sky shard") */
   name: string;
   /** a hero whose power makes it easier (a gated route); any hero may still find it */
   hero?: M2HeroId;
}

export const MAX_SECRETS_PER_LEVEL = 3;

/** The id stored in progress: `<slug>:<level>:<id>`. */
export function secretKey(slug: string, level: number, id: string): string {
   return `${slug}:${level}:${id}`;
}

export function secretProblems(list: readonly SecretSpec[]): string[] {
   const out: string[] = [];
   if (list.length < 1 || list.length > MAX_SECRETS_PER_LEVEL) out.push(`a level has 1 to ${MAX_SECRETS_PER_LEVEL} secrets (got ${list.length})`);
   const seen = new Set<string>();
   for (const s of list) {
      if (!/^[a-z0-9-]+$/.test(s.id)) out.push(`bad id "${s.id}" (a-z, 0-9, -)`);
      if (seen.has(s.id)) out.push(`duplicate id "${s.id}"`);
      seen.add(s.id);
      if (!s.name) out.push(`"${s.id}" needs a name`);
   }
   return out;
}

/** What a run found: a bit per secret (in the level's list order). Allocated once per run. */
export interface SecretTracker {
   found: Uint8Array;
   count: number;
}

export function createSecretTracker(list: readonly SecretSpec[]): SecretTracker {
   return { found: new Uint8Array(list.length), count: 0 };
}

/** Marks secret `index` found. True only the first time. */
export function collectSecret(t: SecretTracker, index: number): boolean {
   if (index < 0 || index >= t.found.length || t.found[index]) return false;
   t.found[index] = 1;
   t.count += 1;
   return true;
}

export function copySecretTracker(src: SecretTracker, dst: SecretTracker): void {
   dst.found.set(src.found);
   dst.count = src.count;
}

/** The ids found this run (for progress). */
export function foundIds(list: readonly SecretSpec[], t: SecretTracker): string[] {
   const out: string[] = [];
   for (let i = 0; i < list.length; i++) if (t.found[i]) out.push(list[i].id);
   return out;
}

/** The found ids as a bitmask (a store stat can carry it). */
export function foundMask(t: SecretTracker): number {
   let m = 0;
   for (let i = 0; i < t.found.length; i++) if (t.found[i]) m |= 1 << i;
   return m;
}

export function idsFromMask(list: readonly SecretSpec[], mask: number): string[] {
   return list.filter((_, i) => (mask >> i) & 1).map((s) => s.id);
}

export function countKinds(list: readonly SecretSpec[], ids: Iterable<string>): { shards: number; stickers: number } {
   const set = new Set(ids);
   let shards = 0;
   let stickers = 0;
   for (const s of list) {
      if (!set.has(s.id)) continue;
      if (s.kind === "shard") shards += 1;
      else stickers += 1;
   }
   return { shards, stickers };
}
