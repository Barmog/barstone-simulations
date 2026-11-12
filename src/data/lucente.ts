// דגמי קטלוג LUCENTE שתמונת הלוח שלהם מגיעה עם האתר (public/slabs). משמש את מצב ההדגמה.
// השמות לפי "LUCENTE Catalog - Final Digital Viewing" שבדרייב.
export const LUCENTE: [slug: string, he: string, en: string, series: 'PRO' | 'ULTRA'][] = [
  ['golden-dust', 'גולדן דאסט', 'Golden Dust', 'PRO'],
  ['terrazzo-sabbia', 'טראצו סביה', 'Terrazzo Sabbia', 'PRO'],
  ['arbel-mirage', 'ארבל מיראז׳', 'Arbel Mirage', 'PRO'],
  ['taj-mahal', 'טאג׳ מאהל', 'Taj Mahal', 'ULTRA'],
  ['beige-harmony', 'בז׳ הרמוני', 'Beige Harmony', 'ULTRA'],
  ['mystic-euphoria', 'מיסטיק אופוריה', 'Mystic Euphoria', 'ULTRA'],
  ['mystic-hope', 'מיסטיק הופ', 'Mystic Hope', 'ULTRA'],
  ['antico-classico', 'אנטיקו קלאסיקו', 'Antico Classico', 'ULTRA'],
  ['lasa-bianco', 'לאסה ביאנקו', 'Lasa Bianco', 'ULTRA'],
  ['glow-ivory', 'אייבורי גלואו', 'Ivory Glow', 'ULTRA'],
  ['glow-green', 'גרין גלואו', 'Green Glow', 'ULTRA'],
  ['glow-violet', 'ויולט גלואו', 'Violet Glow', 'ULTRA'],
  ['royal-emerald', 'רויאל אמרלד', 'Royal Emerald', 'ULTRA'],
  ['pietra-rock', 'פיאטרה רוק', 'Pietra Rock', 'ULTRA'],
  ['lincoln-oro', 'לינקולן אורו', 'Lincoln Oro', 'ULTRA'],
  ['calacatta-alba', 'קלקטה מצ׳יה וצ׳יה', 'Calacatta Macchia Vecchia', 'ULTRA'],
  ['calacatta-camel', 'קלקטה קאמל', 'Calacatta Camel', 'ULTRA'],
  ['vanilla-light', 'ונילה לייט', 'Vanilla Light', 'ULTRA'],
  ['fior-di-bosco', 'פיור די בוסקו', 'Fior di Bosco', 'ULTRA'],
  ['sahara-white', 'סהרה ווייט', 'Sahara White', 'ULTRA'],
  ['ivory-cloud', 'אייבורי קלאוד', 'Ivory Cloud', 'ULTRA'],
  ['stone-black', 'סטון בלאק', 'Stone Black', 'ULTRA'],
  ['stone-grey', 'סטון גריי', 'Stone Grey', 'ULTRA'],
  ['patagonia', 'פטגוניה', 'Patagonia', 'ULTRA'],
  ['terra', 'טרה', 'Terra', 'ULTRA'],
  ['bianco-travertino', 'ביאנקו טרוונטינו', 'Bianco Travertino', 'ULTRA'],
  ['classic-white', 'קלאסיק ווייט', 'Classic White', 'ULTRA'],
];

// גימורים לפי "שמות חדשים לדגמי שיש" בדרייב (עמודת גימורים). מפתח: השם באנגלית באותיות קטנות.
export type Finish = 'polished' | 'matte' | 'structure';
export const FINISH_HE: Record<Finish, string> = { polished: 'מבריק', matte: 'מט', structure: 'סטרקצ׳ר' };
const MP: Finish[] = ['matte', 'polished'], M: Finish[] = ['matte'], P: Finish[] = ['polished'], ST: Finish[] = ['structure'];
const FIN: Record<string, Finish[]> = {
  'beige harmony': P, 'glow ivory': P, 'ivory glow': P, 'royal emerald': P, 'glow violet': P, 'violet glow': P, 'green glow': P, 'mystic hope': P, 'mystic euphoria': P,
  'soft mist': M, 'wild terra': M, 'travertine latte': M, 'golden sand': M, 'nova prime': M, 'cemento bianco': M, 'stone grey': M, 'stone white': M, 'stone black': M,
  'classic black': M, 'carbon rock': M, 'terrazzo grey': M, 'terrazzo sabbia': M, 'pietra terra': M, 'pietra rock': M, silvara: M, 'antico classico': M, terra: M, ocean: M,
  'travertine rosso': M, 'neo cloud': M, 'travertino sole': M, 'moon onyx': M, solara: M, 'calacatta blossom': M, 'iron blaze': M, 'nero lux': M, 'storm vein': M,
  'bianco travertino': ['matte', 'structure'], 'ivory cloud': ST, 'travertine desert': ST, 'arctic black': ST, 'arctic sand': ST, cemento: ST, 'travertine roma': ST, 'limestone seychelles': ST, tectonic: ST,
};
/** הגימורים שהדגם מגיע בהם. דגם שלא ברשימה: מט ומבריק. */
export const finishesFor = (en?: string | null): Finish[] => FIN[(en || '').trim().toLowerCase()] || MP;
/** הגימור בפועל בפרויקט: מה שנבחר אם הדגם מגיע בו, אחרת מבריק אם יש, אחרת הראשון. */
export const stoneFinish = (p: { finish?: Finish }, en?: string | null): Finish => { const f = finishesFor(en); return p.finish && f.includes(p.finish) ? p.finish : f.includes('polished') ? 'polished' : f[0]; };
