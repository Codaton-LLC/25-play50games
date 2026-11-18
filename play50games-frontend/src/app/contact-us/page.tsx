// Contact "/contact-us": how to reach us, beside the message form. Server component for the
// frame; the form is ContactForm (client).
import type { Metadata } from "next";
import SitePage, { PageHead } from "@/components/Site/SitePage";
import page from "@/components/Site/SitePage.module.css";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
   title: "Contact",
   description: "Have a question about Play50Games or need help? Write to us.",
   alternates: { canonical: "/contact-us" },
};

export default function ContactUsPage() {
   return (
      <SitePage>
         <div className={`${page.split} ${page.splitEven}`}>
            <PageHead label="Help" title="Contact us" lead="Have a question or need help? We are here to assist you.">
               <dl className={page.facts}>
                  <div>
                     <dt>Email</dt>
                     <dd>
                        <a href="mailto:support@play50.games" className={page.link}>
                           support@play50.games
                        </a>
                     </dd>
                  </div>
                  <div>
                     <dt>Support</dt>
                     <dd>Available 24/7</dd>
                  </div>
               </dl>
            </PageHead>
            <ContactForm />
         </div>
      </SitePage>
   );
}
