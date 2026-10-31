// יוצר public/js/config.js ממשתני סביבה בזמן build (רק מפתחות ציבוריים!)
import { writeFileSync } from 'node:fs';
const cfg = { SUPABASE_URL: process.env.SUPABASE_URL || '', SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '' };
writeFileSync('public/js/config.js', `window.APP_CONFIG = ${JSON.stringify(cfg)};\n`);
console.log('config.js written, supabase configured:', !!cfg.SUPABASE_URL);
