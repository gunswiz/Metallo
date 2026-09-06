"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@metallo/types";
import { getSupabaseEnv } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  browserClient ??= createBrowserClient<Database>(url, publishableKey);
  return browserClient;
}
