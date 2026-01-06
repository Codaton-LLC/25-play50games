"use client";

import React, {
   useState,
   useEffect,
   useCallback,
   useRef,
   useMemo,
} from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   ArrowPathIcon,
   ArrowPathRoundedSquareIcon,
   TrophyIcon,
   ClockIcon,
   ShareIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";
import FastMath from "./speedgames-parts/FastMath";
import WhackShape from "./speedgames-parts/WhackShape";
import ClickGreen from "./speedgames-parts/ClickGreen";
import AvoidRed from "./speedgames-parts/AvoidRed";
import ReactionTest from "./speedgames-parts/ReactionTest";
import TypingSprint from "./speedgames-parts/TypingSprint";
import QuickCompare from "./speedgames-parts/QuickCompare";
import FallingObjects from "./speedgames-parts/FallingObjects";
import TapCounter from "./speedgames-parts/TapCounter";
import ReflexArrow from "./speedgames-parts/ReflexArrow";

interface SpeedGamesProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}

export default function SpeedGames({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: SpeedGamesProps) {
   const [currentGame, setCurrentGame] = useState<string>("");

   useEffect(() => {
      if (!isPlaying) return;

      const gameType = config.gameType;

      // Check if gameType is empty string or invalid
      if (gameType && gameType.trim() !== "") {
         setCurrentGame(gameType);
      }
   }, [isPlaying, config]);

   const gameComponents: Record<string, JSX.Element> = {
      "click-green": (
         <ClickGreen
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "avoid-red": (
         <AvoidRed
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "reaction-test": (
         <ReactionTest
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "fast-math": (
         <FastMath
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
            passingScore={70}
         />
      ),
      "whack-shape": (
         <WhackShape
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
            passingScore={70}
         />
      ),
      "typing-sprint": (
         <TypingSprint
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "quick-compare": (
         <QuickCompare
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "falling-objects": (
         <FallingObjects
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "tap-counter": (
         <TapCounter
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "reflex-arrow": (
         <ReflexArrow
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
   };

   return (
      gameComponents[currentGame] || (
         <div>Speed game "{currentGame}" not found.</div>
      )
   );
}
