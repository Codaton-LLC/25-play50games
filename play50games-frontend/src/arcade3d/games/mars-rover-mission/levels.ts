// Mars Rover Mission level configs (docs/menu1-new/specs-41-50.md §43, redesigned 2026-10-28: one clear
// mission per level). Plain data only: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

/**
 * What the rover does at each site (all the same rule: stop inside the ring for 1 s):
 * - crystal: drill the crystal deposit in the ring's centre and carry the sample home;
 * - beacon: scan the signal beacon at the ring's far edge;
 * - panel: repair the broken solar panel at the ring's far edge;
 * - relic: scan the ancient lantern pillar at the ring's far edge.
 */
export type MissionKind = "crystal" | "beacon" | "panel" | "relic";
/** The ground beyond the plain: low ridges, tall canyon walls, a crater rim, or ridges with ruins. */
export type TerrainKind = "plains" | "canyon" | "crater" | "ruins";

export interface MarsLevel {
   width: number;
   depth: number;
   sites: number;
   chargers: number;
   rocks: number;
   /** sliding rocks: boulders that slide down the north cliff and roll south along their lane */
   boulders: number;
   boulderSpeed: number;
   /** crevasses: a fall costs a life and puts the rover back on safe ground */
   crevasses: number;
   drainScale: number;
   durationMs: number;
   lighting: "day" | "sunset" | "night";
   background: string;
   mission: MissionKind;
   terrain: TerrainKind;
   /** a dust storm closes in as the clock runs down */
   storm: boolean;
   /** a dark level: the rover drives with its headlights on */
   headlights: boolean;
}

export const LEVELS: Record<LevelId, MarsLevel> = {
   1: { width: 40, depth: 32, sites: 3, chargers: 1, rocks: 6, boulders: 0, boulderSpeed: 0, crevasses: 0, drainScale: 0.8, durationMs: 120_000, lighting: "day", background: "#fdba74", mission: "crystal", terrain: "plains", storm: false, headlights: false },
   2: { width: 46, depth: 36, sites: 4, chargers: 1, rocks: 12, boulders: 0, boulderSpeed: 0, crevasses: 0, drainScale: 0.9, durationMs: 150_000, lighting: "day", background: "#fb923c", mission: "beacon", terrain: "plains", storm: false, headlights: false },
   3: { width: 50, depth: 40, sites: 5, chargers: 2, rocks: 12, boulders: 2, boulderSpeed: 3.5, crevasses: 0, drainScale: 1.0, durationMs: 180_000, lighting: "sunset", background: "#c2410c", mission: "crystal", terrain: "canyon", storm: false, headlights: false },
   4: { width: 50, depth: 40, sites: 6, chargers: 2, rocks: 12, boulders: 3, boulderSpeed: 4.0, crevasses: 2, drainScale: 1.15, durationMs: 180_000, lighting: "sunset", background: "#9a3412", mission: "panel", terrain: "crater", storm: true, headlights: true },
   5: { width: 56, depth: 44, sites: 7, chargers: 2, rocks: 14, boulders: 4, boulderSpeed: 4.5, crevasses: 3, drainScale: 1.1, durationMs: 240_000, lighting: "night", background: "#0c0a09", mission: "relic", terrain: "ruins", storm: false, headlights: true },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Landing Zone",
   2: "Rocky Plains",
   3: "Mars Canyon",
   4: "Crater",
   5: "Ancient Mars Site",
};

/** The mission: one sentence on the start card under the level tiles (the goal in 3 seconds). */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Mission: drill 3 crystal samples and bring them back to the lander.",
   2: "Mission: scan 4 signal beacons, then drive back to the lander.",
   3: "Mission: drill 5 crystals in the canyon. Watch for sliding rocks!",
   4: "Mission: repair 6 solar panels before the dust storm hits.",
   5: "Mission: scan 7 ancient beacons by headlight and return to the lander.",
};

/** The HUD's words for each mission: the counter chip, one site, the action in progress, the action done. */
export const MISSION_WORDS: Record<MissionKind, { chip: string; one: string; doing: string; done: string; verb: string }> = {
   crystal: { chip: "Crystals", one: "crystal", doing: "Drilling", done: "Sample stored", verb: "Drill" },
   beacon: { chip: "Beacons", one: "beacon", doing: "Scanning", done: "Beacon scanned", verb: "Scan" },
   panel: { chip: "Panels", one: "panel", doing: "Repairing", done: "Panel online", verb: "Repair" },
   relic: { chip: "Beacons", one: "ancient beacon", doing: "Scanning", done: "Signal decoded", verb: "Scan" },
};
