// פונקציית קצה: הקישור של הלקוח. בלי התחברות — רק עם הטוקן שבקישור.
// get: ההדמיה, שם הלקוח ומצב האישור · sign: אישור עם שם וחתימה, ושמירת מיקום הגיד שהלקוח בחר.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Manual = Record<string, { slab: number; x: number; y: number; rot?: boolean }>;

/** רק סידור על הלוחות — שום שדה אחר מהלקוח לא נכנס להזמנה. */
function cleanManual(x: unknown): Manual | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const out: Manual = {}; let n = 0;
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (++n > 300 || k.length > 120 || !v || typeof v !== "object") return null;
    const { slab, x: px, y: py, rot } = v as Record<string, unknown>;
    if (!Number.isInteger(slab) || (slab as number) < 0 || (slab as number) > 60 || typeof px !== "number" || typeof py !== "number" || !isFinite(px) || !isFinite(py) || Math.abs(px) > 20000 || Math.abs(py) > 20000) return null;
    out[k] = { slab: slab as number, x: Math.round(px), y: Math.round(py), ...(rot === true ? { rot: true } : {}) };
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "");
    if (!UUID.test(token)) return json({ error: "הקישור לא תקין." }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: share } = await db.from("order_shares").select("*").eq("token", token).maybeSingle();
    if (!share) return json({ error: "הקישור לא נמצא. בקשו מהנציג קישור חדש." }, 404);
    if (!share.signed_at && new Date(share.expires_at) < new Date()) return json({ error: "תוקף הקישור פג. בקשו מהנציג קישור חדש." }, 410);
    const { data: order } = await db.from("orders").select("id,title,order_no,status,project,customer_id,updated_at").eq("id", share.order_id).maybeSingle();
    if (!order) return json({ error: "ההזמנה לא נמצאה." }, 404);

    if (body.mode === "get") {
      const { data: cust } = await db.from("customers").select("name,address").eq("id", order.customer_id).maybeSingle();
      if (!share.viewed_at) await db.from("order_shares").update({ viewed_at: new Date().toISOString() }).eq("token", token);
      return json({
        order: { id: order.id, title: order.title, order_no: order.order_no, status: order.status, project: share.signed_at && share.layout ? { ...order.project, manual: share.layout } : order.project, updated_at: order.updated_at },
        customer: { name: cust?.name || "", address: cust?.address || "" },
        share: { signed_at: share.signed_at, signer_name: share.signer_name, signature: share.signature, expires_at: share.expires_at },
      });
    }
    if (body.mode === "sign") {
      if (share.signed_at) return json({ error: "ההדמיה כבר אושרה." }, 409);
      const name = String(body.name || "").trim().slice(0, 80), sig = String(body.signature || ""), note = String(body.note || "").trim().slice(0, 1000);
      if (name.length < 2) return json({ error: "חסר שם מלא." }, 400);
      if (!sig.startsWith("data:image/png;base64,") || sig.length > 400_000) return json({ error: "חסרה חתימה." }, 400);
      const manual = body.manual == null ? null : cleanManual(body.manual);
      if (body.manual != null && !manual) return json({ error: "הסידור על הלוחות לא תקין." }, 400);
      const prev = JSON.stringify(order.project?.manual || {}), changed = !!manual && JSON.stringify(manual) !== prev;
      const now = new Date().toISOString();
      // סידור שיוצא מהלוח לא נחתם (הבדיקה המלאה של חפיפות נעשית בדפדפן של הלקוח לפני החתימה)
      const W = Number(order.project?.slabW) || 3200, H = Number(order.project?.slabH) || 1600;
      if (manual && Object.values(manual).some((v) => v.x < 0 || v.y < 0 || v.x > W || v.y > H)) return json({ error: "חלק יוצא מגבולות הלוח. מזיזים אותו ומנסים שוב." }, 400);
      // חתימה אחת בלבד: רק בקשה שבאמת עדכנה את השורה ממשיכה לעדכן את ההזמנה
      const { data: upd, error: e1 } = await db.from("order_shares").update({ signed_at: now, signer_name: name, signature: sig, customer_note: note || null, layout: manual, layout_changed: changed }).eq("token", token).is("signed_at", null).select("token");
      if (e1) throw e1;
      if (!upd?.length) return json({ error: "ההדמיה כבר אושרה." }, 409);
      const project = changed ? { ...order.project, manual } : order.project;
      const { error: e2 } = await db.from("orders").update({ status: "approved", project }).eq("id", order.id);
      if (e2) throw e2;
      return json({ ok: true, signed_at: now });
    }
    return json({ error: "פעולה לא מוכרת." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "שגיאה לא צפויה. נסו שוב." }, 500);
  }
});
