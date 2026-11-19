"use client";

// The questions of the FAQ page, loaded from the API. Each one is a row that opens in place;
// several can be open at once.
import { useEffect, useState } from "react";
import { getFAQs, FAQGroup } from "@/lib/api/faq";
import { ChevronIcon } from "@/components/Site/icons";
import page from "@/components/Site/SitePage.module.css";
import ui from "@/components/Site/ui.module.css";
import styles from "./page.module.css";

export default function FaqList() {
   const [openItems, setOpenItems] = useState<string[]>([]);
   const [faqGroups, setFaqGroups] = useState<FAQGroup[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   const fetchFAQs = async () => {
      try {
         setLoading(true);
         const data = await getFAQs();
         setFaqGroups(data);
         setError(null);
      } catch (err: any) {
         console.error("Failed to fetch FAQs:", err);
         setError(err.message || "Failed to load FAQs");
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => {
      fetchFAQs();
   }, []);

   const toggleItem = (id: string) => {
      setOpenItems((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
   };

   if (loading) {
      return (
         <div className={styles.list} role="status" aria-label="Loading the questions">
            {Array.from({ length: 6 }, (_, index) => (
               <div key={index} className={styles.skeleton}>
                  <i className={page.bone} style={{ width: `${72 - index * 7}%`, height: 20 }} />
               </div>
            ))}
         </div>
      );
   }

   if (error) {
      return (
         <div className={styles.state} role="alert">
            <p>Could not load the questions. Check your connection and try again.</p>
            <button type="button" className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`} onClick={fetchFAQs}>
               Try again
            </button>
         </div>
      );
   }

   if (faqGroups.length === 0) {
      return (
         <div className={styles.state}>
            <p>There are no questions here yet. Ask us yours on the contact page.</p>
         </div>
      );
   }

   return (
      <div className={styles.groups}>
         {faqGroups.map((group, groupIndex) => (
            <section key={groupIndex} className={styles.group}>
               {group.group_title ? <h2 className={styles.groupTitle}>{group.group_title}</h2> : null}
               <div className={styles.list}>
                  {group.faqs.map((faq) => {
                     const open = openItems.includes(faq.id);
                     return (
                        <div key={faq.id} className={styles.item}>
                           {/* under the page h1 directly when the group has no title */}
                           <h3 className={styles.heading} aria-level={group.group_title ? undefined : 2}>
                              <button
                                 type="button"
                                 className={styles.question}
                                 aria-expanded={open}
                                 aria-controls={`faq-${faq.id}`}
                                 onClick={() => toggleItem(faq.id)}
                              >
                                 <span>{faq.question}</span>
                                 <ChevronIcon />
                              </button>
                           </h3>
                           {open ? (
                              <div
                                 id={`faq-${faq.id}`}
                                 className={`${page.prose} ${styles.answer}`}
                                 dangerouslySetInnerHTML={{ __html: faq.answer }}
                              />
                           ) : null}
                        </div>
                     );
                  })}
               </div>
            </section>
         ))}
      </div>
   );
}
