"use client";

// Everything in the mine that is not terrain: boulders (wobble, fall), beetles (walk, tunnel, crushed),
// lanterns (lit / dark, a warm bloom), the lift cage, rails and ore carts, orbs, secrets, cave decor
// (crystals, glow mushrooms, stalagmites, hanging crystals) and the lantern + torch lights.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, Euler, InstancedMesh, Matrix4, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial, type PointLight } from "three";
import { DynamicInstancedModel, Model } from "../../core/assets";
import { useGameTime } from "../../core/gameTime";
import { createRng } from "../../core/math";
import { useJuice } from "../../menu2/juice";
import { ASSETS } from "./assets";
import { BOULDER, T, isOpen, type World } from "./rules";
import { CELL, VIEW_ROWS, cellX, cellY, floorY } from "./space";
import { lookFor } from "./look";

const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3();

const near = (focus: MutableRefObject<number>, r: number, pad = 0) => Math.abs(r - focus.current) <= VIEW_ROWS + pad;

function Boulders({ world, focus }: { world: World; focus: MutableRefObject<number> }) {
   const time = useGameTime();
   const cap = world.boulders.length + 8;
   return (
      <DynamicInstancedModel
         asset={ASSETS.boulder}
         count={cap}
         update={(i, matrix) => {
            const b = world.boulders[i];
            if (!b || !b.alive) return false;
            const y = b.state === "fall" ? b.y : b.row;
            if (!near(focus, y, 1)) return false;
            const wob = b.state === "wobble" ? Math.sin(time.now * 38 + i) * 0.09 * (0.4 + b.t / BOULDER.wobbleMs) : 0;
            const spin = b.state === "fall" ? b.y * 1.7 : 0;
            Q.setFromEuler(E.set(spin * 0.3, i * 1.3, wob * 1.8));
            V.set(cellX(world.w, b.col) + wob, floorY(y), 0.05);
            matrix.compose(V, Q, S.set(1, 1, 1));
         }}
      />
   );
}

function Beetles({ world, focus }: { world: World; focus: MutableRefObject<number> }) {
   const time = useGameTime();
   const lists = useMemo(() => ({ walk: world.beetles.filter((x) => !x.tunneller), dig: world.beetles.filter((x) => x.tunneller) }), [world]);
   const draw = (tunneller: boolean) => (i: number, matrix: Matrix4) => {
      const b = (tunneller ? lists.dig : lists.walk)[i];
      if (!b) return false;
      if (!b.alive && (b.deadMs < 0 || b.deadMs > 700)) return false;
      const k = b.moving ? Math.min(1, b.t / b.dur) : 1;
      const c = b.fc + (b.col - b.fc) * k;
      const r = b.fr + (b.row - b.fr) * k;
      if (!near(focus, r, 1)) return false;
      const squash = b.alive ? 1 : Math.max(0.05, 1 - b.deadMs / 300);
      const bob = b.alive ? Math.abs(Math.sin(time.now * 9 + i)) * 0.04 : 0;
      Q.setFromEuler(E.set(0, b.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0));
      V.set(cellX(world.w, c), floorY(r) + bob, 0.1);
      matrix.compose(V, Q, S.set(1, squash, 1));
   };
   const walkers = world.beetles.filter((b) => !b.tunneller).length;
   const tunnellers = world.beetles.length - walkers;
   return (
      <>
         {walkers > 0 && <DynamicInstancedModel asset={ASSETS.beetle} count={walkers} update={draw(false)} />}
         {tunnellers > 0 && <DynamicInstancedModel asset={ASSETS.tunneller} count={tunnellers} update={draw(true)} />}
      </>
   );
}

/** Lantern posts (hanging lanterns) with a glow sprite: dark until a hero passes, then warm. */
function Lanterns({ world, focus, color }: { world: World; focus: MutableRefObject<number>; color: string }) {
   const spots = useMemo(() => {
      const out: { i: number; c: number; r: number }[] = [];
      world.lantern.forEach((v, i) => {
         if (v) out.push({ i, c: i % world.w, r: Math.floor(i / world.w) });
      });
      return out;
   }, [world]);
   const glow = useRef<InstancedMesh>(null);
   const time = useGameTime();
   const m4 = useMemo(() => new Matrix4(), []);
   const tint = useMemo(() => new Color(), []);
   const base = useMemo(() => new Color(color), [color]);
   useFrame(() => {
      const g = glow.current;
      if (!g) return;
      spots.forEach((s, k) => {
         const lit = world.lanternLit[s.i] === 1;
         const flick = lit ? 1 + Math.sin(time.now * 13 + k) * 0.06 + Math.sin(time.now * 5.3 + k * 2) * 0.05 : 0.18;
         m4.makeScale(flick * 1.6, flick * 1.6, 1);
         m4.setPosition(cellX(world.w, s.c) + 0.45, cellY(s.r) + 0.22, 0.3);
         g.setMatrixAt(k, m4);
         tint.copy(base).multiplyScalar(lit ? 1 : 0.25);
         g.setColorAt(k, tint);
      });
      g.count = spots.length;
      g.instanceMatrix.needsUpdate = true;
      if (g.instanceColor) g.instanceColor.needsUpdate = true;
   });
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.lantern}
            count={spots.length}
            update={(i, matrix) => {
               const s = spots[i];
               if (!near(focus, s.r, 2)) return false;
               // hung from the cell's ceiling on its handle, a little to the right of centre
               Q.setFromEuler(E.set(0, 0.3, Math.sin(time.now * 1.4 + i) * 0.05));
               V.set(cellX(world.w, s.c) + 0.45, cellY(s.r) + CELL / 2 - 0.68, 0.3);
               matrix.compose(V, Q, S.set(1, 1, 1));
            }}
         />
         <instancedMesh ref={glow} args={[undefined, undefined, Math.max(1, spots.length)]} frustumCulled={false} renderOrder={5}>
            <circleGeometry args={[0.5, 24]} />
            <meshBasicMaterial transparent opacity={0.4} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </instancedMesh>
      </>
   );
}

/** Rails along every rail line, the parked carts, and a cart under each riding hero. */
function Rails({ world, focus }: { world: World; focus: MutableRefObject<number> }) {
   const ties = useMemo(() => {
      const out: { c: number; r: number }[] = [];
      for (const s of world.map.rails) for (let c = s.c0; c <= s.c1; c++) out.push({ c, r: s.row });
      return out;
   }, [world]);
   if (ties.length === 0) return null;
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.rail}
            count={ties.length}
            update={(i, matrix) => {
               const t = ties[i];
               if (!near(focus, t.r, 1)) return false;
               V.set(cellX(world.w, t.c), floorY(t.r) + 0.02, 0);
               matrix.compose(V, Q.identity(), S.set(1, 1, 1));
            }}
         />
         <DynamicInstancedModel
            asset={ASSETS.cart}
            count={world.map.rails.length + world.heroes.length}
            update={(i, matrix) => {
               // a riding hero's cart; else each line's cart parked at its far end
               if (i < world.heroes.length) {
                  const h = world.heroes[i];
                  if (!h.riding && h.act !== "ride") return false;
                  V.set(cellX(world.w, h.px), floorY(h.py) + 0.06, 0);
               } else {
                  const s = world.map.rails[i - world.heroes.length];
                  if (world.heroes.some((h) => h.riding && h.row === s.row)) return false;
                  if (!near(focus, s.row, 1)) return false;
                  V.set(cellX(world.w, s.c0), floorY(s.row) + 0.06, 0);
               }
               matrix.compose(V, Q.identity(), S.set(1, 1, 1));
            }}
         />
      </>
   );
}

/** The lift cage at the bottom: shut (dark) until L5's boss falls, then it glows and bobs. */
function Lift({ world }: { world: World }) {
   const ref = useRef<Group>(null);
   const beacon = useRef<Mesh>(null);
   const time = useGameTime();
   const { col, row } = world.map.lift;
   useFrame(() => {
      if (ref.current) ref.current.position.y = floorY(row) + (world.liftOpen ? Math.sin(time.now * 2) * 0.03 : -0.02);
      if (beacon.current) {
         (beacon.current.material as MeshBasicMaterial).opacity = world.liftOpen ? 0.55 + Math.sin(time.now * 4) * 0.2 : 0.08;
         beacon.current.scale.setScalar(world.liftOpen ? 1 + Math.sin(time.now * 4) * 0.08 : 0.7);
      }
   });
   return (
      <group ref={ref} position={[cellX(world.w, col), floorY(row), 0]}>
         <Model asset={ASSETS.lift} />
         <mesh ref={beacon} position={[0, 0.9, 0.5]}>
            <circleGeometry args={[1.0, 32]} />
            <meshBasicMaterial color="#86efac" transparent opacity={0.4} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </mesh>
      </group>
   );
}

/** Orbs: free orbs float and spin; ore orbs show as a glint in their cell; the magnet's trail orbs in rock pulse. */
function Orbs({ world, focus, color }: { world: World; focus: MutableRefObject<number>; color: string }) {
   const ref = useRef<InstancedMesh>(null);
   const time = useGameTime();
   const cells = useMemo(() => {
      const out: number[] = [];
      world.map.orb.forEach((v, i) => {
         if (v && world.map.tiles[i] !== T.ORE) out.push(i);
      });
      return out;
   }, [world]);
   const m4 = useMemo(() => new Matrix4(), []);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      let n = 0;
      for (const i of cells) {
         if (!world.orb[i]) continue;
         const c = i % world.w;
         const r = Math.floor(i / world.w);
         if (!near(focus, r, 1)) continue;
         const inRock = !isOpen(world.tiles[i]);
         const s = inRock ? 0.22 + Math.sin(time.now * 3 + i) * 0.04 : 0.3;
         m4.makeScale(s, s, s);
         m4.setPosition(cellX(world.w, c), cellY(r) + Math.sin(time.now * 2.5 + i) * 0.1, inRock ? CELL / 2 + 0.05 : 0);
         m.setMatrixAt(n++, m4);
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
   });
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, cells.length)]} frustumCulled={false}>
         <icosahedronGeometry args={[1, 2]} />
         <meshStandardMaterial color="#ffb4a0" emissive={color} emissiveIntensity={2.2} roughness={0.25} metalness={0.1} />
      </instancedMesh>
   );
}

/** Secret pickups: shards (gold octahedra) and the sticker (a spinning card). */
function Secrets({ world, focus }: { world: World; focus: MutableRefObject<number> }) {
   const items = useMemo(() => {
      const out: { i: number; c: number; r: number; id: number }[] = [];
      world.secret.forEach((v, i) => {
         if (v) out.push({ i, c: i % world.w, r: Math.floor(i / world.w), id: v - 1 });
      });
      return out;
   }, [world]);
   const refs = useRef<(Group | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      items.forEach((it, k) => {
         const g = refs.current[k];
         if (!g) return;
         const taken = world.heroes.some((h) => h.secrets.found[it.id]);
         g.visible = !taken && near(focus, it.r, 1);
         g.rotation.y = time.now * 1.8;
         g.position.y = cellY(it.r) + Math.sin(time.now * 2.4 + k) * 0.12;
      });
   });
   return (
      <>
         {items.map((it, k) => (
            <group key={it.i} ref={(g) => { refs.current[k] = g; }} position={[cellX(world.w, it.c), cellY(it.r), 0]}>
               {it.id === 1 ? (
                  <mesh>
                     <boxGeometry args={[0.55, 0.55, 0.04]} />
                     <meshStandardMaterial color="#fde68a" emissive="#f59e0b" emissiveIntensity={0.9} />
                  </mesh>
               ) : (
                  <mesh>
                     <octahedronGeometry args={[0.32, 0]} />
                     <meshStandardMaterial color={it.id === 0 ? "#e9d5ff" : "#fde68a"} emissive={it.id === 0 ? "#a855f7" : "#f59e0b"} emissiveIntensity={1.4} metalness={0.3} roughness={0.25} />
                  </mesh>
               )}
            </group>
         ))}
      </>
   );
}

/** Cave decor on open cells with a floor: crystals, glow mushrooms, stalagmites; hanging crystals under ceilings. */
function Decor({ world, focus }: { world: World; focus: MutableRefObject<number> }) {
   const spots = useMemo(() => {
      const rnd = createRng(4400 + world.level * 31);
      const floor: { c: number; r: number; kind: number; rot: number }[] = [];
      const hang: { c: number; r: number; rot: number }[] = [];
      const m = world.map;
      for (let r = 2; r < m.h - 1; r++) {
         for (let c = 1; c < m.w - 1; c++) {
            const i = r * m.w + c;
            if (m.tiles[i] !== T.EMPTY || m.lantern[i] || m.secret[i] || m.orb[i] || m.rail[i]) continue;
            if (c === m.lift.col && r === m.lift.row) continue;
            if (m.boulders.some((b) => b.col === c && b.row === r)) continue;
            if (m.beetles.some((b) => b.col === c && b.row === r)) continue;
            const below = m.tiles[i + m.w];
            const above = m.tiles[i - m.w];
            const wide = m.tiles[i - 1] === T.EMPTY && m.tiles[i + 1] === T.EMPTY;
            if (below === T.ROCK && wide && rnd() < 0.18) floor.push({ c, r, kind: Math.floor(rnd() * 3), rot: rnd() * 6.28 });
            else if (above === T.ROCK && wide && rnd() < 0.12) hang.push({ c, r, rot: rnd() * 6.28 });
         }
      }
      return { floor, hang };
   }, [world]);
   const pick = (kind: number) => spots.floor.filter((s) => s.kind === kind);
   const place = (list: { c: number; r: number; rot: number }[], top: boolean) => (i: number, matrix: Matrix4) => {
      const s = list[i];
      if (!near(focus, s.r, 1)) return false;
      Q.setFromEuler(E.set(top ? Math.PI : 0, s.rot, 0));
      // behind the tunnel's centre line, against the back wall, so they never hide the hero
      V.set(cellX(world.w, s.c) + (s.rot - 3) * 0.08, top ? cellY(s.r) + CELL / 2 : floorY(s.r), -0.45);
      matrix.compose(V, Q, S.set(1, 1, 1));
   };
   const crystals = pick(0);
   const mush = pick(1);
   const stal = pick(2);
   return (
      <>
         {crystals.length > 0 && <DynamicInstancedModel asset={ASSETS.crystal} count={crystals.length} update={place(crystals, false)} />}
         {mush.length > 0 && <DynamicInstancedModel asset={ASSETS.mushrooms} count={mush.length} update={place(mush, false)} />}
         {stal.length > 0 && <DynamicInstancedModel asset={ASSETS.stalagmites} count={stal.length} update={place(stal, false)} />}
         {spots.hang.length > 0 && <DynamicInstancedModel asset={ASSETS.hanging} count={spots.hang.length} update={place(spots.hang, true)} />}
      </>
   );
}

/** The rockfall front (L4): rubble piles along the line as it comes down. */
function Rockfall({ world }: { world: World }) {
   if (!world.cfg.rockfall) return null;
   return (
      <DynamicInstancedModel
         asset={ASSETS.pile}
         count={world.w}
         update={(i, matrix) => {
            if (world.rockRow < 0 || i % 2) return false;
            Q.setFromEuler(E.set(0, i * 1.7, 0));
            V.set(cellX(world.w, i), floorY(world.rockRow) + CELL - 0.2, 0.4);
            matrix.compose(V, Q, S.set(1, 1, 1));
         }}
      />
   );
}

/** The hero's torch and the three nearest lit lanterns: the only real point lights in the mine. */
function Lights({ world, focus }: { world: World; focus: MutableRefObject<number> }) {
   const look = lookFor(world.level);
   const torch = useRef<PointLight>(null);
   const pool = [useRef<PointLight>(null), useRef<PointLight>(null), useRef<PointLight>(null)];
   const time = useGameTime();
   const lanterns = useMemo(() => {
      const out: number[] = [];
      world.lantern.forEach((v, i) => v && out.push(i));
      return out;
   }, [world]);
   useFrame(() => {
      const h = world.heroes[0];
      if (torch.current && h) {
         torch.current.position.set(cellX(world.w, h.px) + h.facing * 0.4, floorY(h.py) + 1.3, 1.6);
         torch.current.intensity = 26 + Math.sin(time.now * 11) * 1.5;
      }
      const lit = lanterns.filter((i) => world.lanternLit[i]).sort((a, b) => Math.abs(Math.floor(a / world.w) - focus.current) - Math.abs(Math.floor(b / world.w) - focus.current));
      pool.forEach((p, k) => {
         const l = p.current;
         if (!l) return;
         const i = lit[k];
         l.visible = i !== undefined;
         if (i === undefined) return;
         l.position.set(cellX(world.w, i % world.w) + 0.45, cellY(Math.floor(i / world.w)) + 0.1, 1.2);
         l.intensity = 20 + Math.sin(time.now * 9 + k) * 1.5;
      });
   });
   return (
      <>
         <pointLight ref={torch} color={look.torch} intensity={26} distance={10} decay={1.6} />
         {pool.map((p, k) => (
            <pointLight key={k} ref={p} color={look.lantern} intensity={20} distance={11} decay={1.6} />
         ))}
      </>
   );
}

export function Props({ world, focus }: { world: World; focus: MutableRefObject<number> }) {
   const look = lookFor(world.level);
   const juice = useJuice();
   useEffect(() => void juice, [juice]);
   return (
      <>
         <Boulders world={world} focus={focus} />
         <Beetles world={world} focus={focus} />
         <Lanterns world={world} focus={focus} color={look.lantern} />
         <Rails world={world} focus={focus} />
         <Lift world={world} />
         <Orbs world={world} focus={focus} color={look.ore} />
         <Secrets world={world} focus={focus} />
         <Decor world={world} focus={focus} />
         <Rockfall world={world} />
         <Lights world={world} focus={focus} />
      </>
   );
}
