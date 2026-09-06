import { cache } from "react";
import { redirect } from "next/navigation";
import { can, isUserRole, type Capability } from "@metallo/core";
import type { SessionProfile } from "@metallo/types";
import { createClient } from "@/lib/supabase/server";

export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || typeof userId !== "string") return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,role,team_id,active")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data || !isUserRole(data.role)) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    role: data.role,
    teamId: data.team_id,
    active: data.active,
  };
});

export async function requireProfile(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (!profile.active) redirect("/acesso-pendente");
  return profile;
}

export async function requireCapability(capability: Capability) {
  const profile = await requireProfile();
  if (!can(profile.role, capability)) redirect("/sem-permissao");
  return profile;
}
