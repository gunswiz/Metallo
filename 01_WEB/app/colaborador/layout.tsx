import type { Metadata } from "next";

// Marco 4K/3U: o app do Funcionário tem o próprio "instalar na tela de início" (abre direto no Início do funcionário).
export const metadata: Metadata = {
  title: "Funcionário",
  manifest: "/manifest-funcionario.webmanifest",
};

export default function ColaboradorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
