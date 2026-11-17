"use client";

// The rover: the GLB body on a suspension spring, tilted to the terrain, with code wheels (moving parts)
// over the mesh's own wheels that roll with the distance and steer (front and rear, like a real rover),
// a belly drill that lowers and spins, a mast scanner beam, the carried samples on the deck, headlights on
// dark levels and a soft shadow.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BoxGeometry, CylinderGeometry, MeshStandardMaterial, Object3D, Vector3, type BufferGeometry, type Group, type Mesh, type SpotLight } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Model } from "@/arcade3d/core/assets";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { spring } from "@/arcade3d/core/motion";
import { BlobShadow } from "@/arcade3d/core/render";
import { ASSETS, ROVER_BELLY_Y, ROVER_DECK_Y, ROVER_MAST, ROVER_SCALE, WHEEL } from "./assets";
import type { MarsLevel } from "./levels";
import { COLORS } from "./looks";
import { CarriedPrimitive, RoverPrimitive } from "./Primitives";
import { tiltAt, type HeightFn } from "./terrain";
import type { Run } from "./rules";
import type { Vis } from "./visual";

const MAST = { y: ROVER_MAST.y * ROVER_SCALE, z: ROVER_MAST.z * ROVER_SCALE };
const DECK_Y = ROVER_DECK_Y * ROVER_SCALE;
const BELLY_Y = ROVER_BELLY_Y * ROVER_SCALE;
/** the most a wheel steers (rad) */
const STEER_MAX = 0.5;

/** A tyre with chunky grousers (one geometry) and a hub cap (another), axis along x. */
function useWheelParts() {
   const parts = useMemo(() => {
      const r = WHEEL.radius;
      const w = WHEEL.width;
      const tyre = new CylinderGeometry(r * 0.93, r * 0.93, w, 20).rotateZ(Math.PI / 2);
      const pieces: BufferGeometry[] = [tyre];
      for (let i = 0; i < 14; i++) {
         const a = (i / 14) * Math.PI * 2;
         const g = new BoxGeometry(w * 1.02, r * 0.14, r * 0.26);
         g.translate(0, r * 0.95, 0).rotateX(a);
         pieces.push(g);
      }
      const tread = mergeGeometries(pieces) ?? tyre;
      const hubGeo = mergeGeometries([
         new CylinderGeometry(r * 0.55, r * 0.6, w * 1.06, 16).rotateZ(Math.PI / 2),
         new CylinderGeometry(r * 0.18, r * 0.18, w * 1.18, 10).rotateZ(Math.PI / 2),
         new BoxGeometry(w * 1.1, r * 0.9, r * 0.12),
         new BoxGeometry(w * 1.1, r * 0.12, r * 0.9),
      ]) ?? new CylinderGeometry(r * 0.55, r * 0.6, w * 1.06, 16).rotateZ(Math.PI / 2);
      const rubber = new MeshStandardMaterial({ color: COLORS.roverWheel, roughness: 0.9 });
      const hub = new MeshStandardMaterial({ color: "#d6dde6", roughness: 0.35, metalness: 0.6 });
      for (const p of pieces) if (p !== tyre) p.dispose();
      return { tread, hubGeo, rubber, hub };
   }, []);
   useEffect(
      () => () => {
         parts.tread.dispose();
         parts.hubGeo.dispose();
         parts.rubber.dispose();
         parts.hub.dispose();
      },
      [parts]
   );
   return parts;
}

const TMP = new Vector3();
const TILT = { pitch: 0, roll: 0 };

export function Rover({ run, vis, level, height }: { run: Run; vis: Vis; level: MarsLevel; height: HeightFn }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const steerF = useRef<Group[]>([]);
   const spin = useRef<Group[]>([]);
   const drill = useRef<Group>(null);
   const bit = useRef<Mesh>(null);
   const beam = useRef<Mesh>(null);
   const beamHead = useRef<Group>(null);
   const deck = useRef<Group[]>([]);
   const fly = useRef<Group>(null);
   const lights = useRef<SpotLight[]>([]);
   const lightTarget = useMemo(() => new Object3D(), []);
   const wheel = useWheelParts();
   const last = useRef({ x: run.rover.x, z: run.rover.z, turn: 0 }).current;
   const slots = useMemo(() => Array.from({ length: Math.min(7, run.sites.length) }, (_, i) => i), [run]);
   const isCrystal = level.mission === "crystal";
   const beamColor = level.mission === "panel" ? COLORS.repairBeam : COLORS.scanBeam;

   useFrame(() => {
      const r = run.rover;
      const dt = Math.min(0.05, time.delta || 0);
      const g = root.current;
      if (!g) return;
      const y = height(r.x, r.z);
      g.position.set(r.x, y, r.z);
      tiltAt(height, r.x, r.z, r.yaw, 1.0, 0.85, TILT);
      const k = 1 - Math.exp(-10 * dt);
      vis.pitch += (TILT.pitch - vis.pitch) * k;
      vis.roll += (TILT.roll - vis.roll) * k;
      g.rotation.order = "YXZ";
      g.rotation.set(-vis.pitch, r.yaw, vis.roll);
      // blink through the hit grace
      g.visible = !(r.invulnerable > 0 && Math.floor(time.now * 12) % 2 === 0) || vis.winT >= 0;

      // wheels: roll by the distance travelled along the heading, steer front +, rear - (4-wheel steering)
      const dx = r.x - last.x;
      const dz = r.z - last.z;
      last.x = r.x;
      last.z = r.z;
      const along = dx * Math.sin(r.yaw) + dz * Math.cos(r.yaw);
      if (Math.abs(along) < 2) last.turn += along / WHEEL.radius;
      const steerA = -vis.steer * STEER_MAX * Math.min(1, 0.4 + Math.abs(r.speed) / 3);
      for (let i = 0; i < 4; i++) {
         const sg = steerF.current[i];
         if (sg) sg.rotation.y = i < 2 ? steerA : -steerA * 0.5;
         const sp = spin.current[i];
         if (sp) sp.rotation.x = last.turn;
      }

      // body: a suspension bob on a spring, pitching back under throttle and forward on the brake
      const b = body.current;
      if (b) {
         const speed = Math.abs(r.speed);
         const bump = speed > 0.4 ? Math.sin(time.now * 15) * 0.025 * Math.min(1, speed / 4) + Math.sin(time.now * 9.3) * 0.015 * Math.min(1, speed / 4) : 0;
         spring(vis.bob, bump - vis.throttle * 0.03, 140, -1, dt);
         b.position.y = vis.bob.x;
         b.rotation.x = -vis.throttle * 0.035 + vis.bob.x * 0.8;
         b.rotation.z = vis.steer * Math.min(1, speed / 5) * 0.04;
      }

      // the drill: lowers under the belly while drilling, the bit spins
      const working = vis.active >= 0 && vis.progress > 0;
      if (drill.current) {
         const want = isCrystal && working ? 1 : 0;
         const cur = drill.current.userData.k ?? 0;
         const nk = cur + (want - cur) * (1 - Math.exp(-12 * dt));
         drill.current.userData.k = nk;
         drill.current.position.y = BELLY_Y - 0.05 - nk * 0.3;
         drill.current.visible = nk > 0.02;
      }
      if (bit.current) bit.current.rotation.y += dt * (working ? 40 : 4);

      // the mast beam: from the scanner head to the prop being scanned / repaired
      const bm = beam.current;
      if (bm) {
         const on = !isCrystal && working;
         bm.visible = on;
         if (on) {
            g.updateMatrixWorld();
            const head = TMP.set(0, MAST.y + 0.12, MAST.z);
            g.localToWorld(head);
            const tx = vis.beamX - head.x;
            const ty = vis.beamY - head.y;
            const tz = vis.beamZ - head.z;
            const len = Math.hypot(tx, ty, tz);
            // the beam lives in world space (a child of the scene through this group's parent)
            bm.position.set(head.x + tx / 2, head.y + ty / 2, head.z + tz / 2);
            bm.scale.set(1 + Math.sin(time.now * 30) * 0.25, len, 1 + Math.sin(time.now * 30) * 0.25);
            bm.lookAt(vis.beamX, vis.beamY, vis.beamZ);
            bm.rotateX(Math.PI / 2);
         }
      }
      if (beamHead.current) beamHead.current.rotation.y = working && !isCrystal ? Math.atan2(vis.beamX - r.x, vis.beamZ - r.z) - r.yaw : Math.sin(time.now * 0.6) * 0.8;

      // samples on the deck (crystal missions): one per stored sample; the newest pops in after its flight
      for (let i = 0; i < deck.current.length; i++) {
         const d = deck.current[i];
         if (!d) continue;
         const shown = i < vis.carried && !(i === vis.carried - 1 && vis.flyT >= 0 && vis.flyT < 1);
         d.visible = isCrystal && shown;
      }

      // a drilled crystal flies up out of its deposit in an arc onto the deck
      const f = fly.current;
      if (f) {
         const on = isCrystal && vis.flyT >= 0 && vis.flyT < 1 && vis.flySite >= 0;
         f.visible = on;
         if (on) {
            const s = run.sites[vis.flySite];
            const slot = Math.max(0, vis.carried - 1);
            g.updateMatrixWorld();
            const to = TMP.set(((slot % 3) - 1) * 0.36, DECK_Y + vis.bob.x, -0.55 - Math.floor(slot / 3) * 0.36);
            g.localToWorld(to);
            const t = vis.flyT;
            const sy = height(s.x, s.z) + 0.2;
            f.position.set(s.x + (to.x - s.x) * t, sy + (to.y - sy) * t + Math.sin(Math.PI * t) * 2.2, s.z + (to.z - s.z) * t);
            f.rotation.y = t * 9;
            const sc = 1 + Math.sin(Math.PI * t) * 0.6;
            f.scale.set(sc, sc, sc);
         }
      }

      // headlights aim ahead and a little down
      lightTarget.position.set(0, 0, 9);
   }, FRAME_PRIORITY.visuals);

   const wheels: [number, number, number][] = [
      [WHEEL.x, WHEEL.y, WHEEL.zFront],
      [-WHEEL.x, WHEEL.y, WHEEL.zFront],
      [WHEEL.x, WHEEL.y, WHEEL.zBack],
      [-WHEEL.x, WHEEL.y, WHEEL.zBack],
   ];

   return (
      <>
         <group ref={root}>
            <BlobShadow radius={1.25} opacity={0.38} y={0.03} />
            <group ref={body}>
               <Model asset={ASSETS.rover} fallback={<RoverPrimitive />} />
               {/* scanner head on the mast */}
               <group ref={beamHead} position={[0, MAST.y + 0.06, MAST.z]}>
                  <mesh position={[0, 0.06, 0.1]}>
                     <boxGeometry args={[0.32, 0.14, 0.12]} />
                     <meshStandardMaterial color="#e2e8f0" metalness={0.5} roughness={0.35} />
                  </mesh>
                  <mesh position={[0, 0.06, 0.17]}>
                     <circleGeometry args={[0.05, 12]} />
                     <meshBasicMaterial color={beamColor} toneMapped={false} />
                  </mesh>
               </group>
               {/* the drill rig under the belly */}
               <group ref={drill} position={[0, BELLY_Y, 0.15]} visible={false}>
                  <mesh position={[0, 0.12, 0]}>
                     <cylinderGeometry args={[0.13, 0.13, 0.24, 12]} />
                     <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
                  </mesh>
                  <mesh ref={bit} position={[0, -0.12, 0]} rotation-x={Math.PI}>
                     <coneGeometry args={[0.09, 0.32, 8]} />
                     <meshStandardMaterial color="#f8fafc" metalness={0.9} roughness={0.2} emissive={COLORS.crystal} emissiveIntensity={0.25} />
                  </mesh>
               </group>
               {/* the carried samples on the rear deck */}
               {isCrystal &&
                  slots.map((i) => (
                     <group key={i} ref={(el) => void (el && (deck.current[i] = el))} position={[((i % 3) - 1) * 0.36, DECK_Y, -0.55 - Math.floor(i / 3) * 0.36]} rotation-y={i * 1.3} visible={false}>
                        <Model asset={ASSETS.carried} fallback={<CarriedPrimitive />} />
                     </group>
                  ))}
               {level.headlights && (
                  <>
                     <primitive object={lightTarget} />
                     {[-0.45, 0.45].map((x, i) => (
                        <group key={x} position={[x, 0.85, 1.12]}>
                           <mesh>
                              <sphereGeometry args={[0.08, 10, 8]} />
                              <meshBasicMaterial color={COLORS.headlight} toneMapped={false} />
                           </mesh>
                           <spotLight ref={(el) => void (el && (lights.current[i] = el))} color={COLORS.headlight} intensity={28} distance={26} angle={0.55} penumbra={0.6} decay={1.4} target={lightTarget} />
                        </group>
                     ))}
                     {/* a soft light cone in the dust */}
                     <mesh position={[0, 0.6, 1.12 + 3]} rotation-x={-Math.PI / 2 - 0.08}>
                        <coneGeometry args={[1.9, 6, 20, 1, true]} />
                        <meshBasicMaterial color={COLORS.headlight} transparent opacity={0.07} blending={AdditiveBlending} depthWrite={false} side={2} />
                     </mesh>
                  </>
               )}
            </group>
            {wheels.map((p, i) => (
               <group key={i} position={p} ref={(el) => void (el && (steerF.current[i] = el))}>
                  <group ref={(el) => void (el && (spin.current[i] = el))}>
                     <mesh geometry={wheel.tread} material={wheel.rubber} />
                     <mesh geometry={wheel.hubGeo} material={wheel.hub} />
                  </group>
               </group>
            ))}
         </group>
         {isCrystal && (
            <group ref={fly} visible={false}>
               <Model asset={ASSETS.carried} fallback={<CarriedPrimitive />} />
            </group>
         )}
         {/* the scan / repair beam, in world space */}
         <mesh ref={beam} visible={false} renderOrder={5}>
            <cylinderGeometry args={[0.035, 0.09, 1, 10, 1, true]} />
            <meshBasicMaterial color={beamColor} transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}

