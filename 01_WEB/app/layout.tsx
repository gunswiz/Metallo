import type { Metadata, Viewport } from "next";
import "../07_ESTILOS/globals.css";
import "../07_ESTILOS/redesign-teste.css";
import { redesignTesteLiberado } from "@/09_CONFIGURACOES/ambiente-teste-online";

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
    <html lang="pt-BR" data-metallo-redesign={redesignTesteLiberado(process.env) ? "teste" : undefined}>
      {/* Marco 7A: completa funções que celular antigo não tem. Sem "defer" de propósito: precisa rodar antes dos módulos do app,
          que o servidor coloca antes deste ponto na página (arquivo pequeno, 3 kB, guardado no celular). */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <head><script src="/compat-antigos.js" /></head>
      <body>{children}</body>
    </html>
  );
}
