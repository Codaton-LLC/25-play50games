"use client";

import { CommandLineIcon } from "@heroicons/react/24/outline";

export interface KeyboardControl {
   keys: string[];
   label: string;
   description?: string;
}

interface KeyboardControlsProps {
   controls: KeyboardControl[];
   className?: string;
}

export default function KeyboardControls({
   controls,
   className = "",
}: KeyboardControlsProps) {
   if (!controls || controls.length === 0) return null;

   return (
      <div
         className={`keyboard-controls ${className}`}
         style={{
            marginTop: "16px",
            padding: "16px",
            background: "rgba(125, 211, 252, 0.08)",
            border: "1px solid var(--stroke)",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
         }}
      >
         <div
            style={{
               display: "flex",
               alignItems: "center",
               gap: "8px",
               fontSize: "0.875rem",
               fontWeight: 600,
               color: "var(--text)",
            }}
         >
            <CommandLineIcon
               style={{
                  width: 18,
                  height: 18,
                  color: "var(--accent)",
               }}
            />
            Keyboard Controls
         </div>
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               gap: "8px",
               fontSize: "0.875rem",
               color: "var(--muted)",
            }}
         >
            {controls.map((control, index) => (
               <div
                  key={index}
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "10px",
                  }}
               >
                  <kbd
                     style={{
                        background: "rgba(255, 255, 255, 0.1)",
                        border: "1px solid var(--stroke)",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        fontSize: "0.75rem",
                        fontFamily: "monospace",
                        minWidth: "70px",
                        textAlign: "center",
                        fontWeight: 500,
                     }}
                  >
                     {control.keys.join(" / ")}
                  </kbd>
                  <div
                     style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                     }}
                  >
                     <span>{control.label}</span>
                     {control.description && (
                        <span
                           style={{
                              fontSize: "0.75rem",
                              color: "var(--muted)",
                              opacity: 0.8,
                           }}
                        >
                           {control.description}
                        </span>
                     )}
                  </div>
               </div>
            ))}
         </div>
      </div>
   );
}
