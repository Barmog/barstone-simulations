// Barstone — מנוע פריסת שיש. יחידות: מ"מ. ללא תלות בדפדפן (נבדק גם ב-Node).
(function (root) {
  const DEF = { boardW: 3200, boardH: 1600, kerf: 4, edgeH: 40, margin: 10 };

  // בניית חלקים מתוך מידות ההדמיה
  function buildPieces(sim) {
    const T = (n) => Math.round(Number(n || 0) * 10); // ס"מ → מ"מ
    const P = [];
    const L = T(sim.length_cm), D = T(sim.depth_cm || 60);
    const edge = sim.edge !== false; // קנט רציף חובה כברירת מחדל
    if (L > 0) P.push({ key: 'A', name: 'משטח ראשי', L, W: D, edge, plan: { x: 0, y: 0 } });
    if (T(sim.l_length_cm) > 0) P.push({ key: 'B', name: 'משטח L', L: T(sim.l_length_cm), W: D, edge, rot: true, plan: { x: L - D, y: D } });
    if (T(sim.island_l_cm) > 0) P.push({ key: 'C', name: 'אי', L: T(sim.island_l_cm), W: T(sim.island_w_cm || 90), edge, edgeBoth: true, plan: { x: 0, y: D + 900 } });
    if (T(sim.splash_h_cm) > 0) P.push({ key: 'D', name: 'חיפוי', L, W: T(sim.splash_h_cm), edge: false, plan: null });
    if (sim.sink) { // כיור בנוי מאבן: 4 דפנות + תחתית
      const sw = T(sim.sink_w_cm || 60), sd = T(sim.sink_d_cm || 40), sh = T(sim.sink_h_cm || 20), t = T(sim.thickness_cm || 2);
      P.push({ key: 'S1', name: 'כיור · תחתית', L: sw, W: sd, sink: true });
      P.push({ key: 'S2', name: 'כיור · דופן קדמית', L: sw, W: sh, sink: true });
      P.push({ key: 'S3', name: 'כיור · דופן אחורית', L: sw, W: sh, sink: true });
      P.push({ key: 'S4', name: 'כיור · דופן ימין', L: sd - 2 * t, W: sh, sink: true });
      P.push({ key: 'S5', name: 'כיור · דופן שמאל', L: sd - 2 * t, W: sh, sink: true });
    }
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

  // אריזה מדפית (shelf) עם עובי מסור, דילוג על פגמים מסומנים
  function pack(blocks, boards, o) {
    const used = boards.map((b) => ({ board: b, shelves: [], place: [] }));
    const unplaced = [];
    for (const bl of blocks) {
      let ok = false;
      for (const u of used) {
        const W = u.board.w || o.boardW, Hh = u.board.h || o.boardH;
        const tryAt = (x, y) => {
          const r = { x, y, w: bl.L, h: bl.H };
          if (x + bl.L > W - o.margin || y + bl.H > Hh - o.margin) return false;
          if ((u.board.defects || []).some((d) => hit(r, d))) return false;
          if (u.place.some((p) => hit(r, { x: p.x - o.kerf, y: p.y - o.kerf, w: p.w + 2 * o.kerf, h: p.h + 2 * o.kerf }))) return false;
          u.place.push({ ...r, block: bl }); return true;
        };
        // מנסה מדפים קיימים ואז מדף חדש, בצעדים כדי לעקוף פגמים
        const ys = [...new Set([o.margin, ...u.place.map((p) => p.y + p.h + o.kerf)])].sort((a, b) => a - b);
        outer: for (const y of ys) for (let x = o.margin; x + bl.L <= W - o.margin; x += 20) {
          if (tryAt(x, y)) { ok = true; break outer; }
        }
        if (ok) break;
      }
      if (!ok) unplaced.push(bl);
    }
    return { used: used.filter((u) => u.place.length), unplaced };
  }

  function run(sim, boardsIn, opts) {
    const o = { ...DEF, ...(opts || {}) };
    const pieces = buildPieces(sim);
    let boards = (boardsIn && boardsIn.length ? boardsIn : []).map((b) => ({ w: o.boardW, h: o.boardH, defects: [], ...b }));
    const blocks = toBlocks(pieces, o);
    let res = pack(blocks, boards, o), n = 1;
    // אם חסרים לוחות — מוסיף לוחות בגודל ברירת מחדל עד שהכל נכנס
    while (res.unplaced.length && n < 20) {
      const big = res.unplaced.find((b) => b.H > o.boardH - 2 * o.margin);
      if (big) break;
      boards = [...boards, { id: `חדש-${n++}`, w: o.boardW, h: o.boardH, defects: [], auto: true }];
      res = pack(blocks, boards, o);
    }
    const area = (u) => (u.board.w || o.boardW) * (u.board.h || o.boardH);
    const usedArea = res.used.reduce((s, u) => s + u.place.reduce((t, p) => t + p.w * p.h, 0), 0);
    const boardArea = res.used.reduce((s, u) => s + area(u), 0);
    const pieceArea = pieces.reduce((s, p) => s + p.L * p.W, 0);
    const edgeLen = blocks.reduce((s, b) => s + b.strips * b.L, 0);
    const joints = blocks.filter((b) => b.segs > 1 && b.seg > 0).length;
    const warnings = [];
    res.unplaced.forEach((b) => warnings.push(`החלק "${b.piece.name}" (${b.L}×${b.H} מ"מ כולל קנט) לא נכנס בלוח`));
    if (joints) warnings.push(`${joints} חיבורים נדרשים — חלקים ארוכים מהלוח`);
    return {
      opts: o, pieces, blocks, used: res.used, unplaced: res.unplaced,
      metrics: {
        boards: res.used.length, joints, edge_m: +(edgeLen / 1000).toFixed(2),
        piece_m2: +(pieceArea / 1e6).toFixed(2), consumed_m2: +(usedArea / 1e6).toFixed(2), board_m2: +(boardArea / 1e6).toFixed(2),
        utilization: boardArea ? Math.round((usedArea / boardArea) * 100) : 0,
        sink: pieces.some((p) => p.sink),
      },
      warnings,
    };
  }
  const api = { DEF, buildPieces, run };
  root.StoneEngine = api; if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
