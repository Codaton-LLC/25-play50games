// Terms and conditions "/terms-and-conditions". Server component; the text is unchanged from the old page.
import type { Metadata } from "next";
import Link from "next/link";
import SitePage, { PageHead } from "@/components/Site/SitePage";
import page from "@/components/Site/SitePage.module.css";
import { pageSocial } from "@/lib/seo/pageMetadata";

const TITLE = "Terms and Conditions";
const DESCRIPTION =
   "The terms for using Play50Games: accounts, fair play, certificates and the limits of our liability.";

export const metadata: Metadata = {
   title: TITLE,
   description: DESCRIPTION,
   ...pageSocial({ title: TITLE, description: DESCRIPTION, path: "/terms-and-conditions" }),
};

export default function TermsAndConditionsPage() {
   return (
      <SitePage>
         <PageHead label="Legal" title="Terms and Conditions">
            <p className={page.updated}>Last updated: 09.01.2025</p>
         </PageHead>

         <article className={page.prose}>
            <section>
               <h2>
                  1. Acceptance of Terms
               </h2>
               <p>
                  By accessing and using Play50Games, you accept and agree to be
                  bound by the terms and provision of this agreement.
               </p>
            </section>

            <section>
               <h2>
                  2. Use License
               </h2>
               <p>
                  Permission is granted to temporarily access the materials on
                  Play50Games for personal, non-commercial transitory viewing only.
                  This is the grant of a license, not a transfer of title, and under
                  this license you may not:
               </p>
               <ul>
                  <li>Modify or copy the materials</li>
                  <li>Use the materials for any commercial purpose</li>
                  <li>Attempt to reverse engineer any software contained on the website</li>
                  <li>Remove any copyright or other proprietary notations</li>
               </ul>
            </section>

            <section>
               <h2>
                  3. User Accounts
               </h2>
               <p>
                  You are responsible for maintaining the confidentiality of your
                  account and password. You agree to accept responsibility for all
                  activities that occur under your account.
               </p>
            </section>

            <section>
               <h2>
                  4. Game Progress and Certificates
               </h2>
               <p>
                  Game progress is saved locally for guest users and on our servers
                  for registered users. Certificates are generated upon completion of
                  all 50 games and are provided as-is without warranty.
               </p>
            </section>

            <section>
               <h2>
                  5. Disclaimer
               </h2>
               <p>
                  The materials on Play50Games are provided on an 'as is' basis.
                  Play50Games makes no warranties, expressed or implied, and hereby
                  disclaims and negates all other warranties including without
                  limitation, implied warranties or conditions of merchantability,
                  fitness for a particular purpose, or non-infringement of
                  intellectual property or other violation of rights.
               </p>
            </section>

            <section>
               <h2>
                  6. Limitations
               </h2>
               <p>
                  In no event shall Play50Games or its suppliers be liable for any
                  damages (including, without limitation, damages for loss of data or
                  profit, or due to business interruption) arising out of the use or
                  inability to use the materials on Play50Games.
               </p>
            </section>

            <section>
               <h2>
                  7. Revisions
               </h2>
               <p>
                  Play50Games may revise these terms of service at any time without
                  notice. By using this website you are agreeing to be bound by the
                  then current version of these terms of service.
               </p>
            </section>

            <section>
               <h2>
                  8. Contact Information
               </h2>
               <p>
                  If you have any questions about these Terms and Conditions, please
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
