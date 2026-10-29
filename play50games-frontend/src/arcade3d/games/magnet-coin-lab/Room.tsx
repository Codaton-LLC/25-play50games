"use client";

// One lab room, drawn at roomX(k): the timber walls and floors (one InstancedMesh per tile kind) with
// snow on every open top, the polarity gates as glowing fields (+ red with ring marks, - blue with bar
// marks) in m2PolarityGate frames, rails, spark floors, lab glass (clear, cracked, ghost), the hidden
// wall until its vent is plugged, the brass door that opens when the quota is in; the pads (m2MagnetPad
// on the floor, m2HorseshoeMagnet nodes in the air) with their sign marks and field rings, the piggy
// bank and its progress ring, orbs, secrets, vents, the metal blocks and lab drones, and the lab
// machines behind. Tiles change only with world.version / the door / the vent, so the instance
// matrices are rebuilt then, never per frame.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BoxGeometry, Color, DoubleSide, InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, type Group, type Material, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstancedModel, Model } from "../../core/assets";
import { useGameTime } from "../../core/gameTime";
import { ASSETS } from "./assets";
import { T } from "./levels";
import type { RoomState, World } from "./rules";
import { POLE, lookFor, type LabLook } from "./look";
import { DEPTH, roomX } from "./space";

const O = new Object3D();
const M = new Matrix4();

interface Cell {
   x: number;
   y: number;
   sx?: number;
   sy?: number;
   sz?: number;
   z?: number;
}

/** One instanced layer of boxes (unit box, scaled per cell). */
function Boxes({ cells, material, geometry }: { cells: Cell[]; material: Material; geometry: BoxGeometry }) {
   const ref = useRef<InstancedMesh>(null);
   const cap = Math.max(1, cells.length);
   useLayoutEffect(() => {
      const m = ref.current;
      if (!m) return;
      cells.forEach((c, i) => {
         O.position.set(c.x, c.y, c.z ?? 0);
         O.rotation.set(0, 0, 0);
         O.scale.set(c.sx ?? 1, c.sy ?? 1, c.sz ?? DEPTH);
         O.updateMatrix();
         m.setMatrixAt(i, O.matrix);
      });
      m.count = cells.length;
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
   }, [cells]);
   return <instancedMesh key={cap} ref={ref} args={[geometry, material, cap]} frustumCulled={false} />;
}

function materialsFor(look: LabLook) {
   const std = (color: string, extra: Partial<MeshStandardMaterial> = {}) => Object.assign(new MeshStandardMaterial({ color, roughness: 0.78 }), extra);
   return {
      wall: std(look.wall),
      wallFace: std(look.wallDark),
      trim: std(look.trim, { metalness: 0.55, roughness: 0.35 }),
      snow: std(look.snow, { roughness: 0.95 }),
      rail: std("#9aa3ad", { metalness: 0.8, roughness: 0.3 }),
      spark: std("#2b2620", { emissive: new Color("#facc15"), emissiveIntensity: 0.55 }),
      glass: std("#bfe8f5", { transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0.1, depthWrite: false }),
      cracked: std("#d6f3ff", { transparent: true, opacity: 0.5, roughness: 0.2, emissive: new Color("#7dd3fc"), emissiveIntensity: 0.25, depthWrite: false }),
      ghost: std("#a78bfa", { transparent: true, opacity: 0.4, emissive: new Color("#7c3aed"), emissiveIntensity: 0.5, depthWrite: false }),
      hidden: std(look.wall, { emissive: new Color("#4c1d95"), emissiveIntensity: 0.12 }),
      gateP: std(POLE.plus, { transparent: true, opacity: 0.38, emissive: new Color(POLE.plus), emissiveIntensity: 0.9, depthWrite: false, side: DoubleSide }),
      gateN: std(POLE.minus, { transparent: true, opacity: 0.38, emissive: new Color(POLE.minus), emissiveIntensity: 0.9, depthWrite: false, side: DoubleSide }),
      door: std("#b7791f", { metalness: 0.65, roughness: 0.32 }),
      back: std(look.back, { roughness: 0.92 }),
      beam: std(look.backLine, { roughness: 0.9 }),
      window: new MeshStandardMaterial({ color: look.window, emissive: new Color(look.window), emissiveIntensity: 0.55, roughness: 1 }),
   };
}

export function Rooms({ world }: { world: World }) {
   const look = lookFor(world.level);
   const mats = useMemo(() => materialsFor(look), [look]);
   const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
   useEffect(
      () => () => {
         box.dispose();
         for (const m of Object.values(mats)) m.dispose();
      },
      [box, mats]
   );
   return (
      <>
         {world.rooms.map((room, k) => (
            <Room key={k} world={world} room={room} k={k} mats={mats} box={box} look={look} />
         ))}
      </>
   );
}

type Mats = ReturnType<typeof materialsFor>;

function Room({ world, room, k, mats, box, look }: { world: World; room: RoomState; k: number; mats: Mats; box: BoxGeometry; look: LabLook }) {
   const d = room.def;
   const ox = roomX(k);
   // re-layout when a tile changes (glass breaks, the vent opens) or the door opens
   const [stamp, setStamp] = useState("");
   useFrame(() => {
      const next = `${world.version}|${room.doorOpen ? 1 : 0}|${room.ventOpen ? 1 : 0}`;
      if (next !== stamp) setStamp(next);
   });
   const layers = useMemo(() => {
      void stamp;
      const L: Record<string, Cell[]> = { wall: [], snow: [], trim: [], rail: [], spark: [], glass: [], cracked: [], ghost: [], hidden: [], gateP: [], gateN: [], door: [] };
      const at = (c: number, r: number) => (c < 0 || c >= d.w || r < 0 || r >= d.h ? T.WALL : room.tiles[r * d.w + c]);
      for (let r = 0; r < d.h; r++)
         for (let c = 0; c < d.w; c++) {
            const t = room.tiles[r * d.w + c];
            const x = ox + c + 0.5;
            const y = d.h - 1 - r + 0.5;
            switch (t) {
               case T.WALL: {
                  L.wall.push({ x, y });
                  const above = at(c, r - 1);
                  if (r > 0 && above !== T.WALL && above !== T.HIDDEN) {
                     L.snow.push({ x, y: y + 0.5 + 0.05, sy: 0.1, sz: DEPTH + 0.04 });
                     L.trim.push({ x, y: y + 0.42, sy: 0.08, sz: 0.08, z: DEPTH / 2 + 0.02 });
                  }
                  break;
               }
               case T.RAIL:
                  L.rail.push({ x, y: y + 0.42, sy: 0.08, sz: 0.12, z: 0.45 });
                  L.rail.push({ x, y: y + 0.42, sy: 0.08, sz: 0.12, z: -0.45 });
                  break;
               case T.SPARK:
                  L.spark.push({ x, y });
                  break;
               case T.GLASS:
                  L.glass.push({ x, y, sx: 0.96, sy: 0.98, sz: 0.5 });
                  break;
               case T.CRACKED:
                  L.cracked.push({ x, y, sx: 0.9, sy: 0.98, sz: 0.5 });
                  break;
               case T.GHOST:
                  L.ghost.push({ x, y, sx: 0.96, sy: 0.98, sz: 0.8 });
                  break;
               case T.HIDDEN:
                  if (!room.ventOpen) L.hidden.push({ x, y });
                  break;
               case T.GATE_P:
                  L.gateP.push({ x, y, sx: 0.3, sz: 1.6 });
                  break;
               case T.GATE_N:
                  L.gateN.push({ x, y, sx: 0.3, sz: 1.6 });
                  break;
               case T.DOOR:
                  if (!room.doorOpen) L.door.push({ x, y, sx: 0.4, sz: 1.4 });
                  break;
            }
         }
      return L;
   }, [stamp, room, d, ox]);
   // gate columns (one frame per column, at its foot)
   const gates = useMemo(() => {
      const out: { x: number; y: number; h: number; sign: 1 | -1 }[] = [];
      for (let c = 0; c < d.w; c++) {
         let r = 0;
         while (r < d.h) {
            const t = d.tiles[r * d.w + c];
            if (t === T.GATE_P || t === T.GATE_N) {
               let e = r;
               while (e + 1 < d.h && d.tiles[(e + 1) * d.w + c] === t) e++;
               out.push({ x: ox + c + 0.5, y: d.h - 1 - e, h: e - r + 1, sign: t === T.GATE_P ? 1 : -1 });
               r = e + 1;
            } else r++;
         }
      }
      return out;
   }, [d, ox]);
   const doorY = d.door.y;
   return (
      <group>
         <Boxes cells={layers.wall} material={mats.wall} geometry={box} />
         <Boxes cells={layers.snow} material={mats.snow} geometry={box} />
         <Boxes cells={layers.trim} material={mats.trim} geometry={box} />
         {layers.rail.length > 0 && <Boxes cells={layers.rail} material={mats.rail} geometry={box} />}
         {layers.spark.length > 0 && <Boxes cells={layers.spark} material={mats.spark} geometry={box} />}
         {layers.glass.length > 0 && <Boxes cells={layers.glass} material={mats.glass} geometry={box} />}
         {layers.cracked.length > 0 && <Boxes cells={layers.cracked} material={mats.cracked} geometry={box} />}
         {layers.ghost.length > 0 && <Boxes cells={layers.ghost} material={mats.ghost} geometry={box} />}
         {(layers.hidden.length > 0 || d.vents.length > 0) && <Boxes cells={layers.hidden} material={mats.hidden} geometry={box} />}
         {layers.gateP.length > 0 && <Boxes cells={layers.gateP} material={mats.gateP} geometry={box} />}
         {layers.gateN.length > 0 && <Boxes cells={layers.gateN} material={mats.gateN} geometry={box} />}
         <Boxes cells={layers.door} material={mats.door} geometry={box} />
         {/* the back wall: timber boards, beams, two snowy windows */}
         <mesh material={mats.back} position={[ox + d.w / 2, d.h / 2, -DEPTH / 2 - 0.05]}>
            <planeGeometry args={[d.w, d.h]} />
         </mesh>
         {[4, 12, 20].map((bx) => (
            <mesh key={bx} material={mats.beam} position={[ox + bx, d.h / 2, -DEPTH / 2 + 0.05]}>
               <boxGeometry args={[0.35, d.h, 0.12]} />
            </mesh>
         ))}
         {[7.5, 16.5].map((wx) => (
            <mesh key={wx} material={mats.window} position={[ox + wx, d.h - 3, -DEPTH / 2 + 0.02]}>
               <planeGeometry args={[2.2, 1.6]} />
            </mesh>
         ))}
         {/* the open door: a glowing frame */}
         <DoorGlow room={room} x={ox + d.door.x} y={doorY} />
         {gates.map((g, i) => (
            <group key={i}>
               <group position={[g.x, g.y, 0]} scale={[1, Math.max(1, g.h / 1.4), 1]}>
                  <Model asset={ASSETS.gate} />
               </group>
               {Array.from({ length: g.h }, (_, j) => (
                  <SignMark key={j} sign={g.sign} x={g.x} y={g.y + j + 0.5} z={0.82} size={0.22} />
               ))}
            </group>
         ))}
         <Pads world={world} room={room} ox={ox} />
         <Bank room={room} ox={ox} />
         <Pickups world={world} room={room} ox={ox} />
         {d.vents.map((v, i) => (
            <mesh key={i} position={[ox + v.x, v.y + 0.06, 0]}>
               <boxGeometry args={[0.9, 0.12, 1.4]} />
               <meshStandardMaterial color={room.ventOpen ? "#16a34a" : "#475569"} emissive={room.ventOpen ? "#22c55e" : "#0f172a"} emissiveIntensity={0.6} metalness={0.6} roughness={0.4} />
            </mesh>
         ))}
         {room.blocks.length > 0 && (
            <DynamicInstancedModel
               asset={ASSETS.block}
               count={room.blocks.length}
               update={(i, m) => {
                  const b = room.blocks[i];
                  if (!b) return false;
                  m.makeTranslation(ox + b.x, b.y, 0);
               }}
            />
         )}
         <Drones room={room} ox={ox} />
         {/* the lab machines and a kiosk along the back wall, a platform at the start */}
         <group position={[ox + 2.2, 1, -0.75]}>
            <Model asset={ASSETS.machine} />
         </group>
         <group position={[ox + 14.5, 1, -0.8]} rotation={[0, -0.3, 0]}>
            <Model asset={ASSETS.kiosk} />
         </group>
         <group position={[ox + d.start.x, d.start.y - 0.38, -0.2]} scale={[1, 0.45, 1]}>
            <Model asset={ASSETS.platform} />
         </group>
         <pointLight position={[ox + 12, d.h - 1.5, 3]} intensity={look.ambient * 18} distance={22} color={look.light} />
      </group>
   );
}

/** + is a ring, - is a bar (a mark facing the camera). */
function SignMark({ sign, x, y, z, size }: { sign: number; x: number; y: number; z: number; size: number }) {
   return sign > 0 ? (
      <mesh position={[x, y, z]}>
         <torusGeometry args={[size, size * 0.28, 8, 24]} />
         <meshBasicMaterial color={POLE.plusGlow} />
      </mesh>
   ) : (
      <mesh position={[x, y, z]}>
         <boxGeometry args={[size * 2.2, size * 0.55, size * 0.4]} />
         <meshBasicMaterial color={POLE.minusGlow} />
      </mesh>
   );
}

function DoorGlow({ room, x, y }: { room: RoomState; x: number; y: number }) {
   const ref = useRef<Group>(null);
   const time = useGameTime();
   useFrame(() => {
      if (!ref.current) return;
      ref.current.visible = room.doorOpen;
      ref.current.scale.setScalar(1 + Math.sin(time.now * 4) * 0.03);
   });
   return (
      <group ref={ref} position={[x, y + 1, 0.2]} visible={false}>
         <mesh>
            <boxGeometry args={[0.12, 2.1, 1.5]} />
            <meshBasicMaterial color="#86efac" transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} />
         </mesh>
      </group>
   );
}

/** Floor pads (m2MagnetPad) and hanging nodes (m2HorseshoeMagnet), each with its sign mark and a field ring. */
function Pads({ world, room, ox }: { world: World; room: RoomState; ox: number }) {
   const rings = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      room.def.pads.forEach((p, i) => {
         const m = rings.current[i];
         if (!m) return;
         // the field ring breathes; it flares while a hero is in reach
         const near = world.heroes.some((h) => h.room === world.rooms.indexOf(room) && Math.hypot(h.x - p.x, h.y + 0.7 - p.y) < 7);
         const k = ((time.now * 0.8 + i * 0.37) % 1) * 1.2 + 0.4;
         m.scale.set(k, k, k);
         (m.material as MeshBasicMaterial).opacity = (1.6 - k) * (near ? 0.55 : 0.25);
      });
   });
   return (
      <>
         {room.def.pads.map((p, i) => (
            <group key={i} position={[ox + p.x, p.y, 0]}>
               {p.floor ? (
                  <Model asset={ASSETS.pad} />
               ) : (
                  <group position={[0, -0.45, 0]} rotation={[Math.PI, 0, 0]}>
                     <group position={[0, -1.0, 0]}>
                        <Model asset={ASSETS.node} />
                     </group>
                  </group>
               )}
               {!p.floor && (
                  <mesh position={[0, 0.5, 0]}>
                     <cylinderGeometry args={[0.03, 0.03, 1, 6]} />
                     <meshStandardMaterial color="#57534e" metalness={0.6} />
                  </mesh>
               )}
               <SignMark sign={p.sign} x={0} y={p.floor ? 0.55 : -0.1} z={0.75} size={0.2} />
               <mesh ref={(el) => {
                  rings.current[i] = el;
               }} position={[0, p.floor ? 0.12 : 0, 0]} rotation={p.floor ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
                  <ringGeometry args={[0.9, 1, 40]} />
                  <meshBasicMaterial color={p.sign > 0 ? POLE.plusGlow : POLE.minusGlow} transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} side={DoubleSide} />
               </mesh>
            </group>
         ))}
      </>
   );
}

/** The piggy bank with a gold progress ring over it (the quota), bouncing on each deposit. */
function Bank({ room, ox }: { room: RoomState; ox: number }) {
   const d = room.def;
   const root = useRef<Group>(null);
   const arc = useRef<Mesh>(null);
   const st = useRef({ seen: 0, bounce: 0, shown: -1 });
   useFrame((_, delta) => {
      const s = st.current;
      if (room.banked !== s.seen) {
         s.seen = room.banked;
         s.bounce = 1;
      }
      s.bounce = Math.max(0, s.bounce - delta * 4);
      if (root.current) root.current.scale.set(1 + s.bounce * 0.12, 1 - s.bounce * 0.1, 1 + s.bounce * 0.12);
      const frac = d.need ? Math.min(1, room.banked / d.need) : 1;
      if (arc.current && Math.abs(frac - s.shown) > 0.001) {
         s.shown = frac;
         arc.current.scale.set(1, 1, 1);
         arc.current.rotation.z = Math.PI / 2;
         const geo = arc.current.geometry;
         geo.setDrawRange(0, Math.floor((geo.index ? geo.index.count : 0) * frac / 6) * 6);
         (arc.current.material as MeshBasicMaterial).color.set(frac >= 1 ? "#86efac" : "#fcd34d");
      }
   });
   if (d.need === 0) return null;
   return (
      <group position={[ox + d.bank.x, d.bank.y, 0.1]}>
         <group ref={root}>
            <Model asset={ASSETS.piggy} />
         </group>
         <mesh position={[0, 2.25, 0.2]}>
            <ringGeometry args={[0.36, 0.48, 48]} />
            <meshBasicMaterial color="#3f2d20" transparent opacity={0.65} />
         </mesh>
         <mesh ref={arc} position={[0, 2.25, 0.22]}>
            <ringGeometry args={[0.36, 0.48, 48, 1]} />
            <meshBasicMaterial color="#fcd34d" />
         </mesh>
      </group>
   );
}

/** Orbs (taken ones gone) and the secrets (shards spin, the sticker is a flat disc). */
function Pickups({ world, room, ox }: { world: World; room: RoomState; ox: number }) {
   const orbs = useRef<(Mesh | null)[]>([]);
   const secrets = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      const t = time.now;
      room.def.orbs.forEach((o, i) => {
         const m = orbs.current[i];
         if (!m) return;
         m.visible = !room.orbsTaken[i];
         m.position.set(ox + o.x, o.y + Math.sin(t * 2.4 + i) * 0.1, 0.1);
      });
      room.def.secrets.forEach((s, i) => {
         const m = secrets.current[i];
         if (!m) return;
         m.visible = !world.heroes.some((h) => h.secrets.found[s.id]);
         m.rotation.y = t * 1.5;
      });
   });
   return (
      <>
         {room.def.orbs.map((o, i) => (
            <mesh key={i} ref={(el) => {
                  orbs.current[i] = el;
               }} position={[ox + o.x, o.y, 0.1]}>
               <sphereGeometry args={[0.22, 16, 12]} />
               <meshStandardMaterial color="#f9a8d4" emissive="#ec4899" emissiveIntensity={1.4} roughness={0.25} />
            </mesh>
         ))}
         {room.def.secrets.map((s, i) => (
            <mesh key={i} ref={(el) => {
                  secrets.current[i] = el;
               }} position={[ox + s.x, s.y, 0.1]}>
               {s.id === 1 ? <cylinderGeometry args={[0.32, 0.32, 0.06, 24]} /> : <octahedronGeometry args={[0.32, 0]} />}
               <meshStandardMaterial color={s.id === 1 ? "#fde047" : "#c4b5fd"} emissive={s.id === 1 ? "#eab308" : "#8b5cf6"} emissiveIntensity={1.2} roughness={0.3} />
            </mesh>
         ))}
      </>
   );
}

/** Lab drones: hovering, tilting into their flight, flashing when repelled; stolen coins ride under them (Coins.tsx). */
function Drones({ room, ox }: { room: RoomState; ox: number }) {
   const time = useGameTime();
   if (!room.drones.length) return null;
   return (
      <DynamicInstancedModel
         asset={ASSETS.drone}
         count={room.drones.length}
         update={(i, m) => {
            const d = room.drones[i];
            if (!d) return false;
            O.position.set(ox + d.x, d.y - 0.55 + Math.sin(time.now * 5 + i) * 0.06, 0);
            O.rotation.set(0, 0, -d.vx * 0.06 + (d.stunMs > 0 ? Math.sin(time.now * 30) * 0.4 : 0));
            O.scale.set(1, 1, 1);
            O.updateMatrix();
            m.copy(O.matrix);
         }}
      />
   );
}

export { M };
