"use client";

// The arena: the round stone floor and its rim, the lane lines, the portals (the launcher portal GLB) on
// the rim, the zone plates tinted in their colours with a glowing ring and a shield pedestal behind each
// (the shield rises in the zone's colour while a hero stands on it), the pillars between the lanes (one
// carries the hidden beacon), the dome beacon in the middle (it dims as it loses hit points), the orbs
// (the energy orb GLB recoloured every frame; a blinking orb flickers; the Mortar's core orbs are golden
// orb blobs), the drone on the middle ring and the hero's spawn pad. Visual only.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, Color, Euler, Matrix4, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS, GLB_SIZE, fit } from "./assets";
import { COLORS, levelLook } from "./look";
import { ORB_Y, PALETTE, R_ARENA, R_CORE, R_DRONE, R_PORTAL, ZONE_R, orbColor } from "./arena";
import { CORE_HP } from "./progression";
import { dronePos, type DefenseRun } from "./rules";

const PAL = PALETTE.map((p) => new Color(p.hex));
const GOLD = new Color(COLORS.golden);
const M = new Matrix4();
const P = new Vector3();
const S = new Vector3();
const Q = new Quaternion();
const E = new Euler();

function place(m: Matrix4, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY = 0): Matrix4 {
   E.set(0, rotY, 0);
   Q.setFromEuler(E);
   P.set(x, y, z);
   S.set(sx, sy, sz);
   return m.compose(P, Q, S);
}

function floorTexture(): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = c.height = 256;
   const g = c.getContext("2d")!;
   g.fillStyle = COLORS.floor;
   g.fillRect(0, 0, 256, 256);
   g.strokeStyle = COLORS.floorDark;
   g.lineWidth = 3;
   for (let y = 0; y < 256; y += 64) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(256, y);
      g.stroke();
      for (let x = (y / 64) % 2 ? 32 : 0; x < 256; x += 64) {
         g.beginPath();
         g.moveTo(x, y);
         g.lineTo(x, y + 64);
         g.stroke();
      }
   }
   const t = new CanvasTexture(c);
   t.wrapS = t.wrapT = RepeatWrapping;
   t.repeat.set(6, 6);
   t.colorSpace = SRGBColorSpace;
   return t;
}

export default function ArenaView({ run, level }: { run: DefenseRun; level: LevelId }) {
   const A = run.arena;
   const time = useGameTime();
   const look = levelLook(level);
   const floor = useMemo(floorTexture, []);
   const rings = useRef<(Mesh | null)[]>([]);
   const shields = useRef<(Mesh | null)[]>([]);
   const core = useRef<Mesh>(null);
   const drone = useRef<Group>(null);
   const beacon = useRef<Mesh>(null);
   const color = useMemo(() => new Color(), []);

   const portalSpots = useMemo<InstanceSpot[]>(
      () => A.lanes.map((l) => ({ x: l.dx * R_PORTAL, y: 0, z: l.dz * R_PORTAL, scale: fit(GLB_SIZE.portal.y, 3.2), rotY: Math.atan2(-l.dx, -l.dz) })),
      [A],
   );
   const pillarSpots = useMemo<InstanceSpot[]>(() => A.pillars.map((p) => ({ x: p.x, y: 0, z: p.z, scale: fit(GLB_SIZE.pillar.y, 2.4) })), [A]);
   const pedestalSpots = useMemo<InstanceSpot[]>(
      () =>
         A.zones.map((z) => {
            const l = A.lanes[z.lane];
            // beside the zone, off the lane line, so it never hides the orb
            const sx = -l.dz;
            const sz = l.dx;
            return { x: z.x + sx * (ZONE_R + 0.5), y: 0, z: z.z + sz * (ZONE_R + 0.5), scale: fit(GLB_SIZE.pedestal.y, 1.1) };
         }),
      [A],
   );
   const laneSpots = useMemo<InstanceSpot[]>(
      () => A.lanes.map((l) => ({ x: (l.dx * (R_ARENA + R_CORE)) / 2, y: 0.02, z: (l.dz * (R_ARENA + R_CORE)) / 2, sx: 0.12, sy: 0.02, sz: R_ARENA - R_CORE, rotY: Math.atan2(l.dx, l.dz) })),
      [A],
   );
   const wallSpots = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      const n = 28;
      for (let i = 0; i < n; i++) {
         const a = (i / n) * Math.PI * 2;
         // gaps for the portals
         if (A.lanes.some((l) => Math.abs(Math.atan2(Math.sin(a - l.angle), Math.cos(a - l.angle))) < 0.16)) continue;
         out.push({ x: Math.cos(a) * (R_ARENA + 0.4), y: -0.1, z: -Math.sin(a) * (R_ARENA + 0.4), sx: fit(GLB_SIZE.wall.x, 2.9), sy: fit(GLB_SIZE.wall.y, 1.0), sz: fit(GLB_SIZE.wall.z, 0.6), rotY: a + Math.PI / 2 });
      }
      return out;
   }, [A]);

   const updateZone = useMemo(
      () => (i: number, m: Matrix4, c: Color) => {
         const z = A.zones[i];
         if (!z) return false;
         place(m, z.x, 0.01, z.z, fit(GLB_SIZE.zone.x, ZONE_R * 2), 1, fit(GLB_SIZE.zone.z, ZONE_R * 2));
         c.copy(PAL[z.color]);
      },
      [A],
   );
   const updateOrb = useMemo(
      () => (i: number, m: Matrix4, c: Color) => {
         const o = run.orbs[i];
         if (!o || !o.live || o.core) return false;
         const l = A.lanes[o.lane];
         const s = fit(GLB_SIZE.orb.y, 0.95);
         place(m, l.dx * o.r, ORB_Y - 0.47 + Math.sin(time.now * 6 + i) * 0.05, l.dz * o.r, s, s, s, time.now * 2);
         const cc = orbColor(o.color, o.alt, o.periodMs, run.simMs - o.bornMs);
         c.copy(PAL[cc]);
         if (o.periodMs) c.multiplyScalar(0.8 + 0.4 * Math.abs(Math.sin(time.now * 9)));
      },
      [A, run, time],
   );
   const updateCoreOrb = useMemo(
      () => (i: number, m: Matrix4, c: Color) => {
         let k = -1;
         for (const o of run.orbs) {
            if (!o.live || !o.core) continue;
            if (++k !== i) continue;
            const l = A.lanes[o.lane];
            const s = fit(GLB_SIZE.blob.y, 1.3);
            const lob = Math.max(0, Math.sin(((R_PORTAL - o.r) / (R_PORTAL - R_CORE)) * Math.PI)) * 2.5;
            place(m, l.dx * o.r, ORB_Y - 0.6 + lob, l.dz * o.r, s, s, s, time.now * 3);
            const cc = orbColor(o.color, o.alt, o.periodMs, run.simMs - o.bornMs);
            c.copy(PAL[cc]).lerp(GOLD, 0.25);
            return;
         }
         return false;
      },
      [A, run, time],
   );

   useFrame(() => {
      const t = time.now;
      for (let i = 0; i < A.zones.length; i++) {
         const on = run.hero.zone === i || run.partners.some((p) => p.hero.zone === i);
         const r = rings.current[i];
         if (r) {
            const mat = r.material as MeshStandardMaterial;
            mat.emissiveIntensity = on ? 1.6 : 0.5 + 0.2 * Math.sin(t * 3 + i);
         }
         const s = shields.current[i];
         if (s) {
            s.visible = on;
            s.scale.set(1, 0.9 + 0.1 * Math.sin(t * 12), 1);
         }
      }
      if (core.current) {
         const mat = core.current.material as MeshStandardMaterial;
         const hp = run.shared.coreHp / CORE_HP;
         color.set(COLORS.core).lerp(new Color(COLORS.coreHurt), 1 - hp);
         mat.color.copy(color);
         mat.emissive.copy(color);
         mat.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 2) + (run.shieldUntil >= run.simMs ? 1 : 0);
      }
      const d = drone.current;
      if (d) {
         d.visible = run.level >= 2;
         const p = dronePos(run, DP);
         d.position.set(p.x, 0.45, p.z);
         d.rotation.y = t * 6;
      }
      if (beacon.current) {
         beacon.current.visible = !run.secrets.found[2];
         beacon.current.rotation.y = t * 1.4;
      }
   });

   return (
      <group>
         {/* the floor and the rim */}
         <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <circleGeometry args={[R_ARENA + 1, 64]} />
            <meshStandardMaterial map={floor} roughness={0.8} />
         </mesh>
         <mesh position={[0, -1.5, 0]}>
            <cylinderGeometry args={[R_ARENA + 1, R_ARENA - 2, 3, 48, 1, true]} />
            <meshStandardMaterial color={COLORS.floorDark} roughness={0.9} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 0]}>
            <ringGeometry args={[R_DRONE - 0.08, R_DRONE + 0.08, 64]} />
            <meshBasicMaterial color={look.glow} transparent opacity={run.level >= 2 ? 0.6 : 0} toneMapped={false} />
         </mesh>
         <Instanced spots={laneSpots}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={COLORS.lane} />
         </Instanced>
         <InstancedModel asset={ASSETS.wall} spots={wallSpots} fallback={<Instanced spots={wallSpots}><boxGeometry args={[1.9, 0.94, 0.39]} /><meshStandardMaterial color="#94a3b8" /></Instanced>} />
         <InstancedModel asset={ASSETS.portal} spots={portalSpots} fallback={<Instanced spots={portalSpots}><boxGeometry args={[1.4, 1.9, 0.6]} /><meshStandardMaterial color="#6366f1" /></Instanced>} />
         <InstancedModel asset={ASSETS.pillar} spots={pillarSpots} fallback={<Instanced spots={pillarSpots}><cylinderGeometry args={[0.4, 0.4, 1.9, 12]} /><meshStandardMaterial color="#cbd5e1" /></Instanced>} />
         <InstancedModel asset={ASSETS.pedestal} spots={pedestalSpots} fallback={<Instanced spots={pedestalSpots}><cylinderGeometry args={[0.5, 0.6, 1.9, 12]} /><meshStandardMaterial color="#e2e8f0" /></Instanced>} />
         <InstancedModel
            asset={ASSETS.spawnPad}
            spots={SPAWN}
            fallback={<Instanced spots={SPAWN}><cylinderGeometry args={[0.9, 0.9, 0.18, 24]} /><meshStandardMaterial color="#38bdf8" /></Instanced>}
         />
         {/* the zones: tinted plates, a glowing ring, the shield when someone stands there */}
         <DynamicInstancedModel asset={ASSETS.zone} count={A.zones.length} update={updateZone} tinted />
         {A.zones.map((z, i) => (
            <group key={i} position={[z.x, 0, z.z]}>
               <mesh ref={(m) => { rings.current[i] = m; }} rotation-x={-Math.PI / 2} position={[0, 0.13, 0]}>
                  <ringGeometry args={[ZONE_R - 0.12, ZONE_R + 0.05, 40]} />
                  <meshStandardMaterial color={PALETTE[z.color].hex} emissive={PALETTE[z.color].hex} emissiveIntensity={0.6} toneMapped={false} />
               </mesh>
               <mesh ref={(m) => { shields.current[i] = m; }} position={[0, 1.1, 0]} visible={false}>
                  <cylinderGeometry args={[ZONE_R, ZONE_R, 2.2, 32, 1, true]} />
                  <meshStandardMaterial color={PALETTE[z.color].hex} emissive={PALETTE[z.color].hex} emissiveIntensity={0.9} transparent opacity={0.28} depthWrite={false} toneMapped={false} />
               </mesh>
            </group>
         ))}
         {/* the beacon */}
         <InstancedModel asset={ASSETS.beacon} spots={BEACON} fallback={<Instanced spots={BEACON}><cylinderGeometry args={[0.6, 0.8, 1.9, 16]} /><meshStandardMaterial color="#38bdf8" /></Instanced>} />
         <mesh ref={core} position={[0, 3.6, 0]}>
            <sphereGeometry args={[0.7, 24, 16]} />
            <meshStandardMaterial transparent opacity={0.75} toneMapped={false} />
         </mesh>
         {/* orbs */}
         <DynamicInstancedModel asset={ASSETS.orb} count={64} update={updateOrb} tinted />
         {A.boss ? <DynamicInstancedModel asset={ASSETS.blob} count={4} update={updateCoreOrb} tinted /> : null}
         {/* the drone */}
         <group ref={drone} visible={false}>
            <mesh castShadow>
               <torusGeometry args={[0.65, 0.18, 10, 24]} />
               <meshStandardMaterial color={COLORS.drone} emissive={COLORS.drone} emissiveIntensity={0.7} metalness={0.4} />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
               <sphereGeometry args={[0.35, 16, 12]} />
               <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.3} />
            </mesh>
         </group>
         {/* the hidden beacon over a pillar */}
         <mesh ref={beacon} position={[A.beacon.x, A.beacon.y, A.beacon.z]}>
            <octahedronGeometry args={[0.38, 0]} />
            <meshStandardMaterial color="#e0f2fe" emissive="#7dd3fc" emissiveIntensity={1.4} toneMapped={false} />
         </mesh>
      </group>
   );
}

const DP = { x: 0, z: 0 };
const SPAWN: InstanceSpot[] = [{ x: 0, y: 0.005, z: 5.2, scale: 1.1 }];
const BEACON: InstanceSpot[] = [{ x: 0, y: 0, z: 0, sx: fit(GLB_SIZE.beacon.x, 3.6), sy: fit(GLB_SIZE.beacon.y, 4.2), sz: fit(GLB_SIZE.beacon.z, 3.6) }];
