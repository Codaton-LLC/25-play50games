import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
   title: "Play50Games - Learn. Play. Achieve.",
   description: "Complete 50 browser games and earn your certificate!",
   icons: {
      icon: "/images/logo/favicon.png",
      shortcut: "/images/logo/favicon.png",
      apple: "/images/logo/favicon.png",
   },
};

export default function RootLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return (
      <html lang="en" suppressHydrationWarning>
         <body suppressHydrationWarning>
            <AuthProvider>{children}</AuthProvider>
         </body>
      </html>
   );
}
