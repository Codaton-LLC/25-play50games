"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Mesh, type Group } from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import { DynamicInstanced, Instanced } from "@/arcade3d/core/render";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { hover, type BodyOffset } from "@/arcade3d/core/motion";
import { advance, createPath, tangentAt } from "@/arcade3d/core/path";
import { ASSETS } from "./assets";
import { CITY, PIGEON, ROUTE, WIND, type Run, type City } from "./rules";
import { mergedBoxes, useBoxParts } from "./Primitives";

const UP = new Vector3(0, 1, 0);
const ONE = new Vector3(1, 1, 1);
const WIND_TILT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
const BUILDING_COLORS = ["#e2e8f0", "#cbd5e1", "#94a3b8"];
type BoxPiece = readonly [number, number, number, number, number, number, string];
const CRATES = [{ x: -2.6, y: 0, z: 2 }, { x: -2.6, y: 0, z: 3 }, { x: -2.6, y: 0.57, z: 2.5 }, { x: -3.5, y: 0, z: 2.5 }];
const CRATE_FALLBACK = CRATES.map((p) => ({ ...p, y: p.y + 0.285 }));
const TREES = [{ x: -3, y: 0, z: -3 }, { x: 3, y: 0, z: -3 }, { x: 3, y: 0, z: 3 }, { x: -3, y: 0, z: 4 }];
const STREETS = Array.from({ length: 7 }, (_, i) => ({ x: (i - 3) * CITY.pitch, y: 0.005, z: 0 }));

function CityChunks({ city }: { city: City }) {
   const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), []);
   const chunks = useMemo(() => Array.from({ length: 16 }, (_, i) => {
      const pieces: BoxPiece[] = [];
      for (const b of city.buildings) {
         if (Math.floor(b.cell / 16) * 4 + Math.floor((b.cell % 8) / 2) !== i) continue;
         pieces.push([b.x, b.height / 2, b.z, 5, b.height, 5, BUILDING_COLORS[b.cell % 3]]);
         pieces.push([b.x, b.height + 0.015, b.z, 5.04, 0.04, 5.04, "#64748b"]);
         for (let y = 1; y < b.height; y += 2) for (let column = -1; column <= 1; column++) {
            pieces.push([b.x + column * 1.2, y, b.z + 2.51, 0.55, 0.7, 0.025, "#fef3c7"]);
            pieces.push([b.x + 2.51, y, b.z + column * 1.2, 0.025, 0.7, 0.55, "#bfdbfe"]);
         }
         if (b.tower) for (let k = -2; k <= 2; k++) pieces.push([b.x + k, b.height + 0.08, b.z, 0.45, 0.1, 5, "#fb7185"]);
      }
      return pieces.length ? mergedBoxes(pieces) : null;
   }), [city]);
   useEffect(() => () => { for (const g of chunks) g?.dispose(); material.dispose(); }, [chunks, material]);
   return <group name="city-chunks">{chunks.map((geometry, i) => geometry && <mesh key={i} geometry={geometry} material={material} dispose={null} />)}</group>;
}

function Traffic({ run }: { run: Run }) {
   const carParts = useBoxParts(0.8, 0.5, 1.6, "#fb7185");
   const taxiParts = useBoxParts(0.8, 0.5, 1.6, "#fbbf24");
   const vanParts = useBoxParts(0.9, 0.8, 2, "#f8fafc");
   const { decor } = useQuality();
   const count = scaledCount(4, decor);
   const [scratch] = useState(() => ({ q: new Quaternion(), v: new Vector3(), tangent: { x: 0, y: 0, z: 0 } }));
   const [cars] = useState(() => Array.from({ length: 12 }, (_, i) => {
      const r = i % 2 ? 15 : 22.5;
      const path = createPath([{ x: -r, y: 0.05, z: -r }, { x: r, y: 0.05, z: -r }, { x: r, y: 0.05, z: r }, { x: -r, y: 0.05, z: r }], { closed: true });
      const state = { path, s: i * 7, position: { x: 0, y: 0, z: 0 }, time: 0 };
      advance(state, 0); return state;
   }));
   const place = (kind: number, i: number, m: Matrix4) => {
      if (i >= count) return false;
      const speed = kind === 0 ? 4 : kind === 1 ? 5 : 3;
      const car = cars[kind * 4 + i];
      advance(car, (run.time - car.time) * speed); car.time = run.time;
      tangentAt(car.path, car.s, scratch.tangent);
      scratch.q.setFromAxisAngle(UP, Math.atan2(scratch.tangent.x, scratch.tangent.z));
      scratch.v.set(car.position.x, car.position.y, car.position.z);
      m.compose(scratch.v, scratch.q, ONE);
   };
   return <group name="traffic">
      <DynamicInstancedModel asset={ASSETS.car} count={4} update={(i, m) => place(0, i, m)} fallbackParts={carParts} />
      <DynamicInstancedModel asset={ASSETS.taxi} count={4} update={(i, m) => place(1, i, m)} fallbackParts={taxiParts} />
      <DynamicInstancedModel asset={ASSETS.van} count={4} update={(i, m) => place(2, i, m)} fallbackParts={vanParts} />
   </group>;
}
function Birds({ run, reduced }: { run: Run; reduced: boolean }) {
   const parts = useBoxParts(0.6, 0.10, 0.25, "#64748b");
   const time = useGameTime();
   const [scratch] = useState(() => ({ q: new Quaternion(), v: new Vector3(), bob: { y: 0, roll: 0, yaw: 0, squash: 1 } as BodyOffset }));
   return <DynamicInstancedModel asset={ASSETS.pigeon} count={PIGEON.count} fallbackParts={parts} update={(i, m) => {
      if (i >= (run.time < PIGEON.middleFrom ? PIGEON.initialCount : run.time < PIGEON.finalFrom ? PIGEON.middleCount : PIGEON.count)) return false;
      const b = run.birds[i]; hover(time.play + i, reduced ? 0 : 0.035, scratch.bob);
      scratch.q.setFromAxisAngle(UP, b.yaw); scratch.v.set(b.x, b.y + scratch.bob.y, b.z); m.compose(scratch.v, scratch.q, ONE);
   }} />;
}
function Pads({ run }: { run: Run }) {
   const active = useRef<Mesh>(null), beacon = useRef<Mesh>(null), loading = useRef<Mesh>(null);
   const time = useGameTime();
   const [mint] = useState(() => new Color("#34d399"));
   const [blue] = useState(() => new Color("#38bdf8"));
   useFrame(() => {
      const b = run.city.buildings[run.city.targets[Math.min(run.completed, 11)]];
      if (active.current) { active.current.position.set(b.x, b.height + 0.03, b.z); active.current.visible = run.completed < 12; }
      if (beacon.current) { beacon.current.position.set(b.x, b.height + 1.4, b.z); beacon.current.scale.y = 1 + Math.sin(time.now * 3) * 0.08; beacon.current.visible = run.completed < 12; }
      if (loading.current) { loading.current.scale.setScalar(0.1 + run.loading / ROUTE.loading * 0.9); loading.current.visible = run.loading > 0; }
   });
   return <group name="delivery-pads">
      <DynamicInstanced count={12} tinted update={(i, m, color) => {
         const b = run.city.buildings[run.city.targets[i]];
         m.makeRotationX(-Math.PI / 2).setPosition(b.x, b.height + 0.03, b.z); color.copy(i < run.completed ? mint : blue);
      }}><ringGeometry args={[1.05, 1.25, 32]} /><meshBasicMaterial color="white" /></DynamicInstanced>
      <mesh ref={active} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.9, 32]} /><meshBasicMaterial color="#38bdf8" transparent opacity={0.24} depthWrite={false} /></mesh>
      <mesh ref={beacon}><cylinderGeometry args={[0.09, 0.25, 2.5, 8]} /><meshBasicMaterial color="#38bdf8" transparent opacity={0.45} depthWrite={false} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}><ringGeometry args={[1.3, 1.5, 40]} /><meshBasicMaterial color="#f8fafc" /></mesh>
      <mesh ref={loading} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><circleGeometry args={[1.25, 40]} /><meshBasicMaterial color="#34d399" transparent opacity={0.5} depthWrite={false} /></mesh>
   </group>;
}
function Wind({ run, reduced }: { run: Run; reduced: boolean }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const { decor } = useQuality();
   const [scratch] = useState(() => ({ q: new Quaternion(), v: new Vector3() }));
   const count = scaledCount(32, decor);
   useFrame(() => { if (root.current) root.current.visible = run.time >= WIND.from; });
   return <group ref={root} visible={false} name="wind">
      <DynamicInstanced count={32} update={(i, m) => {
         if (i >= count) return false;
         const w = run.city.winds[i % 2], k = Math.floor(i / 2);
         const phase = reduced ? 0 : (time.play * 0.4 + k * 0.17) % 1;
         scratch.q.setFromAxisAngle(UP, Math.atan2(w.ax, w.az)).multiply(WIND_TILT);
         scratch.v.set(w.x + (k % 4 - 1.5) * 1.7 + w.ax * phase, 12 + Math.floor(k / 4) * 0.08, w.z + (Math.floor(k / 4) - 1.5) * 1.7 + w.az * phase);
         m.compose(scratch.v, scratch.q, ONE);
      }}><coneGeometry args={[0.1, 0.6, 3]} /><meshBasicMaterial color="#7dd3fc" transparent opacity={0.55} depthWrite={false} /></DynamicInstanced>
   </group>;
}
export default function CityScene({ run, reduced }: { run: Run; reduced: boolean }) {
   const { decor } = useQuality();
   const trees = useMemo(() => TREES.slice(0, scaledCount(4, decor)), [decor]);
   const treeFallback = useMemo(() => trees.map((p) => ({ ...p, y: p.y + 1.5 })), [trees]);
   return <group name="miniature-city">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}><planeGeometry args={[66, 66]} /><meshStandardMaterial color="#334155" roughness={1} /></mesh>
      <Instanced spots={STREETS}><boxGeometry args={[0.05, 0.02, 60]} /><meshStandardMaterial color="#cbd5e1" /></Instanced>
      <CityChunks city={run.city} /><Pads run={run} /><Traffic run={run} /><Birds run={run} reduced={reduced} /><Wind run={run} reduced={reduced} />
      <mesh position={[0, -0.015, 0]}><boxGeometry args={[9, 0.04, 9]} /><meshStandardMaterial color="#86a58d" /></mesh>
      <InstancedModel asset={ASSETS.crate} spots={CRATES} fallback={<Instanced spots={CRATE_FALLBACK}><boxGeometry args={[0.8, 0.57, 0.8]} /><meshStandardMaterial color="#b98955" /></Instanced>} />
      <InstancedModel asset={ASSETS.tree} spots={trees} fallback={<Instanced spots={treeFallback}><coneGeometry args={[0.9, 3, 8]} /><meshStandardMaterial color="#65a30d" /></Instanced>} />
   </group>;
}
