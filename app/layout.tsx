import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const d2coding = localFont({
  src: [
    { path: "./fonts/D2Coding.ttf", weight: "400", style: "normal" },
    { path: "./fonts/D2CodingBold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-d2coding",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dumpit RE",
  description: "부동산 사업장 관리 — 공정율 · 자금집행 · 문서",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${jetbrainsMono.variable} ${d2coding.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
