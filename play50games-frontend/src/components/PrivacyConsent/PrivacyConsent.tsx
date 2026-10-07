"use client";

import { useState, useEffect } from "react";
import { LockClosedIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import styles from "./PrivacyConsent.module.css";

const STORAGE_KEY = "play50games_privacy_consent";
const EXPIRY_DAYS = 7; // 1 week

interface ConsentData {
  accepted: boolean;
  timestamp: number;
}

export default function PrivacyConsent() {
  const [show, setShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if consent has been given and is still valid
    const checkConsent = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const consentData: ConsentData = JSON.parse(stored);
          const now = Date.now();
          const expiryTime = consentData.timestamp + EXPIRY_DAYS * 24 * 60 * 60 * 1000;

          // If consent is expired or doesn't exist, show the banner
          if (now < expiryTime && consentData.accepted) {
            setShow(false);
            setIsVisible(false);
            return;
          }
        }
        // Show banner if no valid consent found
        setShow(true);
        setTimeout(() => setIsVisible(true), 100); // Small delay for animation
      } catch (error) {
        // If there's an error reading localStorage, show the banner
        setShow(true);
        setTimeout(() => setIsVisible(true), 100);
      }
    };

    checkConsent();
  }, []);

  const saveConsent = (accepted: boolean) => {
    const consentData: ConsentData = {
      accepted,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consentData));
    setIsVisible(false);
    setTimeout(() => setShow(false), 300); // Wait for animation to complete
  };

  const handleAccept = () => {
    saveConsent(true);
  };

  const handleNotAccept = () => {
    saveConsent(false);
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        padding: "20px",
        backgroundColor: "rgba(11, 16, 32, 0.95)",
        borderTop: "1px solid var(--stroke)",
        backdropFilter: "blur(10px)",
        transform: isVisible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.3s ease-in-out",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: "20px",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flex: "1",
            minWidth: "250px",
          }}
        >
          <LockClosedIcon
            style={{
              width: 24,
              height: 24,
              color: "var(--accent)",
              flexShrink: 0,
            }}
          />
          <p
            style={{
              color: "var(--text)",
              fontSize: "14px",
              lineHeight: "1.5",
              margin: 0,
            }}
          >
            We use cookies and similar technologies to enhance your experience.
            By continuing to use our website, you agree to our{" "}
            <Link
              href="/privacy-policy"
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
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            onClick={handleNotAccept}
            className={styles.button}
            style={{
              padding: "10px 20px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              color: "var(--muted)",
              border: "1px solid var(--stroke)",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.12)";
              e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
              e.currentTarget.style.color = "var(--muted)";
            }}
          >
            Not Accept
          </button>
          <button
            onClick={handleAccept}
            className={styles.button}
            style={{
              padding: "10px 20px",
              backgroundColor: "rgba(134, 239, 172, 0.14)",
              color: "#86efac",
              border: "1px solid rgba(134, 239, 172, 0.35)",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(134, 239, 172, 0.24)";
              e.currentTarget.style.borderColor = "rgba(134, 239, 172, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(134, 239, 172, 0.14)";
              e.currentTarget.style.borderColor = "rgba(134, 239, 172, 0.35)";
            }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
