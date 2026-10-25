"use client";

// Tiny Escape Room look: a cosy, well-lit escape room office, four stations,
// the door with glowing frame, and the polished runner stand-in.
// Positions come from the run's layout. Opening parts are rigid transforms of existing groups.
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { RepeatWrapping, RingGeometry, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { Instanced, useCanvasTexture, type CanvasDraw, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, BOOK_DRAWN, BOOK_GROUP, BOOK_STAND_IN, DOOR_HINGE, DOOR_LEAF, KEY_DRAWN } from "./assets";
import { LOOT_AT, createCupboardShell, poseCupboard } from "./cupboard";
import { DRAWER, UNDER_DESK, drawerX, underDeskLid, underDeskX } from "./desk";
import { COLORS } from "./looks";
import {
   DOOR_OPEN_MS,
   DOOR_POSITION,
   OPEN_MS,
   STATION_BODY,
   UNLOCK_MS,
   type EscapeRun,
} from "./rules";

// Architectural shell walls and low room kerbs
const SHELL_LOWER: InstanceSpot[] = [
   // Back wall wainscoting (y: 0.3, h: 0.6)
   { x: 0, y: 0.3, z: -5.12, sx: 12.4, sy: 0.6, sz: 0.18 },
   // Left low kerb
   { x: -6.12, y: 0.16, z: 0, sx: 0.16, sy: 0.32, sz: 10.2 },
   // Right low kerb
   { x: 6.12, y: 0.16, z: 0, sx: 0.16, sy: 0.32, sz: 10.2 },
   // Front low kerb
   { x: 0, y: 0.1, z: 5.1, sx: 12.2, sy: 0.2, sz: 0.16 },
];

const SHELL_UPPER: InstanceSpot[] = [
   // Back wall upper painted surface (y: 0.9, h: 0.6)
   { x: 0, y: 0.9, z: -5.12, sx: 12.4, sy: 0.6, sz: 0.16 },
];

const SHELL_TRIM: InstanceSpot[] = [
   // Back wall mid-rail moulding (y: 0.6)
   { x: 0, y: 0.6, z: -5.1, sx: 12.42, sy: 0.06, sz: 0.2 },
   // Skirting boards along base of walls
   { x: 0, y: 0.05, z: -5.02, sx: 12.4, sy: 0.1, sz: 0.08 },
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
   /** the under-desk box (slides out) and its lid (hinged on the back edge) */
   box: Array<Group | null>;
   lid: Array<Group | null>;
   loot: Array<Group | null>;
   leaf: Group | null;
   glow: MeshStandardMaterial | null;
   doorFrameGlow: MeshStandardMaterial | null;
}

/** One station's loot (0 key, 1 book, 2 battery). Hook-free: assets.test.ts reads its transforms. */
export function Loot({ kind }: { kind: number }) {
   if (kind === 0) {
      return (
         <Model asset={ASSETS.key} fallback={
            <mesh position={[0, KEY_DRAWN.y, 0]}>
               <boxGeometry args={[...KEY_DRAWN.size]} />
               <meshStandardMaterial color={COLORS.doorKnob} metalness={0.6} roughness={0.3} />
            </mesh>
         } />
      );
   }
   if (kind === 1) {
      // the book GLB stands on its edge: the group lays it flat (assets.ts BOOK_GROUP); the
      // stand-in box is turned back (BOOK_STAND_IN) so it lies exactly where it always did
      return (
         <Model asset={ASSETS.book} {...BOOK_GROUP} fallback={
            <mesh {...BOOK_STAND_IN}>
               <boxGeometry args={[...BOOK_DRAWN.size]} />
               <meshStandardMaterial color={COLORS.bookRed} roughness={0.55} />
            </mesh>
         } />
      );
   }
   return (
      <Model asset={ASSETS.battery} fallback={
         <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.24, 10]} />
            <meshStandardMaterial color={COLORS.plantLeafBright} roughness={0.4} />
         </mesh>
      } />
   );
}

/**
 * The door leaf on its hinge (assets.ts DOOR_HINGE): `hinge` gets the group Room swings about y,
 * on the leaf's -x edge; the leaf (GLB or box, both 1.4 x 2.0 x 0.12) is centred on it.
 * Hook-free: assets.test.ts reads its transforms.
 */
export function DoorLeaf({ hinge }: { hinge: (group: Group | null) => void }) {
   return (
      <group ref={hinge} position={DOOR_HINGE.position}>
         <group position={DOOR_HINGE.leaf}>
            <Model asset={ASSETS.door} fallback={
               <mesh position={[0, DOOR_LEAF[1] / 2, 0]}>
                  <boxGeometry args={[...DOOR_LEAF]} />
                  <meshStandardMaterial color={COLORS.doorWood} roughness={0.6} />
               </mesh>
            } />
         </group>
      </group>
   );
}

/** Procedural warm oak parquet plank texture for the escape room office floor. */
const drawWoodFloor: CanvasDraw = (ctx, width, height) => {
   // Warm oak base
   ctx.fillStyle = COLORS.floorWood;
   ctx.fillRect(0, 0, width, height);

   // 16 horizontal floorboard planks with rich tonal variation
   const rows = 16;
   const rowH = height / rows;
   const tones = [COLORS.floorWood, COLORS.floorWoodLight, COLORS.floorWoodDark, COLORS.floorWoodLight];
   for (let r = 0; r < rows; r++) {
      ctx.fillStyle = tones[r % tones.length];
      ctx.fillRect(0, r * rowH, width, rowH);

      // Subtle wood grain streaks
      ctx.fillStyle = COLORS.floorWoodLight;
      ctx.globalAlpha = 0.18;
      for (let s = 0; s < 3; s++) {
         const y = r * rowH + (s + 1) * (rowH / 4);
         ctx.fillRect(0, y, width, 1.5);
      }
      ctx.globalAlpha = 1.0;

      // Dark joint between planks
      ctx.fillStyle = COLORS.floorWoodJoint;
      ctx.fillRect(0, (r + 1) * rowH - 1.5, width, 1.5);

      // Staggered vertical seams between boards
      const seamX1 = (r * 137) % width;
      const seamX2 = (r * 137 + width / 2) % width;
      ctx.fillRect(seamX1, r * rowH, 1.5, rowH);
      ctx.fillRect(seamX2, r * rowH, 1.5, rowH);
   }
};

export function Room({ run, moving }: { run: EscapeRun; moving: MutableRefObject<Moving> }) {
   const layout = run.layout;
   const deskSpots = useMemo<InstanceSpot[]>(() => [0, 2].map((id) => {
      const s = layout.stations[id];
      return { x: bodyOf(s.x), y: 0, z: s.z, rotY: s.x < 0 ? 0 : Math.PI };
   }), [layout]);
   const deskBoxes = useMemo<InstanceSpot[]>(() => deskSpots.map((s) => ({ ...s, y: 0.4 })), [deskSpots]);
   const chairs = useMemo<InstanceSpot[]>(() => run.level.id === 1 ? CHAIR_SPOTS : [-0.8, 0, 0.8].map((x) => ({ x, y: 0, z: 0, rotY: Math.PI / 2 })), [run]);
   const chairBoxes = useMemo<InstanceSpot[]>(() => chairs.map((s) => ({ ...s, y: 0.4 })), []);
   const ringSpots = useMemo<InstanceSpot[]>(() => [
      ...layout.stations.map((s) => ({ x: s.x, y: 0.025, z: s.z })),
      { x: DOOR_POSITION.x, y: 0.025, z: DOOR_POSITION.z },
   ], [layout]);

   const floorTexture = useCanvasTexture(512, 512, drawWoodFloor);
   useEffect(() => {
      floorTexture.wrapS = floorTexture.wrapT = RepeatWrapping;
      floorTexture.repeat.set(3, 3);
      floorTexture.needsUpdate = true;
   }, [floorTexture]);

   useFrame(() => {
      const parts = moving.current;
      for (let i = 0; i < run.stations.length; i++) {
         const station = run.stations[i];
         const open = openAmount(station.phase, station.progressMs);
         const toward = run.layout.stations[i].x < 0 ? 1 : -1;
         const slide = parts.drawer[i];
         if (slide) slide.position.x = toward * drawerX(open);
         const hinge = parts.hinge[i];
         const roof = parts.roof[i];
         if (hinge && roof) poseCupboard(hinge, roof, toward, open);
         // the box slides out from under the desk top first, then its lid swings up behind the loot
         const box = parts.box[i];
         if (box) box.position.x = toward * underDeskX(open);
         const lid = parts.lid[i];
         if (lid) lid.rotation.x = -UNDER_DESK.lidOpen * underDeskLid(open);
      }
      for (let item = 0; item < run.items.length; item++) {
         const loot = parts.loot[item];
         if (loot) loot.visible = run.items[item].visible;
      }
      const leaf = parts.leaf;
      if (leaf) {
         const swung = Math.max(0, run.door.progressMs - UNLOCK_MS) / DOOR_OPEN_MS;
         leaf.rotation.y = -1.15 * Math.min(1, swung);
      }
      const unlocking = run.door.phase === "unlocking" || run.door.phase === "opening" || run.door.phase === "open";
      if (parts.glow) {
         parts.glow.emissiveIntensity = unlocking ? 0.4 + 0.8 * Math.min(1, run.door.progressMs / UNLOCK_MS) : 0.2;
      }
      if (parts.doorFrameGlow) {
         parts.doorFrameGlow.emissiveIntensity = unlocking ? 0.6 + 0.6 * Math.min(1, run.door.progressMs / UNLOCK_MS) : 0.25;
      }
   });

   const set = moving.current;
   return (
      <group name="room">
         <Instanced spots={ringSpots} name="anchor-rings">
            <primitive object={FLAT_RING} attach="geometry" />
            <meshBasicMaterial color={COLORS.accentYellow} transparent opacity={0.45} depthWrite={false} />
         </Instanced>

         {/* Parquet wooden floor of the office */}
         <mesh rotation-x={-Math.PI / 2} name="floor">
            <planeGeometry args={[12, 10]} />
            <meshStandardMaterial map={floorTexture} roughness={0.7} />
         </mesh>

         {/* Room wainscoting lower walls and skirting */}
         <Instanced spots={SHELL_LOWER} name="shell-wainscot">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wallWood} roughness={0.7} />
         </Instanced>

         {/* Room upper back wall surface */}
         <Instanced spots={SHELL_UPPER} name="shell-upper">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wallPaintWarm} roughness={0.85} />
         </Instanced>

         {/* Room architectural trim & dado rail */}
         <Instanced spots={SHELL_TRIM} name="shell-trim">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wallTrim} roughness={0.65} />
         </Instanced>

         <InstancedModel
            asset={ASSETS.desk}
            spots={deskSpots}
            fallback={
               <Instanced spots={deskBoxes}>
                  <boxGeometry args={[1.2, 0.8, 1.4]} />
                  <meshStandardMaterial color={COLORS.deskBody} roughness={0.7} />
               </Instanced>
            }
         />
         <InstancedModel
            asset={ASSETS.chair}
            spots={chairs}
            fallback={
               <Instanced spots={chairBoxes}>
                  <boxGeometry args={[0.8, 0.8, 0.8]} />
                  <meshStandardMaterial color={COLORS.chairWood} roughness={0.75} />
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
                     <group ref={(g) => { set.drawer[station.id] = g; }} position={[toward * DRAWER.x, DRAWER.y, 0]} name="drawer">
                        {/* Drawer body in warm wood */}
                        <mesh>
                           <boxGeometry args={DRAWER.size} />
                           <meshStandardMaterial color={COLORS.drawerBody} roughness={0.65} />
                        </mesh>
                        {/* Contrasting drawer front plate */}
                        <mesh position={[toward * (DRAWER.size[0] / 2 + 0.01), 0, 0]}>
                           <boxGeometry args={[0.02, DRAWER.size[1] * 0.9, DRAWER.size[2] * 0.9]} />
                           <meshStandardMaterial color={COLORS.drawerFace} roughness={0.6} />
                        </mesh>
                        {/* Brass drawer pull handle */}
                        <mesh position={[toward * (DRAWER.size[0] / 2 + 0.03), 0, 0]}>
                           <boxGeometry args={[0.02, 0.04, 0.18]} />
                           <meshStandardMaterial color={COLORS.drawerPull} metalness={0.65} roughness={0.3} />
                        </mesh>
                        {station.item !== -1 ? (
                           <group ref={(g) => { set.loot[station.item] = g; }} position={[0, DRAWER.lootY, 0]} visible={false} name="loot">
                              <Loot kind={station.item === 3 ? 0 : station.item >= 4 ? 2 : station.item} />
                           </group>
                        ) : null}
                     </group>
                  ) : null}
                  {station.kind === "under-desk" ? (
                     <group
                        ref={(g) => { set.box[station.id] = g; }}
                        position={[toward * UNDER_DESK.x, UNDER_DESK.y, 0]}
                        name="under-desk"
                     >
                        {/* Archive trunk body */}
                        <mesh>
                           <boxGeometry args={UNDER_DESK.size} />
                           <meshStandardMaterial color={COLORS.boxBody} roughness={0.7} />
                        </mesh>
                        {/* Reinforced corner straps */}
                        <mesh position={[0, 0, 0]}>
                           <boxGeometry args={[UNDER_DESK.size[0] * 1.01, UNDER_DESK.size[1] * 0.98, UNDER_DESK.size[2] * 0.2]} />
                           <meshStandardMaterial color={COLORS.boxStrap} roughness={0.5} />
                        </mesh>
                        {/* Hinged lid with brass latch */}
                        <group
                           ref={(g) => { set.lid[station.id] = g; }}
                           position={[0, UNDER_DESK.size[1] / 2, -UNDER_DESK.size[2] / 2]}
                        >
                           <mesh position={[0, UNDER_DESK.lidThick / 2, UNDER_DESK.size[2] / 2]}>
                              <boxGeometry args={[UNDER_DESK.size[0], UNDER_DESK.lidThick, UNDER_DESK.size[2]]} />
                              <meshStandardMaterial color={COLORS.boxBody} roughness={0.65} />
                           </mesh>
                           {/* Brass latch hasp on front of lid */}
                           <mesh position={[toward * (UNDER_DESK.size[0] / 2 + 0.01), 0, UNDER_DESK.size[2] / 2]}>
                              <boxGeometry args={[0.02, 0.06, 0.08]} />
                              <meshStandardMaterial color={COLORS.boxLock} metalness={0.6} roughness={0.3} />
                           </mesh>
                        </group>
                        {station.item !== -1 ? (
                           <group ref={(g) => { set.loot[station.item] = g; }} position={[0, UNDER_DESK.lootY, 0]} visible={false} name="loot">
                              <Loot kind={station.item === 3 ? 0 : station.item >= 4 ? 2 : station.item} />
                           </group>
                        ) : null}
                     </group>
                  ) : null}
                  {station.kind === "cupboard" && station.item !== -1 ? (
                     <group ref={(g) => { set.loot[station.item] = g; }} position={LOOT_AT} visible={false} name="loot">
                        <Loot kind={station.item === 3 ? 0 : station.item >= 4 ? 2 : station.item} />
                     </group>
                  ) : null}
               </group>
            );
         })}

         {/* Exit door with glowing frame arch & scanner */}
         <group position={[0, 0, -4.9]} name="door">
            {/* Outer door frame: dark polished frame posts & lintel */}
            <mesh position={[-0.85, 1.05, -0.06]}>
               <boxGeometry args={[0.14, 2.1, 0.14]} />
               <meshStandardMaterial color={COLORS.doorFrame} roughness={0.6} />
            </mesh>
            <mesh position={[0.85, 1.05, -0.06]}>
               <boxGeometry args={[0.14, 2.1, 0.14]} />
               <meshStandardMaterial color={COLORS.doorFrame} roughness={0.6} />
            </mesh>
            <mesh position={[0, 2.05, -0.06]}>
               <boxGeometry args={[1.84, 0.12, 0.14]} />
               <meshStandardMaterial color={COLORS.doorFrame} roughness={0.6} />
            </mesh>

            {/* Glowing inner arch border around the door frame */}
            <mesh position={[-0.75, 1.05, -0.04]}>
               <boxGeometry args={[0.04, 2.06, 0.1]} />
               <meshStandardMaterial
                  ref={(m) => { set.doorFrameGlow = m; }}
                  color={COLORS.doorGlow}
                  emissive={COLORS.doorEmissive}
                  emissiveIntensity={0.25}
               />
            </mesh>
            <mesh position={[0.75, 1.05, -0.04]}>
               <boxGeometry args={[0.04, 2.06, 0.1]} />
               <meshStandardMaterial
                  color={COLORS.doorGlow}
                  emissive={COLORS.doorEmissive}
                  emissiveIntensity={0.25}
               />
            </mesh>
            <mesh position={[0, 1.96, -0.04]}>
               <boxGeometry args={[1.54, 0.04, 0.1]} />
               <meshStandardMaterial
                  color={COLORS.doorGlow}
                  emissive={COLORS.doorEmissive}
                  emissiveIntensity={0.25}
               />
            </mesh>

            {/* Keypad scanner on the right post */}
            <mesh position={[1.15, 1.15, -0.02]}>
               <boxGeometry args={[0.22, 0.32, 0.08]} />
               <meshStandardMaterial color={COLORS.doorFrame} roughness={0.5} />
            </mesh>
            <mesh position={[1.15, 1.15, 0.025]}>
               <boxGeometry args={[0.16, 0.24, 0.02]} />
               <meshStandardMaterial
                  ref={(m) => { set.glow = m; }}
                  color="#292524"
                  emissive={COLORS.doorEmissive}
                  emissiveIntensity={0.2}
               />
            </mesh>
            <DoorLeaf hinge={(g) => { set.leaf = g; }} />
         </group>
      </group>
   );
}

export function createMoving(stations = 4, items = 3): Moving {
   return {
      drawer: Array(stations).fill(null),
      hinge: Array(stations).fill(null),
      roof: Array(stations).fill(null),
      box: Array(stations).fill(null),
      lid: Array(stations).fill(null),
      loot: Array(items).fill(null),
      leaf: null,
      glow: null,
      doorFrameGlow: null,
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

/**
 * About 1.4 tall, arms down, facing +z. L = the runner's left = +x, as in core/rig, so Scene
 * points each limb group along its own side's bone (standIn.ts).
 * Styled with 2-3 deliberate tones from COLORS (jacket, collar, trousers, boots, hair).
 */
export function PrimitiveRunner({ limbs }: { limbs: MutableRefObject<RunnerLimbs> }) {
   const set = (key: keyof RunnerLimbs) => (g: Group | null) => {
      limbs.current[key] = g;
   };
   return (
      <group ref={set("bob")} name="runner-body">
         {/* Adventure jacket torso with collar */}
         <mesh position={[0, 0.72, 0]}>
            <boxGeometry args={[0.42, 0.46, 0.26]} />
            <meshStandardMaterial color={COLORS.runnerJacket} roughness={0.6} />
         </mesh>
         <mesh position={[0, 0.94, 0.02]}>
            <boxGeometry args={[0.22, 0.08, 0.24]} />
            <meshStandardMaterial color={COLORS.runnerSkin} roughness={0.5} />
         </mesh>

         {/* Head with skin and hair */}
         <mesh position={[0, 1.12, 0]}>
            <sphereGeometry args={[0.18, 14, 12]} />
            <meshStandardMaterial color={COLORS.runnerSkin} roughness={0.55} />
         </mesh>
         <mesh position={[0, 1.2, -0.04]}>
            <sphereGeometry args={[0.17, 10, 10]} />
            <meshStandardMaterial color={COLORS.runnerHair} roughness={0.7} />
         </mesh>
         <mesh position={[0, 1.24, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.17, 0.035, 6, 14]} />
            <meshStandardMaterial color={COLORS.runnerBadge} metalness={0.5} roughness={0.35} />
         </mesh>

         {/* Left leg (trousers + boot) */}
         <group ref={set("legL")} position={[0.1, 0.46, 0]}>
            <mesh position={[0, -0.16, 0]}>
               <capsuleGeometry args={[0.07, 0.22, 4, 8]} />
               <meshStandardMaterial color={COLORS.runnerTrousers} roughness={0.7} />
            </mesh>
            <mesh position={[0, -0.32, 0.02]}>
               <boxGeometry args={[0.11, 0.1, 0.16]} />
               <meshStandardMaterial color={COLORS.runnerBoots} roughness={0.8} />
            </mesh>
         </group>

         {/* Right leg (trousers + boot) */}
         <group ref={set("legR")} position={[-0.1, 0.46, 0]}>
            <mesh position={[0, -0.16, 0]}>
               <capsuleGeometry args={[0.07, 0.22, 4, 8]} />
               <meshStandardMaterial color={COLORS.runnerTrousers} roughness={0.7} />
            </mesh>
            <mesh position={[0, -0.32, 0.02]}>
               <boxGeometry args={[0.11, 0.1, 0.16]} />
               <meshStandardMaterial color={COLORS.runnerBoots} roughness={0.8} />
            </mesh>
         </group>

         {/* Left arm (jacket sleeve + cuff) */}
         <group ref={set("armL")} position={[0.28, 0.86, 0]}>
            <mesh position={[0, -0.18, 0]}>
               <capsuleGeometry args={[0.055, 0.22, 4, 8]} />
               <meshStandardMaterial color={COLORS.runnerJacket} roughness={0.6} />
            </mesh>
         </group>

         {/* Right arm (jacket sleeve + cuff) */}
         <group ref={set("armR")} position={[-0.28, 0.86, 0]}>
            <mesh position={[0, -0.18, 0]}>
               <capsuleGeometry args={[0.055, 0.22, 4, 8]} />
               <meshStandardMaterial color={COLORS.runnerJacket} roughness={0.6} />
            </mesh>
         </group>
      </group>
   );
}
