// FAQ "/faq": the questions as hairline rows that open in place. Server component for the frame;
// the questions load on the client (FaqList).
import type { Metadata } from "next";
import Link from "next/link";
import SitePage, { PageHead } from "@/components/Site/SitePage";
import page from "@/components/Site/SitePage.module.css";
import ui from "@/components/Site/ui.module.css";
import FaqList from "./FaqList";

export const metadata: Metadata = {
   title: "FAQ",
   description: "Answers to common questions about Play50Games: the classic games, the 3D Arcade, accounts and certificates.",
   alternates: { canonical: "/faq" },
};

export default function FAQPage() {
   return (
      <SitePage>
         <div className={page.split}>
            <PageHead
               label="Help"
               title="Frequently asked questions"
               lead="Find answers to common questions about Play50Games."
            >
               <Link href="/contact-us" className={`${ui.btn} ${ui.btnQuiet}`}>
                  Contact us
               </Link>
            </PageHead>
            <FaqList />
         </div>
      </SitePage>
   );
}
