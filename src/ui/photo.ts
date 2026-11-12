// צילום פוטו־ריאליסטי: אותה סצנה בדיוק (אותם גידים, מידות וחיבורים), אבל האור מחושב פיזיקלית
// (path tracing) — השתקפויות אמיתיות, צללים רכים ואור שקופץ מהקירות. רץ על כרטיס המסך של המחשב.
import * as THREE from 'three';
import { Project } from '../core/model';
import { NestResult } from '../core/nesting';
import { Finish } from '../data/lucente';
import { buildKitchen, disposeGroup } from './scene';
import { loadTex } from './View3D';
import { ViewName, aimView, hideWalls, viewDist } from './render';

export interface PhotoOpts {
  project: Project; nest: NestResult | null; stoneUrl: string; finish: Finish;
  /** זווית מוכנה, או מצלמה חופשית (מיקום + נקודת מבט) מהתצוגה החיה. */
  view?: ViewName; from?: { pos: THREE.Vector3; target: THREE.Vector3; fov: number };
  W: number; H: number; samples: number;
  onProgress?: (done: number, preview?: string) => void; signal?: AbortSignal;
}

export async function photoRender(o: PhotoOpts): Promise<string> {
  const { WebGLPathTracer } = await import('three-gpu-pathtracer');
  const canvas = document.createElement('canvas'); canvas.width = o.W; canvas.height = o.H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(o.W, o.H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = o.project.light === 'evening' ? 1.1 : 0.95; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), evening = o.project.light === 'evening';
  // סביבה: "חדר" מחושב — תקרה עם פנלי אור, קירות חמימים, רצפה כהה וחלון גדול אחד. ממנו מגיעות ההשתקפויות על האבן המבריקה.
  const { ProceduralEquirectTexture } = await import('three-gpu-pathtracer');
  const env = new ProceduralEquirectTexture(512, 256), d = new THREE.Vector3();
  env.generationCallback = (polar: THREE.Spherical, _uv: THREE.Vector2, _c: THREE.Vector2, color: THREE.Color) => {
    d.setFromSpherical(polar); const y = d.y, az = Math.atan2(d.x, d.z);
    if (y > 0.82) color.setRGB(evening ? 0.5 : 2.6, evening ? 0.45 : 2.5, evening ? 0.4 : 2.35); // פנל תקרה
    else if (y > 0.05 && y < 0.6 && az > 0.5 && az < 1.6) color.setRGB(evening ? 0.08 : 4.2, evening ? 0.09 : 4.3, evening ? 0.12 : 4.6); // חלון
    else if (y >= 0) color.setRGB(0.78, 0.74, 0.68).multiplyScalar(evening ? 0.15 : 0.9); // קירות
    else color.setRGB(0.42, 0.36, 0.3).multiplyScalar(evening ? 0.12 : 0.7); // רצפה
  };
  env.update();
  scene.environment = env; scene.environmentIntensity = evening ? 0.6 : 0.8; scene.background = new THREE.Color(evening ? 0x26221e : 0xefebe4);
  const tex = await loadTex(o.stoneUrl).catch(() => null);
  const b = buildKitchen(o.project, o.nest, tex, o.finish); scene.add(b.group);
  const sun = new THREE.DirectionalLight(0xfff1dc, evening ? 0.1 : 2.4); sun.position.set(b.center.x - 3.2, 6.5, b.center.z + 4.2); sun.target.position.copy(b.center); scene.add(sun, sun.target);
  const KELVIN: Record<number, number> = { 3000: 0xffb46b, 4000: 0xffdcb4, 6000: 0xdfeaff };
  for (const pos of b.lamps.slice(0, 6)) { const l = new THREE.PointLight(KELVIN[o.project.kelvin || 4000], evening ? 3 : 0.6, 4.5, 1.6); l.position.copy(pos); scene.add(l); }
  // תאורת תקרה רכה (Softbox) מעל המטבח
  const soft = new THREE.RectAreaLight(0xfff6ea, evening ? 3 : 1.4, 3.2, 2.2); soft.position.set(b.center.x, 2.7, b.center.z + 0.4); soft.lookAt(b.center.x, 0, b.center.z + 0.4); scene.add(soft);

  const cam = new THREE.PerspectiveCamera(o.from?.fov || 34, o.W / o.H, 0.05, 80);
  if (o.from) { cam.position.copy(o.from.pos); cam.lookAt(o.from.target); cam.updateProjectionMatrix(); }
  else aimView(o.view || 'hero', b, cam, viewDist(b, o.W / o.H));
  hideWalls(b, cam); scene.updateMatrixWorld(true);

  const pt = new WebGLPathTracer(renderer);
  pt.bounces = 6; pt.transmissiveBounces = 4; pt.filterGlossyFactor = 0.4; pt.tiles.set(3, 3); pt.renderDelay = 0; pt.fadeDuration = 0; pt.minSamples = 1; pt.rasterizeScene = false; pt.dynamicLowRes = false;
  pt.setScene(scene, cam);
  let last = 0;
  try {
    while (pt.samples < o.samples) {
      if (o.signal?.aborted) throw new DOMException('בוטל', 'AbortError');
      pt.renderSample();
      if (performance.now() - last > 700) { last = performance.now(); o.onProgress?.(Math.min(1, pt.samples / o.samples), canvas.toDataURL('image/jpeg', 0.7)); await new Promise((r) => setTimeout(r, 0)); }
    }
    return canvas.toDataURL('image/jpeg', 0.94);
  } finally {
    pt.dispose(); env.dispose(); disposeGroup(b.group); renderer.dispose(); renderer.forceContextLoss();
  }
}
