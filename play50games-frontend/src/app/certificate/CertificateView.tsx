"use client";

// The state of the certificate page: log in first, finish the fifty games, generate the
// certificate, then open it. The checks and the requests are the old page's; a failed request
// now shows its message next to the button instead of in an alert.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Certificate } from "@/types/game";
import { generateCertificate, getUserCertificate } from "@/lib/api/certificate";
import { getAllProgress, getGuestId } from "@/lib/storage/progressStorage";
import { getAllGames } from "@/lib/api/games";
import { useAuth } from "@/contexts/AuthContext";
import { openLogin } from "@/components/Site/siteData";
import { AwardIcon } from "@/components/Site/icons";
import page from "@/components/Site/SitePage.module.css";
import ui from "@/components/Site/ui.module.css";
import styles from "./page.module.css";

const TOTAL = 50;

export default function CertificateView() {
   const { user, isAuthenticated, isLoading: authLoading } = useAuth();
   const [certificate, setCertificate] = useState<Certificate | null>(null);
   const [loading, setLoading] = useState(false);
   const [loadingCertificate, setLoadingCertificate] = useState(true);
   const [playerName, setPlayerName] = useState("");
   const [canGenerate, setCanGenerate] = useState(false);
   const [completed, setCompleted] = useState<number | null>(null);
   const [failure, setFailure] = useState("");
   const [guestId] = useState(() => getGuestId());

   const checkCompletion = async () => {
      try {
         const progress = await getAllProgress(); // from the server for logged-in users
         const games = await getAllGames(guestId);

         const completedCount = games.filter((game) => {
            const gameProgress = progress[game.id];
            return gameProgress && gameProgress.completed;
         }).length;

         setCompleted(completedCount);
         setCanGenerate(completedCount >= TOTAL);
      } catch (error) {
         // Failed to check completion
      }
   };

   const loadUserCertificate = async () => {
      setLoadingCertificate(true);
      try {
         const userCert = await getUserCertificate();
         if (userCert && userCert.certificate_id && userCert.player_name) {
            setCertificate(userCert);
         } else {
            setCertificate(null);
         }
      } catch (error) {
         console.error("Error loading user certificate:", error);
         setCertificate(null);
      } finally {
         setLoadingCertificate(false);
      }
   };

   useEffect(() => {
      if (isAuthenticated && user) {
         // Set player name from user data
         const name =
            user.display_name || (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email);
         setPlayerName(name);
         checkCompletion();
         loadUserCertificate();
      } else {
         setLoadingCertificate(false);
         setCertificate(null);
      }
   }, [isAuthenticated, user]);

   const handleGenerate = async () => {
      if (!playerName.trim()) {
         setFailure("Your account has no name yet. Add one and try again.");
         return;
      }

      setFailure("");
      setLoading(true);
      try {
         const result = await generateCertificate(playerName, guestId);
         // Set certificate from result directly
         if (result.data && result.data.certificate_id) {
            setCertificate(result.data);
            setLoadingCertificate(false); // Make sure loading is false so it shows the certificate
         } else {
            // If result.data doesn't have certificate_id, reload from server
            await loadUserCertificate();
         }
      } catch (error: any) {
         console.error("Error generating certificate:", error);
         setFailure(error.message || "Failed to generate certificate");
      } finally {
         setLoading(false);
      }
   };

   if (authLoading || (isAuthenticated && loadingCertificate)) {
      return <i className={page.bone} style={{ height: 300, borderRadius: 28 }} role="status" aria-label="Loading your certificate" />;
   }

   if (!isAuthenticated) {
      return (
         <section className={`${page.card} ${styles.state}`}>
            <span className={styles.medal} aria-hidden="true">
               <AwardIcon />
            </span>
            <h2 className={styles.title}>Log in to get your certificate</h2>
            <p className={styles.text}>
               The certificate carries the name on your account, so you need to be logged in to generate it.
            </p>
            <div className={styles.actions}>
               <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => openLogin("login")}>
                  Log in
               </button>
               <button type="button" className={`${ui.btn} ${ui.btnQuiet}`} onClick={() => openLogin("register")}>
                  Create account
               </button>
            </div>
         </section>
      );
   }

   if (certificate && certificate.certificate_id) {
      return (
         <section className={`${page.card} ${styles.state}`}>
            <span className={`${styles.medal} ${styles.medalOn}`} aria-hidden="true">
               <AwardIcon />
            </span>
            <h2 className={styles.title}>Your certificate is ready</h2>
            <p className={styles.text}>You have successfully generated your certificate!</p>
            <div className={styles.actions}>
               <Link href={`/certificate/${certificate.certificate_id}`} className={`${ui.btn} ${ui.btnPrimary}`}>
                  View certificate
               </Link>
            </div>
         </section>
      );
   }

   if (canGenerate) {
      return (
         <section className={`${page.card} ${styles.state}`}>
            <span className={`${styles.medal} ${styles.medalOn}`} aria-hidden="true">
               <AwardIcon />
            </span>
            <h2 className={styles.title}>Generate your certificate</h2>
            <p className={styles.text}>Congratulations! You&apos;ve completed all 50 games.</p>
            <p className={styles.name}>{playerName}</p>
            <p className={styles.note}>Name is taken from your account</p>
            {failure ? (
               <p className={`${page.notice} ${page.noticeError}`} role="alert">
                  {failure}
               </p>
            ) : null}
            <div className={styles.actions}>
               <button
                  type="button"
                  className={`${ui.btn} ${ui.btnPrimary} ${styles.generate}`}
                  onClick={handleGenerate}
                  disabled={loading || !playerName.trim()}
               >
                  {loading ? "Generating…" : "Generate certificate"}
               </button>
            </div>
         </section>
      );
   }

   return (
      <section className={`${page.card} ${styles.state}`}>
         <span className={styles.medal} aria-hidden="true">
            <AwardIcon />
         </span>
         <h2 className={styles.title}>Complete all games first</h2>
         <p className={styles.text}>You need to complete all 50 games to generate your certificate.</p>
         {completed !== null ? (
            <div className={styles.progress}>
               <p className={styles.count}>
                  {String(completed).padStart(2, "0")} / {TOTAL} <span>games finished</span>
               </p>
               <div className={ui.meter}>
                  <i className={ui.meterFill} style={{ "--v": Math.min(1, completed / TOTAL) } as React.CSSProperties} />
               </div>
            </div>
         ) : null}
         <div className={styles.actions}>
            <Link href="/classic" className={`${ui.btn} ${ui.btnPrimary}`}>
               Go to Classic 50
            </Link>
         </div>
      </section>
   );
}
