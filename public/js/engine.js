// Barstone — מנוע פריסת שיש. יחידות: מ"מ. ללא תלות בדפדפן (נבדק גם ב-Node).
(function (root) {
  const DEF = { boardW: 3200, boardH: 1600, kerf: 4, edgeH: 40, margin: 10, rotate: true };

  // בניית חלקים מתוך מידות ההדמיה
  function buildPieces(sim) {
    const T = (n) => Math.round(Number(n || 0) * 10); // ס"מ → מ"מ
    const P = [];
    const L = T(sim.length_cm), D = T(sim.depth_cm || 60);
    const edge = sim.edge !== false; // קנט רציף חובה כברירת מחדל
    if (L > 0) P.push({ key: 'A', name: 'משטח ראשי', L, W: D, edge, plan: { x: 0, y: 0 } });
    if (T(sim.l_length_cm) > 0) P.push({ key: 'B', name: 'משטח L', L: T(sim.l_length_cm), W: D, edge, rot: true, plan: { x: L - D, y: D } } /* רגל L צמודה לקצה השמאלי-תחתון של המשטח, מתחת לפינה */);
    if (T(sim.island_l_cm) > 0) P.push({ key: 'C', name: 'אי', L: T(sim.island_l_cm), W: T(sim.island_w_cm || 90), edge, edgeBoth: true, plan: { x: Math.max(0, (L - T(sim.island_l_cm)) / 2), y: D + 1000 } } /* אי ממורכז, מעבר 100 ס"מ */);
    if (T(sim.splash_h_cm) > 0) P.push({ key: 'D', name: 'חיפוי', L, W: T(sim.splash_h_cm), edge: false, plan: null });
    if (sim.sink) { // כיור בנוי מאבן: 4 דפנות + תחתית
      const sw = T(sim.sink_w_cm || 60), sd = T(sim.sink_d_cm || 40), sh = T(sim.sink_h_cm || 20), t = T(sim.thickness_cm || 2);
      P.push({ key: 'S1', name: 'כיור · תחתית', L: sw, W: sd, sink: true });
      P.push({ key: 'S2', name: 'כיור · דופן קדמית', L: sw, W: sh, sink: true });
      P.push({ key: 'S3', name: 'כיור · דופן אחורית', L: sw, W: sh, sink: true });
      P.push({ key: 'S4', name: 'כיור · דופן ימין', L: sd - 2 * t, W: sh, sink: true });
      P.push({ key: 'S5', name: 'כיור · דופן שמאל', L: sd - 2 * t, W: sh, sink: true });
      if (sim.sink_double) { // כיור כפול: אגן שני זהה
        P.push({ key: 'S6', name: 'כיור 2 · תחתית', L: sw, W: sd, sink: true });
        P.push({ key: 'S7', name: 'כיור 2 · דופן קדמית', L: sw, W: sh, sink: true });
        P.push({ key: 'S8', name: 'כיור 2 · דופן אחורית', L: sw, W: sh, sink: true });
        P.push({ key: 'S9', name: 'כיור 2 · דופן ימין', L: sd - 2 * t, W: sh, sink: true });
        P.push({ key: 'S10', name: 'כיור 2 · דופן שמאל', L: sd - 2 * t, W: sh, sink: true });
      }
    }
    const pos = sim.plan_pos || {};
    for (const p of P) if (p.plan && pos[p.key]) p.plan = { x: +pos[p.key].x, y: +pos[p.key].y };
    return P;
  }

  // חלק + פסי הקנט שלו כ"בלוק" אחד, כדי שהקנט ייחתך צמוד לחלק = גיד רציף
  function toBlocks(pieces, o) {
    const blocks = [];
    for (const p of pieces) {
      const maxL = o.boardW - 2 * o.margin;
      const segs = Math.ceil(p.L / maxL); // חלק ארוך מהלוח → פיצול עם חיבור
      const segL = Math.ceil(p.L / segs);
      for (let i = 0; i < segs; i++) {
        const L = i === segs - 1 ? p.L - segL * (segs - 1) : segL;
        const strips = p.edge ? (p.edgeBoth ? 2 : 1) : 0;
        const H = p.W + strips * (o.kerf + o.edgeH);
        blocks.push({ piece: p, seg: i, segs, L, W: p.W, strips, H, offsetL: segL * i });
      }
    }
    return blocks.sort((a, b) => b.H * b.L - a.H * a.L);
  }

  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // MaxRects (Best-Short-Side-Fit) עם סיבוב 90° ועובי מסור; פגמים = אזורים תפוסים מראש
  function MaxRects(W, H, o, defects) {
    const m = o.margin, k = o.kerf;
    let free = [{ x: m, y: m, w: W - 2 * m + k, h: H - 2 * m + k }];
    const split = (r) => {
      const out = [];
      for (const f of free) {
        if (!hit(f, r)) { out.push(f); continue; }
        if (r.x > f.x) out.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
        if (r.x + r.w < f.x + f.w) out.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - r.x - r.w, h: f.h });
        if (r.y > f.y) out.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
        if (r.y + r.h < f.y + f.h) out.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - r.y - r.h });
      }
      free = out.filter((a, i) => !out.some((b, j) => j !== i && b.x <= a.x && b.y <= a.y && b.x + b.w >= a.x + a.w && b.y + b.h >= a.y + a.h && (j < i || b.w * b.h > a.w * a.h)));
    };
    (defects || []).forEach((d) => split({ x: d.x - k, y: d.y - k, w: d.w + 2 * k, h: d.h + 2 * k }));
    return {
      find(w, h, rot) {
        let best = null;
        for (const f of free) for (const [ww, hh, r] of rot ? [[w, h, false], [h, w, true]] : [[w, h, false]]) {
          if (ww + k <= f.w && hh + k <= f.h) {
            const ss = Math.min(f.w - ww, f.h - hh), ls = Math.max(f.w - ww, f.h - hh);
            if (!best || ss < best.ss || (ss === best.ss && ls < best.ls)) best = { x: f.x, y: f.y, w: ww, h: hh, rot: r, ss, ls };
          }
        }
        return best;
      },
      take(p) { split({ x: p.x, y: p.y, w: p.w + k, h: p.h + k }); },
    };
  }

  function pack(blocks, boards, o) {
    const used = boards.map((b) => ({ board: b, place: [], mr: MaxRects(b.w || o.boardW, b.h || o.boardH, o, b.defects) }));
    const unplaced = [];
    for (const bl of blocks) {
      let best = null;
      for (const u of used) { const p = u.mr.find(bl.L, bl.H, o.rotate); if (p && (!best || p.ss < best.p.ss)) best = { u, p }; }
      // מעדיף לוח שכבר בשימוש
      const inUse = used.filter((u) => u.place.length);
      for (const u of inUse) { const p = u.mr.find(bl.L, bl.H, o.rotate); if (p) { best = { u, p }; break; } }
      if (!best) { unplaced.push(bl); continue; }
      best.u.mr.take(best.p);
      best.u.place.push({ x: best.p.x, y: best.p.y, w: best.p.w, h: best.p.h, rot: best.p.rot, block: bl });
    }
    return { used: used.filter((u) => u.place.length), unplaced };
  }

  // כמה סדרי מיון — בוחר את התוצאה עם הכי פחות לוחות ואז הכי פחות שטח לוח
  const ORDERS = [(a, b) => b.H * b.L - a.H * a.L, (a, b) => Math.max(b.L, b.H) - Math.max(a.L, a.H), (a, b) => b.H - a.H, (a, b) => b.L - a.L];
  function bestPack(blocks, boards, o) {
    let best = null;
    for (const ord of ORDERS) {
      const r = pack([...blocks].sort(ord), boards, o);
      const score = r.unplaced.length * 1e6 + r.used.length * 1e3 + r.used.reduce((s, u) => s + (u.board.w * u.board.h) / 1e7, 0);
      if (!best || score < best.score) best = { ...r, score };
    }
    return best;
  }

  function run(sim, boardsIn, opts) {
    const o = { ...DEF, ...(opts || {}) };
    const pieces = buildPieces(sim);
    let boards = (boardsIn && boardsIn.length ? boardsIn : []).map((b) => ({ w: o.boardW, h: o.boardH, defects: [], ...b }));
    const blocks = toBlocks(pieces, o);
    let res = bestPack(blocks, boards, o), n = 1;
    // אם חסרים לוחות — מוסיף לוחות בגודל ברירת מחדל עד שהכל נכנס
    while (res.unplaced.length && n < 20) {
      const fits = (b) => (b.L <= o.boardW - 2 * o.margin && b.H <= o.boardH - 2 * o.margin) || (o.rotate && b.H <= o.boardW - 2 * o.margin && b.L <= o.boardH - 2 * o.margin);
      const big = res.unplaced.find((b) => !fits(b));
      if (big) break;
      boards = [...boards, { id: `חדש-${n++}`, w: o.boardW, h: o.boardH, defects: [], auto: true }];
      res = bestPack(blocks, boards, o);
    }
    const area = (u) => (u.board.w || o.boardW) * (u.board.h || o.boardH);
    const usedArea = res.used.reduce((s, u) => s + u.place.reduce((t, p) => t + p.w * p.h, 0), 0);
    const boardArea = res.used.reduce((s, u) => s + area(u), 0);
    const pieceArea = pieces.reduce((s, p) => s + p.L * p.W, 0);
    const edgeLen = blocks.reduce((s, b) => s + b.strips * b.L, 0);
    const joints = blocks.filter((b) => b.segs > 1 && b.seg > 0).length;
    const warnings = [];
    res.unplaced.forEach((b) => warnings.push(`החלק "${b.piece.name}" (${b.L}×${b.H} מ"מ כולל קנט) לא נכנס בלוח`));
    const jointList = blocks.filter((b) => b.segs > 1 && b.seg > 0).map((b) => ({ key: b.piece.key, name: b.piece.name, at: b.offsetL }));
    jointList.forEach((j) => warnings.push(`חיבור ב"${j.name}" — ${(j.at / 10).toFixed(0)} ס"מ מתחילת החלק (החלק ארוך מהלוח)`));
    return {
      opts: o, pieces, blocks, used: res.used, unplaced: res.unplaced, jointList,
      metrics: {
        boards: res.used.length, joints, edge_m: +(edgeLen / 1000).toFixed(2),
        piece_m2: +(pieceArea / 1e6).toFixed(2), consumed_m2: +(usedArea / 1e6).toFixed(2), board_m2: +(boardArea / 1e6).toFixed(2),
        utilization: boardArea ? Math.round((usedArea / boardArea) * 100) : 0,
        sink: pieces.some((p) => p.sink),
      },
      warnings,
    };
  }

  // מניעת חפיפה בתוכנית: הצמדה (מגנט 60 מ"מ) לקצוות חלקים אחרים, ואם עדיין חופף — הזזה למיקום הפנוי הקרוב
  function planRect(p, x, y) { return { x, y, w: p.rot ? p.W : p.L, h: p.rot ? p.L : p.W }; }
  function resolvePlan(pieces, key, x, y, gap) {
    gap = gap || 0; const me = pieces.find((p) => p.key === key); if (!me) return { x, y };
    const others = pieces.filter((p) => p.plan && p.key !== key).map((p) => planRect(p, p.plan.x, p.plan.y));
    const R = (x, y) => planRect(me, Math.max(0, Math.round(x / 10) * 10), Math.max(0, Math.round(y / 10) * 10));
    const hit = (a) => others.some((o) => a.x < o.x + o.w + gap && o.x < a.x + a.w + gap && a.y < o.y + o.h + gap && o.y < a.y + a.h + gap);
    let r = R(x, y); const M = 60;
    for (const o of others) { // מגנט
      for (const [a, b] of [[r.x, o.x + o.w], [r.x + r.w, o.x], [r.x, o.x], [r.x + r.w, o.x + o.w]]) if (Math.abs(a - b) < M) { r.x += b - a; break; }
      for (const [a, b] of [[r.y, o.y + o.h], [r.y + r.h, o.y], [r.y, o.y], [r.y + r.h, o.y + o.h]]) if (Math.abs(a - b) < M) { r.y += b - a; break; }
    }
    r = planRect(me, Math.max(0, r.x), Math.max(0, r.y));
    if (!hit(r)) return { x: r.x, y: r.y, moved: false };
    const cand = [];
    for (const o of others) for (const [cx, cy] of [[o.x - r.w - gap, r.y], [o.x + o.w + gap, r.y], [r.x, o.y - r.h - gap], [r.x, o.y + o.h + gap]]) {
      const c = planRect(me, Math.max(0, cx), Math.max(0, cy)); if (!hit(c)) cand.push(c);
    }
    cand.sort((a, b) => Math.hypot(a.x - r.x, a.y - r.y) - Math.hypot(b.x - r.x, b.y - r.y));
    return cand.length ? { x: cand[0].x, y: cand[0].y, moved: true } : { x: me.plan.x, y: me.plan.y, moved: true, reverted: true };
  }

  // ===== פתחים במשטח: כיור (יחיד/כפול), חור ברז, כיריים =====
  // מערכת מקומית של חלק: localX לאורך החלק, localY לרוחבו מהקצה האחורי. M = מרווח מינימלי מקצה/חיבור.
  const PIECE_HE = { A: 'משטח ראשי', B: 'משטח L', C: 'אי' };
  function toPlan(P, lx, ly, w, d) { return P.rot ? { x: P.plan.x + (P.W - ly - d), y: P.plan.y + lx, pw: d, ph: w } : { x: P.plan.x + lx, y: P.plan.y + ly, pw: w, ph: d }; }
  function segsOf(res, key) { const s = []; for (const u of res.used) for (const p of u.place) if (p.block.piece.key === key) s.push([p.block.offsetL, p.block.offsetL + p.block.L]); return s.sort((a, b) => a[0] - b[0]); }
  // מציאת מרכז קרוב לרצוי: בתוך קטע אחד (לא חוצה חיבור), עם מרווח, ובלי לחפוף פתחים אחרים
  function placeAlong(res, P, want, w, M, avoid) {
    const segs = segsOf(res, P.key);
    const ok = (c) => segs.some(([a, b]) => c - w / 2 >= a + M && c + w / 2 <= b - M) && !avoid.some(([a, b]) => c + w / 2 > a && c - w / 2 < b);
    if (ok(want)) return { c: want, moved: false };
    let best = null; for (let c = 0; c <= P.L; c += 10) if (ok(c) && (best === null || Math.abs(c - want) < Math.abs(best - want))) best = c;
    return best === null ? null : { c: best, moved: true };
  }
  function pickPiece(res, k) { const key = ['A', 'B', 'C'].includes(k) ? k : 'A'; let P = res.pieces.find((p) => p.key === key && p.plan), fb = false; if (!P) { P = res.pieces.find((p) => p.key === 'A' && p.plan); fb = true; } return { P, fb }; }
  function cutouts(res, sim) {
    sim = sim || res.sim || {}; const items = [], warnings = [], M = 60, T = (n, d) => Math.round((+n || d) * 10);
    if (sim.sink) {
      const { P, fb } = pickPiece(res, sim.sink_piece);
      if (P) {
        const sw = T(sim.sink_w_cm, 60), sd = T(sim.sink_d_cm, 40), dbl = !!sim.sink_double, gap = 80, tw = dbl ? 2 * sw + gap : sw;
        const base = { type: 'sink', key: P.key, piece: P.name, w: tw, d: sd, rot: !!P.rot, double: dbl, basins: dbl ? [{ off: 0, w: sw }, { off: sw + gap, w: sw }] : [{ off: 0, w: sw }] };
        let note = fb ? 'החלק שנבחר לכיור לא קיים — הכיור הוצב במשטח הראשי' : '';
        if (tw > P.L - 2 * M || sd > P.W - 2 * M) { const it = { ...base, ok: false, note: 'הכיור גדול מהחלק שנבחר', localX: 0, localY: 0, cx: 0, ...toPlan(P, 0, 0, tw, sd) }; items.push(it); warnings.push(`כיור: ${it.note}`); }
        else {
          const want = +sim.sink_x_cm > 0 ? +sim.sink_x_cm * 10 : P.L / 2, r = placeAlong(res, P, want, tw, M, []);
          let cx = want, ok = true;
          if (!r) { note = 'הכיור חוצה חיבור — מומלץ לשנות מידות או מיקום'; } else { cx = r.c; if (r.moved) note = note || (+sim.sink_x_cm > 0 ? 'הכיור הוזז מהמיקום שהוזן כדי לא לחצות חיבור/קצה' : 'הכיור הוזז כדי לא לחצות חיבור בין חלקים'); }
          const localX = Math.round(cx - tw / 2), localY = Math.round((P.W - sd) / 2);
          const it = { ...base, ok, note, localX, localY, cx: Math.round(cx), ...toPlan(P, localX, localY, tw, sd) }; items.push(it); if (note) warnings.push(`כיור: ${note}`);
          // חור ברז Ø35 מאחורי הכיור (במרכז, או מעל המחיצה בכיור כפול)
          if (sim.faucet_hole !== false) {
            const D = 35, fy = Math.round(localY / 2), fx = dbl ? localX + sw + gap / 2 : cx;
            const f = { type: 'faucet', key: P.key, piece: P.name, w: D, d: D, round: true, ok: localY - D >= 30, localX: Math.round(fx - D / 2), localY: Math.round(fy - D / 2), cx: Math.round(fx), note: '' };
            if (!f.ok) { f.note = 'אין מספיק מקום לחור ברז מאחורי הכיור — מומלץ ברז קיר או משטח עמוק יותר'; warnings.push(`ברז: ${f.note}`); }
            Object.assign(f, toPlan(P, f.localX, f.localY, D, D)); items.push(f);
          }
        }
      }
    }
    if (sim.cooktop) {
      const { P, fb } = pickPiece(res, sim.cooktop_piece || 'A');
      if (P) {
        const w = T(sim.cooktop_w_cm, 56), d = T(sim.cooktop_d_cm, 49); let note = fb ? 'החלק שנבחר לכיריים לא קיים — הוצבו במשטח הראשי' : '';
        const avoid = items.filter((i) => i.key === P.key && i.type === 'sink' && i.ok).map((i) => [i.localX - 300, i.localX + i.w + 300]);
        if (w > P.L - 2 * M || d > P.W - 2 * M) { note = 'הכיריים גדולות מהחלק שנבחר'; items.push({ type: 'cooktop', key: P.key, piece: P.name, w, d, ok: false, note, localX: 0, localY: 0, cx: 0, ...toPlan(P, 0, 0, w, d) }); warnings.push(`כיריים: ${note}`); }
        else {
          const want = +sim.cooktop_x_cm > 0 ? +sim.cooktop_x_cm * 10 : (avoid.length ? (avoid[0][0] > P.L / 2 ? P.L / 4 : P.L * 3 / 4) : P.L / 2);
          const r = placeAlong(res, P, want, w, M, avoid); let cx = want, ok = true;
          if (!r) { ok = false; note = 'אין מקום לכיריים בלי לחצות חיבור או להתקרב לכיור (30 ס"מ)'; } else { cx = r.c; if (r.moved && +sim.cooktop_x_cm > 0) note = note || 'הכיריים הוזזו כדי לא לחצות חיבור / להתרחק מהכיור'; }
          const localX = Math.round(cx - w / 2), localY = Math.round((P.W - d) / 2);
          items.push({ type: 'cooktop', key: P.key, piece: P.name, w, d, ok, note, localX, localY, cx: Math.round(cx), ...toPlan(P, localX, localY, w, d) }); if (note) warnings.push(`כיריים: ${note}`);
        }
      }
    }
    return { items, warnings };
  }
  // תאימות לאחור: הכיור בלבד
  function sinkPlan(res, sim) { return cutouts(res, sim).items.find((i) => i.type === 'sink') || null; }
  const api = { sinkPlan, cutouts, PIECE_HE, resolvePlan, planRect, DEF, buildPieces, run };
  root.StoneEngine = api; if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
