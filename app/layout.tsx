import type { Metadata } from 'next';
// import localFont from 'next/font/local';
import './globals.css';
import Navbar from '@/components/Navbar';

import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';

// Fonts commented out - add font files to app/fonts/ if needed
// const geistSans = localFont({
//   src: './fonts/GeistVF.woff',
//   variable: '--font-geist-sans',
//   weight: '100 900',
// });

// const geistMono = localFont({
//   src: './fonts/GeistMonoVF.woff',
//   variable: '--font-geist-mono',
//   weight: '100 900',
// });

export const metadata: Metadata = {
  title: 'AlgoMock - AI Interview Practice',
  description: 'Practice technical interviews with AI-powered feedback',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="antialiased">{/* Removed font variables */}
        <GlobalErrorBoundary>
          <Navbar />
          {children}
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}