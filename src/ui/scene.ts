// בניית סצנת התלת־ממד מתוך מודל המטבח. יחידות: מטר. x בתוכנית → x, y בתוכנית → z, גובה → y.
import * as THREE from 'three';
import { Cutout, Piece, Project, Side, corners, hostEdge, isVertical, longIsX } from '../core/model';
import { NestResult, Placement, Rect, isBody, localToSlab, segLocal } from '../core/nesting';
import { floorById } from '../core/catalog';

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

export interface Built { group: THREE.Group; center: THREE.Vector3; radius: number; lamps: THREE.Vector3[] }

/** r פחות c: עד ארבעה מלבנים (לפתח שחיבור עובר דרכו). */
function subtract(r: Rect, c: Rect): Rect[] {
  const x0 = Math.max(r.x, c.x), x1 = Math.min(r.x + r.w, c.x + c.w), y0 = Math.max(r.y, c.y), y1 = Math.min(r.y + r.h, c.y + c.h);
  if (x1 - x0 < 1 || y1 - y0 < 1) return [r];
  return [{ x: r.x, y: r.y, w: x0 - r.x, h: r.h }, { x: x1, y: r.y, w: r.x + r.w - x1, h: r.h }, { x: x0, y: r.y, w: x1 - x0, h: y0 - r.y }, { x: x0, y: y1, w: x1 - x0, h: r.y + r.h - y1 }].filter((q) => q.w > 1 && q.h > 1);
}

export function buildKitchen(project: Project, nest: NestResult | null, stoneTex: THREE.Texture | null): Built {
  const group = new THREE.Group(), H = project.counterH, T = project.thickness;
  const stone = new THREE.MeshPhysicalMaterial({ map: stoneTex, color: stoneTex ? 0xffffff : 0xe6e1d8, roughness: 0.26, clearcoat: 0.4, clearcoatRoughness: 0.22, envMapIntensity: 0.95 });
  const cab = new THREE.MeshStandardMaterial({ color: project.cabinetColor, roughness: 0.62, transparent: !!project.xray, opacity: project.xray ? 0.2 : 1, depthWrite: !project.xray });
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
        const g = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 10 });
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
      const ins = (s: Side) => (p.wall === s ? 0 : s === front ? 30 : p.kind === 'island' ? 30 : 4) + (project.pieces.some((w) => w.kind === 'waterfall' && w.host === p.id && w.side === s) ? T : 0);
      const x0 = p.x + ins('left'), x1 = p.x + p.w - ins('right'), z0 = p.y + ins('back'), z1 = p.y + p.h - ins('front'), toe = 100, ch = H - T - toe;
      box(x1 - x0, ch, z1 - z0, cab, (x0 + x1) / 2, toe + ch / 2, (z0 + z1) / 2);
      const e = hostEdge({ ...p, x: x0, y: z0, w: x1 - x0, h: z1 - z0 }, front);
      box(e.dx ? x1 - x0 : x1 - x0 - 70, toe, e.dx ? z1 - z0 - 70 : z1 - z0, dark, (x0 + x1) / 2 - (e.dx ? 0 : e.nx * 35), toe / 2, (z0 + z1) / 2 - (e.dx ? e.ny * 35 : 0));
      const doors = Math.max(1, Math.round(e.len / 600)), dw = e.len / doors;
      for (let i = 0; i < doors; i++) {
        const a = dw * (i + 0.5), cx = e.x + e.dx * a + e.nx * 9, cz = e.y + e.dy * a + e.ny * 9;
        box(e.dx ? dw - 5 : 18, ch - 6, e.dx ? 18 : dw - 5, cab, cx, toe + ch / 2, cz);
        box(e.dx ? 150 : 10, 10, e.dx ? 10 : 150, dark, cx + e.nx * 16, toe + ch - 48, cz + e.ny * 16);
      }
    }
    // --- קיר וארונות עליונים ---
    if (p.wall) {
      const e = hostEdge(p, p.wall), wh = 2500, wt = 100, cx = e.x + (e.dx * e.len) / 2 + (e.nx * wt) / 2, cz = e.y + (e.dy * e.len) / 2 + (e.ny * wt) / 2;
      const w = box(e.dx ? e.len + 900 : wt, wh, e.dx ? wt : e.len + 900, wallMat, cx, wh / 2, cz); w.traverse((o) => (o.castShadow = false));
      if (project.uppers && p.kind === 'counter' && e.len > 900) {
        const d = 350, uh = 700, ub = 1500, ux = e.x + (e.dx * e.len) / 2 - (e.nx * d) / 2, uz = e.y + (e.dy * e.len) / 2 - (e.ny * d) / 2;
        box(e.dx ? e.len : d, uh, e.dx ? d : e.len, cab, ux, ub + uh / 2, uz);
        const n = Math.max(1, Math.round(e.len / 600));
        for (let i = 1; i < n; i++) { const a = (e.len / n) * i; box(e.dx ? 3 : 4, uh - 4, e.dx ? 4 : 3, dark, e.x + e.dx * a - e.nx * (d + 1), ub + uh / 2, e.y + e.dy * a - e.ny * (d + 1)); }
        const lamp = new THREE.Mesh(new THREE.BoxGeometry((e.dx ? e.len - 80 : 14) * S, 6 * S, (e.dx ? 14 : e.len - 80) * S), new THREE.MeshBasicMaterial({ color: 0xfff1d6 })); lamp.position.set((ux - e.nx * 60) * S, (ub - 4) * S, (uz - e.ny * 60) * S); group.add(lamp);
        for (const f of e.len > 2200 ? [0.2, 0.5, 0.8] : [0.3, 0.7]) lamps.push(new THREE.Vector3((e.x + e.dx * e.len * f - e.nx * 200) * S, (ub - 60) * S, (e.y + e.dy * e.len * f - e.ny * 200) * S));
      }
    }
    // --- כיור, ברז, כיריים ---
    for (const c of cuts) {
      const cx = p.x + c.x + c.w / 2, cz = p.y + c.y + c.h / 2;
      if (c.kind === 'sink') {
        const depth = 210, inner = c.built ? new THREE.MeshPhysicalMaterial({ map: stoneTex, color: stoneTex ? 0xdddddd : 0xd6d1c8, roughness: 0.3, side: THREE.BackSide }) : new THREE.MeshStandardMaterial({ color: 0xb4b8bd, roughness: 0.3, metalness: 0.92, side: THREE.BackSide });
        const basin = new THREE.Mesh(new THREE.BoxGeometry((c.w - 2) * S, depth * S, (c.h - 2) * S), inner); basin.position.set(cx * S, (H - T - depth / 2 + 1) * S, cz * S); basin.receiveShadow = true; group.add(basin);
        // תחתית הכיור כפי שהיא נראית דרך הפתח (מעל גוף הארון)
        const pan = new THREE.Mesh(new THREE.PlaneGeometry((c.w - 6) * S, (c.h - 6) * S), c.built ? new THREE.MeshPhysicalMaterial({ map: stoneTex, color: 0xcfcfcf, roughness: 0.35 }) : new THREE.MeshStandardMaterial({ color: 0x8e9398, roughness: 0.35, metalness: 0.85 })); pan.rotation.x = -Math.PI / 2; pan.position.set(cx * S, (H - T + 1) * S, cz * S); pan.receiveShadow = true; group.add(pan);
        const horiz = c.w >= c.h, bowls = c.bowls && c.bowls !== 'single' ? (c.bowls === 'even' ? [0.5] : [0.6]) : [];
        for (const f of bowls) box(horiz ? 14 : c.w - 6, T - 2, horiz ? c.h - 6 : 14, c.built ? stone : steel, p.x + c.x + (horiz ? c.w * f : c.w / 2), H - T / 2, p.y + c.y + (horiz ? c.h / 2 : c.h * f));
        const drains = bowls.length ? [bowls[0] / 2, bowls[0] + (1 - bowls[0]) / 2] : [0.5];
        for (const f of drains) { const drain = new THREE.Mesh(new THREE.CylinderGeometry(28 * S, 28 * S, 4 * S, 24), dark); drain.position.set((p.x + c.x + (horiz ? c.w * f : c.w / 2)) * S, (H - T + 2) * S, (p.y + c.y + (horiz ? c.h / 2 : c.h * f)) * S); group.add(drain); }
        // מוצרים נלווים בתוך ארון הכיור
        if (project.disposal) { const d = new THREE.Mesh(new THREE.CylinderGeometry(95 * S, 80 * S, 300 * S, 28), new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.45, metalness: 0.5 })); d.position.set((p.x + c.x + (horiz ? c.w * drains[0] : c.w / 2)) * S, (H - T - 190) * S, cz * S); group.add(d); const cap = new THREE.Mesh(new THREE.CylinderGeometry(60 * S, 95 * S, 40 * S, 28), steel); cap.position.set(d.position.x, (H - T - 22) * S, cz * S); group.add(cap); }
        if (project.water) {
          const wx = p.x + c.x + (horiz ? c.w * 0.82 : c.w / 2), wz = p.y + c.y + (horiz ? c.h / 2 - 60 : c.h * 0.82);
          const unit = new THREE.Mesh(new THREE.BoxGeometry(150 * S, 420 * S, 300 * S), new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.4 })); unit.position.set(wx * S, 330 * S, wz * S); group.add(unit);
          for (const k of [-1, 0, 1]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(32 * S, 32 * S, 280 * S, 18), new THREE.MeshStandardMaterial({ color: 0x2f7fd0, roughness: 0.35 })); f.position.set((wx - 130) * S, 300 * S, (wz + k * 80) * S); group.add(f); }
        }
      } else if (c.kind === 'cooktop') {
        box(c.w + 24, 6, c.h + 24, new THREE.MeshPhysicalMaterial({ color: 0x0c0c0e, roughness: 0.08, clearcoat: 1 }), cx, H + 3, cz);
        for (const [fx, fy, r] of [[0.28, 0.3, 0.8], [0.72, 0.3, 1], [0.28, 0.72, 1], [0.72, 0.72, 0.8]]) { const ring = new THREE.Mesh(new THREE.RingGeometry(Math.min(c.w, c.h) * 0.15 * r * S, Math.min(c.w, c.h) * 0.165 * r * S, 40), new THREE.MeshBasicMaterial({ color: 0x77777c })); ring.rotation.x = -Math.PI / 2; ring.position.set((p.x + c.x + c.w * fx) * S, (H + 6.4) * S, (p.y + c.y + c.h * fy) * S); group.add(ring); }
      } else if (c.kind === 'faucet') {
        const sink = cuts.find((q) => q.kind === 'sink'), tx = sink ? p.x + sink.x + sink.w / 2 - cx : 0, tz = sink ? p.y + sink.y + sink.h / 2 - cz : 150, len = Math.hypot(tx, tz) || 1, dx = tx / len, dz = tz / len, reach = Math.min(190, len * 0.75);
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 250, 0), new THREE.Vector3(dx * reach * 0.35, 330, dz * reach * 0.35), new THREE.Vector3(dx * reach * 0.85, 320, dz * reach * 0.85), new THREE.Vector3(dx * reach, 250, dz * reach)].map((q) => q.multiplyScalar(S)));
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 11 * S, 14), steel); tube.position.set(cx * S, H * S, cz * S); add(tube);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(23 * S, 25 * S, 40 * S, 24), steel); base.position.set(cx * S, (H + 20) * S, cz * S); add(base);
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
    const e = hostEdge(host, q.side), pls = plsOf(q.id), len = Math.min(q.w, e.len), splash = q.kind === 'splash', n = Math.max(1, Math.ceil(len / 200));
    const g = new THREE.BoxGeometry(len, q.h, T, n, 1, 1), pos = g.attributes.position, uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { const [u, v] = uvAt(q, pls, pos.getX(i) + len / 2, q.h / 2 - pos.getY(i)); uv.setXY(i, u, v); }
    g.scale(S, S, S);
    const m = new THREE.Mesh(g, stone), y0 = splash ? H : 0, hh = splash ? q.h : Math.min(q.h, H - T);
    m.position.set((e.x + (e.dx * len) / 2 - (e.nx * T) / 2) * S, (y0 + hh / 2) * S, (e.y + (e.dy * len) / 2 - (e.ny * T) / 2) * S); if (!splash) m.scale.y = hh / q.h; if (e.dy) m.rotation.y = -Math.PI / 2; add(m);
  }

  // --- רצפה ---
  const xs = flat.flatMap((p) => [p.x, p.x + p.w]), zs = flat.flatMap((p) => [p.y, p.y + p.h]);
  const bx0 = Math.min(0, ...xs), bx1 = Math.max(1000, ...xs), bz0 = Math.min(0, ...zs), bz1 = Math.max(600, ...zs);
  const center = new THREE.Vector3(((bx0 + bx1) / 2) * S, 0.75, ((bz0 + bz1) / 2) * S), radius = (Math.hypot(bx1 - bx0, bz1 - bz0) / 2) * S;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ map: floorTexture(project.floor), roughness: floorById(project.floor).type === 'plank' ? 0.55 : 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(center.x, 0, center.z); floor.receiveShadow = true; group.add(floor);
  return { group, center, radius, lamps };
}

export function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mats = Array.isArray(m.material) ? m.material : [m.material]; mats.forEach((mat) => { const mm = mat as THREE.MeshStandardMaterial; if (mm.map && (mm.map as THREE.CanvasTexture).isCanvasTexture) mm.map.dispose(); mat.dispose(); }); } });
}
