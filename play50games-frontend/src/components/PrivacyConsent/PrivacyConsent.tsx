"use client";

import { useState, useEffect, useRef } from "react";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import styles from "./PrivacyConsent.module.css";

const STORAGE_KEY = "play50games_privacy_consent";
/** The banner's height while it is up, on <html>; globals.css pads the end of every page by it. */
const HEIGHT_VAR = "--cookie-banner-h";

function clearBannerHeight() {
  if (typeof document !== "undefined") document.documentElement.style.removeProperty(HEIGHT_VAR);
}
const EXPIRY_DAYS = 7; // 1 week

interface ConsentData {
  accepted: boolean;
  timestamp: number;
}

export default function PrivacyConsent() {
  const [show, setShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // while the banner is up, publish its height so the end of the page can scroll clear of it
  useEffect(() => {
    const el = bannerRef.current;
    if (!show || !el || typeof window === "undefined") {
      clearBannerHeight();
      return;
    }
    const measure = () => {
      document.documentElement.style.setProperty(HEIGHT_VAR, `${Math.ceil(el.getBoundingClientRect().height)}px`);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      clearBannerHeight();
    };
  }, [show]);

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
    clearBannerHeight();
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

  // The look lives in PrivacyConsent.module.css (the design tokens of theme.css). The bar stays
  // docked to the bottom edge at full width: the classic boards and the 3D shell measure it there.
  return (
    <div ref={bannerRef} className={isVisible ? `${styles.banner} ${styles.visible}` : styles.banner}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <LockClosedIcon className={styles.icon} aria-hidden="true" />
          <p className={styles.text}>
            We use cookies and similar technologies to enhance your experience. By continuing to use
            our website, you agree to our{" "}
            <Link href="/privacy-policy" className={styles.link}>
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={handleNotAccept} className={`${styles.button} ${styles.decline}`}>
            Not Accept
          </button>
          <button type="button" onClick={handleAccept} className={`${styles.button} ${styles.accept}`}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
