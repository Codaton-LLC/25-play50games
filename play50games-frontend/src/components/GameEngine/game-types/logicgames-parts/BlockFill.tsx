"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   ArrowPathIcon,
   TrophyIcon,
   PuzzlePieceIcon,
   ArrowPathRoundedSquareIcon,
   ArrowUturnLeftIcon,
   InformationCircleIcon,
} from "@heroicons/react/24/outline";

function BlockFill({
   config,
   currentRound = 1,
   maxRounds = 20,
   currentScore = 0,
   onScoreUpdate,
   onComplete,
   onRoundComplete,
}: {
   config: Record<string, any>;
   currentRound?: number;
   maxRounds?: number;
   currentScore?: number;
   onScoreUpdate: (score: number) => void;
   onComplete?: (finalScore?: number) => void;
   onRoundComplete?: () => void;
}) {
   // Base pieces (polyominoes) - from original HTML
   const BASE_PIECES = [
      {
         id: "A",
         name: "Long 4",
         cells: [
            [0, 0],
            [1, 0],
            [2, 0],
            [3, 0],
         ],
      },
      {
         id: "B",
         name: "L 4",
         cells: [
            [0, 0],
            [0, 1],
            [0, 2],
            [1, 2],
         ],
      },
      {
         id: "C",
         name: "T 4",
         cells: [
            [0, 0],
            [1, 0],
            [2, 0],
            [1, 1],
         ],
      },
      {
         id: "D",
         name: "Z 4",
         cells: [
            [0, 0],
            [1, 0],
            [1, 1],
            [2, 1],
         ],
      },
      {
         id: "E",
         name: "Square",
         cells: [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
         ],
      },
      {
         id: "F",
         name: "L 5",
         cells: [
            [0, 0],
            [0, 1],
            [0, 2],
            [0, 3],
            [1, 3],
         ],
      },
      {
         id: "G",
         name: "P 5",
         cells: [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
            [0, 2],
         ],
      },
      {
         id: "H",
         name: "T 5",
         cells: [
            [0, 0],
            [1, 0],
            [2, 0],
            [1, 1],
            [1, 2],
         ],
      },
      {
         id: "I",
         name: "Z 5",
         cells: [
            [0, 0],
            [1, 0],
            [1, 1],
            [1, 2],
            [2, 2],
         ],
      },
      {
         id: "J",
         name: "W 5",
         cells: [
            [0, 0],
            [1, 0],
            [1, 1],
            [2, 1],
            [2, 2],
         ],
      },
      {
         id: "K",
         name: "Long 3",
         cells: [
            [0, 0],
            [1, 0],
            [2, 0],
         ],
      },
      {
         id: "L",
         name: "L 3",
         cells: [
            [0, 0],
            [0, 1],
            [1, 1],
         ],
      },
      { id: "M", name: "Dot", cells: [[0, 0]] },
      {
         id: "N",
         name: "Plus 5",
         cells: [
            [1, 0],
            [0, 1],
            [1, 1],
            [2, 1],
            [1, 2],
         ],
      },
      {
         id: "O",
         name: "U 5",
         cells: [
            [0, 0],
            [2, 0],
            [0, 1],
            [1, 1],
            [2, 1],
         ],
      },
      {
         id: "P",
         name: "S 5",
         cells: [
            [1, 0],
            [2, 0],
            [0, 1],
            [1, 1],
            [0, 2],
         ],
      },
   ];

   const layoutLevels = Array.isArray(config.levelLayouts)
      ? config.levelLayouts
      : null;
   const defaultLevels = [3, 4, 5, 6, 7];
   const levelSizes =
      layoutLevels && layoutLevels.length
         ? layoutLevels.map((level: any) =>
              Array.isArray(level?.rows)
                 ? level.rows.length
                 : Number(level?.size || 0)
           )
         : Array.isArray(config.levels) && config.levels.length
         ? config.levels
         : defaultLevels;
   const levelIndex = Math.max(
      0,
      Math.min(levelSizes.length - 1, currentRound - 1)
   );
   const gridSize = config.gridSize || levelSizes[levelIndex];
   const [grid, setGrid] = useState<number[]>([]);
   const [pieces, setPieces] = useState<
      Array<{ uid: string; id: string; name: string; baseCells: number[][] }>
   >([]);
   const [placements, setPlacements] = useState<
      Array<{
         placementId: number;
         pieceUid: string;
         pieceId: string;
         pieceName: string;
         baseCells: number[][];
         rot: number;
         origin: { r: number; c: number };
         cellsAbs: number[][];
      }>
   >([]);
   const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
   const [selectedRotation, setSelectedRotation] = useState(0);
   const [hoveredCell, setHoveredCell] = useState<{
      r: number;
      c: number;
   } | null>(null);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const placementSeqRef = useRef(1);
   const completionCalledRef = useRef(false);
   const isResettingRef = useRef(true);
   const initialPiecesCountRef = useRef(0);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);
   const onRoundCompleteRef = useRef(onRoundComplete);

   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
      onRoundCompleteRef.current = onRoundComplete;
   }, [onScoreUpdate, onComplete, onRoundComplete]);

   // Normalize cells (move min x/y to 0)
   const normalizeCells = useCallback((cells: number[][]): number[][] => {
      if (cells.length === 0) return [];
      const xs = cells.map((c) => c[0]);
      const ys = cells.map((c) => c[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return cells.map(([x, y]) => [x - minX, y - minY]);
   }, []);

   const buildPiecesFromLayout = useCallback(
      (rows: string[]) => {
         const cleaned = rows.map((row) => row.replace(/\s+/g, ""));
         const piecesMap = new Map<string, number[][]>();
         cleaned.forEach((row, r) => {
            for (let c = 0; c < row.length; c++) {
               const ch = row[c];
               if (!ch || ch === ".") continue;
               if (!piecesMap.has(ch)) piecesMap.set(ch, []);
               piecesMap.get(ch)!.push([c, r]);
            }
         });
         return Array.from(piecesMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([id, cells], idx) => ({
               uid: `${id}-${idx + 1}`,
               id,
               name: `Piece ${id}`,
               baseCells: normalizeCells(cells),
            }));
      },
      [normalizeCells]
   );

   const levelLayoutRows = useMemo(() => {
      if (!layoutLevels || !layoutLevels.length) return null;
      const entry = layoutLevels[levelIndex];
      if (Array.isArray(entry?.rows)) return entry.rows as string[];
      if (Array.isArray(entry)) return entry as string[];
      return null;
   }, [layoutLevels, levelIndex]);

   // Pick a stable anchor cell inside the shape (top-left by row/col)
   const getAnchorCell = useCallback((cells: number[][]): [number, number] => {
      let anchor = cells[0] as [number, number];
      for (const [x, y] of cells) {
         if (y < anchor[1] || (y === anchor[1] && x < anchor[0])) {
            anchor = [x, y];
         }
      }
      return anchor;
   }, []);

   // Rotate 90 degrees: (x,y) -> (y, -x)
   const rotate90 = useCallback(
      (cells: number[][]): number[][] => {
         const rotated = cells.map(([x, y]) => [y, -x]);
         return normalizeCells(rotated);
      },
      [normalizeCells]
   );

   // Apply rotation (0-3 times)
   const applyRotation = useCallback(
      (cells: number[][], rot: number): number[][] => {
         let out = cells;
         for (let i = 0; i < rot; i++) {
            out = rotate90(out);
         }
         return out;
      },
      [rotate90]
   );

   // Rotate around a chosen anchor cell and keep anchor at (0,0)
   const applyRotationWithAnchor = useCallback(
      (
         cells: number[][],
         rot: number,
         anchor: [number, number]
      ): number[][] => {
         let out = cells.map(([x, y]) => [x - anchor[0], y - anchor[1]]);
         for (let i = 0; i < rot; i++) {
            out = out.map(([x, y]) => [y, -x]);
         }
         return out;
      },
      []
   );

   // Choose pieces for grid size
   // Each piece size: A,B,C,D,E=4, F,G,H,I,J,N,O,P=5, K,L=3, M=1
   const choosePiecesForSize = useCallback((N: number): string[] => {
      if (N === 3) {
         // 9 cells: 3+3+3 = 9
         return ["K", "K", "K"];
      }
      if (N === 4) {
         // 16 cells: 4+4+4+4 = 16
         return ["A", "B", "C", "D"];
      }
      if (N === 5) {
         // 25 cells: 5+5+5+4+3+3 = 25
         return ["F", "G", "H", "A", "K", "L"];
      }
      if (N === 6) {
         // 36 cells: 5+5+5+5+4+4+4+4 = 36
         return ["F", "G", "H", "I", "A", "B", "C", "D"];
      }
      // 7x7 = 49 cells: 5+5+5+5+5+5+4+4+4+4+3 = 49 (solvable set)
      return ["F", "G", "H", "I", "J", "N", "A", "B", "C", "D", "K"];
   }, []);

   // Build pieces for current round
   const buildPieces = useCallback(
      (N: number, layoutRows?: string[] | null) => {
         if (layoutRows && layoutRows.length > 0) {
            return buildPiecesFromLayout(layoutRows);
         }
         const ids = choosePiecesForSize(N);
         return ids.map((id, idx) => {
            const base = BASE_PIECES.find((p) => p.id === id);
            if (!base) throw new Error(`Piece ${id} not found`);
            return {
               uid: `${id}-${idx + 1}`,
               id,
               name: base.name,
               baseCells: normalizeCells(base.cells),
            };
         });
      },
      [buildPiecesFromLayout, choosePiecesForSize, normalizeCells]
   );

   // Initialize game
   useEffect(() => {
      // Reset completion flag for new round
      isResettingRef.current = true;
      completionCalledRef.current = false;
      placementSeqRef.current = 1;
      const newGrid = Array(gridSize * gridSize).fill(0);
      setGrid(newGrid);
      const newPieces = buildPieces(gridSize, levelLayoutRows);
      setPieces(newPieces);
      initialPiecesCountRef.current = newPieces.length;
      setPlacements([]);
      setSelectedPieceId(null);
      setSelectedRotation(0);
      setHoveredCell(null);
      setFeedback(null);
   }, [currentRound, gridSize, buildPieces, levelLayoutRows]);

   useEffect(() => {
      const isReady =
         grid.length === gridSize * gridSize &&
         placements.length === 0 &&
         pieces.length === initialPiecesCountRef.current;
      if (isReady && isResettingRef.current) {
         isResettingRef.current = false;
      }
   }, [grid.length, gridSize, placements.length, pieces.length]);

   // Check if can place at position
   const canPlaceAt = useCallback(
      (
         r0: number,
         c0: number,
         pieceUid: string,
         rot: number
      ): { ok: boolean; cellsAbs: number[][] } => {
         const piece = pieces.find((p) => p.uid === pieceUid);
         if (!piece) return { ok: false, cellsAbs: [] };

         const anchor = getAnchorCell(piece.baseCells);
         const shape = applyRotationWithAnchor(piece.baseCells, rot, anchor);
         const cellsAbs = shape.map(([x, y]) => [r0 + y, c0 + x]); // x->col, y->row

         for (const [r, c] of cellsAbs) {
            if (r < 0 || c < 0 || r >= gridSize || c >= gridSize) {
               return { ok: false, cellsAbs };
            }
            const idx = r * gridSize + c;
            if (grid[idx] !== 0) {
               return { ok: false, cellsAbs };
            }
         }

         return { ok: true, cellsAbs };
      },
      [pieces, grid, gridSize, applyRotationWithAnchor, getAnchorCell]
   );

   // Place piece
   const place = useCallback(
      (r0: number, c0: number) => {
         if (!selectedPieceId) return;

         const piece = pieces.find((p) => p.uid === selectedPieceId);
         if (!piece) return;
         const test = canPlaceAt(r0, c0, selectedPieceId, selectedRotation);
         if (!test.ok) return;

         const placementId = placementSeqRef.current++;
         const newGrid = [...grid];
         test.cellsAbs.forEach(([r, c]) => {
            newGrid[r * gridSize + c] = placementId;
         });

         setGrid(newGrid);
         setPlacements([
            ...placements,
            {
               placementId,
               pieceUid: selectedPieceId,
               pieceId: piece.id,
               pieceName: piece.name,
               baseCells: piece.baseCells,
               rot: selectedRotation,
               origin: { r: r0, c: c0 },
               cellsAbs: test.cellsAbs,
            },
         ]);

         // Remove placed piece
         setPieces(pieces.filter((p) => p.uid !== selectedPieceId));

         // Auto-select next unused piece
         const remaining = pieces.filter((p) => p.uid !== selectedPieceId);
         if (remaining.length > 0) {
            setSelectedPieceId(remaining[0].uid);
            setSelectedRotation(0);
         } else {
            setSelectedPieceId(null);
            setSelectedRotation(0);
         }

         setHoveredCell(null);
      },
      [
         selectedPieceId,
         selectedRotation,
         canPlaceAt,
         grid,
         gridSize,
         placements,
         pieces,
      ]
   );

   // Remove placement
   const removePlacement = useCallback(
      (placementId: number) => {
         const placement = placements.find(
            (p) => p.placementId === placementId
         );
         if (!placement) return;

         const newGrid = [...grid];
         placement.cellsAbs.forEach(([r, c]) => {
            newGrid[r * gridSize + c] = 0;
         });

         setGrid(newGrid);
         setPlacements(placements.filter((p) => p.placementId !== placementId));

         // Restore piece
         const restoredPiece = {
            uid: placement.pieceUid,
            id: placement.pieceId,
            name: placement.pieceName,
            baseCells: placement.baseCells,
         };
         setPieces([...pieces, restoredPiece]);
         setSelectedPieceId(placement.pieceUid);
         setSelectedRotation(0);

         setHoveredCell(null);
      },
      [grid, gridSize, placements, pieces]
   );

   // Undo last placement
   const undo = useCallback(() => {
      if (placements.length === 0) return;
      const last = placements[placements.length - 1];
      removePlacement(last.placementId);
   }, [placements, removePlacement]);

   // Rotate selected piece
   const rotateSelected = useCallback(() => {
      if (!selectedPieceId) return;
      setSelectedRotation((prev) => (prev + 1) % 4);
   }, [selectedPieceId]);

   // Check win condition
   useEffect(() => {
      // Don't check if already completed or grid not initialized
      if (isResettingRef.current) return;
      if (completionCalledRef.current) {
         // "[BlockFill] Round already completed, skipping check");
         return;
      }
      if (grid.length === 0) return;

      const allFilled = grid.every((v) => v !== 0);
      const allUsed = pieces.length === 0;

      if (allFilled && allUsed) {
         // Mark as completed to prevent multiple calls
         completionCalledRef.current = true;

         // Show success feedback
         setFeedback("correct");

         // Score: 5 points per round
         onScoreUpdateRef.current(5);

         // Wait before moving to next round
         setTimeout(() => {
            setFeedback(null);
            if (currentRound >= maxRounds) {
               // Game complete
               // "[BlockFill] All rounds completed!");
               const finalScore = Math.min(100, currentScore + 5);
               onCompleteRef.current?.(finalScore);
            } else {
               // Next round - this will trigger useEffect to reset completionCalledRef
               onRoundCompleteRef.current?.();
            }
         }, 2000); // 2 seconds delay to show completion
      }
   }, [grid, pieces, currentRound, maxRounds, currentScore]);

   // Ghost preview is now calculated directly in render (see ghost overlay below)

   // Keyboard controls
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         const key = e.key.toLowerCase();
         if (key === "r") {
            e.preventDefault();
            rotateSelected();
         } else if (key === "u") {
            e.preventDefault();
            undo();
         } else if (key === "escape") {
            e.preventDefault();
            setSelectedPieceId(null);
            setSelectedRotation(0);
            setHoveredCell(null);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [rotateSelected, undo]);

   const progress = (currentRound / maxRounds) * 100;
   const usedPieces = placements.length;
   const totalPieces = initialPiecesCountRef.current;

   // Color palette for different pieces (each placement gets a unique color)
   const getPieceColor = useCallback(
      (placementId: number) => {
         const colors = [
            {
               bg: "rgba(110, 168, 255, 0.25)",
               border: "rgba(110, 168, 255, 0.6)",
               shadow: "rgba(110, 168, 255, 0.4)",
            }, // Blue
            {
               bg: "rgba(54, 211, 153, 0.25)",
               border: "rgba(54, 211, 153, 0.6)",
               shadow: "rgba(54, 211, 153, 0.4)",
            }, // Green
            {
               bg: "rgba(251, 113, 133, 0.25)",
               border: "rgba(251, 113, 133, 0.6)",
               shadow: "rgba(251, 113, 133, 0.4)",
            }, // Red/Pink
            {
               bg: "rgba(168, 85, 247, 0.25)",
               border: "rgba(168, 85, 247, 0.6)",
               shadow: "rgba(168, 85, 247, 0.4)",
            }, // Purple
            {
               bg: "rgba(251, 191, 36, 0.25)",
               border: "rgba(251, 191, 36, 0.6)",
               shadow: "rgba(251, 191, 36, 0.4)",
            }, // Yellow
            {
               bg: "rgba(34, 197, 94, 0.25)",
               border: "rgba(34, 197, 94, 0.6)",
               shadow: "rgba(34, 197, 94, 0.4)",
            }, // Emerald
            {
               bg: "rgba(236, 72, 153, 0.25)",
               border: "rgba(236, 72, 153, 0.6)",
               shadow: "rgba(236, 72, 153, 0.4)",
            }, // Pink
            {
               bg: "rgba(59, 130, 246, 0.25)",
               border: "rgba(59, 130, 246, 0.6)",
               shadow: "rgba(59, 130, 246, 0.4)",
            }, // Sky Blue
            {
               bg: "rgba(245, 158, 11, 0.25)",
               border: "rgba(245, 158, 11, 0.6)",
               shadow: "rgba(245, 158, 11, 0.4)",
            }, // Orange
            {
               bg: "rgba(139, 92, 246, 0.25)",
               border: "rgba(139, 92, 246, 0.6)",
               shadow: "rgba(139, 92, 246, 0.4)",
            }, // Violet
         ];
         // Get placement index to determine color
         const placementIndex = placements.findIndex(
            (p) => p.placementId === placementId
         );
         return colors[placementIndex % colors.length] || colors[0];
      },
      [placements]
   );

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
            padding: "24px",
            maxWidth: "1200px",
            margin: "0 auto",
         }}
      >
         {/* Header */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               borderRadius: "16px",
               padding: "20px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
            <div
               style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.875rem",
                  color: "var(--muted)",
                  fontWeight: 500,
                  marginBottom: "12px",
                  flexWrap: "wrap",
                  gap: "12px",
               }}
            >
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <ArrowPathIcon
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
                  />
                  Round {currentRound} / {maxRounds}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <TrophyIcon
                     style={{ width: 16, height: 16, color: "var(--ok)" }}
                  />
                  Score: {currentScore} / {maxRounds * 5}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <PuzzlePieceIcon
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
                  />
                  Placed: {usedPieces} / {pieces.length + usedPieces}
               </span>
            </div>
            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: "8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "4px",
                  overflow: "hidden",
               }}
            >
               <div
                  style={{
                     width: `${progress}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "4px",
                     transition: "width 0.3s ease",
                     boxShadow: "rgba(125, 211, 252, 0.5) 0px 0px 10px",
                  }}
               />
            </div>
         </div>

         {/* Game Area */}
         <div
            style={{
               display: "flex",
               flexDirection: "row",
               flexWrap: "wrap",
               gap: "24px",
               width: "100%",
               alignItems: "start",
               justifyContent: "center",
            }}
         >
            {/* Board */}
            <div
               style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "16px",
                  flex: "1 1 0",
                  minWidth: "300px",
               }}
            >
               <div
                  style={{
                     background: "var(--card)",
                     borderRadius: "18px",
                     padding: "16px",
                     position: "relative",
                     boxShadow: "0 10px 24px rgba(0, 0, 0, 0.2)",
                  }}
                  onMouseLeave={() => {
                     // Clear hover when leaving the board area
                     setHoveredCell(null);
                  }}
               >
                  {/* Selected Piece Indicator */}
                  {selectedPieceId && (
                     <div
                        style={{
                           position: "absolute",
                           top: "-12px",
                           left: "50%",
                           transform: "translateX(-50%)",
                           background: "rgba(110, 168, 255, 0.95)",
                           border: "2px solid rgba(110, 168, 255, 1)",

                           padding: "6px 12px",
                           fontSize: "0.75rem",
                           fontWeight: 700,
                           color: "#0b1020",
                           boxShadow: "0 4px 12px rgba(110, 168, 255, 0.4)",
                           zIndex: 20,
                           display: "flex",
                           alignItems: "center",
                           gap: "6px",
                           whiteSpace: "nowrap",
                        }}
                     >
                        <div
                           style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: "#0b1020",
                              animation: "pulse 2s infinite",
                           }}
                        />
                        Selected: {selectedPieceId.split("-")[0]}
                     </div>
                  )}
                  {(() => {
                     const cellSize =
                        gridSize <= 5 ? 48 : gridSize <= 6 ? 44 : 40;
                     const cellSizePx = `${cellSize}px`;
                     const gapPx = "6px";

                     return (
                        <div
                           style={{
                              display: "grid",
                              gridTemplateColumns: `repeat(${gridSize}, ${cellSizePx})`,
                              gridAutoRows: cellSizePx,
                              gap: gapPx,
                              position: "relative",
                           }}
                           onMouseMove={(e) => {
                              if (!selectedPieceId) {
                                 if (hoveredCell) setHoveredCell(null);
                                 return;
                              }
                              const rect =
                                 e.currentTarget.getBoundingClientRect();
                              const x = e.clientX - rect.left;
                              const y = e.clientY - rect.top;
                              const stride = cellSize + 6;
                              const c = Math.floor(x / stride);
                              const r = Math.floor(y / stride);
                              if (
                                 r < 0 ||
                                 c < 0 ||
                                 r >= gridSize ||
                                 c >= gridSize
                              ) {
                                 if (hoveredCell) setHoveredCell(null);
                                 return;
                              }
                              if (
                                 !hoveredCell ||
                                 hoveredCell.r !== r ||
                                 hoveredCell.c !== c
                              ) {
                                 setHoveredCell({ r, c });
                              }
                           }}
                           onMouseLeave={() => {
                              setHoveredCell(null);
                           }}
                        >
                           {/* Ghost Overlay - follows mouse */}
                           {/* Ghost Overlay - on top, follows mouse */}
                           {selectedPieceId &&
                              hoveredCell &&
                              (() => {
                                 const test = canPlaceAt(
                                    hoveredCell.r,
                                    hoveredCell.c,
                                    selectedPieceId,
                                    selectedRotation
                                 );
                                 const piece = pieces.find(
                                    (p) => p.uid === selectedPieceId
                                 );
                                 if (!piece) return null;
                                 const anchor = getAnchorCell(piece.baseCells);
                                 const shape = applyRotationWithAnchor(
                                    piece.baseCells,
                                    selectedRotation,
                                    anchor
                                 );
                                 const cellsAbs = shape.map(([x, y]) => [
                                    hoveredCell.r + y,
                                    hoveredCell.c + x,
                                 ]);
                                 const gap = 6;
                                 const isValid = test.ok;

                                 return (
                                    <div
                                       key="ghost-overlay"
                                       style={{
                                          position: "absolute",
                                          top: 0,
                                          left: 0,
                                          right: 0,
                                          bottom: 0,
                                          pointerEvents: "none",
                                          zIndex: 20, // On top of all cells
                                       }}
                                    >
                                       {cellsAbs.map(([r, c], idx) => {
                                          const inBounds =
                                             r >= 0 &&
                                             c >= 0 &&
                                             r < gridSize &&
                                             c < gridSize;
                                          const cellValid = inBounds && isValid;
                                          return (
                                             <div
                                                key={`ghost-${idx}`}
                                                style={{
                                                   position: "absolute",
                                                   left: `${
                                                      c * (cellSize + gap)
                                                   }px`,
                                                   top: `${
                                                      r * (cellSize + gap)
                                                   }px`,
                                                   width: cellSizePx,
                                                   height: cellSizePx,

                                                   border: cellValid
                                                      ? "2px dashed rgba(110, 168, 255, 0.8)"
                                                      : "2px dashed rgba(251, 113, 133, 0.8)",
                                                   background: cellValid
                                                      ? "rgba(110, 168, 255, 0.25)"
                                                      : "rgba(251, 113, 133, 0.25)",
                                                   boxShadow: cellValid
                                                      ? "0 0 20px rgba(110, 168, 255, 0.5), inset 0 0 10px rgba(110, 168, 255, 0.15)"
                                                      : "0 0 20px rgba(251, 113, 133, 0.5), inset 0 0 10px rgba(251, 113, 133, 0.15)",
                                                   pointerEvents: "none",
                                                }}
                                             />
                                          );
                                       })}
                                    </div>
                                 );
                              })()}
                           {Array.from({ length: gridSize * gridSize }).map(
                              (_, idx) => {
                                 const r = Math.floor(idx / gridSize);
                                 const c = idx % gridSize;
                                 const placementId = grid[idx];
                                 const isFilled = placementId !== 0;
                                 const pieceColor = isFilled
                                    ? getPieceColor(placementId)
                                    : null;

                                 return (
                                    <div
                                       key={`${r}-${c}`}
                                       onMouseEnter={(e) => {
                                          if (isFilled) {
                                             e.currentTarget.style.transform =
                                                "scale(1.08)";
                                             e.currentTarget.style.zIndex =
                                                "10";
                                          }
                                       }}
                                       onMouseLeave={(e) => {
                                          e.currentTarget.style.transform =
                                             "scale(1)";
                                          e.currentTarget.style.zIndex = "1";
                                       }}
                                       onClick={() => {
                                          if (isFilled) {
                                             removePlacement(placementId);
                                          } else if (selectedPieceId) {
                                             place(r, c);
                                          }
                                       }}
                                       style={{
                                          width: cellSizePx,
                                          height: cellSizePx,

                                          border: isFilled
                                             ? `2px solid ${
                                                  pieceColor?.border ||
                                                  "rgba(54, 211, 153, 0.6)"
                                               }`
                                             : "1px solid rgba(255, 255, 255, 0.1)",
                                          background: isFilled
                                             ? pieceColor?.bg ||
                                               "rgba(54, 211, 153, 0.25)"
                                             : "rgba(15, 27, 51, 0.45)",
                                          cursor: selectedPieceId
                                             ? "pointer"
                                             : isFilled
                                             ? "pointer"
                                             : "default",
                                          transition: "all 0.15s ease",
                                          position: "relative",
                                          boxShadow: isFilled
                                             ? `0 0 12px ${
                                                  pieceColor?.shadow ||
                                                  "rgba(54, 211, 153, 0.4)"
                                               }, inset 0 0 8px ${
                                                  pieceColor?.shadow ||
                                                  "rgba(54, 211, 153, 0.2)"
                                               }`
                                             : "none",
                                          transform: "scale(1)",
                                          zIndex: isFilled ? 3 : 1,
                                       }}
                                    />
                                 );
                              }
                           )}
                        </div>
                     );
                  })()}
               </div>

               {/* Controls */}
               <div
                  style={{
                     display: "flex",
                     gap: "12px",
                     alignItems: "center",
                  }}
               >
                  <button
                     onClick={rotateSelected}
                     disabled={!selectedPieceId}
                     style={{
                        padding: "10px 16px",

                        background: selectedPieceId
                           ? "rgba(110, 168, 255, 0.1)"
                           : "rgba(255, 255, 255, 0.05)",
                        color: "var(--text)",
                        cursor: selectedPieceId ? "pointer" : "not-allowed",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.2s ease",
                     }}
                  >
                     <ArrowPathRoundedSquareIcon
                        style={{ width: 16, height: 16 }}
                     />
                     Rotate (R)
                  </button>
                  <button
                     onClick={undo}
                     disabled={placements.length === 0}
                     style={{
                        padding: "10px 16px",

                        background:
                           placements.length > 0
                              ? "rgba(110, 168, 255, 0.1)"
                              : "rgba(255, 255, 255, 0.05)",
                        color: "var(--text)",
                        cursor:
                           placements.length > 0 ? "pointer" : "not-allowed",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.2s ease",
                     }}
                  >
                     <ArrowUturnLeftIcon style={{ width: 16, height: 16 }} />
                     Undo (U)
                  </button>
               </div>

               {/* Feedback Message */}
               {feedback && (
                  <div
                     style={{
                        padding: "16px 24px",

                        fontSize: "1.1rem",
                        fontWeight: 600,
                        animation: "slideIn 0.3s ease-out",
                        background:
                           feedback === "correct"
                              ? "rgba(134, 239, 172, 0.2)"
                              : "rgba(252, 165, 165, 0.2)",
                        border: `1px solid ${
                           feedback === "correct" ? "var(--ok)" : "var(--warn)"
                        }`,
                        color:
                           feedback === "correct" ? "var(--ok)" : "var(--warn)",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                        justifyContent: "center",
                     }}
                  >
                     {feedback === "correct" ? (
                        <>
                           <CheckCircleIcon style={{ width: 24, height: 24 }} />
                           <span>Correct! Great job!</span>
                        </>
                     ) : (
                        <>
                           <XCircleIcon style={{ width: 24, height: 24 }} />
                           <span>Try again! You can do it!</span>
                        </>
                     )}
                  </div>
               )}
            </div>

            {/* Pieces Panel */}
            <div
               style={{
                  background: "var(--card)",
                  borderRadius: "18px",
                  padding: "16px",
                  minWidth: "280px",
                  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.2)",
               }}
            >
               <div
                  style={{
                     fontSize: "0.875rem",
                     fontWeight: 700,
                     marginBottom: "12px",
                     color: "var(--text)",
                  }}
               >
                  Pieces
               </div>
               <div
                  style={{
                     fontSize: "0.875rem",
                     color: "var(--text)",
                     marginBottom: "16px",
                     padding: "12px",
                     background: selectedPieceId
                        ? "rgba(110, 168, 255, 0.15)"
                        : "rgba(255, 255, 255, 0.05)",
                     border: selectedPieceId
                        ? "2px solid rgba(110, 168, 255, 0.5)"
                        : "1px solid var(--stroke)",

                     fontWeight: 600,
                     display: "flex",
                     alignItems: "center",
                     gap: "8px",
                     minHeight: "44px",
                  }}
               >
                  {selectedPieceId ? (
                     <>
                        <div
                           style={{
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              background: "rgba(110, 168, 255, 1)",
                              boxShadow: "0 0 8px rgba(110, 168, 255, 0.6)",
                              animation: "pulse 2s infinite",
                           }}
                        />
                        <span>
                           Selected:{" "}
                           <strong style={{ color: "var(--accent)" }}>
                              {selectedPieceId.split("-")[0]}
                           </strong>{" "}
                           · Press{" "}
                           <strong style={{ color: "var(--accent)" }}>R</strong>{" "}
                           to rotate
                        </span>
                     </>
                  ) : (
                     <>
                        <InformationCircleIcon
                           style={{
                              width: 18,
                              height: 18,
                              color: "var(--muted)",
                           }}
                        />
                        <span style={{ color: "var(--muted)" }}>
                           Select a piece to place
                        </span>
                     </>
                  )}
               </div>
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(2, 1fr)",
                     gap: "10px",
                  }}
               >
                  {pieces.map((piece) => {
                     const shape = applyRotation(
                        piece.baseCells,
                        selectedPieceId === piece.uid ? selectedRotation : 0
                     );
                     const isSelected = selectedPieceId === piece.uid;
                     const dims = {
                        w: Math.max(...shape.map((c) => c[0])) + 1,
                        h: Math.max(...shape.map((c) => c[1])) + 1,
                     };
                     const cellSet = new Set(
                        shape.map(([x, y]) => `${x},${y}`)
                     );

                     return (
                        <button
                           key={piece.uid}
                           onClick={() => {
                              setSelectedPieceId(piece.uid);
                              setSelectedRotation(0);
                           }}
                           style={{
                              padding: "10px",
                              borderRadius: "16px",
                              border: isSelected
                                 ? "2px solid rgba(110, 168, 255, 0.8)"
                                 : "1px solid rgba(255, 255, 255, 0.1)",
                              background: isSelected
                                 ? "rgba(110, 168, 255, 0.2)"
                                 : "rgba(15, 27, 51, 0.45)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              transition: "all 0.2s ease",
                              textAlign: "left",
                              boxShadow: isSelected
                                 ? "0 0 16px rgba(110, 168, 255, 0.4), inset 0 0 8px rgba(110, 168, 255, 0.1)"
                                 : "none",
                              transform: isSelected
                                 ? "scale(1.02)"
                                 : "scale(1)",
                           }}
                        >
                           <div
                              style={{
                                 display: "grid",
                                 gridTemplateColumns: `repeat(${Math.max(
                                    4,
                                    dims.w
                                 )}, 12px)`,
                                 gridTemplateRows: `repeat(${Math.max(
                                    4,
                                    dims.h
                                 )}, 12px)`,
                                 gap: "4px",
                                 width: "86px",
                                 height: "64px",
                                 padding: "6px",
                                 background: "rgba(15, 27, 51, 0.45)",

                                 border: "1px solid rgba(255, 255, 255, 0.1)",
                              }}
                           >
                              {Array.from({
                                 length:
                                    Math.max(4, dims.h) * Math.max(4, dims.w),
                              }).map((_, idx) => {
                                 const x = idx % Math.max(4, dims.w);
                                 const y = Math.floor(
                                    idx / Math.max(4, dims.w)
                                 );
                                 const hasCell = cellSet.has(`${x},${y}`);
                                 return (
                                    <div
                                       key={`${x}-${y}`}
                                       style={{
                                          width: "12px",
                                          height: "12px",
                                          borderRadius: "4px",
                                          background: hasCell
                                             ? "rgba(232, 238, 252, 0.75)"
                                             : "transparent",
                                          opacity: hasCell ? 0.8 : 0,
                                       }}
                                    />
                                 );
                              })}
                           </div>
                           <div
                              style={{
                                 display: "flex",
                                 flexDirection: "column",
                                 gap: "4px",
                                 flex: 1,
                              }}
                           >
                              <div
                                 style={{
                                    fontWeight: 900,
                                    fontSize: "0.8125rem",
                                    color: "var(--text)",
                                 }}
                              >
                                 {piece.id}
                              </div>
                              <div
                                 style={{
                                    fontSize: "0.75rem",
                                    color: "var(--muted)",
                                 }}
                              >
                                 {piece.name}
                              </div>
                           </div>
                        </button>
                     );
                  })}
               </div>
            </div>
         </div>
      </div>
   );
}

export default BlockFill;
