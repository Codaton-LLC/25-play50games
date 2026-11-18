// The podium (pure): the race order of a versus run and the team result of a co-op run, from what
// every game already tracks per player (finished, the time it counts, its score and progress).

export interface Standing {
   index: number;
   finished: boolean;
   /** the time that ranks a finisher (lower is better), e.g. the finish ms minus a bonus */
   timeMs: number | null;
   /** points (higher is better); breaks ties between finishers with the same time */
   score: number;
   /** how far a player who did not finish got (higher is better), e.g. the best height */
   progress: number;
}

export interface Placed extends Standing {
   /** 1-based; players that tie share a place */
   place: number;
}

const better = (a: Standing, b: Standing): number => {
   if (a.finished !== b.finished) return a.finished ? -1 : 1;
   if (a.finished) {
      const ta = a.timeMs ?? Infinity;
      const tb = b.timeMs ?? Infinity;
      if (ta !== tb) return ta - tb;
      if (a.score !== b.score) return b.score - a.score;
      return 0;
   }
   if (a.progress !== b.progress) return b.progress - a.progress;
   if (a.score !== b.score) return b.score - a.score;
   return 0;
};

/** Race order: finishers by time (then score), then the others by progress (then score). Ties share a place. */
export function rankRace(standings: readonly Standing[]): Placed[] {
   const order = [...standings].sort((a, b) => better(a, b) || a.index - b.index);
   const out: Placed[] = [];
   for (let k = 0; k < order.length; k++) {
      const prev = out[k - 1];
      const place = prev && better(prev, order[k]) === 0 ? prev.place : k + 1;
      out.push({ ...order[k], place });
   }
   return out;
}

export interface TeamResult {
   /** everyone finished */
   cleared: boolean;
   /** the team's time: the last finisher's (null unless cleared) */
   timeMs: number | null;
   /** everyone's score together */
   score: number;
   finishers: number;
}

export function teamResult(standings: readonly Standing[]): TeamResult {
   let score = 0;
   let finishers = 0;
   let last = 0;
   for (const s of standings) {
      score += s.score;
      if (s.finished) {
         finishers++;
         last = Math.max(last, s.timeMs ?? 0);
      }
   }
   const cleared = standings.length > 0 && finishers === standings.length;
   return { cleared, timeMs: cleared ? last : null, score, finishers };
}

/** Podium columns left to right: 2nd, 1st, 3rd (then 4th on the side), as a podium is drawn. */
export function podiumOrder<T extends { place: number }>(placed: readonly T[]): T[] {
   const sorted = [...placed].sort((a, b) => a.place - b.place);
   if (sorted.length < 2) return sorted;
   const [first, second, ...rest] = sorted;
   return [second, first, ...rest];
}
