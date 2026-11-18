// One certificate "/certificate/[id]": the public view anyone with the link can open.
// Server component for the frame; the certificate loads on the client (CertificateDoc).
import SitePage from "@/components/Site/SitePage";
import CertificateDoc from "./CertificateDoc";

export default function CertificateViewPage() {
   return (
      <SitePage active="classic">
         <CertificateDoc />
      </SitePage>
   );
}
