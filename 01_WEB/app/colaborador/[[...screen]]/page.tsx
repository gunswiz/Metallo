import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { colaboradorEnvironment } from "@/09_CONFIGURACOES/colaborador-laboratorio";
import ColaboradorApp from "./colaborador-app";

const screens = new Set(["login", "inicio", "perfil", "equipe", "obra", "epis", "ponto", "registros", "comprovantes", "itens", "comunicados"]);

export default async function ColaboradorPage({
  params,
}: {
  params: Promise<{ screen?: string[] }>;
}) {
  const environment = colaboradorEnvironment(process.env);
  if (!environment) notFound();
  const host = (await headers()).get("host");
  if (!host || !(/^127\.0\.0\.1:\d+$/.test(host) || host === "localhost:3101")) notFound();
  const path = (await params).screen ?? [];
  if (path.length > 1 || (path[0] && !screens.has(path[0]))) notFound();
  if (environment.demo && ["ponto", "registros", "comprovantes"].includes(path[0])) notFound();
  return <ColaboradorApp screen={path[0] ?? "inicio"} {...environment} />;
}
