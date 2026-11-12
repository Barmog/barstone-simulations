// פונקציית קצה: חיבור לפיירברי.
// כל משתמש שומר את טוקן ה-API האישי שלו (טבלה fireberry_tokens, נקראת רק כאן), ולכן רואה ומשנה בפיירברי
// בדיוק את מה שההרשאות שלו בפיירברי מאפשרות.
// פעולות: status · objects · search (לקוחות) · records (רשומות של לקוח באובייקט ההזמנות) · find (חיפוש אחד: שם לקוח או מספר הזמנה)
// · measures (מדידות של לקוח והקבצים שלהן) · file (הורדת קובץ מדידה) · attach (צירוף PDF לרשומה).
import { createClient } from "npm:@supabase/supabase-js@2";

const API = "https://api.fireberry.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: string) => s.slice(0, 80).replace(/'/g, "''"); // קודם חותכים, אחר כך מכפילים גרש — כדי שלא יישאר גרש בודד

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
    if (mode === "find") {
      // חיפוש אחד לאנשי המכירות: שם לקוח, טלפון או מספר הזמנה — ומחזירים הזמנות מוכנות לקישור
      const object = Number(body.object), q = esc(str(body.q)), digits = q.replace(/\D/g, "");
      if (!object) return json({ error: "המנהל עוד לא בחר במסך \"פיירברי\" באיזה אובייקט נמצאות ההזמנות." }, 400);
      if (q.length < 2) return json({ orders: [], accounts: [] });
      // שדות "מספר" באובייקט ההזמנות (לפי שם השדה או התווית), כדי לחפש גם לפי מספר הזמנה
      let numFields: string[] = [];
      try {
        const md = await fb(`/metadata/records/${object}/fields`);
        numFields = rows(md).map((f) => ({ n: pick(f, ["systemName", "fieldName", "name"]), l: pick(f, ["label", "displayName", "Label"]) }))
          .filter((f) => f.n && (/number|num|^no$|_no$|code/i.test(f.n) || /מספר|מס'|מס׳/.test(f.l))).map((f) => f.n).slice(0, 4);
      } catch { /* בלי מטא־דאטה: מחפשים בשדה הראשי */ }
      const acc = async (where: string, n: number) => { const d = await query(1, where, n), m = meta(d), pk = str(m.PrimaryKey) || "accountid";
        return rows(d).map((r) => ({ id: pick(r, [pk, "accountid"]), name: pick(r, [str(m.PrimaryField) || "accountname", "accountname"]), phone: pick(r, ["telephone1", "telephone2", "mobilephone"]), email: pick(r, ["emailaddress1", "emailaddress2"]),
          address: [pick(r, ["billingstreet", "billingaddress", "address1_line1"]), pick(r, ["billingcity", "address1_city"])].filter(Boolean).join(", ") })).filter((a) => a.id); };
      const ordersWhere = async (where: string, n: number) => { const d = await query(object, where, n), m = meta(d), pk = str(m.PrimaryKey), pf = str(m.PrimaryField);
        return { pf, list: rows(d).map((r) => ({ id: pick(r, [pk, ...Object.keys(r).filter((k) => /id$/i.test(k) && k !== "accountid" && k !== "ownerid")]), title: pick(r, [pf, "name", "subject", "title"]),
          number: pick(r, [...numFields, "ordernumber", "number", "pcfsystemfield1"]), date: pick(r, ["createdon", "modifiedon"]), accountId: pick(r, ["accountid"]), accountName: pick(r, ["accountidname", "accountname"]) })).filter((x) => x.id) }; };
      const accWhere = [`(accountname like '%${q}%')`, ...(digits.length >= 4 ? [`(telephone1 like '%${digits}%')`, `(telephone2 like '%${digits}%')`] : [])].join(" or ");
      const [accounts, byText] = await Promise.all([
        acc(accWhere, 8).catch((e) => { if ((e as { status?: number }).status === 401) throw e; return []; }),
        (async () => { const probe = await ordersWhere("", 1).catch(() => ({ pf: "", list: [] })); const pf = probe.pf || "name";
          const conds = [`(${pf} like '%${q}%')`, ...numFields.map((f) => `(${f} like '%${q}%')`)].join(" or ");
          return (await ordersWhere(conds, 20).catch(() => ordersWhere(`(${pf} like '%${q}%')`, 20).catch(() => ({ pf, list: [] })))).list; })(),
      ]);
      // הזמנות של הלקוחות שנמצאו לפי שם
      const ofAccounts = (await Promise.all(accounts.slice(0, 4).map((a) => ordersWhere(`(accountid = '${esc(a.id)}')`, 15).then((r) => r.list).catch(() => [])))).flat();
      const seen = new Set<string>(), all = [...byText, ...ofAccounts].filter((o) => !seen.has(o.id) && seen.add(o.id));
      // פרטי הלקוח של כל הזמנה (שם, טלפון, כתובת) — לפתיחה אוטומטית של הלקוח במערכת
      const need = [...new Set(all.map((o) => o.accountId).filter((id) => id && !accounts.some((a) => a.id === id)))].slice(0, 15);
      const more = need.length ? await acc(need.map((id) => `(accountid = '${esc(id)}')`).join(" or "), need.length).catch(() => []) : [];
      const byId = new Map([...accounts, ...more].map((a) => [a.id, a]));
      const orders = all.slice(0, 30).map((o) => ({ id: o.id, title: o.title, number: o.number, date: o.date, account: byId.get(o.accountId) || (o.accountId ? { id: o.accountId, name: o.accountName, phone: "", email: "", address: "" } : null) }));
      return json({ orders, accounts: accounts.filter((a) => !orders.some((o) => o.account?.id === a.id)) });
    }
    // --- מדידות: רשומות הלקוח באובייקט המדידות, והקבצים שצורפו אליהן (PDF / DXF / תמונה) ---
    const FILE_EXT = /\.(pdf|dxf|dwg|jpe?g|png|webp|heic)(\?|$)/i;
    const asFiles = (x: unknown) => rows(x).map((f) => ({
      id: pick(f, ["fileid", "fileId", "FileId", "id", "Id", "documentid"]),
      name: pick(f, ["filename", "fileName", "FileName", "name", "Name", "title", "originalname"]),
      url: pick(f, ["url", "Url", "fileurl", "fileUrl", "downloadUrl", "downloadurl", "link", "path", "fileLink"]),
      date: pick(f, ["createdon", "createdOn", "date", "modifiedon"]),
    })).filter((f) => f.id || f.url);
    if (mode === "measures") {
      const object = Number(body.object) || 1001, account = esc(str(body.accountId)), orderId = str(body.orderId);
      if (!account) return json({ error: "חסר לקוח." }, 400);
      const d = await query(object, `(accountid = '${account}')`, 15), m = meta(d), pk = str(m.PrimaryKey), pf = str(m.PrimaryField);
      const recs = rows(d).map((r) => ({ r, id: pick(r, [pk, ...Object.keys(r).filter((k) => /id$/i.test(k) && k !== "accountid" && k !== "ownerid")]) })).filter((x) => x.id);
      const out = [];
      for (const { r, id } of recs.slice(0, 8)) {
        let files: { id: string; name: string; url: string; date: string }[] = [];
        for (const path of [`/api/v2/record/${object}/${encodeURIComponent(id)}/files`, `/api/record/${object}/${encodeURIComponent(id)}/files`]) {
          try { files = asFiles(await fb(path)); if (files.length) break; } catch (e) { if ((e as { status?: number }).status === 401) throw e; }
        }
        // שדות קובץ / קישור בתוך הרשומה עצמה
        for (const [k, v] of Object.entries(r)) { const u = str(v); if (/^https:\/\//.test(u) && FILE_EXT.test(u) && !files.some((f) => f.url === u)) files.push({ id: "", name: decodeURIComponent(u.split("/").pop()!.split("?")[0]) || k, url: u, date: "" }); }
        out.push({ id, title: pick(r, [pf, "name", "subject", "title"]) || "מדידה", date: pick(r, ["createdon", "modifiedon"]),
          order: !!orderId && Object.values(r).some((v) => str(v) === orderId), files: files.filter((f) => !f.name || FILE_EXT.test(f.name) || FILE_EXT.test(f.url)) });
      }
      out.sort((a, b) => Number(b.order) - Number(a.order) || b.date.localeCompare(a.date));
      return json({ measures: out });
    }
    /** רק קישורים מאובטחים של פיירברי ושל שירותי האחסון שלו. מחזיר את שם השרת, או "" אם לא מותר. */
    const okHost = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" && /(^|\.)(fireberry\.com|powerlink\.co\.il|amazonaws\.com|blob\.core\.windows\.net|cloudfront\.net)$/i.test(x.hostname) ? x.hostname : ""; } catch { return ""; } };
    if (mode === "file") {
      const object = Number(body.object) || 1001, rec = str(body.recordId), fid = str(body.fileId), url = str(body.url);
      let r: Response | null = null;
      /** הורדה עם מעקב ידני אחרי הפניות: הטוקן רק לבקשה הראשונה ורק לשרת של פיירברי; כל הפניה חייבת להיות לשרת מוכר. */
      const getFollow = async (start: string): Promise<Response | null> => {
        let next = start, hops = 0;
        while (true) {
          const h = okHost(next); if (!h) return null;
          const own = /(^|\.)(fireberry\.com|powerlink\.co\.il)$/i.test(h);
          const x: Response = await fetch(next, { redirect: "manual", headers: own && hops === 0 ? { tokenid: tok.token } : {} });
          const loc = x.status >= 300 && x.status < 400 ? x.headers.get("location") : null;
          if (!loc) return x;
          next = new URL(loc, next).toString(); if (++hops > 4) return null;
        }
      };
      if (url) {
        if (!okHost(url)) return json({ error: "קישור הקובץ לא מוכר." }, 400);
        r = await getFollow(url);
        if (!r) return json({ error: "קישור הקובץ הפנה לכתובת לא מוכרת." }, 400);
      } else if (rec && fid) {
        for (const path of [`/api/v2/record/${object}/${encodeURIComponent(rec)}/files/${encodeURIComponent(fid)}`, `/api/record/${object}/${encodeURIComponent(rec)}/files/${encodeURIComponent(fid)}`, `/api/v2/file/${encodeURIComponent(fid)}`]) {
          const x = await getFollow(API + path); if (x?.ok) { r = x; break; }
        }
      } else return json({ error: "חסר קובץ." }, 400);
      if (!r || !r.ok) return json({ error: `לא הצלחתי להוריד את הקובץ מפיירברי (${r?.status ?? "?"}).` }, 502);
      const type = r.headers.get("content-type") || "";
      let buf = new Uint8Array(await r.arrayBuffer());
      // לפעמים חוזר JSON עם קישור להורדה
      if (/json/i.test(type)) { const j = JSON.parse(new TextDecoder().decode(buf)); const u = pick(j as Rec, ["url", "downloadUrl", "fileUrl"]) || pick(meta(j), ["url", "downloadUrl", "fileUrl"]);
        if (!u || !okHost(u)) return json({ error: "פיירברי לא החזיר את הקובץ." }, 502); const x = await getFollow(u); if (!x?.ok) return json({ error: "הורדת הקובץ נכשלה." }, 502); buf = new Uint8Array(await x.arrayBuffer()); }
      if (buf.length > 15_000_000) return json({ error: "הקובץ גדול מ-15MB." }, 400);
      let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return json({ data: btoa(bin), type: /json/i.test(type) ? "" : type, size: buf.length });
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
