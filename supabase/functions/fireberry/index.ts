// פונקציית קצה: חיבור לפיירברי.
// כל משתמש שומר את טוקן ה-API האישי שלו (טבלה fireberry_tokens, נקראת רק כאן), ולכן רואה ומשנה בפיירברי
// בדיוק את מה שההרשאות שלו בפיירברי מאפשרות.
// פעולות: status · objects · search (לקוחות) · records (רשומות של לקוח באובייקט ההזמנות) · attach (צירוף PDF לרשומה).
import { createClient } from "npm:@supabase/supabase-js@2";

const API = "https://api.fireberry.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/'/g, "''").slice(0, 80);

type Rec = Record<string, unknown>;
/** התשובות של פיירברי עטופות בכמה שכבות (data.Data, data.data...). מחזירים את המערך הראשון של רשומות. */
function rows(x: unknown): Rec[] {
  if (Array.isArray(x)) return x.filter((r) => r && typeof r === "object") as Rec[];
  if (x && typeof x === "object") for (const k of ["Data", "data", "Records", "records", "Items", "items", "Result", "result"]) { const r = rows((x as Rec)[k]); if (r.length) return r; }
  return [];
}
const meta = (x: unknown): Rec => { const d = (x as Rec)?.data; return d && typeof d === "object" && !Array.isArray(d) ? (d as Rec) : {}; };
const str = (v: unknown) => (v == null ? "" : String(v)).trim();
const pick = (r: Rec, keys: string[]) => { for (const k of keys) { const v = str(r[k]); if (v) return v; } return ""; };

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
    const { data: tok } = await admin.from("fireberry_tokens").select("token").eq("user_id", who.user.id).maybeSingle();
    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || "");
    if (!tok?.token) return json(mode === "status" ? { connected: false } : { error: "עוד לא חיברת את פיירברי. מוסיפים את הטוקן האישי במסך \"פיירברי\"." }, mode === "status" ? 200 : 400);

    const fb = async (path: string, init: RequestInit = {}) => {
      const r = await fetch(API + path, { ...init, headers: { tokenid: tok.token, Accept: "application/json", ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
      const text = await r.text(); let data: unknown = text; try { data = JSON.parse(text); } catch { /* טקסט */ }
      if (r.status === 401 || r.status === 403) throw Object.assign(new Error("פיירברי דחה את הטוקן. בודקים שהוא הועתק במלואו מפיירברי (פרופיל › אבטחת חשבון › API)."), { status: 401 });
      if (!r.ok || (data as Rec)?.success === false) throw Object.assign(new Error(`פיירברי החזיר שגיאה (${r.status}): ${str((data as Rec)?.message || (data as Rec)?.Message || text).slice(0, 200)}`), { status: 502 });
      return data;
    };
    const query = (objecttype: number, q: string, page_size = 20) => fb("/api/query", { method: "POST", body: JSON.stringify({ objecttype, page_size, page_number: 1, ...(q ? { query: q } : {}) }) });

    if (mode === "status") {
      await query(1, "", 1);
      return json({ connected: true });
    }
    if (mode === "objects") {
      const d = await fb("/metadata/records");
      return json({ objects: rows(d).map((o) => ({ objecttype: Number(o.objectType ?? o.objecttype ?? o.ObjectType ?? o.id), name: pick(o, ["name", "Name", "displayName", "systemName", "SystemName"]) })).filter((o) => o.objecttype) });
    }
    if (mode === "search") {
      const q = esc(str(body.q)); if (q.length < 2) return json({ accounts: [] });
      const digits = q.replace(/\D/g, "");
      const where = [`(accountname like '%${q}%')`, ...(digits.length >= 4 ? [`(telephone1 like '%${digits}%')`, `(telephone2 like '%${digits}%')`] : [])].join(" or ");
      const d = await query(1, where, 20), m = meta(d), pk = str(m.PrimaryKey) || "accountid";
      return json({ accounts: rows(d).map((r) => ({
        id: pick(r, [pk, "accountid"]), name: pick(r, [str(m.PrimaryField) || "accountname", "accountname"]),
        phone: pick(r, ["telephone1", "telephone2", "mobilephone"]), email: pick(r, ["emailaddress1", "emailaddress2"]),
        address: [pick(r, ["billingstreet", "billingaddress", "address1_line1"]), pick(r, ["billingcity", "address1_city"])].filter(Boolean).join(", "),
      })).filter((a) => a.id) });
    }
    if (mode === "records") {
      const object = Number(body.object), account = esc(str(body.accountId));
      if (!object || !account) return json({ error: "חסר אובייקט או לקוח." }, 400);
      const d = await query(object, `(accountid = '${account}')`, 30), m = meta(d), pk = str(m.PrimaryKey), pf = str(m.PrimaryField);
      return json({ records: rows(d).map((r) => ({
        id: pick(r, [pk, ...Object.keys(r).filter((k) => /id$/i.test(k) && k !== "accountid" && k !== "ownerid")]),
        title: pick(r, [pf, "name", "subject", "title"]), number: pick(r, ["ordernumber", "number", "pcfsystemfield1"]),
        date: pick(r, ["createdon", "modifiedon"]),
      })).filter((x) => x.id) });
    }
    if (mode === "attach") {
      const object = Number(body.object), id = str(body.id), b64 = str(body.data);
      if (!object || !id || !b64) return json({ error: "חסרים פרטים לצירוף הקובץ." }, 400);
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      if (bytes.length > 15_000_000) return json({ error: "הקובץ גדול מדי." }, 400);
      const form = new FormData(); form.append("file", new Blob([bytes], { type: "application/pdf" }), str(body.filename) || "barstone.pdf");
      await fb(`/api/v2/record/${object}/${encodeURIComponent(id)}/files`, { method: "POST", body: form });
      return json({ ok: true });
    }
    return json({ error: "פעולה לא מוכרת." }, 400);
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error(err);
    return json({ error: err.message || "שגיאה לא צפויה." }, err.status || 500);
  }
});
