import type { Metadata } from 'next';
import './globals.css';
import { CookieBanner } from '@/components/shared/cookie-banner';
import { AnalyticsLoader } from '@/components/shared/analytics-loader';

export const metadata: Metadata = {
  title: 'Echelon - Web Monitor',
  description: 'SERP & News Monitoring Platform con AI Analysis',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="font-sans antialiased">
        {children}
        <CookieBanner />
        <AnalyticsLoader />
      </body>
    </html>
  );
}
