"use client";

// The star system, drawn from the rules (rules.ts / system.ts) in the play plane (z = 0): the planetoids
// (m2MiniPlanetoid, scaled to their radius), the moons (m2Asteroid on their orbits), the Orbit Warden
// (m2OrbitWardenBoss) with its three vents, its thruster, its debris belt and its gravity mines
// (m2GravityBuoy), the pod cradles on the surfaces (m2SpacePod, glowing while charged), a halo round each
// body (grey glass until the hero first lands on it, then lit: the restore), each body's sphere of
// influence as a faint dashed ring, the orbs (m2EnergyOrbBlue), the slingshot gates (a solid ring when
// the hero is fast enough, dashed when it is not: shape, never hue alone), the solar flares (a filled
// disc while burning, an outline while not), the debris (m2Asteroid shards), Riko's cracked panels
// (m2SatellitePanel), level 4's crates (m2SpaceCrate), the dock (m2StationDeck, m2DockingArm, the
// beacon and its capture ring), and the trajectory preview (dots for the next 1.5 s: plain, green when
// they lock onto a capture, red where they would crash or leave the map).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BoxGeometry, Color, ConeGeometry, DoubleSide, InstancedMesh, Material, MeshBasicMaterial, Object3D, RingGeometry, SphereGeometry, TorusGeometry, type BufferGeometry, type Matrix4 } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, CRATE_W, DEBRIS_W, GLB_SIZE, ORB_H, PANEL_W, POD_W } from "./assets";
import { LOOKS, COLORS } from "./look";
import {
   DEBRIS_R,
   GATE,
   NONE,
   WARDEN_PLAY,
   beltActive,
   beltGapAngle,
   bodyAt,
   bossAlive,
   bossPhase,
   bossVulnerable,
   createArcResult,
   debrisAt,
   flareOn,
   launchVelocity,
   predictArc,
   thrusterAngle,
   ventAngle,
   type PodRun,
} from "./rules";

const DUMMY = new Object3D();
const WHITE = new Color("#ffffff");
const B = { x: 0, y: 0, vx: 0, vy: 0 };
const P = { x: 0, y: 0 };

function put(x: number, y: number, z: number, sx: number, sy: number, sz: number, rz = 0, ry = 0, rx = 0): Object3D {
   DUMMY.position.set(x, y, z);
   DUMMY.rotation.set(rx, ry, rz, "ZYX");
   DUMMY.scale.set(sx, sy, sz);
   DUMMY.updateMatrix();
   return DUMMY;
}

function Pool({ geometry, material, count, update, tinted = false }: { geometry: BufferGeometry; material: Material; count: number; update: (i: number, color: Color) => Object3D | false; tinted?: boolean }) {
   const ref = useRef<InstancedMesh>(null);
   const color = useMemo(() => new Color(), []);
   useEffect(() => {
      const m = ref.current;
      if (!m || !tinted) return;
      for (let i = 0; i < count; i++) m.setColorAt(i, WHITE);
   }, [count, tinted]);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      let n = 0;
      for (let i = 0; i < count; i++) {
         color.copy(WHITE);
         const o = update(i, color);
         if (o === false) continue;
         m.setMatrixAt(n, o.matrix);
         if (tinted) m.setColorAt(n, color);
         n++;
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (tinted && m.instanceColor) m.instanceColor.needsUpdate = true;
   });
   return <instancedMesh ref={ref} args={[geometry, material, Math.max(1, count)]} frustumCulled={false} />;
}

const ARC_DOTS = 40;

export function Course({ run, offsetX = 0 }: { run: PodRun; offsetX?: number }) {
   const c = run.course;
   const look = LOOKS[c.level];
   const time = useGameTime();
   const mats = useMemo(
      () => ({
         halo: new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.75, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
         soi: new MeshBasicMaterial({ color: look.grid, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false, side: DoubleSide }),
         glow: new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
         flare: new MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, toneMapped: false, side: DoubleSide }),
         dot: new MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
         capture: new MeshBasicMaterial({ color: COLORS.capture, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
      }),
      [look],
   );
   useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
   const geos = useMemo(
      () => ({
         halo: new TorusGeometry(1, 0.04, 6, 64),
         soi: new RingGeometry(0.985, 1, 72, 1),
         seg: new BoxGeometry(1, 1, 1),
         disc: new RingGeometry(0, 1, 40),
         outline: new RingGeometry(0.92, 1, 40),
         dot: new SphereGeometry(0.09, 6, 4),
         vent: new SphereGeometry(0.35, 10, 8),
         cone: new ConeGeometry(0.5, 1.4, 10, 1, true),
         ring: new TorusGeometry(1, 0.1, 8, 40),
      }),
      [],
   );
   useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
   const haloOff = useMemo(() => new Color(look.halo), [look]);
   const haloOn = useMemo(() => new Color(look.haloLit), [look]);
   const rocks = useMemo(() => c.bodies.filter((b) => b.kind === "rock").map((b) => b.index), [c]);
   const moons = useMemo(() => c.bodies.filter((b) => b.kind === "moon").map((b) => b.index), [c]);
   const pods = useMemo(() => c.bodies.flatMap((b) => b.pods.map((a) => ({ body: b.index, angle: a }))), [c]);
   const arc = useMemo(() => ({ pts: new Float32Array(ARC_DOTS * 2), n: 0, kind: 0, res: createArcResult(), v: { x: 0, y: 0 } }), []);

   // the trajectory preview: in flight from the hero; while charging a pod from the launch it would give
   useFrame(() => {
      const h = run.hero;
      arc.n = 0;
      if (h.chordFrom !== NONE || run.ended !== null) return;
      if (!h.grounded) {
         arc.n = predictArc(run, h.x, h.y, h.vx, h.vy, run.simMs, 1500, arc.pts, arc.res, null, 5, run.simMs - h.leftAt < 40 ? h.leftBody : NONE);
      } else if (h.pod !== NONE) {
         launchVelocity(run, h.chargeMs, run.held.moveX, arc.v);
         const b = c.bodies[h.body];
         bodyAt(c, h.body, run.simMs, B);
         const nx = Math.cos(h.angle);
         const ny = Math.sin(h.angle);
         arc.n = predictArc(run, B.x + b.R * nx, B.y + b.R * ny, arc.v.x, arc.v.y, run.simMs, 1500, arc.pts, arc.res, null, 5, h.body);
      }
      arc.kind = arc.res.kind;
   });

   const bodyScale = (R: number, glb: { x: number; y: number; z: number }) => (2 * R) / ((glb.x + glb.y + glb.z) / 3);

   return (
      <group>
         {/* planetoids */}
         <DynamicInstancedModel
            asset={ASSETS.planetoid}
            count={Math.max(1, rocks.length)}
            update={(i, m: Matrix4) => {
               if (i >= rocks.length) return false;
               const b = c.bodies[rocks[i]];
               const s = bodyScale(b.R, GLB_SIZE.planetoid);
               DUMMY.position.set(offsetX + b.x, b.y - (GLB_SIZE.planetoid.y * s) / 2, 0);
               DUMMY.rotation.set(0, b.index * 1.3 + time.now * 0.05, 0);
               DUMMY.scale.setScalar(s);
               DUMMY.updateMatrix();
               m.copy(DUMMY.matrix);
            }}
         />
         {/* moons on their orbits */}
         <DynamicInstancedModel
            asset={ASSETS.asteroid}
            count={Math.max(1, moons.length)}
            update={(i, m: Matrix4) => {
               if (i >= moons.length) return false;
               const b = c.bodies[moons[i]];
               bodyAt(c, b.index, run.simMs, B);
               const s = bodyScale(b.R, GLB_SIZE.asteroid);
               DUMMY.position.set(offsetX + B.x, B.y - (GLB_SIZE.asteroid.y * s) / 2, 0);
               DUMMY.rotation.set(0.3, time.now * 0.4 + i, 0);
               DUMMY.scale.setScalar(s);
               DUMMY.updateMatrix();
               m.copy(DUMMY.matrix);
            }}
         />
         {/* the Orbit Warden (level 5) */}
         {c.warden >= 0 ? <Warden run={run} offsetX={offsetX} geos={geos} mats={mats} /> : null}
         {/* halos (the restore) and the SOI rings */}
         <Pool
            geometry={geos.halo}
            material={mats.halo}
            count={c.bodies.length}
            tinted
            update={(i, color) => {
               const b = c.bodies[i];
               bodyAt(c, i, run.simMs, B);
               color.copy(run.captured[i] ? haloOn : haloOff);
               const r = b.R + 0.12;
               return put(offsetX + B.x, B.y, 0, r, r, r);
            }}
         />
         <Pool
            geometry={geos.soi}
            material={mats.soi}
            count={c.bodies.length}
            update={(i) => {
               const b = c.bodies[i];
               bodyAt(c, i, run.simMs, B);
               const k = run.hero.dom === i && !run.hero.grounded ? 1.0 : 1;
               return put(offsetX + B.x, B.y, -0.05, b.soi * k, b.soi * k, 1);
            }}
         />
         {/* pod cradles (charged: their glow fills up) */}
         <DynamicInstancedModel
            asset={ASSETS.pod}
            count={Math.max(1, pods.length)}
            update={(i, m: Matrix4) => {
               if (i >= pods.length) return false;
               const p = pods[i];
               const b = c.bodies[p.body];
               bodyAt(c, p.body, run.simMs, B);
               const s = POD_W / GLB_SIZE.pod.x;
               const sx = B.x + (b.R - 0.15) * Math.cos(p.angle);
               const sy = B.y + (b.R - 0.15) * Math.sin(p.angle);
               put(offsetX + sx, sy, 0, s, s, s, p.angle - Math.PI / 2);
               m.copy(DUMMY.matrix);
            }}
         />
         <Pool
            geometry={geos.ring}
            material={mats.glow}
            count={Math.max(1, pods.length)}
            tinted
            update={(i, color) => {
               if (i >= pods.length) return false;
               const p = pods[i];
               const b = c.bodies[p.body];
               const h = run.hero;
               const mine = h.grounded && h.body === p.body && h.pod !== NONE && b.pods[h.pod] === p.angle;
               const k = mine ? h.chargeMs / 800 : 0;
               color.set(COLORS.charge).multiplyScalar(0.35 + 0.65 * k);
               bodyAt(c, p.body, run.simMs, B);
               const r = 0.55 + 0.35 * k + (mine ? 0.05 * Math.sin(time.now * 20) : 0);
               const sx = B.x + (b.R + 0.6) * Math.cos(p.angle);
               const sy = B.y + (b.R + 0.6) * Math.sin(p.angle);
               return put(offsetX + sx, sy, 0, r, r, r, p.angle - Math.PI / 2, 0, Math.PI / 2);
            }}
         />
         {/* orbs */}
         <DynamicInstancedModel
            asset={ASSETS.orb}
            count={Math.max(1, c.orbs.length)}
            update={(i, m: Matrix4) => {
               if (i >= c.orbs.length || run.collected[i]) return false;
               const o = c.orbs[i];
               const s = (ORB_H / GLB_SIZE.orb.y) * (o.kind === "bonus" ? 0.8 : 1);
               const bob = Math.sin(time.now * 2.4 + i) * 0.08;
               put(offsetX + o.x, o.y - (GLB_SIZE.orb.y * s) / 2 + bob, 0, s, s, s, 0, time.now * 1.6 + i);
               m.copy(DUMMY.matrix);
            }}
         />
         {/* slingshot gates: solid when the hero is fast enough, segmented when not */}
         {c.gates.length > 0 ? (
            <>
               <Pool
                  geometry={geos.ring}
                  material={mats.glow}
                  count={c.gates.length}
                  tinted
                  update={(i, color) => {
                     const g = c.gates[i];
                     const fast = Math.hypot(run.hero.vx, run.hero.vy) >= GATE.speed;
                     if (!fast && !run.gateDone[i]) return false;
                     color.set(run.gateDone[i] ? look.haloLit : COLORS.arcLock);
                     const r = GATE.r * (1 + 0.05 * Math.sin(time.now * 6));
                     return put(offsetX + g.x, g.y, 0, r, r, r);
                  }}
               />
               <Pool
                  geometry={geos.seg}
                  material={mats.glow}
                  count={c.gates.length * 8}
                  tinted
                  update={(i, color) => {
                     const gi = Math.floor(i / 8);
                     const k = i % 8;
                     const g = c.gates[gi];
                     const fast = Math.hypot(run.hero.vx, run.hero.vy) >= GATE.speed;
                     if (fast || run.gateDone[gi]) return false;
                     color.set("#9aa0b8");
                     const a = (k / 8) * Math.PI * 2;
                     return put(offsetX + g.x + GATE.r * Math.cos(a), g.y + GATE.r * Math.sin(a), 0, 0.5, 0.18, 0.18, a + Math.PI / 2);
                  }}
               />
            </>
         ) : null}
         {/* solar flares: a filled disc while burning, an outline while not */}
         {c.flares.length > 0 ? (
            <>
               <Pool
                  geometry={geos.disc}
                  material={mats.flare}
                  count={c.flares.length}
                  update={(i) => {
                     const f = c.flares[i];
                     if (!flareOn(f, run.simMs)) return false;
                     const r = f.r * (1 + 0.04 * Math.sin(time.now * 14 + i));
                     return put(offsetX + f.x, f.y, 0.1, r, r, 1);
                  }}
               />
               <Pool
                  geometry={geos.outline}
                  material={mats.flare}
                  count={c.flares.length}
                  update={(i) => {
                     const f = c.flares[i];
                     return put(offsetX + f.x, f.y, 0.1, f.r, f.r, 1);
                  }}
               />
            </>
         ) : null}
         {/* debris shards */}
         {c.debris.length > 0 ? (
            <DynamicInstancedModel
               asset={ASSETS.asteroid}
               count={c.debris.length}
               update={(i, m: Matrix4) => {
                  debrisAt(c, i, run.simMs, P);
                  const s = (DEBRIS_W / GLB_SIZE.asteroid.x) * (DEBRIS_R / 1);
                  put(offsetX + P.x, P.y - (GLB_SIZE.asteroid.y * s) / 2, 0, s, s, s, time.now + i, time.now * 0.7);
                  m.copy(DUMMY.matrix);
               }}
            />
         ) : null}
         {/* Riko's cracked panels */}
         {c.panels.length > 0 ? (
            <DynamicInstancedModel
               asset={ASSETS.panel}
               count={c.panels.length}
               update={(i, m: Matrix4) => {
                  if (run.panelBroken[i]) return false;
                  const q = c.panels[i];
                  const s = PANEL_W / GLB_SIZE.panel.x;
                  put(offsetX + q.x, q.y, 0, s, s, s, 0, 0, Math.PI / 2);
                  m.copy(DUMMY.matrix);
               }}
            />
         ) : null}
         {/* level 4's push-off crates */}
         {c.crates.length > 0 ? (
            <DynamicInstancedModel
               asset={ASSETS.crate}
               count={c.crates.length}
               update={(i, m: Matrix4) => {
                  const s = CRATE_W / GLB_SIZE.crate.x;
                  put(offsetX + run.crateX[i], run.crateY[i] - (GLB_SIZE.crate.y * s) / 2, 0, s, s, s, time.now * 0.3 + i, time.now * 0.2);
                  m.copy(DUMMY.matrix);
               }}
            />
         ) : null}
         {/* the dock: the station deck, its arm, the beacon and the capture ring */}
         <DynamicInstancedModel
            asset={ASSETS.deck}
            count={1}
            update={(_i, m: Matrix4) => {
               const s = 3.6 / GLB_SIZE.deck.x;
               put(offsetX + c.dock.x, c.dock.y - 1.2, 0, s, s * 2, s);
               m.copy(DUMMY.matrix);
            }}
         />
         <DynamicInstancedModel
            asset={ASSETS.arm}
            count={1}
            update={(_i, m: Matrix4) => {
               const s = 2.4 / GLB_SIZE.arm.y;
               put(offsetX + c.dock.x + 1.6, c.dock.y - 1.0, 0, s, s, s);
               m.copy(DUMMY.matrix);
            }}
         />
         <DynamicInstancedModel
            asset={ASSETS.beacon}
            count={1}
            update={(_i, m: Matrix4) => {
               const s = 1.6 / GLB_SIZE.beacon.y;
               put(offsetX + c.dock.x - 1.2, c.dock.y - 1.0, 0, s, s, s, 0, time.now);
               m.copy(DUMMY.matrix);
            }}
         />
         <Pool
            geometry={geos.ring}
            material={mats.capture}
            count={1}
            update={() => {
               const r = c.dock.r * (1 + 0.03 * Math.sin(time.now * 3));
               if (bossAlive(run)) return false;
               return put(offsetX + c.dock.x, c.dock.y, 0, r, r, r * 0.3);
            }}
         />
         {/* the trajectory preview */}
         <Pool
            geometry={geos.dot}
            material={mats.dot}
            count={ARC_DOTS}
            tinted
            update={(i, color) => {
               if (i >= arc.n) return false;
               const k = arc.kind;
               color.set(k === 1 || k === 4 ? COLORS.arcLock : k === 2 || k === 3 ? COLORS.arcBad : COLORS.arc);
               const s = 1 - (i / ARC_DOTS) * 0.6;
               return put(offsetX + arc.pts[i * 2], arc.pts[i * 2 + 1], 0.2, s, s, s);
            }}
         />
      </group>
   );
}

/** Level 5: the Orbit Warden, its vents, thruster, belt and mines. */
function Warden({ run, offsetX, geos, mats }: { run: PodRun; offsetX: number; geos: Record<string, BufferGeometry>; mats: Record<string, Material> }) {
   const c = run.course;
   const time = useGameTime();
   const w = c.bodies[c.warden];
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.warden}
            count={1}
            update={(_i, m: Matrix4) => {
               const b = run.boss!;
               const s = (2 * w.R) / ((GLB_SIZE.warden.x + GLB_SIZE.warden.y + GLB_SIZE.warden.z) / 3);
               const flash = b && b.flashMs > 0 ? 1.04 : 1;
               const spin = (WARDEN_PLAY.spin * run.simMs) / 1000;
               put(offsetX + w.x, w.y - (GLB_SIZE.warden.y * s * flash) / 2, 0, s * flash, s * flash, s * flash, 0, spin);
               m.copy(DUMMY.matrix);
            }}
         />
         <Pool
            geometry={geos.vent}
            material={mats.glow}
            count={3}
            tinted
            update={(k, color) => {
               if (!run.bossOn || !bossAlive(run) || bossPhase(run) !== 0) return false;
               const a = ventAngle(k, run.simMs);
               color.set(run.ventUsed[k] ? "#3a2a4a" : "#c77dff");
               const s = run.ventUsed[k] ? 0.8 : 1 + 0.2 * Math.sin(time.now * 8 + k);
               return put(offsetX + w.x + (w.R + 0.1) * Math.cos(a), w.y + (w.R + 0.1) * Math.sin(a), 0, s, s, s);
            }}
         />
         <Pool
            geometry={geos.cone}
            material={mats.flare}
            count={1}
            update={() => {
               if (!run.bossOn || bossPhase(run) !== 1 || !bossAlive(run)) return false;
               const a = thrusterAngle(run, run.simMs);
               const f = 1 + 0.15 * Math.sin(time.now * 25);
               return put(offsetX + w.x + (w.R + 0.5) * Math.cos(a), w.y + (w.R + 0.5) * Math.sin(a), 0, f, f, f, a - Math.PI / 2);
            }}
         />
         <Pool
            geometry={geos.seg}
            material={mats.glow}
            count={40}
            tinted
            update={(i, color) => {
               if (!beltActive(run)) return false;
               const a = (i / 40) * Math.PI * 2 + (2 * Math.PI * run.simMs) / WARDEN_PLAY.beltPeriodMs;
               const gap = beltGapAngle(run.simMs);
               let d = (a - gap) % (2 * Math.PI);
               if (d > Math.PI) d -= 2 * Math.PI;
               if (d < -Math.PI) d += 2 * Math.PI;
               if (Math.abs(d) <= WARDEN_PLAY.beltGapHalf) return false;
               const r = w.R * WARDEN_PLAY.beltK;
               color.set("#8a86a0");
               return put(offsetX + w.x + r * Math.cos(a), w.y + r * Math.sin(a), 0, 0.7, 0.45, 0.45, a + time.now);
            }}
         />
         <DynamicInstancedModel
            asset={ASSETS.buoy}
            count={1}
            update={(_i, m: Matrix4) => {
               if (!(run.simMs < run.mineUntil)) return false;
               const s = 1.2 / GLB_SIZE.buoy.y;
               put(offsetX + run.mineX, run.mineY - 0.6, 0, s, s, s, 0, time.now * 2);
               m.copy(DUMMY.matrix);
            }}
         />
         <Pool
            geometry={geos.halo}
            material={mats.halo}
            count={1}
            tinted
            update={(_i, color) => {
               if (!run.bossOn || !bossVulnerable(run)) return false;
               color.set("#ff7ae6");
               const r = w.R + 0.6 + 0.1 * Math.sin(time.now * 8);
               return put(offsetX + w.x, w.y, 0, r, r, r);
            }}
         />
      </>
   );
}
