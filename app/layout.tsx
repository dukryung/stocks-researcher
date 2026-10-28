import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "모닝 브리핑",
  description: "관심 기업의 MOU·투자·CEO 발언과 주가를 매일 아침 정리",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-line bg-surface">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/" className="text-base font-bold">
              모닝 브리핑
            </Link>
            <Link href="/briefings" className="text-ink-2 hover:text-ink">
              지난 브리핑
            </Link>
            <Link href="/principles" className="text-ink-2 hover:text-ink">
              투자 원칙 편집
            </Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
