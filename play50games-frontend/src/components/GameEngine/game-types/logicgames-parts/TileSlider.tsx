"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import theme from "./theme.module.css";
import css from "./TileSlider.module.css";
import {
   CheckCircleIcon,
   ShareIcon,
   LightBulbIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

function TileSlider({
   config,
   onScoreUpdate,
   onComplete,
   passingScore = 70, // Default passing score
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   passingScore?: number;
}) {
   const gridSize = config.gridSize || 3;
   const showHints = config.showHints !== false; // Default: true
   const total = gridSize * gridSize;
   // touch: a swipe on the board slides the tile next to the gap into it (the same move as a tap)
   const swipeStart = useRef<{ x: number; y: number } | null>(null);
   // Use array with total elements, where null represents empty space
   const [tiles, setTiles] = useState<(number | null)[]>([]);
   const [emptyIndex, setEmptyIndex] = useState(total - 1);
   const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
   const [moves, setMoves] = useState(0);
   const [isAnimating, setIsAnimating] = useState(false);
   const [feedback, setFeedback] = useState<"correct" | null>(null);
   const [showHint, setShowHint] = useState(false);
   const [hintTileIndex, setHintTileIndex] = useState<number | null>(null);
   const [hintSequence, setHintSequence] = useState<number[]>([]); // Track all tiles in sequence
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
   const completionCalledRef = useRef(false);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);
   // the last slide (for the slide-in animation): destination index, offset in cells, move number
   const [lastMove, setLastMove] = useState<{
      to: number;
      dx: number;
      dy: number;
      n: number;
   } | null>(null);
   // every one-shot timer (slide lock, hint steps, completion, share messages), cleared on unmount
   const timersRef = useRef<Set<number>>(new Set());
   const later = useCallback((fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
         timersRef.current.delete(id);
         fn();
      }, ms);
      timersRef.current.add(id);
   }, []);
   // bumping this invalidates any queued hint steps (new hint, manual move, new puzzle)
   const hintRunRef = useRef(0);
   const hintActiveRef = useRef(false);
   useEffect(() => {
      const timers = timersRef.current;
      return () => {
         timers.forEach((id) => window.clearTimeout(id));
         timers.clear();
      };
   }, []);

   // Update refs when callbacks change
   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
   }, [onScoreUpdate, onComplete]);

   // Check if user has shared or came from shared link (individual per game, 15 min expiry)
   useEffect(() => {
      const gameKey = "play50games_shared_tile-slider";
      const EXPIRY_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

      // Check if came from shared link (has tracking parameter)
      // Note: Tracking is done in GameEngine.tsx immediately on page load
      const urlParams = new URLSearchParams(window.location.search);
      const sharedBy = urlParams.get("shared");
      if (sharedBy) {
         // Grant unlimited hints to the person who opened the link (with expiry)
         const expiryTime = Date.now() + EXPIRY_TIME;
         setHasShared(true);
         localStorage.setItem(
            gameKey,
            JSON.stringify({ shared: true, expiry: expiryTime })
         );

         // Remove tracking parameter from URL (clean URL)
         const newUrl =
            window.location.pathname +
            window.location.search
               .replace(/[?&]shared=[^&]*/, "")
               .replace(/^\?/, "");
         window.history.replaceState(
            {},
            "",
            newUrl || window.location.pathname
         );
      } else {
         // Check if user has shared before (with expiry check)
         const sharedData = localStorage.getItem(gameKey);
         if (sharedData) {
            try {
               const parsed = JSON.parse(sharedData);
               if (parsed.expiry && Date.now() < parsed.expiry) {
                  // Still valid
                  setHasShared(true);
                  // Check if we have a share_id to monitor
                  if (parsed.share_id) {
                     setCurrentShareId(parsed.share_id);
                  }
               } else {
                  // Expired - remove it
                  localStorage.removeItem(gameKey);
                  setHasShared(false);
                  setCurrentShareId(null);
               }
            } catch (e) {
               // Invalid data - remove it
               localStorage.removeItem(gameKey);
               setHasShared(false);
               setCurrentShareId(null);
            }
         }
      }

      // Cleanup interval on unmount
      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
            shareCheckIntervalRef.current = null;
         }
      };
   }, []);

   // Periodically check if share has clicks (every 5 seconds)
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         // Check expiry from localStorage before making API call
         const gameKey = "play50games_shared_tile-slider";
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
            if (status.has_clicks && !hasShared) {
               // Share has clicks - activate unlimited hints with expiry
               const gameKey = "play50games_shared_tile-slider";
               const EXPIRY_TIME = 15 * 60 * 1000; // 15 minutes
               const expiryTime = Date.now() + EXPIRY_TIME;
               localStorage.setItem(
                  gameKey,
                  JSON.stringify({
                     shared: true,
                     expiry: expiryTime,
                     share_id: currentShareId,
                  })
               );
               setHasShared(true);

               // Show success message that unlimited hints are now active
               setUnlimitedActivated(true);
               later(() => {
                  setUnlimitedActivated(false);
                  setHasShared(false);
                  localStorage.removeItem(gameKey);
               }, EXPIRY_TIME);

               // Stop checking once activated
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
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
               const gameKey = "play50games_shared_tile-slider";
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

      // Check immediately, then every 10 seconds (heartbeat)
      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000); // 10 seconds heartbeat

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, hasShared]);

   // Periodically check if expiry has passed and reset hints to normal
   useEffect(() => {
      const gameKey = "play50games_shared_tile-slider";
      const checkExpiry = () => {
         const sharedData = localStorage.getItem(gameKey);
         if (sharedData) {
            try {
               const parsed = JSON.parse(sharedData);
               if (parsed.expiry && Date.now() >= parsed.expiry) {
                  // Expired - remove it and reset hints to normal
                  localStorage.removeItem(gameKey);
                  setHasShared(false);
                  setCurrentShareId(null);
               }
            } catch (e) {
               // Invalid data - remove it
               localStorage.removeItem(gameKey);
               setHasShared(false);
               setCurrentShareId(null);
            }
         }
      };

      // Check immediately and then every minute
      checkExpiry();
      const expiryCheckInterval = setInterval(checkExpiry, 60 * 1000); // Check every minute

      return () => {
         clearInterval(expiryCheckInterval);
      };
   }, [hasShared]);

   // Get maxHints from config, handle both number and string, default to 5 if not specified
   const maxHintsConfig =
      config.maxHints !== undefined && config.maxHints !== null
         ? typeof config.maxHints === "string"
            ? parseInt(config.maxHints, 10)
            : config.maxHints
         : 5;
   const maxHints = hasShared ? 0 : maxHintsConfig; // Unlimited if shared, otherwise use config or default: 5 hints

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
         await registerShare(shareId, "tile-slider");
         // Store share_id to monitor for clicks (but DON'T activate hints yet)
         const gameKey = "play50games_shared_tile-slider";
         // Only store share_id, don't set hasShared to true yet
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
         // Note: hasShared remains false until someone clicks the link
      } catch (error) {}
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
               title: "Tile Slider Puzzle Game",
               text: "Check out this awesome Tile Slider puzzle game!",
               url: shareableLink,
            });
            // Success - show message (hints will activate when someone clicks the link)
            setShareSuccess(true);
            later(() => setShareSuccess(false), 15000); // 15 seconds
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

   // Handle copy link to clipboard
   const handleCopyLink = async (shareId: string) => {
      // Use the provided shareId instead of generating a new one
      const currentUrl = window.location.href.split("?")[0]; // Remove existing params
      const shareableLink = `${currentUrl}?shared=${shareId}`;

      try {
         await navigator.clipboard.writeText(shareableLink);
         // Success - show message (hints will activate when someone clicks the link)
         setShareSuccess(true);
         later(() => setShareSuccess(false), 15000); // 15 seconds
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
            later(() => setShareSuccess(false), 15000); // 15 seconds
         } catch (err) {}
         document.body.removeChild(textArea);
      }
   };

   // Initialize puzzle
   useEffect(() => {
      const generateSolvableTiles = (): {
         tiles: (number | null)[];
         emptyIndex: number;
      } => {
         const solvedTiles: (number | null)[] = [
            ...Array.from({ length: total - 1 }, (_, i) => i + 1),
            null,
         ];
         let currentTiles = [...solvedTiles];
         let currentEmpty = total - 1;
         let lastEmpty = -1;

         const steps = Math.max(20, gridSize * gridSize * 10);
         for (let step = 0; step < steps; step++) {
            const emptyRow = Math.floor(currentEmpty / gridSize);
            const emptyCol = currentEmpty % gridSize;
            const neighbors: number[] = [];

            if (emptyRow > 0)
               neighbors.push((emptyRow - 1) * gridSize + emptyCol);
            if (emptyRow < gridSize - 1)
               neighbors.push((emptyRow + 1) * gridSize + emptyCol);
            if (emptyCol > 0)
               neighbors.push(emptyRow * gridSize + (emptyCol - 1));
            if (emptyCol < gridSize - 1)
               neighbors.push(emptyRow * gridSize + (emptyCol + 1));

            const filtered = neighbors.filter((idx) => idx !== lastEmpty);
            const moveIndex =
               filtered.length > 0
                  ? filtered[Math.floor(Math.random() * filtered.length)]
                  : neighbors[Math.floor(Math.random() * neighbors.length)];

            const tileValue = currentTiles[moveIndex];
            currentTiles[moveIndex] = null;
            currentTiles[currentEmpty] = tileValue ?? null;
            lastEmpty = currentEmpty;
            currentEmpty = moveIndex;
         }

         const isSolved = currentTiles.every((tile, i) => {
            if (i === total - 1) return tile === null;
            return tile === i + 1;
         });
         if (isSolved) {
            const emptyRow = Math.floor(currentEmpty / gridSize);
            const emptyCol = currentEmpty % gridSize;
            const neighbors: number[] = [];
            if (emptyRow > 0)
               neighbors.push((emptyRow - 1) * gridSize + emptyCol);
            if (emptyRow < gridSize - 1)
               neighbors.push((emptyRow + 1) * gridSize + emptyCol);
            if (emptyCol > 0)
               neighbors.push(emptyRow * gridSize + (emptyCol - 1));
            if (emptyCol < gridSize - 1)
               neighbors.push(emptyRow * gridSize + (emptyCol + 1));
            const moveIndex =
               neighbors[Math.floor(Math.random() * neighbors.length)];
            const tileValue = currentTiles[moveIndex];
            currentTiles[moveIndex] = null;
            currentTiles[currentEmpty] = tileValue ?? null;
            currentEmpty = moveIndex;
         }

         return { tiles: currentTiles, emptyIndex: currentEmpty };
      };

      const { tiles: initialTiles, emptyIndex: initialEmpty } =
         generateSolvableTiles();
      setTiles(initialTiles);
      setEmptyIndex(initialEmpty);
      setSelectedIndex(null);
      setMoves(0);
      setFeedback(null);
      setShowHint(false);
      setHintTileIndex(null);
      setHintsUsed(0);
      hintRunRef.current++;
      hintActiveRef.current = false;
   }, [total]);

   // Check if puzzle is solved
   useEffect(() => {
      if (tiles.length !== total) return;
      if (completionCalledRef.current) return; // Already completed

      // Check if all tiles are in correct position (empty space should be at the end)
      const isSolved = tiles.every((tile, i) => {
         if (i === total - 1) return tile === null; // Last position should be empty
         return tile === i + 1; // Other positions should have correct number
      });

      if (isSolved && moves > 0 && !completionCalledRef.current) {
         completionCalledRef.current = true;

         // Calculate score: 100 points for solving, minus 1 point per move
         // Minimum score: passingScore points for completing (even with many moves)
         // This ensures puzzle completion always gives enough points to pass
         const minScore = Math.max(passingScore, 20); // At least passing score, but minimum 20
         const baseScore = Math.max(minScore, 100 - moves);
         const score = Math.min(100, baseScore); // Cap at 100

         // Show feedback immediately
         setFeedback("correct");

         // Update score immediately (this will trigger progress save)
         // Use a small delay to ensure state is updated before onComplete
         onScoreUpdateRef.current(score);

         // Call onComplete after delay to show feedback and trigger completion modal
         // Pass score explicitly to ensure it's received correctly
         later(() => {
            // Ensure score is passed correctly
            onCompleteRef.current(score);
         }, 2000); // Increased delay to ensure feedback is visible
      }
   }, [tiles, moves, total]);

   // Reset completion flag when puzzle is reset
   useEffect(() => {
      completionCalledRef.current = false;
   }, [total]);

   const canMove = (index: number) => {
      if (index === emptyIndex) return false; // Can't move empty space
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      const emptyRow = Math.floor(emptyIndex / gridSize);
      const emptyCol = emptyIndex % gridSize;
      return (
         (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
         (col === emptyCol && Math.abs(row - emptyRow) === 1)
      );
   };

   const handleTileClick = useCallback(
      (index: number, fromHint = false) => {
         if (!fromHint && hintActiveRef.current) {
            // a manual move stops a running hint sequence (its later moves no longer fit the board)
            hintRunRef.current++;
            hintActiveRef.current = false;
            setShowHint(false);
            setHintTileIndex(null);
            setHintSequence([]);
         }
         if (isAnimating || tiles.length !== total) return;

         // Check if can move inline
         const row = Math.floor(index / gridSize);
         const col = index % gridSize;
         const emptyRow = Math.floor(emptyIndex / gridSize);
         const emptyCol = emptyIndex % gridSize;
         const canMoveTile =
            (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
            (col === emptyCol && Math.abs(row - emptyRow) === 1);

         if (!canMoveTile || index === emptyIndex) return;

         setIsAnimating(true);
         const newTiles = [...tiles];
         // Swap tile with empty space
         const tileValue = newTiles[index];
         newTiles[index] = null; // Move empty space here
         newTiles[emptyIndex] = tileValue; // Move tile to empty space
         setTiles(newTiles);
         setEmptyIndex(index);
         setMoves((prev) => prev + 1);
         // the tile slides from its old cell (index) into the gap (emptyIndex)
         setLastMove((prev) => ({
            to: emptyIndex,
            dx: col - emptyCol,
            dy: row - emptyRow,
            n: (prev?.n ?? 0) + 1,
         }));

         later(() => {
            setIsAnimating(false);
         }, 300);
      },
      [tiles, emptyIndex, gridSize, total, isAnimating, later]
   );
   // hint steps run later, so they must move against the latest board, not the one they were queued on
   const handleTileClickRef = useRef(handleTileClick);
   useEffect(() => {
      handleTileClickRef.current = handleTileClick;
   }, [handleTileClick]);

   // Keyboard controls: Tab to select, Arrow keys to move selected tile
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         if (isAnimating || feedback || tiles.length !== total) return;

         // Tab key: Cycle through tiles to select
         if (e.key === "Tab") {
            e.preventDefault();
            const nonEmptyTiles = tiles
               .map((tile, index) => ({ tile, index }))
               .filter(({ tile }) => tile !== null)
               .map(({ index }) => index);

            if (nonEmptyTiles.length === 0) return;

            if (selectedIndex === null) {
               // Select first tile
               setSelectedIndex(nonEmptyTiles[0]);
            } else {
               // Find next tile
               const currentPos = nonEmptyTiles.indexOf(selectedIndex);
               const nextPos = (currentPos + 1) % nonEmptyTiles.length;
               setSelectedIndex(nonEmptyTiles[nextPos]);
            }
            return;
         }

         // Arrow keys: Move selected tile if it's adjacent to empty space
         if (selectedIndex !== null && tiles[selectedIndex] !== null) {
            const selectedRow = Math.floor(selectedIndex / gridSize);
            const selectedCol = selectedIndex % gridSize;
            const emptyRow = Math.floor(emptyIndex / gridSize);
            const emptyCol = emptyIndex % gridSize;

            // Check if selected tile is adjacent to empty space
            const isAdjacent =
               (selectedRow === emptyRow &&
                  Math.abs(selectedCol - emptyCol) === 1) ||
               (selectedCol === emptyCol &&
                  Math.abs(selectedRow - emptyRow) === 1);

            if (isAdjacent) {
               let shouldMove = false;

               switch (e.key) {
                  case "ArrowUp":
                  case "w":
                  case "W":
                     // Move up: selected tile must be below empty space
                     shouldMove = selectedRow > emptyRow;
                     break;
                  case "ArrowDown":
                  case "s":
                  case "S":
                     // Move down: selected tile must be above empty space
                     shouldMove = selectedRow < emptyRow;
                     break;
                  case "ArrowLeft":
                  case "a":
                  case "A":
                     // Move left: selected tile must be to the right of empty space
                     shouldMove = selectedCol > emptyCol;
                     break;
                  case "ArrowRight":
                  case "d":
                  case "D":
                     // Move right: selected tile must be to the left of empty space
                     shouldMove = selectedCol < emptyCol;
                     break;
               }

               if (shouldMove) {
                  e.preventDefault();
                  handleTileClick(selectedIndex);
                  setSelectedIndex(null); // Deselect after moving
               }
            }
         } else {
            // If no tile selected, use old behavior: move tiles adjacent to empty space
            const emptyRow = Math.floor(emptyIndex / gridSize);
            const emptyCol = emptyIndex % gridSize;
            let targetIndex = -1;

            switch (e.key) {
               case "ArrowUp":
               case "w":
               case "W":
                  if (emptyRow < gridSize - 1) {
                     targetIndex = (emptyRow + 1) * gridSize + emptyCol;
                  }
                  break;
               case "ArrowDown":
               case "s":
               case "S":
                  if (emptyRow > 0) {
                     targetIndex = (emptyRow - 1) * gridSize + emptyCol;
                  }
                  break;
               case "ArrowLeft":
               case "a":
               case "A":
                  if (emptyCol < gridSize - 1) {
                     targetIndex = emptyRow * gridSize + (emptyCol + 1);
                  }
                  break;
               case "ArrowRight":
               case "d":
               case "D":
                  if (emptyCol > 0) {
                     targetIndex = emptyRow * gridSize + (emptyCol - 1);
                  }
                  break;
            }

            if (
               targetIndex >= 0 &&
               targetIndex < total &&
               tiles[targetIndex] !== null
            ) {
               const row = Math.floor(targetIndex / gridSize);
               const col = targetIndex % gridSize;
               const canMoveTile =
                  (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
                  (col === emptyCol && Math.abs(row - emptyRow) === 1);

               if (canMoveTile) {
                  e.preventDefault();
                  handleTileClick(targetIndex);
               }
            }
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [
      emptyIndex,
      gridSize,
      total,
      isAnimating,
      feedback,
      tiles,
      selectedIndex,
      handleTileClick,
   ]);

   // Calculate progress (how many tiles are in correct position)
   const getProgress = () => {
      if (tiles.length !== total) return 0;
      let correct = 0;
      tiles.forEach((tile, i) => {
         if (i === total - 1) {
            // Empty space should be at the end
            if (tile === null) correct++;
         } else {
            // Other tiles should have correct number
            if (tile === i + 1) correct++;
         }
      });
      return (correct / total) * 100;
   };

   // Calculate puzzle score (lower is better, 0 = solved)
   const calculatePuzzleScore = (
      currentTiles: (number | null)[],
      currentEmpty: number
   ) => {
      let score = 0;
      for (let i = 0; i < total; i++) {
         if (i === currentEmpty) continue;
         const tileValue = currentTiles[i];
         if (tileValue === null) continue;
         const correctPos = tileValue - 1;
         if (i !== correctPos) {
            const currentRow = Math.floor(i / gridSize);
            const currentCol = i % gridSize;
            const correctRow = Math.floor(correctPos / gridSize);
            const correctCol = correctPos % gridSize;
            // Manhattan distance
            score +=
               Math.abs(currentRow - correctRow) +
               Math.abs(currentCol - correctCol);
         }
      }
      return score;
   };

   // Simulate a move and return new state
   const simulateMove = (
      currentTiles: (number | null)[],
      currentEmpty: number,
      tileIndex: number
   ): { tiles: (number | null)[]; emptyIndex: number } | null => {
      if (tileIndex === currentEmpty) return null;
      if (currentTiles[tileIndex] === null) return null; // Can't move empty space

      const row = Math.floor(tileIndex / gridSize);
      const col = tileIndex % gridSize;
      const emptyRow = Math.floor(currentEmpty / gridSize);
      const emptyCol = currentEmpty % gridSize;
      const canMoveTile =
         (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
         (col === emptyCol && Math.abs(row - emptyRow) === 1);

      if (!canMoveTile) return null;

      const newTiles = [...currentTiles];
      const tileValue = newTiles[tileIndex];
      newTiles[tileIndex] = null;
      newTiles[currentEmpty] = tileValue;

      return { tiles: newTiles, emptyIndex: tileIndex };
   };

   // Check if puzzle is solved
   const isPuzzleSolved = (
      currentTiles: (number | null)[],
      currentEmpty: number
   ): boolean => {
      if (currentEmpty !== total - 1) return false;
      for (let i = 0; i < total - 1; i++) {
         if (currentTiles[i] !== i + 1) return false;
      }
      return true;
   };

   // Convert state to string for comparison
   const stateToString = (
      currentTiles: (number | null)[],
      currentEmpty: number
   ): string => {
      return JSON.stringify({ tiles: currentTiles, empty: currentEmpty });
   };

   // Optimized state string (faster than JSON.stringify)
   const stateToStringFast = (
      currentTiles: (number | null)[],
      currentEmpty: number
   ): string => {
      // Create a compact string representation
      let str = `${currentEmpty}:`;
      for (let i = 0; i < total; i++) {
         str += currentTiles[i] === null ? "x" : currentTiles[i];
         if (i < total - 1) str += ",";
      }
      return str;
   };

   // Calculate heuristic (Manhattan distance) for A* algorithm
   const calculateHeuristic = (
      currentTiles: (number | null)[],
      currentEmpty: number
   ): number => {
      let h = 0;
      for (let i = 0; i < total; i++) {
         if (i === currentEmpty) continue;
         const tileValue = currentTiles[i];
         if (tileValue === null) continue;
         const correctPos = tileValue - 1;
         if (i !== correctPos) {
            const currentRow = Math.floor(i / gridSize);
            const currentCol = i % gridSize;
            const correctRow = Math.floor(correctPos / gridSize);
            const correctCol = correctPos % gridSize;
            // Manhattan distance
            h +=
               Math.abs(currentRow - correctRow) +
               Math.abs(currentCol - correctCol);
         }
      }
      return h;
   };

   // Find complete solution using A* algorithm (optimized for speed)
   const findCompleteSolution = (): number[] => {
      if (tiles.length !== total) return [];
      if (isPuzzleSolved(tiles, emptyIndex)) return [];

      const visited = new Set<string>();
      // Priority queue: [f_score, g_score, tiles, emptyIndex, moves]
      const openSet: Array<{
         f: number; // f = g + h (total estimated cost)
         g: number; // g = actual cost (number of moves)
         h: number; // h = heuristic (estimated cost to goal)
         tiles: (number | null)[];
         emptyIndex: number;
         moves: number[];
      }> = [];

      const initialH = calculateHeuristic(tiles, emptyIndex);
      openSet.push({
         f: initialH,
         g: 0,
         h: initialH,
         tiles: [...tiles],
         emptyIndex,
         moves: [],
      });
      visited.add(stateToStringFast(tiles, emptyIndex));

      // Use A* with optimized priority queue
      while (openSet.length > 0) {
         // Find node with lowest f-score (most promising path)
         let bestIndex = 0;
         let bestF = openSet[0].f;
         for (let i = 1; i < openSet.length; i++) {
            if (openSet[i].f < bestF) {
               bestF = openSet[i].f;
               bestIndex = i;
            }
         }
         const current = openSet.splice(bestIndex, 1)[0];

         // Check if solved
         if (isPuzzleSolved(current.tiles, current.emptyIndex)) {
            return current.moves;
         }

         // Try all possible moves
         const possibleMoves: number[] = [];
         for (let i = 0; i < total; i++) {
            if (i === current.emptyIndex || current.tiles[i] === null) continue;

            const row = Math.floor(i / gridSize);
            const col = i % gridSize;
            const emptyRow = Math.floor(current.emptyIndex / gridSize);
            const emptyCol = current.emptyIndex % gridSize;
            const canMoveTile =
               (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
               (col === emptyCol && Math.abs(row - emptyRow) === 1);

            if (canMoveTile) {
               possibleMoves.push(i);
            }
         }

         // Process moves in order (prioritize moves that improve heuristic)
         for (const moveIndex of possibleMoves) {
            const newState = simulateMove(
               current.tiles,
               current.emptyIndex,
               moveIndex
            );
            if (!newState) continue;

            const stateKey = stateToStringFast(
               newState.tiles,
               newState.emptyIndex
            );
            if (visited.has(stateKey)) continue;

            visited.add(stateKey);

            const newG = current.g + 1;
            const newH = calculateHeuristic(
               newState.tiles,
               newState.emptyIndex
            );
            const newF = newG + newH;

            openSet.push({
               f: newF,
               g: newG,
               h: newH,
               tiles: newState.tiles,
               emptyIndex: newState.emptyIndex,
               moves: [...current.moves, moveIndex],
            });
         }

         // Limit search depth for very large puzzles (safety check)
         if (current.g > 200) {
            return current.moves;
         }
      }

      return []; // No solution found (shouldn't happen for solvable puzzles)
   };

   // Enhanced heuristic: prioritize tiles that are far from correct position
   const calculateEnhancedScore = (
      currentTiles: (number | null)[],
      currentEmpty: number
   ) => {
      let score = 0;
      let misplacedCount = 0;

      for (let i = 0; i < total; i++) {
         if (i === currentEmpty) continue;
         const tileValue = currentTiles[i];
         if (tileValue === null) continue;
         const correctPos = tileValue - 1;

         if (i !== correctPos) {
            misplacedCount++;
            const currentRow = Math.floor(i / gridSize);
            const currentCol = i % gridSize;
            const correctRow = Math.floor(correctPos / gridSize);
            const correctCol = correctPos % gridSize;

            // Manhattan distance (weighted)
            const distance =
               Math.abs(currentRow - correctRow) +
               Math.abs(currentCol - correctCol);
            score += distance * 2; // Weight distance more

            // Bonus penalty if tile is blocking correct position
            const correctTileAtPos = currentTiles[correctPos];
            if (correctTileAtPos !== null && correctTileAtPos !== tileValue) {
               score += 3; // Extra penalty for blocking
            }
         }
      }

      // Add penalty for misplaced count
      score += misplacedCount * 1.5;

      return score;
   };

   // Get hint: Find a sequence of 4-5 moves that significantly improves the puzzle
   const getHintSequence = (): number[] => {
      if (tiles.length !== total) return [];

      const currentScore = calculateEnhancedScore(tiles, emptyIndex);
      if (currentScore === 0) return []; // Already solved

      let bestSequence: number[] = [];
      let bestImprovement = -Infinity;

      // Try sequences of 4-5 moves for better hints
      const maxMoves = 5;

      // Get all possible first moves
      const possibleFirstMoves: number[] = [];
      for (let i = 0; i < total; i++) {
         if (i !== emptyIndex && canMove(i)) {
            possibleFirstMoves.push(i);
         }
      }

      // Try each first move
      for (const firstMove of possibleFirstMoves) {
         const firstState = simulateMove(tiles, emptyIndex, firstMove);
         if (!firstState) continue;

         const firstScore = calculateEnhancedScore(
            firstState.tiles,
            firstState.emptyIndex
         );
         const firstImprovement = currentScore - firstScore;

         // Try second move
         const possibleSecondMoves: number[] = [];
         for (let i = 0; i < total; i++) {
            if (i !== firstState.emptyIndex && firstState.tiles[i] !== null) {
               const row = Math.floor(i / gridSize);
               const col = i % gridSize;
               const emptyRow = Math.floor(firstState.emptyIndex / gridSize);
               const emptyCol = firstState.emptyIndex % gridSize;
               const canMoveTile =
                  (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
                  (col === emptyCol && Math.abs(row - emptyRow) === 1);
               if (canMoveTile) {
                  possibleSecondMoves.push(i);
               }
            }
         }

         for (const secondMove of possibleSecondMoves) {
            const secondState = simulateMove(
               firstState.tiles,
               firstState.emptyIndex,
               secondMove
            );
            if (!secondState) continue;

            const secondScore = calculateEnhancedScore(
               secondState.tiles,
               secondState.emptyIndex
            );
            const secondImprovement = currentScore - secondScore;

            // Try third move
            const possibleThirdMoves: number[] = [];
            for (let i = 0; i < total; i++) {
               if (
                  i !== secondState.emptyIndex &&
                  secondState.tiles[i] !== null
               ) {
                  const row = Math.floor(i / gridSize);
                  const col = i % gridSize;
                  const emptyRow = Math.floor(
                     secondState.emptyIndex / gridSize
                  );
                  const emptyCol = secondState.emptyIndex % gridSize;
                  const canMoveTile =
                     (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
                     (col === emptyCol && Math.abs(row - emptyRow) === 1);
                  if (canMoveTile) {
                     possibleThirdMoves.push(i);
                  }
               }
            }

            // Check 2-move sequence
            if (secondImprovement > bestImprovement) {
               bestImprovement = secondImprovement;
               bestSequence = [firstMove, secondMove];
            }

            // Check 3-move sequence
            for (const thirdMove of possibleThirdMoves) {
               const thirdState = simulateMove(
                  secondState.tiles,
                  secondState.emptyIndex,
                  thirdMove
               );
               if (!thirdState) continue;

               const thirdScore = calculateEnhancedScore(
                  thirdState.tiles,
                  thirdState.emptyIndex
               );
               const thirdImprovement = currentScore - thirdScore;

               // Try fourth move
               const possibleFourthMoves: number[] = [];
               for (let i = 0; i < total; i++) {
                  if (
                     i !== thirdState.emptyIndex &&
                     thirdState.tiles[i] !== null
                  ) {
                     const row = Math.floor(i / gridSize);
                     const col = i % gridSize;
                     const emptyRow = Math.floor(
                        thirdState.emptyIndex / gridSize
                     );
                     const emptyCol = thirdState.emptyIndex % gridSize;
                     const canMoveTile =
                        (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
                        (col === emptyCol && Math.abs(row - emptyRow) === 1);
                     if (canMoveTile) {
                        possibleFourthMoves.push(i);
                     }
                  }
               }

               // Check 3-move sequence
               if (thirdImprovement > bestImprovement) {
                  bestImprovement = thirdImprovement;
                  bestSequence = [firstMove, secondMove, thirdMove];
               }

               // Check 4-move sequence
               for (const fourthMove of possibleFourthMoves) {
                  const fourthState = simulateMove(
                     thirdState.tiles,
                     thirdState.emptyIndex,
                     fourthMove
                  );
                  if (!fourthState) continue;

                  const fourthScore = calculateEnhancedScore(
                     fourthState.tiles,
                     fourthState.emptyIndex
                  );
                  const fourthImprovement = currentScore - fourthScore;

                  // Try fifth move
                  const possibleFifthMoves: number[] = [];
                  for (let i = 0; i < total; i++) {
                     if (
                        i !== fourthState.emptyIndex &&
                        fourthState.tiles[i] !== null
                     ) {
                        const row = Math.floor(i / gridSize);
                        const col = i % gridSize;
                        const emptyRow = Math.floor(
                           fourthState.emptyIndex / gridSize
                        );
                        const emptyCol = fourthState.emptyIndex % gridSize;
                        const canMoveTile =
                           (row === emptyRow &&
                              Math.abs(col - emptyCol) === 1) ||
                           (col === emptyCol && Math.abs(row - emptyRow) === 1);
                        if (canMoveTile) {
                           possibleFifthMoves.push(i);
                        }
                     }
                  }

                  // Check 4-move sequence
                  if (fourthImprovement > bestImprovement) {
                     bestImprovement = fourthImprovement;
                     bestSequence = [
                        firstMove,
                        secondMove,
                        thirdMove,
                        fourthMove,
                     ];
                  }

                  // Check 5-move sequence
                  for (const fifthMove of possibleFifthMoves) {
                     const fifthState = simulateMove(
                        fourthState.tiles,
                        fourthState.emptyIndex,
                        fifthMove
                     );
                     if (!fifthState) continue;

                     const fifthScore = calculateEnhancedScore(
                        fifthState.tiles,
                        fifthState.emptyIndex
                     );
                     const fifthImprovement = currentScore - fifthScore;

                     if (fifthImprovement > bestImprovement) {
                        bestImprovement = fifthImprovement;
                        bestSequence = [
                           firstMove,
                           secondMove,
                           thirdMove,
                           fourthMove,
                           fifthMove,
                        ];
                     }
                  }
               }
            }
         }

         // Also check single move
         if (firstImprovement > bestImprovement) {
            bestImprovement = firstImprovement;
            bestSequence = [firstMove];
         }
      }

      // Return best sequence (prefer 2-3 moves, but ensure it improves the puzzle)
      if (bestSequence.length === 0 && possibleFirstMoves.length > 0) {
         // Fallback: return first available move only if it improves
         const fallbackMove = possibleFirstMoves[0];
         const fallbackState = simulateMove(tiles, emptyIndex, fallbackMove);
         if (fallbackState) {
            const fallbackScore = calculateEnhancedScore(
               fallbackState.tiles,
               fallbackState.emptyIndex
            );
            if (fallbackScore < currentScore) {
               return [fallbackMove];
            }
         }
      }

      // Ensure sequence improves the puzzle (prevents getting stuck)
      if (bestImprovement <= 0 && bestSequence.length > 0) {
         // If no improvement found, try to find at least one move that doesn't worsen
         for (const firstMove of possibleFirstMoves) {
            const firstState = simulateMove(tiles, emptyIndex, firstMove);
            if (!firstState) continue;
            const firstScore = calculateEnhancedScore(
               firstState.tiles,
               firstState.emptyIndex
            );
            if (firstScore <= currentScore) {
               // Try to extend to 2 moves
               const possibleSecondMoves: number[] = [];
               for (let i = 0; i < total; i++) {
                  if (
                     i !== firstState.emptyIndex &&
                     firstState.tiles[i] !== null
                  ) {
                     const row = Math.floor(i / gridSize);
                     const col = i % gridSize;
                     const emptyRow = Math.floor(
                        firstState.emptyIndex / gridSize
                     );
                     const emptyCol = firstState.emptyIndex % gridSize;
                     const canMoveTile =
                        (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
                        (col === emptyCol && Math.abs(row - emptyRow) === 1);
                     if (canMoveTile) {
                        possibleSecondMoves.push(i);
                     }
                  }
               }

               for (const secondMove of possibleSecondMoves) {
                  const secondState = simulateMove(
                     firstState.tiles,
                     firstState.emptyIndex,
                     secondMove
                  );
                  if (!secondState) continue;
                  const secondScore = calculateEnhancedScore(
                     secondState.tiles,
                     secondState.emptyIndex
                  );
                  if (secondScore < currentScore) {
                     return [firstMove, secondMove];
                  }
               }

               // If single move doesn't worsen, return it
               if (firstScore < currentScore) {
                  return [firstMove];
               }
            }
         }
      }

      // Return best sequence (prefer 4-5 moves for better hints, ensure improvement)
      if (bestImprovement > 0) {
         // Prefer longer sequences (4-5 moves) for more helpful hints
         return bestSequence.length >= 4
            ? bestSequence.slice(0, 5)
            : bestSequence.length >= 2
            ? bestSequence.slice(0, 4)
            : bestSequence;
      }

      return []; // No good sequence found
   };

   const handleShowHint = () => {
      if (!showHints || isAnimating || feedback) return;

      // Check if unlimited hints (maxHints <= 0 or very large number)
      const isUnlimited = maxHints <= 0 || maxHints >= 1000;

      if (!isUnlimited && hintsUsed >= maxHints) return;

      let sequence: number[] = [];

      // If unlimited hints, find complete solution
      if (isUnlimited) {
         sequence = findCompleteSolution();
      }
      if (!isUnlimited || sequence.length === 0) {
         // Otherwise, use normal hint sequence (2-3 moves)
         sequence = getHintSequence();
      }

      if (sequence.length === 0) return;

      if (!isUnlimited) {
         setHintsUsed((prev) => prev + 1);
      }

      // Set all tiles in sequence for highlighting
      setHintSequence(sequence);
      setShowHint(true);

      // any newer run id makes these queued steps no-ops
      const run = ++hintRunRef.current;
      hintActiveRef.current = true;

      // Execute moves sequentially with delays
      sequence.forEach((tileIndex, moveIndex) => {
         later(() => {
            if (hintRunRef.current !== run) return;
            // Highlight current tile
            setHintTileIndex(tileIndex);

            // Move tile after brief delay
            later(() => {
               if (hintRunRef.current !== run) return;
               handleTileClickRef.current(tileIndex, true);

               // Remove current tile from sequence highlight
               if (moveIndex === sequence.length - 1) {
                  // Last move - clear all highlights
                  hintActiveRef.current = false;
                  setShowHint(false);
                  setHintTileIndex(null);
                  setHintSequence([]);
               } else {
                  // Update sequence to remove moved tile
                  setHintSequence((prev) => prev.slice(1));
               }
            }, 300);
         }, moveIndex * 600); // 600ms delay between moves
      });
   };

   /** The tile a swipe moves: the neighbour of the gap on the side the finger came from. */
   const swipeTile = (dx: number, dy: number): number => {
      const row = Math.floor(emptyIndex / gridSize);
      const col = emptyIndex % gridSize;
      if (Math.abs(dx) > Math.abs(dy)) {
         if (dx < 0 && col < gridSize - 1) return emptyIndex + 1;
         if (dx > 0 && col > 0) return emptyIndex - 1;
      } else {
         if (dy < 0 && row < gridSize - 1) return emptyIndex + gridSize;
         if (dy > 0 && row > 0) return emptyIndex - gridSize;
      }
      return -1;
   };

   const hintsUnlimited = maxHints <= 0 || maxHints >= 1000;
   const hintsSpent = maxHints > 0 && maxHints < 1000 && hintsUsed >= maxHints;
   const solved = feedback === "correct";

   return (
      <div className={`${theme.game} ${css.root}`}>
         {/* Header */}
         <div className={`${theme.header} ${css.head}`}>
            <div className={theme.chips}>
               <span className={theme.chip}>
                  Moves <strong>{moves}</strong>
               </span>
               <span className={theme.chip}>
                  Score <strong>{Math.max(0, 100 - moves)} / 100</strong>
               </span>
            </div>
         </div>

         {/* Game Grid: equal square cells; a moved tile slides in with transform only */}
         <div className={`${theme.panel} ${css.frame}`}>
            <div
               className={`${theme.board} ${css.board} ${
                  solved ? `${css.solved} ${theme.pop}` : ""
               }`}
               style={{ "--cols": gridSize } as React.CSSProperties}
               role="group"
               aria-label="Sliding tiles"
               onTouchStart={(e) => {
                  const t = e.touches[0];
                  swipeStart.current = t ? { x: t.clientX, y: t.clientY } : null;
               }}
               onTouchEnd={(e) => {
                  const st = swipeStart.current;
                  swipeStart.current = null;
                  const t = e.changedTouches[0];
                  if (!st || !t) return;
                  const dx = t.clientX - st.x;
                  const dy = t.clientY - st.y;
                  if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return; // a tap: the tile's own click
                  const i = swipeTile(dx, dy);
                  if (i < 0 || !canMove(i) || isAnimating) return;
                  handleTileClick(i);
                  setSelectedIndex(null);
                  setShowHint(false);
                  setHintTileIndex(null);
               }}
            >
               {Array.from({ length: total }).map((_, i) => {
                  const isMovable = canMove(i);
                  const tileValue = tiles[i];
                  const isCorrect = tileValue !== null && tileValue === i + 1;
                  const isEmpty = tileValue === null || tileValue === undefined;
                  const isSelected = selectedIndex === i;
                  const isHinted =
                     showHint &&
                     (hintSequence.includes(i) || hintTileIndex === i);
                  const isCurrentHint = showHint && hintTileIndex === i;
                  const slid = lastMove !== null && lastMove.to === i;

                  if (isEmpty) {
                     return <div key={i} className={css.gap} aria-hidden />;
                  }

                  const cls = [
                     theme.cell,
                     css.tile,
                     isMovable ? css.movable : "",
                     isCorrect ? css.inPlace : "",
                     isHinted ? css.hinted : "",
                     isCurrentHint ? `${css.hintNow} ${theme.pop}` : "",
                     isSelected ? `${theme.selected} ${css.sel}` : "",
                     solved ? css.tileSolved : "",
                     slid ? css.slide : "",
                  ]
                     .filter(Boolean)
                     .join(" ");

                  return (
                     <button
                        // only the tile that just moved gets a new key, so its slide plays once
                        key={slid && lastMove ? `${i}-m${lastMove.n}` : i}
                        type="button"
                        onClick={() => {
                           handleTileClick(i);
                           setSelectedIndex(null); // Deselect after clicking
                           setShowHint(false); // Hide hint after clicking
                           setHintTileIndex(null);
                        }}
                        className={cls}
                        style={
                           slid && lastMove
                              ? ({
                                   "--dx": lastMove.dx,
                                   "--dy": lastMove.dy,
                                } as React.CSSProperties)
                              : undefined
                        }
                        disabled={!isMovable || isAnimating}
                        aria-label={`Tile ${tileValue}${isCorrect ? ", in place" : ""}${
                           isMovable ? ", can move" : ""
                        }`}
                        title={
                           isHinted
                              ? `Hint: move tile ${tileValue} next`
                              : isSelected
                              ? `Selected. Use the arrow keys to move tile ${tileValue}`
                              : isCorrect
                              ? `Tile ${tileValue} is in place, but can still be moved if needed`
                              : undefined
                        }
                     >
                        <span className={css.num}>{tileValue}</span>
                        {isCorrect && (
                           <CheckCircleIcon className={css.check} aria-hidden />
                        )}
                     </button>
                  );
               })}
            </div>
         </div>

         {/* Feedback */}
         <div className={theme.feedbackSlot} aria-live="polite">
            {solved && (
               <div className={`${theme.feedback} ${theme.feedbackOk} ${theme.pop}`}>
                  <CheckCircleIcon className={`${css.btnIcon} ${css.feedbackIconGap}`} aria-hidden />
                  <span>Puzzle solved. Well done.</span>
               </div>
            )}
         </div>

         {/* Share & Hint Section */}
         <div className={css.tools}>
            {showHints && (
               <div className={css.toolRow}>
                  <span className={theme.chip}>
                     {hintsUnlimited ? (
                        <>
                           Hints <strong>Unlimited</strong>
                        </>
                     ) : (
                        <>
                           Hints <strong>{hintsUsed} / {maxHints}</strong>
                        </>
                     )}
                  </span>
                  <button
                     type="button"
                     onClick={handleShowHint}
                     className={`${theme.btn} ${theme.btnPrimary}`}
                     disabled={showHint || feedback !== null || hintsSpent}
                     title={
                        hintsSpent
                           ? "Maximum hints reached"
                           : hintsUnlimited
                           ? "Solve puzzle automatically (unlimited hints)"
                           : "Get a hint on which tile to move next"
                     }
                  >
                     <LightBulbIcon className={css.btnIcon} aria-hidden />
                     <span>
                        {hintsSpent
                           ? "No Hints Left"
                           : hintsUnlimited
                           ? "Solve Puzzle"
                           : "Show Hint"}
                     </span>
                  </button>
               </div>
            )}

            {!hasShared && (
               <div className={css.toolRow}>
                  <button
                     type="button"
                     onClick={handleShare}
                     className={theme.btn}
                     title="Share this game to get unlimited hints"
                  >
                     <ShareIcon className={css.btnIcon} aria-hidden />
                     <span>Share for Unlimited Hints</span>
                  </button>
               </div>
            )}
            {!hasShared && shareSuccess && (
               <div className={`${css.note} ${css.noteOk} ${theme.fadeUp}`} role="status">
                  <CheckCircleIcon className={css.btnIcon} aria-hidden />
                  <span>
                     Link copied. Unlimited hints unlock when someone opens your
                     link.
                  </span>
               </div>
            )}
            {!hasShared && unlimitedActivated && (
               <div className={`${css.note} ${css.noteAccent} ${theme.fadeUp}`} role="status">
                  <CheckCircleIcon className={css.btnIcon} aria-hidden />
                  <span>
                     Someone opened your link. Unlimited hints are active for 15
                     minutes.
                  </span>
               </div>
            )}
         </div>

         {/* Instructions */}
         <div className={`${theme.panel} ${css.howto}`}>
            <p className={css.howtoTitle}>How to play</p>
            <ol className={css.steps}>
               <li>
                  <strong>Goal:</strong> arrange the numbers 1 to {total - 1} in
                  order, left to right, top to bottom.
               </li>
               <li>
                  <strong>Gap:</strong> the empty square is where a tile can
                  slide.
               </li>
               <li>
                  <strong>Move:</strong> tap a tile <strong>next to</strong> the
                  gap (it has a coloured outline), or swipe on the board.
               </li>
               <li>
                  <strong>Tip:</strong> only tiles directly above, below, left or
                  right of the gap can move.
               </li>
            </ol>
         </div>
      </div>
   );
}

export default TileSlider;
