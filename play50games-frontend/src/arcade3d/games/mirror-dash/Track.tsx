"use client";

// One pair's course, drawn around where it runs (a window from 12 m behind to 110 m ahead): the two
// runways of m2RunwayPlatform tiles (pulled together in merge zones), the mirror wall between them (glass
// panels tinted per zone: violet mirror, milky frost, pulsing echo; gone where the road merges) on
// m2MirrorStand posts, the obstacles (m2HazardBlock, the cracked ones orange, m2NeonSpikeBlock hurdles,
// m2LaserWall lasers, glowing slide bars, ghost glass), orbs (m2Crystal), secrets, the checkpoint gates
// (m2MirrorGate) and the finish, and the Sentinel's panes on L5. Course x: the pair's own offset.
import { useEffect, useMemo } from "react";
import { BoxGeometry, Color, Euler, Matrix4, MeshStandardMaterial, OctahedronGeometry, Quaternion, Vector3 } from "three";
import { DynamicInstancedModel } from "../../core/assets";
import { DynamicInstanced } from "../../core/render/DynamicInstanced";
import { useGameTime } from "../../core/gameTime";
import { LANE_W, START_M, ROW_M, type Course, type ObstacleKind } from "./levels";
import { CENTRE, type Pair, type World } from "./rules";
import { ASSETS, SIZE } from "./assets";
import { ZONE_WALL } from "./look";

const BEHIND = 12;
const AHEAD = 110;
const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3();
const ONE = new Vector3(1, 1, 1);

/** the merge (0 apart .. 1 one road) of the drawn course at s: a 5 m ramp into and out of merge rows */
export function mergeAt(c: Course, s: number): number {
   let best = 0;
   const i0 = Math.floor((s - START_M) / ROW_M) - 1;
   for (let i = i0; i <= i0 + 2; i++) {
      if (i < 0 || i >= c.zones.length || c.zones[i] !== "merge") continue;
      const a = START_M + i * ROW_M - ROW_M / 2;
      const b = a + ROW_M;
      const d = s < a ? a - s : s > b ? s - b : 0;
      best = Math.max(best, Math.max(0, 1 - d / 5));
   }
   return best;
}

const centreAt = (m: number) => CENTRE.apart + (CENTRE.merged - CENTRE.apart) * m;
/** world x of a lane (k: 0 the hero's runway, 1 the reflection's) at merge m */
export const laneWorldX = (k: number, lane: number, m: number) => (k === 0 ? -centreAt(m) : centreAt(m)) + lane * LANE_W;

export function Track({ world, pair, ox }: { world: World; pair: Pair; ox: number }) {
   const c = world.course;
   const time = useGameTime();
   const near = (s: number) => s > pair.s - BEHIND && s < pair.s + AHEAD;
   const lists = useMemo(() => {
      const by = (k: ObstacleKind) => c.obstacles.map((o, i) => ({ o, i })).filter((x) => x.o.kind === k);
      return { B: by("B"), C: by("C"), L: by("L"), Z: by("Z"), H: by("H"), G: by("G") };
   }, [c]);
   const endS = pair.boss ? (Number.isFinite(pair.finishS) ? pair.finishS : Infinity) : c.endS;
   // code parts: the wall panels, the slide bars, ghost glass, secrets
   const parts = useMemo(() => {
      const box = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      const slab = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      const local = (sx: number, sy: number, sz: number, y: number) => new Matrix4().compose(new Vector3(0, y, 0), new Quaternion(), new Vector3(sx, sy, sz));
      return {
         tile: [
            { geometry: slab, material: new MeshStandardMaterial({ color: "#d9b778", emissive: new Color("#8a6a2e"), emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.6 }), locals: [local(LANE_W - 0.02, 0.12, SIZE.tileL - 0.02, 0)] },
            { geometry: slab, material: new MeshStandardMaterial({ color: "#120c26", emissive: new Color("#3b1d7a"), emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.5 }), locals: [local(LANE_W - 0.14, 0.12, SIZE.tileL - 0.14, 0.02)] },
         ],
         wall: [{ geometry: box, material: new MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.3, emissive: new Color("#a78bfa"), emissiveIntensity: 0.7, depthWrite: false }) }],
         bar: [{ geometry: box, material: new MeshStandardMaterial({ color: "#f0abfc", emissive: new Color("#d946ef"), emissiveIntensity: 1.4, roughness: 0.3 }) }],
         ghost: [{ geometry: box, material: new MeshStandardMaterial({ color: "#c4b5fd", transparent: true, opacity: 0.35, emissive: new Color("#8b5cf6"), emissiveIntensity: 0.8, depthWrite: false }) }],
         finish: [{ geometry: box, material: new MeshStandardMaterial({ color: "#ffffff", emissive: new Color("#c4b5fd"), emissiveIntensity: 1.2 }) }],
         secret: [{ geometry: new OctahedronGeometry(0.32, 0), material: new MeshStandardMaterial({ color: "#fde047", emissive: new Color("#eab308"), emissiveIntensity: 1.3, roughness: 0.3 }) }],
      };
   }, []);
   useEffect(
      () => () => {
         for (const list of Object.values(parts))
            for (const p of list) {
               p.geometry.dispose();
               p.material.dispose();
            }
      },
      // (the tile parts share one box geometry; a second dispose is a no-op)
      [parts]
   );
   const zoneTint = useMemo(() => ({ mirror: new Color(ZONE_WALL.mirror.color), frost: new Color(ZONE_WALL.frost.color), echo: new Color(ZONE_WALL.echo.color), merge: new Color("#000000") }), []);
   const tiles = Math.ceil((BEHIND + AHEAD) / SIZE.tileL) * 6;
   const tile0 = () => Math.floor((pair.s - BEHIND) / SIZE.tileL);
   const place = (x: number, y: number, s: number, m: Matrix4, rotY = 0, sx = 1, sy = 1, sz = 1) => {
      Q.setFromEuler(E.set(0, rotY, 0));
      m.compose(V.set(ox + x, y, -s), Q, S.set(sx, sy, sz));
   };
   return (
      <>
         {/* the runways: 3 lanes x 2 runways of 2 m glass tiles on a brass frame (code: a floor) */}
         <DynamicInstanced
            count={tiles}
            parts={parts.tile}
            update={(i, m) => {
               const row = tile0() + Math.floor(i / 6);
               const s = row * SIZE.tileL + SIZE.tileL / 2;
               if (s < 0 || s > endS + 30) return false;
               const k = Math.floor((i % 6) / 3);
               const lane = (i % 3) - 1;
               place(laneWorldX(k, lane, mergeAt(c, s)), -0.16, s, m);
            }}
         />
         {/* the mirror wall: a glass panel per 2 m, tinted by zone, gone where the road merges */}
         <DynamicInstanced
            count={Math.ceil((BEHIND + AHEAD) / SIZE.tileL)}
            parts={parts.wall}
            tinted
            update={(i, m, color) => {
               const s = (tile0() + i) * SIZE.tileL + SIZE.tileL / 2;
               if (s < 0 || s > endS + 30) return false;
               if (mergeAt(c, s) > 0.05) return false;
               const zi = Math.floor((s - START_M + ROW_M / 2) / ROW_M);
               const zone = zi >= 0 && zi < c.zones.length ? c.zones[zi] : "mirror";
               color.copy(zoneTint[zone]);
               if (zone === "echo") color.multiplyScalar(0.75 + 0.25 * Math.sin(time.now * 6 + s * 0.3));
               place(0, 0, s, m, 0, 0.22, zone === "frost" ? 2.6 : 2.3, SIZE.tileL);
            }}
         />
         <DynamicInstancedModel
            asset={ASSETS.stand}
            count={Math.ceil((BEHIND + AHEAD) / 8) + 1}
            update={(i, m) => {
               const s = (Math.floor((pair.s - BEHIND) / 8) + i) * 8;
               if (s < 0 || s > endS + 30 || mergeAt(c, s) > 0.05) return false;
               place(0, 0, s, m);
            }}
         />
         {/* obstacles */}
         {(
            [
               ["B", ASSETS.block, 0],
               ["C", ASSETS.cracked, 0],
               ["L", ASSETS.spike, 0],
               ["Z", ASSETS.laser, 0],
            ] as const
         ).map(([k, asset]) =>
            lists[k].length ? (
               <DynamicInstancedModel
                  key={k}
                  asset={asset}
                  count={lists[k].length}
                  update={(i, m) => {
                     const e = lists[k][i];
                     if (!e) return false;
                     const { o, i: idx } = e;
                     if (!near(o.s) || pair.broken[idx]) return false;
                     const wob = k === "C" ? Math.sin(time.now * 20 + i) * 0.02 : 0;
                     place(laneWorldX(o.body, o.lane, mergeAt(c, o.s)) + wob, 0, o.s, m, k === "B" || k === "C" ? i * 0.7 : 0);
                  }}
               />
            ) : null
         )}
         {lists.H.length > 0 && (
            <DynamicInstanced
               count={lists.H.length}
               parts={parts.bar}
               update={(i, m) => {
                  const o = lists.H[i]?.o;
                  if (!o) return false;
                  if (!near(o.s)) return false;
                  place(laneWorldX(o.body, o.lane, mergeAt(c, o.s)), 0.95, o.s, m, 0, LANE_W - 0.1, 0.32, 0.3);
               }}
            />
         )}
         {lists.G.length > 0 && (
            <DynamicInstanced
               count={lists.G.length}
               parts={parts.ghost}
               update={(i, m) => {
                  const o = lists.G[i]?.o;
                  if (!o) return false;
                  if (!near(o.s)) return false;
                  place(laneWorldX(o.body, o.lane, mergeAt(c, o.s)), 0, o.s, m, 0, LANE_W - 0.1, 2.2, 0.6);
               }}
            />
         )}
         {/* the Sentinel's panes (L5) */}
         {pair.boss && (
            <DynamicInstancedModel
               asset={ASSETS.pane}
               count={12}
               update={(i, m) => {
                  const pn = pair.boss!.panes[i];
                  if (!pn) return false;
                  const drop = Math.max(0, (pn.s - pair.s - 18) * 0.35);
                  place(laneWorldX(pn.body, pn.lane, pair.merge), drop, pn.s, m, time.now * 0.5 + i, 1, 1.2, 0.5);
               }}
            />
         )}
         {/* orbs: crystals that spin and bob; secrets */}
         <DynamicInstancedModel
            asset={ASSETS.crystal}
            count={Math.max(1, c.orbs.length)}
            update={(i, m) => {
               const o = c.orbs[i];
               if (!o || pair.orbsTaken[i] || !near(o.s)) return false;
               Q.setFromEuler(E.set(0, time.now * 2 + i, 0));
               m.compose(V.set(ox + laneWorldX(o.body, o.lane, mergeAt(c, o.s)), o.y - 0.25 + Math.sin(time.now * 3 + i) * 0.08, -o.s), Q, ONE);
            }}
         />
         {c.secrets.length > 0 && (
            <DynamicInstanced
               count={c.secrets.length}
               parts={parts.secret}
               update={(i, m) => {
                  const x = c.secrets[i];
                  if (pair.secrets.found[x.secret] || !near(x.s)) return false;
                  Q.setFromEuler(E.set(0, time.now * 1.5, 0));
                  m.compose(V.set(ox + laneWorldX(x.body, x.lane, mergeAt(c, x.s)), x.y, -x.s), Q, ONE);
               }}
            />
         )}
         {/* checkpoint gates over both runways, and the finish */}
         <DynamicInstancedModel
            asset={ASSETS.gate}
            count={c.checkpoints.length * 2}
            update={(i, m) => {
               const s = c.checkpoints[Math.floor(i / 2)];
               if (!s || !near(s)) return false;
               const k = i % 2;
               place(laneWorldX(k, 0, mergeAt(c, s)), 0, s, m, 0, (3 * LANE_W + 0.4) / (1.385 * (SIZE.gate / 1.899)), 1, 1);
            }}
         />
         <DynamicInstanced
            count={2}
            parts={parts.finish}
            update={(i, m) => {
               if (!Number.isFinite(endS) || !near(endS)) return false;
               place(laneWorldX(i, 0, 0), -0.05, endS, m, 0, 3 * LANE_W, 0.08, 1.2);
            }}
         />
      </>
   );
}
