"use client";

import { useState } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/Auth/LoginModal";
import RegisterModal from "@/components/Auth/RegisterModal";

export default function TermsAndConditionsPage() {
  const { user, isAuthenticated, login, register } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Format date consistently to avoid hydration errors
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}.${month}.${year}`;
  };

  const lastUpdatedDate = formatDate(new Date('2025-01-09')); // Fixed date to avoid hydration issues

  return (
    <div className="terms-page">
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 18px" }}>
        <Header
          showSubtitle={false}
          onShowLoginModal={() => setShowLoginModal(true)}
          onShowRegisterModal={() => setShowRegisterModal(true)}
        />
      </div>

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

      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "40px 20px",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 700,
            color: "var(--text)",
            marginBottom: "20px",
          }}
        >
          Terms and Conditions
        </h1>
        <p
          style={{
            color: "var(--muted)",
            marginBottom: "30px",
            fontSize: "14px",
          }}
        >
          Last updated: {lastUpdatedDate}
        </p>

        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            border: "1px solid var(--stroke)",
            borderRadius: "12px",
            padding: "30px",
            color: "var(--text)",
            lineHeight: "1.8",
          }}
        >
          <section style={{ marginBottom: "30px" }}>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 600,
                marginBottom: "15px",
                color: "var(--accent)",
              }}
            >
              1. Acceptance of Terms
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              By accessing and using Play50Games, you accept and agree to be
              bound by the terms and provision of this agreement.
            </p>
          </section>

          <section style={{ marginBottom: "30px" }}>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 600,
                marginBottom: "15px",
                color: "var(--accent)",
              }}
            >
              2. Use License
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              Permission is granted to temporarily access the materials on
              Play50Games for personal, non-commercial transitory viewing only.
              This is the grant of a license, not a transfer of title, and under
              this license you may not:
            </p>
            <ul
              style={{
                color: "var(--muted)",
                marginLeft: "20px",
                marginBottom: "15px",
              }}
            >
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose</li>
              <li>Attempt to reverse engineer any software contained on the website</li>
              <li>Remove any copyright or other proprietary notations</li>
            </ul>
          </section>

          <section style={{ marginBottom: "30px" }}>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 600,
                marginBottom: "15px",
                color: "var(--accent)",
              }}
            >
              3. User Accounts
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              You are responsible for maintaining the confidentiality of your
              account and password. You agree to accept responsibility for all
              activities that occur under your account.
            </p>
          </section>

          <section style={{ marginBottom: "30px" }}>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 600,
                marginBottom: "15px",
                color: "var(--accent)",
              }}
            >
              4. Game Progress and Certificates
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              Game progress is saved locally for guest users and on our servers
              for registered users. Certificates are generated upon completion of
              all 50 games and are provided as-is without warranty.
            </p>
          </section>

          <section style={{ marginBottom: "30px" }}>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 600,
                marginBottom: "15px",
                color: "var(--accent)",
              }}
            >
              5. Disclaimer
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              The materials on Play50Games are provided on an 'as is' basis.
              Play50Games makes no warranties, expressed or implied, and hereby
              disclaims and negates all other warranties including without
              limitation, implied warranties or conditions of merchantability,
              fitness for a particular purpose, or non-infringement of
              intellectual property or other violation of rights.
            </p>
          </section>

          <section style={{ marginBottom: "30px" }}>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 600,
                marginBottom: "15px",
                color: "var(--accent)",
              }}
            >
              6. Limitations
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              In no event shall Play50Games or its suppliers be liable for any
              damages (including, without limitation, damages for loss of data or
              profit, or due to business interruption) arising out of the use or
              inability to use the materials on Play50Games.
            </p>
          </section>

          <section style={{ marginBottom: "30px" }}>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 600,
                marginBottom: "15px",
                color: "var(--accent)",
              }}
            >
              7. Revisions
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              Play50Games may revise these terms of service at any time without
              notice. By using this website you are agreeing to be bound by the
              then current version of these terms of service.
            </p>
          </section>

          <section>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 600,
                marginBottom: "15px",
                color: "var(--accent)",
              }}
            >
              8. Contact Information
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              If you have any questions about these Terms and Conditions, please
              contact us at{" "}
              <a
                href="/contact-us"
                style={{
                  color: "var(--accent)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = "underline";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = "none";
                }}
              >
                our contact page
              </a>
              .
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
