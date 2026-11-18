"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import m from "./mobile.module.css";
import st from "./memoryStatus.module.css";
import em from "./EmojiMemory.module.css";
import {
   CheckCircleIcon,
   XCircleIcon,
   LightBulbIcon,
   ShareIcon,
   ArrowPathIcon,
   TrophyIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

function EmojiMemory({
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
   const maxRounds = config.rounds || 20;
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [emojis, setEmojis] = useState<string[]>([]);
   const [selected, setSelected] = useState<number[]>([]);
   const [showing, setShowing] = useState(true);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);

   // Hint functionality (from Card Flip Memory)
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [showHint, setShowHint] = useState(false);
   const [hintPositions, setHintPositions] = useState<number[]>([]);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Round / hint / feedback timers: cleared when the game unmounts (timing unchanged).
   // Score and completion timers stay plain.
   const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
   const later = useCallback((fn: () => void, ms: number) => {
      const t = setTimeout(() => {
         timersRef.current.delete(t);
         fn();
      }, ms);
      timersRef.current.add(t);
   }, []);
   useEffect(() => {
      const timers = timersRef.current;
      return () => {
         timers.forEach(clearTimeout);
         timers.clear();
      };
   }, []);

   // Max hints: 10 for Emoji Memory, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Get grid size based on round (from backend config)
   const getGridSizeForRound = useCallback(
      (round: number): [number, number] => {
         // Rounds 1-5: 4x4, 6-10: 5x5, 11-15: 6x7, 16-20: 8x8
         if (round >= 1 && round <= 5) {
            return [4, 4];
         } else if (round >= 6 && round <= 10) {
            return [5, 5];
         } else if (round >= 11 && round <= 15) {
            return [6, 7];
         } else {
            return [8, 8];
         }
      },
      []
   );

   // Check if mobile device
   useEffect(() => {
      const checkMobile = () => {
         setIsMobile(window.innerWidth < 768);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
   }, []);

   // Emoji list - using diverse emojis
   const emojiList = useMemo(
      () => [
         "🍎",
         "🚗",
         "🐶",
         "⭐",
         "🎵",
         "🏀",
         "📦",
         "🌙",
         "🔥",
         "🎲",
         "📌",
         "🧩",
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
      ],
      []
   );

   // Get grid size from config or calculate from round
   const gridSizeConfig = useMemo(() => {
      if (config.gridSizes && Array.isArray(config.gridSizes)) {
         const roundIndex = Math.min(currentRound, config.gridSizes.length - 1);
         const size = config.gridSizes[roundIndex];
         if (Array.isArray(size)) {
            return [size[0], size[1]];
         }
         return [size, size];
      }
      return getGridSizeForRound(currentRound + 1);
   }, [config.gridSizes, currentRound, getGridSizeForRound]);

   const [gridWidth, gridHeight] = gridSizeConfig;

   const startRound = useCallback(() => {
      const [currentWidth, currentHeight] = gridSizeConfig;
      const currentTotalCells = currentWidth * currentHeight;
      const emojiCount = Math.min(
         Math.floor(currentTotalCells / 2),
         Math.min(4 + currentRound, 8)
      );

      // Select random emojis
      const shuffled = [...emojiList].sort(() => Math.random() - 0.5);
      const selectedEmojis = shuffled.slice(0, emojiCount);

      // Create grid with emojis at random positions
      const grid: string[] = new Array(currentTotalCells).fill("");
      const positions = [...Array(currentTotalCells).keys()]
         .sort(() => Math.random() - 0.5)
         .slice(0, emojiCount);

      positions.forEach((pos, i) => {
         grid[pos] = selectedEmojis[i];
      });

      setEmojis(grid);
      setSelected([]);
      setShowing(true);
      setGameState("memorizing");
      setFeedback(null);
      setShowHint(false);
      setHintPositions([]);

      // Show emojis for 2-4 seconds based on round
      const showTime = 2000 + currentRound * 200;
      later(() => {
         setShowing(false);
         setGameState("input");
      }, showTime);
   }, [currentRound, gridSizeConfig, emojiList, later]);

   // Start first round
   useEffect(() => {
      if (currentRound < maxRounds) {
         startRound();
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

   // Generate shareable link with tracking
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0]; // Remove existing params
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5); // Unique share ID
      return `${currentUrl}?shared=${shareId}`;
   };

   // Register share link in backend (but don't activate hints yet)
   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "emoji-memory");
         // Store share_id to monitor for clicks (but DON'T activate hints yet)
         const gameKey = "play50games_shared_emoji-memory";
         // Only store share_id, don't set hasShared to true yet
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
         // Note: hasShared remains false until someone clicks the link
      } catch (error) {}
   };

   // Share functionality (from Card Flip Memory)
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
            const gameKey = "play50games_shared_emoji-memory";
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
                  const gameKey = "play50games_shared_emoji-memory";
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
                  const gameKey = "play50games_shared_emoji-memory";
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
      const gameKey = "play50games_shared_emoji-memory";
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
      // Use the provided shareId instead of generating a new one
      const currentUrl = window.location.href.split("?")[0]; // Remove existing params
      const shareableLink = `${currentUrl}?shared=${shareId}`;

      try {
         await navigator.clipboard.writeText(shareableLink);
         // Success - show message (hints will activate when someone clicks the link)
         setShareSuccess(true);
         setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
      } catch (error) {
         // Fallback for older browsers
         const textArea = document.createElement("textarea");
         textArea.value = shareableLink;
         textArea.style.position = "fixed";
         textArea.style.opacity = "0";
         document.body.appendChild(textArea);
         textArea.select();
         try {
            document.execCommand("copy");
            // Success - show message (hints will activate when someone clicks the link)
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
         } catch (err) {}
         document.body.removeChild(textArea);
      }
   };

   // Handle share via Web Share API or fallback
   const handleShare = async () => {
      const shareableLink = getShareableLink();
      const shareId = new URL(shareableLink).searchParams.get("shared") || "";

      if (!shareId) return;

      // Register share link in backend (but don't activate hints yet)
      await registerShareLink(shareId);

      // Try Web Share API first (mobile/desktop)
      if (navigator.share) {
         try {
            await navigator.share({
               title: "Emoji Memory Game",
               text: "Check out this awesome Emoji Memory game!",
               url: shareableLink,
            });
            // Success - show message (hints will activate when someone clicks the link)
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
         } catch (error: any) {
            // User cancelled or error - try copy to clipboard
            if (error.name !== "AbortError") {
               handleCopyLink(shareId);
            }
         }
      } else {
         // Fallback: copy to clipboard
         handleCopyLink(shareId);
      }
   };

   // Handle hint button click (from Card Flip Memory)
   const handleHint = () => {
      if (maxHints > 0 && hintsUsed >= maxHints) return; // No hints left
      if (showing || gameState !== "input") return; // Can't hint during memorizing

      // Find emoji positions that haven't been selected yet
      const emojiPositions = emojis
         .map((emoji, idx) => (emoji !== "" ? idx : -1))
         .filter((idx) => idx !== -1 && !selected.includes(idx));

      if (emojiPositions.length > 0) {
         // Show 1-2 random emoji positions as hint
         const hintCount = Math.min(2, emojiPositions.length);
         const shuffled = [...emojiPositions].sort(() => Math.random() - 0.5);
         const hintPos = shuffled.slice(0, hintCount);

         setHintPositions(hintPos);
         setShowHint(true);
         setHintsUsed(hintsUsed + 1);

         // Hide hint after 2 seconds
         later(() => {
            setShowHint(false);
            setHintPositions([]);
         }, 2000);
      }
   };

   const handleCellClick = (index: number) => {
      if (showing || gameState !== "input") return;
      if (selected.includes(index)) return;

      const newSelected = [...selected, index];
      setSelected(newSelected);

      // Check if clicked on an emoji position
      const hasEmoji = emojis[index] !== "";
      const allEmojisFound = emojis
         .map((emoji, idx) => (emoji !== "" ? idx : -1))
         .filter((idx) => idx !== -1)
         .every((idx) => newSelected.includes(idx));

      if (allEmojisFound) {
         // All emojis found - check if correct
         const correctPositions = emojis
            .map((emoji, idx) => (emoji !== "" ? idx : -1))
            .filter((idx) => idx !== -1);

         const isCorrect =
            newSelected.length === correctPositions.length &&
            newSelected.every((idx) => correctPositions.includes(idx));

         if (isCorrect) {
            const roundScore = Math.round(100 / maxRounds);
            const newScore = currentScore + roundScore;
            setCurrentScore(newScore);
            setGameState("correct");
            setFeedback("correct");
            setTimeout(() => {
               onScoreUpdate(newScore);
            }, 0);

            later(() => {
               setFeedback(null);
               setCurrentRound(currentRound + 1);
            }, 1500);
         } else {
            // Wrong answer - show feedback and reset for retry
            setGameState("wrong");
            setFeedback("wrong");

            // After showing feedback, reset selection and allow retry
            later(() => {
               setFeedback(null);
               setSelected([]);
               setGameState("input");
            }, 2000);
         }
      } else if (!hasEmoji) {
         // Clicked on empty cell - wrong, show feedback and reset for retry
         setGameState("wrong");
         setFeedback("wrong");

         // After showing feedback, reset selection and allow retry
         later(() => {
            setFeedback(null);
            setSelected([]);
            setGameState("input");
         }, 2000);
      }
   };

   const hintsOut = maxHints > 0 && hintsUsed >= maxHints;
   const progress = ((currentRound + 1) / maxRounds) * 100;
   // the emoji scale with the cell: never wider than half a cell on a phone
   const emojiSize = `min(${isMobile ? 2 : 2.5}rem, ${(50 / Math.max(1, gridWidth)).toFixed(2)}vw)`;

   return (
      <div className={`${m.root} ${m.tight}`} style={{ maxWidth: "700px" }}>
         {/* Header with Round and Score */}
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
                  Grid <b>{gridWidth}x{gridHeight}</b>
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

         {/* Game State Display */}
         <div
            key={gameState}
            role="status"
            className={`${m.panel} ${st.status} ${
               gameState === "correct"
                  ? m.feedbackOk
                  : gameState === "wrong"
                  ? m.feedbackBad
                  : ""
            }`}
         >
            <div
               className={`${st.statusTitle} ${
                  gameState === "correct"
                     ? st.statusOk
                     : gameState === "wrong"
                     ? st.statusBad
                     : ""
               }`}
            >
               {gameState === "memorizing" && "Memorize the emoji positions..."}
               {gameState === "input" && "Click on the cells where you saw emojis"}
               {gameState === "correct" && (
                  <>
                     <CheckCircleIcon className={st.statusIcon} />
                     Correct!
                  </>
               )}
               {gameState === "wrong" && (
                  <>
                     <XCircleIcon className={st.statusIcon} />
                     Wrong!
                  </>
               )}
            </div>
            <span
               className={`${st.chip} ${
                  gameState === "correct"
                     ? st.chipOk
                     : gameState === "wrong"
                     ? st.chipBad
                     : ""
               }`}
            >
               {gameState === "memorizing" && "Memorizing"}
               {gameState === "input" && "Your Turn"}
               {gameState === "correct" && "Correct"}
               {gameState === "wrong" && "Wrong"}
            </span>
         </div>

         {/* Emoji Grid */}
         <div
            key={currentRound}
            className={m.board}
            style={{
               gridTemplateColumns: `repeat(${gridWidth}, minmax(0, 1fr))`,
               maxWidth: `min(100%, calc((100dvh - 140px) * ${(
                  gridWidth / Math.max(1, gridHeight)
               ).toFixed(3)}), ${gridWidth * 96}px)`,
            }}
         >
            {emojis.map((emoji, i) => {
               const isSelected = selected.includes(i);
               const hasEmoji = emoji !== "";
               const isCorrect = isSelected && hasEmoji;
               const isWrong = isSelected && !hasEmoji;
               const isHinted = showHint && hintPositions.includes(i);
               const visible = showing || isSelected || isHinted;

               const stateClass = isCorrect
                  ? `${m.cardMatched} ${m.matched}`
                  : isWrong
                  ? `${m.cardWrong} ${m.wrong}`
                  : isHinted && hasEmoji
                  ? `${m.cardShown} ${m.cardHint}`
                  : showing && hasEmoji
                  ? m.cardShown
                  : showing
                  ? em.empty
                  : "";

               return (
                  <button
                     key={i}
                     onClick={() => handleCellClick(i)}
                     className={`${m.card} ${stateClass}`}
                     aria-label={visible && hasEmoji ? `Cell with ${emoji}` : "Cell"}
                     disabled={showing || isSelected || gameState !== "input"}
                     style={{
                        ["--i" as string]: i,
                        fontSize: emojiSize,
                        fontWeight: 400,
                     }}
                  >
                     {visible ? (
                        hasEmoji ? (
                           <span className={m.face}>{emoji}</span>
                        ) : null
                     ) : (
                        <span className={`${m.face} ${m.faceBack}`}>?</span>
                     )}
                  </button>
               );
            })}
         </div>

         {/* Action Buttons: Hint, Share */}
         <div className={st.actions}>
            {/* Share Success Messages */}
            {shareSuccess && (
               <div className={`${m.note} ${m.noteOk} ${st.note}`}>
                  <CheckCircleIcon className={m.noteIcon} />
                  <span>
                     {isMobile
                        ? "Link copied! Unlimited hints unlock when someone opens it!"
                        : "Link copied! Unlimited hints will unlock when someone opens your link!"}
                  </span>
               </div>
            )}
            {unlimitedActivated && (
               <div className={`${m.note} ${st.note}`}>
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
               disabled={hintsOut || showing || gameState !== "input"}
            >
               <LightBulbIcon className={m.pillIcon} />
               <span>
                  Hint{" "}
                  {maxHints === 0 ? "(∞)" : `(${maxHints - hintsUsed} left)`}
               </span>
            </button>

            {/* Share Button */}
            <button
               onClick={handleShare}
               className={`${m.btn} ${m.pill} ${m.shareBtn}`}
            >
               <ShareIcon className={m.pillIcon} />
               <span>{isMobile ? "Share" : "Share for Unlimited Hints"}</span>
            </button>
         </div>

         {/* Feedback Message */}
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
      </div>
   );
}

export default EmojiMemory;
