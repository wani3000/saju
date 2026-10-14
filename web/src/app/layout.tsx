import type { Metadata } from "next";
import "@fontsource/jua";
import "@fontsource/noto-sans-kr/400.css";
import "@fontsource/noto-sans-kr/500.css";
import "@fontsource/noto-sans-kr/700.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "가까운 사이 · 아기 호랑이와 함께",
  description: "소중한 사람을 천천히 알아가는 공간",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
