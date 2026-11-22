// פונקציית קצה: חיבור ל-Odoo (JSON-2 ב-Odoo 19 ומעלה, JSON-RPC בגרסאות ישנות; מפתח API של משתמש שירות אחד לכל החברה).
// פעולות: status · order (הזמנת מכירה לפי מזהה או מספר) · find (חיפוש לפי מספר הזמנה או שם לקוח) · attach (צירוף PDF להזמנה, עם הודעה בצ'אטר).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
type Rec = Record<string, unknown>;
const m2o = (v: unknown): [number, string] | null => (Array.isArray(v) && typeof v[0] === "number" ? [v[0], String(v[1] ?? "")] : null);
const str = (v: unknown) => (v == null || v === false ? "" : String(v)).trim();

/** רק https לשרת ציבורי: לא כתובת IP, לא localhost ולא שם פנימי. */
function baseUrl(raw: string): string {
  const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  const h = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || /^[\d.]+$/.test(h) || h.includes(":") || h === "localhost" || !h.includes(".") || /\.(local|internal|lan)$/.test(h)) throw new Error("כתובת ה-Odoo צריכה להיות https לשרת ציבורי.");
  return `https://${u.host}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: who } = await user.auth.getUser();
    const { data: staff } = await user.rpc("is_staff");
    if (!who?.user || !staff) return json({ error: "אין הרשאה." }, 403);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfg } = await admin.from("odoo_config").select("url,db,login,api_key").eq("id", 1).maybeSingle();
    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || "");
    if (!cfg) return json(mode === "status" ? { connected: false } : { error: "Odoo עוד לא מחובר. המנהל מחבר במסך \"Odoo\"." }, mode === "status" ? 200 : 400);
    const base = baseUrl(cfg.url);

    // Odoo 19 ומעלה: JSON-2 (‎/json/2/<model>/<method>, מפתח API ב-Authorization). גרסאות ישנות: JSON-RPC עם משתמש ומפתח.
    const j2 = async (model: string, method: string, kwargs: Rec = {}) => {
      const r = await fetch(`${base}/json/2/${model}/${method}`, { method: "POST", redirect: "error", headers: { "Content-Type": "application/json", Authorization: `bearer ${cfg.api_key}`, ...(cfg.db ? { "X-Odoo-Database": cfg.db } : {}) }, body: JSON.stringify({ context: { lang: "he_IL" }, ...kwargs }) });
      const text = await r.text(); let data: unknown = null; try { data = JSON.parse(text); } catch { /* לא JSON */ }
      if (r.status === 404 && !(data && typeof data === "object" && "message" in (data as Rec))) return { missing: true as const };
      if (r.status === 401 || r.status === 403) throw new Error("Odoo דחה את מפתח ה-API. בדקו את המפתח וההרשאות של המשתמש.");
      if (!r.ok) throw new Error(`Odoo: ${str((data as Rec)?.message) || `שגיאה ${r.status}`}`.slice(0, 300));
      return { missing: false as const, data };
    };
    const rpc = async (service: string, method: string, args: unknown[]) => {
      const r = await fetch(`${base}/jsonrpc`, { method: "POST", headers: { "Content-Type": "application/json" }, redirect: "error", body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: Date.now(), params: { service, method, args } }) });
      const j = await r.json().catch(() => null) as { result?: unknown; error?: { message?: string; data?: { message?: string } } } | null;
      if (!r.ok || !j) throw new Error(`Odoo לא ענה (${r.status}). בדקו את הכתובת.`);
      if (j.error) throw new Error(`Odoo: ${str(j.error.data?.message) || str(j.error.message) || "שגיאה"}`.slice(0, 300));
      return j.result;
    };
    // בדיקת חיבור קובעת באיזה API משתמשים
    let legacyUid = 0, api = "json2";
    const probe = await j2("res.users", "context_get");
    if (probe.missing) {
      api = "jsonrpc";
      const uid = await rpc("common", "authenticate", [cfg.db, cfg.login, cfg.api_key, {}]);
      if (!uid || typeof uid !== "number") return json(mode === "status" ? { connected: false, error: "ההתחברות נדחתה: מסד, משתמש או מפתח API לא נכונים." } : { error: "ההתחברות ל-Odoo נדחתה. בדקו את הפרטים במסך \"Odoo\"." }, mode === "status" ? 200 : 400);
      legacyUid = uid;
    }
    /** קריאה למודל. ids = רשומות שעליהן פועלים; kwargs = פרמטרים בשמם. */
    const kw = async (model: string, method: string, ids: number[] | null, kwargs: Rec = {}) => {
      if (api === "json2") return (await j2(model, method, { ...(ids ? { ids } : {}), ...kwargs })).data;
      return rpc("object", "execute_kw", [cfg.db, legacyUid, cfg.api_key, model, method, ids ? [ids] : [], kwargs]);
    };
    const searchRead = (model: string, domain: unknown[], opts: Rec) => kw(model, "search_read", null, { domain, ...opts }) as Promise<Rec[]>;

    const ORDER_FIELDS = ["name", "partner_id", "partner_shipping_id", "date_order", "state", "client_order_ref", "amount_total"];
    const shape = async (rows: Rec[]) => {
      const ids = [...new Set(rows.flatMap((o) => [m2o(o.partner_id)?.[0], m2o(o.partner_shipping_id)?.[0]]).filter((x): x is number => !!x))];
      // mobile הוסר בגרסאות חדשות: קוראים רק שדות שקיימים
      const have = ids.length ? Object.keys(await kw("res.partner", "fields_get", null, { allfields: ["name", "phone", "mobile", "email", "street", "street2", "city"], attributes: ["type"] }) as Rec) : [];
      const partners = ids.length ? await kw("res.partner", "read", ids, { fields: have }) as Rec[] : [];
      const byId = new Map(partners.map((p) => [p.id as number, p]));
      return rows.map((o) => {
        const p = byId.get(m2o(o.partner_id)?.[0] ?? -1), s = byId.get(m2o(o.partner_shipping_id)?.[0] ?? -1) || p;
        return { id: o.id, name: str(o.name), date: str(o.date_order).slice(0, 10), state: str(o.state), ref: str(o.client_order_ref),
          customer: p ? { id: p.id, name: str(p.name), phone: str(p.mobile) || str(p.phone), email: str(p.email), address: [str(s?.street), str(s?.street2), str(s?.city)].filter(Boolean).join(", ") } : null };
      });
    };

    if (mode === "status") {
      let version = "";
      if (api === "jsonrpc") { const ver = await rpc("common", "version", []) as Rec; version = str(ver?.server_version); }
      return json({ connected: true, version, api, base });
    }
    if (mode === "order") {
      const key = str(body.key).slice(0, 60); if (!key) return json({ error: "חסר מזהה הזמנה." }, 400);
      const domain = /^\d+$/.test(key) ? ["|", ["id", "=", Number(key)], ["name", "=", key]] : [["name", "=ilike", key]];
      const rows = await searchRead("sale.order", domain, { fields: ORDER_FIELDS, limit: 2, order: "id desc" });
      // מזהה מספרי: מעדיפים התאמה לפי id (כך נשלח מהכפתור ב-Odoo)
      const hit = rows.find((o) => String(o.id) === key) || rows[0];
      if (!hit) return json({ error: `לא נמצאה ב-Odoo הזמנה "${key}".` }, 404);
      return json({ order: (await shape([hit]))[0], base });
    }
    if (mode === "find") {
      const q = str(body.q).slice(0, 60); if (q.length < 2) return json({ orders: [] });
      const rows = await searchRead("sale.order", ["|", ["name", "ilike", q], ["partner_id.name", "ilike", q]], { fields: ORDER_FIELDS, limit: 12, order: "date_order desc" });
      return json({ orders: await shape(rows), base });
    }
    if (mode === "attach") {
      const id = Number(body.id), filename = str(body.filename).slice(0, 120) || "barstone.pdf", data = String(body.data || ""), note = str(body.note).slice(0, 400);
      if (!id || !data) return json({ error: "חסר קובץ או הזמנה." }, 400);
      if (data.length > 28_000_000) return json({ error: "הקובץ גדול מדי לצירוף." }, 400);
      const made = await kw("ir.attachment", "create", null, { vals_list: [{ name: filename, datas: data, res_model: "sale.order", res_id: id, mimetype: "application/pdf" }] });
      const att = Array.isArray(made) ? Number(made[0]) : Number(made);
      // הודעה בצ'אטר של ההזמנה עם הקובץ; אם אין הרשאה להודעה — הקובץ עדיין מצורף
      let posted = true;
      try { await kw("sale.order", "message_post", [id], { body: note || "מסמך מ-Barstone הדמיות", attachment_ids: [att], message_type: "comment", subtype_xmlid: "mail.mt_note" }); } catch { posted = false; }
      // טופס ייצור מאושר נשמר גם כ"שרטוט החיבורים" של ההזמנה (אפליקציית המתקינים), אם השדה קיים
      let plan = false;
      if (body.plan === true) { try { await kw("sale.order", "write", [id], { vals: { barstone_plan_joints: data, barstone_plan_joints_name: filename } }); plan = true; } catch { /* אין שדה כזה או אין הרשאה */ } }
      return json({ ok: true, attachment: att, posted, plan });
    }
    return json({ error: "mode לא מוכר." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || "שגיאה לא צפויה." }, 502);
  }
});
