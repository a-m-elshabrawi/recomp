import type { Metadata } from "next";
import { IBM_Plex_Sans, Oswald } from "next/font/google";
import "./globals.css";

// Body copy, labels, nav, form fields — IBM's own engineering-documentation
// typeface, a deliberate step toward a more technical/document-y feel than
// a cleaner "generic SaaS" grotesk.
//
// Named "--font-sans" (not e.g. "--font-ibm-plex-sans") on purpose: the
// @theme inline block in globals.css resolves Tailwind's `font-sans`
// utility via `var(--font-sans)`, and Tailwind's own core theme already
// defines a default for that exact variable name. Naming this anything
// else means the utility silently falls back to Tailwind's default system
// font stack instead of this one — which is exactly the bug that existed
// here before (the previous font was named --font-geist-sans and never
// actually got picked up).
const bodySans = IBM_Plex_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// Condensed, mechanical grotesk reserved for numeric data (stat figures,
// weights, reps, streaks) — see .stat-value/.stat-label etc. in
// globals.css. Oswald is derived from classic stamped/engraved sign
// lettering, which fits the "load-plate calibration markings" brief even
// more literally than the previous Barlow Condensed.
const displayCondensed = Oswald({
  variable: "--font-oswald",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recomp",
  description: "Personal fitness tracking and body recomposition app.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bodySans.variable} ${displayCondensed.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
