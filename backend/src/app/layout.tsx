import type { Metadata } from "next";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import Script from "next/script";

import { AppProvider } from "@/components/app-provider";
import { defaultLocale, isSupportedLocale, siteUrl } from "@/lib/i18n/config";
import {
  colorSchemeCookieName,
  getColorSchemeBootstrapScript,
  getStoredColorScheme,
} from "@/lib/theme/color-scheme";

import "@mantine/core/styles.css";
import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "QuietShift",
  description: "Operational intelligence for modern SaaS teams.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const localeHeader = headerStore.get("x-current-locale");
  const lang = localeHeader && isSupportedLocale(localeHeader) ? localeHeader : defaultLocale;
  const initialColorScheme =
    getStoredColorScheme(cookieStore.get(colorSchemeCookieName)?.value) ?? "light";

  return (
    <html
      lang={lang}
      data-mantine-color-scheme={initialColorScheme}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-color-scheme-bootstrap"
          strategy="beforeInteractive"
        >
          {getColorSchemeBootstrapScript(initialColorScheme)}
        </Script>
      </head>
      <body>
        <AppProvider initialColorScheme={initialColorScheme}>{children}</AppProvider>
      </body>
    </html>
  );
}
