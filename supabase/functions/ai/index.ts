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
    joint: z.enum(["auto", "sink", "cooktop"]).describe("היכן החיבור אם החלק ארוך מהלוח"),
    corner: z.enum(["butt", "miter"]).describe("חיבור פינה עם המשטח הסמוך: ישר או גרונג 45"),
    seat: Side.nullable().describe("צד הישיבה (בליטה של 30 ס\"מ לכיסאות) או null"), chairs: z.number().nullable().describe("מספר כיסאות, 60 ס\"מ לכיסא"),
  })),
  cutouts: z.array(z.object({
    piece: z.string(), kind: z.enum(["sink", "cooktop", "faucet", "hole"]),
    x: z.number(), y: z.number(), w: z.number(), h: z.number(), round: z.boolean(),
    built: z.boolean().describe("כיור בנוי מאבן"), cabinet: z.number().nullable().describe("רוחב ארון הכיור במ\"מ"), bowls: z.enum(["single", "even", "ls"]),
    drainCover: z.boolean().describe("כיור בנוי: ונטיל, מכסה ניקוז מאותה אבן"),
  })),
  settings: z.object({
    uppers: z.boolean(), cabinets: z.boolean(), cabinetColor: z.string().describe("#rrggbb"), wallColor: z.string().describe("#rrggbb"),
    floor: z.enum(["oak", "oak-light", "oak-grey", "oak-smoked", "walnut", "wenge", "ash-narrow", "concrete", "micro-light", "porcelain-white", "porcelain-beige", "porcelain-grey", "slate", "terrazzo", "checker"]),
    light: z.enum(["day", "evening"]), kelvin: z.union([z.literal(3000), z.literal(4000), z.literal(6000)]), bookmatch: z.enum(["yes", "no", "unknown"]),
    disposal: z.boolean(), water: z.boolean(), xray: z.boolean(),
    underLight: z.boolean().describe("תאורה מתחת לארונות העליונים"), upperH: z.number().describe("גובה הארונות העליונים במ\"מ, 300–1200"),
    upperStyle: z.enum(["doors", "klapa", "glass", "shelves"]), upperColor: z.string().describe("#rrggbb"), plinthStone: z.boolean().describe("צוקל מאבן"),
    faucet: z.enum(["K149", "K570", "K569", "K655", "K727", "K121", "K114", "K816", "4in1"]), faucetFinish: z.enum(["chrome", "black", "gold", "rose", "graphite", "nickel", "white"]),
  }),
});
const Reply = z.object({
  draft: Draft.nullable().describe("המטבח המלא אחרי השינוי. null אם אין שינוי במודל (למשל בחוות דעת)"),
  reply: z.string().describe("תשובה קצרה בעברית למשתמש: מה נעשה או מה ההמלצה"),
  missing: z.string().nullable().describe("אם המשתמש ביקש משהו שהמודל הזה לא יכול לייצג או לבצע — תיאור קצר של מה שחסר במערכת. אחרת null"),
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
- joint בכל משטח: היכן יעבור החיבור אם המשטח ארוך מהלוח (מעל 320 ס"מ): auto, sink (במרכז הכיור) או cooktop (במרכז הכיריים). כשחייבים חיבור, בדרך כלל מעדיפים במרכז הכיור או הכיריים — שם הוא הכי קצר.
- corner ברגל של L/U: butt = חיבור פינה ישר, miter = גרונג 45°.
- כיור: built = בנוי מאבן (נכנס לנסטינג) או קנוי; cabinet = רוחב ארון הכיור (600/700/800/900); bowls = single / even (כפול חצי-חצי) / ls (כפול גדול+קטן). נטו משוער: כיור קנוי ≈ רוחב הארון פחות 100 מ"מ; בנוי ≈ רוחב הארון פחות 36 פחות פעמיים עובי האבן.
- settings: סביבת ההדמיה. uppers/cabinets = ארונות עליונים/תחתונים; cabinetColor, wallColor בפורמט #rrggbb; floor = אחד מהמזהים (oak אלון טבעי, oak-light אלון מולבן, oak-grey אלון אפור, oak-smoked אלון מעושן, walnut אגוז, wenge ונגה, ash-narrow פרקט צר בהיר, concrete בטון מוחלק, micro-light מיקרוטופינג בהיר, porcelain-white/beige/grey פורצלן, slate צפחה שחורה, terrazzo טרצו, checker שחמט); light = day/evening; kelvin = 3000 חם / 4000 ניטרלי / 6000 קר; bookmatch = האם הדגם בוק־מאץ'; disposal = טוחן אשפה; water = מערכת מים; xray = להציג את פנים הארון.
- חיפוי קיר: 60 ס"מ = h 600; עד הארונות העליונים = 600 (1500 פחות גובה המשטח 900); עד התקרה = 1580 (מוגבל לרוחב הלוח). "בלי חיפוי" = למחוק את חלקי ה-splash.
- ארונות עליונים: הקו העליון קבוע ב-2200. upperH = גובה הארון (ברירת מחדל 700), ולכן המרווח מעל המשטח הוא 2200 פחות upperH פחות 900; "חיפוי עד הארונות" = המרווח הזה. upperStyle: doors דלתות, klapa קלאפות, glass ויטרינת זכוכית, shelves מדפים פתוחים. underLight = פס תאורה מתחת לארונות.
- ישיבה: משטח או אי ברוחב מעל 800 הוא בדרך כלל דלפק או אי עם ישיבה. seat = הצד שבו המשטח בולט 300 מעבר לארונות; chairs = מספר כיסאות (כיסא לכל 600 מ"מ אורך).
- plinthStone = צוקל מאבן (פס בגובה 100 לאורך חזית הארונות, נכנס לנסטינג). drainCover בכיור בנוי = ונטיל מאבן. כיור בנוי הוא תמיד בהתקנה תחתונה ובנוי מארבע דפנות ותחתית.
- ברז: faucet אחד מהדגמים בקטלוג; 4in1 הוא ברז שמוציא גם מים מסוננים חמים וקרים (water=true). faucetFinish: chrome כרום, black שחור, gold זהב, rose רוז גולד, graphite גרפיט, nickel ניקל מוברש, white לבן.
- מטר רץ לתמחור: האורך הוא המטר הרץ, והרוחב קובע מקדם: עד 200 מ"מ שליש, 200–300 חצי, 310–700 מטר רגיל, 700–1500 כפול. כששואלים על כמות או מחיר, חשב לפי זה.
- יצירת מטבח ממלל חופשי: כשמבקשים "מטבח L 3.2 על 2.4" וכדומה, בנה את כל החלקים מחדש לפי המידות (עומק 620 אם לא נאמר אחרת), עם כיור, ברז וכיריים במיקומים סבירים.
- אין התחייבות לגידים: אל תבטיח התאמת גידים מלאה; אם bookmatch אינו yes ויש חיבורים, הזכר שכדאי לוודא.
- מידות טיפוסיות כשאין נתון: עומק משטח 620, כיור 760×400, כיריים 560×490, חיפוי 600, עובי 12, קנט 40, מעבר בין משטח לאי 1000–1100.
- לוח: 3200×1600. חלק ארוך יותר יקבל חיבור אוטומטית.

## כללי מקצוע
לפחות 60 מ"מ בין פתח לקצה המשטח או לחיבור (חוץ מחיבור שעובר בכוונה במרכז הכיור או הכיריים); לפחות 50 מ"מ אבן לפני ואחרי פתח; לפחות 300 מ"מ בין כיור לכיריים; חלקים אופקיים לא חופפים זה לזה.

## המשימות
- mode=plan: מצורף צילום או PDF של תוכנית מטבח או דף מדידה (לפעמים בכתב יד). קרא את המידות בדיוק כפי שכתובות, המר ליחידות מ"מ (שים לב אם המקור בס"מ או במטרים), ובנה draft מלא עם settings סבירים (uppers true, cabinets true, cabinetColor #f4f3ef, upperColor #f4f3ef, wallColor #f4f2ee, floor oak, light day, kelvin 4000, bookmatch unknown, underLight true, upperH 700, upperStyle doors, faucet K149, faucetFinish chrome, והשאר false). אל תמציא מידה שלא מופיעה: אם חסרה, השתמש במידה טיפוסית וציין זאת ב-assumptions. ציין ב-assumptions גם כל מספר שקשה לקרוא. אם התמונה אינה תוכנית מטבח, החזר draft=null והסבר ב-reply.
- mode=photo: מצורפת תמונה של מטבח קיים (לא תוכנית). זהה את צורת המטבח (ישר, L, U, אי), היכן הכיור והכיריים, והערך מידות לפי אמות מידה נראות: דלת ארון תחתון רגילה ברוחב 600, מדיח 600, כיריים 600, מקרר 700–900, עומק משטח 600–650, גובה משטח 900. בנה draft מלא עם settings כמו ב-mode=plan. כל המידות הן הערכה: כתוב ב-assumptions כל מידה משוערת ואת רמת הביטחון, וכתוב ב-reply משפט אחד שמבהיר שחובה לאמת במדידה. אם התמונה אינה מטבח, החזר draft=null.
- mode=chat: שיחה עם איש המכירות. מצורפים המטבח הנוכחי, ממצאי הבדיקה והנסטינג, וההודעות הקודמות. אם הוא מבקש שינוי (להוסיף, להזיז, לשנות מידה, למחוק, לשנות צבע, ריצוף, תאורה, כיור, חיבור וכדומה) — החזר ב-draft את המטבח המלא אחרי השינוי: שנה רק את מה שהתבקש, שמור על כל השאר ועל ה-ref הקיימים, וכתוב ב-reply משפט אחד על מה שנעשה. אפשר לבצע כמה שינויים בבקשה אחת. אם הוא שואל שאלה או מבקש עצה — החזר draft=null וענה ב-reply בקצרה ובמספרים. "שמאלה" = x קטן יותר, "ימינה" = x גדול יותר, "קדימה" = y גדול יותר, "אחורה" = y קטן יותר. מידות שהמשתמש נותן בס"מ או במטרים — המר למ"מ. אם הבקשה לא ברורה, החזר draft=null ושאל שאלה אחת. אם ביקשו משהו שהמודל הזה לא יכול לייצג (מוצר, צורה או אפשרות שלא קיימים בשדות), בצע את מה שכן אפשר, הסבר ב-reply מה לא נכנס, וכתוב ב-missing תיאור קצר של מה שחסר.
- mode=advise: מצורפים המטבח וממצאי הבדיקה והנסטינג. החזר draft=null, וב-reply חוות דעת מקצועית קצרה (עד 6 נקודות): מה חשוב לתקן לפני ייצור, היכן כדאי לשים חיבורים (מרכז כיור או כיריים, פינה ישרה או 45°), איך לשפר את המראה (מפל, חיפוי, כיוון גיד), ואיך לחסוך לוחות. היה קונקרטי עם מספרים; אל תחזור על הממצאים כלשונם.

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
    const mode = body.mode as "plan" | "photo" | "chat" | "edit" | "advise";
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (mode === "plan" || mode === "photo") {
      const data = String(body.data || ""), media = String(body.media_type || "");
      if (!data || data.length > 17_000_000) return json({ error: "הקובץ חסר או גדול מדי." }, 400);
      if (media === "application/pdf" && mode === "plan") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
      else if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(media)) content.push({ type: "image", source: { type: "base64", media_type: media as "image/jpeg", data } });
      else return json({ error: "סוג קובץ לא נתמך. אפשר JPG, PNG, WEBP או PDF." }, 400);
      content.push({ type: "text", text: mode === "photo" ? "mode=photo\nהערך את המטבח מהתמונה המצורפת." : "mode=plan\nבנה את המטבח מהתוכנית המצורפת." });
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
      output_config: { effort: mode === "plan" || mode === "photo" ? "medium" : "low", format: betaZodOutputFormat(Reply) },
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
