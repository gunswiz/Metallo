import type { NextRequest } from "next/server";
import { updateSession } from "@/05_ACESSO_A_DADOS/Supabase/proxy";
import { NextResponse } from "next/server";
import { TESTE_ONLINE_SUPABASE_URL } from "@/09_CONFIGURACOES/ambiente-teste-online";

export async function proxy(request: NextRequest) {
  const online = process.env.METALLO_COLABORADOR_TESTE_ONLINE === "1";
  if (process.env.METALLO_COLABORADOR_PREVIEW === "1" || process.env.METALLO_COLABORADOR_VISUAL_PREVIEW === "1" || online) {
    const pointLabTransport = (process.env.METALLO_COLABORADOR_PREVIEW === "1" || online) && (request.nextUrl.pathname.startsWith("/api/ponto-lab/") || request.nextUrl.pathname.startsWith("/api/ponto-online/") || request.nextUrl.pathname.startsWith("/api/ponto-registros/"));
    const signatureLabTransport = process.env.METALLO_COLABORADOR_PREVIEW === "1" && request.nextUrl.pathname === "/api/laboratorio/assinatura-epi";
    if (online && request.nextUrl.pathname === "/") return NextResponse.redirect(new URL("/colaborador/login", request.url));
    if (!pointLabTransport && !signatureLabTransport && !request.nextUrl.pathname.startsWith("/colaborador") && !request.nextUrl.pathname.startsWith("/_next/") && !(online && request.nextUrl.pathname.startsWith("/assets/")) && request.nextUrl.pathname !== "/manifest.webmanifest" && !(online && request.nextUrl.pathname === "/manifest-funcionario.webmanifest")) {
      return new NextResponse(null, { status: 404 });
    }
    const response = NextResponse.next({ request });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Content-Type-Options", "nosniff");
    if (online) response.headers.set("Strict-Transport-Security", "max-age=31536000");
    response.headers.set("Content-Security-Policy", "default-src 'self'; connect-src 'self' " + (online ? TESTE_ONLINE_SUPABASE_URL : "http://127.0.0.1:54321 ws://127.0.0.1:3101 ws://localhost:3101") + "; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; base-uri 'self'");
    return response;
  }
  // A prévia pessoal usa exclusivamente o Auth local e sua própria sessão.
  if (request.nextUrl.pathname.startsWith("/colaborador")) {
    return NextResponse.next({ request });
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw\\.js$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
