"use client";

import React from "react";
import {
   PuzzlePieceIcon,
   SparklesIcon,
   BoltIcon,
   FireIcon,
   TrophyIcon,
   ScaleIcon,
   HomeIcon,
   StarIcon,
   CheckCircleIcon,
   HeartIcon,
   CircleStackIcon,
} from "@heroicons/react/24/outline";

interface GamePreviewProps {
   gameType: string;
   isFinalGame?: boolean;
}

export default function GamePreview({
   gameType,
   isFinalGame = false,
}: GamePreviewProps) {
   // Mini preview components for each game type
   const renderPreview = () => {
      switch (gameType) {
         // Logic Games
         case "sudoku-4x4":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(4, 1fr)",
                     gap: "4px",
                     width: "100%",
                     maxWidth: "120px",
                     margin: "0 auto",
                  }}
               >
                  {[1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1].map(
                     (num, i) => (
                        <div
                           key={i}
                           style={{
                              aspectRatio: "1",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "rgba(255, 255, 255, 0.08)",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 700,
                              color: "var(--text)",
                           }}
                        >
                           {num}
                        </div>
                     )
                  )}
               </div>
            );

         case "match-shapes":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(4, 1fr)",
                     gap: "6px",
                     width: "100%",
                     maxWidth: "140px",
                     margin: "0 auto",
                  }}
               >
                  {["⭐", "🏠", "🔑", "⭐"].map((shape, i) => (
                     <div
                        key={i}
                        style={{
                           aspectRatio: "1",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           background:
                              i === 3
                                 ? "linear-gradient(135deg, rgba(134, 239, 172, 0.3) 0%, rgba(134, 239, 172, 0.1) 100%)"
                                 : "rgba(255, 255, 255, 0.06)",
                           borderRadius: "8px",
                           fontSize: "20px",
                           border:
                              i === 3
                                 ? "2px solid var(--ok)"
                                 : "1px solid var(--stroke)",
                        }}
                     >
                        {shape}
                     </div>
                  ))}
               </div>
            );

         case "color-sequence":
            return (
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     gap: "8px",
                     alignItems: "center",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        display: "flex",
                        gap: "6px",
                        justifyContent: "center",
                     }}
                  >
                     {[
                        { color: "#ef4444", label: "1" },
                        { color: "#3b82f6", label: "2" },
                        { color: "#10b981", label: "3" },
                     ].map((item, i) => (
                        <div
                           key={i}
                           style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "6px",
                              background:
                                 item.color === "#ef4444"
                                    ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                                    : item.color === "#3b82f6"
                                    ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
                                    : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              border: `2px solid ${item.color}`,
                              boxShadow: `0 4px 12px ${item.color}40`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              fontWeight: 700,
                              color: "white",
                           }}
                        >
                           {item.label}
                        </div>
                     ))}
                  </div>
                  <div
                     style={{
                        display: "flex",
                        gap: "4px",
                        justifyContent: "center",
                     }}
                  >
                     {["red", "blue", "green", "yellow"].map((color) => {
                        const colorVal =
                           color === "red"
                              ? "#ef4444"
                              : color === "blue"
                              ? "#3b82f6"
                              : color === "green"
                              ? "#10b981"
                              : "#eab308";
                        return (
                           <div
                              key={color}
                              style={{
                                 width: "20px",
                                 height: "20px",
                                 borderRadius: "4px",
                                 background: colorVal,
                                 border: "1px solid rgba(255, 255, 255, 0.2)",
                              }}
                           />
                        );
                     })}
                  </div>
               </div>
            );

         case "logic-gates":
            return (
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                     gap: "6px",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "var(--accent)",
                        marginBottom: "4px",
                     }}
                  >
                     AND Gate
                  </div>
                  <table
                     style={{
                        width: "100%",
                        fontSize: "9px",
                        borderCollapse: "collapse",
                     }}
                  >
                     <thead>
                        <tr>
                           <th
                              style={{
                                 padding: "2px 4px",
                                 background: "rgba(255, 255, 255, 0.05)",
                                 border: "1px solid var(--stroke)",
                              }}
                           >
                              A
                           </th>
                           <th
                              style={{
                                 padding: "2px 4px",
                                 background: "rgba(255, 255, 255, 0.05)",
                                 border: "1px solid var(--stroke)",
                              }}
                           >
                              B
                           </th>
                           <th
                              style={{
                                 padding: "2px 4px",
                                 background: "rgba(255, 255, 255, 0.05)",
                                 border: "1px solid var(--stroke)",
                              }}
                           >
                              Out
                           </th>
                        </tr>
                     </thead>
                     <tbody>
                        <tr>
                           <td
                              style={{
                                 padding: "2px 4px",
                                 border: "1px solid var(--stroke)",
                                 textAlign: "center",
                              }}
                           >
                              0
                           </td>
                           <td
                              style={{
                                 padding: "2px 4px",
                                 border: "1px solid var(--stroke)",
                                 textAlign: "center",
                              }}
                           >
                              0
                           </td>
                           <td
                              style={{
                                 padding: "2px 4px",
                                 border: "1px solid var(--stroke)",
                                 textAlign: "center",
                              }}
                           >
                              0
                           </td>
                        </tr>
                        <tr>
                           <td
                              style={{
                                 padding: "2px 4px",
                                 border: "1px solid var(--stroke)",
                                 textAlign: "center",
                              }}
                           >
                              1
                           </td>
                           <td
                              style={{
                                 padding: "2px 4px",
                                 border: "1px solid var(--stroke)",
                                 textAlign: "center",
                              }}
                           >
                              1
                           </td>
                           <td
                              style={{
                                 padding: "2px 4px",
                                 border: "1px solid var(--stroke)",
                                 textAlign: "center",
                                 color: "var(--ok)",
                                 fontWeight: 700,
                              }}
                           >
                              1
                           </td>
                        </tr>
                     </tbody>
                  </table>
               </div>
            );

         case "number-order":
            return (
               <div
                  style={{
                     display: "flex",
                     gap: "6px",
                     justifyContent: "center",
                     alignItems: "center",
                     width: "100%",
                  }}
               >
                  {[3, 7, 12, 19].map((num) => (
                     <div
                        key={num}
                        style={{
                           padding: "8px 12px",
                           background: "rgba(255, 255, 255, 0.08)",
                           borderRadius: "8px",
                           fontSize: "14px",
                           fontWeight: 700,
                           color: "var(--text)",
                           border: "1px solid var(--stroke)",
                        }}
                     >
                        {num}
                     </div>
                  ))}
               </div>
            );

         case "find-odd-one":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(3, 1fr)",
                     gap: "6px",
                     width: "100%",
                     maxWidth: "120px",
                     margin: "0 auto",
                  }}
               >
                  {["🔵", "🔵", "🟢"].map((shape, i) => (
                     <div
                        key={i}
                        style={{
                           aspectRatio: "1",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           background:
                              i === 2
                                 ? "linear-gradient(135deg, rgba(234, 179, 8, 0.3) 0%, rgba(234, 179, 8, 0.1) 100%)"
                                 : "rgba(255, 255, 255, 0.06)",
                           borderRadius: "8px",
                           fontSize: "20px",
                           border:
                              i === 2
                                 ? "2px solid #eab308"
                                 : "1px solid var(--stroke)",
                        }}
                     >
                        {shape}
                     </div>
                  ))}
               </div>
            );

         case "tile-slider":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(3, 1fr)",
                     gap: "2px",
                     background: "var(--stroke)",
                     padding: "2px",
                     width: "100%",
                     maxWidth: "90px",
                     margin: "0 auto",
                     borderRadius: "4px",
                  }}
               >
                  {[
                     [1, 2, 3],
                     [4, 5, 6],
                     [7, 8, null],
                  ].map((row, ri) =>
                     row.map((cell, ci) => (
                        <div
                           key={`${ri}-${ci}`}
                           style={{
                              aspectRatio: "1",
                              background:
                                 cell !== null ? "var(--card)" : "transparent",
                              borderRadius: "4px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "var(--accent)",
                           }}
                        >
                           {cell || ""}
                        </div>
                     ))
                  )}
               </div>
            );

         case "maze-escape":
            // Generate a simple maze for preview (4x4 grid)
            const previewMaze: number[][] = [
               [1, 1, 1, 0],
               [1, 0, 1, 0],
               [1, 1, 1, 1],
               [0, 0, 1, 1],
            ];
            const previewGridSize = 4;

            return (
               <div
                  style={{
                     width: "100%",
                     maxWidth: "80px",
                     margin: "0 auto",
                     aspectRatio: "1",
                     display: "grid",
                     gridTemplateColumns: `repeat(${previewGridSize}, 1fr)`,
                     gridTemplateRows: `repeat(${previewGridSize}, 1fr)`,
                     gap: "2px",
                     background: "rgba(255, 255, 255, 0.1)",
                     padding: "4px",
                     borderRadius: "8px",
                     overflow: "hidden",
                  }}
               >
                  {Array.from({
                     length: previewGridSize * previewGridSize,
                  }).map((_, i) => {
                     const x = i % previewGridSize;
                     const y = Math.floor(i / previewGridSize);
                     const isWall = !previewMaze[y] || previewMaze[y][x] === 0;
                     const isPlayer = x === 0 && y === 0;
                     const isExit =
                        x === previewGridSize - 1 &&
                        y === previewGridSize - 1 &&
                        !isPlayer;

                     return (
                        <div
                           key={i}
                           style={{
                              aspectRatio: "1",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: isWall
                                 ? "linear-gradient(135deg, rgba(30, 30, 30, 0.9) 0%, rgba(20, 20, 20, 0.9) 100%)"
                                 : isPlayer
                                 ? "linear-gradient(135deg, rgba(125, 211, 252, 0.4) 0%, rgba(125, 211, 252, 0.2) 100%)"
                                 : isExit
                                 ? "linear-gradient(135deg, rgba(34, 197, 94, 0.4) 0%, rgba(34, 197, 94, 0.2) 100%)"
                                 : "linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)",
                              border: isWall
                                 ? "1px solid rgba(255, 255, 255, 0.1)"
                                 : isPlayer
                                 ? "2px solid var(--accent)"
                                 : isExit
                                 ? "2px solid #22c55e"
                                 : "1px solid rgba(255, 255, 255, 0.05)",
                              borderRadius: "2px",
                              position: "relative",
                           }}
                        >
                           {isPlayer && (
                              <BoltIcon
                                 style={{
                                    width: "60%",
                                    height: "60%",
                                    color: "var(--accent)",
                                 }}
                              />
                           )}
                           {isExit && (
                              <TrophyIcon
                                 style={{
                                    width: "60%",
                                    height: "60%",
                                    color: "#22c55e",
                                 }}
                              />
                           )}
                        </div>
                     );
                  })}
               </div>
            );

         case "balance-scale":
            return (
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     gap: "12px",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                     }}
                  >
                     <div
                        style={{
                           width: "30px",
                           height: "30px",
                           background: "var(--card)",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           fontSize: "14px",
                           fontWeight: 700,
                           color: "var(--accent)",
                           boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
                           borderRadius: "4px",
                        }}
                     >
                        5
                     </div>
                     <span
                        style={{
                           fontSize: "8px",
                           color: "var(--muted)",
                           fontWeight: 600,
                        }}
                     >
                        Left: 5
                     </span>
                  </div>
                  <ScaleIcon
                     style={{
                        width: 24,
                        height: 24,
                        color: "var(--accent)",
                        transform: "rotate(-10deg)",
                     }}
                  />
                  <div
                     style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                     }}
                  >
                     <div
                        style={{
                           width: "30px",
                           height: "30px",
                           background: "var(--card)",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           fontSize: "14px",
                           fontWeight: 700,
                           color: "var(--accent)",
                           boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
                           borderRadius: "4px",
                        }}
                     >
                        3
                     </div>
                     <span
                        style={{
                           fontSize: "8px",
                           color: "var(--muted)",
                           fontWeight: 600,
                        }}
                     >
                        Right: 3
                     </span>
                  </div>
               </div>
            );

         case "pattern-completion":
            return (
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                     gap: "8px",
                     width: "100%",
                  }}
               >
                  {/* Pattern: Home, Star, Home, ?, Star */}
                  <div
                     style={{
                        display: "flex",
                        gap: "6px",
                        alignItems: "center",
                        justifyContent: "center",
                     }}
                  >
                     <div
                        style={{
                           width: "30px",
                           height: "30px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                        }}
                     >
                        <HomeIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--accent)",
                           }}
                        />
                     </div>
                     <div
                        style={{
                           width: "30px",
                           height: "30px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                        }}
                     >
                        <StarIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--accent)",
                           }}
                        />
                     </div>
                     <div
                        style={{
                           width: "30px",
                           height: "30px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                        }}
                     >
                        <HomeIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--accent)",
                           }}
                        />
                     </div>
                     <div
                        style={{
                           width: "30px",
                           height: "30px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           background:
                              "linear-gradient(135deg, rgba(125, 211, 252, 0.2) 0%, rgba(125, 211, 252, 0.1) 100%)",
                           border: "2px dashed var(--accent)",
                           borderRadius: "4px",
                        }}
                     >
                        <span
                           style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "var(--accent)",
                           }}
                        >
                           ?
                        </span>
                     </div>
                     <div
                        style={{
                           width: "30px",
                           height: "30px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                        }}
                     >
                        <StarIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--accent)",
                           }}
                        />
                     </div>
                  </div>
                  {/* Correct answer highlighted */}
                  <div
                     style={{
                        display: "flex",
                        gap: "4px",
                        alignItems: "center",
                        justifyContent: "center",
                     }}
                  >
                     <div
                        style={{
                           width: "24px",
                           height: "24px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           background:
                              "linear-gradient(135deg, rgba(134, 239, 172, 0.2) 0%, rgba(134, 239, 172, 0.1) 100%)",
                           border: "2px solid #86efac",
                           borderRadius: "4px",
                           position: "relative",
                        }}
                     >
                        <HomeIcon
                           style={{
                              width: 16,
                              height: 16,
                              color: "#86efac",
                           }}
                        />
                        <CheckCircleIcon
                           style={{
                              position: "absolute",
                              top: "-4px",
                              right: "-4px",
                              width: 12,
                              height: 12,
                              color: "#86efac",
                              background: "var(--bg)",
                              borderRadius: "50%",
                           }}
                        />
                     </div>
                  </div>
               </div>
            );

         case "pattern-completion":
            return (
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                     gap: "8px",
                     width: "100%",
                  }}
               >
                  {/* Pattern: Home, Star, Home, ?, Star */}
                  <div
                     style={{
                        display: "flex",
                        gap: "6px",
                        alignItems: "center",
                        justifyContent: "center",
                     }}
                  >
                     <div
                        style={{
                           width: "30px",
                           height: "30px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                        }}
                     >
                        <HomeIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--accent)",
                           }}
                        />
                     </div>
                     <div
                        style={{
                           width: "30px",
                           height: "30px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                        }}
                     >
                        <StarIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--accent)",
                           }}
                        />
                     </div>
                     <div
                        style={{
                           width: "30px",
                           height: "30px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                        }}
                     >
                        <HomeIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--accent)",
                           }}
                        />
                     </div>
                     <div
                        style={{
                           width: "30px",
                           height: "30px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           background:
                              "linear-gradient(135deg, rgba(125, 211, 252, 0.2) 0%, rgba(125, 211, 252, 0.1) 100%)",
                           border: "2px dashed var(--accent)",
                           borderRadius: "4px",
                        }}
                     >
                        <span
                           style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "var(--accent)",
                           }}
                        >
                           ?
                        </span>
                     </div>
                     <div
                        style={{
                           width: "30px",
                           height: "30px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                        }}
                     >
                        <StarIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--accent)",
                           }}
                        />
                     </div>
                  </div>
                  {/* Correct answer highlighted */}
                  <div
                     style={{
                        display: "flex",
                        gap: "4px",
                        alignItems: "center",
                        justifyContent: "center",
                     }}
                  >
                     <div
                        style={{
                           width: "24px",
                           height: "24px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           background:
                              "linear-gradient(135deg, rgba(134, 239, 172, 0.2) 0%, rgba(134, 239, 172, 0.1) 100%)",
                           border: "2px solid #86efac",
                           borderRadius: "4px",
                           position: "relative",
                        }}
                     >
                        <HomeIcon
                           style={{
                              width: 16,
                              height: 16,
                              color: "#86efac",
                           }}
                        />
                        <CheckCircleIcon
                           style={{
                              position: "absolute",
                              top: "-4px",
                              right: "-4px",
                              width: 12,
                              height: 12,
                              color: "#86efac",
                              background: "var(--bg)",
                              borderRadius: "50%",
                           }}
                        />
                     </div>
                  </div>
               </div>
            );

         case "rotate-to-fit":
            return (
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     gap: "8px",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        width: "40px",
                        height: "40px",
                        background: "rgba(125, 211, 252, 0.2)",
                        border: "2px solid var(--accent)",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: "rotate(45deg)",
                        fontSize: "16px",
                     }}
                  >
                     ⬜
                  </div>
                  <div style={{ fontSize: "20px" }}>→</div>
                  <div
                     style={{
                        width: "40px",
                        height: "40px",
                        background: "rgba(134, 239, 172, 0.2)",
                        border: "2px solid var(--ok)",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                     }}
                  >
                     ⬜
                  </div>
               </div>
            );

         // Memory Games
         case "number-recall":
            return (
               <div
                  style={{
                     height: "60px",
                     borderRadius: "8px",
                     background:
                        "radial-gradient(220px 140px at 30% 30%, rgba(125, 211, 252, 0.14), transparent 55%)",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     fontSize: "24px",
                     fontWeight: 900,
                     letterSpacing: "4px",
                     color: "var(--text)",
                  }}
               >
                  4729
               </div>
            );

         case "emoji-memory":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(4, 1fr)",
                     gap: "3px",
                     width: "100%",
                     maxWidth: "100px",
                     margin: "0 auto",
                  }}
               >
                  {[
                     "🍎",
                     "?",
                     "?",
                     "⭐",
                     "?",
                     "🎵",
                     "?",
                     "?",
                     "?",
                     "🏀",
                     "?",
                     "?",
                     "?",
                     "?",
                     "?",
                     "?",
                  ].map((emoji, i) => (
                     <div
                        key={i}
                        style={{
                           aspectRatio: "1",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           background:
                              emoji !== "?"
                                 ? "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))"
                                 : "rgba(255, 255, 255, 0.05)",
                           borderRadius: "4px",
                           fontSize: "12px",
                           opacity: emoji === "?" ? 0.3 : 1,
                        }}
                     >
                        {emoji}
                     </div>
                  ))}
               </div>
            );

         case "card-flip":
         case "card-flip-memory":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(2, 1fr)",
                     gap: "4px",
                     width: "100%",
                     maxWidth: "80px",
                     margin: "0 auto",
                  }}
               >
                  {[
                     { id: 0, value: 1, flipped: true },
                     { id: 1, value: 2, flipped: false },
                     { id: 2, value: 2, flipped: true },
                     { id: 3, value: 1, flipped: false },
                  ].map((card) => (
                     <div
                        key={card.id}
                        style={{
                           aspectRatio: "1",
                           borderRadius: "6px",
                           background: card.flipped
                              ? "rgba(125, 211, 252, 0.2)"
                              : "rgba(15, 27, 51, 0.6)",
                           color: "var(--text)",
                           fontSize: "14px",
                           fontWeight: 700,
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           boxShadow: card.flipped
                              ? "0 0 8px rgba(125, 211, 252, 0.3)"
                              : "0 2px 4px rgba(0, 0, 0, 0.2)",
                        }}
                     >
                        {card.flipped ? card.value : "?"}
                     </div>
                  ))}
               </div>
            );

         // Speed Games
         case "fast-math":
            return (
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                     gap: "4px",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        fontSize: "20px",
                        fontWeight: 700,
                        color: "var(--text)",
                     }}
                  >
                     7 + 5 = ?
                  </div>
                  <div
                     style={{
                        display: "flex",
                        gap: "6px",
                     }}
                  >
                     {[10, 12, 14].map((ans) => (
                        <div
                           key={ans}
                           style={{
                              padding: "4px 8px",
                              background: "rgba(255, 255, 255, 0.08)",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              border:
                                 ans === 12
                                    ? "2px solid var(--ok)"
                                    : "1px solid var(--stroke)",
                           }}
                        >
                           {ans}
                        </div>
                     ))}
                  </div>
               </div>
            );

         case "reaction-test":
            return (
               <div
                  style={{
                     width: "60px",
                     height: "60px",
                     borderRadius: "50%",
                     background: "linear-gradient(135deg, #10b981, #059669)",
                     margin: "0 auto",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     fontSize: "24px",
                     boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)",
                  }}
               >
                  ✓
               </div>
            );

         case "click-green":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(3, 1fr)",
                     gap: "4px",
                     width: "100%",
                     maxWidth: "90px",
                     margin: "0 auto",
                  }}
               >
                  {[
                     "red",
                     "green",
                     "red",
                     "red",
                     "red",
                     "red",
                     "red",
                     "red",
                     "red",
                  ].map((color, i) => (
                     <div
                        key={i}
                        style={{
                           aspectRatio: "1",
                           background:
                              color === "green"
                                 ? "linear-gradient(135deg, #10b981, #059669)"
                                 : "rgba(239, 68, 68, 0.3)",
                           borderRadius: "4px",
                           border:
                              color === "green"
                                 ? "2px solid var(--ok)"
                                 : "1px solid var(--stroke)",
                        }}
                     />
                  ))}
               </div>
            );

         // Skill Games
         case "target-aim":
            return (
               <div
                  style={{
                     position: "relative",
                     width: "100px",
                     height: "100px",
                     margin: "0 auto",
                  }}
               >
                  <div
                     style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "80px",
                        height: "80px",
                        border: "2px dashed var(--stroke)",
                        borderRadius: "50%",
                     }}
                  />
                  <div
                     style={{
                        position: "absolute",
                        top: "30%",
                        left: "30%",
                        width: "20px",
                        height: "20px",
                        background: "var(--accent)",
                        borderRadius: "50%",
                        boxShadow: "0 0 12px rgba(125, 211, 252, 0.6)",
                     }}
                  />
               </div>
            );

         case "ball-balance":
            return (
               <div
                  style={{
                     position: "relative",
                     width: "100%",
                     height: "100px",
                     margin: "0 auto",
                     background:
                        "radial-gradient(320px 220px at 30% 30%, rgba(59, 130, 246, 0.1), transparent 55%)",
                     borderRadius: "8px",
                     border: "1px solid var(--stroke)",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                  }}
               >
                  {/* Center Zone */}
                  <div
                     style={{
                        position: "absolute",
                        width: "40px",
                        height: "25px",
                        border: "1px dashed rgba(54, 211, 153, 0.6)",
                        background: "rgba(54, 211, 153, 0.08)",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                     }}
                  />
                  {/* Platform */}
                  <div
                     style={{
                        position: "absolute",
                        width: "120px",
                        height: "9px",
                        border: "1px solid rgba(255, 255, 255, 0.14)",
                        background: "rgba(15, 27, 51, 0.55)",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                     }}
                  />
                  {/* Ball */}
                  <div
                     style={{
                        position: "absolute",
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background:
                           "radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.95), rgba(110, 168, 255, 0.55))",
                        border: "1px solid rgba(255, 255, 255, 0.22)",
                        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.35)",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, calc(-50% - 9px))",
                     }}
                  />
               </div>
            );

         // More Memory Games
         case "sound-memory":
            return (
               <div
                  style={{
                     display: "flex",
                     gap: "4px",
                     justifyContent: "center",
                     alignItems: "center",
                     width: "100%",
                  }}
               >
                  {[2, 1, 3].map((num, i) => {
                     const colors: Record<
                        number,
                        {
                           bg: string;
                           border: string;
                           text: string;
                        }
                     > = {
                        1: {
                           bg: "linear-gradient(135deg, rgba(110, 168, 255, 0.25), rgba(110, 168, 255, 0.15))",
                           border: "rgba(110, 168, 255, 0.6)",
                           text: "rgba(110, 168, 255, 0.9)",
                        },
                        2: {
                           bg: "linear-gradient(135deg, rgba(54, 211, 153, 0.25), rgba(54, 211, 153, 0.15))",
                           border: "rgba(54, 211, 153, 0.6)",
                           text: "rgba(54, 211, 153, 0.9)",
                        },
                        3: {
                           bg: "linear-gradient(135deg, rgba(251, 113, 133, 0.25), rgba(251, 113, 133, 0.15))",
                           border: "rgba(251, 113, 133, 0.6)",
                           text: "rgba(251, 113, 133, 0.9)",
                        },
                     };
                     const color = colors[num] || colors[1];
                     return (
                        <div
                           key={i}
                           style={{
                              width: "30px",
                              height: "30px",
                              borderRadius: "8px",
                              background: color.bg,
                              border: `2px solid ${color.border}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "14px",
                              fontWeight: "bold",
                              color: color.text,
                           }}
                        >
                           {num}
                        </div>
                     );
                  })}
               </div>
            );

         case "image-recall":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(3, 1fr)",
                     gap: "3px",
                     width: "100%",
                     maxWidth: "90px",
                     margin: "0 auto",
                  }}
               >
                  {["🧩", "🚀", "🌙", "🍎", "🎵", "📦", "⭐", "🐶", "🏀"].map(
                     (emoji, i) => {
                        const isInSequence = [1, 0, 2].includes(i);
                        const orderInSequence = [1, 0, 2].indexOf(i);
                        return (
                           <div
                              key={i}
                              style={{
                                 aspectRatio: "1",
                                 borderRadius: "6px",
                                 border: isInSequence
                                    ? "2px solid rgba(110, 168, 255, 0.6)"
                                    : "2px solid rgba(255, 255, 255, 0.1)",
                                 background: isInSequence
                                    ? "linear-gradient(135deg, rgba(110, 168, 255, 0.3), rgba(110, 168, 255, 0.1))"
                                    : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                                 boxShadow: isInSequence
                                    ? "0 4px 12px rgba(110, 168, 255, 0.18)"
                                    : "0 2px 4px rgba(0, 0, 0, 0.1)",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 fontSize: "16px",
                                 position: "relative",
                                 opacity: isInSequence ? 1 : 0.3,
                              }}
                           >
                              {isInSequence ? emoji : "?"}
                              {isInSequence && (
                                 <div
                                    style={{
                                       position: "absolute",
                                       right: "4px",
                                       top: "4px",
                                       width: "14px",
                                       height: "14px",
                                       borderRadius: "50%",
                                       background: "rgba(15, 27, 51, 0.8)",
                                       border:
                                          "1px solid rgba(255, 255, 255, 0.12)",
                                       display: "flex",
                                       alignItems: "center",
                                       justifyContent: "center",
                                       fontWeight: 900,
                                       fontSize: "8px",
                                       color: "rgba(232, 238, 252, 0.95)",
                                    }}
                                 >
                                    {orderInSequence + 1}
                                 </div>
                              )}
                           </div>
                        );
                     }
                  )}
               </div>
            );

         case "path-memory":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(5, 1fr)",
                     gap: "2px",
                     width: "100%",
                     maxWidth: "100px",
                     margin: "0 auto",
                  }}
               >
                  {Array.from({ length: 25 }).map((_, i) => {
                     const examplePath = [0, 1, 6, 7, 12];
                     const isInPath = examplePath.includes(i);
                     const orderInPath = examplePath.indexOf(i);
                     return (
                        <div
                           key={i}
                           style={{
                              aspectRatio: "1",
                              border: isInPath
                                 ? "2px solid rgba(110, 168, 255, 0.75)"
                                 : "1px solid rgba(255, 255, 255, 0.1)",
                              background: isInPath
                                 ? "rgba(110, 168, 255, 0.18)"
                                 : "rgba(15, 27, 51, 0.45)",
                              boxShadow: isInPath
                                 ? "0 0 12px rgba(110, 168, 255, 0.55)"
                                 : "0 2px 4px rgba(0, 0, 0, 0.1)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              position: "relative",
                           }}
                        >
                           {isInPath && (
                              <div
                                 style={{
                                    position: "absolute",
                                    bottom: "2px",
                                    right: "2px",
                                    width: "12px",
                                    height: "12px",
                                    borderRadius: "50%",
                                    background: "rgba(15, 27, 51, 0.62)",
                                    border:
                                       "1px solid rgba(255, 255, 255, 0.12)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 900,
                                    fontSize: "7px",
                                    color: "rgba(232, 238, 252, 0.95)",
                                    zIndex: 2,
                                 }}
                              >
                                 {orderInPath + 1}
                              </div>
                           )}
                        </div>
                     );
                  })}
               </div>
            );

         case "word-memory":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(3, 1fr)",
                     gap: "4px",
                     width: "100%",
                     maxWidth: "90px",
                     margin: "0 auto",
                  }}
               >
                  {[
                     "Apple",
                     "Beach",
                     "Cloud",
                     "Dance",
                     "Earth",
                     "Flame",
                     "Green",
                     "Happy",
                     "Image",
                  ].map((word, i) => {
                     // Example sequence: 1 → 0 → 2 (Beach → Apple → Cloud)
                     const exampleSequence = [1, 0, 2];
                     const isInSequence = exampleSequence.includes(i);
                     const orderInSequence = exampleSequence.indexOf(i);
                     return (
                        <div
                           key={i}
                           style={{
                              aspectRatio: "1",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: isInSequence
                                 ? "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.2))"
                                 : "rgba(15, 27, 51, 0.5)",
                              border: isInSequence
                                 ? "2px solid rgba(110, 168, 255, 0.8)"
                                 : "2px solid rgba(255, 255, 255, 0.1)",
                              borderRadius: "6px",
                              fontSize: "8px",
                              fontWeight: 600,
                              color: "var(--text)",
                              position: "relative",
                              opacity: isInSequence ? 1 : 0.5,
                           }}
                        >
                           {isInSequence && (
                              <div
                                 style={{
                                    position: "absolute",
                                    top: "2px",
                                    right: "2px",
                                    width: "12px",
                                    height: "12px",
                                    borderRadius: "50%",
                                    background: "var(--ok)",
                                    color: "#0b1220",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "7px",
                                    fontWeight: 700,
                                    zIndex: 2,
                                 }}
                              >
                                 {orderInSequence + 1}
                              </div>
                           )}
                           <span style={{ fontSize: "7px" }}>
                              {word.substring(0, 3)}
                           </span>
                        </div>
                     );
                  })}
               </div>
            );

         case "face-memory":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(3, 1fr)",
                     gap: "4px",
                     width: "100%",
                     maxWidth: "90px",
                     margin: "0 auto",
                  }}
               >
                  {[
                     { face: "😀", name: "Alex" },
                     { face: "😎", name: "Sam" },
                     { face: "🧑‍🦱", name: "Jordan" },
                     { face: "😊", name: "Lee" },
                     { face: "🤔", name: "Max" },
                     { face: "😴", name: "Zoe" },
                     { face: "😃", name: "Kim" },
                     { face: "😉", name: "Ray" },
                     { face: "🙂", name: "Ava" },
                  ].map((pair, i) => (
                     <div
                        key={i}
                        style={{
                           aspectRatio: "1",
                           display: "flex",
                           flexDirection: "column",
                           alignItems: "center",
                           justifyContent: "center",
                           background: "rgba(15, 27, 51, 0.5)",
                           border: "2px solid rgba(255, 255, 255, 0.1)",
                           borderRadius: "6px",
                           padding: "4px",
                           gap: "2px",
                        }}
                     >
                        <span style={{ fontSize: "14px", lineHeight: 1 }}>
                           {pair.face}
                        </span>
                        <span
                           style={{
                              fontSize: "6px",
                              fontWeight: 600,
                              color: "var(--text)",
                           }}
                        >
                           {pair.name}
                        </span>
                     </div>
                  ))}
               </div>
            );

         case "color-grid-memory":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(3, 1fr)",
                     gap: "4px",
                     width: "100%",
                     maxWidth: "90px",
                     margin: "0 auto",
                  }}
               >
                  {Array.from({ length: 9 }).map((_, idx) => {
                     const exampleSequence = [1, 4, 7];
                     const isInSequence = exampleSequence.includes(idx);
                     const sequenceIndex = exampleSequence.indexOf(idx);
                     const colors = [
                        "rgba(110, 168, 255, 0.9)",
                        "rgba(54, 211, 153, 0.9)",
                        "rgba(251, 191, 36, 0.9)",
                     ];

                     return (
                        <div
                           key={idx}
                           style={{
                              aspectRatio: "1",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background:
                                 isInSequence && sequenceIndex >= 0
                                    ? colors[sequenceIndex]
                                    : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                              border: "2px solid rgba(255, 255, 255, 0.1)",
                              borderRadius: "6px",
                              fontSize: "10px",
                              fontWeight: 600,
                              color: "white",
                           }}
                        >
                           {isInSequence && sequenceIndex >= 0
                              ? sequenceIndex + 1
                              : ""}
                        </div>
                     );
                  })}
               </div>
            );

         case "symbol-stack":
            return (
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column-reverse",
                     alignItems: "center",
                     gap: "4px",
                     width: "100%",
                     maxWidth: "60px",
                     margin: "0 auto",
                  }}
               >
                  {[
                     { Icon: StarIcon, name: "Star" },
                     { Icon: HeartIcon, name: "Heart" },
                     { Icon: HomeIcon, name: "Home" },
                  ].map(({ Icon, name }, idx) => (
                     <div
                        key={idx}
                        style={{
                           width: "100%",
                           height: "20px",
                           borderRadius: "6px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           background: "rgba(59, 130, 246, 0.9)",
                           border: "2px solid rgba(59, 130, 246, 0.9)",
                           color: "white",
                        }}
                     >
                        <Icon style={{ width: 14, height: 14 }} />
                     </div>
                  ))}
               </div>
            );

         // More Speed Games
         case "tap-counter":
            return (
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                     gap: "8px",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        position: "relative",
                        width: "80px",
                        height: "80px",
                     }}
                  >
                     {/* Circular Progress SVG */}
                     <svg
                        width="80"
                        height="80"
                        style={{
                           position: "absolute",
                           top: 0,
                           left: 0,
                           transform: "rotate(-90deg)",
                        }}
                     >
                        <circle
                           cx="40"
                           cy="40"
                           r="36"
                           fill="none"
                           stroke="rgba(59, 130, 246, 0.2)"
                           strokeWidth="4"
                        />
                        <circle
                           cx="40"
                           cy="40"
                           r="36"
                           fill="none"
                           stroke="var(--accent)"
                           strokeWidth="4"
                           strokeLinecap="round"
                           strokeDasharray={`${2 * Math.PI * 36}`}
                           strokeDashoffset={`${2 * Math.PI * 36 * 0.25}`}
                        />
                     </svg>
                     {/* Tap Button */}
                     <div
                        style={{
                           width: "100%",
                           height: "100%",
                           borderRadius: "50%",
                           background: "rgba(59, 130, 246, 0.15)",
                           display: "flex",
                           flexDirection: "column",
                           alignItems: "center",
                           justifyContent: "center",
                           border: "2px solid var(--accent)",
                        }}
                     >
                        <div
                           style={{
                              fontSize: "20px",
                              fontWeight: 900,
                              color: "var(--accent)",
                           }}
                        >
                           42
                        </div>
                        <div
                           style={{
                              fontSize: "8px",
                              fontWeight: 700,
                              color: "var(--muted)",
                              marginTop: "2px",
                           }}
                        >
                           TAP!
                        </div>
                     </div>
                  </div>
               </div>
            );

         case "typing-sprint":
            return (
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                     gap: "6px",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        padding: "8px 12px",
                        background: "rgba(255, 255, 255, 0.08)",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontFamily: "monospace",
                        color: "var(--text)",
                        border: "1px solid var(--stroke)",
                     }}
                  >
                     Type this
                  </div>
                  <div
                     style={{
                        fontSize: "10px",
                        color: "var(--muted)",
                     }}
                  >
                     WPM: 60
                  </div>
               </div>
            );

         case "whack-shape":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(3, 1fr)",
                     gap: "4px",
                     width: "100%",
                     maxWidth: "90px",
                     margin: "0 auto",
                  }}
               >
                  {["🔴", "🟢", "🔵", "🟡", "⭐", "🟣", "🔴", "🟢", "🔵"].map(
                     (shape, i) => (
                        <div
                           key={i}
                           style={{
                              aspectRatio: "1",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "rgba(255, 255, 255, 0.08)",
                              borderRadius: "6px",
                              fontSize: "16px",
                              border:
                                 i === 4
                                    ? "2px solid var(--ok)"
                                    : "1px solid var(--stroke)",
                           }}
                        >
                           {shape}
                        </div>
                     )
                  )}
               </div>
            );

         case "avoid-red":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(3, 1fr)",
                     gap: "4px",
                     width: "100%",
                     maxWidth: "90px",
                     margin: "0 auto",
                  }}
               >
                  {[
                     "green",
                     "green",
                     "red",
                     "green",
                     "green",
                     "green",
                     "green",
                     "red",
                     "green",
                  ].map((color, i) => (
                     <div
                        key={i}
                        style={{
                           aspectRatio: "1",
                           background:
                              color === "red"
                                 ? "linear-gradient(135deg, #ef4444, #dc2626)"
                                 : "linear-gradient(135deg, #10b981, #059669)",
                           borderRadius: "4px",
                           border:
                              color === "red"
                                 ? "2px solid #ef4444"
                                 : "1px solid var(--stroke)",
                        }}
                     />
                  ))}
               </div>
            );

         case "quick-compare":
            return (
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     gap: "12px",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        fontSize: "24px",
                        fontWeight: 700,
                        color: "var(--text)",
                     }}
                  >
                     15
                  </div>
                  <div
                     style={{
                        fontSize: "20px",
                        color: "var(--muted)",
                     }}
                  >
                     vs
                  </div>
                  <div
                     style={{
                        fontSize: "24px",
                        fontWeight: 700,
                        color: "var(--text)",
                     }}
                  >
                     23
                  </div>
               </div>
            );

         case "falling-objects":
            return (
               <div
                  style={{
                     position: "relative",
                     width: "100%",
                     height: "100px",
                     margin: "0 auto",
                  }}
               >
                  {[0, 1, 2].map((i) => (
                     <div
                        key={i}
                        style={{
                           position: "absolute",
                           left: `${30 + i * 30}%`,
                           top: `${20 + i * 30}%`,
                           width: "20px",
                           height: "20px",
                           background: "var(--accent)",
                           borderRadius: "50%",
                           boxShadow: "0 2px 8px rgba(125, 211, 252, 0.6)",
                        }}
                     />
                  ))}
               </div>
            );

         case "reflex-arrow":
            return (
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        fontSize: "32px",
                        transform: "rotate(90deg)",
                        color: "var(--accent)",
                     }}
                  >
                     →
                  </div>
               </div>
            );

         // More Skill Games
         case "line-tracer":
            return (
               <div
                  style={{
                     position: "relative",
                     width: "100%",
                     height: "100px",
                     margin: "0 auto",
                     background:
                        "radial-gradient(320px 220px at 30% 30%, rgba(59, 130, 246, 0.1), transparent 55%)",
                     borderRadius: "8px",
                     border: "1px solid var(--stroke)",
                  }}
               >
                  <svg
                     viewBox="0 0 100 100"
                     style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                     }}
                  >
                     {/* Glow effect */}
                     <path
                        d="M 5,50 Q 25,17 50,50 Q 75,83 95,50"
                        stroke="rgba(59, 130, 246, 0.2)"
                        strokeWidth="5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                     />
                     {/* Main path */}
                     <path
                        d="M 5,50 Q 25,17 50,50 Q 75,83 95,50"
                        stroke="rgba(59, 130, 246, 0.6)"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                     />
                     {/* Start marker */}
                     <circle
                        cx="5"
                        cy="50"
                        r="2"
                        fill="rgba(34, 197, 94, 0.9)"
                     />
                     {/* End marker */}
                     <circle
                        cx="95"
                        cy="50"
                        r="2"
                        fill="rgba(239, 68, 68, 0.9)"
                     />
                  </svg>
               </div>
            );

         case "timing-bar":
            return (
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                     gap: "8px",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        width: "100px",
                        height: "8px",
                        borderRadius: "999px",
                        background: "rgba(255, 255, 255, 0.08)",
                        position: "relative",
                        overflow: "visible",
                     }}
                  >
                     {/* Target Zone */}
                     <div
                        style={{
                           position: "absolute",
                           top: 0,
                           bottom: 0,
                           left: "35%",
                           width: "30%",
                           background: "rgba(34, 197, 94, 0.45)",
                           borderRadius: "999px",
                        }}
                     />
                     {/* Moving Bar */}
                     <div
                        style={{
                           position: "absolute",
                           top: "-4px",
                           width: "6px",
                           height: "16px",
                           borderRadius: "3px",
                           background:
                              "linear-gradient(180deg, rgba(59, 130, 246, 0.9), rgba(59, 130, 246, 0.55))",
                           boxShadow: "0 3px 7px rgba(0, 0, 0, 0.35)",
                           transform: "translateX(-50%)",
                           left: "50%",
                        }}
                     />
                  </div>
               </div>
            );

         case "stack-blocks":
            return (
               <div
                  style={{
                     position: "relative",
                     width: "100%",
                     height: "100px",
                     margin: "0 auto",
                     background:
                        "radial-gradient(320px 220px at 30% 30%, rgba(59, 130, 246, 0.1), transparent 55%)",
                     borderRadius: "8px",
                     border: "1px solid var(--stroke)",
                     display: "flex",
                     flexDirection: "column",
                     justifyContent: "flex-end",
                     alignItems: "center",
                  }}
               >
                  {/* Stacked Blocks */}
                  {[0, 1, 2].map((index) => (
                     <div
                        key={index}
                        style={{
                           position: "absolute",
                           bottom: `${index * 15}px`,
                           left: `${50 - index * 2}%`,
                           width: `${50 - index * 2}%`,
                           height: "15px",
                           background:
                              "linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(59, 130, 246, 0.6))",
                           border: "2px solid rgba(59, 130, 246, 0.9)",
                           borderRadius: "4px",
                           boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
                        }}
                     />
                  ))}
                  {/* Moving Block */}
                  <div
                     style={{
                        position: "absolute",
                        bottom: "45px",
                        left: "50%",
                        width: "44%",
                        height: "15px",
                        background:
                           "linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.7))",
                        border: "2px solid rgba(34, 197, 94, 1)",
                        borderRadius: "4px",
                        boxShadow: "0 3px 6px rgba(34, 197, 94, 0.5)",
                        transform: "translateX(-50%)",
                     }}
                  />
                  {/* Center Guide Line */}
                  <div
                     style={{
                        position: "absolute",
                        bottom: 0,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "1px",
                        height: "100%",
                        background: "rgba(255, 255, 255, 0.2)",
                     }}
                  />
               </div>
            );

         case "precision-drop":
            return (
               <div
                  style={{
                     position: "relative",
                     width: "100%",
                     height: "100px",
                     margin: "0 auto",
                     background:
                        "radial-gradient(320px 220px at 30% 30%, rgba(59, 130, 246, 0.1), transparent 55%)",
                     borderRadius: "8px",
                     border: "1px solid var(--stroke)",
                     display: "flex",
                     flexDirection: "column",
                     justifyContent: "flex-end",
                     alignItems: "center",
                  }}
               >
                  {/* Target */}
                  <div
                     style={{
                        position: "absolute",
                        bottom: "32px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "40px",
                        height: "7px",
                        background: "rgba(54,211,153,.22)",
                        border: "2px solid rgba(54,211,153,.65)",
                        borderRadius: "2px",
                     }}
                  />
                  {/* Object */}
                  <div
                     style={{
                        position: "absolute",
                        top: "35px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        background: "rgba(110,168,255,.85)",
                        border: "1px solid rgba(255,255,255,.14)",
                        boxShadow: "0 0 0 2px rgba(110,168,255,.25)",
                     }}
                  />
                  {/* Guide Line */}
                  <div
                     style={{
                        position: "absolute",
                        top: "49px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "1px",
                        height: "calc(100% - 49px - 32px)",
                        background: "rgba(110,168,255,.25)",
                     }}
                  />
               </div>
            );

         case "drag-sort":
         case "drag-and-drop-sort":
            return (
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     gap: "8px",
                     width: "100%",
                  }}
               >
                  {/* Items to drag */}
                  <div
                     style={{
                        display: "flex",
                        gap: "4px",
                        justifyContent: "center",
                        flexWrap: "wrap",
                        padding: "8px",
                        background: "rgba(59, 130, 246, 0.1)",
                        borderRadius: "6px",
                     }}
                  >
                     {[1, 2, 3].map((num) => (
                        <div
                           key={num}
                           style={{
                              padding: "6px 10px",
                              background:
                                 "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                              border: "2px solid rgba(59, 130, 246, 0.4)",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: "var(--text)",
                              minWidth: "30px",
                              textAlign: "center",
                           }}
                        >
                           {num}
                        </div>
                     ))}
                  </div>
                  {/* Category boxes */}
                  <div
                     style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "4px",
                     }}
                  >
                     {["A", "B", "C"].map((cat, idx) => (
                        <div
                           key={cat}
                           style={{
                              background: [
                                 "rgba(59, 130, 246, 0.2)",
                                 "rgba(34, 197, 94, 0.2)",
                                 "rgba(168, 85, 247, 0.2)",
                              ][idx],
                              border: "2px dashed rgba(255, 255, 255, 0.3)",
                              borderRadius: "6px",
                              padding: "8px",
                              minHeight: "30px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              fontWeight: 700,
                           }}
                        >
                           {cat}
                        </div>
                     ))}
                  </div>
               </div>
            );

         case "speed-drawing":
            return (
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                     gap: "6px",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "var(--accent)",
                        marginBottom: "4px",
                     }}
                  >
                     Target: Circle
                  </div>
                  <div
                     style={{
                        width: "100%",
                        maxWidth: "100px",
                        height: "60px",
                        background: "var(--card)",
                        border: "2px dashed rgba(59, 130, 246, 0.3)",
                        borderRadius: "8px",
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                     }}
                  >
                     {/* Faded target shape outline */}
                     <svg
                        width="100%"
                        height="100%"
                        style={{
                           position: "absolute",
                           top: 0,
                           left: 0,
                        }}
                     >
                        <circle
                           cx="50%"
                           cy="50%"
                           r="25"
                           fill="none"
                           stroke="rgba(59, 130, 246, 0.3)"
                           strokeWidth="2"
                           strokeDasharray="4,4"
                        />
                     </svg>
                  </div>
               </div>
            );

         case "one-hand-mode":
            return (
               <div
                  style={{
                     position: "relative",
                     width: "100%",
                     height: "100px",
                     margin: "0 auto",
                     background: "var(--card)",
                     borderRadius: "8px",
                     border: "1px solid var(--stroke)",
                     overflow: "hidden",
                     display: "flex",
                     alignItems: "flex-end",
                     justifyContent: "flex-start",
                     padding: "6px",
                  }}
               >
                  {/* Ground line */}
                  <div
                     style={{
                        position: "absolute",
                        bottom: "30px",
                        left: 0,
                        right: 0,
                        height: "2px",
                        background: "rgba(255, 255, 255, 0.1)",
                     }}
                  />
                  {/* Player */}
                  <div
                     style={{
                        position: "absolute",
                        left: "45px",
                        bottom: "30px",
                        width: "13px",
                        height: "13px",
                        background: "#6ea8ff",
                        borderRadius: "2px",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                        zIndex: 10,
                     }}
                  />
                  {/* Obstacles */}
                  <div
                     style={{
                        position: "absolute",
                        left: "100px",
                        bottom: "30px",
                        width: "15px",
                        height: "15px",
                        background: "#fb7185",
                        borderRadius: "2px",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                     }}
                  />
                  <div
                     style={{
                        position: "absolute",
                        left: "175px",
                        bottom: "30px",
                        width: "15px",
                        height: "15px",
                        background: "#fb7185",
                        borderRadius: "2px",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                     }}
                  />
               </div>
            );

         case "cursor-maze":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(4, 1fr)",
                     gap: "2px",
                     width: "100%",
                     maxWidth: "80px",
                     margin: "0 auto",
                  }}
               >
                  {Array.from({ length: 16 }).map((_, i) => {
                     const isPath = [0, 1, 4, 5, 8, 9, 12, 13].includes(i);
                     return (
                        <div
                           key={i}
                           style={{
                              aspectRatio: "1",
                              background: isPath
                                 ? "rgba(134, 239, 172, 0.3)"
                                 : "rgba(0, 0, 0, 0.3)",
                              borderRadius: "2px",
                              position: "relative",
                           }}
                        >
                           {i === 0 && (
                              <div
                                 style={{
                                    position: "absolute",
                                    top: "50%",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)",
                                    width: "6px",
                                    height: "6px",
                                    background: "var(--accent)",
                                    borderRadius: "50%",
                                 }}
                              />
                           )}
                        </div>
                     );
                  })}
               </div>
            );

         // Logic Games
         case "circuit-path":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(3, 1fr)",
                     gap: "4px",
                     width: "100%",
                     maxWidth: "90px",
                     margin: "0 auto",
                  }}
               >
                  {Array.from({ length: 9 }).map((_, i) => {
                     const row = Math.floor(i / 3);
                     const col = i % 3;
                     const isStart = row === 0 && col === 0;
                     const isEnd = row === 2 && col === 2;
                     const inPath =
                        (row === 0 && col === 1) ||
                        (row === 1 && col === 1) ||
                        (row === 1 && col === 2) ||
                        (row === 2 && col === 2);

                     return (
                        <div
                           key={i}
                           style={{
                              aspectRatio: "1",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              border: `2px solid ${
                                 isStart
                                    ? "rgba(34, 197, 94, 0.6)"
                                    : isEnd
                                    ? "rgba(239, 68, 68, 0.6)"
                                    : inPath
                                    ? "var(--accent)"
                                    : "var(--stroke)"
                              }`,
                              background: isStart
                                 ? "linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.15) 100%)"
                                 : isEnd
                                 ? "linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.15) 100%)"
                                 : inPath
                                 ? "linear-gradient(135deg, rgba(125, 211, 252, 0.3) 0%, rgba(125, 211, 252, 0.15) 100%)"
                                 : "linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)",
                              borderRadius: "6px",
                              padding: "4px",
                           }}
                        >
                           {isStart ? (
                              <span
                                 style={{
                                    fontSize: "6px",
                                    color: "#22c55e",
                                    fontWeight: 600,
                                 }}
                              >
                                 S
                              </span>
                           ) : isEnd ? (
                              <TrophyIcon
                                 style={{
                                    width: 12,
                                    height: 12,
                                    color: "#ef4444",
                                 }}
                              />
                           ) : inPath ? (
                              <CircleStackIcon
                                 style={{
                                    width: 12,
                                    height: 12,
                                    color: "var(--accent)",
                                 }}
                              />
                           ) : (
                              <CircleStackIcon
                                 style={{
                                    width: 12,
                                    height: 12,
                                    color: "var(--muted)",
                                    opacity: 0.3,
                                 }}
                              />
                           )}
                        </div>
                     );
                  })}
               </div>
            );

         case "mirror-match":
            return (
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     gap: "8px",
                     alignItems: "center",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "3px",
                        width: "60px",
                     }}
                  >
                     {["🔴", "🔵", "🟢", "🟡"].map((shape) => (
                        <div
                           key={shape}
                           style={{
                              aspectRatio: "1",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "rgba(255, 255, 255, 0.08)",
                              borderRadius: "4px",
                              fontSize: "14px",
                           }}
                        >
                           {shape}
                        </div>
                     ))}
                  </div>
                  <div
                     style={{
                        fontSize: "12px",
                        color: "var(--muted)",
                        fontWeight: 600,
                     }}
                  >
                     Mirror
                  </div>
                  <div
                     style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "3px",
                        width: "60px",
                     }}
                  >
                     {["🟡", "🟢", "🔵", "🔴"].map((shape) => (
                        <div
                           key={shape}
                           style={{
                              aspectRatio: "1",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "rgba(255, 255, 255, 0.08)",
                              borderRadius: "4px",
                              fontSize: "14px",
                           }}
                        >
                           {shape}
                        </div>
                     ))}
                  </div>
               </div>
            );

         case "sequence-arrows":
            return (
               <div
                  style={{
                     display: "flex",
                     gap: "6px",
                     justifyContent: "center",
                     alignItems: "center",
                     width: "100%",
                  }}
               >
                  {[
                     { icon: "↑", isQuestion: false },
                     { icon: "→", isQuestion: false },
                     { icon: "↓", isQuestion: false },
                     { icon: "?", isQuestion: true },
                  ].map((item, i) => (
                     <div
                        key={i}
                        style={{
                           width: "32px",
                           height: "32px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           background: item.isQuestion
                              ? "rgba(125, 211, 252, 0.2)"
                              : "rgba(255, 255, 255, 0.05)",
                           borderRadius: "6px",
                           fontSize: item.isQuestion ? "18px" : "20px",
                           fontWeight: 700,
                           border: item.isQuestion
                              ? "2px solid var(--accent)"
                              : "1px solid var(--stroke)",
                           color: item.isQuestion
                              ? "var(--accent)"
                              : "var(--text)",
                        }}
                     >
                        {item.icon}
                     </div>
                  ))}
               </div>
            );

         case "block-fill":
            return (
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(3, 1fr)",
                     gap: "2px",
                     width: "100%",
                     maxWidth: "90px",
                     margin: "0 auto",
                     background: "var(--stroke)",
                     padding: "2px",
                     borderRadius: "4px",
                  }}
               >
                  {[
                     "filled",
                     "empty",
                     "filled",
                     "filled",
                     "filled",
                     "empty",
                     "empty",
                     "filled",
                     "filled",
                  ].map((state, i) => (
                     <div
                        key={i}
                        style={{
                           aspectRatio: "1",
                           background:
                              state === "filled"
                                 ? "rgba(125, 211, 252, 0.3)"
                                 : "rgba(255, 255, 255, 0.05)",
                           borderRadius: "3px",
                           border:
                              state === "empty"
                                 ? "1px dashed var(--stroke)"
                                 : "1px solid var(--accent)",
                        }}
                     />
                  ))}
               </div>
            );

         // Final Games
         case "mixed-quiz":
         case "survival-mode":
         case "boss-puzzle":
         case "time-challenge":
         case "final-test":
            return (
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                     gap: "8px",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        fontSize: "32px",
                        opacity: 0.4,
                     }}
                  >
                     🏆
                  </div>
                  <div
                     style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "4px",
                        width: "100%",
                        maxWidth: "90px",
                     }}
                  >
                     {["🧩", "🧠", "⚡", "🎯", "✓", "⭐"].map((icon, i) => (
                        <div
                           key={i}
                           style={{
                              aspectRatio: "1",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "rgba(255, 255, 255, 0.06)",
                              borderRadius: "4px",
                              fontSize: "14px",
                           }}
                        >
                           {icon}
                        </div>
                     ))}
                  </div>
               </div>
            );

         // Default fallback - use category icon instead of emoji
         default:
            return (
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     width: "100%",
                     opacity: 0.3,
                     transform: "scale(2)",
                  }}
               >
                  {isFinalGame ? (
                     <TrophyIcon style={{ width: 40, height: 40 }} />
                  ) : (
                     <PuzzlePieceIcon style={{ width: 40, height: 40 }} />
                  )}
               </div>
            );
      }
   };

   return (
      <div
         style={{
            width: "100%",
            height: "180px",
            background: isFinalGame
               ? `linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(234, 179, 8, 0.1) 100%)`
               : `linear-gradient(135deg, rgba(125, 211, 252, 0.15) 0%, rgba(134, 239, 172, 0.15) 100%)`,
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            position: "relative",
            overflow: "hidden",
         }}
      >
         {renderPreview()}
      </div>
   );
}
