import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "推し勝貯金",
  description: "推し球団の勝利にあわせて貯金するアプリ",
  openGraph: {
    title: "推し勝貯金",
    description: "推し球団の勝利を貯金につなげるWebアプリ",
    images: ["/icon.png"],
  },
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}