// תצוגת התלת־ממד החיה. מתעדכנת מכל שינוי במודל, ומרנדרת רק כשמשהו השתנה.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { useStore } from '../store';
import { Built, buildKitchen, disposeGroup } from './scene';
import { Icon } from './icons';
import { useStone } from './util';

type Cam = 'persp' | 'top' | 'front';
const texCache = new Map<string, Promise<THREE.Texture>>();
const loadTex = (url: string) => { if (!texCache.has(url)) texCache.set(url, new THREE.TextureLoader().setCrossOrigin('anonymous').loadAsync(url).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; })); return texCache.get(url)!; };

export function View3D({ still, onMax, max }: { still?: boolean; onMax?: () => void; max?: boolean }) {
  const project = useStore((s) => s.project)!, nest = useStore((s) => s.nest), stone = useStone();
  const host = useRef<HTMLDivElement>(null), api = useRef<{ rebuild: (b: Built, light: string, kelvin: number) => void; cam: (c: Cam) => void; shot: () => string; built?: Built } | null>(null);
  const [cam, setCam] = useState<Cam>('persp'), [err, setErr] = useState('');

  useEffect(() => {
    const el = host.current!; let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); } catch { setErr('הדפדפן לא תומך בתלת־ממד (WebGL).'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92; renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xece6dc);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55;
    const hemi = new THREE.HemisphereLight(0xffffff, 0xd8cbb6, 0.5); scene.add(hemi);
    let points: THREE.PointLight[] = [];
    const KELVIN: Record<number, number> = { 3000: 0xffb46b, 4000: 0xffdcb4, 6000: 0xdfeaff };
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.1); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5; scene.add(sun, sun.target);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 80);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.09; controls.maxPolarAngle = Math.PI / 2 - 0.03; controls.minDistance = 0.8; controls.maxDistance = 18;
    let dirty = true, raf = 0, group: THREE.Group | null = null, first = true;
    const size = () => { const w = el.clientWidth || 600, h = el.clientHeight || 400; renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true; };
    const ro = new ResizeObserver(size); ro.observe(el); size();
    controls.addEventListener('change', () => (dirty = true));
    const place = (c: Cam, b: Built) => {
      const d = Math.max(2.9, b.radius * 2.55) / Math.min(1, camera.aspect / 1.55);
      controls.target.copy(b.center).setY(c === 'top' ? 0.9 : 0.85);
      if (c === 'persp') camera.position.set(b.center.x - d * 0.42, 0.9 + d * 0.5, b.center.z + d * 0.78);
      if (c === 'top') camera.position.set(b.center.x, 0.9 + d * 1.15, b.center.z + 0.02);
      if (c === 'front') camera.position.set(b.center.x, 1.25, b.center.z + d * 1.02);
      controls.update(); dirty = true;
    };
    const loop = () => { raf = requestAnimationFrame(loop); if (!still) controls.update(); if (dirty) { dirty = false; renderer.render(scene, camera); } };
    api.current = {
      rebuild(b, light, kelvin) {
        if (group) { scene.remove(group); disposeGroup(group); }
        group = b.group; scene.add(group); api.current!.built = b;
        // תאורת יום / ערב וגוון הנורות (3000K חם · 4000K ניטרלי · 6000K קר)
        const evening = light === 'evening', color = KELVIN[kelvin] || KELVIN[4000];
        points.forEach((l) => scene.remove(l)); points = [];
        for (const pos of b.lamps.slice(0, 8)) { const l = new THREE.PointLight(color, evening ? 2.6 : 0.5, 4.5, 1.6); l.position.copy(pos); scene.add(l); points.push(l); }
        if (evening) { const c = new THREE.PointLight(color, 5, 9, 1.3); c.position.set(b.center.x, 2.35, b.center.z + 0.4); scene.add(c); points.push(c); }
        sun.intensity = evening ? 0.12 : 2.1; hemi.intensity = evening ? 0.1 : 0.5; scene.environmentIntensity = evening ? 0.16 : 0.55; renderer.toneMappingExposure = evening ? 1.15 : 0.92;
        (scene.background as THREE.Color).set(evening ? 0x24211e : 0xece6dc);
        sun.position.set(b.center.x - 3.2, 6.5, b.center.z + 4.2); sun.target.position.copy(b.center);
        const r = b.radius + 1.6, sc = sun.shadow.camera; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 0.5; sc.far = 22; sc.updateProjectionMatrix();
        if (first) { place('persp', b); first = false; } dirty = true;
      },
      cam(c) { if (api.current?.built) place(c, api.current.built); },
      shot() {
        const w = el.clientWidth, h = el.clientHeight, W = 3840, Hh = Math.round((W * h) / w), pr = renderer.getPixelRatio();
        renderer.setPixelRatio(1); renderer.setSize(W, Hh, false); renderer.render(scene, camera);
        const url = renderer.domElement.toDataURL('image/jpeg', 0.94);
        renderer.setPixelRatio(pr); size(); renderer.render(scene, camera); return url;
      },
    };
    loop();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); if (group) disposeGroup(group); pm.dispose(); renderer.dispose(); renderer.domElement.remove(); api.current = null; };
  }, []);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => { loadTex(stone.url).catch(() => null).then((tex) => { if (live && api.current) api.current.rebuild(buildKitchen(project, nest, tex), project.light || 'day', project.kelvin || 4000); }); }, 60);
    return () => { live = false; clearTimeout(t); };
  }, [project, nest, stone.url]);

  const save = () => { const url = api.current?.shot(); if (!url) return; const a = document.createElement('a'); a.href = url; a.download = `${project.name || 'barstone'}-4K.jpg`; a.click(); };
  return (
    <div className="view" ref={host} style={{ background: '#ece6dc' }}>
      {!still && <>
        <span className="tag badge">הדמיה חיה · תלת־ממד</span>
        <div className="tools">
          <div className="pill">{(['persp', 'top', 'front'] as Cam[]).map((c) => <button key={c} className={cam === c ? 'on' : ''} onClick={() => { setCam(c); api.current?.cam(c); }}>{c === 'persp' ? 'פרספקטיבה' : c === 'top' ? 'מלמעלה' : 'חזית'}</button>)}</div>
          <div className="pill"><button title="שמירת תמונה ברזולוציית 4K" onClick={save}><Icon.download />4K</button>{onMax && <button title={max ? 'חזרה לתצוגה מפוצלת' : 'מסך מלא'} className={max ? 'on' : ''} onClick={onMax}><Icon.max /></button>}</div>
        </div>
      </>}
      {err && <div className="empty" style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center' }}>{err}</div>}
    </div>
  );
}
