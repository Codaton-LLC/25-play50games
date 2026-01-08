"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
   UserIcon,
   ArrowRightOnRectangleIcon,
   TrophyIcon,
   CheckBadgeIcon,
   UserCircleIcon,
} from "@heroicons/react/24/outline";

interface HeaderProps {
   showSubtitle?: boolean;
   onShowLoginModal?: () => void;
   onShowRegisterModal?: () => void;
}

export default function Header({
   showSubtitle = true,
   onShowLoginModal,
   onShowRegisterModal,
}: HeaderProps) {
   const { user, isAuthenticated, logout } = useAuth();
   const [showUserMenu, setShowUserMenu] = useState(false);

   // Close user menu when clicking outside
   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         const target = event.target as HTMLElement;
         if (
            showUserMenu &&
            !target.closest("[data-user-menu]") &&
            !target.closest("[data-user-button]")
         ) {
            setShowUserMenu(false);
         }
      };

      if (showUserMenu) {
         document.addEventListener("mousedown", handleClickOutside);
         return () => {
            document.removeEventListener("mousedown", handleClickOutside);
         };
      }
   }, [showUserMenu]);

   return (
      <header>
         {/* Header with Logo and User Profile */}
         <div
            style={{
               display: "flex",
               justifyContent: "space-between",
               alignItems: "center",
               marginBottom: showSubtitle ? "1rem" : "0",
               flexWrap: "wrap",
               gap: "1rem",
            }}
         >
            {/* Logo on the left */}
            <div>
               <h1 style={{ margin: 0, fontSize: "2.5rem" }}>Play50Games</h1>
               {showSubtitle && (
                  <p
                     style={{
                        margin: "4px 0 0",
                        fontSize: "14px",
                        color: "var(--muted)",
                     }}
                  >
                     Complete all games to earn your certificate!
                  </p>
               )}
            </div>

            {/* User Profile on the right */}
            {isAuthenticated && user ? (
               <div
                  style={{
                     position: "relative",
                     display: "flex",
                     alignItems: "center",
                     gap: "0.5rem",
                  }}
               >
                  <button
                     data-user-button
                     onClick={() => setShowUserMenu(!showUserMenu)}
                     style={{
                        padding: "8px 16px",
                        backgroundColor: "rgb(11, 16, 32)",
                        border: "1px solid rgba(134, 239, 172, 0.3)",
                        borderRadius: "20px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        transition: "all 0.2s ease",
                     }}
                     onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                           "rgb(11, 16, 32)";
                        e.currentTarget.style.borderColor =
                           "rgba(134, 239, 172, 0.5)";
                     }}
                     onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                           "rgb(11, 16, 32)";
                        e.currentTarget.style.borderColor =
                           "rgba(134, 239, 172, 0.3)";
                     }}
                  >
                     <UserIcon
                        style={{
                           width: 20,
                           height: 20,
                           color: "var(--secondary)",
                        }}
                     />
                     <span
                        style={{
                           color: "var(--text)",
                           fontSize: "14px",
                           fontWeight: 600,
                        }}
                     >
                        My profile
                     </span>
                  </button>

                  {showUserMenu && (
                     <div
                        data-user-menu
                        style={{
                           position: "absolute",
                           top: "calc(100% + 8px)",
                           right: 0,
                           backgroundColor: "rgb(11, 16, 32)",
                           border: "1px solid var(--stroke)",
                           borderRadius: "12px",
                           padding: "8px",
                           minWidth: "200px",
                           boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
                           zIndex: 1000,
                        }}
                     >
                        <div
                           style={{
                              padding: "12px 16px",
                              borderBottom: "1px solid var(--stroke)",
                              marginBottom: "4px",
                           }}
                        >
                           <div
                              style={{
                                 fontWeight: "bold",
                                 color: "var(--text)",
                                 fontSize: "14px",
                                 marginBottom: "4px",
                              }}
                           >
                              {user.display_name || user.email}
                           </div>
                           <div
                              style={{
                                 color: "var(--muted)",
                                 fontSize: "12px",
                              }}
                           >
                              Your progress is saved
                           </div>
                        </div>
                        <Link
                           href="/progress"
                           onClick={() => setShowUserMenu(false)}
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              padding: "12px 16px",
                              color: "var(--text)",
                              textDecoration: "none",
                              borderRadius: "8px",
                              transition: "all 0.2s ease",
                              cursor: "pointer",
                           }}
                           onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(255, 255, 255, 0.08)";
                           }}
                           onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "transparent";
                           }}
                        >
                           <TrophyIcon style={{ width: 20, height: 20 }} />
                           <span style={{ fontSize: "14px" }}>
                              View Progress
                           </span>
                        </Link>
                        <Link
                           href="/certificate"
                           onClick={() => setShowUserMenu(false)}
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              padding: "12px 16px",
                              color: "var(--text)",
                              textDecoration: "none",
                              borderRadius: "8px",
                              transition: "all 0.2s ease",
                              cursor: "pointer",
                           }}
                           onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(255, 255, 255, 0.08)";
                           }}
                           onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "transparent";
                           }}
                        >
                           <CheckBadgeIcon style={{ width: 20, height: 20 }} />
                           <span style={{ fontSize: "14px" }}>
                              Certificate
                           </span>
                        </Link>
                        <button
                           onClick={() => {
                              setShowUserMenu(false);
                              // Add navigation to account page if exists
                           }}
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              padding: "12px 16px",
                              color: "var(--text)",
                              backgroundColor: "transparent",
                              border: "none",
                              width: "100%",
                              textAlign: "left",
                              borderRadius: "8px",
                              cursor: "pointer",
                              fontSize: "14px",
                              transition: "all 0.2s ease",
                           }}
                           onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(255, 255, 255, 0.08)";
                           }}
                           onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "transparent";
                           }}
                        >
                           <UserCircleIcon style={{ width: 20, height: 20 }} />
                           <span>My Account</span>
                        </button>
                        <div
                           style={{
                              borderTop: "1px solid var(--stroke)",
                              marginTop: "4px",
                              paddingTop: "4px",
                           }}
                        >
                           <button
                              onClick={() => {
                                 setShowUserMenu(false);
                                 logout();
                              }}
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "12px",
                                 padding: "12px 16px",
                                 color: "var(--warn)",
                                 backgroundColor: "transparent",
                                 border: "none",
                                 width: "100%",
                                 textAlign: "left",
                                 borderRadius: "8px",
                                 cursor: "pointer",
                                 fontSize: "14px",
                                 transition: "all 0.2s ease",
                              }}
                              onMouseEnter={(e) => {
                                 e.currentTarget.style.backgroundColor =
                                    "rgba(252, 165, 165, 0.15)";
                              }}
                              onMouseLeave={(e) => {
                                 e.currentTarget.style.backgroundColor =
                                    "transparent";
                              }}
                           >
                              <ArrowRightOnRectangleIcon
                                 style={{ width: 20, height: 20 }}
                              />
                              <span>Logout</span>
                           </button>
                        </div>
                     </div>
                  )}
               </div>
            ) : null}
         </div>

         {/* Auth Section for non-authenticated users */}
         {!isAuthenticated && onShowLoginModal && onShowRegisterModal && (
            <div
               style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid var(--stroke)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1rem",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "0.5rem",
                  }}
               >
                  <span style={{ fontWeight: "bold", color: "var(--text)" }}>
                     Playing as Guest
                  </span>
                  <span
                     style={{ color: "var(--muted)", fontSize: "0.9rem" }}
                  >
                     (Progress saved locally)
                  </span>
               </div>
               <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                     onClick={onShowLoginModal}
                     style={{
                        padding: "9px 16px",
                        backgroundColor: "rgba(125, 211, 252, 0.14)",
                        color: "var(--accent)",
                        border: "1px solid rgba(125, 211, 252, 0.35)",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "14px",
                        transition: "all 0.2s ease",
                     }}
                     onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                           "rgba(125, 211, 252, 0.24)";
                        e.currentTarget.style.borderColor =
                           "rgba(125, 211, 252, 0.5)";
                     }}
                     onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                           "rgba(125, 211, 252, 0.14)";
                        e.currentTarget.style.borderColor =
                           "rgba(125, 211, 252, 0.35)";
                     }}
                  >
                     Login
                  </button>
                  <button
                     onClick={onShowRegisterModal}
                     style={{
                        padding: "9px 16px",
                        backgroundColor: "rgba(134, 239, 172, 0.14)",
                        color: "var(--secondary)",
                        border: "1px solid rgba(134, 239, 172, 0.35)",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "14px",
                        transition: "all 0.2s ease",
                     }}
                     onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                           "rgba(134, 239, 172, 0.24)";
                        e.currentTarget.style.borderColor =
                           "rgba(134, 239, 172, 0.5)";
                     }}
                     onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                           "rgba(134, 239, 172, 0.14)";
                        e.currentTarget.style.borderColor =
                           "rgba(134, 239, 172, 0.35)";
                     }}
                  >
                     Register
                  </button>
               </div>
            </div>
         )}
      </header>
   );
}
