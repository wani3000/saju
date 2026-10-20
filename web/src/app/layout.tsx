import type { Metadata } from "next";
import { character } from "@/domain/presentation";
import "@fontsource/noto-serif-kr/400.css";
import "@fontsource/noto-serif-kr/500.css";
import "@fontsource/noto-sans-kr/400.css";
import "@fontsource/noto-sans-kr/500.css";
import "@fontsource/noto-sans-kr/700.css";
import "./globals.css";
export const metadata: Metadata = {
  title: `${character.displayName} · ${character.region}의 서당`,
  description: "김춘배 훈장과 함께 두 사람의 성격과 인연을 살펴보는 사주 이야기",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
