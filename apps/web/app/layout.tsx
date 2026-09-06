import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Metallo", template: "%s | Metallo" },
  description: "Centro administrativo e operacional Metallo.",
  applicationName: "Metallo",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#071520",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
