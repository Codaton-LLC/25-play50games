"use client";

// STUB (Phase 0). Claude replaces this in Phase 2 with the full shell:
// start screen, countdown, HUD, pause, result, touch controls, WebGL checks.
import { Suspense } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import type { GameShellProps } from "./types";

export default function GameShell({ meta, definition, exitHref = "/3d" }: GameShellProps) {
   const { Scene, camera } = definition;

   return (
      <div style={{ position: "fixed", inset: 0, background: "var(--bg)" }}>
         <div
            style={{
               position: "absolute",
               top: 0,
               left: 0,
               right: 0,
               zIndex: 1,
               display: "flex",
               justifyContent: "space-between",
               padding: "12px 16px",
               color: "var(--text)",
            }}
         >
            <strong>{meta.title}</strong>
            <Link href={exitHref} style={{ color: "var(--accent)" }}>
               Exit
            </Link>
         </div>
         <Canvas camera={{ position: camera.position, fov: camera.fov ?? 50 }} dpr={[1, 1.75]}>
            <Suspense fallback={null}>
               <Scene />
            </Suspense>
         </Canvas>
      </div>
   );
}
