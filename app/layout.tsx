import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kreidl · Aufträge & Betriebsplanung",
  description: "Aufträge, Ressourcen und Zeiten an einem Ort.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
