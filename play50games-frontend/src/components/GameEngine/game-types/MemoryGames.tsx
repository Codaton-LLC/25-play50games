"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   LightBulbIcon,
   ShareIcon,
   ArrowPathIcon,
   ArrowPathRoundedSquareIcon,
   ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";
import CardFlipMemory from "./memorygames-parts/CardFlipMemory";
import SoundMemory from "./memorygames-parts/SoundMemory";
import EmojiMemory from "./memorygames-parts/EmojiMemory";
import NumberRecall from "./memorygames-parts/NumberRecall";
import ImageRecall from "./memorygames-parts/ImageRecall";
import PathMemory from "./memorygames-parts/PathMemory";
import WordMemory from "./memorygames-parts/WordMemory";
import FaceMemory from "./memorygames-parts/FaceMemory";
import ColorGridMemory from "./memorygames-parts/ColorGridMemory";
import SymbolStack from "./memorygames-parts/SymbolStack";

interface MemoryGamesProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function MemoryGames({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: MemoryGamesProps) {
   const [currentGame, setCurrentGame] = useState<string>("");

   useEffect(() => {
      if (!isPlaying) return;

      // Get gameType from config
      // config should already contain gameType from gameConfig that was passed from GameEngine
      const gameType = config.gameType;

      // Check if gameType is empty string or invalid
      if (gameType && gameType.trim() !== "") {
         setCurrentGame(gameType);
      } else {
         // If no gameType found, default to card-flip for backward compatibility
         setCurrentGame("card-flip");
      }
   }, [isPlaying, config]);

   const gameComponents: Record<string, JSX.Element> = {
      "card-flip": (
         <CardFlipMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "sound-memory": (
         <SoundMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "emoji-memory": (
         <EmojiMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "number-recall": (
         <NumberRecall
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "image-recall": (
         <ImageRecall
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "path-memory": (
         <PathMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
      "word-memory": (
         <WordMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
      "face-memory": (
         <FaceMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
      "color-grid-memory": (
         <ColorGridMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
      "symbol-stack": (
         <SymbolStack
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
   };

   return (
      gameComponents[currentGame] || (
         <div>Memory game "{currentGame}" not found.</div>
      )
   );
}
