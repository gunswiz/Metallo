"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loginSchema, resetPasswordSchema, updatePasswordSchema } from "@metallo/validation";
import { resolveApplicationOrigin } from "@/lib/auth/application-origin";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function signIn(formData: FormData) {
  const parsed = loginSchema.safeParse({ email: value(formData, "email"), password: value(formData, "password") });
  if (!parsed.success) redirect("/login?error=dados-invalidos");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=credenciais-invalidas");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({ email: value(formData, "email") });
  if (!parsed.success) redirect("/recuperar-senha?error=email-invalido");
  const requestHeaders = await headers();
  const origin = resolveApplicationOrigin({
    origin: requestHeaders.get("origin"),
    forwardedHost: requestHeaders.get("x-forwarded-host"),
    forwardedProto: requestHeaders.get("x-forwarded-proto"),
    host: requestHeaders.get("host"),
  });
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/atualizar-senha`,
  });
  redirect("/recuperar-senha?sent=1");
}

export async function updatePassword(formData: FormData) {
  const parsed = updatePasswordSchema.safeParse({
    password: value(formData, "password"),
    confirmation: value(formData, "confirmation"),
  });
  if (!parsed.success) redirect("/atualizar-senha?error=senha-invalida");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) redirect("/atualizar-senha?error=falha");
  redirect("/dashboard?password=updated");
}
