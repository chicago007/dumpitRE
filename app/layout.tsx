import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dumpit RE",
  description: "부동산 사업장 관리 — 공정율 · 자금집행 · 문서",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
