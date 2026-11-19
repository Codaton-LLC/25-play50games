import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/seo/ogImages";
import { pageSocial } from "@/lib/seo/pageMetadata";

const TITLE = "My Progress";
const DESCRIPTION =
   "Track your progress across all 50 games. See which games you've completed and unlock new challenges.";

export const metadata: Metadata = {
   title: TITLE,
   description: DESCRIPTION,
   ...pageSocial({ title: TITLE, description: DESCRIPTION, path: "/progress", image: OG_IMAGES.classic }),
};

export default function ProgressLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return <>{children}</>;
}
