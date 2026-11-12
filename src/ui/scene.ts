// בניית סצנת התלת־ממד מתוך מודל המטבח. יחידות: מטר. x בתוכנית → x, y בתוכנית → z, גובה → y.
import { Finish } from '../data/lucente';
import * as THREE from 'three';
import { Cutout, PLINTH_H, Piece, Project, SEAT_DEPTH, Side, UPPER_TOP, chairCount, cornerExt, corners, hostEdge, isVertical, longIsX, upperBottom } from '../core/model';
import { NestResult, Placement, Rect, isBody, localToSlab, segLocal } from '../core/nesting';
import { FINISHES, faucetById, floorById } from '../core/catalog';

const S = 0.001;
function floorTexture(id: string) {
  const f = floorById(id), c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d')!; g.fillStyle = f.a; g.fillRect(0, 0, 1024, 1024);
  const rnd = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
  if (f.type === 'plank') {
    const rows = f.rows || 8, rh = 1024 / rows;
    for (let row = 0; row < rows; row++) {
      let x = -(rnd(row + 1) * 300), n = row * 7;
      while (x < 1024) {
        const w = 300 + rnd(n + 3) * 220;
        g.fillStyle = rnd(n + 9) > 0.5 ? f.a : f.b; g.fillRect(x, row * rh, w, rh);
        g.fillStyle = `rgba(0,0,0,${rnd(n + 5) * 0.07})`; g.fillRect(x, row * rh, w, rh);
        g.fillStyle = f.line; g.fillRect(x + w - 2, row * rh, 2, rh); x += w; n++;
      }
      g.fillStyle = f.line; g.fillRect(0, row * rh, 1024, 2);
    }
  } else if (f.type === 'tile' || f.type === 'checker') {
    const n = f.tiles || 4, t = 1024 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = f.type === 'checker' ? ((i + j) % 2 ? f.b : f.a) : rnd(i * 13 + j * 7 + 1) > 0.5 ? f.a : f.b; g.fillRect(i * t, j * t, t, t);
      g.fillStyle = f.line; g.fillRect(i * t, j * t, t, 3); g.fillRect(i * t, j * t, 3, t);
    }
  } else if (f.type === 'terrazzo') {
    for (let i = 0; i < 900; i++) { const r = 3 + rnd(i) * 9; g.fillStyle = [f.b, '#8d8377', '#f6f2ea', '#6f675d', '#c98f6b'][i % 5]; g.globalAlpha = 0.75; g.beginPath(); g.ellipse(rnd(i + 0.3) * 1024, rnd(i + 0.7) * 1024, r, r * (0.5 + rnd(i + 0.1) * 0.5), rnd(i) * 3, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  } else {
    for (let i = 0; i < 260; i++) { g.fillStyle = i % 2 ? f.b : 'rgba(255,255,255,.05)'; g.globalAlpha = 0.16; g.beginPath(); g.ellipse(rnd(i) * 1024, rnd(i + 0.5) * 1024, 40 + rnd(i + 0.2) * 150, 20 + rnd(i + 0.8) * 70, rnd(i) * 3, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  }
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},.028)`; g.fillRect(rnd(i + 0.4) * 1024, rnd(i + 0.9) * 1024, f.type === 'plank' ? 60 : 3, 1.2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const rep = f.type === 'plank' ? (f.rows ? 12 : 9) : f.type === 'tile' ? 16 / ((f.tiles || 4) * (f.id === 'porcelain-beige' ? 0.8 : 0.6)) : f.type === 'checker' ? 16 / ((f.tiles || 6) * 0.4) : 5;
  t.repeat.set(rep, rep); return t;
}

export interface Built { group: THREE.Group; center: THREE.Vector3; radius: number; lamps: THREE.Vector3[]; sinks: THREE.Vector3[] }

/** r פחות c: עד ארבעה מלבנים (לפתח שחיבור עובר דרכו). */
function subtract(r: Rect, c: Rect): Rect[] {
  const x0 = Math.max(r.x, c.x), x1 = Math.min(r.x + r.w, c.x + c.w), y0 = Math.max(r.y, c.y), y1 = Math.min(r.y + r.h, c.y + c.h);
  if (x1 - x0 < 1 || y1 - y0 < 1) return [r];
  return [{ x: r.x, y: r.y, w: x0 - r.x, h: r.h }, { x: x1, y: r.y, w: r.x + r.w - x1, h: r.h }, { x: x0, y: r.y, w: x1 - x0, h: y0 - r.y }, { x: x0, y: y1, w: x1 - x0, h: r.y + r.h - y1 }].filter((q) => q.w > 1 && q.h > 1);
}

export function buildKitchen(project: Project, nest: NestResult | null, stoneTex: THREE.Texture | null, finish: Finish = 'polished'): Built {
  const group = new THREE.Group(), H = project.counterH, T = project.thickness;
  // גימור האבן: מבריק = השתקפות חדה של החדר; מט = פיזור רך; סטרקצ׳ר = מרקם עדין מתוך הגיד עצמו
  const FIN = { polished: { roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 1.15 }, matte: { roughness: 0.58, clearcoat: 0, clearcoatRoughness: 1, envMapIntensity: 0.8 }, structure: { roughness: 0.72, clearcoat: 0, clearcoatRoughness: 1, envMapIntensity: 0.7 } }[finish];
  const stone = new THREE.MeshPhysicalMaterial({ map: stoneTex, color: stoneTex ? 0xffffff : 0xe6e1d8, ...FIN, ...(finish === 'structure' && stoneTex ? { bumpMap: stoneTex, bumpScale: 2.2 } : {}) });
  const cab = new THREE.MeshStandardMaterial({ color: project.cabinetColor, roughness: 0.62 });
  const cabX = project.xray ? new THREE.MeshStandardMaterial({ color: project.cabinetColor, roughness: 0.62, transparent: true, opacity: 0.18, depthWrite: false }) : cab;
  const upColor = project.upperColor || project.cabinetColor, upStyle = project.upperStyle || 'doors';
  const upMat = new THREE.MeshStandardMaterial({ color: upColor, roughness: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({ color: project.glassTint || '#cfe3e6', roughness: 0.06, metalness: 0, transparent: true, opacity: 0.32, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const sinks: THREE.Vector3[] = [];
  const lamps: THREE.Vector3[] = [], seam = new THREE.MeshBasicMaterial({ color: 0x3a342c, transparent: true, opacity: 0.55 });
  const mirror = project.bookmatch === 'yes';
  const dark = new THREE.MeshStandardMaterial({ color: 0x1f1e1c, roughness: 0.5, metalness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc3c7cc, roughness: 0.28, metalness: 0.95 });
  const wallMat = new THREE.MeshStandardMaterial({ color: project.wallColor || '#f4f2ee', roughness: 0.96 });
  const flat = project.pieces.filter((p) => !isVertical(p)), byId = new Map(project.pieces.map((p) => [p.id, p]));
  const plsOf = (id: string) => (nest?.slabs.flatMap((s) => s.placements) || []).filter((pl) => pl.pieceId === id && isBody(pl));

  const add = (m: THREE.Object3D, shadow = true) => { m.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = shadow; o.receiveShadow = true; } }); group.add(m); return m; };
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * S, h * S, d * S), mat); m.position.set(x * S, y * S, z * S); return add(m); };
  /** UV לפי המיקום האמיתי של החלק על הלוח — כך הגיד בהדמיה הוא הגיד שייחתך. */
  const uvAt = (p: Piece, pls: Placement[], lx: number, ly: number): [number, number] => {
    if (!pls.length) return [lx / project.slabW, 1 - ly / project.slabH];
    const pl = pls.find((q) => { const s = segLocal(p, q); return lx >= s.x - 0.5 && lx <= s.x + s.w + 0.5 && ly >= s.y - 0.5 && ly <= s.y + s.h + 0.5; }) || pls[0], s = segLocal(p, pl);
    const pt = localToSlab(p, pl, Math.max(s.x, Math.min(s.x + s.w, lx)), Math.max(s.y, Math.min(s.y + s.h, ly)));
    const u = pt.x / project.slabW;
    return [mirror && pl.slab % 2 ? 1 - u : u, 1 - pt.y / project.slabH]; // בוק־מאץ': לוח שני במראה
  };
  const hole = (c: Cutout) => {
    const h = new THREE.Path();
    if (c.round) h.absellipse(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, c.h / 2, 0, Math.PI * 2, true);
    else { const r = Math.min(c.kind === 'sink' ? 26 : 8, c.w / 2, c.h / 2), x = c.x, y = c.y, w = c.w, hh = c.h; h.moveTo(x + r, y); h.lineTo(x + w - r, y); h.quadraticCurveTo(x + w, y, x + w, y + r); h.lineTo(x + w, y + hh - r); h.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh); h.lineTo(x + r, y + hh); h.quadraticCurveTo(x, y + hh, x, y + hh - r); h.lineTo(x, y + r); h.quadraticCurveTo(x, y, x + r, y); }
    return h;
  };

  for (const p of flat) {
    const pls = plsOf(p.id), cuts = project.cutouts.filter((c) => c.pieceId === p.id);
    const segs = p.outline || pls.length < 2 ? [{ x: 0, y: 0, w: p.w, h: p.h }] : pls.map((pl) => segLocal(p, pl));
    // --- המשטח עצמו, עם פתחים אמיתיים ---
    const inside = (c: Cutout, s: Rect) => c.x > s.x + 1 && c.y > s.y + 1 && c.x + c.w < s.x + s.w - 1 && c.y + c.h < s.y + s.h - 1;
    for (const seg of segs) {
      // פתח שחיבור עובר דרכו (חיבור בכיור / בכיריים) חותך את המקטע למלבנים; פתח שלם הוא חור
      let rects: Rect[] = [seg];
      if (!p.outline) for (const c of cuts) if (!segs.some((q) => inside(c, q))) rects = rects.flatMap((r) => subtract(r, c));
      for (const s of rects) {
        const shape = new THREE.Shape();
        if (p.outline && segs.length === 1) p.outline.forEach((q, i) => (i ? shape.lineTo(q.x, q.y) : shape.moveTo(q.x, q.y)));
        else { shape.moveTo(s.x, s.y); shape.lineTo(s.x + s.w, s.y); shape.lineTo(s.x + s.w, s.y + s.h); shape.lineTo(s.x, s.y + s.h); }
        for (const c of cuts) if (inside(c, s)) shape.holes.push(hole(c));
        // קצה מעוגל קלות (1.5 מ"מ) — כמו אבן מלוטשת, לא קופסה חדה
        const bv = Math.min(1.5, T / 6), g = new THREE.ExtrudeGeometry(shape, { depth: T - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.8, bevelOffset: -bv * 0.8, bevelSegments: 3, curveSegments: 10 }); g.translate(0, 0, bv);
        const pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) { const [u, v] = uvAt(p, pls, pos.getX(i), pos.getY(i)); uv[i * 2] = u; uv[i * 2 + 1] = v; }
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.rotateX(Math.PI / 2); g.scale(S, S, S);
        const m = new THREE.Mesh(g, stone); m.position.set(p.x * S, H * S, p.y * S); add(m);
      }
    }
    // --- קווי חיבור ---
    for (const j of (nest?.joints || []).filter((j) => j.pieceId === p.id)) {
      const lx = longIsX(p), wid = lx ? p.h : p.w;
      const line = new THREE.Mesh(new THREE.BoxGeometry((lx ? 1.6 : wid) * S, 0.6 * S, (lx ? wid : 1.6) * S), seam); line.position.set((p.x + (lx ? j.at : wid / 2)) * S, (H + 0.4) * S, (p.y + (lx ? wid / 2 : j.at)) * S); group.add(line);
    }
    // --- קנט ---
    if (project.apronH > T) for (const side of p.aprons) {
      const e = hostEdge(p, side), ah = project.apronH - T, n = Math.max(1, Math.ceil(e.len / 120));
      const g = new THREE.BoxGeometry(e.len, ah, T, n, 1, 1), pos = g.attributes.position, uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) { const a = pos.getX(i) + e.len / 2, lx = e.x - p.x + e.dx * a, ly = e.y - p.y + e.dy * a, [u, v] = uvAt(p, pls, lx, ly); uv.setXY(i, u, v - ((ah / 2 - pos.getY(i)) / project.slabH) * 0.6); }
      g.scale(S, S, S);
      const m = new THREE.Mesh(g, stone); m.position.set((e.x + (e.dx * e.len) / 2 - (e.nx * T) / 2) * S, (H - T - ah / 2) * S, (e.y + (e.dy * e.len) / 2 - (e.ny * T) / 2) * S); if (e.dy) m.rotation.y = -Math.PI / 2; add(m);
    }
    // --- ארונות תחתונים ---
    if (project.cabinets && p.kind !== 'panel') {
      const front: Side = p.wall === 'back' ? 'front' : p.wall === 'front' ? 'back' : p.wall === 'left' ? 'right' : p.wall === 'right' ? 'left' : p.w >= p.h ? 'front' : 'right';
      const ins = (s: Side) => (p.seat === s ? p.seatDepth || SEAT_DEPTH : p.wall === s ? 0 : s === front ? 30 : p.kind === 'island' ? 30 : 4) + (project.pieces.some((w) => w.kind === 'waterfall' && w.host === p.id && w.side === s) ? T : 0);
      const x0 = p.x + ins('left'), x1 = p.x + p.w - ins('right'), z0 = p.y + ins('back'), z1 = p.y + p.h - ins('front'), toe = PLINTH_H, ch = H - T - toe, toeMat = project.plinthStone ? stone : dark;
      // גוף הארון חלול מתחת לכיור, כדי שהכיור, הטוחן ומערכת המים יהיו אמיתיים בפנים
      let bodies: Rect[] = [{ x: x0, y: z0, w: x1 - x0, h: z1 - z0 }];
      for (const c of cuts.filter((q) => q.kind === 'sink')) bodies = bodies.flatMap((r) => subtract(r, { x: p.x + c.x - T - 8, y: p.y + c.y - T - 8, w: c.w + 2 * T + 16, h: c.h + 2 * T + 16 }));
      for (const r of bodies) box(r.w, ch, r.h, cab, r.x + r.w / 2, toe + ch / 2, r.y + r.h / 2);
      const e = hostEdge({ ...p, x: x0, y: z0, w: x1 - x0, h: z1 - z0 }, front);
      box(e.dx ? x1 - x0 : x1 - x0 - 70, toe, e.dx ? z1 - z0 - 70 : z1 - z0, toeMat, (x0 + x1) / 2 - (e.dx ? 0 : e.nx * 35), toe / 2, (z0 + z1) / 2 - (e.dx ? e.ny * 35 : 0));
      const doors = Math.max(1, Math.round(e.len / 600)), dw = e.len / doors;
      for (let i = 0; i < doors; i++) {
        const a = dw * (i + 0.5), cx = e.x + e.dx * a + e.nx * 9, cz = e.y + e.dy * a + e.ny * 9;
        const a0 = (e.dx ? e.x : e.y) + a - dw / 2, a1 = a0 + dw, atSink = cuts.some((q) => q.kind === 'sink' && (e.dx ? p.x + q.x < a1 && p.x + q.x + q.w > a0 : p.y + q.y < a1 && p.y + q.y + q.h > a0));
        box(e.dx ? dw - 5 : 18, ch - 6, e.dx ? 18 : dw - 5, atSink ? cabX : cab, cx, toe + ch / 2, cz);
        box(e.dx ? 150 : 10, 10, e.dx ? 10 : 150, dark, cx + e.nx * 16, toe + ch - 48, cz + e.ny * 16);
      }
    }
    // --- כיסאות בר בצד הישיבה ---
    if (p.seat) {
      const e = hostEdge(p, p.seat), n = chairCount(p), sh = H - 250, wood = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.55 }), pad = new THREE.MeshStandardMaterial({ color: 0xb9a688, roughness: 0.8 });
      for (let i = 0; i < n; i++) {
        const a = (e.len / n) * (i + 0.5), cx = e.x + e.dx * a + e.nx * 120, cz = e.y + e.dy * a + e.ny * 120;
        const seat = new THREE.Mesh(new THREE.CylinderGeometry(185 * S, 170 * S, 45 * S, 28), pad); seat.position.set(cx * S, sh * S, cz * S); add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry((e.dx ? 320 : 22) * S, 190 * S, (e.dx ? 22 : 320) * S), pad); back.position.set((cx + e.nx * 170) * S, (sh + 130) * S, (cz + e.ny * 170) * S); add(back);
        for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(11 * S, 9 * S, (sh - 20) * S, 8), wood); leg.position.set((cx + ox * 140) * S, ((sh - 20) / 2) * S, (cz + oz * 140) * S); add(leg); }
        const ring = new THREE.Mesh(new THREE.TorusGeometry(175 * S, 7 * S, 6, 28), wood); ring.rotation.x = Math.PI / 2; ring.position.set(cx * S, 230 * S, cz * S); add(ring);
      }
    }
    // --- קיר וארונות עליונים ---
    if (p.wall) {
      const e = hostEdge(p, p.wall), wh = 2500, wt = 100, cx = e.x + (e.dx * e.len) / 2 + (e.nx * wt) / 2, cz = e.y + (e.dy * e.len) / 2 + (e.ny * wt) / 2;
      const w = box(e.dx ? e.len + 900 : wt, wh, e.dx ? wt : e.len + 900, wallMat, cx, wh / 2, cz); w.traverse((o) => (o.castShadow = false)); w.userData.wallN = [e.nx, e.ny];
      // בפינה הארונות העליונים ממשיכים עד הארון של הקיר הניצב (שעומקו 35 ס"מ)
      const ce = cornerExt(project, p), l0 = Math.max(0, ce.lead - 350), t0 = Math.max(0, ce.tail - 350), eu = { ...e, x: e.x - e.dx * l0, y: e.y - e.dy * l0, len: e.len + l0 + t0 };
      if (project.uppers && p.kind === 'counter' && e.len > 900) {
        const d = 350, ub = upperBottom(project), uh = UPPER_TOP - ub, ux = eu.x + (eu.dx * eu.len) / 2 - (eu.nx * d) / 2, uz = eu.y + (eu.dy * eu.len) / 2 - (eu.ny * d) / 2;
        const along = (a: number, off: number, y: number, w: number, h: number, t: number, mat: THREE.Material) => box(eu.dx ? w : t, h, eu.dx ? t : w, mat, eu.x + eu.dx * a - eu.nx * off, y, eu.y + eu.dy * a - eu.ny * off);
        if (upStyle === 'shelves') {
          // מדפים פתוחים: שלושה מדפים עבים וכמה פריטים עליהם
          const rows = uh > 800 ? 3 : 2;
          for (let r = 0; r < rows; r++) { const y = ub + (uh / rows) * r + 20; along(eu.len / 2, 150, y, eu.len - 60, 40, 300, upMat);
            for (let k = 0; k < Math.floor(eu.len / 520); k++) { const a = 200 + k * 520 + (r % 2) * 160; if (a > eu.len - 200) break; const hh = 110 + ((k * 37 + r * 53) % 120), col = [0xd9cdb8, 0x8a8f7d, 0xf1ede4, 0x5c5248][(k + r) % 4]; along(a, 150, y + 20 + hh / 2, 90 + ((k * 29) % 60), hh, 110, new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 })); } }
        } else if (upStyle === 'glass') {
          // ויטרינה: גוף פתוח, מדפים וחזית זכוכית בגוון נבחר
          along(eu.len / 2, 9, ub + uh / 2, eu.len, uh, 18, upMat); along(eu.len / 2, d / 2, ub + 9, eu.len, 18, d, upMat); along(eu.len / 2, d / 2, ub + uh - 9, eu.len, 18, d, upMat);
          for (const a of [9, eu.len - 9]) along(a, d / 2, ub + uh / 2, 18, uh, d, upMat);
          for (let r = 1; r < 3; r++) along(eu.len / 2, d / 2, ub + (uh / 3) * r, eu.len - 36, 10, d - 30, glass);
          const n = Math.max(1, Math.round(eu.len / 500)), w = eu.len / n;
          for (let i = 0; i < n; i++) { const a = w * (i + 0.5); along(a, d + 3, ub + uh / 2, w - 44, uh - 44, 5, glass);
            along(a, d + 3, ub + 11, w - 4, 22, 20, upMat); along(a, d + 3, ub + uh - 11, w - 4, 22, 20, upMat); along(a - w / 2 + 11, d + 3, ub + uh / 2, 22, uh, 20, upMat); along(a + w / 2 - 11, d + 3, ub + uh / 2, 22, uh, 20, upMat); }
        } else {
          box(eu.dx ? eu.len : d, uh, eu.dx ? d : eu.len, upMat, ux, ub + uh / 2, uz);
          if (upStyle === 'klapa') {
            // קלאפות: חזיתות רחבות שנפתחות למעלה, בשתי שורות כשהארון גבוה
            const n = Math.max(1, Math.round(eu.len / 900)), rows = uh >= 600 ? 2 : 1;
            for (let i = 1; i < n; i++) along((eu.len / n) * i, d + 1, ub + uh / 2, 4, uh - 4, 3, dark);
            for (let r = 1; r < rows; r++) along(eu.len / 2, d + 1, ub + (uh / rows) * r, eu.len - 4, 4, 3, dark);
          } else { const n = Math.max(1, Math.round(eu.len / 600)); for (let i = 1; i < n; i++) along((eu.len / n) * i, d + 1, ub + uh / 2, 4, uh - 4, 3, dark); }
        }
        if (project.underLight !== false && upStyle !== 'shelves') {
          const lamp = new THREE.Mesh(new THREE.BoxGeometry((eu.dx ? eu.len - 80 : 14) * S, 6 * S, (eu.dx ? 14 : eu.len - 80) * S), new THREE.MeshBasicMaterial({ color: 0xfff1d6 })); lamp.position.set((ux - eu.nx * 60) * S, (ub - 4) * S, (uz - eu.ny * 60) * S); group.add(lamp);
          for (const f of eu.len > 2200 ? [0.2, 0.5, 0.8] : [0.3, 0.7]) lamps.push(new THREE.Vector3((eu.x + eu.dx * eu.len * f - eu.nx * 200) * S, (ub - 60) * S, (eu.y + eu.dy * eu.len * f - eu.ny * 200) * S));
        }
      }
    }
    // --- כיור, ברז, כיריים ---
    for (const c of cuts) {
      const cx = p.x + c.x + c.w / 2, cz = p.y + c.y + c.h / 2;
      if (c.kind === 'sink') {
        const depth = 200, horiz = c.w >= c.h, bowls = c.bowls && c.bowls !== 'single' ? (c.bowls === 'even' ? [0.5] : [0.6]) : [];
        const fb = c.built ? T : 3, yb = H - T - depth; // תחתית הכיור (פנים)
        sinks.push(new THREE.Vector3(cx * S, H * S, cz * S));
        // אבן לחלקי הכיור: UV לפי המידה האמיתית, כדי שהגיד לא יימתח
        const sbox = (w: number, h: number, d: number, x: number, y: number, z: number, seed: number) => {
          const g = new THREE.BoxGeometry(w * S, h * S, d * S), uv = g.attributes.uv as THREE.BufferAttribute, su = Math.max(w, d) / project.slabW, sv = Math.max(h, Math.min(w, d)) / project.slabH, ou = (seed * 0.173) % (1 - su), ov = (seed * 0.291) % (1 - sv);
          for (let i = 0; i < uv.count; i++) uv.setXY(i, ou + uv.getX(i) * su, ov + uv.getY(i) * sv);
          const m = new THREE.Mesh(g, stone); m.position.set(x * S, y * S, z * S); return add(m);
        };
        if (c.built) {
          // כיור בנוי בהתקנה תחתונה: ארבע דפנות ותחתית מאותה אבן, עם קווי הדבקה בפינות
          sbox(c.w + 2 * T, depth, T, cx, yb + depth / 2, p.y + c.y - T / 2, 1); sbox(c.w + 2 * T, depth, T, cx, yb + depth / 2, p.y + c.y + c.h + T / 2, 2);
          sbox(T, depth, c.h, p.x + c.x - T / 2, yb + depth / 2, cz, 3); sbox(T, depth, c.h, p.x + c.x + c.w + T / 2, yb + depth / 2, cz, 4);
          sbox(c.w + 2 * T, T, c.h + 2 * T, cx, yb - T / 2, cz, 5);
          const ln = (w: number, h: number, d: number, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * S, h * S, d * S), seam); m.position.set(x * S, y * S, z * S); group.add(m); };
          for (const [sx, sz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) ln(2.4, depth, 2.4, p.x + c.x + sx * c.w + (sx ? -0.8 : 0.8), yb + depth / 2, p.y + c.y + sz * c.h + (sz ? -0.8 : 0.8));
          for (const sz of [0, 1]) ln(c.w, 2.4, 2.4, cx, yb + 1.2, p.y + c.y + sz * c.h + (sz ? -0.8 : 0.8));
          for (const sx of [0, 1]) ln(2.4, 2.4, c.h, p.x + c.x + sx * c.w + (sx ? -0.8 : 0.8), yb + 0.8, cz);
          ln(c.w, 1.2, 1.2, cx, H - T - 0.4, p.y + c.y + 0.6); ln(c.w, 1.2, 1.2, cx, H - T - 0.4, p.y + c.y + c.h - 0.6); // קו ההדבקה מתחת למשטח
        } else {
          const basin = new THREE.Mesh(new THREE.BoxGeometry((c.w + 4) * S, depth * S, (c.h + 4) * S), new THREE.MeshStandardMaterial({ color: 0xb4b8bd, roughness: 0.3, metalness: 0.92, side: THREE.BackSide })); basin.position.set(cx * S, (yb + depth / 2) * S, cz * S); basin.receiveShadow = true; group.add(basin);
        }
        for (const f of bowls) (c.built ? sbox : (w: number, h: number, d: number, x: number, y: number, z: number) => box(w, h, d, steel, x, y, z))(horiz ? fb + 2 : c.w, depth - 20, horiz ? c.h : fb + 2, p.x + c.x + (horiz ? c.w * f : c.w / 2), yb + (depth - 20) / 2, p.y + c.y + (horiz ? c.h / 2 : c.h * f), 6);
        const drains = bowls.length ? [bowls[0] / 2, bowls[0] + (1 - bowls[0]) / 2] : [0.5];
        drains.forEach((f, n) => {
          const dx = p.x + c.x + (horiz ? c.w * f : c.w / 2), dz = p.y + c.y + (horiz ? c.h / 2 : c.h * f);
          const ring = new THREE.Mesh(new THREE.CylinderGeometry(45 * S, 45 * S, 3 * S, 28), c.built && c.drainCover ? dark : steel); ring.position.set(dx * S, (yb + 1.5) * S, dz * S); group.add(ring);
          if (c.built && c.drainCover) { box(166, 5, 166, dark, dx, yb + 2.5, dz); sbox(150, T * 0.7, 150, dx, yb + 7 + T * 0.35, dz, 7 + n); } // ונטיל: מכסה ניקוז מאותה אבן, מורם מעט מעל התחתית
          else { const hole = new THREE.Mesh(new THREE.CylinderGeometry(30 * S, 30 * S, 3.4 * S, 24), dark); hole.position.set(dx * S, (yb + 1.6) * S, dz * S); group.add(hole); }
        });
        const dX = p.x + c.x + (horiz ? c.w * drains[0] : c.w / 2), dZ = p.y + c.y + (horiz ? c.h / 2 : c.h * drains[0]), under = yb - fb;
        // --- טוחן אשפה נובו: תלוי ישירות מתחת לניקוז, בקו התחתון של הכיור ---
        if (project.disposal) {
          const R = 105, DH = 360, g = new THREE.Group();
          const gun = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.38, metalness: 0.75 }), rib = new THREE.MeshStandardMaterial({ color: 0x232527, roughness: 0.6, metalness: 0.2 });
          const pts = (arr: [number, number][]) => arr.map(([r, y]) => new THREE.Vector2(r * S, y * S));
          const lower = new THREE.Mesh(new THREE.LatheGeometry(pts([[0, 0], [R - 8, 0], [R, 10], [R, DH * 0.5]]), 40), rib); g.add(lower);
          for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI / 2) < 0.75) continue; const r = new THREE.Mesh(new THREE.BoxGeometry(5 * S, DH * 0.46 * S, 3 * S), rib); r.position.set(Math.cos(a) * (R + 0.5) * S, DH * 0.25 * S, Math.sin(a) * (R + 0.5) * S); r.rotation.y = -a + Math.PI / 2; g.add(r); }
          const upper = new THREE.Mesh(new THREE.LatheGeometry(pts([[R + 1, DH * 0.48], [R + 2, DH * 0.72], [R - 6, DH * 0.86], [R - 28, DH * 0.95], [62, DH]]), 40), gun); g.add(upper);
          // "לשון" מתכתית שיורדת בחזית עד קרוב לתחתית
          const tongue = new THREE.Mesh(new THREE.CylinderGeometry((R + 2) * S, (R + 1.5) * S, DH * 0.42 * S, 24, 1, true, -0.62, 1.24), new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.38, metalness: 0.75, side: THREE.DoubleSide })); tongue.position.y = DH * 0.29 * S; g.add(tongue);
          const badge = new THREE.Mesh(new THREE.CylinderGeometry(27 * S, 27 * S, 4 * S, 28), steel); badge.rotation.x = Math.PI / 2; badge.position.set(0, DH * 0.66 * S, (R + 2) * S); g.add(badge);
          const logo = new THREE.Mesh(new THREE.BoxGeometry(30 * S, 9 * S, 1 * S), dark); logo.position.set(0, DH * 0.66 * S, (R + 4.4) * S); g.add(logo);
          const neck = new THREE.Mesh(new THREE.CylinderGeometry(48 * S, 60 * S, 26 * S, 28), dark); neck.position.y = (DH + 13) * S; g.add(neck);
          for (const [r, y, h] of [[78, DH + 30, 8], [66, DH + 44, 14], [80, DH + 58, 7]]) { const ringM = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S, h * S, 32), steel); ringM.position.y = y * S; g.add(ringM); }
          for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5, bolt = new THREE.Mesh(new THREE.CylinderGeometry(4 * S, 4 * S, 34 * S, 8), steel); bolt.position.set(Math.cos(a) * 72 * S, (DH + 44) * S, Math.sin(a) * 72 * S); g.add(bolt); }
          // יציאה צדדית וסיפון לבן
          const side = horiz ? 1 : 0, elbow = new THREE.Mesh(new THREE.CylinderGeometry(22 * S, 22 * S, 90 * S, 16), rib); elbow.rotation.z = Math.PI / 2; elbow.position.set((R + 35) * S, DH * 0.8 * S, 0); g.add(elbow);
          const trap = new THREE.Mesh(new THREE.TorusGeometry(48 * S, 20 * S, 10, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0xf1f1ee, roughness: 0.5 })); trap.rotation.x = Math.PI; trap.position.set((R + 128) * S, DH * 0.8 * S, 0); g.add(trap);
          const top = under - 66; g.position.set(dX * S, (top - DH) * S, dZ * S); if (!side) g.rotation.y = Math.PI / 2; add(g);
          // כפתור אוויר על המשטח
          const fc = cuts.find((q) => q.kind === 'faucet'), bx = fc ? p.x + fc.x + fc.w / 2 + (horiz ? 140 : 0) : cx + c.w / 2 - 60, bz = fc ? p.y + fc.y + fc.h / 2 + (horiz ? 0 : 140) : p.y + Math.max(30, c.y / 2);
          const fl = new THREE.Mesh(new THREE.CylinderGeometry(27 * S, 27 * S, 5 * S, 28), steel); fl.position.set(bx * S, (H + 2.5) * S, bz * S); add(fl);
          const bt = new THREE.Mesh(new THREE.CylinderGeometry(15 * S, 16 * S, 7 * S, 24), steel); bt.position.set(bx * S, (H + 7) * S, bz * S); add(bt);
        }
        // --- מערכת מים תת־כיורית: מחמם (נירוסטה), מקרר ומסנן תלת־שלבי ---
        if (project.water) {
          const wx = p.x + c.x + (horiz ? c.w + T - 95 : c.w / 2), wz = p.y + c.y + (horiz ? c.h / 2 : c.h + T - 95), fy = PLINTH_H + 20;
          const heater = new THREE.Mesh(new THREE.BoxGeometry((horiz ? 150 : 190) * S, 260 * S, (horiz ? 190 : 150) * S), new THREE.MeshStandardMaterial({ color: 0xbfc3c7, roughness: 0.35, metalness: 0.85 })); heater.position.set(wx * S, (fy + 130) * S, (wz + (horiz ? 60 : 0)) * S); add(heater);
          const chill = new THREE.Mesh(new THREE.BoxGeometry((horiz ? 190 : 320) * S, 370 * S, (horiz ? 320 : 190) * S), new THREE.MeshStandardMaterial({ color: 0xeceeef, roughness: 0.45 })); chill.position.set((wx - (horiz ? 190 : 0)) * S, (fy + 185) * S, (wz - (horiz ? 0 : 190)) * S); add(chill);
          for (const k of [0, 1, 2]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(30 * S, 30 * S, 250 * S, 18), new THREE.MeshStandardMaterial({ color: 0xf6f7f8, roughness: 0.4 })), cap = new THREE.Mesh(new THREE.CylinderGeometry(32 * S, 32 * S, 26 * S, 18), new THREE.MeshStandardMaterial({ color: 0x2f7fd0, roughness: 0.4 })); const fx = p.x + c.x + (horiz ? 40 + k * 70 : c.w / 2), fz = p.y + c.y + (horiz ? -T - 40 + c.h + 2 * T + 0 : 40 + k * 70); f.position.set(fx * S, (fy + 300) * S, (horiz ? p.y + c.y + c.h + T - 45 : fz) * S); cap.position.set(f.position.x, (fy + 300 + 138) * S / 1, f.position.z); cap.position.y = (fy + 438) * S; add(f); add(cap); }
        }
      } else if (c.kind === 'cooktop') {
        box(c.w + 24, 6, c.h + 24, new THREE.MeshPhysicalMaterial({ color: 0x0c0c0e, roughness: 0.08, clearcoat: 1 }), cx, H + 3, cz);
        for (const [fx, fy, r] of [[0.28, 0.3, 0.8], [0.72, 0.3, 1], [0.28, 0.72, 1], [0.72, 0.72, 0.8]]) { const ring = new THREE.Mesh(new THREE.RingGeometry(Math.min(c.w, c.h) * 0.15 * r * S, Math.min(c.w, c.h) * 0.165 * r * S, 40), new THREE.MeshBasicMaterial({ color: 0x77777c })); ring.rotation.x = -Math.PI / 2; ring.position.set((p.x + c.x + c.w * fx) * S, (H + 6.4) * S, (p.y + c.y + c.h * fy) * S); group.add(ring); }
      } else if (c.kind === 'faucet') {
        const sink = cuts.find((q) => q.kind === 'sink'), tx = sink ? p.x + sink.x + sink.w / 2 - cx : 0, tz = sink ? p.y + sink.y + sink.h / 2 - cz : 150, len = Math.hypot(tx, tz) || 1, dx = tx / len, dz = tz / len;
        const fm = faucetById(project.faucet), fin = FINISHES[project.faucetFinish && fm.finishes.includes(project.faucetFinish) ? project.faucetFinish : fm.finishes[0]];
        const metal = new THREE.MeshStandardMaterial({ color: fin.hex, roughness: fin.rough, metalness: fin.hex === '#f3f3f1' ? 0.1 : 0.92 });
        const neck = (ox: number, oz: number, h: number, reach0: number, tube: number, base: number, baseH: number, head: number) => {
          const reach = Math.min(reach0, len * 0.8), top = h, r = reach / 2;
          const curve = new THREE.CatmullRomCurve3([[0, baseH], [0, top - r], [reach * 0.15, top - r * 0.3], [reach * 0.5, top], [reach * 0.85, top - r * 0.3], [reach, top - r], [reach, top - r - 60]].map(([a, y]) => new THREE.Vector3(dx * a * S, y * S, dz * a * S)));
          const tubeM = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, tube * S, 14), metal); tubeM.position.set((cx + ox) * S, H * S, (cz + oz) * S); add(tubeM);
          const b = new THREE.Mesh(new THREE.CylinderGeometry((fm.id === 'K149' ? tube + 2 : base) * S, base * S, baseH * S, 28), metal); b.position.set((cx + ox) * S, (H + baseH / 2) * S, (cz + oz) * S); add(b);
          const hd = new THREE.Mesh(new THREE.CylinderGeometry(head * S, (head + (fm.lever === 'tear' ? 8 : 1)) * S, 70 * S, 20), metal); hd.position.set((cx + ox + dx * reach) * S, (H + top - r - 95) * S, (cz + oz + dz * reach) * S); add(hd);
        };
        neck(0, 0, fm.h, fm.reach, fm.tube, fm.base, fm.baseH, fm.head);
        // ידית: בצד הבסיס, בניצב לכיוון הכיור
        const px = -dz, pz = dx, lv = (w: number, h: number, d: number, off: number, y: number, tilt = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * S, h * S, d * S), metal); m.position.set((cx + px * off) * S, (H + y) * S, (cz + pz * off) * S); m.rotation.y = Math.atan2(px, pz); m.rotation.x = tilt; add(m); };
        const valve = new THREE.Mesh(new THREE.CylinderGeometry(15 * S, 15 * S, 34 * S, 18), metal); valve.rotation.z = Math.PI / 2; valve.rotation.y = Math.atan2(-pz, px); valve.position.set((cx + px * (fm.base + 12)) * S, (H + fm.baseH * 0.62) * S, (cz + pz * (fm.base + 12)) * S); add(valve);
        if (fm.lever === 'pin') lv(5, 70, 5, fm.base + 26, fm.baseH * 0.62 + 32);
        else if (fm.lever === 'blade') lv(8, 95, 22, fm.base + 26, fm.baseH * 0.62 + 44);
        else if (fm.lever === 'paddle') lv(10, 26, 90, fm.base + 30, fm.baseH * 0.62 + 16);
        else if (fm.lever === 'tear') lv(12, 80, 16, fm.base + 28, fm.baseH * 0.62 + 36, 0.25);
        else { lv(8, 80, 18, fm.base + 26, fm.baseH * 0.62 + 38); const k = new THREE.Mesh(new THREE.CylinderGeometry(13 * S, 13 * S, 26 * S, 18), metal); k.rotation.z = Math.PI / 2; k.rotation.y = Math.atan2(-pz, px); k.position.set((cx - px * (fm.base + 10)) * S, (H + fm.baseH * 0.5) * S, (cz - pz * (fm.base + 10)) * S); add(k); }
        if (fm.id === 'K121') for (const y of [fm.baseH * 0.3, fm.baseH * 0.95]) { const rg = new THREE.Mesh(new THREE.TorusGeometry((fm.base - 3) * S, 4 * S, 8, 24), metal); rg.rotation.x = Math.PI / 2; rg.position.set(cx * S, (H + y) * S, cz * S); add(rg); }
        // ברז ייעודי למערכת המים (hc2100), אם הברז הראשי אינו 4in1
        if (project.water && !fm.water) { const off = 150; neck(-px * off, -pz * off, 243, 120, 8, 17, 46, 8.5); const l2 = new THREE.Mesh(new THREE.BoxGeometry(5 * S, 5 * S, 40 * S), metal); l2.position.set((cx - px * (off + 30)) * S, (H + 34) * S, (cz - pz * (off + 30)) * S); l2.rotation.y = Math.atan2(px, pz); add(l2); }
      }
    }
  }

  // --- חיבורי פינה (ישר או 45°) ---
  for (const c of corners(project)) {
    const len = Math.hypot(c.x2 - c.x1, c.y2 - c.y1), line = new THREE.Mesh(new THREE.BoxGeometry(len * S, 0.6 * S, 1.6 * S), seam);
    line.position.set(((c.x1 + c.x2) / 2) * S, (H + 0.4) * S, ((c.y1 + c.y2) / 2) * S); line.rotation.y = -Math.atan2(c.y2 - c.y1, c.x2 - c.x1); group.add(line);
  }
  // --- גופי תאורה תלויים מעל אי ---
  for (const isl of flat.filter((q) => q.kind === 'island')) {
    const lx = isl.w >= isl.h, n = (lx ? isl.w : isl.h) > 1800 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const f = (i + 1) / (n + 1), px = isl.x + (lx ? isl.w * f : isl.w / 2), pz = isl.y + (lx ? isl.h / 2 : isl.h * f);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(45 * S, 90 * S, 150 * S, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x23211f, roughness: 0.5, side: THREE.DoubleSide })); shade.position.set(px * S, 1.72, pz * S); group.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(32 * S, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff0d2 })); bulb.position.set(px * S, 1.67, pz * S); group.add(bulb);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(2 * S, 2 * S, 0.75, 6), dark); cord.position.set(px * S, 2.17, pz * S); group.add(cord);
      lamps.push(new THREE.Vector3(px * S, 1.6, pz * S));
    }
  }
  // --- חיפוי קיר ומפלים ---
  for (const q of project.pieces.filter(isVertical)) {
    const host = q.host ? byId.get(q.host) : undefined; if (!host || !q.side) continue;
    const e = hostEdge(host, q.side), pls = plsOf(q.id), len = q.kind === 'splash' ? q.w : Math.min(q.w, e.len), o0 = q.kind === 'splash' ? q.off || 0 : 0, splash = q.kind === 'splash', n = Math.max(1, Math.ceil(len / 200));
    const g = new THREE.BoxGeometry(len, q.h, T, n, 1, 1), pos = g.attributes.position, uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { const [u, v] = uvAt(q, pls, pos.getX(i) + len / 2, q.h / 2 - pos.getY(i)); uv.setXY(i, u, v); }
    g.scale(S, S, S);
    const m = new THREE.Mesh(g, stone), y0 = splash ? H : 0, hh = splash ? q.h : Math.min(q.h, H - T);
    m.position.set((e.x + e.dx * (o0 + len / 2) - (e.nx * T) / 2) * S, (y0 + hh / 2) * S, (e.y + e.dy * (o0 + len / 2) - (e.ny * T) / 2) * S); if (!splash) m.scale.y = hh / q.h; if (e.dy) m.rotation.y = -Math.PI / 2; add(m);
  }

  // --- מכשירים: קולט אדים מעל הכיריים, וטור גבוה (תנור + מקרר) בקצה הפנוי של הקיר הארוך ---
  if (project.appliances !== false) {
    const hoodMat = new THREE.MeshStandardMaterial({ color: 0xb9bdc2, roughness: 0.3, metalness: 0.9 }), glassBlk = new THREE.MeshPhysicalMaterial({ color: 0x111214, roughness: 0.05, clearcoat: 1 });
    for (const c of project.cutouts.filter((q) => q.kind === 'cooktop')) {
      const p = byId.get(c.pieceId); if (!p?.wall) continue;
      const e = hostEdge(p, p.wall), cx = p.x + c.x + c.w / 2, cz = p.y + c.y + c.h / 2, hw = Math.max(600, c.w + 120), lx = !!e.dx;
      const wx = lx ? cx : e.x - e.nx * 250, wz = lx ? e.y - e.ny * 250 : cz;
      if (project.uppers) box(lx ? hw : 500, 50, lx ? 500 : hw, hoodMat, wx, upperBottom(project) - 25, wz);
      else { box(lx ? hw : 500, 70, lx ? 500 : hw, hoodMat, wx, H + 680, wz); const ch = 2500 - (H + 715); box(lx ? 300 : 260, ch, lx ? 260 : 300, hoodMat, lx ? cx : e.x - e.nx * 130, H + 715 + ch / 2, lx ? e.y - e.ny * 130 : cz); }
    }
    const main = flat.filter((q) => q.wall && q.kind === 'counter').sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h))[0];
    if (main?.wall) {
      const e = hostEdge(main, main.wall), ce = cornerExt(project, main), d = 600, th = 2200;
      // קצה פנוי: לא ממשיך לפינה ואין משטח ניצב שנצמד אליו מלפנים
      const D = e.dx ? main.h : main.w, at = (a: number, off: number) => ({ x: e.x + e.dx * a - e.nx * off, y: e.y + e.dy * a - e.ny * off });
      const busy = (a: number) => [50, 650].some((k) => { const q0 = at(a === 0 ? k : e.len - k, D + 12); return flat.some((q) => q !== main && q0.x > q.x - 1 && q0.x < q.x + q.w + 1 && q0.y > q.y - 1 && q0.y < q.y + q.h + 1); });
      const end = ce.tail === 0 && !busy(e.len) ? 1 : ce.lead === 0 && !busy(0) ? -1 : 0;
      if (end) {
        const a0 = end > 0 ? e.len : -1200, rect = { x: Math.min(e.x + e.dx * a0, e.x + e.dx * (a0 + 1200)) - (e.nx > 0 ? d : 0), y: Math.min(e.y + e.dy * a0, e.y + e.dy * (a0 + 1200)) - (e.ny > 0 ? d : 0), w: e.dx ? 1200 : d, h: e.dx ? d : 1200 };
        const hit = flat.some((q) => q.x < rect.x + rect.w - 5 && q.x + q.w > rect.x + 5 && q.y < rect.y + rect.h - 5 && q.y + q.h > rect.y + 5);
        if (!hit) for (const [k, kind] of [[0, 'oven'], [1, 'fridge']] as const) {
          const a = a0 + 300 + 600 * (end > 0 ? k : 1 - k), px = e.x + e.dx * a - e.nx * (d / 2), pz = e.y + e.dy * a - e.ny * (d / 2);
          box(e.dx ? 596 : d, th, e.dx ? d : 596, cab, px, th / 2, pz);
          const wq = box(e.dx ? 600 : 100, 2500, e.dx ? 100 : 600, wallMat, e.x + e.dx * a + e.nx * 50, 1250, e.y + e.dy * a + e.ny * 50); wq.traverse((o) => (o.castShadow = false)); wq.userData.wallN = [e.nx, e.ny];
          const fx = px - e.nx * (d / 2 + 2), fz = pz - e.ny * (d / 2 + 2), face = (w: number, h: number, y: number, mat: THREE.Material, off = 0) => box(e.dx ? w : 6, h, e.dx ? 6 : w, mat, fx - e.nx * off, y, fz - e.ny * off);
          if (kind === 'oven') { face(560, 580, 1180, glassBlk); face(520, 22, 1440, steel, 18); face(560, 140, 800, glassBlk); }
          else { face(560, 2080, 1080, cab, 2); face(22, 900, 1200, steel, 22); }
        }
      }
    }
  }

  // --- רצפה ---
  const xs = flat.flatMap((p) => [p.x, p.x + p.w]), zs = flat.flatMap((p) => [p.y, p.y + p.h]);
  const bx0 = Math.min(0, ...xs), bx1 = Math.max(1000, ...xs), bz0 = Math.min(0, ...zs), bz1 = Math.max(600, ...zs);
  const center = new THREE.Vector3(((bx0 + bx1) / 2) * S, 0.75, ((bz0 + bz1) / 2) * S), radius = (Math.hypot(bx1 - bx0, bz1 - bz0) / 2) * S;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ map: floorTexture(project.floor), roughness: floorById(project.floor).type === 'plank' ? 0.55 : 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(center.x, 0, center.z); floor.receiveShadow = true; group.add(floor);
  return { group, center, radius, lamps, sinks };
}

export function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mats = Array.isArray(m.material) ? m.material : [m.material]; mats.forEach((mat) => { const mm = mat as THREE.MeshStandardMaterial; if (mm.map && (mm.map as THREE.CanvasTexture).isCanvasTexture) mm.map.dispose(); mat.dispose(); }); } });
}
