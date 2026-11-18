"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
   MiniHead,
   Feedback,
   DoneSheet,
   ReplayShareBar,
   chrome as c,
} from "../FinalChrome";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";
import { useCompleteOnce } from "../useCompleteOnce";

interface FinalMemoryGameProps {
   config: Record<string, any>;
   onComplete: (score: number) => void;
   isPlaying: boolean;
}

export default function FinalMemoryGame({
   config,
   onComplete,
   isPlaying,
}: FinalMemoryGameProps) {
   const maxRounds = config.rounds || 5;
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "ready" | "failed"
   >("memorizing");
   const [sequence, setSequence] = useState<string[]>([]);
   const [userInput, setUserInput] = useState("");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [currentLetterIndex, setCurrentLetterIndex] = useState(0);
   const inputRef = useRef<HTMLInputElement>(null);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited
   const { completeLater, rearm } = useCompleteOnce();


   // Letters pool
   const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

   // Generate sequence based on round
   const generateSequence = useCallback(() => {
      const length = 4 + currentRound; // 4, 5, 6, 7, 8
      const seq: string[] = [];
      for (let i = 0; i < length; i++) {
         seq.push(letters[Math.floor(Math.random() * letters.length)]);
      }
      return seq;
   }, [currentRound]);

   // Initialize round
   useEffect(() => {
      if (isPlaying && currentRound < maxRounds) {
         const seq = generateSequence();
         setSequence(seq);
         setUserInput("");
         setFeedback(null);
         setCurrentLetterIndex(0);
         setGameState("memorizing");
      }
   }, [isPlaying, currentRound, maxRounds, generateSequence]);

   // Flash sequence
   useEffect(() => {
      if (gameState !== "memorizing" || !sequence.length) return;

      const flashInterval = setInterval(() => {
         setCurrentLetterIndex((prev) => {
            if (prev >= sequence.length - 1) {
               clearInterval(flashInterval);
               setTimeout(() => {
                  setGameState("input");
                  setCurrentLetterIndex(0);
                  // Focus input when entering input state
                  setTimeout(() => {
                     inputRef.current?.focus();
                  }, 100);
               }, 500);
               return prev;
            }
            return prev + 1;
         });
      }, 1000); // Increased from 500ms to 1000ms (1 second) so letters are more visible

      return () => clearInterval(flashInterval);
   }, [gameState, sequence]);

   // Handle input
   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (gameState !== "input") return;
      const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
      setUserInput(value);
   };

   // Check answer
   const handleSubmit = () => {
      if (gameState !== "input" || !userInput) return;

      const isCorrect = userInput === sequence.join("");
      setFeedback(isCorrect ? "correct" : "wrong");

      if (isCorrect) {
         const roundScore = Math.round(100 / maxRounds);
         const newScore = Math.min(100, currentScore + roundScore);
         setCurrentScore(newScore);

         setTimeout(() => {
            if (currentRound + 1 >= maxRounds) {
               setGameState("ready");
               completeLater(() => onComplete(100), 1000);
            } else {
               setCurrentRound((prev) => prev + 1);
            }
         }, 1500);
      } else {
         setTimeout(() => {
            setUserInput("");
            setFeedback(null);
         }, 1500);
      }
   };

   // Handle Enter key
   const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && gameState === "input") {
         handleSubmit();
      }
   };

   // Share functionality
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   };

   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "final-memory-game");
         const gameKey = "play50games_shared_final-memory-game";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {
         // Error registering share
      }
   };

   const handleShare = async () => {
      const shareableLink = getShareableLink();
      const shareId = new URL(shareableLink).searchParams.get("shared") || "";

      if (!shareId) return;

      await registerShareLink(shareId);

      if (navigator.share) {
         try {
            await navigator.share({
               title: "Final Memory Game",
               text: "Check out this awesome game!",
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
         } catch (err) {
            // Failed to copy
         }
         document.body.removeChild(textArea);
      }
   };

   // Check share status
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         const gameKey = "play50games_shared_final-memory-game";
         try {
            const status = await getShareStatus(currentShareId);
            const hasClicks = status.has_clicks || status.clicks > 0;
            if (hasClicks && !hasShared) {
               setHasShared(true);
               setUnlimitedActivated(true);
               setReplaysUsed(0);

               const expiry = Date.now() + 15 * 60 * 1000;
               localStorage.setItem(
                  gameKey,
                  JSON.stringify({
                     share_id: currentShareId,
                     shared: true,
                     expiry: expiry,
                  })
               );

               setTimeout(() => {
                  setUnlimitedActivated(false);
                  setHasShared(false);
                  localStorage.removeItem(gameKey);
               }, 15 * 60 * 1000);

               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
            }
         } catch (error) {
            const errorMessage =
               error instanceof Error ? error.message : String(error);
            if (
               errorMessage.includes("404") ||
               errorMessage.includes("not found") ||
               errorMessage.includes("expired")
            ) {
               setUnlimitedActivated(false);
               setHasShared(false);
               localStorage.removeItem(gameKey);
               setCurrentShareId(null);
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
            }
         }
      };

      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000);

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
            shareCheckIntervalRef.current = null;
         }
      };
   }, [currentShareId, hasShared]);

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_final-memory-game";
      const stored = localStorage.getItem(gameKey);
      if (stored) {
         try {
            const data = JSON.parse(stored);
            if (data.expiry && Date.now() > data.expiry) {
               localStorage.removeItem(gameKey);
               return;
            }
            if (data.share_id) {
               setCurrentShareId(data.share_id);
               const verifyShare = async () => {
                  try {
                     const status = await getShareStatus(data.share_id);
                     const hasClicks = status.has_clicks || status.clicks > 0;
                     if (hasClicks) {
                        if (
                           data.shared &&
                           data.expiry &&
                           Date.now() < data.expiry
                        ) {
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           setReplaysUsed(0);
                           const remainingTime = data.expiry - Date.now();
                           if (remainingTime > 0) {
                              setTimeout(() => {
                                 setUnlimitedActivated(false);
                                 setHasShared(false);
                                 localStorage.removeItem(gameKey);
                              }, remainingTime);
                           }
                        } else {
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           setReplaysUsed(0);
                           const expiryTime = Date.now() + 15 * 60 * 1000;
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
                     }
                  } catch (error) {
                     localStorage.removeItem(gameKey);
                     setCurrentShareId(null);
                  }
               };
               verifyShare();
            }
         } catch (error) {
            localStorage.removeItem(gameKey);
         }
      }

      const urlParams = new URLSearchParams(window.location.search);
      const sharedBy = urlParams.get("shared");
      if (sharedBy) {
         trackShareClick(sharedBy);
         const stored = localStorage.getItem(gameKey);
         if (stored) {
            try {
               const data = JSON.parse(stored);
               if (data.share_id === sharedBy) {
                  setCurrentShareId(sharedBy);
               }
            } catch (error) {
               // Error parsing
            }
         }
      }
   }, []);

   // Handle replay
   const handleReplay = useCallback(() => {
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setCurrentRound(0);
      setCurrentScore(0);
      setUserInput("");
      setFeedback(null);
      setCurrentLetterIndex(0);
      setReplaysUsed((prev) => prev + 1);
      rearm();

      // Force re-initialize by setting sequence first, then gameState
      // This ensures useEffect triggers properly
      setTimeout(() => {
         const seq = generateSequence();
         setSequence(seq);
         setGameState("memorizing");
      }, 0);
   }, [maxReplays, replaysUsed, generateSequence, rearm]);

   const progress =
      maxRounds > 0 ? Math.round(((currentRound + 1) / maxRounds) * 100) : 0;

   const canSubmit = !!userInput && userInput.length === sequence.length;

   return (
      <div className={c.mini}>
         {/* Header */}
         <MiniHead
            current={currentRound + 1}
            total={maxRounds}
            score={currentScore}
            progress={progress}
         />

         {/* Game Area */}
         {gameState === "memorizing" && (
            <div className={`${c.panel} ${c.area}`}>
               <p className={c.hint}>Memorize the sequence:</p>
               <div className={c.letterStage}>
                  {/* keyed by position: every letter (a repeated one too) shows as a new flash */}
                  <div key={currentLetterIndex} className={c.letter}>
                     {sequence[currentLetterIndex] || ""}
                  </div>
                  {sequence.length > 0 && (
                     <span className={c.letterCount}>
                        {Math.min(currentLetterIndex + 1, sequence.length)} /{" "}
                        {sequence.length}
                     </span>
                  )}
               </div>
            </div>
         )}

         {gameState === "input" && (
            <div className={`${c.panel} ${c.area}`}>
               <div className={c.rule}>Type the sequence you saw:</div>
               <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  onClick={(e) => {
                     e.currentTarget.focus();
                  }}
                  onFocus={(e) => {
                     e.currentTarget.select();
                  }}
                  onBlur={() => {
                     if (gameState === "input") {
                        setTimeout(() => inputRef.current?.focus(), 0);
                     }
                  }}
                  placeholder="Enter sequence..."
                  aria-label="Sequence"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className={c.input}
               />
               <button
                  type="button"
                  onClick={handleSubmit}
                  className={c.primary}
                  disabled={!canSubmit}
               >
                  Submit
               </button>

               {/* Feedback */}
               {feedback && (
                  <Feedback ok={feedback === "correct"}>
                     {feedback === "correct" ? (
                        "Correct! Great job!"
                     ) : (
                        <>Try again! The sequence was: {sequence.join("")}</>
                     )}
                  </Feedback>
               )}
            </div>
         )}

         {/* Game Complete */}
         {gameState === "ready" && (
            <DoneSheet
               badge="Game Complete!"
               text={<>All {maxRounds} rounds completed!</>}
            />
         )}

         {/* Replay and Share Buttons */}
         {(gameState === "input" ||
            gameState === "ready" ||
            feedback === "wrong") && (
            <ReplayShareBar
               shareSuccess={shareSuccess}
               unlimitedActivated={unlimitedActivated}
               maxReplays={maxReplays}
               replaysUsed={replaysUsed}
               onReplay={handleReplay}
               onShare={handleShare}
            />
         )}
      </div>
   );
}
