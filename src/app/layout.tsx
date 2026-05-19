import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { CommandPalette } from "@/components/layout/command-palette";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LeetRank — Practice coding, level up",
    template: "%s · LeetRank",
  },
  description:
    "A modern competitive programming platform. Practice 30+ algorithm problems across 15 languages, compete in contests, and track your progress.",
  applicationName: "LeetRank",
  keywords: ["competitive programming", "algorithms", "coding interview", "contests", "leetcode", "hackerrank"],
  authors: [{ name: "Nguyễn Sơn", url: "https://github.com/JasonTM17" }],
  openGraph: {
    title: "LeetRank — Practice coding, level up",
    description: "Master algorithms, ace interviews, compete in contests.",
    type: "website",
  },
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#050811" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-elevated"
          >
            Skip to content
          </a>
          {children}
          <CommandPalette />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
