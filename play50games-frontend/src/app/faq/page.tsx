"use client";

import { useState } from "react";
import Header from "@/components/Header/Header";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/Auth/LoginModal";
import RegisterModal from "@/components/Auth/RegisterModal";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

export default function FAQPage() {
   const { user, isAuthenticated, login, register } = useAuth();
   const [showLoginModal, setShowLoginModal] = useState(false);
   const [showRegisterModal, setShowRegisterModal] = useState(false);
   const [openItems, setOpenItems] = useState<number[]>([]);

   const faqs = [
      {
         id: 1,
         question: "What is Play50Games?",
         answer:
            "Play50Games is an interactive gaming platform featuring 50 unique games designed to challenge your logic, memory, speed, and coordination skills. Complete all games to earn your certificate of achievement!",
      },
      {
         id: 2,
         question: "How do I get started?",
         answer:
            "Simply create an account or log in to start playing. Games are unlocked progressively as you complete them. Your progress is automatically saved.",
      },
      {
         id: 3,
         question: "How do I earn a certificate?",
         answer:
            "To earn your certificate, you must complete all 50 games. Once you've finished all games, you can generate your personalized certificate from the Certificate page.",
      },
      {
         id: 4,
         question: "Can I play without creating an account?",
         answer:
            "Yes, you can play as a guest, but your progress will only be saved locally. To save your progress permanently and earn a certificate, you need to create an account.",
      },
      {
         id: 5,
         question: "How do I verify a certificate?",
         answer:
            "You can verify any certificate by visiting the Verify page and entering the Certificate ID (e.g., P50-2026-56966). The certificate will be displayed if it's valid.",
      },
      {
         id: 6,
         question: "What happens if I lose my progress?",
         answer:
            "If you're logged in, your progress is saved on our servers and will be restored when you log back in. Guest progress is stored locally in your browser.",
      },
      {
         id: 7,
         question: "Are the games free to play?",
         answer:
            "Yes, all 50 games are completely free to play. No payment or subscription is required.",
      },
      {
         id: 8,
         question: "Can I replay games?",
         answer:
            "Yes, you can replay any unlocked game as many times as you want. Your best score will be saved.",
      },
      {
         id: 9,
         question: "How are scores calculated?",
         answer:
            "Each game has its own scoring system. Your total score is the sum of your best scores from all completed games. This determines your rank (Beginner, Intermediate, Advanced, Expert, or Master).",
      },
      {
         id: 10,
         question: "What if I encounter a bug or issue?",
         answer:
            "Please contact us through the Contact Us page. We'll respond as soon as possible to help resolve any issues.",
      },
   ];

   const toggleItem = (id: number) => {
      setOpenItems((prev) =>
         prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
   };

   return (
      <div className="faq-page">
         <Header
            showSubtitle={false}
            onShowLoginModal={() => setShowLoginModal(true)}
            onShowRegisterModal={() => setShowRegisterModal(true)}
         />

         {/* Auth Modals */}
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

         <div className="faq-container">
            <div className="faq-header">
               <h1>Frequently Asked Questions</h1>
               <p>Find answers to common questions about Play50Games</p>
            </div>

            <div className="faq-list">
               {faqs.map((faq) => (
                  <div key={faq.id} className="faq-item">
                     <button
                        onClick={() => toggleItem(faq.id)}
                        className="faq-question"
                        style={{
                           width: "100%",
                           display: "flex",
                           justifyContent: "space-between",
                           alignItems: "center",
                           padding: "20px",
                           backgroundColor: "rgba(255, 255, 255, 0.06)",
                           border: "1px solid var(--stroke)",
                           borderRadius: "12px",
                           color: "var(--text)",
                           cursor: "pointer",
                           transition: "all 0.2s ease",
                           textAlign: "left",
                        }}
                        onMouseEnter={(e) => {
                           e.currentTarget.style.backgroundColor =
                              "rgba(255, 255, 255, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                           e.currentTarget.style.backgroundColor =
                              "rgba(255, 255, 255, 0.06)";
                        }}
                     >
                        <span style={{ fontSize: "16px", fontWeight: 600 }}>
                           {faq.question}
                        </span>
                        {openItems.includes(faq.id) ? (
                           <ChevronUpIcon
                              style={{
                                 width: 20,
                                 height: 20,
                                 color: "var(--accent)",
                              }}
                           />
                        ) : (
                           <ChevronDownIcon
                              style={{
                                 width: 20,
                                 height: 20,
                                 color: "var(--muted)",
                              }}
                           />
                        )}
                     </button>
                     {openItems.includes(faq.id) && (
                        <div
                           className="faq-answer"
                           style={{
                              padding: "20px",
                              backgroundColor: "rgba(255, 255, 255, 0.03)",
                              border: "1px solid var(--stroke)",
                              borderTop: "none",
                              borderRadius: "0 0 12px 12px",
                              color: "var(--muted)",
                              lineHeight: "1.6",
                           }}
                        >
                           {faq.answer}
                        </div>
                     )}
                  </div>
               ))}
            </div>
         </div>
      </div>
   );
}
