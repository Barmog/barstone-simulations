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
