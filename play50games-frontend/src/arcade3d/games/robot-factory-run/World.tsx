"use client";
import { useMemo } from "react";
import { InstancedModel } from "../../core/assets";
import { useQuality } from "../../core/quality";
import { ASSETS } from "./assets";
export const COLORS = { background: "#221820", fog: "#35232b", floor: "#433339", red: "#ef4444", warm: "#ffd4a0" };
export default function World({ multi = false }: {
   multi?: boolean;
}) {
   const { decor } = useQuality();
   const halls = useMemo(() => [{ x: 0, y: -1, z: -10 }, { x: 0, y: -4, z: -20 }], []);
   return <>
     <mesh position={[0, -0.5, 0]} receiveShadow><boxGeometry args={[multi ? 82 : 22, 1, 13]}/><meshStandardMaterial color={COLORS.floor} roughness={0.8} metalness={0.35}/></mesh>
     <mesh position={[0, -1, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[180, 180]}/><meshStandardMaterial color="#18171d" roughness={0.95}/></mesh>
     <InstancedModel asset={ASSETS.hall} spots={decor < 1 ? halls.slice(0, 1) : halls} fallback={null}/>
     <mesh position={[0, -0.03, 5.9]}><boxGeometry args={[20, 0.05, 0.1]}/><meshBasicMaterial color="#b95a42"/></mesh>
     <mesh position={[0, -0.03, -5.9]}><boxGeometry args={[20, 0.05, 0.1]}/><meshBasicMaterial color="#b95a42"/></mesh>
     <pointLight position={[-5, 5, 1]} color="#ff835d" intensity={45} distance={20}/>
     <pointLight position={[7, 6, -3]} color="#ffba70" intensity={55} distance={20}/>
   </>;
}
