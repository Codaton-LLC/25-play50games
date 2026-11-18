"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import m from "./mobile.module.css";
import ir from "./SequenceRecall.module.css";
import {
   CheckCircleIcon,
   XCircleIcon,
   LightBulbIcon,
   ShareIcon,
   ArrowPathIcon,
   TrophyIcon,
   PhotoIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

function ImageRecall({
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
   const maxRounds = config.rounds || 10;
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [sequence, setSequence] = useState<number[]>([]);
   const [userInput, setUserInput] = useState<number[]>([]);
   const sequenceRef = useRef<number[]>([]);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Hint functionality
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [hintRevealed, setHintRevealed] = useState<number[]>([]);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
   // this board's own card grid and reveal-flash timers (never document-wide)
   const boardRef = useRef<HTMLDivElement | null>(null);
   const flashTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

   // Max hints: 10 for Image Recall, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Get grid size based on round (from backend config)
   const getGridSizeForRound = useCallback((round: number): number => {
      // Default: rounds 1-4: 3x3, 5-8: 5x5, 9-10: 6x6
      if (round >= 1 && round <= 4) {
         return 3;
      } else if (round >= 5 && round <= 8) {
         return 5;
      } else {
         return 6;
      }
   }, []);

   // Get grid size from config or calculate from round
   const gridSize = useMemo(() => {
      if (
         config.gridSizes &&
         Array.isArray(config.gridSizes) &&
         config.gridSizes.length > 0
      ) {
         // Use round index, but if array is shorter than rounds, use last element or fallback
         const roundIndex = Math.min(currentRound, config.gridSizes.length - 1);
         const size = config.gridSizes[roundIndex];
         if (typeof size === "number") {
            return size;
         }
         if (Array.isArray(size)) {
            return size[0]; // Use first dimension for square grids
         }
      }
      // Fallback to default grid size calculation
      return getGridSizeForRound(currentRound + 1);
   }, [config.gridSizes, currentRound, getGridSizeForRound]);

   // Image emojis - enough for 6x6 grid (36 total)
   const IMAGES = useMemo(
      () => [
         "🧩",
         "🚀",
         "🌙",
         "🍎",
         "🎵",
         "📦",
         "⭐",
         "🐶",
         "🏀",
         "🔥",
         "🎲",
         "📌",
         "🎨",
         "🎯",
         "🎪",
         "🎭",
         "🎬",
         "🎤",
         "🎧",
         "🎮",
         "🦄",
         "🐱",
         "🐼",
         "🦁",
         "🐯",
         "🐸",
         "🐰",
         "🐻",
         "🐨",
         "🐷",
         "🦊",
         "🐺",
         "🐝",
         "🦋",
         "🐢",
         "🐠",
      ],
      []
   );

   // Get images for current grid size
   const currentImages = useMemo(() => {
      const totalCells = gridSize * gridSize;
      return IMAGES.slice(0, totalCells);
   }, [gridSize, IMAGES]);

   // Check if mobile/tablet device
   useEffect(() => {
      const checkDevice = () => {
         const width = window.innerWidth;
         setIsMobile(width < 768);
         setIsTablet(width >= 768 && width < 1024);
      };
      checkDevice();
      window.addEventListener("resize", checkDevice);
      return () => window.removeEventListener("resize", checkDevice);
   }, []);

   // Generate shareable link with tracking
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   };

   // Register share link in backend
   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "image-recall");
         const gameKey = "play50games_shared_image-recall";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {}
   };

   // Share functionality
   useEffect(() => {
      if (currentShareId) {
         shareCheckIntervalRef.current = setInterval(async () => {
            // Check if currentShareId still exists before making the API call
            if (!currentShareId) {
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
               }
               return;
            }

            // Check expiry from localStorage before making API call
            const gameKey = "play50games_shared_image-recall";
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
               if (status && status.clicks > 0 && !unlimitedActivated) {
                  setUnlimitedActivated(true);
                  setHasShared(true);
                  // Store expiry time (15 minutes from now)
                  const gameKey = "play50games_shared_image-recall";
                  const expiryTime = Date.now() + 15 * 60 * 1000;
                  localStorage.setItem(
                     gameKey,
                     JSON.stringify({
                        share_id: currentShareId,
                        expiry: expiryTime,
                        shared: true,
                     })
                  );
                  if (shareCheckIntervalRef.current) {
                     clearInterval(shareCheckIntervalRef.current);
                  }
                  setTimeout(() => {
                     setUnlimitedActivated(false);
                     setHasShared(false);
                     localStorage.removeItem(gameKey);
                  }, 15 * 60 * 1000);
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
                  const gameKey = "play50games_shared_image-recall";
                  localStorage.removeItem(gameKey);
                  if (shareCheckIntervalRef.current) {
                     clearInterval(shareCheckIntervalRef.current);
                  }
                  setCurrentShareId(null);
                  setHasShared(false);
                  setUnlimitedActivated(false);
               }
            }
         }, 10000); // Check every 10 seconds
      }

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, unlimitedActivated]);

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_image-recall";
      const stored = localStorage.getItem(gameKey);
      if (stored) {
         try {
            const data = JSON.parse(stored);
            // Check if share has expired
            if (data.expiry && Date.now() > data.expiry) {
               // Share expired - clean up
               localStorage.removeItem(gameKey);
               return;
            }
            if (data.share_id) {
               setCurrentShareId(data.share_id);
               // Verify with backend before activating unlimited
               const verifyShare = async () => {
                  try {
                     const status = await getShareStatus(data.share_id);
                     if (status && status.clicks > 0) {
                        // Share exists in backend and has clicks - activate unlimited
                        if (
                           data.shared &&
                           data.expiry &&
                           Date.now() < data.expiry
                        ) {
                           // Already activated and not expired
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           setTimeout(() => {
                              setUnlimitedActivated(false);
                              setHasShared(false);
                              localStorage.removeItem(gameKey);
                           }, data.expiry - Date.now());
                        } else {
                           // Has clicks but not activated yet - activate now
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           const expiryTime = Date.now() + 15 * 60 * 1000; // 15 minutes
                           localStorage.setItem(
                              gameKey,
                              JSON.stringify({
                                 share_id: data.share_id,
                                 expiry: expiryTime,
                                 shared: true,
                              })
                           );
                           setTimeout(() => {
                              setUnlimitedActivated(false);
                              setHasShared(false);
                              localStorage.removeItem(gameKey);
                           }, 15 * 60 * 1000);
                        }
                     } else {
                        // Share doesn't exist in backend or has no clicks - clean up
                        localStorage.removeItem(gameKey);
                        setCurrentShareId(null);
                     }
                  } catch (error) {
                     // Error checking share (404 or other) - clean up
                     localStorage.removeItem(gameKey);
                     setCurrentShareId(null);
                  }
               };
               verifyShare();
            }
         } catch (error) {
            // Invalid data, clean up
            localStorage.removeItem(gameKey);
         }
      }
   }, []);

   // Handle copy link to clipboard
   const handleCopyLink = async (shareId: string) => {
      const currentUrl = window.location.href.split("?")[0];
      const shareableLink = `${currentUrl}?shared=${shareId}`;

      try {
         await navigator.clipboard.writeText(shareableLink);
         setShareSuccess(true);
         setTimeout(() => setShareSuccess(false), 15000);
      } catch (error) {
         const textArea = document.createElement("textarea");
         textArea.value = shareableLink;
         textArea.style.position = "fixed";
         textArea.style.opacity = "0";
         document.body.appendChild(textArea);
         textArea.select();
         try {
            document.execCommand("copy");
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000);
         } catch (err) {}
         document.body.removeChild(textArea);
      }
   };

   // Handle share via Web Share API or fallback
   const handleShare = async () => {
      const shareableLink = getShareableLink();
      const shareId = new URL(shareableLink).searchParams.get("shared") || "";

      if (!shareId) return;

      await registerShareLink(shareId);

      if (navigator.share) {
         try {
            await navigator.share({
               title: "Image Recall Game",
               text: "Check out this awesome Image Recall game!",
               url: shareableLink,
            });
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000);
         } catch (error: any) {
            if (error.name !== "AbortError") {
               handleCopyLink(shareId);
            }
         }
      } else {
         handleCopyLink(shareId);
      }
   };

   // Handle hint button click
   const handleHint = () => {
      if (maxHints > 0 && hintsUsed >= maxHints) return;
      if (gameState !== "input") return;
      if (sequence.length === 0) return;

      // Find the first position in sequence that hasn't been revealed yet
      const allPositions = sequence.map((_, idx) => idx); // [0, 1, 2, ...]
      const unrevealedPositions = allPositions.filter(
         (pos) => !hintRevealed.includes(pos)
      );

      if (unrevealedPositions.length > 0) {
         // Reveal the first unrevealed position
         const nextPosition = unrevealedPositions[0];
         setHintRevealed([...hintRevealed, nextPosition]);
         setHintsUsed(hintsUsed + 1);
      }
   };

   // Start round
   const startRound = useCallback(() => {
      // Sequence length: scales with grid size and round
      // 3x3: 2-4, 5x5: 3-6, 6x6: 4-8
      const baseLength = Math.max(2, Math.floor(gridSize / 2));
      const maxLength = Math.min(gridSize + 1, 8);
      const sequenceLength = Math.min(
         baseLength + Math.floor((currentRound + 1) / 2),
         maxLength
      );

      // Pick distinct images for sequence (no duplicates)
      const available = [...Array(currentImages.length).keys()].sort(
         () => Math.random() - 0.5
      );
      const newSequence = available.slice(0, sequenceLength);

      setSequence(newSequence);
      setUserInput([]);
      setGameState("memorizing");
      setFeedback(null);
      setHintRevealed([]);
      setSelectedCellIndex(null);

      // Show sequence with flashes
      let flashIndex = 0;
      let inputTimer: ReturnType<typeof setTimeout> | null = null;
      const flashInterval = setInterval(() => {
         if (flashIndex < newSequence.length) {
            flashIndex++;
         } else {
            clearInterval(flashInterval);
            // Hide after sequence
            inputTimer = setTimeout(() => {
               setGameState("input");
            }, 250);
         }
      }, 650);

      // Cleanup
      return () => {
         clearInterval(flashInterval);
         if (inputTimer) clearTimeout(inputTimer);
      };
   }, [currentRound, gridSize, currentImages.length]);

   // Start first round
   useEffect(() => {
      if (currentRound < maxRounds) {
         // hand the flash interval back so a round change or unmount clears it
         return startRound();
      }
   }, [currentRound, maxRounds, startRound]);

   // Check game completion
   useEffect(() => {
      if (currentRound >= maxRounds) {
         setTimeout(() => {
            onComplete(currentScore);
         }, 1000);
      }
   }, [currentRound, maxRounds, currentScore, onComplete]);

   // Selected cell for keyboard navigation
   const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(
      null
   );

   // Handle card click
   const handleCardClick = (idx: number) => {
      if (gameState !== "input") return;
      if (userInput.includes(idx)) return; // Already selected

      const newInput = [...userInput, idx];
      setUserInput(newInput);

      // Check if correct
      const step = newInput.length - 1;
      if (newInput[step] !== sequence[step]) {
         // Wrong answer
         setGameState("wrong");
         setFeedback("wrong");

         // Show correct sequence briefly
         setTimeout(() => {
            setFeedback(null);
            setUserInput([]);
            setGameState("input");
            setSelectedCellIndex(null);
         }, 2000);
         return;
      }

      // Correct step
      if (newInput.length === sequence.length) {
         // All correct - round complete
         const roundScore = Math.round(100 / maxRounds);
         const newScore = Math.min(currentScore + roundScore, 100);
         setCurrentScore(newScore);
         setGameState("correct");
         setFeedback("correct");
         setTimeout(() => {
            onScoreUpdate(newScore);
         }, 0);

         setTimeout(() => {
            setFeedback(null);
            setCurrentRound(currentRound + 1);
            setSelectedCellIndex(null);
         }, 1500);
      }
   };

   // Keyboard controls for Image Recall
   useEffect(() => {
      if (gameState !== "input") {
         setSelectedCellIndex(null);
         return;
      }

      const handleKeyPress = (e: KeyboardEvent) => {
         if (gameState !== "input") return;

         const key = e.key;
         const keyLower = key.toLowerCase();
         const totalCells = currentImages.length;

         // Number keys: Direct selection by position (1-9, 0, -, =)
         let position = -1;
         if (key >= "1" && key <= "9") {
            position = parseInt(key) - 1; // 1-9 → 0-8
         } else if (key === "0" && totalCells > 9) {
            position = 9; // 0 → position 10 (index 9)
         } else if (key === "-" && totalCells > 10) {
            position = 10; // - → position 11 (index 10)
         } else if (key === "=" && totalCells > 11) {
            position = 11; // = → position 12 (index 11)
         }

         // Direct selection with number keys
         if (position >= 0 && position < totalCells) {
            e.preventDefault();
            if (!userInput.includes(position)) {
               handleCardClick(position);
            }
            return;
         }

         // Arrow keys or WASD: Navigate and select
         if (selectedCellIndex === null) {
            // Initialize selection at first available cell
            if (
               key === "ArrowUp" ||
               key === "ArrowDown" ||
               key === "ArrowLeft" ||
               key === "ArrowRight" ||
               keyLower === "w" ||
               keyLower === "s" ||
               keyLower === "a" ||
               keyLower === "d"
            ) {
               e.preventDefault();
               // Find first cell that's not selected
               for (let i = 0; i < totalCells; i++) {
                  if (!userInput.includes(i)) {
                     setSelectedCellIndex(i);
                     return;
                  }
               }
            }
            return;
         }

         // Navigate with arrow keys
         let newIndex = selectedCellIndex;
         const currentRow = Math.floor(selectedCellIndex / gridSize);
         const currentCol = selectedCellIndex % gridSize;

         switch (key) {
            case "ArrowUp":
            case "w":
               e.preventDefault();
               if (currentRow > 0) {
                  newIndex = selectedCellIndex - gridSize;
               }
               break;
            case "ArrowDown":
            case "s":
               e.preventDefault();
               if (currentRow < gridSize - 1) {
                  newIndex = selectedCellIndex + gridSize;
               }
               break;
            case "ArrowLeft":
            case "a":
               e.preventDefault();
               if (currentCol > 0) {
                  newIndex = selectedCellIndex - 1;
               }
               break;
            case "ArrowRight":
            case "d":
               e.preventDefault();
               if (currentCol < gridSize - 1) {
                  newIndex = selectedCellIndex + 1;
               }
               break;
            case "Enter":
            case " ":
               e.preventDefault();
               if (!userInput.includes(selectedCellIndex)) {
                  handleCardClick(selectedCellIndex);
               }
               return;
         }

         // Update selected cell index (wrap around if needed)
         if (newIndex !== selectedCellIndex) {
            if (newIndex < 0) newIndex = totalCells - 1;
            if (newIndex >= totalCells) newIndex = 0;
            setSelectedCellIndex(newIndex);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [
      gameState,
      selectedCellIndex,
      gridSize,
      currentImages.length,
      userInput,
      handleCardClick,
   ]);

   // Flash card animation: a module class (the old global .image-card.flash scaled the whole cell)
   const flashCard = (idx: number) => {
      const card = boardRef.current?.querySelector(
         `.image-card[data-idx="${idx}"]`
      ) as HTMLElement | null;
      if (card) {
         card.classList.add(ir.flashCue);
         const t = setTimeout(() => {
            flashTimersRef.current.delete(t);
            card.classList.remove(ir.flashCue);
         }, 320);
         flashTimersRef.current.add(t);
      }
   };

   // Show sequence with flashes
   useEffect(() => {
      if (gameState === "memorizing" && sequence.length > 0) {
         const timers = flashTimersRef.current;
         const board = boardRef.current;
         sequence.forEach((idx, i) => {
            const t = setTimeout(() => {
               timers.delete(t);
               flashCard(idx);
            }, 600 + i * 650);
            timers.add(t);
         });
         // new board / replay / unmount: drop every pending flash and its clear
         return () => {
            timers.forEach(clearTimeout);
            timers.clear();
            board
               ?.querySelectorAll(`.${ir.flashCue}`)
               .forEach((el) => el.classList.remove(ir.flashCue));
         };
      }
   }, [gameState, sequence]);

   const progress = ((currentRound + 1) / maxRounds) * 100;
   const hintDisabled =
      (maxHints > 0 && hintsUsed >= maxHints) ||
      gameState !== "input" ||
      hintRevealed.length >= sequence.length;
   const cellFont = isMobile
      ? gridSize <= 3
         ? "36px"
         : gridSize <= 5
         ? "28px"
         : "24px"
      : gridSize <= 3
      ? "42px"
      : gridSize <= 5
      ? "32px"
      : "28px";

   return (
      <div className={`${m.root} ${m.tight}`} style={{ maxWidth: "700px" }}>
         {/* Header with Round and Score */}
         <div className={m.panel}>
            {/* Game Title - Image Recall */}
            <div className={`${ir.title} ${m.landHide}`}>
               <PhotoIcon className={ir.titleIcon} />
               <h2 className={ir.titleText}>Image Recall</h2>
            </div>
            <div className={m.stats}>
               <span className={m.stat}>
                  <ArrowPathIcon className={m.statIcon} />
                  Round <b>{Math.min(currentRound + 1, maxRounds)} / {maxRounds}</b>
               </span>
               <span className={m.stat}>
                  <TrophyIcon className={m.statIcon} />
                  Score <b>{currentScore} / 100</b>
               </span>
               <span className={m.stat}>
                  <LightBulbIcon className={m.statIcon} />
                  Hints{" "}
                  <b>
                     {maxHints === 0 ? "∞" : `${maxHints - hintsUsed}/${maxHints}`}
                  </b>
               </span>
            </div>
            {/* Progress Bar */}
            <div className={m.progress}>
               <div
                  className={m.progressFill}
                  style={{ transform: `scaleX(${Math.min(progress, 100) / 100})` }}
               />
            </div>
         </div>

         {/* Game State Display */}
         <div key={gameState} className={`${m.panel} ${ir.status}`}>
            <div className={ir.statusLine}>
               {gameState === "memorizing" && "Watch the sequence…"}
               {gameState === "input" && "Now click in the same order"}
               {gameState === "correct" && (
                  <>
                     <CheckCircleIcon className={ir.iconOk} />
                     Correct!
                  </>
               )}
               {gameState === "wrong" && (
                  <>
                     <XCircleIcon className={ir.iconBad} />
                     Wrong! Try again
                  </>
               )}
            </div>
            <div className={ir.statusSub}>
               {gameState === "memorizing" &&
                  "After it disappears, click in the same order"}
               {gameState === "input" && "Click the images in order"}
            </div>
         </div>

         {/* Feedback Messages */}
         {feedback !== null && (
            <div
               role="status"
               className={`${m.feedback} ${
                  feedback === "correct" ? m.feedbackOk : m.feedbackBad
               }`}
            >
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon className={m.feedbackIcon} />
                     <span>Correct! Great job!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon className={m.feedbackIcon} />
                     <span>Try again! You can do it!</span>
                  </>
               )}
            </div>
         )}

         {/* Image Grid (dynamic size) */}
         <div
            key={currentRound}
            ref={boardRef}
            className={`${m.board} ${m.stagger}`}
            style={{
               gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
               // square board: fits the screen height, and a cell never grows past 120 px
               maxWidth: `min(100%, calc(100dvh - 170px), ${gridSize * 120}px)`,
            }}
         >
            {currentImages.map((emoji, idx) => {
               const isInSequence = sequence.includes(idx);
               const isSelected = userInput.includes(idx);
               const isHinted = hintRevealed.some(
                  (hintIdx) => sequence[hintIdx] === idx
               );
               const isVisible =
                  gameState === "memorizing" ||
                  isSelected ||
                  isHinted ||
                  (gameState === "wrong" && isInSequence);
               const orderInSequence = sequence.indexOf(idx);
               const orderInInput = userInput.indexOf(idx);
               const isCorrect = isSelected && orderInInput === orderInSequence;
               const isWrong = isSelected && orderInInput !== orderInSequence;
               const stateClass =
                  gameState === "memorizing" && isInSequence
                     ? ir.cue
                     : isCorrect
                     ? `${m.cardMatched} ${m.matched}`
                     : isWrong
                     ? `${m.cardWrong} ${m.wrong}`
                     : isHinted
                     ? m.cardHint
                     : selectedCellIndex === idx
                     ? m.cardSelected
                     : gameState === "wrong" && isInSequence
                     ? ir.cue
                     : "";

               return (
                  <button
                     key={idx}
                     className={`image-card ${m.card} ${stateClass}`}
                     data-idx={idx}
                     onClick={() => handleCardClick(idx)}
                     disabled={gameState !== "input" || isSelected}
                     aria-label={isVisible ? `Image ${idx + 1}: ${emoji}` : `Hidden image ${idx + 1}`}
                     style={{
                        ["--i" as string]: idx,
                        fontSize: cellFont,
                     }}
                  >
                     <span className={isVisible ? m.face : `${m.face} ${m.faceBack}`}>
                        {isVisible ? emoji : "?"}
                     </span>
                     {isSelected && (
                        <span className={ir.order}>{orderInInput + 1}</span>
                     )}
                  </button>
               );
            })}
         </div>

         {/* Action Buttons: Hint, Share */}
         <div className={ir.actions}>
            {/* Share Success Messages */}
            {shareSuccess && (
               <div className={`${m.note} ${m.noteOk} ${ir.wide}`}>
                  <CheckCircleIcon className={m.noteIcon} />
                  <span>
                     {isMobile
                        ? "Link copied! Unlimited hints unlock when someone opens it!"
                        : "Link copied! Unlimited hints will unlock when someone opens your link!"}
                  </span>
               </div>
            )}

            {unlimitedActivated && (
               <div className={`${m.note} ${ir.wide}`}>
                  <CheckCircleIcon className={m.noteIcon} />
                  <span>
                     {isMobile
                        ? "Unlimited hints active for 15 minutes!"
                        : "Someone opened your link! Unlimited hints are now active for 15 minutes!"}
                  </span>
               </div>
            )}

            {/* Hint Button */}
            <button
               onClick={handleHint}
               className={`${m.btn} ${m.pill}`}
               disabled={hintDisabled}
            >
               <LightBulbIcon className={m.pillIcon} />
               <span>
                  Hint{" "}
                  {maxHints === 0 ? "(∞)" : `(${maxHints - hintsUsed} left)`}
               </span>
            </button>

            {/* Share Button */}
            <button onClick={handleShare} className={`${m.btn} ${m.pill}`}>
               <ShareIcon className={m.pillIcon} />
               <span>{isMobile ? "Share" : "Share for Unlimited Hints"}</span>
            </button>
         </div>
      </div>
   );
}

export default ImageRecall;
