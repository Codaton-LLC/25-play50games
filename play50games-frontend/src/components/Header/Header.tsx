"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { ARCADE_ENABLED } from "@/arcade3d/flags";
import styles from "./Header.module.css";
import {
   UserIcon,
   ArrowRightOnRectangleIcon,
   TrophyIcon,
   CheckBadgeIcon,
   UserCircleIcon,
   ShieldCheckIcon,
   QuestionMarkCircleIcon,
   EnvelopeIcon,
} from "@heroicons/react/24/outline";

interface HeaderProps {
   showSubtitle?: boolean;
   onShowLoginModal?: () => void;
   onShowRegisterModal?: () => void;
   /** links to the game collections ("Classic 50", "3D Arcade") under the logo row */
   showPlatformNav?: boolean;
}

export default function Header({
   showSubtitle = true,
   onShowLoginModal,
   onShowRegisterModal,
   showPlatformNav = true,
}: HeaderProps) {
   const { user, isAuthenticated, logout } = useAuth();
   const [showUserMenu, setShowUserMenu] = useState(false);
   const [isMobile, setIsMobile] = useState(false);

   // Check if mobile
   useEffect(() => {
      const checkMobile = () => {
         setIsMobile(window.innerWidth < 640);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
   }, []);

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
               flexDirection: isMobile ? "column" : "row",
               justifyContent: isMobile ? "center" : "space-between",
               alignItems: isMobile ? "center" : "center",
               marginBottom: showSubtitle ? "1rem" : "0",
               flexWrap: "wrap",
               gap: "1rem",
            }}
         >
            {/* Logo on the left */}
            <div
               style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMobile ? "center" : "flex-start",
                  textAlign: isMobile ? "center" : "left",
               }}
            >
               <Link href="/" style={{ display: "inline-block" }}>
                  <Image
                     src="/images/logo/play50games.png"
                     alt="Play50Games"
                     width={200}
                     height={60}
                     style={{
                        height: "auto",
                        width: "auto",
                        maxHeight: "200px",
                        objectFit: "contain",
                     }}
                     priority
                  />
               </Link>
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

            {/* User Profile on the right (when authenticated) */}
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
                              color: "#eab308",
                              textDecoration: "none",
                              borderRadius: "8px",
                              transition: "all 0.2s ease",
                              cursor: "pointer",
                           }}
                           onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(234, 179, 8, 0.15)";
                           }}
                           onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "transparent";
                           }}
                        >
                           <CheckBadgeIcon style={{ width: 20, height: 20 }} />
                           <span style={{ fontSize: "14px" }}>Certificate</span>
                        </Link>
                        <Link
                           href="/verify"
                           onClick={() => setShowUserMenu(false)}
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              padding: "12px 16px",
                              color: "#7dd3fc",
                              textDecoration: "none",
                              borderRadius: "8px",
                              transition: "all 0.2s ease",
                              cursor: "pointer",
                           }}
                           onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(125, 211, 252, 0.15)";
                           }}
                           onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "transparent";
                           }}
                        >
                           <ShieldCheckIcon style={{ width: 20, height: 20 }} />
                           <span style={{ fontSize: "14px" }}>
                              Verify Certificate
                           </span>
                        </Link>
                        <Link
                           href="/faq"
                           onClick={() => setShowUserMenu(false)}
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              padding: "12px 16px",
                              color: "#a78bfa",
                              textDecoration: "none",
                              borderRadius: "8px",
                              transition: "all 0.2s ease",
                              cursor: "pointer",
                           }}
                           onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(167, 139, 250, 0.15)";
                           }}
                           onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "transparent";
                           }}
                        >
                           <QuestionMarkCircleIcon
                              style={{ width: 20, height: 20 }}
                           />
                           <span style={{ fontSize: "14px" }}>FAQ</span>
                        </Link>
                        <Link
                           href="/contact-us"
                           onClick={() => setShowUserMenu(false)}
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              padding: "12px 16px",
                              color: "#f472b6",
                              textDecoration: "none",
                              borderRadius: "8px",
                              transition: "all 0.2s ease",
                              cursor: "pointer",
                           }}
                           onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(244, 114, 182, 0.15)";
                           }}
                           onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "transparent";
                           }}
                        >
                           <EnvelopeIcon style={{ width: 20, height: 20 }} />
                           <span style={{ fontSize: "14px" }}>Contact Us</span>
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
            ) : (
               /* Login/Register section on the right (when not authenticated) */
               onShowLoginModal &&
               onShowRegisterModal && (
                  <div
                     style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isMobile ? "center" : "flex-end",
                        gap: "0.75rem",
                        width: isMobile ? "100%" : "auto",
                     }}
                  >
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "0.5rem",
                           flexWrap: "wrap",
                           justifyContent: isMobile ? "center" : "flex-end",
                           width: isMobile ? "100%" : "auto",
                        }}
                     >
                        <span
                           style={{
                              color: "var(--muted)",
                              fontSize: "14px",
                              textAlign: isMobile ? "center" : "right",
                           }}
                        >
                           Login or register to save your progress
                        </span>
                     </div>
                     <div
                        className="header-buttons-container"
                        style={{
                           display: "flex",
                           gap: "0.5rem",
                           flexWrap: "wrap",
                           width: isMobile ? "100%" : "auto",
                           justifyContent: isMobile ? "center" : "flex-end",
                        }}
                     >
                        <Link
                           href="/certificate"
                           style={{
                              padding: "9px 16px",
                              backgroundColor: "rgba(234, 179, 8, 0.14)",
                              color: "#eab308",
                              border: "1px solid rgba(234, 179, 8, 0.35)",
                              cursor: "pointer",
                              fontWeight: "600",
                              fontSize: "14px",
                              transition: "all 0.2s ease",
                              borderRadius: "8px",
                              textDecoration: "none",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              flex: isMobile ? "1" : "none",
                              minWidth: isMobile ? "0" : "auto",
                           }}
                           onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(234, 179, 8, 0.24)";
                              e.currentTarget.style.borderColor =
                                 "rgba(234, 179, 8, 0.5)";
                           }}
                           onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(234, 179, 8, 0.14)";
                              e.currentTarget.style.borderColor =
                                 "rgba(234, 179, 8, 0.35)";
                           }}
                        >
                           <CheckBadgeIcon style={{ width: 16, height: 16 }} />
                           Certificates
                        </Link>
                        <Link
                           href="/verify"
                           style={{
                              padding: "9px 16px",
                              backgroundColor: "rgba(125, 211, 252, 0.14)",
                              color: "#7dd3fc",
                              border: "1px solid rgba(125, 211, 252, 0.35)",
                              cursor: "pointer",
                              fontWeight: "600",
                              fontSize: "14px",
                              transition: "all 0.2s ease",
                              borderRadius: "8px",
                              textDecoration: "none",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              flex: isMobile ? "1" : "none",
                              minWidth: isMobile ? "0" : "auto",
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
                           <ShieldCheckIcon style={{ width: 16, height: 16 }} />
                           Verify
                        </Link>
                        <Link
                           href="/faq"
                           style={{
                              padding: "9px 16px",
                              backgroundColor: "rgba(167, 139, 250, 0.14)",
                              color: "#a78bfa",
                              border: "1px solid rgba(167, 139, 250, 0.35)",
                              cursor: "pointer",
                              fontWeight: "600",
                              fontSize: "14px",
                              transition: "all 0.2s ease",
                              borderRadius: "8px",
                              textDecoration: "none",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              flex: isMobile ? "1" : "none",
                              minWidth: isMobile ? "0" : "auto",
                           }}
                           onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(167, 139, 250, 0.24)";
                              e.currentTarget.style.borderColor =
                                 "rgba(167, 139, 250, 0.5)";
                           }}
                           onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(167, 139, 250, 0.14)";
                              e.currentTarget.style.borderColor =
                                 "rgba(167, 139, 250, 0.35)";
                           }}
                        >
                           <QuestionMarkCircleIcon
                              style={{ width: 16, height: 16 }}
                           />
                           FAQ
                        </Link>
                        <Link
                           href="/contact-us"
                           style={{
                              padding: "9px 16px",
                              backgroundColor: "rgba(244, 114, 182, 0.14)",
                              color: "#f472b6",
                              border: "1px solid rgba(244, 114, 182, 0.35)",
                              cursor: "pointer",
                              fontWeight: "600",
                              fontSize: "14px",
                              transition: "all 0.2s ease",
                              borderRadius: "8px",
                              textDecoration: "none",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              flex: isMobile ? "1" : "none",
                              minWidth: isMobile ? "0" : "auto",
                           }}
                           onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(244, 114, 182, 0.24)";
                              e.currentTarget.style.borderColor =
                                 "rgba(244, 114, 182, 0.5)";
                           }}
                           onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(244, 114, 182, 0.14)";
                              e.currentTarget.style.borderColor =
                                 "rgba(244, 114, 182, 0.35)";
                           }}
                        >
                           <EnvelopeIcon style={{ width: 16, height: 16 }} />
                           Contact
                        </Link>
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
                              borderRadius: "8px",
                              flex: isMobile ? "1" : "none",
                              minWidth: isMobile ? "0" : "auto",
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
                              borderRadius: "8px",
                              flex: isMobile ? "1" : "none",
                              minWidth: isMobile ? "0" : "auto",
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
               )
            )}
         </div>

         {showPlatformNav && (
            <nav aria-label="Platform" className={styles.platformNav}>
               <Link href="/classic" className={styles.platformLink}>
                  Classic 50
               </Link>
               {ARCADE_ENABLED && (
                  <Link href="/3d" className={styles.platformLink}>
                     3D Arcade
                  </Link>
               )}
            </nav>
         )}
      </header>
   );
}
