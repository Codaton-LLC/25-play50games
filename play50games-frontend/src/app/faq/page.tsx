"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header/Header";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/Auth/LoginModal";
import RegisterModal from "@/components/Auth/RegisterModal";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { getFAQs, FAQGroup } from "@/lib/api/faq";

export default function FAQPage() {
   const { user, isAuthenticated, login, register } = useAuth();
   const [showLoginModal, setShowLoginModal] = useState(false);
   const [showRegisterModal, setShowRegisterModal] = useState(false);
   const [openItems, setOpenItems] = useState<string[]>([]);
   const [faqGroups, setFaqGroups] = useState<FAQGroup[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      const fetchFAQs = async () => {
         try {
            setLoading(true);
            const data = await getFAQs();
            setFaqGroups(data);
            setError(null);
         } catch (err: any) {
            console.error("Failed to fetch FAQs:", err);
            setError(err.message || "Failed to load FAQs");
         } finally {
            setLoading(false);
         }
      };

      fetchFAQs();
   }, []);

   const toggleItem = (id: string) => {
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

            {loading ? (
               <div style={{ textAlign: "center", padding: "40px" }}>
                  <p style={{ color: "var(--muted)" }}>Loading FAQs...</p>
               </div>
            ) : error ? (
               <div style={{ textAlign: "center", padding: "40px" }}>
                  <p style={{ color: "var(--warn)" }}>{error}</p>
               </div>
            ) : faqGroups.length === 0 ? (
               <div style={{ textAlign: "center", padding: "40px" }}>
                  <p style={{ color: "var(--muted)" }}>No FAQs available.</p>
               </div>
            ) : (
               <div className="faq-list">
                  {faqGroups.map((group, groupIndex) => (
                     <div
                        key={groupIndex}
                        className="faq-group"
                        style={{ marginBottom: "40px" }}
                     >
                        {group.group_title && (
                           <h2
                              style={{
                                 fontSize: "24px",
                                 fontWeight: 700,
                                 color: "var(--text)",
                                 marginBottom: "20px",
                                 paddingBottom: "10px",
                                 borderBottom: "2px solid var(--stroke)",
                              }}
                           >
                              {group.group_title}
                           </h2>
                        )}
                        <div
                           style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "12px",
                           }}
                        >
                           {group.faqs.map((faq) => (
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
                                       backgroundColor:
                                          "rgba(255, 255, 255, 0.06)",
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
                                    <span
                                       style={{
                                          fontSize: "16px",
                                          fontWeight: 600,
                                       }}
                                    >
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
                                          backgroundColor:
                                             "rgba(255, 255, 255, 0.03)",
                                          border: "1px solid var(--stroke)",
                                          borderTop: "none",
                                          borderRadius: "0 0 12px 12px",
                                          color: "var(--muted)",
                                          lineHeight: "1.6",
                                       }}
                                       dangerouslySetInnerHTML={{
                                          __html: faq.answer,
                                       }}
                                    />
                                 )}
                              </div>
                           ))}
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>
      </div>
   );
}
