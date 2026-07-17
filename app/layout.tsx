import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "../src/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Hisaab",
  description: "A shared expense ledger, kept like a bahi-khata.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hisaab",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f1e3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
