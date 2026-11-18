"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import m from "./mobile.module.css";
import st from "./memoryStatus.module.css";
import nr from "./NumberRecall.module.css";
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

function NumberRecall({
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
   const [sequence, setSequence] = useState<string>("");
   const [input, setInput] = useState("");
   const [showing, setShowing] = useState(true);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);

   // Hint functionality
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [revealedDigits, setRevealedDigits] = useState<number[]>([]); // Array of revealed digit indices
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Round / feedback timers: cleared when the game unmounts (timing unchanged).
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

   // Max hints: 10 for Number Recall, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Check if mobile device
   useEffect(() => {
      const checkMobile = () => {
         setIsMobile(window.innerWidth < 768);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
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
         await registerShare(shareId, "number-recall");
         const gameKey = "play50games_shared_number-recall";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {}
   };

   // Share functionality
   useEffect(() => {
      if (currentShareId) {
         const gameKey = "play50games_shared_number-recall";
         shareCheckIntervalRef.current = setInterval(async () => {
            try {
               const status = await getShareStatus(currentShareId);
               if (status && status.clicks > 0 && !unlimitedActivated) {
                  setUnlimitedActivated(true);
                  setHasShared(true);
                  if (shareCheckIntervalRef.current) {
                     clearInterval(shareCheckIntervalRef.current);
                  }
                  setTimeout(() => {
                     setUnlimitedActivated(false);
                     setHasShared(false);
                  }, 15 * 60 * 1000); // 15 minutes
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
         }, 10000); // Check every 10 seconds
      }

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, unlimitedActivated]);

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
               title: "Number Recall Game",
               text: "Check out this awesome Number Recall game!",
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
      if (showing || gameState !== "input") return;

      // Reveal next digit in sequence (one at a time)
      if (sequence.length > 0 && revealedDigits.length < sequence.length) {
         const nextIndex = revealedDigits.length;
         setRevealedDigits([...revealedDigits, nextIndex]);
         setHintsUsed(hintsUsed + 1);
      }
   };

   // Start first round
   useEffect(() => {
      if (currentRound < maxRounds) {
         startRound();
      }
   }, [currentRound]);

   // Check game completion
   useEffect(() => {
      if (currentRound >= maxRounds) {
         setTimeout(() => {
            onComplete(currentScore);
         }, 1000);
      }
   }, [currentRound, maxRounds, currentScore, onComplete]);

   const startRound = useCallback(() => {
      // Sequence length increases with round: 3 + round (min 3, max 10)
      const length = Math.min(3 + currentRound, 10);
      const newSequence = Array.from({ length }, () =>
         Math.floor(Math.random() * 10)
      ).join("");

      setSequence(newSequence);
      setInput("");
      setShowing(true);
      setGameState("memorizing");
      setFeedback(null);
      setRevealedDigits([]);

      // Show time: 1200ms + round * 200ms
      const showTime = 1200 + currentRound * 200;
      later(() => {
         setShowing(false);
         setGameState("input");
      }, showTime);
   }, [currentRound, later]);

   const handleSubmit = () => {
      if (showing || gameState !== "input") return;
      if (!input.trim()) return;

      const isCorrect = input === sequence;

      if (isCorrect) {
         // Calculate score based on completed rounds to ensure total is exactly 100
         const completedRounds = currentRound + 1;
         const newScore = Math.round((completedRounds / maxRounds) * 100);
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

         later(() => {
            setFeedback(null);
            setInput("");
            setGameState("input");
         }, 2000);
      }
   };

   const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
         handleSubmit();
      }
   };

   const hintsOut = maxHints > 0 && hintsUsed >= maxHints;
   const progress = ((currentRound + 1) / maxRounds) * 100;
   const digits = sequence.split("");

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
                  Digits <b>{sequence.length}</b>
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
               {gameState === "memorizing" && "Memorize the number..."}
               {gameState === "input" && "Type the sequence you saw"}
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

         {/* Number Display Box */}
         <div className={`${m.panel} ${nr.display}`}>
            <div
               key={currentRound}
               className={`${nr.slots} ${gameState === "wrong" ? m.wrong : ""}`}
               aria-label={showing ? `Number ${sequence}` : "Hidden number"}
               style={{
                  gridTemplateColumns: `repeat(${Math.max(1, digits.length)}, minmax(0, 1fr))`,
                  maxWidth: `${Math.max(1, digits.length) * 60}px`,
               }}
            >
               {digits.map((digit, index) => {
                  const hinted = !showing && revealedDigits.includes(index);
                  return (
                     <span
                        key={index}
                        className={`${nr.slot} ${
                           showing ? nr.slotShown : hinted ? nr.slotHint : ""
                        }`}
                        style={{ ["--i" as string]: index }}
                     >
                        {showing || hinted ? (
                           digit
                        ) : (
                           <span className={nr.slotDot}>•</span>
                        )}
                     </span>
                  );
               })}
            </div>

            {/* Input Section */}
            {!showing && (
               <div className={nr.entry}>
                  <input
                     type="text"
                     inputMode="numeric"
                     autoComplete="off"
                     aria-label="Your answer"
                     className={`${m.input} ${nr.answer}`}
                     value={input}
                     onChange={(e) =>
                        setInput(e.target.value.replace(/\D/g, ""))
                     }
                     onKeyPress={handleKeyPress}
                     maxLength={sequence.length}
                     disabled={gameState !== "input"}
                     placeholder="Type the sequence"
                  />
                  <button
                     onClick={handleSubmit}
                     className={`${m.btn} ${m.primary}`}
                     disabled={gameState !== "input" || !input.trim()}
                  >
                     OK
                  </button>
               </div>
            )}
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

export default NumberRecall;
