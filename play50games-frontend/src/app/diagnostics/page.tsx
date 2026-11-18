// API diagnostics "/diagnostics": checks the WordPress API from the browser (the env variable,
// the address in use, a GET of /games, CORS headers, the browser). A tool page: not indexed.
// Server component for the frame; the checks run in DiagnosticsView (client).
import type { Metadata } from "next";
import SitePage, { PageHead } from "@/components/Site/SitePage";
import page from "@/components/Site/SitePage.module.css";
import DiagnosticsView from "./DiagnosticsView";

export const metadata: Metadata = {
   title: "API diagnostics",
   description: "Checks the connection between this site and the Play50Games API.",
   robots: { index: false, follow: false },
};

export default function DiagnosticsPage() {
   return (
      <SitePage>
         <div className={page.split}>
            <PageHead
               label="Tools"
               title="API diagnostics"
               lead="Checks the connection between this site and the WordPress API, from this browser."
            />
            <DiagnosticsView />
         </div>
      </SitePage>
   );
}
