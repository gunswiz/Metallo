import { NextResponse } from "next/server";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { safeRedirectPath } from "@/03_FUNCOES_E_LOGICA/Autenticacao/redirects";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeRedirectPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=callback", url.origin));
}
