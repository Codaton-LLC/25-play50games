"use client";

// The saucer (the Hyper3D ufo GLB, a lathe stand-in) on the rules' route: it hovers with its
// underside at SHIP.hoverY, spins slowly and banks into its travel; a soft additive beam cone runs
// to the ground, where a crisp ring shows the exact 2 m loading circle (brighter while carrying).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, CylinderGeometry, MeshBasicMaterial, RingGeometry, type Group, type Mesh } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS } from "./assets";
import { COLORS, HEIGHTS, HOVER } from "./looks";
import { SaucerPrimitive } from "./Primitives";
import { SHIP, type RunState } from "./rules";

const BEAM_TOP = 0.42;

export function Saucer({ run, reducedMotion }: { run: RunState; reducedMotion: boolean }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const beam = useRef<Mesh>(null);
   const ring = useRef<Mesh>(null);
   const looks = useMemo(() => {
      const cone = new CylinderGeometry(BEAM_TOP, SHIP.beamRadius, SHIP.hoverY, 32, 1, true).translate(0, SHIP.hoverY / 2, 0);
      const disc = new RingGeometry(SHIP.beamRadius - 0.12, SHIP.beamRadius, 48).rotateX(-Math.PI / 2);
      const beamMat = new MeshBasicMaterial({ color: COLORS.beam, transparent: true, opacity: 0.1, depthWrite: false, blending: AdditiveBlending, toneMapped: false });
      const ringMat = new MeshBasicMaterial({ color: COLORS.beam, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
      return { cone, disc, beamMat, ringMat, idle: new Color(COLORS.beam).multiplyScalar(0.55), hot: new Color(COLORS.beam) };
   }, []);
   useEffect(
      () => () => {
         looks.cone.dispose();
         looks.disc.dispose();
         looks.beamMat.dispose();
         looks.ringMat.dispose();
      },
      [looks],
   );

   useFrame(() => {
      const g = root.current, b = body.current;
      if (!g || !b) return;
      const s = run.ship;
      g.position.set(s.x, 0, s.z);
      const bob = reducedMotion ? 0 : HOVER.amplitude * Math.sin(time.now * HOVER.rate);
      b.position.y = SHIP.hoverY + bob;
      b.rotation.y = time.now * HOVER.spin;
      // a gentle bank towards the way it travels
      b.rotation.z = reducedMotion ? 0 : 0.06 * Math.sin(time.now * 0.8);
      const carrying = run.cargoCount > 0;
      looks.beamMat.opacity = carrying ? 0.14 + (reducedMotion ? 0 : 0.04 * Math.sin(time.now * 6)) : 0.08;
      looks.ringMat.color.copy(carrying ? looks.hot : looks.idle);
      if (ring.current) ring.current.scale.setScalar(carrying && !reducedMotion ? 1 + 0.015 * Math.sin(time.now * 6) : 1);
   });

   return (
      <group ref={root} name="saucer">
         <group ref={body}>
            <Model asset={ASSETS.ufo} fallback={<SaucerPrimitive />} />
         </group>
         <mesh ref={beam} geometry={looks.cone} material={looks.beamMat} renderOrder={2} />
         <mesh ref={ring} geometry={looks.disc} material={looks.ringMat} position={[0, HEIGHTS.beamRing, 0]} renderOrder={1} />
      </group>
   );
}
