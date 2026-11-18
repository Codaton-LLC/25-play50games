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

interface FinalLogicGameProps {
   config: Record<string, any>;
   onComplete: (score: number) => void;
   isPlaying: boolean;
}

export default function FinalLogicGame({
   config,
   onComplete,
   isPlaying,
}: FinalLogicGameProps) {
   const maxRounds = config.rounds || 5;
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<"playing" | "ready" | "failed">(
      "playing"
   );
   const [numbers, setNumbers] = useState<
      Array<{ value: number; color: string }>
   >([]);
   const [rule, setRule] = useState<"ascending" | "descending">("ascending");
   const [selectedOrder, setSelectedOrder] = useState<number[]>([]);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited


   // Color mapping
   const colors = ["🔴", "🔵", "🟢", "🟡"];
   const colorNames = ["Red", "Blue", "Green", "Yellow"];

   // Generate new round
   const generateRound = useCallback(() => {
      // Generate 4 random numbers between 1 and 20
      const nums = Array.from({ length: 4 }, () => ({
         value: Math.floor(Math.random() * 20) + 1,
         color: colors[Math.floor(Math.random() * colors.length)],
      }));

      // Ensure all numbers are different
      const uniqueNums = [];
      const usedValues = new Set<number>();
      for (const num of nums) {
         if (!usedValues.has(num.value)) {
            uniqueNums.push(num);
            usedValues.add(num.value);
         } else {
            let newValue = Math.floor(Math.random() * 20) + 1;
            while (usedValues.has(newValue)) {
               newValue = Math.floor(Math.random() * 20) + 1;
            }
            uniqueNums.push({ value: newValue, color: num.color });
            usedValues.add(newValue);
         }
      }

      setNumbers(uniqueNums);
      setSelectedOrder([]);
      setFeedback(null);

      // Random rule
      setRule(Math.random() > 0.5 ? "ascending" : "descending");
      setGameState("playing");
   }, []);

   // Initialize first round
   useEffect(() => {
      if (isPlaying && currentRound < maxRounds) {
         generateRound();
      }
   }, [isPlaying, currentRound, maxRounds, generateRound]);

   // Handle number click
   const handleNumberClick = (index: number) => {
      if (gameState !== "playing" || selectedOrder.includes(index)) return;

      const newOrder = [...selectedOrder, index];
      setSelectedOrder(newOrder);

      // Check if all numbers are selected
      if (newOrder.length === 4) {
         checkAnswer(newOrder);
      }
   };

   // Check answer
   const checkAnswer = (order: number[]) => {
      const selectedValues = order.map((idx) => numbers[idx].value);
      const isCorrect =
         rule === "ascending"
            ? selectedValues.every(
                 (val, i) => i === 0 || val >= selectedValues[i - 1]
              )
            : selectedValues.every(
                 (val, i) => i === 0 || val <= selectedValues[i - 1]
              );

      if (isCorrect) {
         setFeedback("correct");
         const roundScore = Math.round(100 / maxRounds);
         const newScore = Math.min(100, currentScore + roundScore);
         setCurrentScore(newScore);

         setTimeout(() => {
            if (currentRound + 1 >= maxRounds) {
               setGameState("ready");
               setTimeout(() => onComplete(100), 1000);
            } else {
               setCurrentRound((prev) => prev + 1);
            }
         }, 1500);
      } else {
         setFeedback("wrong");
         setTimeout(() => {
            setSelectedOrder([]);
            setFeedback(null);
         }, 1500);
      }
   };

   // Get correct order for display
   const getCorrectOrder = () => {
      const sorted = [...numbers].sort((a, b) =>
         rule === "ascending" ? a.value - b.value : b.value - a.value
      );
      return sorted;
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
         await registerShare(shareId, "final-logic-game");
         const gameKey = "play50games_shared_final-logic-game";
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
               title: "Final Logic Game",
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
         const gameKey = "play50games_shared_final-logic-game";
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
      const gameKey = "play50games_shared_final-logic-game";
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
      setSelectedOrder([]);
      setFeedback(null);
      setReplaysUsed((prev) => prev + 1);

      // Force re-initialize by calling generateRound
      setTimeout(() => {
         generateRound();
         setGameState("playing");
      }, 0);
   }, [maxReplays, replaysUsed, generateRound]);

   const progress =
      maxRounds > 0 ? Math.round(((currentRound + 1) / maxRounds) * 100) : 0;

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
         {gameState === "playing" && (
            <div className={`${c.panel} ${c.area}`}>
               {/* Rule Display */}
               <div className={c.rule}>
                  Click numbers in{" "}
                  <span className={c.ruleKey}>
                     {rule === "ascending" ? "ascending" : "descending"}
                  </span>{" "}
                  order
               </div>

               {/* Numbers Grid */}
               <div key={currentRound} className={c.tiles2}>
                  {numbers.map((num, index) => {
                     const isSelected = selectedOrder.includes(index);
                     const selectedIndex = selectedOrder.indexOf(index);
                     return (
                        <button
                           key={index}
                           type="button"
                           onClick={() => handleNumberClick(index)}
                           className={`${c.tile} ${c.numTile} ${
                              isSelected ? c.tilePicked : ""
                           }`}
                           disabled={isSelected || gameState !== "playing"}
                           aria-pressed={isSelected}
                        >
                           {isSelected && (
                              <span className={c.order}>{selectedIndex + 1}</span>
                           )}
                           <span className={c.tileEmoji}>{num.color}</span>
                           <span>{num.value}</span>
                        </button>
                     );
                  })}
               </div>

               {/* Feedback */}
               {feedback && (
                  <Feedback ok={feedback === "correct"}>
                     {feedback === "correct"
                        ? "Correct! Great job!"
                        : "Try again! You can do it!"}
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
         {(gameState === "playing" ||
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
