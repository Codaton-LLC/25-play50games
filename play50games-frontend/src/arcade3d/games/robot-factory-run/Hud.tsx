"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useLevel } from "../../core/level";
import HeroPicker from "../../menu2/heroes/HeroPicker";
import OrbitHud from "../../menu2/camera/OrbitHud";
import ComboMeter from "../../menu2/combo/ComboMeter";
import BossHealthBar from "../../menu2/boss/BossHealthBar";
import { phaseMarks } from "../../menu2/boss/boss";
import { usePlayers, playersStore } from "../../menu2/multiplayer/players";
import { HEROES, pickedHero, subscribeHero, selectHero } from "./heroes";
import { OVERSEER } from "./progression";
import { LEVELS, type FactoryLevel } from "./levels";
import { MultiplayerButton, MultiplayerHud } from "./MultiplayerHud";
import { rollInput } from "./controls";
import stack from "../../menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";
export default function Hud() {
   const { config } = useLevel<FactoryLevel>();
   const level = config?.id ?? 1;
   const s = useArcadeStore((v) => v.stats);
   const phase = useArcadeStore((v) => v.phase);
   const tenths = useArcadeStore((v) => Math.floor(v.elapsedMs / 100));
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const mp = usePlayers((v) => v.phase !== "off");
   const [rolling, setRolling] = useState(false);
   useEffect(() => {
      const down = (e: KeyboardEvent) => { if (e.code === "ShiftLeft" && !(e.target instanceof HTMLInputElement)) {
         rollInput.held = true;
         setRolling(true);
      } };
      const up = (e: KeyboardEvent) => { if (e.code === "ShiftLeft") {
         rollInput.held = false;
         setRolling(false);
      } };
      const clear = () => { rollInput.held = false; setRolling(false); };
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      window.addEventListener("blur", clear);
      return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); rollInput.held = false; playersStore.getState().endSession(); };
   }, []);
   return <>
     <HeroPicker heroes={HEROES} value={pick} onPick={selectHero} hidden={mp} extra={phase === "ready" ? <MultiplayerButton /> : null}/>
     <MultiplayerHud /><OrbitHud />
     {!mp && <div className={stack.left} data-arcade-safe-area="">
       <div className={styles.pill}>CELLS {s.cells ?? 0} / {LEVELS[level].cells}</div>
       <div className={styles.pill}>ORBS {s.orbs ?? 0} / 8 | HEARTS {s.hearts ?? 5}</div>
       <div className={styles.pill}>POWER {s.power ? `${s.power}s` : "READY"} | LOST {s.lost ?? 0}</div>
       <ComboMeter chain={s.chain ?? 0} multiplier={(s.mult ?? 100) / 100} flow={(s.flow ?? 0) / 100} cap={2}/>
     </div>}
     <div className={stack.center} data-arcade-safe-area=""><div className={styles.pill}>{LEVELS[level].name} | {(tenths / 10).toFixed(1)}s</div>
       <div className={styles.hint}>{s.reverse ? "KLAXON: belts reversing" : s.hint ? "Follow the pulsing red switch. Roll across it to turn the arrow." : "Roll over red switches -> route cells -> enter the charged exit"}</div>
     
     {level === 5 && <div className={stack.boss}><BossHealthBar name={OVERSEER.name} phaseName={OVERSEER.phases[s.bossPhase ?? 0]?.name} hp={s.bossHp ?? 8} maxHp={8} marks={phaseMarks(OVERSEER)} vulnerable={s.bossOpen === 1} flash={s.bossFlash === 1} accent="#ef4444"/></div>}</div>
     {!mp && (phase === "playing" || phase === "countdown") && <button className={styles.roll} type="button" aria-label="Hold to roll" aria-pressed={rolling} data-arcade-controls="" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); rollInput.held = true; setRolling(true); }} onPointerUp={() => { rollInput.held = false; setRolling(false); }} onLostPointerCapture={() => { rollInput.held = false; setRolling(false); }} onPointerCancel={() => { rollInput.held = false; setRolling(false); }}>ROLL</button>}
   </>;
}
