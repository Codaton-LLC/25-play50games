"use client";

// The hint line (guide.ts: go to the marked crop, carry to the beam, dazed), a "Tool cooling" pill
// after a wasted press and the core 📷 camera-view button. Delivered, Basket n/4 and Perfect are the
// shell's stat chips.
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { HintLine, useHudSignal } from "@/arcade3d/core/hud/HintLine";
import { COOLING, GUIDE } from "./guide";
import styles from "./Hud.module.css";

export default function Hud() {
   const cooling = useHudSignal(COOLING);
   return (
      <>
         <CameraViewButton />
         <HintLine signal={GUIDE} />
         {cooling && <div className={styles.cool} role="status">Tool cooling…</div>}
      </>
   );
}
