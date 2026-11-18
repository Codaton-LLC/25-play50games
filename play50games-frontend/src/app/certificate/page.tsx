// Certificate "/certificate": the reward of the Classic 50 path. Server component for the frame;
// the state (log in, finish the games, generate, view) is CertificateView (client). The metadata
// lives in layout.tsx.
import SitePage, { PageHead } from "@/components/Site/SitePage";
import page from "@/components/Site/SitePage.module.css";
import CertificateView from "./CertificateView";

export default function CertificatePage() {
   return (
      <SitePage active="classic">
         <div className={`${page.split} ${page.splitEven}`}>
            <PageHead
               label="Classic 50"
               title="Certificate"
               lead="Finish all fifty classic games and your name goes on a certificate that anyone can verify."
            />
            <CertificateView />
         </div>
      </SitePage>
   );
}
