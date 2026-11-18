"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { CSSProperties } from "react";
import theme from "./theme.module.css";
import css from "./BlockFill.module.css";
import {
   ArrowPathRoundedSquareIcon,
   ArrowUturnLeftIcon,
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
   // the round-end timer is cleared if the game unmounts before it fires
   const winTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   useEffect(
      () => () => {
         if (winTimerRef.current) clearTimeout(winTimerRef.current);
      },
      []
   );

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
         winTimerRef.current = setTimeout(() => {
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

   // Ghost preview: the cells the selected piece would cover from the hovered cell (mouse only)
   const ghost = (() => {
      if (!selectedPieceId || !hoveredCell) return null;
      const piece = pieces.find((p) => p.uid === selectedPieceId);
      if (!piece) return null;
      const test = canPlaceAt(
         hoveredCell.r,
         hoveredCell.c,
         selectedPieceId,
         selectedRotation
      );
      const anchor = getAnchorCell(piece.baseCells);
      const shape = applyRotationWithAnchor(
         piece.baseCells,
         selectedRotation,
         anchor
      );
      const cells = new Set<number>();
      shape.forEach(([x, y]) => {
         const r = hoveredCell.r + y;
         const c = hoveredCell.c + x;
         if (r >= 0 && c >= 0 && r < gridSize && c < gridSize) {
            cells.add(r * gridSize + c);
         }
      });
      return { cells, ok: test.ok };
   })();

   const isWin = feedback === "correct";

   return (
      <div className={`${theme.game} ${css.root}`}>
         <div className={theme.header}>
            <div className={theme.chips}>
               <span className={theme.chip}>
                  Round <strong>{currentRound}</strong> / {maxRounds}
               </span>
               <span className={theme.chip}>
                  Score <strong>{currentScore}</strong> / {maxRounds * 5}
               </span>
               <span className={theme.chip}>
                  Placed <strong>{usedPieces}</strong> /{" "}
                  {pieces.length + usedPieces}
               </span>
            </div>
            <div className={css.progress} aria-hidden="true">
               <div
                  className={css.progressFill}
                  style={{ transform: `scaleX(${Math.min(1, progress / 100)})` }}
               />
            </div>
         </div>

         <div className={css.area}>
            {/* Board */}
            <div className={css.boardCol}>
               <div className={css.status} aria-live="polite">
                  {selectedPieceId ? (
                     <span>
                        Piece <strong>{selectedPieceId.split("-")[0]}</strong>{" "}
                        selected. Tap the board to place it, Rotate (R) to turn
                        it.
                     </span>
                  ) : (
                     <span className={css.statusMuted}>
                        Pick a piece to place. Tap a placed piece to take it
                        back.
                     </span>
                  )}
               </div>

               <div
                  key={`board-${currentRound}-${gridSize}`}
                  className={`${theme.board} ${css.board} ${theme.fadeUp} ${
                     isWin ? css.win : ""
                  }`}
                  style={{ "--cols": gridSize } as CSSProperties}
                  role="group"
                  aria-label={`Board, ${gridSize} by ${gridSize}`}
                  onMouseLeave={() => {
                     // Clear hover when leaving the board area
                     setHoveredCell(null);
                  }}
               >
                  {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
                     const r = Math.floor(idx / gridSize);
                     const c = idx % gridSize;
                     const placementId = grid[idx];
                     const isFilled = placementId !== 0;
                     const pieceColor = isFilled
                        ? getPieceColor(placementId)
                        : null;
                     const inGhost = ghost?.cells.has(idx) ?? false;

                     const cls = [
                        theme.cell,
                        css.cell,
                        isFilled ? css.filled : "",
                        !isFilled && !selectedPieceId ? css.idle : "",
                     ]
                        .filter(Boolean)
                        .join(" ");

                     return (
                        <button
                           key={`${r}-${c}`}
                           type="button"
                           className={cls}
                           style={
                              pieceColor
                                 ? ({
                                      "--pc-bg": pieceColor.bg,
                                      "--pc-line": pieceColor.border,
                                   } as CSSProperties)
                                 : undefined
                           }
                           onMouseEnter={() => {
                              if (!selectedPieceId) {
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
                           onClick={() => {
                              if (isFilled) {
                                 removePlacement(placementId);
                              } else if (selectedPieceId) {
                                 place(r, c);
                              }
                           }}
                           aria-label={`Row ${r + 1}, column ${c + 1}${
                              isFilled ? ", filled, tap to take the piece back" : ", empty"
                           }`}
                        >
                           {isFilled && (
                              // keyed by placement: a newly placed piece pops in once
                              <span
                                 key={placementId}
                                 className={`${css.fill} ${theme.reveal}`}
                                 aria-hidden="true"
                              />
                           )}
                           {inGhost && (
                              <span
                                 className={`${css.ghost} ${
                                    ghost?.ok ? css.ghostOk : css.ghostBad
                                 }`}
                                 aria-hidden="true"
                              />
                           )}
                        </button>
                     );
                  })}
               </div>

               {/* Controls */}
               <div className={`${theme.actions} ${css.controls}`}>
                  <button
                     type="button"
                     className={theme.btn}
                     onClick={rotateSelected}
                     disabled={!selectedPieceId}
                  >
                     <ArrowPathRoundedSquareIcon
                        className={css.btnIcon}
                        aria-hidden="true"
                     />
                     Rotate (R)
                  </button>
                  <button
                     type="button"
                     className={theme.btn}
                     onClick={undo}
                     disabled={placements.length === 0}
                  >
                     <ArrowUturnLeftIcon
                        className={css.btnIcon}
                        aria-hidden="true"
                     />
                     Undo (U)
                  </button>
               </div>

               <div className={theme.feedbackSlot} aria-live="polite">
                  {feedback && (
                     <div
                        className={`${theme.feedback} ${
                           feedback === "correct"
                              ? `${theme.feedbackOk} ${theme.pop}`
                              : `${theme.feedbackWarn} ${theme.shake}`
                        }`}
                     >
                        {feedback === "correct"
                           ? "Board filled. +5 points"
                           : "That does not fit. Try again."}
                     </div>
                  )}
               </div>
            </div>

            {/* Pieces Panel */}
            <div className={`${theme.panel} ${css.panel}`}>
               <div className={css.panelTitle}>Pieces</div>
               <div
                  key={`pieces-${currentRound}`}
                  className={`${css.pieces} ${theme.stagger}`}
               >
                  {pieces.map((piece, i) => {
                     const shape = applyRotation(
                        piece.baseCells,
                        selectedPieceId === piece.uid ? selectedRotation : 0
                     );
                     const isSelected = selectedPieceId === piece.uid;
                     const dims = {
                        w: Math.max(...shape.map((c) => c[0])) + 1,
                        h: Math.max(...shape.map((c) => c[1])) + 1,
                     };
                     const cols = Math.max(4, dims.w);
                     const rows = Math.max(4, dims.h);
                     const cellSet = new Set(
                        shape.map(([x, y]) => `${x},${y}`)
                     );

                     return (
                        <div
                           key={piece.uid}
                           className={css.pieceSlot}
                           style={{ "--i": i } as CSSProperties}
                        >
                           <button
                              type="button"
                              className={`${css.piece} ${
                                 isSelected ? css.pieceSel : ""
                              }`}
                              aria-pressed={isSelected}
                              aria-label={`Piece ${piece.id}, ${piece.name}`}
                              onClick={() => {
                                 setSelectedPieceId(piece.uid);
                                 setSelectedRotation(0);
                              }}
                           >
                              <span
                                 className={css.preview}
                                 style={
                                    {
                                       "--pw": cols,
                                       "--ph": rows,
                                    } as CSSProperties
                                 }
                                 aria-hidden="true"
                              >
                                 {Array.from({ length: rows * cols }).map(
                                    (_, idx) => {
                                       const x = idx % cols;
                                       const y = Math.floor(idx / cols);
                                       return (
                                          <span
                                             key={`${x}-${y}`}
                                             className={
                                                cellSet.has(`${x},${y}`)
                                                   ? css.previewOn
                                                   : css.previewOff
                                             }
                                          />
                                       );
                                    }
                                 )}
                              </span>
                              <span className={css.pieceText}>
                                 <span className={css.pieceId}>{piece.id}</span>
                                 <span className={css.pieceName}>
                                    {piece.name}
                                 </span>
                              </span>
                           </button>
                        </div>
                     );
                  })}
               </div>
            </div>
         </div>
      </div>
   );
}

export default BlockFill;
