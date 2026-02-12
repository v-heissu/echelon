import type { Metadata } from 'next';
import './globals.css';

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
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
