"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRoundsCompletion } from "./useRoundsCompletion";
import m from "./mobile.module.css";
import f from "./FaceMemory.module.css";
import {
   CheckCircleIcon,
   XCircleIcon,
   LightBulbIcon,
   ShareIcon,
   ArrowPathIcon,
   TrophyIcon,
   UserGroupIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

function FaceMemory({
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
   const [facePairs, setFacePairs] = useState<
      Array<{ face: string; name: string }>
   >([]);
   const [selectedFaces, setSelectedFaces] = useState<string[]>([]);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);
   const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(
      null
   );
   const [hintRevealed, setHintRevealed] = useState<number[]>([]);

   // Hint functionality
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
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

   // Round-flow timers (memorize -> input, next round, retry, completion): the same delays as
   // before, but cleared when the game unmounts so a timer never fires into a closed game.
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

   // Max hints: 10 for Face Memory, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Face pool - enough for 6 faces per round
   const FACES = useMemo(
      () => [
         { face: "😀", name: "Alex" },
         { face: "😎", name: "Sam" },
         { face: "🧑‍🦱", name: "Jordan" },
         { face: "👩‍🦰", name: "Emma" },
         { face: "🧔", name: "Chris" },
         { face: "👩‍🦳", name: "Olivia" },
         { face: "👨‍🦲", name: "Michael" },
         { face: "👩‍🦱", name: "Sophia" },
         { face: "👨", name: "David" },
         { face: "👩", name: "Sarah" },
         { face: "🧑", name: "Taylor" },
         { face: "👨‍🦰", name: "Ryan" },
      ],
      []
   );

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
         await registerShare(shareId, "face-memory");
         const gameKey = "play50games_shared_face-memory";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {}
   };

   // Share functionality
   const handleShare = async () => {
      if (navigator.share) {
         try {
            const shareLink = getShareableLink();
            await navigator.share({
               title: "Face Recall - Play50Games",
               text: "Check out this memory game!",
               url: shareLink,
            });
            await registerShareLink(shareLink.split("shared=")[1]);
            setShareSuccess(true);
            shareTimeout(() => setShareSuccess(false), 15000);
         } catch (error) {
            // User cancelled or error
         }
      } else {
         // Fallback to clipboard
         const shareLink = getShareableLink();
         await navigator.clipboard.writeText(shareLink);
         await registerShareLink(shareLink.split("shared=")[1]);
         setShareSuccess(true);
         shareTimeout(() => setShareSuccess(false), 15000);
      }
   };

   // Check share status for unlimited hints
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
            const gameKey = "play50games_shared_face-memory";
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
                  const gameKey = "play50games_shared_face-memory";
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
                  const gameKey = "play50games_shared_face-memory";
                  localStorage.removeItem(gameKey);
                  if (shareCheckIntervalRef.current) {
                     clearInterval(shareCheckIntervalRef.current);
                  }
                  setCurrentShareId(null);
                  setHasShared(false);
                  setUnlimitedActivated(false);
               }
            }
         }, 10000);
      }
      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, unlimitedActivated]);

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_face-memory";
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

   // Start new round
   const startNewRound = useCallback(() => {
      // Calculate number of faces: 3 + Math.floor(round / 2) (min 3, max 6)
      const faceCount = Math.min(3 + Math.floor((currentRound + 1) / 2), 6);

      // Shuffle and take first faceCount faces
      const shuffled = [...FACES].sort(() => Math.random() - 0.5);
      const newPairs = shuffled.slice(0, faceCount);

      setFacePairs(newPairs);
      setSelectedFaces([]);
      setHintRevealed([]);
      setSelectedFaceIndex(null);
      setGameState("memorizing");
      setFeedback(null);

      // Show faces for memorization (duration increases with round)
      const showTime = 1800 + currentRound * 200;
      later(() => {
         setGameState("input");
      }, showTime);
   }, [currentRound, FACES, later]);

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
      if (onScoreUpdate) {
         setTimeout(() => onScoreUpdate(newScore), 0);
      }
   }, [currentRound, maxRounds, onScoreUpdate]);

   // Check game completion: exactly once, 1000 ms after the last round (see useRoundsCompletion)
   useRoundsCompletion(
      currentRound >= maxRounds,
      Math.round((currentRound / maxRounds) * 100),
      onComplete,
      later
   );

   // Handle name selection
   const handleNameSelect = useCallback(
      (name: string, faceIndex: number) => {
         if (gameState !== "input") return;
         if (selectedFaces[faceIndex] === name) return; // Already selected

         const newSelected = [...selectedFaces];
         newSelected[faceIndex] = name;
         setSelectedFaces(newSelected);

         // Check if all faces are matched
         if (
            newSelected.length === facePairs.length &&
            newSelected.every((n) => n)
         ) {
            // All faces matched - check correctness
            const isCorrect = newSelected.every(
               (selectedName, idx) => selectedName === facePairs[idx].name
            );

            if (isCorrect) {
               // Correct!
               setGameState("correct");
               setFeedback("correct");
               later(() => {
                  setCurrentRound((prev) => prev + 1);
               }, 1500);
            } else {
               // Wrong - show feedback and restart the same round
               setGameState("wrong");
               setFeedback("wrong");
               later(() => {
                  // Reset for the same round
                  setSelectedFaces([]);
                  setSelectedFaceIndex(null);
                  setFeedback(null);
                  setHintRevealed([]);
                  // Restart the same round by showing faces again
                  setGameState("memorizing");
                  const showTime = 1800 + currentRound * 200;
                  later(() => {
                     setGameState("input");
                  }, showTime);
               }, 2000);
            }
         }
      },
      [gameState, selectedFaces, facePairs, currentRound, later]
   );

   // Handle hint
   const handleHint = useCallback(() => {
      if (gameState !== "input") return;
      if (maxHints > 0 && hintsUsed >= maxHints) return;

      // Find first unmatched face
      const unmatchedIndex = facePairs.findIndex(
         (_, idx) => !selectedFaces[idx] && !hintRevealed.includes(idx)
      );

      if (unmatchedIndex !== -1) {
         setHintRevealed((prev) => [...prev, unmatchedIndex]);
         setHintsUsed((prev) => prev + 1);
      }
   }, [gameState, maxHints, hintsUsed, facePairs, selectedFaces, hintRevealed]);

   const completedRounds = currentRound;
   const availableNames = facePairs.map((p) => p.name);

   // Shuffle available names for selection (so they're not in the same order as faces)
   // Shuffle only once when round starts, not on every render
   const [shuffledNames, setShuffledNames] = useState<string[]>([]);

   // Update shuffled names when facePairs change (new round starts)
   useEffect(() => {
      if (facePairs.length > 0) {
         const names = facePairs.map((p) => p.name);
         const shuffled = [...names].sort(() => Math.random() - 0.5);
         setShuffledNames(shuffled);
      }
   }, [facePairs]); // Only when facePairs change (new round starts)

   // Keyboard controls
   useEffect(() => {
      if (gameState !== "input") return;

      const handleKeyPress = (e: KeyboardEvent) => {
         // Prevent default for game controls
         if (
            e.key >= "1" &&
            e.key <= "9" &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey
         ) {
            e.preventDefault();
         }
         if (
            (e.key === "ArrowUp" ||
               e.key === "ArrowDown" ||
               e.key === "ArrowLeft" ||
               e.key === "ArrowRight" ||
               e.key === "w" ||
               e.key === "W" ||
               e.key === "s" ||
               e.key === "S" ||
               e.key === "a" ||
               e.key === "A" ||
               e.key === "d" ||
               e.key === "D" ||
               e.key === "Enter" ||
               e.key === " ") &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey
         ) {
            e.preventDefault();
         }

         // Numbers 1-6: Direct selection of face and name
         if (e.key >= "1" && e.key <= "6") {
            const keyNumber = parseInt(e.key);
            const index = keyNumber - 1;

            if (selectedFaceIndex !== null) {
               // If a face is already selected, select name from available names
               const filteredNames = shuffledNames.filter(
                  (name) =>
                     !selectedFaces.includes(name) ||
                     selectedFaces[selectedFaceIndex] === name
               );
               if (filteredNames.length > 0) {
                  // Use the number to select from available names (1-based)
                  const nameIndex = keyNumber - 1;
                  if (nameIndex < filteredNames.length) {
                     handleNameSelect(
                        filteredNames[nameIndex],
                        selectedFaceIndex
                     );
                  }
               }
            } else {
               // No face selected, select the face with this number
               if (index < facePairs.length) {
                  setSelectedFaceIndex(index);
               }
            }
            return;
         }

         // Navigate faces - Up/Left/W/A
         if (
            e.key === "ArrowUp" ||
            e.key === "ArrowLeft" ||
            e.key === "w" ||
            e.key === "W" ||
            e.key === "a" ||
            e.key === "A"
         ) {
            const newIndex =
               selectedFaceIndex !== null
                  ? Math.max(0, selectedFaceIndex - 1)
                  : 0;
            setSelectedFaceIndex(newIndex);
            return;
         }

         // Navigate faces - Down/Right/S/D
         if (
            e.key === "ArrowDown" ||
            e.key === "ArrowRight" ||
            e.key === "s" ||
            e.key === "S" ||
            e.key === "d" ||
            e.key === "D"
         ) {
            const newIndex =
               selectedFaceIndex !== null
                  ? Math.min(facePairs.length - 1, selectedFaceIndex + 1)
                  : 0;
            setSelectedFaceIndex(newIndex);
            return;
         }

         // Enter/Space to cycle through names
         if (e.key === "Enter" || e.key === " ") {
            if (selectedFaceIndex !== null) {
               const filteredNames = shuffledNames.filter(
                  (name) =>
                     !selectedFaces.includes(name) ||
                     selectedFaces[selectedFaceIndex] === name
               );
               if (filteredNames.length > 0) {
                  const currentName = selectedFaces[selectedFaceIndex];
                  const currentIndex = currentName
                     ? filteredNames.indexOf(currentName)
                     : -1;
                  const nextIndex = (currentIndex + 1) % filteredNames.length;
                  handleNameSelect(filteredNames[nextIndex], selectedFaceIndex);
               }
            }
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [
      gameState,
      selectedFaceIndex,
      facePairs,
      selectedFaces,
      handleNameSelect,
      shuffledNames,
   ]);

   const progress = ((currentRound + 1) / maxRounds) * 100;

   const hintsOut = maxHints > 0 && hintsUsed >= maxHints;
   const pickable =
      selectedFaceIndex !== null
         ? shuffledNames.filter(
              (name) =>
                 !selectedFaces.includes(name) ||
                 selectedFaces[selectedFaceIndex] === name
           )
         : [];
   const cols = Math.max(1, Math.min(facePairs.length, isMobile ? 2 : 3));

   return (
      <div className={`${m.root} ${m.tight}`}>
         {/* Header */}
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
                  <UserGroupIcon className={m.statIcon} />
                  Faces <b>{facePairs.length}</b>
               </span>
               <span className={m.stat}>
                  <LightBulbIcon className={m.statIcon} />
                  Hints{" "}
                  <b>{maxHints === 0 ? "∞" : `${maxHints - hintsUsed}/${maxHints}`}</b>
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
         <div className={f.wrap}>
            <p
               key={gameState === "memorizing" ? "memo" : "recall"}
               className={`${f.prompt} ${gameState === "memorizing" ? "" : f.promptRecall}`}
            >
               {gameState === "memorizing"
                  ? "Memorize the faces and their names..."
                  : "Match each face with its correct name"}
            </p>

            {/* Faces Grid */}
            <div
               key={currentRound}
               className={`${f.grid} ${m.stagger}`}
               style={{
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  maxWidth: `${cols * 220}px`,
                  margin: "0 auto",
               }}
            >
               {facePairs.map((pair, index) => {
                  const hinted = hintRevealed.includes(index);
                  const stateClass =
                     gameState === "memorizing"
                        ? f.tileMemo
                        : selectedFaceIndex === index
                        ? f.tileSelected
                        : hinted
                        ? f.tileHint
                        : "";
                  return (
                     <button
                        key={index}
                        type="button"
                        className={`${f.tile} ${gameState === "input" ? f.tileActive : ""} ${stateClass}`}
                        style={{ ["--i" as string]: index }}
                        aria-pressed={selectedFaceIndex === index}
                        aria-label={`Face ${index + 1}`}
                        onClick={() => {
                           if (gameState === "input") {
                              setSelectedFaceIndex(index);
                           }
                        }}
                     >
                        <span className={f.avatar}>
                           {pair.face}
                           {gameState === "input" && (
                              <span className={f.num}>{index + 1}</span>
                           )}
                        </span>
                        {gameState === "memorizing" ? (
                           <span className={f.name}>{pair.name}</span>
                        ) : (
                           <span
                              className={`${f.name} ${
                                 hinted && !selectedFaces[index]
                                    ? f.nameHint
                                    : selectedFaces[index]
                                    ? ""
                                    : f.nameEmpty
                              }`}
                           >
                              {selectedFaces[index] || (hinted ? pair.name : "?")}
                           </span>
                        )}
                     </button>
                  );
               })}
            </div>

            {/* Name Selection (when in input mode) */}
            {gameState === "input" && (
               <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  <p className={f.pickLabel}>
                     {selectedFaceIndex !== null
                        ? `Select name for face ${selectedFaceIndex + 1} (or press 1-${pickable.length}):`
                        : "Press 1-6 to select a face, or tap a face"}
                  </p>
                  <div key={selectedFaceIndex ?? -1} className={f.names}>
                     {selectedFaceIndex !== null &&
                        pickable.map((name, idx) => (
                           <button
                              key={name}
                              type="button"
                              className={`${m.btn} ${f.nameBtn} ${
                                 selectedFaces[selectedFaceIndex] === name ? f.nameBtnOn : ""
                              }`}
                              style={{ ["--i" as string]: idx }}
                              aria-pressed={selectedFaces[selectedFaceIndex] === name}
                              onClick={() => {
                                 handleNameSelect(name, selectedFaceIndex);
                              }}
                           >
                              <span className={f.key}>{idx + 1}</span>
                              {name}
                           </button>
                        ))}
                  </div>
               </div>
            )}
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

         {(shareSuccess || unlimitedActivated) && (
            <div className={f.notes}>
               {shareSuccess && (
                  <div className={`${m.note} ${m.noteOk}`}>
                     <CheckCircleIcon className={m.noteIcon} />
                     <span>
                        {isMobile
                           ? "Link copied! Unlimited hints unlock when someone opens it!"
                           : "Link copied! Unlimited hints will unlock when someone opens your link!"}
                     </span>
                  </div>
               )}
               {unlimitedActivated && (
                  <div className={m.note}>
                     <CheckCircleIcon className={m.noteIcon} />
                     <span>
                        {isMobile
                           ? "Unlimited hints active for 15 minutes!"
                           : "Someone opened your link! Unlimited hints are now active for 15 minutes!"}
                     </span>
                  </div>
               )}
            </div>
         )}

         {/* Hint and Share buttons - Always at the bottom */}
         <div className={f.actions}>
            <button
               type="button"
               onClick={handleHint}
               className={`${m.btn} ${m.pill}`}
               disabled={hintsOut || gameState !== "input"}
            >
               <LightBulbIcon className={m.pillIcon} />
               <span>
                  Hint {maxHints === 0 ? "(∞)" : `(${maxHints - hintsUsed} left)`}
               </span>
            </button>

            <button
               type="button"
               onClick={handleShare}
               className={`${m.btn} ${m.pill}`}
            >
               <ShareIcon className={m.pillIcon} />
               <span>Share for Unlimited Hints</span>
            </button>
         </div>
      </div>
   );
}

export default FaceMemory;
