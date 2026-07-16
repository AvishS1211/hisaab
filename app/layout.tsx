import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hisaab",
  description: "A shared expense ledger, kept like a bahi-khata.",
};

export const viewport: Viewport = {
  themeColor: "#f7f1e3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
