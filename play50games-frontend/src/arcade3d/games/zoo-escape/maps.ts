// Zoo Escape's maps for levels 2-5 (pure data, hand-authored; level 1 is level.ts MAP_1). Each keeps
// the three stage boxes (so the camera windows, the clamp and the surroundings fit every level) and
// changes everything inside them: gates, fences, props, hiding spots, keeper routes, snacks,
// searchlights, jeeps and birds. fairness.level-N.test.ts proves a safe route at every phase.
import { MAP_1, box, boxAt, buildMap, keeper, lineRoute, prop, rectRoute, type Bush, type Gate, type Searchlight, type Stage, type StageIndex, type ZooMap } from "./level";

const DEG = Math.PI / 180;
const bush = (stage: StageIndex, x: number, z: number, look?: Bush["look"], w = 1.8, d = 1.8): Bush => ({ box: boxAt(x, z, w, d, 0.9), stage, look });

/** The three stage boxes every map keeps; the gates (x0..x1 on each north line) are the map's own. */
function stagesWith(g1: [number, number], g2: [number, number], g3: [number, number], start: { x: number; z: number }): Stage[] {
   const gate = (z: number, [x0, x1]: [number, number]): Gate => ({ z, x0, x1 });
   const G1 = gate(0, g1), G2 = gate(-20, g2), G3 = gate(-42, g3);
   return [
      { bounds: { x0: -7, z0: 0, x1: 7, z1: 18 }, start, gate: G1 },
      { bounds: { x0: -9, z0: -20, x1: 9, z1: 0 }, start: { x: (G1.x0 + G1.x1) / 2, z: -1.5 }, gate: G2 },
      { bounds: { x0: -10, z0: -42, x1: 10, z1: -20 }, start: { x: (G2.x0 + G2.x1) / 2, z: -21.5 }, gate: G3 },
   ];
}

/** The outer walls of the three stages and the gate walls beside each opening. */
function wallsFor(stages: readonly Stage[]): [number, number, number, number][] {
   const [a, b, c] = stages;
   return [
      [-7, 18, 7, 18],
      [-7, 0, -7, 18],
      [7, 0, 7, 18],
      [-9, 0, a.gate.x0, 0],
      [a.gate.x1, 0, 9, 0],
      [-9, -20, -9, 0],
      [9, -20, 9, 0],
      [-10, -20, b.gate.x0, -20],
      [b.gate.x1, -20, 10, -20],
      [-10, -42, -10, -20],
      [10, -42, 10, -20],
      [-10, -42, c.gate.x0, -42],
      [c.gate.x1, -42, 10, -42],
   ];
}

const acacia = (x: number, z: number, yaw = 0) => prop("acacia", boxAt(x, z, 0.8, 0.8, 3.5), yaw);
const mound = (x: number, z: number, size: number, yaw = 0) => prop("rock", boxAt(x, z, size * 0.8, size * 0.75, 1.4), yaw, size);
const pond = (x: number, z: number, w: number, d: number) => prop("pond", boxAt(x, z, w, d, 0.3));
const hut = (x: number, z: number, w: number, d: number, yaw = 0) => prop("hut", boxAt(x, z, w, d, 2.8), yaw);
const parkedJeep = (x: number, z: number, yaw = 0) => prop("jeep", Math.abs(Math.sin(yaw)) > 0.5 ? boxAt(x, z, 3.8, 1.9, 1.8) : boxAt(x, z, 1.9, 3.8, 1.8), yaw);
const crate = (x: number, z: number) => prop("crate", boxAt(x, z, 1.2, 1.2, 1.2));
const lamp = (x: number, z: number) => prop("lamp", boxAt(x, z, 0.4, 0.4, 3));
const bench = (x: number, z: number, yaw = 0) => prop("bench", yaw === 0 ? boxAt(x, z, 2.0, 0.8, 0.9) : boxAt(x, z, 0.8, 2.0, 0.9), yaw);
const kiosk = (x: number, z: number, yaw = 0) => prop("kiosk", Math.abs(Math.sin(yaw)) > 0.5 ? boxAt(x, z, 1.6, 2.0, 2.6) : boxAt(x, z, 2.0, 1.6, 2.6), yaw);
const trunk = (x: number, z: number, yaw = 0) => prop("trunk", boxAt(x, z, 0.6, 0.6, 3.5), yaw);
const perch = (x: number, z: number) => prop("perch", boxAt(x, z, 0.5, 0.5, 1.2));
const tower = (x: number, z: number) => prop("tower", boxAt(x, z, 1.2, 1.2, 6));

// ---------- level 2: Safari Zone ----------

const S2_CYCLES = [24, 18, 21] as const;
const S2_STAGES = stagesWith([-5, -3], [5, 7], [-8, -5], { x: 4.5, z: 16.5 });

export const MAP_2: ZooMap = buildMap({
   id: 2,
   theme: "safari",
   stages: S2_STAGES,
   cycles: S2_CYCLES,
   vision: [7, 7, 8],
   fences: wallsFor(S2_STAGES),
   props: [
      // stage 1: the savanna paddock (a watering hole, acacias, termite mounds)
      pond(2.2, 10.2, 3.6, 2.2),
      acacia(0.4, 13.4, 0.3),
      acacia(4.6, 6.6, 1.2),
      acacia(-4.4, 4.6, 2.0),
      mound(0.6, 16.2, 1.5, 0.5),
      mound(5.6, 2.6, 1.6, 1.4),
      // stage 2: the safari track (a jeep laps the loop), acacias in the infield
      acacia(-2.0, -8.4, 0.8),
      acacia(2.6, -10.2, 2.4),
      mound(-7.6, -9.0, 1.5, 0.2),
      crate(7.6, -17.0),
      // stage 3: the ranger camp (parked jeeps, crates, a hut; a jeep shuttles across)
      parkedJeep(-6.0, -24.5, 0),
      parkedJeep(-2.0, -24.5, 0),
      parkedJeep(4.4, -33.6, Math.PI / 2),
      crate(-1.5, -36.2),
      crate(-0.3, -36.2),
      hut(6.0, -39.0, 3.0, 2.4),
      acacia(2.4, -38.6, 1.1),
      lamp(-3.0, -40.6),
   ],
   bushes: [
      bush(0, 5.4, 12.6, "grass"),
      bush(0, 2.2, 3.0, "grass"),
      bush(0, -2.0, 1.6, "grass"),
      bush(0, -5.6, 15.8, "grass", 1.6, 1.8),
      bush(1, -8.0, -2.6, "grass", 1.8, 1.8),
      bush(1, -2.6, -10.6, "grass"),
      bush(1, 2.6, -7.6, "grass"),
      bush(1, 3.4, -17.8, "grass"),
      bush(1, 8.0, -15.4, "grass", 1.6, 1.8),
      bush(2, 8.6, -25.6, "grass", 1.6, 1.8),
      bush(2, -8.6, -27.0, "grass", 1.6, 1.8),
      bush(2, 1.6, -34.0, "grass"),
      bush(2, -3.4, -39.6, "grass"),
   ],
   keepers: [
      keeper(0, rectRoute(0, -5.6, 7.2, 4.4, 1, true, S2_CYCLES)),
      keeper(1, rectRoute(1, -7.2, -15.2, 6.0, -1, true, S2_CYCLES)),
      keeper(1, lineRoute(1, 7.6, -2.2, Math.PI, S2_CYCLES)),
      keeper(2, rectRoute(2, -9.2, -33.5, 4.4, -1, true, S2_CYCLES)),
      keeper(2, lineRoute(2, 8.6, -27.6, -Math.PI / 2, S2_CYCLES)),
   ],
   snacks: [
      [{ x: -6.0, z: 4.2 }, { x: -5.6, z: 9.0 }, { x: -1.6, z: 13.4 }, { x: 1.6, z: 5.4 }, { x: -4.0, z: 15.8 }, { x: -2.4, z: 7.0 }, { x: -0.8, z: 16.6 }],
      [{ x: -8.0, z: -19.0 }, { x: 0.0, z: -14.6 }, { x: 6.4, z: -9.4 }, { x: 6.8, z: -4.2 }, { x: -2.0, z: -18.6 }, { x: -5.2, z: -6.2 }, { x: 2.8, z: -16.6 }],
      [{ x: -8.6, z: -41.0 }, { x: 0.2, z: -31.8 }, { x: 5.4, z: -30.2 }, { x: -9.0, z: -33.8 }, { x: 8.6, z: -29.0 }, { x: 6.2, z: -25.0 }, { x: -4.6, z: -30.2 }],
   ],
   lights: [null, null, null],
   jeeps: [
      // the safari loop round the infield, once per 18 s
      { stage: 1, route: [{ x: -6.0, z: -5.0 }, { x: 6.0, z: -5.0 }, { x: 6.0, z: -13.0 }, { x: -6.0, z: -13.0 }], length: 3.6, width: 1.8 },
      // the camp lane, east-west and back
      { stage: 2, route: [{ x: -7.6, z: -31.0 }, { x: 7.6, z: -31.0 }, { x: 7.6, z: -30.0 }, { x: -7.6, z: -30.0 }], length: 3.6, width: 1.8 },
   ],
});

// ---------- level 3: Bird Garden ----------

const S3_CYCLES = [21, 21, 15] as const;
const S3_STAGES = stagesWith([-1, 1], [-7, -5], [2, 5], { x: -2.2, z: 16.8 });

export const MAP_3: ZooMap = buildMap({
   id: 3,
   theme: "garden",
   stages: S3_STAGES,
   cycles: S3_CYCLES,
   vision: [7, 7, 8],
   fences: [
      ...wallsFor(S3_STAGES),
      // stage 1: the aviary (its net walls; the stage wall closes it on the west)
      [-2.5, 5, -2.5, 12],
      [-7, 5, -2.5, 5],
      [-7, 12, -2.5, 12],
   ],
   props: [
      // stage 1: the aviary walk (a lily pond, flower beds)
      pond(4.2, 13.4, 3.0, 2.0),
      trunk(-4.8, 15.2, 0.4),
      trunk(5.6, 1.8, 1.9),
      // stage 2: the flamingo ponds
      pond(4.0, -8.0, 6.0, 4.0),
      pond(-1.8, -14.6, 5.0, 3.5),
      trunk(7.8, -15.6, 0.7),
      bench(-6.6, -17.6),
      // stage 3: swan lake (two lakes, one crossing)
      pond(-6.75, -31.5, 6.5, 5.0),
      pond(7.25, -31.5, 5.5, 5.0),
      trunk(-8.4, -40.6, 2.2),
      trunk(8.4, -23.4, 1.0),
      bench(-3.2, -23.0),
   ],
   bushes: [
      bush(0, -0.6, 14.2, "flowers"),
      bush(0, 6.0, 10.6, "flowers", 1.6, 1.8),
      bush(0, -1.2, 3.0, "flowers"),
      bush(0, 3.6, 1.6, "flowers"),
      bush(1, -2.4, -2.6, "flowers"),
      bush(1, 8.0, -2.6, "flowers", 1.6, 1.8),
      bush(1, -7.8, -12.6, "flowers", 1.6, 1.8),
      bush(1, 1.6, -12.6, "flowers"),
      bush(1, -1.6, -19.0, "flowers"),
      bush(2, -8.6, -24.4, "flowers", 1.6, 1.8),
      bush(2, 6.6, -27.0, "flowers"),
      bush(2, -4.0, -35.6, "flowers"),
      bush(2, 0.4, -37.4, "flowers"),
      bush(2, 8.6, -39.8, "flowers", 1.6, 1.8),
   ],
   keepers: [
      keeper(0, rectRoute(0, 0.4, 4.0, 4.4, 1, false, S3_CYCLES)),
      keeper(1, rectRoute(1, -8.2, -5.0, 3.2, -1, true, S3_CYCLES)),
      keeper(1, lineRoute(1, 8.0, -17.6, -Math.PI / 2, S3_CYCLES)),
      keeper(2, rectRoute(2, 0.2, -29.4, 2.0, -1, true, S3_CYCLES)),
      keeper(2, rectRoute(2, 3.0, -22.4, 4.4, -1, false, S3_CYCLES)),
      keeper(2, lineRoute(2, -9.0, -37.6, Math.PI / 2, S3_CYCLES)),
   ],
   snacks: [
      [{ x: 4.4, z: 1.0 }, { x: 1.2, z: 12.2 }, { x: -1.2, z: 5.4 }, { x: 3.2, z: 4.6 }, { x: 5.6, z: 9.4 }, { x: 0.0, z: 9.0 }, { x: -1.6, z: 11.0 }],
      [{ x: -0.8, z: -19.0 }, { x: -6.4, z: -15.0 }, { x: -6.0, z: -2.6 }, { x: 6.8, z: -17.4 }, { x: -8.0, z: -5.4 }, { x: 2.8, z: -15.8 }, { x: -4.0, z: -11.8 }],
      [{ x: 1.0, z: -40.6 }, { x: -1.4, z: -33.4 }, { x: 0.2, z: -27.4 }, { x: 3.8, z: -36.6 }, { x: 3.0, z: -25.0 }, { x: 7.0, z: -21.8 }, { x: 3.0, z: -29.4 }],
   ],
   lights: [null, null, null],
   birds: [
      { stage: 0, x: -2.2, z: 13.8 },
      { stage: 0, x: -2.2, z: 8.0 },
      { stage: 0, x: 3.0, z: 16.0 },
      { stage: 0, x: 6.2, z: 4.0 },
      { stage: 1, x: 0.6, z: -6.0 },
      { stage: 1, x: -6.4, z: -9.6 },
      { stage: 1, x: 2.2, z: -15.4 },
      { stage: 1, x: 7.6, z: -11.0 },
      { stage: 2, x: -1.8, z: -27.6 },
      { stage: 2, x: 2.6, z: -35.2 },
      { stage: 2, x: 6.8, z: -37.0 },
      { stage: 2, x: -6.8, z: -27.0 },
   ],
   decor: [
      // flower beds along the walls and round the ponds (drawing only)
      { kind: "flowers", x: 5.6, z: 16.9, w: 2.2, d: 1.0 },
      { kind: "flowers", x: -5.8, z: 1.0, w: 2.0, d: 1.2 },
      { kind: "flowers", x: 6.3, z: 7.0, w: 1.0, d: 2.4 },
      { kind: "flowers", x: -8.3, z: -8.6, w: 1.0, d: 2.6 },
      { kind: "flowers", x: 8.3, z: -7.6, w: 1.0, d: 2.6 },
      { kind: "flowers", x: 4.4, z: -0.9, w: 2.6, d: 1.0 },
      { kind: "flowers", x: 8.9, z: -34.8, w: 1.0, d: 2.4 },
      { kind: "flowers", x: -1.6, z: -41.3, w: 2.4, d: 1.0 },
      { kind: "flowers", x: -9.3, z: -36.6, w: 1.0, d: 2.2 },
   ],
});

// ---------- level 4: Central Zoo ----------

const S4_CYCLES = [21, 18, 18] as const;
const S4_STAGES = stagesWith([-2, 0], [6, 8], [-1, 2], { x: 5.5, z: 16.4 });
const wall = (x0: number, z0: number, x1: number, z1: number, h = 2.4) => prop("wall", box(x0, z0, x1, z1, h));
const fountain = (x: number, z: number, size: number) => prop("fountain", boxAt(x, z, size, size, 1.6));

export const MAP_4: ZooMap = buildMap({
   id: 4,
   theme: "central",
   stages: S4_STAGES,
   cycles: S4_CYCLES,
   vision: [7, 8, 8],
   fences: wallsFor(S4_STAGES),
   props: [
      // stage 1: the panda house terrace (the house, a snack kiosk, benches)
      hut(-4.2, 14.4, 4.0, 3.0),
      kiosk(5.6, 9.6, 0),
      bench(-1.2, 15.8),
      bench(-5.8, 9.0, Math.PI / 2),
      prop("bin", boxAt(6.4, 13.2, 0.6, 0.6, 0.9)),
      // stage 2: the central plaza (the fountain, kiosks, benches round it)
      fountain(0, -10, 3.4),
      kiosk(-6.4, -3.2, Math.PI / 2),
      kiosk(-6.4, -17.6, 0),
      bench(0, -14.8),
      bench(0, -5.2),
      lamp(-3.6, -12.8),
      lamp(3.6, -7.2),
      // stage 3: the main gate (ticket booths, turnstile walls, a gift shop)
      kiosk(-2.6, -25.0, 0),
      hut(5.6, -27.6, 4.0, 3.2),
      wall(-10, -38.2, -3.2, -37.6),
      wall(4.2, -38.2, 10, -37.6),
      kiosk(-2.0, -32.6, Math.PI / 2),
      bench(6.4, -33.0),
      lamp(-8.6, -33.4),
   ],
   bushes: [
      bush(0, 3.0, 14.6, "crowd", 2.0, 2.0),
      bush(0, 1.2, 9.8, "crowd", 2.0, 2.0),
      bush(0, 3.6, 3.8, "crowd", 2.0, 2.0),
      bush(0, -3.6, 2.4, "crowd", 2.0, 2.0),
      bush(1, -2.8, -3.6, "crowd", 2.0, 2.0),
      bush(1, 3.4, -4.4, "crowd", 2.0, 2.0),
      bush(1, -3.6, -16.4, "crowd", 2.0, 2.0),
      bush(1, 2.4, -18.4, "crowd", 2.0, 2.0),
      bush(1, 4.0, -11.2, "crowd", 2.0, 2.0),
      bush(2, 8.4, -24.0, "crowd", 2.0, 2.0),
      bush(2, -0.8, -27.6, "crowd", 2.0, 2.0),
      bush(2, -6.8, -35.4, "crowd", 2.0, 2.0),
   ],
   keepers: [
      keeper(0, rectRoute(0, -4.4, 5.6, 4.0, 1, true, S4_CYCLES)),
      keeper(0, rectRoute(0, 1.4, 1.2, 4.6, 1, false, S4_CYCLES)),
      keeper(1, rectRoute(1, -8.2, -7.4, 3.0, -1, true, S4_CYCLES)),
      keeper(1, lineRoute(1, 7.8, -3.0, Math.PI, S4_CYCLES)),
      keeper(1, lineRoute(1, -4.0, -16.0, Math.PI / 2, S4_CYCLES)),
      keeper(2, rectRoute(2, -9.0, -22.4, 4.4, -1, false, S4_CYCLES)),
      keeper(2, lineRoute(2, -9.0, -30.0, Math.PI / 2, S4_CYCLES)),
      keeper(2, rectRoute(2, -3.2, -39.0, 6.38, -1, true, S4_CYCLES)),
   ],
   snacks: [
      [{ x: -6.0, z: 1.8 }, { x: -2.8, z: 5.8 }, { x: -1.6, z: 14.2 }, { x: -4.0, z: 11.4 }, { x: 2.4, z: 5.8 }, { x: -0.8, z: 11.0 }, { x: -1.6, z: 4.6 }],
      [{ x: 4.0, z: -17.0 }, { x: 6.8, z: -13.0 }, { x: -2.8, z: -7.4 }, { x: -3.2, z: -15.4 }, { x: 7.6, z: -4.6 }, { x: 6.0, z: -8.2 }, { x: -8.0, z: -8.6 }],
      [{ x: -9.0, z: -41.0 }, { x: -2.6, z: -37.4 }, { x: 3.0, z: -37.4 }, { x: -9.0, z: -30.6 }, { x: -5.4, z: -39.8 }, { x: 1.0, z: -29.4 }, { x: -0.2, z: -26.2 }],
   ],
   lights: [null, null, null],
   decor: [
      { kind: "plaza", x: 0, z: -10, w: 12, d: 12 },
      { kind: "plaza", x: 0, z: -40, w: 8, d: 4 },
   ],
});

// ---------- level 5: Night Escape ----------

const S5_CYCLES = [21, 18, 18] as const;
const S5_STAGES = stagesWith([4, 6], [-6, -4], [6, 9], { x: -5.0, z: 16.4 });
const LIGHT_5A: Searchlight = { x: -10.8, z: -11.0, baseYaw: Math.PI / 2, sweep: 0.8, period: 9, halfAngle: 11 * DEG, range: 11, radioRange: 12 };
const LIGHT_5B: Searchlight = { x: 10.8, z: -30.0, baseYaw: -Math.PI / 2, sweep: 0.9, period: 9, halfAngle: 12 * DEG, range: 12, radioRange: 12 };
const car = (x: number, z: number, yaw = 0) => prop("car", boxAt(x, z, 2.0, 4.2, 1.8), yaw);
const bamboo = (x: number, z: number, yaw = 0) => prop("bamboo", boxAt(x, z, 1.2, 1.2, 2.6), yaw);
const rock = (x: number, z: number, size: number, yaw = 0) => prop("rock", boxAt(x, z, size * 0.8, size * 0.75, 1.4), yaw, size);

export const MAP_5: ZooMap = buildMap({
   id: 5,
   theme: "night",
   stages: S5_STAGES,
   cycles: S5_CYCLES,
   vision: [7, 7, 8],
   fences: wallsFor(S5_STAGES),
   props: [
      // stage 1: the panda house at night (the house, rocks, bamboo, lamps)
      hut(2.2, 14.2, 3.0, 2.4),
      rock(-2.6, 13.4, 1.7, 0.6),
      bamboo(-6.0, 4.4),
      bamboo(5.8, 9.6),
      rock(0.8, 1.6, 1.6, 2.0),
      lamp(-6.4, 8.8),
      lamp(6.4, 4.8),
      // stage 2: the moonlit plaza (a searchlight sweeps it from the west tower)
      tower(LIGHT_5A.x, LIGHT_5A.z),
      kiosk(4.4, -5.0, 0),
      kiosk(-2.0, -15.0, Math.PI / 2),
      bench(-6.6, -1.6),
      lamp(-1.6, -2.2),
      lamp(4.6, -18.6),
      trunk(-6.4, -17.4, 0.9),
      // stage 3: the back gate (parked cars, crates; the east tower's searchlight)
      tower(LIGHT_5B.x, LIGHT_5B.z),
      car(-6.6, -27.0, 0),
      car(0.6, -27.0, Math.PI),
      car(-3.4, -37.4, Math.PI),
      car(3.6, -35.4, 0),
      crate(8.8, -28.8),
      crate(-1.4, -40.6),
      lamp(0.6, -31.2),
      lamp(9.2, -34.6),
   ],
   bushes: [
      bush(0, -5.4, 12.0),
      bush(0, 3.8, 8.0),
      bush(0, -2.0, 3.6),
      bush(0, 3.2, 2.2),
      bush(1, 6.8, -3.0, "bush", 1.8, 1.8),
      bush(1, -5.6, -6.0),
      bush(1, 3.0, -12.4),
      bush(1, -7.8, -14.0, "bush", 1.6, 1.8),
      bush(1, 2.6, -18.4),
      bush(2, -8.6, -23.6, "bush", 1.6, 1.8),
      bush(2, 4.4, -24.2),
      bush(2, -8.6, -31.6, "bush", 1.6, 1.8),
      bush(2, 0.4, -39.6),
      bush(2, 6.4, -31.6),
   ],
   keepers: [
      keeper(0, rectRoute(0, -4.0, 6.0, 5.0, 1, true, S5_CYCLES)),
      keeper(1, rectRoute(1, -7.6, -4.6, 4.6, -1, false, S5_CYCLES)),
      keeper(1, rectRoute(1, 6.6, -10.4, 1.6, -1, true, S5_CYCLES)),
      keeper(2, rectRoute(2, -6.4, -30.6, 5.0, -1, true, S5_CYCLES)),
      keeper(2, rectRoute(2, -9.2, -36.4, 4.0, -1, true, S5_CYCLES)),
      keeper(2, rectRoute(2, 3.0, -22.6, 4.4, -1, true, S5_CYCLES)),
   ],
   snacks: [
      [{ x: -5.6, z: 2.2 }, { x: 0.4, z: 11.8 }, { x: -3.2, z: 5.8 }, { x: -4.4, z: 11.0 }, { x: 1.2, z: 5.4 }, { x: 0.0, z: 15.0 }, { x: 4.8, z: 5.4 }],
      [{ x: 5.6, z: -19.0 }, { x: 0.8, z: -11.8 }, { x: -8.0, z: -11.4 }, { x: -1.6, z: -9.0 }, { x: -2.4, z: -5.6 }, { x: 6.8, z: -7.4 }, { x: -5.2, z: -9.4 }],
      [{ x: 6.2, z: -24.2 }, { x: 3.4, z: -28.6 }, { x: -2.6, z: -30.6 }, { x: 4.8, z: -32.4 }, { x: 3.8, z: -40.6 }, { x: 0.4, z: -35.6 }, { x: 4.2, z: -38.2 }],
   ],
   lights: [null, LIGHT_5A, LIGHT_5B],
   decor: [
      { kind: "lightPool", x: -6.4, z: 8.8, w: 4.4, d: 4.4 },
      { kind: "lightPool", x: 6.4, z: 4.8, w: 4.4, d: 4.4 },
   ],
});

// helpers the later maps use (kept referenced so tsc does not flag them while those maps are drafts)
export const _helpers = { DEG, box, lamp, bench, kiosk, trunk, perch, tower } as const;
export type _Light = Searchlight;
