"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
                        setTimeout(() => setUnlimitedActivated(false), 15000);
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
               setTimeout(() => setUnlimitedActivated(false), 15000);
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
         setTimeout(() => {
            onComplete(currentScore);
         }, 1000);
      }
   }, [currentRound, maxRounds, currentScore, onComplete]);

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
               setTimeout(() => {
                  setCurrentRound((prev) => prev + 1);
               }, 1200);
            }
         } else {
            // Wrong step
            setWrongSymbolIndex(step);
            setGameState("wrong");
            setFeedback("wrong");
            // Repeat the same round after showing feedback
            setTimeout(() => {
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
      [gameState, userInput, sequence, clickedPaletteIndices, startNewRound]
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
         setTimeout(() => setShareSuccess(false), 15000);
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

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100%",
            width: "100%",
            padding: isMobile ? "12px" : "20px",
            gap: isMobile ? "16px" : "24px",
         }}
      >
         {/* Header Section */}
         <div
            style={{
               width: "100%",
               maxWidth: "800px",
               display: "flex",
               flexDirection: "column",
               gap: isMobile ? "12px" : "16px",
               padding: isMobile ? "12px" : "16px",
               background: "var(--panel)",
               borderRadius: "var(--radius)",
               border: "1px solid var(--border)",
            }}
         >
            <div
               style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: isMobile ? "8px" : "12px",
               }}
            >
               <span
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "6px",
                     fontSize: isMobile ? "0.85rem" : "0.95rem",
                     color: "var(--text)",
                     fontWeight: 600,
                  }}
               >
                  <ArrowPathIcon style={{ width: 16, height: 16 }} />
                  Round {currentRound + 1} / {maxRounds}
               </span>
               <span
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "6px",
                     fontSize: isMobile ? "0.85rem" : "0.95rem",
                     color: "var(--text)",
                     fontWeight: 600,
                  }}
               >
                  <TrophyIcon style={{ width: 16, height: 16 }} />
                  Score: {currentScore} / 100
               </span>
            </div>
            <div
               style={{
                  width: "100%",
                  height: isMobile ? "6px" : "8px",
                  background: "var(--bg)",
                  borderRadius: "999px",
                  overflow: "hidden",
               }}
            >
               <div
                  style={{
                     width: `${progress}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))",
                     borderRadius: "999px",
                     transition: "width 0.3s ease",
                  }}
               />
            </div>
         </div>

         {/* Game Board */}
         <div
            style={{
               width: "100%",
               maxWidth: "800px",
               display: "flex",
               flexDirection: "column",
               alignItems: "center",
               gap: isMobile ? "20px" : "32px",
            }}
         >
            {/* Stack Display */}
            <div
               style={{
                  display: "flex",
                  flexDirection: "column-reverse", // Bottom to top
                  alignItems: "center",
                  gap: isMobile ? "10px" : "12px",
                  minHeight: isMobile ? "200px" : "280px",
                  width: "100%",
                  padding: isMobile ? "16px" : "24px",
                  background: "var(--panel)",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
               }}
            >
               {sequence.map((symbol, index) => {
                  const isFlashing = flashingSymbolIndex === index;
                  const isSelected = userInput.length > index;
                  const isHinted = hintRevealed.includes(index);
                  const isWrong = wrongSymbolIndex === index;
                  const isEmpty =
                     gameState === "input" && !isSelected && !isHinted;
                  const userSymbol = userInput[index];

                  return (
                     <div
                        key={index}
                        style={{
                           width: isMobile ? "100px" : "120px",
                           height: isMobile ? "38px" : "42px",
                           borderRadius: "10px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           fontSize: isMobile ? "20px" : "24px",
                           fontWeight: 900,
                           background: isWrong
                              ? "var(--warn)"
                              : isSelected && userSymbol === sequence[index]
                              ? "var(--ok)"
                              : isFlashing
                              ? "rgba(59, 130, 246, 0.9)"
                              : isHinted
                              ? "rgba(251, 191, 36, 0.2)"
                              : isEmpty
                              ? "var(--bg)"
                              : "var(--panel)",
                           border: isWrong
                              ? "2px solid var(--warn)"
                              : isHinted
                              ? "2px solid rgba(251, 191, 36, 0.9)"
                              : isFlashing
                              ? "2px solid rgba(59, 130, 246, 0.9)"
                              : isEmpty
                              ? "2px dashed var(--border)"
                              : "2px solid var(--border)",
                           color:
                              isWrong ||
                              (isSelected && userSymbol === sequence[index])
                                 ? "white"
                                 : isEmpty
                                 ? "var(--muted)"
                                 : "var(--text)",
                           transition: "all 0.2s ease",
                           transform: isFlashing ? "scale(1.05)" : "scale(1)",
                           boxShadow: isFlashing
                              ? "0 4px 12px rgba(59, 130, 246, 0.4)"
                              : isWrong
                              ? "0 2px 8px rgba(251, 113, 133, 0.3)"
                              : "none",
                           opacity: isEmpty ? 0.6 : 1,
                        }}
                     >
                        {/* Show icon based on game state */}
                        {(() => {
                           const IconComponent = getIconComponent(symbol);
                           const UserIconComponent = userSymbol
                              ? getIconComponent(userSymbol)
                              : null;

                           if (gameState === "memorizing" && isFlashing) {
                              // Show icon during memorizing phase
                              return IconComponent ? (
                                 <IconComponent
                                    style={{
                                       width: isMobile ? 20 : 24,
                                       height: isMobile ? 20 : 24,
                                    }}
                                 />
                              ) : null;
                           } else if (
                              gameState === "input" &&
                              isSelected &&
                              UserIconComponent
                           ) {
                              // Show user's selected icon (always show, whether correct or wrong)
                              return (
                                 <UserIconComponent
                                    style={{
                                       width: isMobile ? 20 : 24,
                                       height: isMobile ? 20 : 24,
                                    }}
                                 />
                              );
                           } else if (
                              gameState === "input" &&
                              isHinted &&
                              IconComponent
                           ) {
                              // Show correct icon when hinted
                              return (
                                 <IconComponent
                                    style={{
                                       width: isMobile ? 20 : 24,
                                       height: isMobile ? 20 : 24,
                                    }}
                                 />
                              );
                           } else if (gameState === "input" && isEmpty) {
                              // Show question mark for empty slot
                              return "?";
                           }
                           return null;
                        })()}
                     </div>
                  );
               })}
            </div>

            {/* Game State Message */}
            {gameState === "memorizing" && (
               <div
                  style={{
                     fontSize: isMobile ? "0.95rem" : "1.1rem",
                     color: "var(--muted)",
                     textAlign: "center",
                     fontWeight: 500,
                  }}
               >
                  Watch the symbols stack up...
               </div>
            )}

            {gameState === "input" && (
               <div
                  style={{
                     fontSize: isMobile ? "0.95rem" : "1.1rem",
                     color: "var(--text)",
                     textAlign: "center",
                     fontWeight: 500,
                  }}
               >
                  Rebuild the stack from bottom to top
               </div>
            )}

            {/* Symbol Palette (Input Mode) */}
            {gameState === "input" && (
               <div
                  style={{
                     display: "flex",
                     flexWrap: "wrap",
                     gap: isMobile ? "12px" : "16px",
                     justifyContent: "center",
                     width: "100%",
                  }}
               >
                  {shuffledPalette.map((symbol, index) => {
                     // Check if this palette item has been clicked
                     const isUsed = clickedPaletteIndices.includes(index);
                     const isSelectedNav = selectedSymbolIndex === index;

                     return (
                        <button
                           key={`${symbol}-${index}`}
                           onClick={() => handleSymbolClick(symbol, index)}
                           disabled={isUsed}
                           style={{
                              position: "relative",
                              width: isMobile ? "50px" : "54px",
                              height: isMobile ? "50px" : "54px",
                              borderRadius: "14px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: isMobile ? "22px" : "26px",
                              fontWeight: 900,
                              background: isSelectedNav
                                 ? "rgba(59, 130, 246, 0.3)"
                                 : isUsed
                                 ? "var(--bg)"
                                 : "var(--panel)",
                              border: isSelectedNav
                                 ? "2px solid rgba(59, 130, 246, 0.9)"
                                 : "2px solid var(--border)",
                              color: isUsed ? "var(--muted)" : "var(--text)",
                              cursor: isUsed ? "not-allowed" : "pointer",
                              transition: "all 0.15s ease",
                              opacity: isUsed ? 0.5 : 1,
                           }}
                        >
                           {(() => {
                              const IconComponent = getIconComponent(symbol);
                              return IconComponent ? (
                                 <IconComponent
                                    style={{
                                       width: isMobile ? 22 : 26,
                                       height: isMobile ? 22 : 26,
                                    }}
                                 />
                              ) : null;
                           })()}
                           {/* Number badge for keyboard input */}
                           {!isUsed && (
                              <div
                                 style={{
                                    position: "absolute",
                                    top: "4px",
                                    left: "4px",
                                    width: isMobile ? "18px" : "20px",
                                    height: isMobile ? "18px" : "20px",
                                    borderRadius: "50%",
                                    background:
                                       "linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))",
                                    border:
                                       "2px solid rgba(255, 255, 255, 0.3)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: isMobile ? "0.65rem" : "0.7rem",
                                    fontWeight: 700,
                                    color: "white",
                                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                                 }}
                              >
                                 {index + 1}
                              </div>
                           )}
                        </button>
                     );
                  })}
               </div>
            )}

            {/* Feedback Messages */}
            {feedback === "correct" && (
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "8px",
                     padding: isMobile ? "10px 16px" : "12px 20px",
                     background: "var(--ok)",
                     border: "1px solid var(--ok)",
                     borderRadius: "var(--radius)",
                     color: "white",
                     fontSize: isMobile ? "0.9rem" : "1rem",
                     fontWeight: 600,
                  }}
               >
                  <CheckCircleIcon style={{ width: 20, height: 20 }} />
                  Correct!
               </div>
            )}

            {feedback === "wrong" && (
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "8px",
                     padding: isMobile ? "10px 16px" : "12px 20px",
                     background: "var(--warn)",
                     border: "1px solid var(--warn)",
                     borderRadius: "var(--radius)",
                     color: "white",
                     fontSize: isMobile ? "0.9rem" : "1rem",
                     fontWeight: 600,
                  }}
               >
                  <XCircleIcon style={{ width: 20, height: 20 }} />
                  Wrong! Try again.
               </div>
            )}

            {/* Share Success Message */}
            {shareSuccess && (
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "8px",
                     padding: isMobile ? "10px 16px" : "12px 20px",
                     background: "var(--ok)",
                     border: "1px solid var(--ok)",
                     borderRadius: "var(--radius)",
                     color: "white",
                     fontSize: isMobile ? "0.85rem" : "0.95rem",
                     fontWeight: 500,
                  }}
               >
                  <CheckCircleIcon style={{ width: 18, height: 18 }} />
                  Link copied! Unlimited hints will unlock when someone opens
                  your link!
               </div>
            )}

            {/* Unlimited Hints Activated Message */}
            {unlimitedActivated && (
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "8px",
                     padding: isMobile ? "10px 16px" : "12px 20px",
                     background: "rgba(59, 130, 246, 0.9)",
                     border: "1px solid rgba(59, 130, 246, 0.9)",
                     borderRadius: "var(--radius)",
                     color: "white",
                     fontSize: isMobile ? "0.85rem" : "0.95rem",
                     fontWeight: 500,
                  }}
               >
                  <CheckCircleIcon style={{ width: 18, height: 18 }} />
                  🎉 Someone opened your link! Unlimited hints is now active for
                  15 minutes!
               </div>
            )}
         </div>

         {/* Hint and Share Buttons */}
         <div
            style={{
               display: "flex",
               gap: isMobile ? "12px" : "16px",
               width: "100%",
               maxWidth: "800px",
               justifyContent: "center",
            }}
         >
            <button
               onClick={handleHint}
               disabled={
                  gameState !== "input" ||
                  (maxHints > 0 && hintsUsed >= maxHints) ||
                  userInput.length >= sequence.length
               }
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: isMobile ? "10px 16px" : "12px 20px",
                  background:
                     gameState !== "input" ||
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     userInput.length >= sequence.length
                        ? "var(--bg)"
                        : "rgba(251, 191, 36, 0.2)",
                  border:
                     gameState !== "input" ||
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     userInput.length >= sequence.length
                        ? "1px solid var(--border)"
                        : "1px solid rgba(251, 191, 36, 0.9)",
                  borderRadius: "var(--radius)",
                  color:
                     gameState !== "input" ||
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     userInput.length >= sequence.length
                        ? "var(--muted)"
                        : "rgba(251, 191, 36, 0.9)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
                  cursor:
                     gameState !== "input" ||
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     userInput.length >= sequence.length
                        ? "not-allowed"
                        : "pointer",
                  transition: "all 0.2s ease",
               }}
            >
               <LightBulbIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                  }}
               />
               <span>
                  Hint ({maxHints === 0 ? "∞" : `${maxHints - hintsUsed}`})
               </span>
            </button>

            <button
               onClick={handleShare}
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: isMobile ? "10px 16px" : "12px 20px",
                  background: "rgba(59, 130, 246, 0.2)",
                  border: "1px solid rgba(59, 130, 246, 0.9)",
                  borderRadius: "var(--radius)",
                  color: "rgba(59, 130, 246, 0.9)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
               }}
            >
               <ShareIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                     color: "rgba(59, 130, 246, 0.9)",
                  }}
               />
               <span>{isMobile ? "Share" : "Share for Unlimited Hints"}</span>
            </button>
         </div>
      </div>
   );
}

export default SymbolStack;
