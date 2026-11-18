"use client";

// The arena as the rules see it (rules.ts Arena): the colour floor (m2SurvivalFloorTile, the card's
// "recolorable floor tile": one instanced pool, tinted per tile at runtime), each colour's symbol on its tiles
// (five instanced decals: circle, square, triangle, star, diamond, so the floor reads without hue), the
// stone rim, the arena's colour beacon (m2ColorBeacon) crowned with the called colour, the orb, the gap
// shard, the safe marker (m2SafeMarker) where a fallen hero comes back, the sweeper bar
// (menu2/props SweeperBar, level 4), the Keeper's tile beacon and the shock ring (level 5).
// Readability: the called tiles pulse; over the last second of a call the wrong tiles fade dark and
// blink; a cracked tile shakes darker; a swapping tile blinks between its two colours.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, CircleGeometry, Color, ExtrudeGeometry, Matrix4, Shape, Vector3, type BufferGeometry, type Group, type InstancedMesh, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { SweeperBar } from "@/arcade3d/menu2/props";
import { keeperHome } from "./Keeper";
import { ASSETS, BEACON_H, GLB_SIZE, ORB_SIZE, SAFE_W, TILE_BEACON_H, TILE_DRAWN_H } from "./assets";
import { COLORS, SYMBOLS, TILE_COLORS, TILE_GLOWS, levelLook } from "./look";
import { BAR_INNER, GAP_Y, ORB_Y, RAINBOW, SWAP_WARN_MS, TILE_W, WARN_MS, safeTile, tileCentre, tileSafe, tileSink, type Arena, type ArenaRun } from "./rules";

const SINK_DEPTH = 9;
const m4 = new Matrix4();
const v3 = new Vector3();
const col = new Color();
const pt = { x: 0, z: 0 };

/** Where tile i's top stands now (m) and how far it shakes (the scene's own reading of the rules). */
export function tileTop(a: Arena, i: number): number {
   return -tileSink(a, i) * SINK_DEPTH;
}

/** The colour a tile is drawn in this frame (pure; ArenaView and its test). */
export function tileLook(a: Arena, i: number, now: number, out: Color): Color {
   if (a.phase === "start" || a.phase === "wait") return out.set(COLORS.stone);
   const c = a.colour[i];
   if (c === RAINBOW) return out.setHSL((now * 0.35 + i * 0.07) % 1, 0.85, 0.62);
   out.set(TILE_COLORS[c]);
   if (a.phase === "call") {
      const s = a.swapTiles.indexOf(i);
      if (s >= 0 && !a.swapDone && a.phaseMs >= a.swapAt - SWAP_WARN_MS && Math.floor(now * 8) % 2 === 0) out.set(TILE_COLORS[a.swapTo[s]]);
      if (a.crack[i]) out.multiplyScalar(0.5 + 0.15 * Math.sin(now * 20));
      else if (tileSafe(a, i)) out.multiplyScalar(1.12 + 0.12 * Math.sin(now * 6));
      else if (a.phaseMs >= a.callLen - WARN_MS) {
         const k = Math.min(1, (a.phaseMs - (a.callLen - WARN_MS)) / WARN_MS);
         out.multiplyScalar(1 - 0.65 * k * (Math.floor(now * 10) % 2 === 0 ? 1 : 0.8));
      }
   } else if (a.drop[i]) out.multiplyScalar(0.3);
   return out;
}

function starShape(): Shape {
   const s = new Shape();
   for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? 0.5 : 0.22;
      const t = (k / 10) * Math.PI * 2 + Math.PI / 2;
      if (k === 0) s.moveTo(Math.cos(t) * r, Math.sin(t) * r);
      else s.lineTo(Math.cos(t) * r, Math.sin(t) * r);
   }
   return s;
}

/** The five symbol geometries, lying flat (xz), about 1 m across. */
function symbolGeometries(): BufferGeometry[] {
   const flat = (g: BufferGeometry) => g.rotateX(-Math.PI / 2);
   const ring = new CircleGeometry(0.42, 28);
   const square = new CircleGeometry(0.48, 4).rotateZ(Math.PI / 4);
   const tri = new CircleGeometry(0.52, 3).rotateZ(Math.PI / 2);
   const star = new ExtrudeGeometry(starShape(), { depth: 0.01, bevelEnabled: false });
   const diamond = new CircleGeometry(0.52, 4).scale(0.75, 1, 1);
   return [flat(ring), flat(square), flat(tri), flat(star), flat(diamond)];
}

function Floor({ a }: { a: Arena }) {
   const symbols = useRef<(InstancedMesh | null)[]>([]);
   const time = useGameTime();
   const count = a.n * a.n;
   const symGeos = useMemo(symbolGeometries, []);
   const sx = TILE_W / GLB_SIZE.tile.x;
   const sy = TILE_DRAWN_H / GLB_SIZE.tile.y;
   const sz = TILE_W / GLB_SIZE.tile.z;
   // the tiles: m2SurvivalFloorTile stretched to the rules' 2 m square, its top on the tile's top, tinted per tile
   const tile = (i: number, m: Matrix4, color?: Color) => {
      if (a.hole[i] === 1) return false;
      const now = time.now;
      tileCentre(a, i, pt);
      const top = tileTop(a, i);
      const shake = a.phase === "call" && a.crack[i] ? Math.sin(now * 40 + i) * 0.03 : 0;
      const lift = a.phase === "call" && tileSafe(a, i) ? 0.03 + 0.03 * Math.sin(now * 6) : 0;
      m.makeScale(sx, sy, sz);
      m.setPosition(pt.x + shake, top - TILE_DRAWN_H + lift, pt.z);
      if (color) tileLook(a, i, now, color);
   };
   useFrame(() => {
      const now = time.now;
      const used = [0, 0, 0, 0, 0];
      const neutral = a.phase === "start" || a.phase === "wait";
      for (let i = 0; i < count; i++) {
         const c = a.colour[i];
         if (a.hole[i] === 1 || neutral || c === RAINBOW) continue;
         const top = tileTop(a, i);
         if (top <= -4) continue;
         const s = symbols.current[c];
         if (!s) continue;
         tileCentre(a, i, pt);
         const shake = a.phase === "call" && a.crack[i] ? Math.sin(now * 40 + i) * 0.03 : 0;
         const lift = a.phase === "call" && tileSafe(a, i) ? 0.03 + 0.03 * Math.sin(now * 6) : 0;
         m4.makeScale(1, 1, 1);
         m4.setPosition(pt.x + shake, top + lift + 0.012, pt.z);
         s.setMatrixAt(used[c]++, m4);
      }
      for (let k = 0; k < 5; k++) {
         const s = symbols.current[k];
         if (!s) continue;
         s.count = used[k];
         s.instanceMatrix.needsUpdate = true;
      }
   });
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.tile} count={count} update={tile} tinted name="tiles" />
         {SYMBOLS.map((id, k) => (
            <instancedMesh
               key={id}
               ref={(el) => {
                  symbols.current[k] = el;
               }}
               args={[symGeos[k], undefined, count]}
               frustumCulled={false}
               renderOrder={1}
            >
               <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} />
            </instancedMesh>
         ))}
      </>
   );
}

/** The stone rim round the floor, with a glowing strip on top and a crystal on each corner. */
function Rim({ a }: { a: Arena }) {
   const look = levelLook(a.level);
   const h = a.half + 0.35;
   const len = a.half * 2 + 1.4;
   const sides: [number, number, number][] = [
      [0, -h, 0],
      [0, h, 0],
      [-h, 0, Math.PI / 2],
      [h, 0, Math.PI / 2],
   ];
   return (
      <>
         {sides.map(([x, z, r], k) => (
            <group key={k} position={[x, -0.45, z]} rotation-y={r}>
               <mesh>
                  <boxGeometry args={[len, 0.9, 0.7]} />
                  <meshStandardMaterial color={COLORS.stoneDark} roughness={0.8} />
               </mesh>
               <mesh position-y={0.46}>
                  <boxGeometry args={[len, 0.04, 0.2]} />
                  <meshBasicMaterial color={look.rim} toneMapped={false} />
               </mesh>
            </group>
         ))}
         {[
            [-h, -h],
            [h, -h],
            [-h, h],
            [h, h],
         ].map(([x, z], k) => (
            <mesh key={k} position={[x, 0.6, z]}>
               <octahedronGeometry args={[0.5, 0]} />
               <meshStandardMaterial color={look.rim} emissive={look.rim} emissiveIntensity={0.7} />
            </mesh>
         ))}
      </>
   );
}

/** The arena's colour beacon at the north edge: the m2ColorBeacon spire, its crown in the called colour. */
function ArenaBeacon({ a }: { a: Arena }) {
   const crown = useRef<Mesh>(null);
   const halo = useRef<Mesh>(null);
   const time = useGameTime();
   const s = BEACON_H / GLB_SIZE.beacon.y;
   const z = -a.half - 2.6;
   useFrame(() => {
      const now = time.now;
      const lit = a.phase === "call" || a.phase === "drop";
      const c = lit ? TILE_GLOWS[a.called] : "#e2e8f0";
      const flicker = a.boss && a.boss.phase === 2 && a.phase === "call" && !a.repaintDone && a.phaseMs > a.repaintAt - 600 ? Math.floor(now * 12) % 2 : 0;
      if (crown.current) {
         const mat = crown.current.material as MeshStandardMaterial;
         mat.color.set(flicker ? "#ffffff" : c);
         mat.emissive.set(flicker ? "#ffffff" : c);
         crown.current.rotation.y = now * 1.2;
         crown.current.position.y = BEACON_H + 0.9 + Math.sin(now * 2) * 0.15;
      }
      if (halo.current) {
         const mat = halo.current.material as MeshBasicMaterial;
         mat.color.set(c);
         const k = a.phase === "call" ? 1 + 0.15 * Math.sin(now * 5) : 0.8;
         halo.current.scale.setScalar(k);
      }
   });
   return (
      <group position={[0, 0, z]}>
         <mesh position-y={-0.6}>
            <cylinderGeometry args={[1.3, 1.6, 1.2, 8]} />
            <meshStandardMaterial color={COLORS.stoneDark} roughness={0.7} />
         </mesh>
         <Model asset={ASSETS.beacon} scale={s} fallback={null} />
         <mesh ref={crown} position-y={BEACON_H + 0.9}>
            <icosahedronGeometry args={[0.75, 0]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.9} roughness={0.2} />
         </mesh>
         <mesh ref={halo} position-y={BEACON_H + 0.9} rotation-x={Math.PI / 2}>
            <torusGeometry args={[1.3, 0.08, 8, 40]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
         </mesh>
      </group>
   );
}

/** The colour orb over its tile (and the gap shard over its hole). */
function Pickups({ a }: { a: Arena }) {
   const orb = useRef<Group>(null);
   const shard = useRef<Mesh>(null);
   const time = useGameTime();
   const s = ORB_SIZE / GLB_SIZE.orb.y;
   useFrame(() => {
      const now = time.now;
      const g = orb.current;
      if (g) {
         g.visible = a.orbLive && a.orbTile >= 0;
         if (g.visible) {
            tileCentre(a, a.orbTile, pt);
            g.position.set(pt.x, ORB_Y - ORB_SIZE / 2 + tileTop(a, a.orbTile) + Math.sin(now * 3) * 0.08, pt.z);
            g.rotation.y = now * 1.5;
         }
      }
      const m = shard.current;
      if (m) {
         m.visible = a.gapLive && a.gapTile >= 0;
         if (m.visible) {
            tileCentre(a, a.gapTile, pt);
            m.position.set(pt.x, GAP_Y + Math.sin(now * 2.4) * 0.1, pt.z);
            m.rotation.y = now * 2;
         }
      }
   });
   return (
      <>
         <group ref={orb} visible={false}>
            <Model asset={ASSETS.orb} scale={s} fallback={null} />
         </group>
         <mesh ref={shard} visible={false}>
            <octahedronGeometry args={[0.32, 0]} />
            <meshStandardMaterial color={COLORS.prism} emissive={COLORS.prism} emissiveIntensity={0.9} />
         </mesh>
      </>
   );
}

/** The safe marker: where a fallen hero comes back (shown while it falls and for a moment after). */
function SafeMarker({ run }: { run: ArenaRun }) {
   const ref = useRef<Group>(null);
   const time = useGameTime();
   useFrame(() => {
      const g = ref.current;
      if (!g) return;
      const a = run.arena;
      let t = -1;
      if (run.hero.state === "fall") t = safeTile(a, run.hero.x, run.hero.z);
      else if (run.simMs - run.respawnAt < 1500) t = run.respawnTile;
      g.visible = t >= 0 && run.ended === null;
      if (!g.visible) return;
      tileCentre(a, t, pt);
      g.position.set(pt.x, tileTop(a, t) + 0.01, pt.z);
      g.rotation.y = time.now * 0.8;
   });
   return (
      <group ref={ref} visible={false}>
         <Model asset={ASSETS.safe} scale={SAFE_W / GLB_SIZE.safe.x} fallback={null} />
         <mesh position-y={0.05} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[SAFE_W * 0.52, SAFE_W * 0.6, 40]} />
            <meshBasicMaterial color={COLORS.safe} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
         </mesh>
      </group>
   );
}

/** Level 4's sweeper bar on its hub pillar. */
function Sweeper({ a }: { a: Arena }) {
   const ref = useRef<Group>(null);
   const reach = a.half + 0.6;
   const len = reach - BAR_INNER;
   useFrame(() => {
      if (ref.current) ref.current.rotation.y = -a.sweepAngle;
   });
   if (a.cfg.sweeper <= 0) return null;
   return (
      <>
         <mesh position-y={0.6}>
            <cylinderGeometry args={[0.45, 0.6, 1.2, 16]} />
            <meshStandardMaterial color={COLORS.stoneDark} roughness={0.6} />
         </mesh>
         <group ref={ref}>
            <SweeperBar position={[BAR_INNER + len / 2, 0.02, 0]} scale={[len / 3, 1, 1]} />
         </group>
      </>
   );
}

/** Level 5: the beacon on its tile and the beam to the Keeper on a hit; the shock ring. */
function KeeperMarks({ a }: { a: Arena }) {
   const beacon = useRef<Group>(null);
   const beam = useRef<Mesh>(null);
   const ring = useRef<Mesh>(null);
   const time = useGameTime();
   const s = TILE_BEACON_H / GLB_SIZE.beacon.y;
   useFrame(() => {
      const g = beacon.current;
      const now = time.now;
      if (g) {
         g.visible = a.beaconTile >= 0 && (a.phase === "call" || a.phase === "drop" || a.phase === "rise");
         if (g.visible) {
            tileCentre(a, a.beaconTile, pt);
            g.position.set(pt.x, tileTop(a, a.beaconTile), pt.z);
            g.rotation.y = now;
         }
      }
      const b = beam.current;
      if (b && a.boss) {
         b.visible = a.boss.flashMs > 0 && a.beaconTile >= 0;
         if (b.visible) {
            tileCentre(a, a.beaconTile, pt);
            const home = keeperHome(a);
            const kx = home.x;
            const ky = home.y + 1.5;
            const kz = home.z;
            const dx = kx - pt.x;
            const dy = ky - 1.6;
            const dz = kz - pt.z;
            const len = Math.hypot(dx, dy, dz);
            b.position.set((pt.x + kx) / 2, (1.6 + ky) / 2, (pt.z + kz) / 2);
            b.scale.set(1, len, 1);
            b.lookAt(kx, ky, kz);
            b.rotateX(Math.PI / 2);
         }
      }
      const r = ring.current;
      if (r) {
         r.visible = a.shockR > 0;
         if (r.visible) r.scale.set(a.shockR, a.shockR, 1);
      }
   });
   if (!a.boss) return null;
   return (
      <>
         <group ref={beacon} visible={false}>
            <Model asset={ASSETS.beacon} scale={s} fallback={null} />
            <mesh position-y={TILE_BEACON_H + 2}>
               <cylinderGeometry args={[0.12, 0.12, 4, 10, 1, true]} />
               <meshBasicMaterial color={COLORS.keeperGlow} transparent opacity={0.4} blending={AdditiveBlending} depthWrite={false} />
            </mesh>
         </group>
         <mesh ref={beam} visible={false}>
            <cylinderGeometry args={[0.18, 0.18, 1, 10, 1, true]} />
            <meshBasicMaterial color={COLORS.keeperGlow} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={ring} visible={false} rotation-x={-Math.PI / 2} position-y={0.35}>
            <ringGeometry args={[0.92, 1, 72]} />
            <meshBasicMaterial color={COLORS.shock} transparent opacity={0.85} side={2} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}

export function ArenaView({ run }: { run: ArenaRun }) {
   const a = run.arena;
   return (
      <>
         <Floor a={a} />
         <Rim a={a} />
         <ArenaBeacon a={a} />
         <Pickups a={a} />
         <SafeMarker run={run} />
         <Sweeper a={a} />
         <KeeperMarks a={a} />
      </>
   );
}
