import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
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
            <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-surface">
              {children}
            </div>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
