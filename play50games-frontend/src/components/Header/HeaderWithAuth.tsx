"use client";

// Header plus the Login/Register modals, for server-rendered pages (e.g. the hub "/")
// that cannot own modal state themselves. Header only shows the login buttons when both
// callbacks are passed, so this component always passes both.
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header/Header";
import LoginModal from "@/components/Auth/LoginModal";
import RegisterModal from "@/components/Auth/RegisterModal";

export default function HeaderWithAuth() {
   const { login, register } = useAuth();
   const [showLoginModal, setShowLoginModal] = useState(false);
   const [showRegisterModal, setShowRegisterModal] = useState(false);

   return (
      <>
         <Header
            showSubtitle={false}
            onShowLoginModal={() => setShowLoginModal(true)}
            onShowRegisterModal={() => setShowRegisterModal(true)}
         />

         <LoginModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            onLogin={login}
            onSwitchToRegister={() => {
               setShowLoginModal(false);
               setShowRegisterModal(true);
            }}
         />
         <RegisterModal
            isOpen={showRegisterModal}
            onClose={() => setShowRegisterModal(false)}
            onRegister={register}
            onSwitchToLogin={() => {
               setShowRegisterModal(false);
               setShowLoginModal(true);
            }}
         />
      </>
   );
}
