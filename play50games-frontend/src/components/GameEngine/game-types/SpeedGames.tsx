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

      if (!gameType) {
         return;
      }

      setCurrentGame(gameType);
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
      "reflex-arrows": (
         <ReflexArrows
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

// Reflex Arrows Game (35)
function ReflexArrows({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}) {
   const rounds = config.rounds || 15;
   const [targetArrow, setTargetArrow] = useState<string>("");
   const [round, setRound] = useState(0);
   const [score, setScore] = useState(0);
   const [startTime, setStartTime] = useState(0);

   useEffect(() => {
      if (round >= rounds) {
         const finalScore = Math.round((score / rounds) * 100);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }

      const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      const arrow = arrows[Math.floor(Math.random() * arrows.length)];
      setTargetArrow(arrow);
      setStartTime(Date.now());
   }, [round, rounds, score, onScoreUpdate, onComplete]);

   const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === targetArrow) {
         const reactionTime = Date.now() - startTime;
         const roundScore = Math.max(0, 100 - reactionTime / 10);
         setScore(score + roundScore);
         setRound(round + 1);
      }
   };

   const arrowSymbols: Record<string, string> = {
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
   };

   return (
      <div
         className="reflex-arrows-game"
         onKeyDown={handleKeyPress}
         tabIndex={0}
      >
         <h3>
            Reflex Arrows - Round {round + 1}/{rounds}
         </h3>
         <div className="arrow-display">
            <div className="target-arrow">{arrowSymbols[targetArrow]}</div>
         </div>
         <p>Press the arrow key shown!</p>
      </div>
   );
}
