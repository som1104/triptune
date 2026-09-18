import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AccountSheetProvider } from "@/components/auth/account-sheet";
import { DevGuestSwitcher } from "@/components/dev/dev-guest-switcher";
import "./globals.css";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
});

export const metadata: Metadata = {
  title: "TRIPTUNE",
  description: "친구들과 여행 날짜와 취향을 조율하는 협업 여행 플래너",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f8fe",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`h-full antialiased ${hankenGrotesk.variable}`}>
      <head>
        {/* Korean glyphs: Hanken Grotesk (loaded above) has none, so Latin
            text/numbers render in it and Hangul falls through to this. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full">
        <SessionProvider>
          <ToastProvider>
            <AccountSheetProvider>
              <div className="flex min-h-dvh w-full flex-col bg-surface">
                {children}
              </div>
              {/* 개발 서버에서만. next build 시 이 분기는 통째로 떨어져 나간다. */}
              {process.env.NODE_ENV !== "production" && <DevGuestSwitcher />}
            </AccountSheetProvider>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
