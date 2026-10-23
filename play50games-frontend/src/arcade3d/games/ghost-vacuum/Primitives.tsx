export function PackPrimitive() {
   return <group><mesh position={[0, 0.275, 0.006]}><boxGeometry args={[0.27, 0.55, 0.384]} /><meshStandardMaterial color="#a78bfa" roughness={0.65} /></mesh><mesh position={[0, 0.38, 0.22]}><sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial color="#fde047" /></mesh></group>;
}
export function HunterPrimitive() {
   return <group>
      <mesh position={[0, 0.91, 0]}><capsuleGeometry args={[0.22, 0.45, 4, 10]} /><meshStandardMaterial color="#a78bfa" /></mesh>
      <mesh position={[0, 1.38, 0]}><sphereGeometry args={[0.18, 12, 10]} /><meshStandardMaterial color="#fed7aa" /></mesh>
      {[-1, 1].map((side) => <group key={side}>
         <mesh position={[side * 0.13, 0.32, 0]}><capsuleGeometry args={[0.075, 0.49, 4, 8]} /><meshStandardMaterial color="#312e81" /></mesh>
         <mesh position={[side * 0.13, 0.055, 0.045]}><boxGeometry args={[0.15, 0.11, 0.24]} /><meshStandardMaterial color="#f8fafc" /></mesh>
         <mesh position={[side * 0.27, 0.92, 0.12]} rotation={[0.5, 0, side * 0.22]}><capsuleGeometry args={[0.065, 0.32, 4, 8]} /><meshStandardMaterial color="#fed7aa" /></mesh>
      </group>)}
      <group position={[0, 0.97, -0.19]} rotation={[0, Math.PI, 0]}><PackPrimitive /></group>
   </group>;
}
