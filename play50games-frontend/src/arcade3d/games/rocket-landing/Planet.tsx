"use client";
import { useEffect, useState, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, BufferAttribute, Color, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { PLANETS, padX, type Run } from "./rules";
const COLORS = PLANETS.map((p) => new Color(p.color));

export default function Planet({ run }: { run: Run }) {
   const pad = useRef<Group>(null), roof = useRef<Mesh>(null), ground = useRef<Mesh>(null);
   const [data] = useState(() => {
      const geometry = new BufferGeometry(), position = new BufferAttribute(new Float32Array(12 * 18 * 3), 3), normal = new BufferAttribute(new Float32Array(12 * 18 * 3), 3);
      geometry.setAttribute("position", position);
      geometry.setAttribute("normal", normal);
      return { geometry, position, normal, planet: -1 };
   });
   useEffect(() => () => data.geometry.dispose(), [data]);
   useFrame(() => {
      if (pad.current) { pad.current.position.x = padX(run.layouts[run.planet], run.planet, run.attemptTime); pad.current.scale.x = PLANETS[run.planet].width; }
      if (roof.current) roof.current.visible = run.planet === 4;
      if (data.planet === run.planet) return;
      data.planet = run.planet;
      const terrain = run.layouts[run.planet].terrain;
      for (let i = 0; i < 12; i++) {
         const x0 = -10 + i * 20 / 12, x1 = -10 + (i + 1) * 20 / 12, n = i * 18;
         data.position.setXYZ(n, x0, -2, 1.5); data.position.setXYZ(n + 1, x1, -2, 1.5); data.position.setXYZ(n + 2, x1, terrain[i + 1], 1.5);
         data.position.setXYZ(n + 3, x0, -2, 1.5); data.position.setXYZ(n + 4, x1, terrain[i + 1], 1.5); data.position.setXYZ(n + 5, x0, terrain[i], 1.5);
         data.position.setXYZ(n + 6, x0, -2, -1.5); data.position.setXYZ(n + 7, x1, terrain[i + 1], -1.5); data.position.setXYZ(n + 8, x1, -2, -1.5);
         data.position.setXYZ(n + 9, x0, -2, -1.5); data.position.setXYZ(n + 10, x0, terrain[i], -1.5); data.position.setXYZ(n + 11, x1, terrain[i + 1], -1.5);
         data.position.setXYZ(n + 12, x0, terrain[i], 1.5); data.position.setXYZ(n + 13, x1, terrain[i + 1], 1.5); data.position.setXYZ(n + 14, x1, terrain[i + 1], -1.5);
         data.position.setXYZ(n + 15, x0, terrain[i], 1.5); data.position.setXYZ(n + 16, x1, terrain[i + 1], -1.5); data.position.setXYZ(n + 17, x0, terrain[i], -1.5);
         const slope = (terrain[i + 1] - terrain[i]) / (x1 - x0), length = Math.hypot(slope, 1);
         for (let v = 0; v < 18; v++) data.normal.setXYZ(n + v, v >= 12 ? -slope / length : 0, v >= 12 ? 1 / length : 0, v < 6 ? 1 : v < 12 ? -1 : 0);
      }
      data.position.needsUpdate = true; data.normal.needsUpdate = true;
      if (ground.current) (ground.current.material as MeshStandardMaterial).color.copy(COLORS[run.planet]);
   });
   return <group>
      <mesh ref={ground} geometry={data.geometry} frustumCulled={false}><meshStandardMaterial color={PLANETS[0].color} roughness={1} /></mesh>
      <group ref={pad} position={[0, 1.8, 0]}>
         <mesh><boxGeometry args={[1, 0.4, 2]} /><meshStandardMaterial color="#334155" roughness={0.65} /></mesh>
         <mesh position={[0, 0.24, 0]}><boxGeometry args={[0.94, 0.025, 1.8]} /><meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.4} depthWrite={false} /></mesh>
         <mesh position={[0, 0.03, 1.025]}><boxGeometry args={[0.86, 0.075, 0.03]} /><meshBasicMaterial color="#f8fafc" /></mesh>
      </group>
      <mesh ref={roof} position={[0, 9.5, 0]} visible={false}><boxGeometry args={[6, 1, 3]} /><meshStandardMaterial color="#78716c" /></mesh>
      <mesh position={[-7, 12, -20]}><sphereGeometry args={[3, 16, 12]} /><meshStandardMaterial color="#475569" roughness={1} /></mesh>
   </group>;
}
