"use client";

import { useState } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/Auth/LoginModal";
import RegisterModal from "@/components/Auth/RegisterModal";

export default function PrivacyPolicyPage() {
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

  const lastUpdatedDate = formatDate(new Date('2026-10-05')); // Fixed date to avoid hydration issues

  return (
    <div className="privacy-page">
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
          Privacy Policy
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
              1. Information We Collect
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              We collect information that you provide directly to us, including:
            </p>
            <ul
              style={{
                color: "var(--muted)",
                marginLeft: "20px",
                marginBottom: "15px",
              }}
            >
              <li>Account information (username, email, password)</li>
              <li>Game progress and completion data</li>
              <li>Certificate information</li>
              <li>Contact information when you reach out to us</li>
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
              2. How We Use Your Information
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              We use the information we collect to:
            </p>
            <ul
              style={{
                color: "var(--muted)",
                marginLeft: "20px",
                marginBottom: "15px",
              }}
            >
              <li>Provide, maintain, and improve our services</li>
              <li>Track your game progress and generate certificates</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
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
              3. Data Storage
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              For guest users, game progress is stored locally in your browser.
              For registered users, your progress is stored on our secure
              servers. We implement appropriate security measures to protect your
              personal information.
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
              4. Cookies and Local Storage
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              We use browser local storage to save your game progress for guest
              users. This data is stored on your device and is not transmitted
              to our servers unless you create an account.
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
              5. 3D Arcade Scores and Leaderboards
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              Each 3D Arcade game keeps its own score and has its own public
              leaderboard:
            </p>
            <ul
              style={{
                color: "var(--muted)",
                marginLeft: "20px",
                marginBottom: "15px",
              }}
            >
              <li>
                Guests: scores are saved only on your device (browser local
                storage) and are not added to any leaderboard.
              </li>
              <li>
                Logged-in players: we store your best score for each game, the
                time of that run, how often you played and when you last played.
                Your best score is shown on that game&apos;s public leaderboard.
              </li>
              <li>
                On leaderboards you appear with your first name and last initial
                (for example &quot;Ana K.&quot;), never with your username or
                email.
              </li>
              <li>
                You can hide your name at any time with the &quot;Show my name on
                leaderboards&quot; switch on the 3D Arcade page. You then appear as
                &quot;Anonymous&quot; and your scores still count.
              </li>
              <li>
                To prevent cheating and abuse, administrators can remove scores,
                and a hashed form of your IP address is used briefly to limit how
                often scores can be sent.
              </li>
              <li>Deleting your account also deletes your 3D Arcade scores.</li>
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
              6. Information Sharing
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              We do not sell, trade, or rent your personal information to third
              parties. We may share your information only in the following
              circumstances:
            </p>
            <ul
              style={{
                color: "var(--muted)",
                marginLeft: "20px",
                marginBottom: "15px",
              }}
            >
              <li>With your consent</li>
              <li>To comply with legal obligations</li>
              <li>To protect our rights and safety</li>
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
              7. Your Rights
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              You have the right to:
            </p>
            <ul
              style={{
                color: "var(--muted)",
                marginLeft: "20px",
                marginBottom: "15px",
              }}
            >
              <li>Access your personal information</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your account</li>
              <li>Export your game progress data</li>
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
              8. Children's Privacy
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              Our service is not intended for children under 13 years of age. We
              do not knowingly collect personal information from children under
              13.
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
              9. Changes to This Policy
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              We may update this Privacy Policy from time to time. We will
              notify you of any changes by posting the new Privacy Policy on this
              page and updating the "Last updated" date.
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
              10. Contact Us
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "15px" }}>
              If you have any questions about this Privacy Policy, please
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
