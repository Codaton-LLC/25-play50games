"use client";

// Tiny Escape Room look: a roofless office, four stations, the door and the runner stand-in.
// Positions come from the run's layout. Opening parts are rigid transforms of existing groups.
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { RingGeometry, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { LOOT_AT, createCupboardShell, poseCupboard } from "./cupboard";
import {
   DOOR_OPEN_MS,
   DOOR_POSITION,
   OPEN_MS,
   STATION_BODY,
   UNLOCK_MS,
   type EscapeRun,
} from "./rules";

const SHELL: InstanceSpot[] = [
   { x: 0, y: 0.6, z: -5.12, sx: 12.4, sy: 1.2, sz: 0.16 },
   { x: -6.12, y: 0.16, z: 0, sx: 0.16, sy: 0.32, sz: 10.2 },
   { x: 6.12, y: 0.16, z: 0, sx: 0.16, sy: 0.32, sz: 10.2 },
   { x: 0, y: 0.1, z: 5.1, sx: 12.2, sy: 0.2, sz: 0.16 },
];

const CHAIR_SPOTS: InstanceSpot[] = [
   { x: -5, y: 0, z: 0, rotY: Math.PI / 2 },
   { x: 5, y: 0, z: 0, rotY: -Math.PI / 2 },
];

const FLAT_RING = new RingGeometry(0.28, 0.4, 24).rotateX(-Math.PI / 2);

const bodyOf = (x: number) => x + Math.sign(x) * STATION_BODY.offset;

function openAmount(phase: string, progressMs: number): number {
   if (phase === "closed") return 0;
   if (phase === "opening") return Math.min(1, progressMs / OPEN_MS);
   return 1;
}

interface Moving {
   drawer: Array<Group | null>;
   hinge: Array<Group | null>;
   roof: Array<Mesh | null>;
   lid: Array<Group | null>;
   loot: Array<Group | null>;
   leaf: Group | null;
   glow: MeshStandardMaterial | null;
}

function Loot({ kind }: { kind: number }) {
   if (kind === 0) {
      return (
         <Model asset={ASSETS.key} fallback={
            <mesh position={[0, 0.08, 0]}>
               <boxGeometry args={[0.28, 0.08, 0.12]} />
               <meshStandardMaterial color="#eab308" metalness={0.4} roughness={0.35} />
            </mesh>
         } />
      );
   }
   if (kind === 1) {
      return (
         <Model asset={ASSETS.book} fallback={
            <mesh position={[0, 0.06, 0]}>
               <boxGeometry args={[0.22, 0.08, 0.3]} />
               <meshStandardMaterial color="#b91c1c" roughness={0.6} />
            </mesh>
         } />
      );
   }
   return (
      <Model asset={ASSETS.battery} fallback={
         <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.24, 10]} />
            <meshStandardMaterial color="#4ade80" roughness={0.4} />
         </mesh>
      } />
   );
}

export function Room({ run, moving }: { run: EscapeRun; moving: MutableRefObject<Moving> }) {
   const layout = run.layout;
   const deskSpots = useMemo<InstanceSpot[]>(() => [0, 2].map((id) => {
      const s = layout.stations[id];
      return { x: bodyOf(s.x), y: 0, z: s.z, rotY: s.x < 0 ? 0 : Math.PI };
   }), [layout]);
   const deskBoxes = useMemo<InstanceSpot[]>(() => deskSpots.map((s) => ({ ...s, y: 0.4 })), [deskSpots]);
   const chairBoxes = useMemo<InstanceSpot[]>(() => CHAIR_SPOTS.map((s) => ({ ...s, y: 0.4 })), []);
   const ringSpots = useMemo<InstanceSpot[]>(() => [
      ...layout.stations.map((s) => ({ x: s.x, y: 0.025, z: s.z })),
      { x: DOOR_POSITION.x, y: 0.025, z: DOOR_POSITION.z },
   ], [layout]);

   useFrame(() => {
      const parts = moving.current;
      for (let i = 0; i < 4; i++) {
         const station = run.stations[i];
         const open = openAmount(station.phase, station.progressMs);
         const slide = parts.drawer[i];
         if (slide) {
            const out = run.layout.stations[i].x < 0 ? 1 : -1;
            slide.position.x = out * (0.45 + 0.42 * open);
         }
         const hinge = parts.hinge[i];
         const roof = parts.roof[i];
         if (hinge && roof) poseCupboard(hinge, roof, run.layout.stations[i].x < 0 ? 1 : -1, open);
         const lid = parts.lid[i];
         if (lid) lid.rotation.x = -1.15 * open;
      }
      for (let item = 0; item < 3; item++) {
         const loot = parts.loot[item];
         if (loot) loot.visible = run.items[item].visible;
      }
      const leaf = parts.leaf;
      if (leaf) {
         const swung = Math.max(0, run.door.progressMs - UNLOCK_MS) / DOOR_OPEN_MS;
         leaf.rotation.y = -1.15 * Math.min(1, swung);
      }
      if (parts.glow) {
         const unlocking = run.door.phase === "unlocking" || run.door.phase === "opening" || run.door.phase === "open";
         parts.glow.emissiveIntensity = unlocking ? 0.4 + 0.8 * Math.min(1, run.door.progressMs / UNLOCK_MS) : 0.15;
      }
   });

   const set = moving.current;
   return (
      <group name="room">
         <Instanced spots={ringSpots} name="anchor-rings">
            <primitive object={FLAT_RING} attach="geometry" />
            <meshBasicMaterial color="#eab308" transparent opacity={0.4} depthWrite={false} />
         </Instanced>
         <mesh rotation-x={-Math.PI / 2} name="floor">
            <planeGeometry args={[12, 10]} />
            <meshStandardMaterial color="#d6d3d1" roughness={0.95} />
         </mesh>
         <Instanced spots={SHELL} name="shell">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#a8a29e" roughness={0.85} />
         </Instanced>
         <InstancedModel
            asset={ASSETS.desk}
            spots={deskSpots}
            fallback={
               <Instanced spots={deskBoxes}>
                  <boxGeometry args={[1.2, 0.8, 1.4]} />
                  <meshStandardMaterial color="#a16207" roughness={0.7} />
               </Instanced>
            }
         />
         <InstancedModel
            asset={ASSETS.chair}
            spots={CHAIR_SPOTS}
            fallback={
               <Instanced spots={chairBoxes}>
                  <boxGeometry args={[0.8, 0.8, 0.8]} />
                  <meshStandardMaterial color="#44403c" roughness={0.75} />
               </Instanced>
            }
         />
         {layout.stations.map((station) => {
            const cx = bodyOf(station.x);
            const toward = station.x < 0 ? 1 : -1;
            return (
               <group key={station.id} position={[cx, 0, station.z]} name={`station-${station.id}`}>
                  {station.kind === "cupboard" ? (
                     <Cupboard toward={toward > 0 ? 1 : -1} stationId={station.id} moving={moving} />
                  ) : null}
                  {station.kind === "drawer" ? (
                     <group ref={(g) => { set.drawer[station.id] = g; }} position={[toward * 0.45, 0.32, 0]}>
                        <mesh>
                           <boxGeometry args={[0.45, 0.16, 0.7]} />
                           <meshStandardMaterial color="#d6d3d1" roughness={0.6} />
                        </mesh>
                        {station.item !== -1 ? (
                           <group ref={(g) => { set.loot[station.item] = g; }} position={[0, 0.14, 0]} visible={false}>
                              <Loot kind={station.item} />
                           </group>
                        ) : null}
                     </group>
                  ) : null}
                  {station.kind === "under-desk" ? (
                     <group position={[toward * 0.2, 0.16, 0]}>
                        <mesh>
                           <boxGeometry args={[0.4, 0.28, 0.55]} />
                           <meshStandardMaterial color="#44403c" roughness={0.7} />
                        </mesh>
                        <group ref={(g) => { set.lid[station.id] = g; }} position={[toward * -0.18, 0.14, 0]}>
                           <mesh position={[toward * 0.18, 0.02, 0]}>
                              <boxGeometry args={[0.4, 0.04, 0.55]} />
                              <meshStandardMaterial color="#a8a29e" roughness={0.6} />
                           </mesh>
                        </group>
                        {station.item !== -1 ? (
                           <group ref={(g) => { set.loot[station.item] = g; }} position={[0, 0.2, 0]} visible={false}>
                              <Loot kind={station.item} />
                           </group>
                        ) : null}
                     </group>
                  ) : null}
                  {station.kind === "cupboard" && station.item !== -1 ? (
                     <group ref={(g) => { set.loot[station.item] = g; }} position={LOOT_AT} visible={false}>
                        <Loot kind={station.item} />
                     </group>
                  ) : null}
               </group>
            );
         })}
         <group position={[0, 0, -4.9]} name="door">
            <mesh position={[-0.85, 1.05, -0.06]}>
               <boxGeometry args={[0.14, 2.1, 0.14]} />
               <meshStandardMaterial color="#44403c" />
            </mesh>
            <mesh position={[0.85, 1.05, -0.06]}>
               <boxGeometry args={[0.14, 2.1, 0.14]} />
               <meshStandardMaterial color="#44403c" />
            </mesh>
            <mesh position={[0, 2.05, -0.06]}>
               <boxGeometry args={[1.84, 0.12, 0.14]} />
               <meshStandardMaterial color="#44403c" />
            </mesh>
            <mesh position={[1.15, 1.15, 0.02]}>
               <boxGeometry args={[0.18, 0.28, 0.06]} />
               <meshStandardMaterial ref={(m) => { set.glow = m; }} color="#292524" emissive="#eab308" emissiveIntensity={0.15} />
            </mesh>
            <group ref={(g) => { set.leaf = g; }} position={[-0.7, 0, 0.08]}>
               <group position={[0.7, 0, 0]}>
                  <Model asset={ASSETS.door} fallback={
                     <mesh position={[0, 1, 0]}>
                        <boxGeometry args={[1.4, 2, 0.12]} />
                        <meshStandardMaterial color="#b45309" roughness={0.6} />
                     </mesh>
                  } />
               </group>
            </group>
         </group>
      </group>
   );
}

export function createMoving(): Moving {
   return {
      drawer: [null, null, null, null],
      hinge: [null, null, null, null],
      roof: [null, null, null, null],
      lid: [null, null, null, null],
      loot: [null, null, null],
      leaf: null,
      glow: null,
   };
}

/** Built in the effect: a strict-mode replay disposes that copy and the next run builds another. */
function Cupboard({ toward, stationId, moving }: { toward: 1 | -1; stationId: number; moving: MutableRefObject<Moving> }) {
   const host = useRef<Group>(null);
   useLayoutEffect(() => {
      const parent = host.current;
      if (!parent) return;
      const shell = createCupboardShell(toward);
      parent.add(shell.root);
      const parts = moving.current;
      parts.hinge[stationId] = shell.hinge;
      parts.roof[stationId] = shell.roof;
      return () => {
         if (parts.hinge[stationId] === shell.hinge) parts.hinge[stationId] = null;
         if (parts.roof[stationId] === shell.roof) parts.roof[stationId] = null;
         parent.remove(shell.root);
         shell.dispose();
      };
   }, [moving, stationId, toward]);
   return <group ref={host} />;
}

export interface RunnerLimbs {
   legL: Group | null;
   legR: Group | null;
   armL: Group | null;
   armR: Group | null;
   bob: Group | null;
}

/** About 1.4 tall, arms down. Scene swings these groups from the shared humanoid pose. */
export function PrimitiveRunner({ limbs }: { limbs: MutableRefObject<RunnerLimbs> }) {
   const set = (key: keyof RunnerLimbs) => (g: Group | null) => {
      limbs.current[key] = g;
   };
   return (
      <group ref={set("bob")} name="runner-body">
         <mesh position={[0, 0.72, 0]}>
            <boxGeometry args={[0.42, 0.46, 0.26]} />
            <meshStandardMaterial color="#f97316" roughness={0.55} />
         </mesh>
         <mesh position={[0, 1.12, 0]}>
            <sphereGeometry args={[0.18, 14, 12]} />
            <meshStandardMaterial color="#fdba74" roughness={0.6} />
         </mesh>
         <mesh position={[0, 1.24, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.17, 0.035, 6, 14]} />
            <meshStandardMaterial color="#eab308" roughness={0.4} />
         </mesh>
         <group ref={set("legL")} position={[-0.1, 0.46, 0]}>
            <mesh position={[0, -0.2, 0]}>
               <capsuleGeometry args={[0.07, 0.28, 4, 8]} />
               <meshStandardMaterial color="#1e293b" roughness={0.7} />
            </mesh>
         </group>
         <group ref={set("legR")} position={[0.1, 0.46, 0]}>
            <mesh position={[0, -0.2, 0]}>
               <capsuleGeometry args={[0.07, 0.28, 4, 8]} />
               <meshStandardMaterial color="#1e293b" roughness={0.7} />
            </mesh>
         </group>
         <group ref={set("armL")} position={[-0.28, 0.86, 0]}>
            <mesh position={[0, -0.18, 0]}>
               <capsuleGeometry args={[0.055, 0.22, 4, 8]} />
               <meshStandardMaterial color="#f97316" roughness={0.55} />
            </mesh>
         </group>
         <group ref={set("armR")} position={[0.28, 0.86, 0]}>
            <mesh position={[0, -0.18, 0]}>
               <capsuleGeometry args={[0.055, 0.22, 4, 8]} />
               <meshStandardMaterial color="#f97316" roughness={0.55} />
            </mesh>
         </group>
      </group>
   );
}
