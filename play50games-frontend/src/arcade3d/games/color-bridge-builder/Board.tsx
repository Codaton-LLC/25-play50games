"use client";

// The canyon board, cell (r, c) at x = 2c, z = 2r (row 0 the far side): rock isles (code slabs, two
// tones, a lip on every edge over the chasm), the abyss far below, energy nodes (m2EnergyNode, a glow
// in their colour), switches (m2ColorSwitch, a ring in the colour they make next), anchors
// (m2BridgeAnchor), prisms (m2LaserPrism, turned 45° to their mirror face), cracked rocks, the beams
// (thin light bars, bright where anchored), the light bridges (m2CrystalSlabBridge tinted to their
// colour; an orange one dims in its dark half-beat), orbs, the secret, the exit gate, the Keeper's plate
// and the drones. Tiles change only with world.version, so the static layers rebuild only then.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, Color, Euler, MeshStandardMaterial, OctahedronGeometry, Quaternion, SphereGeometry, Vector3, type Group, type Mesh } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "../../core/assets";
import { DynamicInstanced } from "../../core/render/DynamicInstanced";
import { Instanced } from "../../core/render/Instanced";
import { useGameTime } from "../../core/gameTime";
import { CELL, T } from "./levels";
import { flickerOn, plateColor, type World } from "./rules";
import { ASSETS } from "./assets";
import { MASK_COLOR, lookFor } from "./look";

const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3();
const ONE = new Vector3(1, 1, 1);
const COLORS: Record<number, Color> = Object.fromEntries(Object.entries(MASK_COLOR).map(([k, v]) => [k, new Color(v)]));
const DIM = new Color("#3a2a20");

export const cellPos = (r: number, c: number) => ({ x: c * CELL, z: r * CELL });

export function Board({ world }: { world: World }) {
   const look = lookFor(world.level);
   const time = useGameTime();
   const W = world.map.w;
   // re-layout on a tile change (cracked rock, a prism slid)
   const [version, setVersion] = useState(world.version);
   useFrame(() => {
      if (world.version !== version) setVersion(world.version);
   });
   const rock = useMemo(() => {
      void version;
      const top: { x: number; y: number; z: number }[] = [];
      const cracked: { x: number; y: number; z: number }[] = [];
      for (let r = 0; r < world.map.h; r++)
         for (let c = 0; c < W; c++) {
            const t = world.tiles[r * W + c];
            const base = world.map.tiles[r * W + c];
            if (base === T.CHASM && t === T.CHASM) continue;
            if (base === T.CHASM && t === T.PRISM) continue; // a prism floating over the chasm
            const p = cellPos(r, c);
            top.push({ x: p.x, y: 0, z: p.z });
            if (t === T.CRACKED) cracked.push({ x: p.x, y: 0, z: p.z });
         }
      return {
         top,
         cracked,
         slabs: top.map((p) => ({ ...p, y: -0.15, sx: CELL, sy: 0.3, sz: CELL })),
         bodies: top.map((p) => ({ ...p, y: -1.8, sx: CELL * 0.98, sy: 3, sz: CELL * 0.98 })),
         cracks: cracked.map((p) => ({ ...p, y: 0.7, sx: CELL * 0.85, sy: 1.4, sz: CELL * 0.85 })),
      };
   }, [version, world, W]);
   const parts = useMemo(() => {
      const box = new BoxGeometry(1, 1, 1);
      return {
         box,
         slab: new MeshStandardMaterial({ color: look.rockTop, roughness: 0.85 }),
         body: new MeshStandardMaterial({ color: look.rock, roughness: 0.95 }),
         crack: new MeshStandardMaterial({ color: "#8a6f5a", roughness: 0.9, emissive: new Color("#3b1d0f"), emissiveIntensity: 0.3 }),
         beam: [{ geometry: box, material: new MeshStandardMaterial({ color: "#ffffff", emissive: new Color("#ffffff"), emissiveIntensity: 1.6, roughness: 0.3, transparent: true, opacity: 0.85 }) }],
         orb: [{ geometry: new SphereGeometry(0.32, 16, 12), material: new MeshStandardMaterial({ color: "#f0abfc", emissive: new Color("#d946ef"), emissiveIntensity: 1.3, roughness: 0.25 }) }],
         gem: [{ geometry: new OctahedronGeometry(0.4, 0), material: new MeshStandardMaterial({ color: "#fde047", emissive: new Color("#eab308"), emissiveIntensity: 1.4, roughness: 0.3 }) }],
         glow: [{ geometry: new SphereGeometry(0.45, 16, 12), material: new MeshStandardMaterial({ color: "#ffffff", emissive: new Color("#ffffff"), emissiveIntensity: 2, roughness: 0.2 }) }],
      };
   }, [look]);
   useEffect(
      () => () => {
         parts.box.dispose();
         parts.slab.dispose();
         parts.body.dispose();
         parts.crack.dispose();
         for (const p of [...parts.beam, ...parts.orb, ...parts.gem, ...parts.glow]) {
            p.geometry.dispose();
            p.material.dispose();
         }
      },
      [parts]
   );
   const beamCap = 220;
   const bridgeCap = W * world.map.h;
   return (
      <>
         {/* rock isles: a pale top slab on a dark body */}
         <Instanced key={`t${rock.top.length}`} spots={rock.slabs}>
            <primitive object={parts.box} attach="geometry" />
            <primitive object={parts.slab} attach="material" />
         </Instanced>
         <Instanced key={`b${rock.top.length}`} spots={rock.bodies}>
            <primitive object={parts.box} attach="geometry" />
            <primitive object={parts.body} attach="material" />
         </Instanced>
         {rock.cracked.length > 0 && (
            <Instanced key={`c${rock.cracked.length}`} spots={rock.cracks}>
               <primitive object={parts.box} attach="geometry" />
               <primitive object={parts.crack} attach="material" />
            </Instanced>
         )}
         {/* the abyss */}
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(W * CELL) / 2, -14, (world.map.h * CELL) / 2]}>
            <planeGeometry args={[W * CELL + 120, world.map.h * CELL + 120]} />
            <meshStandardMaterial color={look.abyss} roughness={1} />
         </mesh>
         {/* nodes, anchors, switches */}
         {world.map.nodes.length > 0 && <InstancedModel asset={ASSETS.node} spots={world.map.nodes.map(([r, c]) => ({ ...cellPos(r, c), y: 0, rotY: 0 }))} fallback={null} />}
         <NodeGlows world={world} parts={parts.glow} />
         <AnchorModels world={world} />
         {world.map.switches.length > 0 && <InstancedModel asset={ASSETS.switch} spots={world.map.switches.map(([r, c]) => ({ ...cellPos(r, c), y: 0 }))} fallback={null} />}
         <SwitchRings world={world} />
         {/* prisms (they turn and slide) */}
         {world.prismCell.length > 0 && (
            <DynamicInstancedModel
               asset={ASSETS.prism}
               count={world.prismCell.length}
               update={(i, m) => {
                  const k = world.prismCell[i];
                  if (k === undefined) return false;
                  const p = cellPos(Math.floor(k / W), k % W);
                  Q.setFromEuler(E.set(0, world.prismKind[i] === 0 ? Math.PI / 4 : -Math.PI / 4, 0));
                  m.compose(V.set(p.x, 0, p.z), Q, ONE);
               }}
            />
         )}
         {/* the beams: a light bar per lit cell */}
         <DynamicInstanced
            count={beamCap}
            parts={parts.beam}
            tinted
            update={(i, m, color) => {
               let n = i;
               for (const b of world.beams) {
                  if (n >= b.cells.length) {
                     n -= b.cells.length;
                     continue;
                  }
                  const k = b.cells[n];
                  const r = Math.floor(k / W);
                  const c = k % W;
                  const prev = n > 0 ? b.cells[n - 1] : world.map.nodes[b.node][0] * W + world.map.nodes[b.node][1];
                  const vertical = Math.floor(prev / W) !== r;
                  const p = cellPos(r, c);
                  const thick = b.anchored ? 0.14 : 0.07;
                  m.compose(V.set(p.x, 1.05 + Math.sin(time.now * 6 + i) * 0.02, p.z), Q.identity(), S.set(vertical ? thick : CELL, thick, vertical ? CELL : thick));
                  color.copy(COLORS[b.colors[n]] ?? COLORS[7]);
                  return;
               }
               return false;
            }}
         />
         {/* the light bridges */}
         <DynamicInstancedModel
            asset={ASSETS.slab}
            count={bridgeCap}
            tinted
            update={(i, m, color) => {
               const mask = world.bridge[i];
               if (!mask) return false;
               const r = Math.floor(i / W);
               const c = i % W;
               const p = cellPos(r, c);
               // along the beam: horizontal neighbours lit -> east-west
               const ew = (world.bridge[i - 1] && c > 0) || (world.bridge[i + 1] && c < W - 1) || world.tiles[i - 1] !== T.CHASM || world.tiles[i + 1] !== T.CHASM;
               const vertical = !!(world.bridge[i - W] || world.bridge[i + W]);
               Q.setFromEuler(E.set(0, vertical && !(ew && !vertical) ? Math.PI / 2 : 0, 0));
               m.compose(V.set(p.x, -0.12, p.z), Q, ONE);
               color.copy(mask === 5 && !flickerOn(world.ms) ? DIM : COLORS[mask] ?? COLORS[7]);
            }}
         />
         {/* orbs and the secret */}
         <DynamicInstanced
            count={Math.max(1, world.map.orbs.length)}
            parts={parts.orb}
            update={(i, m) => {
               const o = world.map.orbs[i];
               if (!o || world.teams.every((t) => t.orbsTaken[i])) return false;
               const p = cellPos(o[0], o[1]);
               m.compose(V.set(p.x, 0.9 + Math.sin(time.now * 2.5 + i) * 0.12, p.z), Q.identity(), ONE);
            }}
         />
         {world.map.secret && (
            <DynamicInstanced
               count={1}
               parts={parts.gem}
               update={(_i, m) => {
                  const s = world.map.secret!;
                  if (world.teams.every((t) => t.secrets.found[world.cfg.secret])) return false;
                  const p = cellPos(s[0], s[1]);
                  Q.setFromEuler(E.set(0, time.now * 1.5, 0));
                  m.compose(V.set(p.x, 1, p.z), Q, ONE);
               }}
            />
         )}
         <ExitGate world={world} />
         {world.map.plate && <Plate world={world} />}
         {world.cfg.drones.length > 0 && (
            <DynamicInstancedModel
               asset={ASSETS.drone}
               count={world.drones.length}
               update={(i, m) => {
                  const d = world.drones[i];
                  if (!d) return false;
                  const p = cellPos(d.r, d.c);
                  Q.setFromEuler(E.set(0, time.now * 0.8 + i, 0));
                  m.compose(V.set(p.x, 0.6 + Math.sin(time.now * 4 + i) * 0.1, p.z), Q, ONE);
               }}
            />
         )}
         {/* the canyon around: rock walls and floating isles */}
         <InstancedModel
            asset={ASSETS.canyon}
            spots={[
               { x: -26, y: -16, z: (world.map.h * CELL) / 2, rotY: Math.PI / 2 },
               { x: W * CELL + 26, y: -16, z: (world.map.h * CELL) / 2, rotY: -Math.PI / 2 },
            ]}
            fallback={null}
         />
         <InstancedModel
            asset={ASSETS.isle}
            spots={[
               { x: -10, y: -6, z: 6 },
               { x: W * CELL + 9, y: -4, z: 14 },
               { x: -12, y: -3, z: world.map.h * CELL - 6 },
               { x: W * CELL + 12, y: -7, z: world.map.h * CELL - 2 },
            ]}
            fallback={null}
         />
      </>
   );
}

function NodeGlows({ world, parts }: { world: World; parts: { geometry: SphereGeometry; material: MeshStandardMaterial }[] }) {
   const time = useGameTime();
   return (
      <DynamicInstanced
         count={Math.max(1, world.map.nodes.length)}
         parts={parts}
         tinted
         update={(i, m, color) => {
            const n = world.map.nodes[i];
            if (!n) return false;
            const p = cellPos(n[0], n[1]);
            const on = world.nodeColor[i];
            const s = on ? 1 + Math.sin(time.now * 5 + i) * 0.08 : 0.55;
            m.compose(V.set(p.x, 1.25, p.z), Q.identity(), S.set(s, s, s));
            color.copy(COLORS[on] ?? COLORS[0]);
         }}
      />
   );
}

function AnchorModels({ world }: { world: World }) {
   const spots = useMemo(() => {
      const out: { x: number; y: number; z: number }[] = [];
      world.map.tiles.forEach((t, k) => {
         if (t === T.ANCHOR) out.push({ ...cellPos(Math.floor(k / world.map.w), k % world.map.w), y: 0 });
      });
      return out;
   }, [world]);
   if (!spots.length) return null;
   return <InstancedModel asset={ASSETS.anchor} spots={spots} fallback={null} />;
}

/** a ring over each switch in the colour its node shows now */
function SwitchRings({ world }: { world: World }) {
   const refs = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      world.map.switches.forEach(([, , node], i) => {
         const m = refs.current[i];
         if (!m) return;
         (m.material as MeshStandardMaterial).color.copy(COLORS[world.nodeColor[node]] ?? COLORS[0]);
         (m.material as MeshStandardMaterial).emissive.copy(COLORS[world.nodeColor[node]] ?? COLORS[0]);
      });
   });
   return (
      <>
         {world.map.switches.map(([r, c], i) => {
            const p = cellPos(r, c);
            return (
               <mesh
                  key={i}
                  ref={(el) => {
                     refs.current[i] = el;
                  }}
                  position={[p.x, 0.08, p.z]}
                  rotation={[-Math.PI / 2, 0, 0]}
               >
                  <ringGeometry args={[0.75, 0.95, 32]} />
                  <meshStandardMaterial emissiveIntensity={1.2} />
               </mesh>
            );
         })}
      </>
   );
}

function ExitGate({ world }: { world: World }) {
   const bar = useRef<Mesh>(null);
   const p = cellPos(world.map.exit[0], world.map.exit[1]);
   useFrame(() => {
      if (bar.current) bar.current.visible = !world.exitOpen;
   });
   return (
      <group position={[p.x, 0, p.z]}>
         <group position={[-0.95, 0, 0]}>
            <Model asset={ASSETS.pylon} />
         </group>
         <group position={[0.95, 0, 0]}>
            <Model asset={ASSETS.pylon} />
         </group>
         <mesh position={[0, 2.25, 0]}>
            <boxGeometry args={[2.3, 0.2, 0.3]} />
            <meshStandardMaterial color="#f8fafc" emissive="#e2e8f0" emissiveIntensity={0.8} />
         </mesh>
         <mesh ref={bar} position={[0, 1.1, 0]}>
            <boxGeometry args={[1.7, 2, 0.12]} />
            <meshStandardMaterial color="#ef4444" emissive="#b91c1c" emissiveIntensity={0.8} transparent opacity={0.55} />
         </mesh>
      </group>
   );
}

/** L5: the Keeper's plate, glowing in what reaches it, ringed in what it wants */
function Plate({ world }: { world: World }) {
   const disc = useRef<Mesh>(null);
   const ring = useRef<Mesh>(null);
   const g = useRef<Group>(null);
   const [r, c] = world.map.plate!;
   const p = cellPos(r, c);
   useFrame(() => {
      const got = plateColor(world);
      const k = world.keeper;
      if (disc.current) {
         const m = disc.current.material as MeshStandardMaterial;
         m.color.copy(COLORS[got] ?? COLORS[0]);
         m.emissive.copy(COLORS[got] ?? COLORS[0]);
      }
      if (ring.current && k) {
         const m = ring.current.material as MeshStandardMaterial;
         m.color.copy(COLORS[k.wants] ?? COLORS[7]);
         m.emissive.copy(COLORS[k.wants] ?? COLORS[7]);
         ring.current.visible = k.state.step === "vulnerable";
      }
      if (g.current) g.current.visible = !world.exitOpen;
   });
   return (
      <group ref={g} position={[p.x, 0, p.z]}>
         <mesh ref={disc} position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.8, 0.8, 0.25, 32]} />
            <meshStandardMaterial emissiveIntensity={1.4} />
         </mesh>
         <mesh ref={ring} position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.1, 0.12, 10, 40]} />
            <meshStandardMaterial emissiveIntensity={1.8} />
         </mesh>
      </group>
   );
}
