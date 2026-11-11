// פונקציית קצה: יכולות ה-AI של הסטודיו (צילום תוכנית → מטבח, עריכה בשפה חופשית, חוות דעת).
// מפתח ה-API נשמר כסוד בשם ANTHROPIC_API_KEY ב-Supabase בלבד, ולא מגיע לדפדפן.
// גישה: רק משתמש מחובר שנמצא בטבלת staff.
import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.8.0/helpers/beta/zod";
import { z } from "npm:zod@4";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const Side = z.enum(["back", "front", "left", "right"]);
const Draft = z.object({
  thickness: z.number().describe("עובי האבן במ\"מ"),
  apronH: z.number().describe("גובה הקנט הנראה במ\"מ, 0 אם אין"),
  pieces: z.array(z.object({
    ref: z.string().describe("מזהה קצר: P1, P2… שמרו על המזהים הקיימים; לחלק חדש תנו מזהה חדש"),
    name: z.string(),
    kind: z.enum(["counter", "island", "splash", "waterfall", "panel"]),
    x: z.number(), y: z.number(), w: z.number(), h: z.number(),
    wall: Side.nullable(), host: z.string().nullable(), side: Side.nullable(),
    aprons: z.array(Side), grainLock: z.boolean(),
  })),
  cutouts: z.array(z.object({
    piece: z.string(), kind: z.enum(["sink", "cooktop", "faucet", "hole"]),
    x: z.number(), y: z.number(), w: z.number(), h: z.number(), round: z.boolean(),
  })),
});
const Reply = z.object({
  draft: Draft.nullable().describe("המטבח המלא אחרי השינוי. null אם אין שינוי במודל (למשל בחוות דעת)"),
  reply: z.string().describe("תשובה קצרה בעברית למשתמש: מה נעשה או מה ההמלצה"),
  assumptions: z.array(z.string()).describe("הנחות שהנחת או מידות שלא היו ברורות ודורשות בדיקה. ריק אם אין"),
});

const SYSTEM = `אתה מומחה לתכנון וייצור משטחי אבן ופורצלן למטבחים, ועובד בתוך תוכנת ההדמיות של Barstone. המשתמשים הם אנשי מכירות ומודדים.

## מודל המטבח
כל המידות במילימטרים. תוכנית במבט על: x גדל ימינה, y גדל כלפי מטה (אל תוך החדר). הקיר האחורי של המשטח הראשי נמצא ב-y הקטן.
- pieces: חלקי אבן.
  - counter / island / panel הם חלקים אופקיים: x,y = הפינה השמאלית-עליונה בתוכנית, w = המידה לאורך x, h = המידה לאורך y. משטח לאורך הקיר האחורי: w ארוך ו-h הוא העומק (בדרך כלל 600–650). רגל של L או U יורדת מהמשטח הראשי: w = העומק שלה, h = האורך שלה, והיא מתחילה ב-y שבו נגמר המשטח הראשי, בלי חפיפה.
  - wall: הצד של משטח שצמוד לקיר (back = y קטן, front = y גדול, left = x קטן, right = x גדול). לאי: null.
  - splash (חיפוי קיר) ו-waterfall (מפל) הם חלקים אנכיים: host = ה-ref של החלק שאליו הם צמודים, side = הצלע, w = אורך, h = גובה. x,y שלהם 0. חיפוי בדרך כלל על צלע הקיר; מפל על צלעות קצרות של אי, בגובה גובה המשטח (900) פחות העובי.
  - aprons: הצלעות שיש בהן קנט (בדרך כלל הצלע הקדמית הגלויה של משטח, וכל הצלעות הגלויות של אי).
  - grainLock: true = כיוון הגיד נעול (ברירת מחדל).
- cutouts: פתחים. piece = ref של החלק. x,y = הפינה של הפתח בקואורדינטות מקומיות של החלק (מהפינה השמאלית-עליונה שלו), w לאורך x ו-h לאורך y. חור ברז: round=true, קוטר 35, מאחורי הכיור (y קטן).
- מידות טיפוסיות כשאין נתון: עומק משטח 620, כיור 760×400, כיריים 560×490, חיפוי 600, עובי 12, קנט 40, מעבר בין משטח לאי 1000–1100.
- לוח: 3200×1600. חלק ארוך יותר יקבל חיבור אוטומטית.

## כללי מקצוע
לפחות 60 מ"מ בין פתח לקצה המשטח או לחיבור; לפחות 50 מ"מ אבן לפני ואחרי פתח; לפחות 300 מ"מ בין כיור לכיריים; חלקים אופקיים לא חופפים זה לזה.

## המשימות
- mode=plan: מצורף צילום או PDF של תוכנית מטבח או דף מדידה (לפעמים בכתב יד). קרא את המידות בדיוק כפי שכתובות, המר ליחידות מ"מ (שים לב אם המקור בס"מ או במטרים), ובנה draft מלא. אל תמציא מידה שלא מופיעה: אם חסרה, השתמש במידה טיפוסית וציין זאת ב-assumptions. ציין ב-assumptions גם כל מספר שקשה לקרוא. אם התמונה אינה תוכנית מטבח, החזר draft=null והסבר ב-reply.
- mode=chat: שיחה עם איש המכירות. מצורפים המטבח הנוכחי, ממצאי הבדיקה והנסטינג, וההודעות הקודמות. אם הוא מבקש שינוי (להוסיף, להזיז, לשנות מידה, למחוק) — החזר ב-draft את המטבח המלא אחרי השינוי: שנה רק את מה שהתבקש, שמור על כל השאר ועל ה-ref הקיימים, וכתוב ב-reply משפט אחד על מה שנעשה. אם הוא שואל שאלה או מבקש עצה — החזר draft=null וענה ב-reply בקצרה ובמספרים. "שמאלה" = x קטן יותר, "ימינה" = x גדול יותר, "קדימה" = y גדול יותר, "אחורה" = y קטן יותר. מידות שהמשתמש נותן בס"מ או במטרים — המר למ"מ. אם הבקשה לא ברורה או לא אפשרית, החזר draft=null ושאל שאלה אחת.
- mode=advise: מצורפים המטבח וממצאי הבדיקה והנסטינג. החזר draft=null, וב-reply חוות דעת מקצועית קצרה (עד 6 נקודות): מה חשוב לתקן לפני ייצור, איך לשפר את רצף הגידים והמראה (חיבורים, מפל, חיפוי, כיוון גיד), ואיך לחסוך לוחות. היה קונקרטי עם מספרים; אל תחזור על הממצאים כלשונם.

כתוב תמיד בעברית פשוטה וקצרה, בלי כותרות.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: staff, error: staffErr } = await sb.rpc("is_staff");
    if (staffErr || !staff) return json({ error: "אין הרשאה." }, 403);
    if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "יכולות ה-AI עוד לא הופעלו: צריך להגדיר את הסוד ANTHROPIC_API_KEY ב-Supabase (Edge Functions › Secrets)." }, 503);

    const body = await req.json();
    const mode = body.mode as "plan" | "chat" | "edit" | "advise";
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (mode === "plan") {
      const data = String(body.data || ""), media = String(body.media_type || "");
      if (!data || data.length > 17_000_000) return json({ error: "הקובץ חסר או גדול מדי." }, 400);
      if (media === "application/pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
      else if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(media)) content.push({ type: "image", source: { type: "base64", media_type: media as "image/jpeg", data } });
      else return json({ error: "סוג קובץ לא נתמך. אפשר JPG, PNG, WEBP או PDF." }, 400);
      content.push({ type: "text", text: "mode=plan\nבנה את המטבח מהתוכנית המצורפת." });
    } else if (mode === "chat" || mode === "edit") {
      const text = String(body.text || "").slice(0, 2000);
      if (!text.trim() || !body.draft) return json({ error: "חסרה בקשה." }, 400);
      const history = (Array.isArray(body.history) ? body.history : []).slice(-10)
        .map((m: { role?: string; text?: string }) => `${m.role === "ai" ? "העוזר" : "המשתמש"}: ${String(m.text || "").slice(0, 600)}`).join("\n");
      content.push({ type: "text", text: `mode=chat\nהמטבח הנוכחי:\n${JSON.stringify(body.draft)}\n\nממצאי הבדיקה והנסטינג:\n${JSON.stringify(body.facts || {})}\n\nהשיחה עד כה:\n${history || "(אין)"}\n\nההודעה החדשה של המשתמש:\n${text}` });
    } else if (mode === "advise") {
      content.push({ type: "text", text: `mode=advise\nהמטבח:\n${JSON.stringify(body.draft)}\n\nממצאי הבדיקה והנסטינג:\n${JSON.stringify(body.facts || {})}` });
    } else return json({ error: "mode לא מוכר." }, 400);

    const client = new Anthropic();
    const res = await client.beta.messages.parse({
      model: "claude-fable-5-2",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // אם המודל מסרב מסיבת מדיניות, הבקשה ממשיכה אוטומטית במודל חלופי
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: mode === "plan" ? "medium" : "low", format: betaZodOutputFormat(Reply) },
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal") return json({ error: "המודל לא יכול היה לטפל בבקשה הזו." }, 422);
    if (res.stop_reason === "max_tokens" || !res.parsed_output) return json({ error: "התשובה נקטעה. נסו בקשה קצרה יותר." }, 502);
    return json(res.parsed_output);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "מפתח ה-API של Anthropic לא תקין." }, 503);
    if (e instanceof Anthropic.RateLimitError) return json({ error: "יותר מדי בקשות כרגע. נסו שוב בעוד דקה." }, 429);
    if (e instanceof Anthropic.BadRequestError) return json({ error: `הבקשה נדחתה: ${e.message}` }, 400);
    if (e instanceof Anthropic.APIError) return json({ error: `שגיאת שירות (${e.status}). נסו שוב.` }, 502);
    console.error(e);
    return json({ error: "שגיאה לא צפויה." }, 500);
  }
});
