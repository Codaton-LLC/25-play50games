"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, CylinderGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { COLORS, decorOf, type DecorSpot } from "./looks";

function asSpots(list: readonly DecorSpot[]): InstanceSpot[] {
   return list.map((spot) => ({
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rotY: spot.rotY,
      sx: spot.sx,
      sy: spot.sy,
      sz: spot.sz,
   }));
}

/**
 * Instanced surroundings strictly OUTSIDE the play area:
 * wall shelving, sliding entrance doors, promo sign boards, shopping cart return corrals,
 * and high warm ceiling light panels.
 */
export function Decor() {
   const quality = useQuality();

   const geo = useMemo(() => {
      // 1. Wall Shelving: upright frame + 3 horizontal shelves with item boxes
      const postL = new BoxGeometry(0.08, 1.0, 0.08).translate(-0.45, 0, 0);
      const postR = new BoxGeometry(0.08, 1.0, 0.08).translate(0.45, 0, 0);
      const shelf1 = new BoxGeometry(0.96, 0.04, 0.9).translate(0, -0.3, 0);
      const shelf2 = new BoxGeometry(0.96, 0.04, 0.9).translate(0, 0.05, 0);
      const shelf3 = new BoxGeometry(0.96, 0.04, 0.9).translate(0, 0.4, 0);
      // Boxed goods standing on shelves
      const boxA = new BoxGeometry(0.25, 0.28, 0.2).translate(-0.25, -0.14, 0);
      const boxB = new BoxGeometry(0.3, 0.24, 0.25).translate(0.18, -0.16, 0);
      const boxC = new BoxGeometry(0.22, 0.26, 0.2).translate(-0.15, 0.2, 0);
      const boxD = new BoxGeometry(0.28, 0.25, 0.22).translate(0.22, 0.19, 0);

      const rack = mergeGeometries([postL, postR, shelf1, shelf2, shelf3, boxA, boxB, boxC, boxD]);
      postL.dispose();
      postR.dispose();
      shelf1.dispose();
      shelf2.dispose();
      shelf3.dispose();
      boxA.dispose();
      boxB.dispose();
      boxC.dispose();
      boxD.dispose();
      if (!rack) throw new Error("shopping look: rack geometry merge failed");

      // 2. Sliding Entrance / Exit Doors: outer frame + glass panels
      const frameTop = new BoxGeometry(1.0, 0.08, 0.12).translate(0, 0.46, 0);
      const frameL = new BoxGeometry(0.08, 0.96, 0.12).translate(-0.46, 0, 0);
      const frameR = new BoxGeometry(0.08, 0.96, 0.12).translate(0.46, 0, 0);
      const glass = new BoxGeometry(0.86, 0.88, 0.04).translate(0, 0, 0);
      const door = mergeGeometries([frameTop, frameL, frameR, glass]);
      frameTop.dispose();
      frameL.dispose();
      frameR.dispose();
      glass.dispose();
      if (!door) throw new Error("shopping look: door geometry merge failed");

      // 3. Promo Signboards: weighted base + graphic board + header
      const signBase = new BoxGeometry(0.7, 0.08, 0.5).translate(0, -0.44, 0);
      const signPole = new CylinderGeometry(0.03, 0.03, 0.35, 8).translate(0, -0.25, 0);
      const signBoard = new BoxGeometry(0.9, 0.65, 0.06).translate(0, 0.15, 0);
      const signHeader = new BoxGeometry(0.92, 0.12, 0.08).translate(0, 0.44, 0);
      const sign = mergeGeometries([signBase, signPole, signBoard, signHeader]);
      signBase.dispose();
      signPole.dispose();
      signBoard.dispose();
      signHeader.dispose();
      if (!sign) throw new Error("shopping look: sign geometry merge failed");

      // 4. Cart Corral: tubular guide rails + standby cart silhouettes
      const railL = new BoxGeometry(0.06, 0.8, 1.0).translate(-0.45, 0, 0);
      const railR = new BoxGeometry(0.06, 0.8, 1.0).translate(0.45, 0, 0);
      const railEnd = new BoxGeometry(0.96, 0.8, 0.06).translate(0, 0, -0.45);
      const nestedCart = new BoxGeometry(0.65, 0.6, 0.8).translate(0, -0.05, 0.05);
      const corral = mergeGeometries([railL, railR, railEnd, nestedCart]);
      railL.dispose();
      railR.dispose();
      railEnd.dispose();
      nestedCart.dispose();
      if (!corral) throw new Error("shopping look: corral geometry merge failed");

      // 5. Exterior Checkout / Service Kiosk
      const counterBase = new BoxGeometry(0.9, 0.85, 0.85).translate(0, -0.05, 0);
      const counterTop = new BoxGeometry(0.96, 0.1, 0.9).translate(0, 0.42, 0);
      const kiosk = mergeGeometries([counterBase, counterTop]);
      counterBase.dispose();
      counterTop.dispose();
      if (!kiosk) throw new Error("shopping look: kiosk geometry merge failed");

      // 6. Ceiling Light Panel: frame + glowing diffuser face
      const lightFrame = new BoxGeometry(1.0, 0.1, 1.0);
      const lightDiffuser = new BoxGeometry(0.9, 0.06, 0.9).translate(0, -0.03, 0);
      const ceilingLight = mergeGeometries([lightFrame, lightDiffuser]);
      lightFrame.dispose();
      lightDiffuser.dispose();
      if (!ceilingLight) throw new Error("shopping look: ceiling light geometry merge failed");

      return {
         rack,
         door,
         sign,
         corral,
         kiosk,
         ceilingLight,
      };
   }, []);

   // Disposal cleanup on unmount
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   // Scaled spot lists according to quality tier
   const shelvingSpots0 = useMemo(
      () => asSpots(decorOf("wall_shelving", 0).slice(0, scaledCount(decorOf("wall_shelving", 0).length, quality.decor))),
      [quality.decor]
   );
   const shelvingSpots1 = useMemo(
      () => asSpots(decorOf("wall_shelving", 1).slice(0, scaledCount(decorOf("wall_shelving", 1).length, quality.decor))),
      [quality.decor]
   );
   const doorSpots = useMemo(
      () => asSpots(decorOf("entrance_door").slice(0, scaledCount(decorOf("entrance_door").length, quality.decor))),
      [quality.decor]
   );
   const signSpots0 = useMemo(
      () => asSpots(decorOf("promo_sign", 0).slice(0, scaledCount(decorOf("promo_sign", 0).length, quality.decor))),
      [quality.decor]
   );
   const signSpots1 = useMemo(
      () => asSpots(decorOf("promo_sign", 1).slice(0, scaledCount(decorOf("promo_sign", 1).length, quality.decor))),
      [quality.decor]
   );
   const corralSpots = useMemo(
      () => asSpots(decorOf("cart_corral")),
      []
   );
   const kioskSpots = useMemo(
      () => asSpots(decorOf("checkout_decor")),
      []
   );
   const lightSpots = useMemo(
      () => asSpots(decorOf("ceiling_light").slice(0, scaledCount(decorOf("ceiling_light").length, quality.decor))),
      [quality.decor]
   );

   return (
      <group name="supermarket-exterior-decor">
         {/* Wall Shelving / Pallet Racks (Tone 0: warm boxes; Tone 1: cool boxes) */}
         {shelvingSpots0.length > 0 && (
            <Instanced spots={shelvingSpots0} name="decor-shelving-0">
               <primitive object={geo.rack} attach="geometry" />
               <meshStandardMaterial color={COLORS.produceWood} roughness={0.7} />
            </Instanced>
         )}
         {shelvingSpots1.length > 0 && (
            <Instanced spots={shelvingSpots1} name="decor-shelving-1">
               <primitive object={geo.rack} attach="geometry" />
               <meshStandardMaterial color={COLORS.shelfBase} roughness={0.6} />
            </Instanced>
         )}

         {/* Sliding Glass Entrance Doors */}
         {doorSpots.length > 0 && (
            <Instanced spots={doorSpots} name="decor-doors">
               <primitive object={geo.door} attach="geometry" />
               <meshStandardMaterial color={COLORS.doorGlass} transparent opacity={0.8} roughness={0.2} metalness={0.4} />
            </Instanced>
         )}

         {/* Promo Signboards (Tone 0: yellow, Tone 1: orange) */}
         {signSpots0.length > 0 && (
            <Instanced spots={signSpots0} name="decor-signs-0">
               <primitive object={geo.sign} attach="geometry" />
               <meshStandardMaterial color={COLORS.signYellow} roughness={0.4} />
            </Instanced>
         )}
         {signSpots1.length > 0 && (
            <Instanced spots={signSpots1} name="decor-signs-1">
               <primitive object={geo.sign} attach="geometry" />
               <meshStandardMaterial color={COLORS.signOrange} roughness={0.4} />
            </Instanced>
         )}

         {/* Cart Corrals */}
         {corralSpots.length > 0 && (
            <Instanced spots={corralSpots} name="decor-corrals">
               <primitive object={geo.corral} attach="geometry" />
               <meshStandardMaterial color={COLORS.cartChrome} roughness={0.3} metalness={0.7} />
            </Instanced>
         )}

         {/* Exterior Checkout / Customer Service Kiosks */}
         {kioskSpots.length > 0 && (
            <Instanced spots={kioskSpots} name="decor-kiosks">
               <primitive object={geo.kiosk} attach="geometry" />
               <meshStandardMaterial color={COLORS.checkoutBody} roughness={0.5} />
            </Instanced>
         )}

         {/* High Warm Ceiling Light Panels */}
         {lightSpots.length > 0 && (
            <Instanced spots={lightSpots} name="decor-ceiling-lights">
               <primitive object={geo.ceilingLight} attach="geometry" />
               <meshStandardMaterial
                  color={COLORS.ceilingPanel}
                  emissive={COLORS.ceilingPanelGlow}
                  emissiveIntensity={0.8}
                  roughness={0.3}
               />
            </Instanced>
         )}
      </group>
   );
}
