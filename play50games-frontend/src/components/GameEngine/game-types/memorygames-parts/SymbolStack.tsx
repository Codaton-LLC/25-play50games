"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import m from "./mobile.module.css";
import s from "./SymbolStack.module.css";
import {
   CheckCircleIcon,
   XCircleIcon,
   LightBulbIcon,
   ShareIcon,
   ArrowPathIcon,
   TrophyIcon,
   StarIcon,
   HeartIcon,
   HomeIcon,
   FireIcon,
   BoltIcon,
   ShieldCheckIcon,
   FlagIcon,
   CubeIcon,
   SparklesIcon,
   GiftIcon,
   MoonIcon,
   Square3Stack3DIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

function SymbolStack({
   config,
   onScoreUpdate,
   onComplete,
   passingScore = 70,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   passingScore?: number;
}) {
   const maxRounds = config.rounds || 15;
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [sequence, setSequence] = useState<string[]>([]);
   const [userInput, setUserInput] = useState<string[]>([]);
   const [clickedPaletteIndices, setClickedPaletteIndices] = useState<number[]>(
      []
   );
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);
   const [flashingSymbolIndex, setFlashingSymbolIndex] = useState<
      number | null
   >(null);
   const [wrongSymbolIndex, setWrongSymbolIndex] = useState<number | null>(
      null
   );
   const [selectedSymbolIndex, setSelectedSymbolIndex] = useState<
      number | null
   >(null);
   const sequenceTimersRef = useRef<NodeJS.Timeout[]>([]);

   // Heroicons for symbols (using a subset for better visibility)
   const SYMBOL_ICONS = useMemo(
      () => [
         "Star",
         "Heart",
         "Home",
         "Fire",
         "Bolt",
         "Trophy",
         "ShieldCheck",
         "Flag",
         "Cube",
         "Sparkles",
         "Gift",
         "Moon",
      ],
      []
   );

   // Get icon component by name
   const getIconComponent = useCallback((iconName: string) => {
      const iconMap: Record<string, React.ComponentType<any>> = {
         Star: StarIcon,
         Heart: HeartIcon,
         Home: HomeIcon,
         Fire: FireIcon,
         Bolt: BoltIcon,
         Trophy: TrophyIcon,
         ShieldCheck: ShieldCheckIcon,
         Flag: FlagIcon,
         Cube: CubeIcon,
         Sparkles: SparklesIcon,
         Gift: GiftIcon,
         Moon: MoonIcon,
      };
      return iconMap[iconName] || StarIcon;
   }, []);

   // Hint functionality
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [hintRevealed, setHintRevealed] = useState<number[]>([]);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
   // 15 s share-message timers: cleared on unmount
   const shareTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
   const shareTimeout = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
         shareTimersRef.current.delete(t);
         fn();
      }, ms);
      shareTimersRef.current.add(t);
   };
   useEffect(() => {
      const timers = shareTimersRef.current;
      return () => {
         timers.forEach(clearTimeout);
         timers.clear();
      };
   }, []);

   // Round-flow timers (next round, retry, completion): the same delays as before, but cleared
   // when the game unmounts so a timer never fires into a closed game.
   const roundTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
   const later = useCallback((fn: () => void, ms: number) => {
      const t = setTimeout(() => {
         roundTimersRef.current.delete(t);
         fn();
      }, ms);
      roundTimersRef.current.add(t);
   }, []);
   useEffect(() => {
      const timers = roundTimersRef.current;
      return () => {
         timers.forEach(clearTimeout);
         timers.clear();
      };
   }, []);

   // Max hints: 10, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Get sequence length based on round
   const sequenceLength = useMemo(() => {
      return 3 + currentRound; // Round 0: 3, Round 1: 4, Round 2: 5, etc.
   }, [currentRound]);

   // Responsive design
   useEffect(() => {
      const checkResponsive = () => {
         setIsMobile(window.innerWidth < 640);
         setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024);
      };
      checkResponsive();
      window.addEventListener("resize", checkResponsive);
      return () => window.removeEventListener("resize", checkResponsive);
   }, []);

   // Check for existing share on mount
   useEffect(() => {
      const checkShare = async () => {
         try {
            const gameKey = "play50games_shared_symbol-stack";
            const stored = localStorage.getItem(gameKey);
            if (stored) {
               try {
                  const data = JSON.parse(stored);
                  const shareId =
                     data.share_id || localStorage.getItem("currentShareId");
                  if (shareId) {
                     // Check if expired
                     if (data.expiry && Date.now() > data.expiry) {
                        localStorage.removeItem(gameKey);
                        return;
                     }
                     const status = await getShareStatus(shareId);
                     if (status.has_clicks || status.clicks > 0) {
                        setHasShared(true);
                        setUnlimitedActivated(true);
                        setCurrentShareId(shareId);
                        shareTimeout(() => setUnlimitedActivated(false), 15000);
                     }
                  }
               } catch (error) {
                  // Handle 404 or invalid data - clean up
                  const errorMessage =
                     error instanceof Error ? error.message : String(error);
                  if (
                     errorMessage.includes("404") ||
                     errorMessage.includes("not found") ||
                     errorMessage.includes("expired")
                  ) {
                     // Share not found in backend - clean up
                     localStorage.removeItem(gameKey);
                     setCurrentShareId(null);
                     setHasShared(false);
                     setUnlimitedActivated(false);
                  }
               }
            }
         } catch (error) {
            // No share exists, ignore
         }
      };
      checkShare();
   }, []);

   // Share status check interval
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         // Check expiry from localStorage before making API call
         const gameKey = "play50games_shared_symbol-stack";
         const stored = localStorage.getItem(gameKey);
         if (stored) {
            try {
               const data = JSON.parse(stored);
               // Check if share has expired (15 minutes)
               if (data.expiry && Date.now() > data.expiry) {
                  // Share expired - clean up
                  localStorage.removeItem(gameKey);
                  if (shareCheckIntervalRef.current) {
                     clearInterval(shareCheckIntervalRef.current);
                  }
                  setCurrentShareId(null);
                  setHasShared(false);
                  setUnlimitedActivated(false);
                  return;
               }
            } catch (error) {
               // Invalid data, clean up
               localStorage.removeItem(gameKey);
            }
         }

         try {
            const status = await getShareStatus(currentShareId);
            if ((status.has_clicks || status.clicks > 0) && !hasShared) {
               setHasShared(true);
               setUnlimitedActivated(true);
               // Store expiry time (15 minutes from now)
               const EXPIRY_TIME = 15 * 60 * 1000;
               const expiryTime = Date.now() + EXPIRY_TIME;
               localStorage.setItem(
                  gameKey,
                  JSON.stringify({
                     shared: true,
                     expiry: expiryTime,
                     share_id: currentShareId,
                  })
               );
               shareTimeout(() => setUnlimitedActivated(false), 15000);
            }
         } catch (error) {
            // Handle 404 as expired share
            const errorMessage =
               error instanceof Error ? error.message : String(error);
            if (
               errorMessage.includes("404") ||
               errorMessage.includes("not found") ||
               errorMessage.includes("expired")
            ) {
               // Share expired or not found - clean up
               localStorage.removeItem(gameKey);
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
               }
               setCurrentShareId(null);
               setHasShared(false);
               setUnlimitedActivated(false);
            }
         }
      };

      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000);
      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, hasShared]);

   // Clear sequence timers
   const clearSequenceTimers = useCallback(() => {
      sequenceTimersRef.current.forEach((timer) => clearTimeout(timer));
      sequenceTimersRef.current = [];
   }, []);

   // Generate random sequence
   const generateSequence = useCallback((): string[] => {
      const seq: string[] = [];
      for (let i = 0; i < sequenceLength; i++) {
         const randomIcon =
            SYMBOL_ICONS[Math.floor(Math.random() * SYMBOL_ICONS.length)];
         seq.push(randomIcon);
      }
      return seq;
   }, [sequenceLength, SYMBOL_ICONS]);

   // Start new round
   const startNewRound = useCallback(() => {
      clearSequenceTimers();
      setSequence([]);
      setUserInput([]);
      setClickedPaletteIndices([]);
      setHintRevealed([]);
      setWrongSymbolIndex(null);
      setFlashingSymbolIndex(null);
      setFeedback(null);
      setGameState("memorizing");

      // Generate new sequence
      const newSequence = generateSequence();
      setSequence(newSequence);

      // Play sequence animation (one by one, bottom to top)
      newSequence.forEach((symbol, stepIndex) => {
         const timer = setTimeout(() => {
            setFlashingSymbolIndex(stepIndex);
            setTimeout(() => {
               setFlashingSymbolIndex(null);
            }, 400);
         }, stepIndex * 600);

         sequenceTimersRef.current.push(timer);
      });

      // After sequence finishes, switch to input mode
      const finalTimer = setTimeout(() => {
         setGameState("input");
         setFlashingSymbolIndex(null);
      }, newSequence.length * 600 + 500);

      sequenceTimersRef.current.push(finalTimer);
   }, [sequenceLength, generateSequence, clearSequenceTimers]);

   // Start first round
   useEffect(() => {
      if (currentRound < maxRounds) {
         startNewRound();
      }
   }, [currentRound, maxRounds, startNewRound]);

   // Update score
   useEffect(() => {
      const completedRounds = currentRound;
      const newScore = Math.round((completedRounds / maxRounds) * 100);
      setCurrentScore(newScore);
      if (completedRounds > 0) {
         setTimeout(() => {
            onScoreUpdate(newScore);
         }, 0);
      }
   }, [currentRound, maxRounds, onScoreUpdate]);

   // Check game completion
   useEffect(() => {
      if (currentRound >= maxRounds) {
         later(() => {
            onComplete(currentScore);
         }, 1000);
      }
   }, [currentRound, maxRounds, currentScore, onComplete, later]);

   // Shuffle palette symbols (for input)
   const shuffledPalette = useMemo(() => {
      const palette = [...sequence].sort(() => Math.random() - 0.5);
      return palette;
   }, [sequence]);

   // Handle symbol click
   const handleSymbolClick = useCallback(
      (symbol: string, index: number) => {
         if (gameState !== "input") return;
         if (userInput.length >= sequence.length) return;
         if (clickedPaletteIndices.includes(index)) return; // Already clicked

         const step = userInput.length;
         const newUserInput = [...userInput, symbol];
         setUserInput(newUserInput);
         setClickedPaletteIndices([...clickedPaletteIndices, index]);

         // Check if correct
         if (symbol === sequence[step]) {
            // Correct step
            if (newUserInput.length === sequence.length) {
               // Sequence complete
               setGameState("correct");
               setFeedback("correct");
               later(() => {
                  setCurrentRound((prev) => prev + 1);
               }, 1200);
            }
         } else {
            // Wrong step
            setWrongSymbolIndex(step);
            setGameState("wrong");
            setFeedback("wrong");
            // Repeat the same round after showing feedback
            later(() => {
               setUserInput([]);
               setClickedPaletteIndices([]);
               setWrongSymbolIndex(null);
               setGameState("input");
               setFeedback(null);
               // Replay the same sequence
               startNewRound();
            }, 1500);
         }
      },
      [gameState, userInput, sequence, clickedPaletteIndices, startNewRound, later]
   );

   // Handle hint
   const handleHint = useCallback(() => {
      if (gameState !== "input") return;
      if (maxHints > 0 && hintsUsed >= maxHints) return;

      const nextPositionIndex = userInput.length;
      if (nextPositionIndex >= sequence.length) return;
      if (hintRevealed.includes(nextPositionIndex)) return;

      setHintRevealed([...hintRevealed, nextPositionIndex]);
      setHintsUsed((prev) => prev + 1);
   }, [gameState, userInput, sequence, hintsUsed, maxHints, hintRevealed]);

   // Generate share URL
   const generateShareUrl = useCallback(() => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return { shareUrl: `${currentUrl}?shared=${shareId}`, shareId };
   }, []);

   // Register share link in backend
   const registerShareLink = useCallback(async (shareId: string) => {
      try {
         await registerShare(shareId, "symbol-stack");
         const gameKey = "play50games_shared_symbol-stack";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {
         // Error registering share
      }
   }, []);

   // Handle share
   const handleShare = useCallback(async () => {
      try {
         const { shareUrl, shareId } = generateShareUrl();

         // Register share link in backend
         await registerShareLink(shareId);

         if (navigator.share) {
            try {
               await navigator.share({
                  title: "Symbol Stack - Play50Games",
                  text: "Check out this memory game!",
                  url: shareUrl,
               });
            } catch (err) {
               // User cancelled or error - still copy to clipboard
               await navigator.clipboard.writeText(shareUrl);
            }
         } else {
            // Clipboard fallback
            await navigator.clipboard.writeText(shareUrl);
         }

         setShareSuccess(true);
         shareTimeout(() => setShareSuccess(false), 15000);
      } catch (error) {
         // Error sharing
      }
   }, [generateShareUrl, registerShareLink]);

   // Keyboard controls
   useEffect(() => {
      if (gameState !== "input") return;

      const handleKeyPress = (e: KeyboardEvent) => {
         // Prevent default for game controls
         if (
            (e.key >= "1" && e.key <= "9") ||
            e.key.startsWith("Arrow") ||
            ["w", "W", "s", "S", "a", "A", "d", "D", "Enter", " "].includes(
               e.key
            )
         ) {
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
               e.preventDefault();
            }
         }

         // Number keys 1-3 for direct symbol selection
         if (e.key >= "1" && e.key <= "3") {
            const symbolIndex = parseInt(e.key) - 1;
            if (symbolIndex < shuffledPalette.length) {
               const symbol = shuffledPalette[symbolIndex];
               handleSymbolClick(symbol, symbolIndex);
            }
         }

         // Arrow keys or WASD for navigation
         if (selectedSymbolIndex === null) {
            setSelectedSymbolIndex(0);
         } else {
            if (
               e.key === "ArrowUp" ||
               e.key === "w" ||
               e.key === "W" ||
               e.key === "ArrowDown" ||
               e.key === "s" ||
               e.key === "S"
            ) {
               // Vertical navigation (wrap around)
               setSelectedSymbolIndex(
                  (prev) =>
                     (prev! +
                        (e.key === "ArrowUp" || e.key === "w" || e.key === "W"
                           ? -1
                           : 1) +
                        shuffledPalette.length) %
                     shuffledPalette.length
               );
            } else if (
               e.key === "ArrowLeft" ||
               e.key === "a" ||
               e.key === "A" ||
               e.key === "ArrowRight" ||
               e.key === "d" ||
               e.key === "D"
            ) {
               // Horizontal navigation (wrap around)
               setSelectedSymbolIndex(
                  (prev) =>
                     (prev! +
                        (e.key === "ArrowLeft" || e.key === "a" || e.key === "A"
                           ? -1
                           : 1) +
                        shuffledPalette.length) %
                     shuffledPalette.length
               );
            }
         }

         // Enter or Space to select
         if (e.key === "Enter" || e.key === " ") {
            if (
               selectedSymbolIndex !== null &&
               selectedSymbolIndex < shuffledPalette.length
            ) {
               const symbol = shuffledPalette[selectedSymbolIndex];
               handleSymbolClick(symbol, selectedSymbolIndex);
            }
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [gameState, shuffledPalette, selectedSymbolIndex, handleSymbolClick]);

   // Cleanup on unmount
   useEffect(() => {
      return () => {
         clearSequenceTimers();
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [clearSequenceTimers]);

   const progress = ((currentRound + 1) / maxRounds) * 100;

   const hintDisabled =
      gameState !== "input" ||
      (maxHints > 0 && hintsUsed >= maxHints) ||
      userInput.length >= sequence.length;

   return (
      <div className={`${m.root} ${m.tight}`} style={{ maxWidth: "848px" }}>
         {/* Header Section */}
         <div className={m.panel}>
            <div className={m.stats}>
               <span className={m.stat}>
                  <ArrowPathIcon className={m.statIcon} />
                  Round <b>{currentRound + 1} / {maxRounds}</b>
               </span>
               <span className={m.stat}>
                  <TrophyIcon className={m.statIcon} />
                  Score <b>{currentScore} / 100</b>
               </span>
               <span className={m.stat}>
                  <Square3Stack3DIcon className={m.statIcon} />
                  Stack <b>{sequence.length}</b>
               </span>
               <span className={m.stat}>
                  <LightBulbIcon className={m.statIcon} />
                  Hints <b>{maxHints === 0 ? "∞" : `${maxHints - hintsUsed}/${maxHints}`}</b>
               </span>
            </div>
            {/* Progress Bar */}
            <div className={m.progress}>
               <div
                  className={m.progressFill}
                  style={{ transform: `scaleX(${Math.min(1, progress / 100)})` }}
               />
            </div>
         </div>

         {/* Game Board */}
         <div className={s.board}>
            {/* Stack Display */}
            <div className={s.stack}>
               {sequence.map((symbol, index) => {
                  const isFlashing = flashingSymbolIndex === index;
                  const isSelected = userInput.length > index;
                  const isHinted = hintRevealed.includes(index);
                  const isWrong = wrongSymbolIndex === index;
                  const isEmpty =
                     gameState === "input" && !isSelected && !isHinted;
                  const userSymbol = userInput[index];

                  const stateClass = isWrong
                     ? s.slotWrong
                     : isSelected && userSymbol === sequence[index]
                     ? s.slotOk
                     : isFlashing
                     ? s.slotFlash
                     : isHinted
                     ? s.slotHint
                     : isEmpty
                     ? s.slotEmpty
                     : "";

                  const IconComponent = getIconComponent(symbol);
                  const UserIconComponent = userSymbol
                     ? getIconComponent(userSymbol)
                     : null;

                  let content: React.ReactNode = null;
                  if (gameState === "memorizing" && isFlashing) {
                     // Show icon during memorizing phase
                     content = (
                        <IconComponent className={`${s.icon} ${s.iconPop}`} />
                     );
                  } else if (
                     gameState === "input" &&
                     isSelected &&
                     UserIconComponent
                  ) {
                     // Show user's selected icon (always show, whether correct or wrong)
                     content = (
                        <UserIconComponent className={`${s.icon} ${s.iconPop}`} />
                     );
                  } else if (gameState === "input" && isHinted) {
                     // Show correct icon when hinted
                     content = (
                        <IconComponent className={`${s.icon} ${s.iconPop}`} />
                     );
                  } else if (gameState === "input" && isEmpty) {
                     // Show question mark for empty slot
                     content = "?";
                  }

                  return (
                     <div
                        key={`${currentRound}-${index}`}
                        className={`${s.slot} ${stateClass}`}
                        style={{ ["--i" as string]: index }}
                     >
                        {content}
                     </div>
                  );
               })}
            </div>

            {/* Game State Message */}
            {gameState === "memorizing" && (
               <p className={`${s.status} ${s.statusMuted}`}>
                  Watch the symbols stack up...
               </p>
            )}

            {gameState === "input" && (
               <p className={s.status}>Rebuild the stack from bottom to top</p>
            )}

            {/* Symbol Palette (Input Mode) */}
            {gameState === "input" && (
               <div className={s.palette}>
                  {shuffledPalette.map((symbol, index) => {
                     // Check if this palette item has been clicked
                     const isUsed = clickedPaletteIndices.includes(index);
                     const isSelectedNav = selectedSymbolIndex === index;
                     const IconComponent = getIconComponent(symbol);

                     return (
                        <button
                           key={`${symbol}-${index}`}
                           type="button"
                           className={`${s.tile} ${isSelectedNav ? s.tileNav : ""}`}
                           style={{ ["--i" as string]: index }}
                           onClick={() => handleSymbolClick(symbol, index)}
                           disabled={isUsed}
                           aria-label={`${symbol} symbol`}
                        >
                           <IconComponent className={s.tileIcon} />
                           {/* Number badge for keyboard input */}
                           {!isUsed && <span className={s.key}>{index + 1}</span>}
                        </button>
                     );
                  })}
               </div>
            )}

            {/* Feedback Messages */}
            {feedback === "correct" && (
               <div role="status" className={`${m.feedback} ${m.feedbackOk}`}>
                  <CheckCircleIcon className={m.feedbackIcon} />
                  Correct!
               </div>
            )}

            {feedback === "wrong" && (
               <div role="status" className={`${m.feedback} ${m.feedbackBad}`}>
                  <XCircleIcon className={m.feedbackIcon} />
                  Wrong! Try again.
               </div>
            )}

            {/* Share Success Message */}
            {shareSuccess && !unlimitedActivated && (
               <div className={`${m.note} ${m.noteOk}`}>
                  <CheckCircleIcon className={m.noteIcon} />
                  <span>
                     Link copied! Unlimited hints will unlock when someone opens
                     your link!
                  </span>
               </div>
            )}

            {/* Unlimited Hints Activated Message */}
            {unlimitedActivated && (
               <div className={m.note}>
                  <CheckCircleIcon className={m.noteIcon} />
                  <span>
                     Someone opened your link! Unlimited hints are now active
                     for 15 minutes!
                  </span>
               </div>
            )}
         </div>

         {/* Hint and Share Buttons */}
         <div className={s.actions}>
            <button
               type="button"
               onClick={handleHint}
               className={`${m.btn} ${m.pill}`}
               disabled={hintDisabled}
            >
               <LightBulbIcon className={m.pillIcon} />
               <span>
                  Hint ({maxHints === 0 ? "∞" : `${maxHints - hintsUsed}`})
               </span>
            </button>

            <button
               type="button"
               onClick={handleShare}
               className={`${m.btn} ${m.pill}`}
            >
               <ShareIcon className={m.pillIcon} />
               <span>{isMobile ? "Share" : "Share for Unlimited Hints"}</span>
            </button>
         </div>
      </div>
   );
}

export default SymbolStack;
