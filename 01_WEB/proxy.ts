import type { NextRequest } from "next/server";
import { updateSession } from "@/05_ACESSO_A_DADOS/Supabase/proxy";
import { NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  if (process.env.METALLO_COLABORADOR_PREVIEW === "1" || process.env.METALLO_COLABORADOR_VISUAL_PREVIEW === "1") {
    const pointLabTransport = process.env.METALLO_COLABORADOR_PREVIEW === "1" && (request.nextUrl.pathname.startsWith("/api/ponto-lab/") || request.nextUrl.pathname.startsWith("/api/ponto-online/") || request.nextUrl.pathname.startsWith("/api/ponto-registros/"));
    const signatureLabTransport = process.env.METALLO_COLABORADOR_PREVIEW === "1" && request.nextUrl.pathname === "/api/laboratorio/assinatura-epi";
    if (!pointLabTransport && !signatureLabTransport && !request.nextUrl.pathname.startsWith("/colaborador") && !request.nextUrl.pathname.startsWith("/_next/") && request.nextUrl.pathname !== "/manifest.webmanifest") {
      return new NextResponse(null, { status: 404 });
    }
    const response = NextResponse.next({ request });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Content-Security-Policy", "default-src 'self'; connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:3101 ws://localhost:3101; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; base-uri 'self'");
    return response;
  }
  // A prévia pessoal usa exclusivamente o Auth local e sua própria sessão.
  if (request.nextUrl.pathname.startsWith("/colaborador")) {
    return NextResponse.next({ request });
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
