"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   LightBulbIcon,
   ShareIcon,
   ArrowPathIcon,
   TrophyIcon,
   PuzzlePieceIcon,
   SparklesIcon,
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
                title: "Face Memory - Play50Games",
                text: "Check out this memory game!",
                url: shareLink,
             });
             await registerShareLink(shareLink.split("shared=")[1]);
             setShareSuccess(true);
             setTimeout(() => setShareSuccess(false), 15000);
          } catch (error) {
             // User cancelled or error
          }
       } else {
          // Fallback to clipboard
          const shareLink = getShareableLink();
          await navigator.clipboard.writeText(shareLink);
          await registerShareLink(shareLink.split("shared=")[1]);
          setShareSuccess(true);
          setTimeout(() => setShareSuccess(false), 15000);
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
       setTimeout(() => {
          setGameState("input");
       }, showTime);
    }, [currentRound, FACES]);
 
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
 
    // Check game completion
    useEffect(() => {
       if (currentRound >= maxRounds) {
          setTimeout(() => {
             onComplete(currentScore);
          }, 1000);
       }
    }, [currentRound, maxRounds, currentScore, onComplete]);
 
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
                setTimeout(() => {
                   setCurrentRound((prev) => prev + 1);
                }, 1500);
             } else {
                // Wrong - show feedback and restart the same round
                setGameState("wrong");
                setFeedback("wrong");
                setTimeout(() => {
                   // Reset for the same round
                   setSelectedFaces([]);
                   setSelectedFaceIndex(null);
                   setFeedback(null);
                   setHintRevealed([]);
                   // Restart the same round by showing faces again
                   setGameState("memorizing");
                   const showTime = 1800 + currentRound * 200;
                   setTimeout(() => {
                      setGameState("input");
                   }, showTime);
                }, 2000);
             }
          }
       },
       [gameState, selectedFaces, facePairs, currentRound]
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
 
    return (
       <div
          style={{
             display: "flex",
             flexDirection: "column",
             gap: isMobile ? "16px" : "20px",
             padding: isMobile ? "16px" : "24px",
             maxWidth: "100%",
             margin: "0 auto",
          }}
       >
          {/* Header - Same as Rotate to Fit */}
          <div
             style={{
                display: "flex",
                flexDirection: "column",
                gap: isMobile ? "12px" : "16px",
                paddingBottom: isMobile ? "12px" : "16px",
                borderBottom: "1px solid var(--stroke)",
             }}
          >
             <div
                style={{
                   display: "flex",
                   alignItems: "center",
                   justifyContent: "center",
                   gap: isMobile ? "8px" : "12px",
                   paddingBottom: isMobile ? "12px" : "16px",
                   marginBottom: isMobile ? "12px" : "16px",
                   borderBottom: "1px solid var(--stroke)",
                }}
             >
                <PuzzlePieceIcon
                   style={{
                      width: isMobile ? 24 : 28,
                      height: isMobile ? 24 : 28,
                      color: "var(--accent)",
                   }}
                />
                <h2
                   style={{
                      fontSize: isMobile ? "1.25rem" : "1.5rem",
                      fontWeight: 700,
                      margin: 0,
                      background:
                         "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      textShadow: "0 2px 8px rgba(125, 211, 252, 0.3)",
                   }}
                >
                   Face Memory
                </h2>
                <SparklesIcon
                   style={{
                      width: isMobile ? 24 : 28,
                      height: isMobile ? 24 : 28,
                      color: "var(--ok)",
                   }}
                />
             </div>
             <div
                style={{
                   display: "flex",
                   justifyContent: "space-between",
                   alignItems: "center",
                   flexWrap: "wrap",
                   gap: isMobile ? "8px" : "12px",
                }}
             >
                <div
                   style={{
                      display: "flex",
                      alignItems: "center",
                      gap: isMobile ? "6px" : "8px",
                      fontSize: isMobile ? "0.875rem" : "1rem",
                      color: "var(--text)",
                   }}
                >
                   <ArrowPathIcon
                      style={{
                         width: isMobile ? 16 : 18,
                         height: isMobile ? 16 : 18,
                         color: "var(--accent)",
                      }}
                   />
                   <span>
                      Round {currentRound + 1} / {maxRounds}
                   </span>
                </div>
                <div
                   style={{
                      display: "flex",
                      alignItems: "center",
                      gap: isMobile ? "6px" : "8px",
                      fontSize: isMobile ? "0.875rem" : "1rem",
                      color: "var(--text)",
                   }}
                >
                   <TrophyIcon
                      style={{
                         width: isMobile ? 16 : 18,
                         height: isMobile ? 16 : 18,
                         color: "var(--ok)",
                      }}
                   />
                   <span>Score: {currentScore} / 100</span>
                </div>
                <div
                   style={{
                      display: "flex",
                      alignItems: "center",
                      gap: isMobile ? "6px" : "8px",
                      fontSize: isMobile ? "0.875rem" : "1rem",
                      color: "var(--text)",
                   }}
                >
                   <SparklesIcon
                      style={{
                         width: isMobile ? 16 : 18,
                         height: isMobile ? 16 : 18,
                         color: "var(--accent)",
                      }}
                   />
                   <span>Faces: {facePairs.length}</span>
                </div>
             </div>
             {/* Progress Bar */}
             <div
                style={{
                   width: "100%",
                   height: isMobile ? "6px" : "8px",
                   background: "var(--stroke)",
                   borderRadius: "4px",
                   overflow: "hidden",
                   marginTop: isMobile ? "4px" : "8px",
                }}
             >
                <div
                   style={{
                      width: `${progress}%`,
                      height: "100%",
                      background:
                         "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                      borderRadius: "4px",
                      transition: "width 0.3s",
                      boxShadow: "rgba(125, 211, 252, 0.5) 0px 0px 10px",
                   }}
                />
             </div>
          </div>
 
          {/* Game Board */}
          <div
             style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: isMobile ? "20px" : "24px",
             }}
          >
             {gameState === "memorizing" ? (
                <div
                   style={{
                      textAlign: "center",
                      padding: isMobile ? "16px" : "20px",
                      background:
                         "linear-gradient(135deg, rgba(110, 168, 255, 0.1), rgba(110, 168, 255, 0.05))",
                      border: "2px solid rgba(110, 168, 255, 0.3)",
                      borderRadius: "16px",
                   }}
                >
                   <p
                      style={{
                         margin: 0,
                         fontSize: isMobile ? "1rem" : "1.1rem",
                         fontWeight: 600,
                         color: "var(--text)",
                      }}
                   >
                      Memorize the faces and their names...
                   </p>
                </div>
             ) : (
                <div
                   style={{
                      textAlign: "center",
                      padding: isMobile ? "16px" : "20px",
                      background:
                         "linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.05))",
                      border: "2px solid rgba(251, 191, 36, 0.3)",
                      borderRadius: "16px",
                   }}
                >
                   <p
                      style={{
                         margin: 0,
                         fontSize: isMobile ? "1rem" : "1.1rem",
                         fontWeight: 600,
                         color: "var(--text)",
                      }}
                   >
                      Match each face with its correct name
                   </p>
                </div>
             )}
 
             {/* Faces Grid */}
             <div
                style={{
                   display: "grid",
                   gridTemplateColumns: `repeat(${Math.min(
                      facePairs.length,
                      isMobile ? 2 : 3
                   )}, 1fr)`,
                   gap: isMobile ? "16px" : "20px",
                   width: "100%",
                }}
             >
                {facePairs.map((pair, index) => (
                   <div
                      key={index}
                      style={{
                         display: "flex",
                         flexDirection: "column",
                         alignItems: "center",
                         gap: "12px",
                         padding: isMobile ? "16px" : "20px",
                         borderRadius: "16px",
                         border: "2px solid",
                         borderColor:
                            gameState === "memorizing"
                               ? "rgba(110, 168, 255, 0.3)"
                               : selectedFaceIndex === index
                               ? "rgba(59, 130, 246, 0.8)"
                               : hintRevealed.includes(index)
                               ? "rgba(251, 191, 36, 0.6)"
                               : "rgba(255, 255, 255, 0.1)",
                         background:
                            gameState === "memorizing"
                               ? "linear-gradient(135deg, rgba(110, 168, 255, 0.1), rgba(110, 168, 255, 0.05))"
                               : selectedFaceIndex === index
                               ? "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))"
                               : hintRevealed.includes(index)
                               ? "linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(251, 191, 36, 0.05))"
                               : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                         boxShadow:
                            selectedFaceIndex === index
                               ? "0 4px 12px rgba(59, 130, 246, 0.3)"
                               : "0 2px 8px rgba(0, 0, 0, 0.1)",
                         transition: "all 0.2s",
                         cursor: gameState === "input" ? "pointer" : "default",
                      }}
                      onClick={() => {
                         if (gameState === "input") {
                            setSelectedFaceIndex(index);
                         }
                      }}
                   >
                      <div
                         style={{
                            position: "relative",
                            width: isMobile ? "64px" : "80px",
                            height: isMobile ? "64px" : "80px",
                         }}
                      >
                         <div
                            style={{
                               width: "100%",
                               height: "100%",
                               borderRadius: "50%",
                               display: "flex",
                               alignItems: "center",
                               justifyContent: "center",
                               fontSize: isMobile ? "32px" : "40px",
                               background:
                                  "linear-gradient(135deg, rgba(15, 27, 51, 0.6), rgba(15, 27, 51, 0.4))",
                               border: "2px solid rgba(255, 255, 255, 0.1)",
                            }}
                         >
                            {pair.face}
                         </div>
                         {gameState === "input" && (
                            <div
                               style={{
                                  position: "absolute",
                                  top: "-8px",
                                  right: "-8px",
                                  width: isMobile ? "20px" : "24px",
                                  height: isMobile ? "20px" : "24px",
                                  borderRadius: "50%",
                                  background:
                                     "linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))",
                                  border: "2px solid rgba(255, 255, 255, 0.3)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: isMobile ? "0.7rem" : "0.75rem",
                                  fontWeight: 700,
                                  color: "white",
                                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
                               }}
                            >
                               {index + 1}
                            </div>
                         )}
                      </div>
                      {gameState === "memorizing" ? (
                         <div
                            style={{
                               fontSize: isMobile ? "0.9rem" : "1rem",
                               fontWeight: 700,
                               color: "var(--text)",
                            }}
                         >
                            {pair.name}
                         </div>
                      ) : (
                         <div
                            style={{
                               fontSize: isMobile ? "0.85rem" : "0.9rem",
                               fontWeight: 600,
                               color: hintRevealed.includes(index)
                                  ? "rgba(251, 191, 36, 0.9)"
                                  : selectedFaces[index]
                                  ? "var(--text)"
                                  : "var(--muted)",
                            }}
                         >
                            {selectedFaces[index] ||
                               (hintRevealed.includes(index) ? pair.name : "?")}
                         </div>
                      )}
                   </div>
                ))}
             </div>
 
             {/* Name Selection (when in input mode) */}
             {gameState === "input" && (
                <div
                   style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      width: "100%",
                   }}
                >
                   <p
                      style={{
                         margin: 0,
                         fontSize: isMobile ? "0.9rem" : "1rem",
                         fontWeight: 600,
                         color: "var(--text)",
                         textAlign: "center",
                      }}
                   >
                      {selectedFaceIndex !== null
                         ? `Select name for face ${
                              (selectedFaceIndex ?? 0) + 1
                           } (or press 1-${
                              shuffledNames.filter(
                                 (name) =>
                                    !selectedFaces.includes(name) ||
                                    selectedFaces[selectedFaceIndex] === name
                              ).length
                           }):`
                         : "Press 1-6 to select a face, or click a face"}
                   </p>
                   <div
                      style={{
                         display: "flex",
                         flexWrap: "wrap",
                         gap: "10px",
                         justifyContent: "center",
                      }}
                   >
                      {selectedFaceIndex !== null &&
                         shuffledNames
                            .filter(
                               (name) =>
                                  !selectedFaces.includes(name) ||
                                  selectedFaces[selectedFaceIndex] === name
                            )
                            .map((name, idx) => (
                               <button
                                  key={idx}
                                  onClick={() => {
                                     handleNameSelect(name, selectedFaceIndex);
                                  }}
                                  style={{
                                     position: "relative",
                                     padding: isMobile
                                        ? "10px 16px"
                                        : "12px 20px",
                                     paddingLeft: isMobile ? "36px" : "40px",
                                     borderRadius: "12px",
                                     border: "2px solid",
                                     borderColor:
                                        selectedFaces[selectedFaceIndex] === name
                                           ? "rgba(59, 130, 246, 0.8)"
                                           : "rgba(255, 255, 255, 0.2)",
                                     background:
                                        selectedFaces[selectedFaceIndex] === name
                                           ? "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))"
                                           : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                                     color: "var(--text)",
                                     cursor: "pointer",
                                     fontSize: isMobile ? "0.9rem" : "1rem",
                                     fontWeight: 600,
                                     transition: "all 0.2s",
                                  }}
                                  onMouseEnter={(e) => {
                                     if (
                                        selectedFaces[selectedFaceIndex] !== name
                                     ) {
                                        e.currentTarget.style.borderColor =
                                           "rgba(59, 130, 246, 0.6)";
                                        e.currentTarget.style.background =
                                           "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))";
                                     }
                                  }}
                                  onMouseLeave={(e) => {
                                     if (
                                        selectedFaces[selectedFaceIndex] !== name
                                     ) {
                                        e.currentTarget.style.borderColor =
                                           "rgba(255, 255, 255, 0.2)";
                                        e.currentTarget.style.background =
                                           "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))";
                                     }
                                  }}
                               >
                                  <div
                                     style={{
                                        position: "absolute",
                                        left: isMobile ? "8px" : "10px",
                                        top: "50%",
                                        transform: "translateY(-50%)",
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
                                        fontSize: isMobile
                                           ? "0.65rem"
                                           : "0.7rem",
                                        fontWeight: 700,
                                        color: "white",
                                        boxShadow:
                                           "0 2px 4px rgba(0, 0, 0, 0.2)",
                                     }}
                                  >
                                     {idx + 1}
                                  </div>
                                  {name}
                               </button>
                            ))}
                   </div>
                </div>
             )}
          </div>
 
          {/* Feedback Messages - Same as Match the Shapes */}
          {feedback !== null && (
             <div
                style={{
                   padding: isMobile ? "12px 20px" : "16px 24px",
                   borderRadius: isMobile ? "12px" : "12px",
                   fontSize: isMobile ? "1rem" : "1.1rem",
                   fontWeight: 600,
                   animation: "slideIn 0.3s ease-out",
                   background:
                      feedback === "correct"
                         ? "rgba(134, 239, 172, 0.2)"
                         : "rgba(252, 165, 165, 0.2)",
                   border: `1px solid ${
                      feedback === "correct" ? "var(--ok)" : "var(--warn)"
                   }`,
                   color: feedback === "correct" ? "var(--ok)" : "var(--warn)",
                   display: "flex",
                   alignItems: "center",
                   gap: isMobile ? "8px" : "10px",
                   width: "100%",
                   maxWidth: isMobile ? "100%" : "600px",
                   justifyContent: "center",
                   margin: "0 auto",
                }}
             >
                {feedback === "correct" ? (
                   <>
                      <CheckCircleIcon
                         style={{
                            width: isMobile ? 20 : 24,
                            height: isMobile ? 20 : 24,
                         }}
                      />
                      <span>Correct! Great job!</span>
                   </>
                ) : (
                   <>
                      <XCircleIcon
                         style={{
                            width: isMobile ? 20 : 24,
                            height: isMobile ? 20 : 24,
                         }}
                      />
                      <span>Try again! You can do it!</span>
                   </>
                )}
             </div>
          )}
 
          {/* Share Success Message */}
          {shareSuccess && (
             <div
                style={{
                   display: "flex",
                   alignItems: "center",
                   gap: isMobile ? "8px" : "10px",
                   padding: isMobile ? "12px 16px" : "14px 20px",
                   background:
                      "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))",
                   border: "2px solid rgba(34, 197, 94, 0.6)",
                   borderRadius: "12px",
                   width: "100%",
                   justifyContent: "center",
                   animation: "slideIn 0.3s ease",
                }}
             >
                <CheckCircleIcon
                   style={{
                      width: isMobile ? 18 : 20,
                      height: isMobile ? 18 : 20,
                      color: "rgba(34, 197, 94, 0.9)",
                      flexShrink: 0,
                   }}
                />
                <span
                   style={{
                      fontSize: isMobile ? "0.9rem" : "1rem",
                      fontWeight: 500,
                      color: "var(--text)",
                   }}
                >
                   {isMobile
                      ? "Link copied! Unlimited hints unlock when someone opens it!"
                      : "Link copied! Unlimited hints will unlock when someone opens your link!"}
                </span>
             </div>
          )}
 
          {/* Unlimited Hints Activated */}
          {unlimitedActivated && (
             <div
                style={{
                   display: "flex",
                   alignItems: "center",
                   gap: isMobile ? "8px" : "10px",
                   padding: isMobile ? "12px 16px" : "14px 20px",
                   background:
                      "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                   border: "2px solid rgba(59, 130, 246, 0.6)",
                   borderRadius: "12px",
                   width: "100%",
                   justifyContent: "center",
                   animation: "slideIn 0.3s ease",
                }}
             >
                <CheckCircleIcon
                   style={{
                      width: isMobile ? 18 : 20,
                      height: isMobile ? 18 : 20,
                      color: "rgba(59, 130, 246, 0.9)",
                      flexShrink: 0,
                   }}
                />
                <span
                   style={{
                      fontSize: isMobile ? "0.9rem" : "1rem",
                      fontWeight: 500,
                      color: "var(--text)",
                   }}
                >
                   {isMobile
                      ? "🎉 Unlimited hints active for 15 minutes!"
                      : "🎉 Someone opened your link! Unlimited hints are now active for 15 minutes!"}
                </span>
             </div>
          )}
 
          {/* Hint and Share buttons - Always at the bottom */}
          <div
             style={{
                display: "flex",
                gap: isMobile ? "8px" : "12px",
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: isMobile ? "16px" : "20px",
             }}
          >
             {/* Hint Button */}
             <button
                onClick={handleHint}
                disabled={
                   (maxHints > 0 && hintsUsed >= maxHints) ||
                   gameState !== "input"
                }
                style={{
                   display: "flex",
                   alignItems: "center",
                   gap: isMobile ? "6px" : "8px",
                   padding: isMobile ? "10px 16px" : "10px 20px",
                   width: isMobile ? "100%" : "auto",
                   background:
                      maxHints > 0 && hintsUsed >= maxHints
                         ? "rgba(166, 179, 209, 0.1)"
                         : "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1))",
                   border: "1px solid",
                   borderColor:
                      maxHints > 0 && hintsUsed >= maxHints
                         ? "var(--muted)"
                         : "rgba(251, 191, 36, 0.6)",
                   borderRadius: "12px",
                   color:
                      maxHints > 0 && hintsUsed >= maxHints
                         ? "var(--muted)"
                         : "var(--text)",
                   fontSize: isMobile ? "0.85rem" : "0.95rem",
                   fontWeight: 600,
                   cursor:
                      maxHints > 0 && hintsUsed >= maxHints
                         ? "not-allowed"
                         : "pointer",
                   transition: "all 0.3s ease",
                   opacity: maxHints > 0 && hintsUsed >= maxHints ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                   if (
                      !(maxHints > 0 && hintsUsed >= maxHints) &&
                      gameState === "input"
                   ) {
                      e.currentTarget.style.background =
                         "linear-gradient(135deg, rgba(251, 191, 36, 0.3), rgba(251, 191, 36, 0.2))";
                      e.currentTarget.style.borderColor =
                         "rgba(251, 191, 36, 0.8)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow =
                         "0 4px 12px rgba(251, 191, 36, 0.3)";
                   }
                }}
                onMouseLeave={(e) => {
                   if (
                      !(maxHints > 0 && hintsUsed >= maxHints) &&
                      gameState === "input"
                   ) {
                      e.currentTarget.style.background =
                         "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1))";
                      e.currentTarget.style.borderColor =
                         "rgba(251, 191, 36, 0.6)";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                   }
                }}
             >
                <LightBulbIcon
                   style={{
                      width: isMobile ? 18 : 20,
                      height: isMobile ? 18 : 20,
                      color:
                         maxHints > 0 && hintsUsed >= maxHints
                            ? "var(--muted)"
                            : "rgba(251, 191, 36, 0.9)",
                   }}
                />
                <span>
                   Hint{" "}
                   {maxHints === 0 ? "(∞)" : `(${maxHints - hintsUsed} left)`}
                </span>
             </button>
 
             {/* Share Button */}
             <button
                onClick={handleShare}
                style={{
                   display: "flex",
                   alignItems: "center",
                   gap: isMobile ? "6px" : "8px",
                   padding: isMobile ? "10px 16px" : "10px 20px",
                   width: isMobile ? "100%" : "auto",
                   background:
                      "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                   border: "1px solid rgba(59, 130, 246, 0.6)",
                   borderRadius: "12px",
                   color: "var(--text)",
                   fontSize: isMobile ? "0.85rem" : "0.95rem",
                   fontWeight: 600,
                   cursor: "pointer",
                   transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                   e.currentTarget.style.background =
                      "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.2))";
                   e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.8)";
                   e.currentTarget.style.transform = "translateY(-2px)";
                   e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(59, 130, 246, 0.3)";
                }}
                onMouseLeave={(e) => {
                   e.currentTarget.style.background =
                      "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))";
                   e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.6)";
                   e.currentTarget.style.transform = "translateY(0)";
                   e.currentTarget.style.boxShadow = "none";
                }}
             >
                <ShareIcon
                   style={{
                      width: isMobile ? 18 : 20,
                      height: isMobile ? 18 : 20,
                      color: "rgba(59, 130, 246, 0.9)",
                   }}
                />
                <span>Share for Unlimited Hints</span>
             </button>
          </div>
       </div>
    );
}

export default FaceMemory;
 