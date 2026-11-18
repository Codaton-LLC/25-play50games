import type { LevelId } from "../../types";

export interface ZipLevel {
   id: LevelId;
   name: string;
   sections: number;
   length: number;
   sag: number;
   targetMs: number;
   durationMs: number;
   crossing: boolean;
   moving: boolean;
   night: boolean;
   boss: boolean;
}

export const LEVELS: Record<LevelId, ZipLevel> = {
   1: { id: 1, name: "Training Line", sections: 3, length: 48, sag: 3, targetMs: 50_000, durationMs: 150_000, crossing: false, moving: false, night: false, boss: false },
   2: { id: 2, name: "Twin Lines", sections: 4, length: 54, sag: 4, targetMs: 65_000, durationMs: 180_000, crossing: true, moving: false, night: false, boss: false },
   3: { id: 3, name: "Moving Landing", sections: 5, length: 58, sag: 4.5, targetMs: 80_000, durationMs: 210_000, crossing: true, moving: true, night: false, boss: false },
   4: { id: 4, name: "Lighthouse Night", sections: 6, length: 60, sag: 5, targetMs: 90_000, durationMs: 240_000, crossing: true, moving: false, night: true, boss: false },
   5: { id: 5, name: "Zipline Master", sections: 7, length: 56, sag: 5, targetMs: 130_000, durationMs: 300_000, crossing: true, moving: true, night: true, boss: true },
};
