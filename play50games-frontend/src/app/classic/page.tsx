// Classic 50 "/classic": the fifty brain games as one path (docs/design/DESIGN.md §6 item 4).
// Server component for the site chrome; the path itself (games, unlock chain, progress) loads
// on the client in ClassicView. The metadata lives in layout.tsx.
import SiteHeader from "@/components/Site/SiteHeader";
import SiteFooter from "@/components/Site/SiteFooter";
import ui from "@/components/Site/ui.module.css";
import ClassicView from "./ClassicView";
import styles from "./page.module.css";

export default function ClassicPage() {
   return (
      <div className={`p50 ${styles.page}`}>
         <SiteHeader active="classic" />
         <main className={`${ui.wrap} ${styles.main}`}>
            <ClassicView />
         </main>
         <SiteFooter />
      </div>
   );
}
