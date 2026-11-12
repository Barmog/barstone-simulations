// רינדור הדמיות למסמך: סצנה מחוץ למסך, כמה זוויות מצלמה, תמונות JPEG ברזולוציה גבוהה.
import { Finish } from '../data/lucente';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Project } from '../core/model';
import { NestResult } from '../core/nesting';
import { Built, buildKitchen, disposeGroup } from './scene';
import { loadTex } from './View3D';

export type ViewName = 'hero' | 'left' | 'front' | 'right' | 'top' | 'sink';
const KELVIN: Record<number, number> = { 3000: 0xffb46b, 4000: 0xffdcb4, 6000: 0xdfeaff };

export async function renderViews(project: Project, nest: NestResult | null, stoneUrl: string, views: ViewName[], W = 2200, H = 1400, finish: Finish = 'polished'): Promise<Partial<Record<ViewName, string>>> {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); } catch { return {}; }
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xefebe4);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cbb6, 0.5));
  const tex = await loadTex(stoneUrl).catch(() => null);
  const b = buildKitchen(project, nest, tex, finish); scene.add(b.group);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.1); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
  sun.position.set(b.center.x - 3.2, 6.5, b.center.z + 4.2); sun.target.position.copy(b.center); scene.add(sun, sun.target);
  const r = b.radius + 1.6, sc = sun.shadow.camera; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 0.5; sc.far = 22; sc.updateProjectionMatrix();
  const color = KELVIN[project.kelvin || 4000];
  for (const pos of b.lamps.slice(0, 8)) { const l = new THREE.PointLight(color, project.light === 'evening' ? 2.6 : 0.5, 4.5, 1.6); l.position.copy(pos); scene.add(l); }
  const cam = new THREE.PerspectiveCamera(34, W / H, 0.05, 80), d = viewDist(b, W / H);
  const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H); composer.addPass(new RenderPass(scene, cam));
  const gtao = new GTAOPass(scene, cam, W, H); gtao.blendIntensity = 0.9; gtao.updateGtaoMaterial({ radius: 0.28, distanceExponent: 1.4, thickness: 1, scale: 1 }); composer.addPass(gtao); composer.addPass(new OutputPass());
  const out: Partial<Record<ViewName, string>> = {};
  for (const v of views) {
    if (!aimView(v, b, cam, d)) continue;
    hideWalls(b, cam);
    composer.render(); out[v] = canvas.toDataURL('image/jpeg', 0.9);
  }
  composer.dispose(); gtao.dispose(); disposeGroup(b.group); pm.dispose(); renderer.dispose(); renderer.forceContextLoss();
  return out;
}

/** מיקום מצלמה לכל זווית. מחזיר false אם אין מה לצלם (תקריב בלי כיור). */
export function aimView(v: ViewName, b: Built, cam: THREE.PerspectiveCamera, d: number): boolean {
  const c = b.center;
    const t = new THREE.Vector3(c.x, 0.85, c.z);
    if (v === 'hero') cam.position.set(c.x - d * 0.42, 0.9 + d * 0.48, c.z + d * 0.78);
    else if (v === 'left') cam.position.set(c.x - d * 0.85, 1.2 + d * 0.32, c.z + d * 0.55);
    else if (v === 'right') cam.position.set(c.x + d * 0.55, 1.1 + d * 0.36, c.z + d * 0.8);
    else if (v === 'front') cam.position.set(c.x, 1.3, c.z + d * 1.02);
    else if (v === 'top') { cam.position.set(c.x, 0.9 + d * 1.2, c.z + 0.02); t.y = 0.9; }
    else { const s = b.sinks[0]; if (!s) return false; const k = s.z > c.z ? -1 : 1; t.set(s.x, s.y - 0.06, s.z); cam.position.set(s.x - 0.35, s.y + 0.85, s.z + 0.95 * k); }
    cam.lookAt(t); cam.updateProjectionMatrix(); return true;
}

/** קיר שעומד בין המצלמה למטבח מוסתר בצילום (כמו בהדמיה מקצועית). */
export function hideWalls(b: Built, cam: THREE.Camera) {
  b.group.traverse((o) => { const n = o.userData.wallN as [number, number] | undefined; if (!n) return; const wp = o.getWorldPosition(new THREE.Vector3()); o.visible = (cam.position.x - wp.x) * n[0] + (cam.position.z - wp.z) * n[1] <= 0; });
}

/** מרחק מצלמה סטנדרטי לפי גודל המטבח ויחס התמונה. */
export const viewDist = (b: Built, aspect: number) => Math.max(2.9, b.radius * 2.45) / Math.min(1, aspect / 1.55);
