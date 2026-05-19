import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { CommandPalette } from "@/components/layout/command-palette";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "home" });
  const tc = await getTranslations({ locale, namespace: "common" });
  return {
    title: {
      default: `${tc("appName")} — ${t("heroTitle")} ${t("heroTitleAccent")}`,
      template: `%s · ${tc("appName")}`,
    },
    description: t("heroSubtitle"),
    applicationName: tc("appName"),
    keywords: [
      "competitive programming",
      "algorithms",
      "coding interview",
      "contests",
      "leetcode",
      "hackerrank",
    ],
    authors: [{ name: "Nguyễn Sơn", url: "https://github.com/JasonTM17" }],
    openGraph: {
      title: `${tc("appName")} — ${t("heroTitle")} ${t("heroTitleAccent")}`,
      description: t("heroSubtitle"),
      type: "website",
    },
    themeColor: [
      { media: "(prefers-color-scheme: dark)", color: "#050811" },
      { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    ],
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const tc = await getTranslations({ locale, namespace: "common" });
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-elevated"
            >
              {tc("skipToContent")}
            </a>
            {children}
            <CommandPalette />
            <Toaster />
            <ServiceWorkerRegister />
            <InstallPrompt />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
