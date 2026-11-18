// סימון הלוח בצילום: ארבע ידיות שגוררים לפינות האבן, ותצוגה חיה של הלוח אחרי היישור.
import { useEffect, useRef } from 'react';
import { Quad, landscape, warp } from './slabWarp';

export function SlabCropper({ bmp, url, quad, aspect, onChange }: { bmp: ImageBitmap; url: string; quad: Quad; aspect: number; onChange: (q: Quad) => void }) {
  const svg = useRef<SVGSVGElement>(null), prev = useRef<HTMLCanvasElement>(null), drag = useRef(-1);
  const W = bmp.width, H = bmp.height, r = Math.max(W, H) / 28;
  // תצוגה מקדימה קטנה של הלוח המיושר (מתעדכנת אחרי שמשחררים ידית)
  useEffect(() => {
    const t = setTimeout(() => { const c = prev.current; if (!c) return; const pw = 420, ph = Math.round(pw / aspect), out = warp(bmp, landscape(quad), pw, ph); c.width = pw; c.height = ph; c.getContext('2d')!.drawImage(out, 0, 0); }, 120);
    return () => clearTimeout(t);
  }, [bmp, quad, aspect]);
  const at = (e: React.PointerEvent): [number, number] => { const m = svg.current!.getScreenCTM()!.inverse(), p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m); return [Math.max(0, Math.min(W, p.x)), Math.max(0, Math.min(H, p.y))]; };
  return (
    <div className="cropper">
      <div className="crop-img" style={{ width: `min(100%, ${(46 * W) / H}vh)`, margin: "0 auto" }}>
        <img src={url} alt="" />
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
          onPointerMove={(e) => { if (drag.current < 0) return; const q = quad.map((p) => [...p]) as Quad; q[drag.current] = at(e); onChange(q); }}
          onPointerUp={() => { drag.current = -1; }} onPointerLeave={() => { drag.current = -1; }}>
          <path d={`M0,0H${W}V${H}H0Z M${quad.map((p) => p.join(',')).join('L')}Z`} fill="rgba(20,18,15,.55)" fillRule="evenodd" />
          <polygon points={quad.map((p) => p.join(',')).join(' ')} fill="none" stroke="#fff" strokeWidth={r / 5} />
          {quad.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={r} fill="rgba(255,255,255,.35)" stroke="#fff" strokeWidth={r / 4} style={{ cursor: 'grab', touchAction: 'none' }}
            onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); drag.current = i; }} onPointerMove={(e) => { if (drag.current !== i) return; const q = quad.map((x) => [...x]) as Quad; q[i] = at(e); onChange(q); }} onPointerUp={() => { drag.current = -1; }} />)}
        </svg>
      </div>
      <span className="mute" style={{ fontSize: 12.5 }}>גוררים את ארבע הנקודות לפינות הלוח. כך ייראה הלוח בהדמיה, מיושר ובלי רקע:</span>
      <canvas ref={prev} className="crop-prev" />
    </div>
  );
}
