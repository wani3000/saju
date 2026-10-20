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
  description: "조선풍 가상 인물 김춘배 훈장과 두 사람의 사주 기호를 살펴보는 연구 체험",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
