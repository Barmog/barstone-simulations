// קטלוג גימורים להדמיה: ריצופים, צבעי ארונות וצבעי קיר. הוספת גוון = שורה אחת כאן.

export interface Floor { id: string; name: string; type: 'plank' | 'tile' | 'plain' | 'terrazzo' | 'checker'; a: string; b: string; line: string; rows?: number; tiles?: number }
export const FLOORS: Floor[] = [
  { id: 'oak', name: 'אלון טבעי', type: 'plank', a: '#c9a57a', b: '#bd9a6e', line: 'rgba(70,45,20,.30)' },
  { id: 'oak-light', name: 'אלון מולבן', type: 'plank', a: '#e2d2b8', b: '#d9c7aa', line: 'rgba(90,70,40,.22)' },
  { id: 'oak-grey', name: 'אלון אפור', type: 'plank', a: '#b3aa9c', b: '#a79e90', line: 'rgba(50,45,38,.28)' },
  { id: 'oak-smoked', name: 'אלון מעושן', type: 'plank', a: '#8a6a4b', b: '#7c5e41', line: 'rgba(40,25,10,.35)' },
  { id: 'walnut', name: 'אגוז', type: 'plank', a: '#6e4f39', b: '#614430', line: 'rgba(30,18,8,.4)' },
  { id: 'wenge', name: 'ונגה כהה', type: 'plank', a: '#3d3029', b: '#342822', line: 'rgba(0,0,0,.45)' },
  { id: 'ash-narrow', name: 'פרקט צר בהיר', type: 'plank', a: '#dcc9a6', b: '#d0bb96', line: 'rgba(90,70,40,.25)', rows: 14 },
  { id: 'concrete', name: 'בטון מוחלק', type: 'plain', a: '#b4b1ab', b: '#a8a59f', line: '' },
  { id: 'micro-light', name: 'מיקרוטופינג בהיר', type: 'plain', a: '#dcd6cb', b: '#d2ccc0', line: '' },
  { id: 'porcelain-white', name: 'פורצלן לבן 60×60', type: 'tile', a: '#eeece7', b: '#e8e5df', line: 'rgba(120,115,105,.45)', tiles: 4 },
  { id: 'porcelain-beige', name: 'פורצלן בז׳ 80×80', type: 'tile', a: '#dccfb9', b: '#d5c7b0', line: 'rgba(110,95,70,.4)', tiles: 3 },
  { id: 'porcelain-grey', name: 'פורצלן אפור 60×60', type: 'tile', a: '#a9aaa8', b: '#a1a2a0', line: 'rgba(60,60,58,.45)', tiles: 4 },
  { id: 'slate', name: 'צפחה שחורה', type: 'tile', a: '#3a3b3d', b: '#323335', line: 'rgba(0,0,0,.55)', tiles: 4 },
  { id: 'terrazzo', name: 'טרצו', type: 'terrazzo', a: '#e3ddd2', b: '#b9a58c', line: '' },
  { id: 'checker', name: 'שחמט שחור־לבן', type: 'checker', a: '#ecebe7', b: '#2b2b2c', line: 'rgba(0,0,0,.25)', tiles: 6 },
];
export const floorById = (id: string) => FLOORS.find((f) => f.id === id) || FLOORS[0];

export interface Swatch { id: string; name: string; hex: string }
/** גוונים נפוצים לחזיתות מטבח. */
export const CABINETS: Swatch[] = [
  { id: 'snow', name: 'לבן שלג', hex: '#f4f3ef' }, { id: 'cream', name: 'לבן שמנת', hex: '#ece6d8' }, { id: 'stone', name: 'אבן חמה', hex: '#d9d0c1' },
  { id: 'sand', name: 'בז׳ חול', hex: '#cdbfa6' }, { id: 'cashmere', name: 'קשמיר', hex: '#b9aa98' }, { id: 'taupe', name: 'טאופ', hex: '#8f8276' },
  { id: 'grey-light', name: 'אפור בהיר', hex: '#c9cac7' }, { id: 'dove', name: 'אפור יונה', hex: '#9ea3a3' }, { id: 'graphite', name: 'גרפיט', hex: '#4a4d50' },
  { id: 'black', name: 'שחור מט', hex: '#1f1f20' }, { id: 'sage', name: 'ירוק מרווה', hex: '#9aa58d' }, { id: 'olive', name: 'ירוק זית', hex: '#6b705a' },
  { id: 'bottle', name: 'ירוק בקבוק', hex: '#2f4638' }, { id: 'mist', name: 'כחול אפרפר', hex: '#8a9aa6' }, { id: 'navy', name: 'כחול נייבי', hex: '#263445' },
  { id: 'terracotta', name: 'טרקוטה', hex: '#a8634a' }, { id: 'oak', name: 'פורניר אלון', hex: '#c8a67c' }, { id: 'walnut', name: 'פורניר אגוז', hex: '#6f4e37' },
];
export const WALLS: Swatch[] = [
  { id: 'white', name: 'לבן', hex: '#f4f2ee' }, { id: 'warm', name: 'לבן חם', hex: '#efe8dc' }, { id: 'greige', name: 'גרייז׳', hex: '#d8d1c5' },
  { id: 'sage', name: 'מרווה', hex: '#c5ccbb' }, { id: 'blue', name: 'תכלת אפרפר', hex: '#c3ccd3' }, { id: 'charcoal', name: 'פחם', hex: '#55575a' },
];

// ----- ברזי מטבח (מהקטלוג בדרייב) -----
export interface FaucetModel { id: string; name: string; finishes: string[]; /** פרמטרים לצורה בהדמיה (מ"מ). */ h: number; reach: number; tube: number; base: number; baseH: number; lever: 'pin' | 'blade' | 'paddle' | 'tear' | 'two'; head: number; water?: boolean }
const ALL = ['chrome', 'black', 'gold', 'rose', 'graphite', 'nickel'], NO_CHROME = ALL.slice(1);
export const FAUCETS: FaucetModel[] = [
  { id: 'K149', name: 'K149 · מינימליסטי', finishes: ALL, h: 400, reach: 210, tube: 11, base: 24, baseH: 110, lever: 'pin', head: 12 },
  { id: 'K570', name: 'K570 · מודרני', finishes: ALL, h: 410, reach: 220, tube: 12, base: 27, baseH: 90, lever: 'pin', head: 13 },
  { id: 'K569', name: 'K569 · בסיס רך', finishes: NO_CHROME, h: 400, reach: 215, tube: 11, base: 30, baseH: 70, lever: 'blade', head: 12 },
  { id: 'K655', name: 'K655 · צינור ישר', finishes: NO_CHROME, h: 420, reach: 232, tube: 14, base: 25, baseH: 40, lever: 'blade', head: 14 },
  { id: 'K727', name: 'K727 · דק במיוחד', finishes: NO_CHROME, h: 390, reach: 190, tube: 9, base: 20, baseH: 60, lever: 'pin', head: 10 },
  { id: 'K121', name: 'K121 · קלאסי', finishes: NO_CHROME, h: 400, reach: 210, tube: 12, base: 28, baseH: 120, lever: 'tear', head: 20 },
  { id: 'K114', name: 'K114 · קשת רחבה', finishes: NO_CHROME, h: 380, reach: 250, tube: 14, base: 30, baseH: 80, lever: 'paddle', head: 18 },
  { id: 'K816', name: 'K816 · לבן', finishes: ['white'], h: 400, reach: 210, tube: 12, base: 25, baseH: 80, lever: 'pin', head: 13 },
  { id: '4in1', name: 'ברז 4in1 · מים מסוננים חמים וקרים', finishes: ['black', 'nickel', 'graphite', 'gold'], h: 430, reach: 220, tube: 13, base: 28, baseH: 100, lever: 'two', head: 15, water: true },
];
export const FINISHES: Record<string, { name: string; hex: string; rough: number }> = {
  chrome: { name: 'כרום', hex: '#d5d8dc', rough: 0.12 }, black: { name: 'שחור', hex: '#1b1b1d', rough: 0.45 }, gold: { name: 'זהב', hex: '#c9a45c', rough: 0.25 },
  rose: { name: 'רוז גולד', hex: '#c98f7a', rough: 0.25 }, graphite: { name: 'גרפיט', hex: '#55585d', rough: 0.3 }, nickel: { name: 'ניקל מוברש', hex: '#b9b6ae', rough: 0.38 }, white: { name: 'לבן', hex: '#f3f3f1', rough: 0.4 },
};
export const faucetById = (id?: string) => FAUCETS.find((f) => f.id === id) || FAUCETS[0];
/** גווני זכוכית לוויטרינות. */
export const GLASS: Swatch[] = [
  { id: 'clear', name: 'שקופה', hex: '#dfeeee' }, { id: 'smoke', name: 'מעושנת', hex: '#6f7275' }, { id: 'bronze', name: 'ברונזה', hex: '#9a7b5c' }, { id: 'black', name: 'שחורה', hex: '#2a2c2e' },
  { id: 'fluted', name: 'חלבית', hex: '#f1f3f2' }, { id: 'green', name: 'ירקרקה', hex: '#a9c7b8' }, { id: 'blue', name: 'כחלחלה', hex: '#a9c0d6' }, { id: 'amber', name: 'ענבר', hex: '#c9a26a' },
];
