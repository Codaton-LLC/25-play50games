"use client";
import { useEffect, useRef } from "react";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useRunFrame } from "../../core/useRunFrame";
import { playSfx, startLoop } from "../../core/audio";
// Original four-note Ember Pulse, synthesized by the shared audio bank: no downloaded music,
// files, licences or extra AudioContexts. The shared mute, gesture unlock and pause own playback.
export default function FactoryAudio() {
   const phase = useArcadeStore((s) => s.phase);
   const last = useRef(-1);
   useEffect(() => { if (phase !== "playing")
      return; const loop = startLoop("belt", { volume: 0.08, pitch: 0.75 }); return () => loop.stop(); }, [phase]);
   useRunFrame(() => { const beat = Math.floor(useArcadeStore.getState().elapsedMs / 600); if (beat !== last.current) {
      last.current = beat;
      playSfx("chime", { pitch: [0.75, 1, 1.125, 1][beat % 4], volume: 0.065 });
      if (beat % 2 === 0)
         playSfx("thud", { volume: 0.06, pitch: 0.6 });
   } });
   return null;
}
