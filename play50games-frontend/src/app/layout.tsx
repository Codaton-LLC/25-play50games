import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Play50Games - Learn. Play. Achieve.',
  description: 'Complete 50 browser games and earn your certificate!',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

