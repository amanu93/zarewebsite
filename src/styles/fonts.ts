import localFont from 'next/font/local';

// The one type system for the rebuilt site and the staff portal: applied by
// `app/(site)/layout.tsx` and `app/(bench)/portal/layout.tsx`, never by the
// root layout. The root layout still carries Gotham for the live marketing and
// admin routes, which are untouched until M3, so declaring the fonts here keeps
// them off every page that does not use them.
//
// These are self-hosted, not `next/font/google`. Turbopack downloads Google's
// font binaries at build time, and that reached out to fonts.gstatic.com from
// inside CI and inside the deploy container — a network call in the middle of a
// build that must not need one. When it failed the whole build failed with
// "Can't resolve '@vercel/turbopack-next/internal/font/google/font'", which is
// what it says when the fetch, not the config, went wrong. Same pattern the
// root layout already uses for Gotham.
//
// The files are Google's own `latin` subset builds, unmodified, under the SIL
// Open Font License — see `fonts/OFL.txt`. `latin` covers U+0000-00FF,
// general punctuation (U+2000-206F), the currency signs and the maths symbols
// this site sets; nothing it renders needed the other subsets. Sora and Manrope
// are variable, so one file each carries every weight.
//
// Manrope 500 and Plex Mono 400, 500 and 600 are here for the portal's dense
// data screens.

export const sora = localFont({
  src: [{ path: './fonts/Sora-Variable.woff2', weight: '100 800', style: 'normal' }],
  variable: '--font-sora',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

export const manrope = localFont({
  src: [{ path: './fonts/Manrope-Variable.woff2', weight: '200 800', style: 'normal' }],
  variable: '--font-manrope',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

// Plex Mono ships one file per weight: it has no variable build on Google
// Fonts. `adjustFontFallback` is off because the synthetic fallback it inserts
// is derived from Arial, which would set the portal's tables in a proportional
// face for as long as the download takes.
export const plexMono = localFont({
  src: [
    { path: './fonts/IBMPlexMono-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/IBMPlexMono-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/IBMPlexMono-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
});

export const fontVariables = `${sora.variable} ${manrope.variable} ${plexMono.variable}`;
