// Solver-discovered lines, original-orientation headings; runtime never imports this fixture.
import { LEVEL_IDS, type LevelId } from "../../types";
import { ACE_LINES, PAR_LINES, type LinePutt } from "./solver";
import { courseSpecs } from "./course";
import { LEVELS } from "./levels";
/** Lines by layout (spec index 0-5, 0-8 for the level-5 physics), per level physics. */
const SPEC_PAR: Record<LevelId, LinePutt[][]> = {
   1: PAR_LINES,
   2: [[{"a": 5, "p": 0.765, "w": 0}, {"a": -102.60986256038147, "p": 0.1, "w": 571}], [{"a": -3, "p": 0.81, "w": 0}, {"a": 114.84471776201808, "p": 0.1, "w": 572}], [{"a": 6, "p": 0.765, "w": 0}, {"a": -145.851580965195, "p": 0.12, "w": 513}], [{"a": 1, "p": 0.7200000000000001, "w": 0}, {"a": 58.03307055501901, "p": 0.1, "w": 541}], [{"a": -2, "p": 0.54, "w": 0}, {"a": 80.03322278339144, "p": 0.2, "w": 943}], [{"a": 4, "p": 0.63, "w": 0}, {"a": 85.90902464616174, "p": 0.1, "w": 675}]],
   3: [[{"a": 5, "p": 0.765, "w": 0}, {"a": -102.60986256038147, "p": 0.1, "w": 571}], [{"a": -3, "p": 0.81, "w": 0}, {"a": 114.84471776201808, "p": 0.1, "w": 572}], [{"a": 6, "p": 0.765, "w": 0}, {"a": -145.851580965195, "p": 0.12, "w": 513}], [{"a": 1, "p": 0.7200000000000001, "w": 48}, {"a": 58.03307055501901, "p": 0.1, "w": 589}], [{"a": -2, "p": 0.54, "w": 0}, {"a": 80.03322278339144, "p": 0.2, "w": 943}], [{"a": 4, "p": 0.63, "w": 156}, {"a": 85.90902464616174, "p": 0.1, "w": 831}]],
   4: [[{"a": 5, "p": 0.765, "w": 0}, {"a": -102.60986256038147, "p": 0.1, "w": 571}], [{"a": -3, "p": 0.81, "w": 0}, {"a": 114.84471776201808, "p": 0.1, "w": 572}], [{"a": 6, "p": 0.765, "w": 0}, {"a": -145.851580965195, "p": 0.13, "w": 513}], [{"a": 1, "p": 0.7200000000000001, "w": 48}, {"a": 58.03307055501901, "p": 0.1, "w": 589}], [{"a": -2, "p": 0.54, "w": 0}, {"a": 80.03322278339144, "p": 0.2, "w": 943}], [{"a": 4, "p": 0.63, "w": 156}, {"a": 85.90902464616174, "p": 0.1, "w": 831}]],
   5: [[{"a": 5, "p": 0.765, "w": 0}, {"a": -102.60986256038147, "p": 0.1, "w": 571}], [{"a": -3, "p": 0.81, "w": 0}, {"a": 114.84471776201808, "p": 0.1, "w": 572}], [{"a": 6, "p": 0.765, "w": 0}, {"a": -145.851580965195, "p": 0.13, "w": 513}], [{"a": 1, "p": 0.7200000000000001, "w": 48}, {"a": 58.03307055501901, "p": 0.1, "w": 589}], [{"a": -2, "p": 0.54, "w": 0}, {"a": 80.03322278339144, "p": 0.2, "w": 943}], [{"a": 4, "p": 0.63, "w": 156}, {"a": 85.90902464616174, "p": 0.1, "w": 831}], [{"a": -26, "p": 0.8, "w": 0}], [{"a": -11.5, "p": 0.72, "w": 0}], [{"a": -1.5, "p": 0.96, "w": 0}]],
};
const SPEC_ACE: Record<LevelId, LinePutt[][]> = {
   1: ACE_LINES,
   2: [[{"a": -20.25, "p": 0.7605, "w": 0}], [{"a": -13.5, "p": 0.8459999999999999, "w": 0}], [{"a": 2, "p": 0.747, "w": 0}], [{"a": 2, "p": 0.783, "w": 0}], [{"a": -26.5, "p": 0.8234999999999999, "w": 0}], [{"a": 4.25, "p": 0.693, "w": 0}]],
   3: [[{"a": -20.25, "p": 0.7605, "w": 0}], [{"a": -13.5, "p": 0.8459999999999999, "w": 0}], [{"a": 2, "p": 0.747, "w": 0}], [{"a": 2, "p": 0.783, "w": 0}], [{"a": -26.5, "p": 0.8234999999999999, "w": 0}], [{"a": 4.25, "p": 0.693, "w": 168}]],
   4: [[{"a": -19.75, "p": 0.7404999999999999, "w": 0}], [{"a": -13.5, "p": 0.8509999999999999, "w": 0}], [{"a": 2.25, "p": 0.747, "w": 0}], [{"a": 2, "p": 0.783, "w": 0}], [{"a": -26.5, "p": 0.8234999999999999, "w": 0}], [{"a": 4.5, "p": 0.6779999999999999, "w": 156}]],
   5: [[{"a": -19.75, "p": 0.7404999999999999, "w": 0}], [{"a": -13.5, "p": 0.8509999999999999, "w": 0}], [{"a": 2.25, "p": 0.747, "w": 0}], [{"a": 2, "p": 0.783, "w": 0}], [{"a": -26.5, "p": 0.8234999999999999, "w": 0}], [{"a": 4.5, "p": 0.6779999999999999, "w": 156}], [{"a": -26, "p": 0.8, "w": 0}], [{"a": -11.5, "p": 0.72, "w": 0}], [{"a": -1.5, "p": 0.96, "w": 0}]],
};

/**
 * The level holes (course.ts specs 9-14), found by a robust grid search at their level's physics
 * (2026-10-29: angle 0.25 deg, power 0.005, waits 12 ticks; both mirrors, nine start ticks).
 * Par lines take at least one second (120 ticks) before the first putt.
 */
const NEW_ACE: Record<string, LinePutt[]> = {
   "2:9": [{ a: -10.5, p: 0.97, w: 0 }],
   "2:10": [{ a: -12, p: 0.855, w: 0 }],
   "3:11": [{ a: 2, p: 0.745, w: 0 }],
   "3:12": [{ a: 2, p: 0.74, w: 0 }],
   "4:13": [{ a: -20.77880770915151, p: 0.84, w: 0 }],
   "4:14": [{ a: -25, p: 0.795, w: 0 }],
};
const NEW_PAR: Record<string, LinePutt[]> = {
   "2:9": [{ a: -12.58202920779716, p: 0.74, w: 120 }, { a: 81.96294206222812, p: 0.34, w: 609 }],
   "2:10": [{ a: -30, p: 0.88, w: 120 }, { a: 12.901878924607296, p: 0.3, w: 604 }],
   "3:11": [{ a: -1, p: 0.56, w: 120 }, { a: 29.960839632095777, p: 0.22, w: 615 }],
   "3:12": [{ a: -1, p: 0.56, w: 120 }, { a: 26.554202172119872, p: 0.22, w: 615 }],
   "4:13": [{ a: -20.52880770915151, p: 0.64, w: 120 }, { a: 11.784390965964796, p: 0.37, w: 668 }],
   "4:14": [{ a: -30, p: 0.7, w: 120 }, { a: 4.999327171659886, p: 0.38, w: 660 }],
};

// Human-paced witnesses: allow at least one second to read and aim every first shot.
// Whole windmill turns preserve its phase. 628 ticks rounds one original-bar turn;
// both mirrors and all nine start ticks are independently replayed by the solver tests.
for (const id of LEVEL_IDS) SPEC_PAR[id] = SPEC_PAR[id].map((line, spec) => {
   if (line[0].w >= 120) return line;
   const delay = spec === 3 ? (id <= 2 ? 720 : 600) : spec === 5 ? 628 : 120;
   return line.map(q => ({ ...q, w: q.w + delay }));
});

/** A level's lines by course place: its layouts in order, at its physics (level 4 = level 5's physics for specs 6-8). */
function byCourse(spec: Record<LevelId, LinePutt[][]>, extra: Record<string, LinePutt[]>, id: LevelId): LinePutt[][] {
   return courseSpecs(LEVELS[id].holes, LEVELS[id].course).map((k) => extra[`${id}:${k}`] ?? (k >= 6 && id === 4 ? spec[5][k] : spec[id][k]));
}
export const LEVEL_PAR_LINES: Record<LevelId, LinePutt[][]> = Object.fromEntries(LEVEL_IDS.map((id) => [id, byCourse(SPEC_PAR, NEW_PAR, id)])) as Record<LevelId, LinePutt[][]>;
export const LEVEL_ACE_LINES: Record<LevelId, LinePutt[][]> = Object.fromEntries(LEVEL_IDS.map((id) => [id, byCourse(SPEC_ACE, NEW_ACE, id)])) as Record<LevelId, LinePutt[][]>;
