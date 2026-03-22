import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "推し勝貯金｜NPB推し活×貯金アプリ",
  description: "推し球団の勝利にあわせて貯金するシンプルなWebアプリ",

  openGraph: {
    title: "推し勝貯金",
    description: "推し球団が勝つたびに貯金するアプリ",
    images: ["/icon.png"],
  },

  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}