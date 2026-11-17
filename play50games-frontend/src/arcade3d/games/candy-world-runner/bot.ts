// The honest bot (the tests, the proof and ?autoplay=1): it only writes a StepInput (lane presses, the
// roll held, Jump, Action), what a player's keys or touch give. It reads the road the way a player reads
// the size signs: for the next obstacle row, the lane with the obstacle whose size it can make (the
// course's beats: the lane whose coins grow you there, or a Small arch you can roll down to), steering
// into it right after the row before, and holding the roll until it is Small when the row needs Small.
// It never uses a power, never takes decoy coins (it stays out of their lanes) and never steps into a
// popping field or a gummy's lane.
import { SMALL, type Beat } from "./course";
import { BURN_MS, inPhase, speedNow, type CandyRun, type StepInput } from "./rules";

export interface Bot {
   frameMs: number;
   pressAt: number;
}

export function createBot(_run: CandyRun, frameMs = 1000 / 60): Bot {
   return { frameMs, pressAt: -1 };
}

/** The next beat ahead (in its phase on level 5), or null. */
export function nextBeat(run: CandyRun, s: number): Beat | null {
   for (const b of run.course.beats) {
      if (b.s <= s + 0.2) continue;
      if (!inPhase(run, b.phase)) continue;
      return b;
   }
   // level 5: the palace's next lap
   const loop = run.course.loop;
   if (loop && run.boss && run.boss.step !== "done") {
      for (const b of run.course.beats) if (b.phase >= 0 && inPhase(run, b.phase)) return { ...b, s: b.s + (loop.s1 - loop.s0) };
   }
   return null;
}

export function botInput(bot: Bot, run: CandyRun, input: StepInput): void {
   input.left = input.right = input.roll = input.jumpPressed = input.actionPressed = false;
   const r = run.runner;
   const beat = nextBeat(run, r.s);
   if (!beat) return;
   // first take the road's orbs still ahead in this lane (if there is room before the next beat's coins)
   const leaveBy = beat.s - 22;
   let stay = false;
   const co = run.course;
   for (let i = 0; i < co.orbs.length; i++) {
      const o = co.orbs[i];
      if (o.bonus !== null || run.collected[i] || o.lane !== r.lane) continue;
      if (o.s > r.s - 0.5 && o.s < leaveBy && o.s < r.s + 30) {
         stay = true;
         break;
      }
   }
   // steer into the beat's lane (one press at a time, once the last change is done)
   if (!stay && r.swapAt < 0 && r.lane !== beat.lane && run.ms - bot.pressAt > 120) {
      if (beat.lane < r.lane) input.left = true;
      else input.right = true;
      bot.pressAt = run.ms;
   }
   // a Small beat: hold the roll in time to be Small there (each size takes BURN_MS; start a little early)
   if (beat.need === SMALL && r.size > SMALL) {
      const dist = beat.s - r.s;
      const t = (dist / speedNow(run)) * 1000;
      if (t < r.size * BURN_MS + 900) input.roll = true;
   }
}
