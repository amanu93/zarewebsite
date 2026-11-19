import type { Metadata } from 'next';

import './globals.css';

import localFont from 'next/font/local';
import { logo, ogImage, siteName, siteUrl } from '@/constants';

// The root layout deliberately holds NO providers. Redux and Mantine belong to
// the route groups that use them: `(marketing)/layout.tsx` and
// `admin/layout.tsx`. Keeping them here forced every visitor to download the
// admin panel's runtime. See docs/superpowers/specs — M0.

const gotham = localFont({
  src: [
    {
      path: './fonts/Gotham-Light.otf',
      weight: '200',
      style: 'normal',
    },
    {
      path: './fonts/Gotham-Book.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/Gotham-Medium.otf',
      weight: '500',
    },
    {
      path: './fonts/Gotham-Bold.otf',
      weight: '700',
    },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    // "Revolutionize" is on the banned list. The default title now states the
    // category instead of asserting a transformation.
    default: `${siteName} | Embedded Engineering Teams`,
    template: `%s | ${siteName}`,
  },
  description:
    'Zare Innovations embeds senior engineers into your team under US contracts, from our Addis Ababa engineering centre. Custom software, AI systems and managed operations. Delaware LLC, 5.0 on Clutch.',
  keywords: [
    'embedded engineering teams',
    'dedicated engineering team',
    'custom software development',
    'AI engineering',
    'software development Ethiopia',
    'engineering team Addis Ababa',
    'Ethiopian software engineers',
    'Zare Innovations',
    'tech companies in Ethiopia',
    'IT company Addis Ababa',
    'African tech company',
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: siteName,
    images: [
      {
        url: ogImage.home,
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [ogImage.home],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: logo,
    apple: logo,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${gotham.className} antialiased overflow-x-hidden`}>
        {children}
      </body>
    </html>
  );
}
