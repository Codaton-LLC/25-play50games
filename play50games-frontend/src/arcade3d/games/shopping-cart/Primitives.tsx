// Stand-in primitives for Crazy Shopping Cart when GLB assets are loading or missing.
// Polished mobile-game look: rounded/bevelled shapes, 2-3 tones per object from COLORS,
// no raw grey boxes, flat-shaded low-poly where it fits.
import type { ReactNode } from "react";
import { COLORS } from "./looks";

export function CartPrimitive(): ReactNode {
   return (
      <group name="primitive-cart">
         {/* Lower chassis tubular frame */}
         <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.58, 0.08, 0.88]} />
            <meshStandardMaterial color={COLORS.cartFrame} roughness={0.4} metalness={0.6} />
         </mesh>

         {/* 4 Castor Wheels (tires + hubs) */}
         <group position={[-0.24, 0.05, 0.35]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
               <cylinderGeometry args={[0.045, 0.045, 0.03, 10]} />
               <meshStandardMaterial color={COLORS.cartWheel} roughness={0.9} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
               <cylinderGeometry args={[0.02, 0.02, 0.035, 8]} />
               <meshStandardMaterial color={COLORS.cartChrome} roughness={0.3} metalness={0.8} />
            </mesh>
         </group>
         <group position={[0.24, 0.05, 0.35]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
               <cylinderGeometry args={[0.045, 0.045, 0.03, 10]} />
               <meshStandardMaterial color={COLORS.cartWheel} roughness={0.9} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
               <cylinderGeometry args={[0.02, 0.02, 0.035, 8]} />
               <meshStandardMaterial color={COLORS.cartChrome} roughness={0.3} metalness={0.8} />
            </mesh>
         </group>
         <group position={[-0.24, 0.05, -0.35]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
               <cylinderGeometry args={[0.045, 0.045, 0.03, 10]} />
               <meshStandardMaterial color={COLORS.cartWheel} roughness={0.9} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
               <cylinderGeometry args={[0.02, 0.02, 0.035, 8]} />
               <meshStandardMaterial color={COLORS.cartChrome} roughness={0.3} metalness={0.8} />
            </mesh>
         </group>
         <group position={[0.24, 0.05, -0.35]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
               <cylinderGeometry args={[0.045, 0.045, 0.03, 10]} />
               <meshStandardMaterial color={COLORS.cartWheel} roughness={0.9} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
               <cylinderGeometry args={[0.02, 0.02, 0.035, 8]} />
               <meshStandardMaterial color={COLORS.cartChrome} roughness={0.3} metalness={0.8} />
            </mesh>
         </group>

         {/* Wire Grid Basket */}
         <mesh position={[0, 0.52, 0]}>
            <boxGeometry args={[0.54, 0.46, 0.82]} />
            <meshStandardMaterial color={COLORS.cartChrome} roughness={0.25} metalness={0.85} />
         </mesh>

         {/* Accent Red Protective Bumper Rim */}
         <mesh position={[0, 0.76, 0]}>
            <boxGeometry args={[0.56, 0.04, 0.84]} />
            <meshStandardMaterial color={COLORS.cartRed} roughness={0.3} />
         </mesh>

         {/* Front Child Seat / Fold Flap in Red */}
         <mesh position={[0, 0.58, 0.28]}>
            <boxGeometry args={[0.42, 0.32, 0.03]} />
            <meshStandardMaterial color={COLORS.cartRed} roughness={0.4} />
         </mesh>

         {/* Push Handle at back (-0.43 m in local z, y = 0.94 m) */}
         <group position={[0, 0.94, -0.43]}>
            {/* Red Ergonomic Handle Grip */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
               <cylinderGeometry args={[0.022, 0.022, 0.52, 12]} />
               <meshStandardMaterial color={COLORS.cartHandle} roughness={0.3} />
            </mesh>
            {/* Chrome Handle Mounting Brackets */}
            <mesh position={[-0.24, -0.12, 0.06]}>
               <cylinderGeometry args={[0.015, 0.015, 0.26, 8]} />
               <meshStandardMaterial color={COLORS.cartChrome} roughness={0.3} metalness={0.8} />
            </mesh>
            <mesh position={[0.24, -0.12, 0.06]}>
               <cylinderGeometry args={[0.015, 0.015, 0.26, 8]} />
               <meshStandardMaterial color={COLORS.cartChrome} roughness={0.3} metalness={0.8} />
            </mesh>
         </group>
      </group>
   );
}

export function ShopperPrimitive({ color }: { color: string }): ReactNode {
   return (
      <group name="primitive-shopper">
         {/* Shoes / Feet */}
         <mesh position={[-0.1, 0.06, 0]}>
            <capsuleGeometry args={[0.06, 0.12, 6, 8]} />
            <meshStandardMaterial color={COLORS.shopperDark} roughness={0.8} />
         </mesh>
         <mesh position={[0.1, 0.06, 0]}>
            <capsuleGeometry args={[0.06, 0.12, 6, 8]} />
            <meshStandardMaterial color={COLORS.shopperDark} roughness={0.8} />
         </mesh>

         {/* Lower Trousers */}
         <mesh position={[0, 0.42, 0]}>
            <capsuleGeometry args={[0.18, 0.42, 8, 12]} />
            <meshStandardMaterial color={COLORS.shopperDark} roughness={0.7} />
         </mesh>

         {/* Upper Jacket / Cardigan / Hoodie (in character tint) */}
         <mesh position={[0, 0.95, 0]}>
            <capsuleGeometry args={[0.24, 0.52, 8, 12]} />
            <meshStandardMaterial color={color} roughness={0.6} />
         </mesh>

         {/* Head in Skin Tone */}
         <mesh position={[0, 1.44, 0]}>
            <sphereGeometry args={[0.17, 14, 14]} />
            <meshStandardMaterial color={COLORS.shopperSkin} roughness={0.5} />
         </mesh>

         {/* Stylized Hair / Hat Cap */}
         <mesh position={[0, 1.54, -0.02]}>
            <sphereGeometry args={[0.175, 12, 10]} />
            <meshStandardMaterial color={COLORS.wallTrim} roughness={0.7} />
         </mesh>

         {/* Handheld Shopping Basket */}
         <group position={[0.32, 0.7, 0]}>
            <mesh>
               <boxGeometry args={[0.2, 0.14, 0.24]} />
               <meshStandardMaterial color={COLORS.shopperBasket} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
               <cylinderGeometry args={[0.01, 0.01, 0.18, 6]} />
               <meshStandardMaterial color={COLORS.cartChrome} roughness={0.4} metalness={0.7} />
            </mesh>
         </group>
      </group>
   );
}

export function ProductPrimitive({ kind }: { kind: string }): ReactNode {
   switch (kind) {
      case "apple":
         return (
            <group name="product-apple">
               {/* Red fruit body */}
               <mesh scale={[1, 0.9, 1]}>
                  <sphereGeometry args={[0.18, 14, 12]} />
                  <meshStandardMaterial color={COLORS.productApple} roughness={0.3} />
               </mesh>
               {/* Green leaf */}
               <mesh position={[0.04, 0.17, 0]} rotation={[0, 0, -0.4]}>
                  <boxGeometry args={[0.06, 0.02, 0.04]} />
                  <meshStandardMaterial color={COLORS.categoryGreen} roughness={0.5} />
               </mesh>
               {/* Brown stem */}
               <mesh position={[0, 0.18, 0]}>
                  <cylinderGeometry args={[0.012, 0.012, 0.06, 6]} />
                  <meshStandardMaterial color={COLORS.produceWood} roughness={0.8} />
               </mesh>
            </group>
         );

      case "banana":
         return (
            <group name="product-banana" rotation={[0, 0, 0.2]}>
               {/* Yellow curved banana bunch */}
               <mesh position={[-0.04, 0, 0]} rotation={[0, 0, 0.2]}>
                  <capsuleGeometry args={[0.06, 0.26, 6, 10]} />
                  <meshStandardMaterial color={COLORS.productBanana} roughness={0.4} />
               </mesh>
               <mesh position={[0.04, 0, 0]} rotation={[0, 0, -0.2]}>
                  <capsuleGeometry args={[0.055, 0.24, 6, 10]} />
                  <meshStandardMaterial color={COLORS.productBanana} roughness={0.4} />
               </mesh>
               {/* Stem tip */}
               <mesh position={[0, 0.17, 0]}>
                  <cylinderGeometry args={[0.02, 0.02, 0.05, 6]} />
                  <meshStandardMaterial color={COLORS.produceWood} roughness={0.8} />
               </mesh>
            </group>
         );

      case "burger":
         return (
            <group name="product-burger">
               {/* Golden top sesame bun */}
               <mesh position={[0, 0.08, 0]}>
                  <cylinderGeometry args={[0.18, 0.21, 0.08, 14]} />
                  <meshStandardMaterial color={COLORS.productBurger} roughness={0.5} />
               </mesh>
               {/* Grilled meat patty */}
               <mesh position={[0, 0.02, 0]}>
                  <cylinderGeometry args={[0.22, 0.22, 0.05, 14]} />
                  <meshStandardMaterial color={COLORS.produceWoodDark} roughness={0.8} />
               </mesh>
               {/* Cheese & lettuce slice */}
               <mesh position={[0, 0.055, 0]}>
                  <boxGeometry args={[0.23, 0.02, 0.23]} />
                  <meshStandardMaterial color={COLORS.coneYellow} roughness={0.4} />
               </mesh>
               {/* Bottom bun */}
               <mesh position={[0, -0.04, 0]}>
                  <cylinderGeometry args={[0.2, 0.18, 0.06, 14]} />
                  <meshStandardMaterial color={COLORS.produceCrate} roughness={0.6} />
               </mesh>
            </group>
         );

      case "tinCan":
         return (
            <group name="product-tincan">
               {/* Silver metal can body */}
               <mesh>
                  <cylinderGeometry args={[0.14, 0.14, 0.32, 14]} />
                  <meshStandardMaterial color={COLORS.canSilver} roughness={0.25} metalness={0.8} />
               </mesh>
               {/* Red tomato soup label wrap */}
               <mesh position={[0, 0, 0]}>
                  <cylinderGeometry args={[0.143, 0.143, 0.22, 14]} />
                  <meshStandardMaterial color={COLORS.canRed} roughness={0.4} />
               </mesh>
               {/* Silver pull-ring top tab */}
               <mesh position={[0.04, 0.165, 0]}>
                  <boxGeometry args={[0.04, 0.01, 0.06]} />
                  <meshStandardMaterial color={COLORS.canSilver} roughness={0.2} metalness={0.9} />
               </mesh>
            </group>
         );

      case "bottle":
         return (
            <group name="product-bottle">
               {/* Translucent bottle body */}
               <mesh position={[0, -0.03, 0]}>
                  <cylinderGeometry args={[0.12, 0.12, 0.26, 12]} />
                  <meshStandardMaterial color={COLORS.productBottle} roughness={0.15} metalness={0.2} transparent opacity={0.88} />
               </mesh>
               {/* White brand label band */}
               <mesh position={[0, -0.03, 0]}>
                  <cylinderGeometry args={[0.124, 0.124, 0.13, 12]} />
                  <meshStandardMaterial color={COLORS.floorTile} roughness={0.4} />
               </mesh>
               {/* Tapered bottle neck */}
               <mesh position={[0, 0.13, 0]}>
                  <cylinderGeometry args={[0.045, 0.11, 0.08, 12]} />
                  <meshStandardMaterial color={COLORS.productBottle} roughness={0.15} transparent opacity={0.88} />
               </mesh>
               {/* Orange bottle cap */}
               <mesh position={[0, 0.18, 0]}>
                  <cylinderGeometry args={[0.05, 0.05, 0.03, 12]} />
                  <meshStandardMaterial color={COLORS.categoryOrange} roughness={0.4} />
               </mesh>
            </group>
         );

      case "bag":
         return (
            <group name="product-bag">
               {/* Kraft paper grocery bag body */}
               <mesh>
                  <boxGeometry args={[0.26, 0.32, 0.18]} />
                  <meshStandardMaterial color={COLORS.productBag} roughness={0.7} />
               </mesh>
               {/* Darker base fold */}
               <mesh position={[0, -0.15, 0]}>
                  <boxGeometry args={[0.27, 0.04, 0.19]} />
                  <meshStandardMaterial color={COLORS.produceWood} roughness={0.8} />
               </mesh>
               {/* Folded paper handles */}
               <mesh position={[0, 0.18, 0]}>
                  <boxGeometry args={[0.14, 0.05, 0.02]} />
                  <meshStandardMaterial color={COLORS.ceilingPanelGlow} roughness={0.5} />
               </mesh>
            </group>
         );

      case "sock":
         return (
            <group name="product-sock" rotation={[0, 0, 0.2]}>
               {/* Folded white athletic sock body */}
               <mesh>
                  <capsuleGeometry args={[0.08, 0.22, 6, 10]} />
                  <meshStandardMaterial color={COLORS.floorTile} roughness={0.6} />
               </mesh>
               {/* Purple ribbed top cuff */}
               <mesh position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.085, 0.085, 0.06, 12]} />
                  <meshStandardMaterial color={COLORS.productSock} roughness={0.5} />
               </mesh>
            </group>
         );

      case "battery":
         return (
            <group name="product-battery">
               {/* Cylindrical green body */}
               <mesh>
                  <cylinderGeometry args={[0.12, 0.12, 0.32, 14]} />
                  <meshStandardMaterial color={COLORS.productBattery} roughness={0.3} metalness={0.4} />
               </mesh>
               {/* Dark bottom negative band */}
               <mesh position={[0, -0.12, 0]}>
                  <cylinderGeometry args={[0.123, 0.123, 0.08, 14]} />
                  <meshStandardMaterial color={COLORS.concourseFloor} roughness={0.6} />
               </mesh>
               {/* Silver positive terminal (+) button */}
               <mesh position={[0, 0.17, 0]}>
                  <cylinderGeometry args={[0.045, 0.045, 0.03, 10]} />
                  <meshStandardMaterial color={COLORS.canSilver} roughness={0.2} metalness={0.9} />
               </mesh>
            </group>
         );

      case "fish":
         return (
            <group name="product-fish">
               {/* Orange cartoon fish body */}
               <mesh scale={[1.6, 0.8, 0.5]}>
                  <sphereGeometry args={[0.15, 12, 10]} />
                  <meshStandardMaterial color={COLORS.productFish} roughness={0.4} />
               </mesh>
               {/* Cyan tail fin */}
               <mesh position={[-0.26, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
                  <boxGeometry args={[0.12, 0.12, 0.02]} />
                  <meshStandardMaterial color={COLORS.freezerGlow} roughness={0.5} />
               </mesh>
               {/* Cyan dorsal fin */}
               <mesh position={[0.02, 0.12, 0]} rotation={[0, 0, 0.2]}>
                  <boxGeometry args={[0.1, 0.06, 0.02]} />
                  <meshStandardMaterial color={COLORS.freezerGlow} roughness={0.5} />
               </mesh>
            </group>
         );

      case "gourd":
      default:
         return (
            <group name="product-gourd">
               {/* Lower green bulb */}
               <mesh position={[0, -0.06, 0]}>
                  <sphereGeometry args={[0.14, 12, 10]} />
                  <meshStandardMaterial color={COLORS.productGourd} roughness={0.5} />
               </mesh>
               {/* Upper smaller bulb */}
               <mesh position={[0, 0.1, 0]}>
                  <sphereGeometry args={[0.09, 12, 10]} />
                  <meshStandardMaterial color={COLORS.produceGreen} roughness={0.5} />
               </mesh>
               {/* Top stem */}
               <mesh position={[0, 0.2, 0]}>
                  <cylinderGeometry args={[0.015, 0.015, 0.04, 6]} />
                  <meshStandardMaterial color={COLORS.produceWood} roughness={0.8} />
               </mesh>
            </group>
         );
   }
}

export function ShelfUnitPrimitive({ width, length }: { width: number; length: number }): ReactNode {
   return (
      <group name="primitive-shelf-unit">
         {/* Base kickplate */}
         <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[width + 0.06, 0.2, length + 0.06]} />
            <meshStandardMaterial color={COLORS.shelfBase} roughness={0.7} />
         </mesh>

         {/* Main shelving gondola upright body */}
         <mesh position={[0, 1.0, 0]}>
            <boxGeometry args={[width, 1.8, length]} />
            <meshStandardMaterial color={COLORS.shelfBody} roughness={0.4} metalness={0.1} />
         </mesh>

         {/* Shelf price tag edge channels */}
         <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[width + 0.03, 0.04, length]} />
            <meshStandardMaterial color={COLORS.shelfEdge} roughness={0.6} />
         </mesh>
         <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[width + 0.03, 0.04, length]} />
            <meshStandardMaterial color={COLORS.shelfEdge} roughness={0.6} />
         </mesh>
         <mesh position={[0, 1.8, 0]}>
            <boxGeometry args={[width + 0.03, 0.04, length]} />
            <meshStandardMaterial color={COLORS.shelfEdge} roughness={0.6} />
         </mesh>

         {/* Top aisle department header banner */}
         <mesh position={[0, 2.05, 0]}>
            <boxGeometry args={[width + 0.04, 0.12, length]} />
            <meshStandardMaterial color={COLORS.shelfBanner} roughness={0.3} />
         </mesh>
      </group>
   );
}
