"use client";

import Link from "next/link";
import {
  HomeIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
  QuestionMarkCircleIcon,
  EnvelopeIcon,
  DocumentTextIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const pageLinks = [
    { name: "Home", href: "/", icon: HomeIcon, color: "#86efac", bgColor: "rgba(134, 239, 172, 0.14)", borderColor: "rgba(134, 239, 172, 0.35)" },
    { name: "Your Progress", href: "/progress", icon: ChartBarIcon, color: "#7dd3fc", bgColor: "rgba(125, 211, 252, 0.14)", borderColor: "rgba(125, 211, 252, 0.35)" },
    { name: "Certificates", href: "/certificate", icon: CheckBadgeIcon, color: "#eab308", bgColor: "rgba(234, 179, 8, 0.14)", borderColor: "rgba(234, 179, 8, 0.35)" },
    { name: "Verify", href: "/verify", icon: ShieldCheckIcon, color: "#7dd3fc", bgColor: "rgba(125, 211, 252, 0.14)", borderColor: "rgba(125, 211, 252, 0.35)" },
    { name: "FAQ", href: "/faq", icon: QuestionMarkCircleIcon, color: "#a78bfa", bgColor: "rgba(167, 139, 250, 0.14)", borderColor: "rgba(167, 139, 250, 0.35)" },
    { name: "Contact Us", href: "/contact-us", icon: EnvelopeIcon, color: "#f472b6", bgColor: "rgba(244, 114, 182, 0.14)", borderColor: "rgba(244, 114, 182, 0.35)" },
  ];

  const legalLinks = [
    { name: "Terms and Conditions", href: "/terms-and-conditions", icon: DocumentTextIcon, color: "#6366f1", bgColor: "rgba(99, 102, 241, 0.14)", borderColor: "rgba(99, 102, 241, 0.35)" },
    { name: "Privacy Policy", href: "/privacy-policy", icon: LockClosedIcon, color: "#06b6d4", bgColor: "rgba(6, 182, 212, 0.14)", borderColor: "rgba(6, 182, 212, 0.35)" },
  ];

  return (
    <footer
      style={{
        marginTop: "60px",
        padding: "40px 20px",
        borderTop: "1px solid var(--stroke)",
        backgroundColor: "rgba(11, 16, 32, 0.8)",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {/* Pages Section */}
        <div style={{ marginBottom: "30px" }}>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            Pages
          </h3>
          <div className="footer-links-container">
            {pageLinks.map((link, index) => {
              const Icon = link.icon;
              return (
                <Link
                  key={index}
                  href={link.href}
                  className="footer-link-button"
                  style={{
                    padding: "9px 16px",
                    backgroundColor: link.bgColor,
                    color: link.color,
                    border: `1px solid ${link.borderColor}`,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "14px",
                    transition: "all 0.2s ease",
                    borderRadius: "8px",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = link.bgColor.replace("0.14", "0.24");
                    e.currentTarget.style.borderColor = link.borderColor.replace("0.35", "0.5");
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = link.bgColor;
                    e.currentTarget.style.borderColor = link.borderColor;
                  }}
                >
                  <Icon style={{ width: 16, height: 16 }} />
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Legal Section */}
        <div style={{ marginBottom: "30px" }}>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            Legal
          </h3>
          <div className="footer-links-container">
            {legalLinks.map((link, index) => {
              const Icon = link.icon;
              return (
                <Link
                  key={index}
                  href={link.href}
                  className="footer-link-button"
                  style={{
                    padding: "9px 16px",
                    backgroundColor: link.bgColor,
                    color: link.color,
                    border: `1px solid ${link.borderColor}`,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "14px",
                    transition: "all 0.2s ease",
                    borderRadius: "8px",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = link.bgColor.replace("0.14", "0.24");
                    e.currentTarget.style.borderColor = link.borderColor.replace("0.35", "0.5");
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = link.bgColor;
                    e.currentTarget.style.borderColor = link.borderColor;
                  }}
                >
                  <Icon style={{ width: 16, height: 16 }} />
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Copyright */}
        <div
          style={{
            paddingTop: "30px",
            borderTop: "1px solid var(--stroke)",
            textAlign: "center",
            color: "var(--muted)",
            fontSize: "14px",
          }}
        >
          <p>
            © {currentYear} Play50Games. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
