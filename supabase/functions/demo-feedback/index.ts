// פונקציית קצה: משובים מגרסת הדמו (בלי התחברות). נשמרים בטבלת feedback מסומנים "דמו", עם מגבלה נגד הצפה.
import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const KINDS = ["bug", "idea", "design", "other"];
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    const text = String(b.text || "").trim().slice(0, 2000), kind = KINDS.includes(b.kind) ? b.kind : "other";
    if (text.length < 2) return json({ error: "חסר טקסט." }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db.from("feedback").select("id", { count: "exact", head: true }).eq("email", "דמו").gte("created_at", since);
    if ((count ?? 0) >= 60) return json({ error: "יותר מדי הערות בשעה האחרונה. נסו שוב מאוחר יותר." }, 429);
    const { error } = await db.from("feedback").insert({ kind, text, email: "דמו", screen: `דמו · ${String(b.screen || "").slice(0, 80)}`, route: String(b.route || "").slice(0, 200) });
    if (error) throw error;
    return json({ ok: true });
  } catch (e) { console.error(e); return json({ error: "שגיאה לא צפויה." }, 500); }
});
