// Privacy policy "/privacy-policy". Server component; the text is unchanged from the old page.
import type { Metadata } from "next";
import Link from "next/link";
import SitePage, { PageHead } from "@/components/Site/SitePage";
import page from "@/components/Site/SitePage.module.css";

export const metadata: Metadata = {
   title: "Privacy Policy",
   description: "How Play50Games collects, uses and stores your data: accounts, game progress, 3D Arcade scores and leaderboards.",
   alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
   return (
      <SitePage>
         <PageHead label="Legal" title="Privacy Policy">
            <p className={page.updated}>Last updated: 05.10.2026</p>
         </PageHead>

         <article className={page.prose}>
            <section>
               <h2>
                  1. Information We Collect
               </h2>
               <p>
                  We collect information that you provide directly to us, including:
               </p>
               <ul>
                  <li>Account information (username, email, password)</li>
                  <li>Game progress and completion data</li>
                  <li>Certificate information</li>
                  <li>Contact information when you reach out to us</li>
               </ul>
            </section>

            <section>
               <h2>
                  2. How We Use Your Information
               </h2>
               <p>
                  We use the information we collect to:
               </p>
               <ul>
                  <li>Provide, maintain, and improve our services</li>
                  <li>Track your game progress and generate certificates</li>
                  <li>Send you technical notices and support messages</li>
                  <li>Respond to your comments and questions</li>
               </ul>
            </section>

            <section>
               <h2>
                  3. Data Storage
               </h2>
               <p>
                  For guest users, game progress is stored locally in your browser.
                  For registered users, your progress is stored on our secure
                  servers. We implement appropriate security measures to protect your
                  personal information.
               </p>
            </section>

            <section>
               <h2>
                  4. Cookies and Local Storage
               </h2>
               <p>
                  We use browser local storage to save your game progress for guest
                  users. This data is stored on your device and is not transmitted
                  to our servers unless you create an account.
               </p>
            </section>

            <section>
               <h2>
                  5. 3D Arcade Scores and Leaderboards
               </h2>
               <p>
                  Each 3D Arcade game keeps its own score and has its own public
                  leaderboard:
               </p>
               <ul>
                  <li>
                     Guests: scores are saved only on your device (browser local
                     storage) and are not added to any leaderboard.
                  </li>
                  <li>
                     Logged-in players: we store your best score for each game, how
                     long that run took and when you set it, your last score, how
                     often you played and when you last played. Your best score, the
                     time it took and the date you set it are shown on that
                     game&apos;s public leaderboard.
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
                     often scores can be sent and accounts can be created.
                  </li>
                  <li>Deleting your account also deletes your 3D Arcade scores.</li>
               </ul>
            </section>

            <section>
               <h2>
                  6. Information Sharing
               </h2>
               <p>
                  We do not sell, trade, or rent your personal information to third
                  parties. We may share your information only in the following
                  circumstances:
               </p>
               <ul>
                  <li>With your consent</li>
                  <li>To comply with legal obligations</li>
                  <li>To protect our rights and safety</li>
               </ul>
            </section>

            <section>
               <h2>
                  7. Your Rights
               </h2>
               <p>
                  You have the right to:
               </p>
               <ul>
                  <li>Access your personal information</li>
                  <li>Correct inaccurate data</li>
                  <li>Request deletion of your account</li>
                  <li>Export your game progress data</li>
               </ul>
            </section>

            <section>
               <h2>
                  8. Children's Privacy
               </h2>
               <p>
                  Our service is not intended for children under 13 years of age. We
                  do not knowingly collect personal information from children under
                  13.
               </p>
            </section>

            <section>
               <h2>
                  9. Changes to This Policy
               </h2>
               <p>
                  We may update this Privacy Policy from time to time. We will
                  notify you of any changes by posting the new Privacy Policy on this
                  page and updating the "Last updated" date.
               </p>
            </section>

            <section>
               <h2>
                  10. Contact Us
               </h2>
               <p>
                  If you have any questions about this Privacy Policy, please
                  contact us at{" "}
                  <Link href="/contact-us">
                     our contact page
                  </Link>
                  .
               </p>
            </section>
         </article>
      </SitePage>
   );
}
