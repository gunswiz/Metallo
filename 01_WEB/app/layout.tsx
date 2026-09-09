import type { Metadata, Viewport } from "next";
import "../07_ESTILOS/globals.css";

export const metadata: Metadata = {
  title: { default: "Metallo", template: "%s | Metallo" },
  description: "Centro administrativo e operacional Metallo.",
  applicationName: "Metallo",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/metallo-app-icon.png",
    apple: "/metallo-app-icon.png",
  },
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
