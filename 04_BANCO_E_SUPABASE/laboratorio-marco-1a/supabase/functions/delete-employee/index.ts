import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async (req: Request) => {
  const headers = { "Content-Type": "application/json" };
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers});
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = createClient(url, anon, {global:{headers:{Authorization:auth}}});
    const {data:{user}} = await caller.auth.getUser();
    if (!user) return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers});
    const admin = createClient(url, service);
    const {data:profile} = await admin.from("profiles").select("role,active").eq("id",user.id).single();
    if (!profile?.active || profile.role!=="admin") return new Response(JSON.stringify({error:"admin_required"}),{status:403,headers});
    const body = await req.json(); const target = body?.user_id;
    if (!target || target===user.id) return new Response(JSON.stringify({error: target===user.id?"cannot_delete_self":"user_required"}),{status:400,headers});
    const {error} = await admin.auth.admin.deleteUser(target);
    if (error) throw error;
    return new Response(JSON.stringify({ok:true}),{status:200,headers});
  } catch(e) { return new Response(JSON.stringify({error:String(e?.message ?? e)}),{status:400,headers}); }
});
