import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import PWARegister from "./PWARegister";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "מיתרים – נגן מוזיקה משפחתי",
  description: "נגן מוזיקה משפחתי מבוקר ומסונן עם Whitelist ערוצי YouTube אישי",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${rubik.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
