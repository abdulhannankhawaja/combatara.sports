import * as THREE from 'three';
import {
  createCanvasWeaveBumpTexture,
  createCarbonTwillTexture,
  createContactShadowTexture,
  createCrestPlateTexture,
  createGlobeEarthTexture,
  createLeatherGrainBumpTexture,
} from './proceduralTextures.ts';
import { DiscoveredLead, ProductFinishOption, SceneSubjectId } from '../types/exportHub.ts';
import { SIALKOT_COORDS, TARGET_HUB_MARKETS } from '../data/sialkotCatalog.ts';

export interface ProceduralBuildResult {
  group: THREE.Group;
  dispose: () => void;
  explodableParts: { mesh: THREE.Object3D; basePos: THREE.Vector3; explodeVec: THREE.Vector3 }[];
  inspectables: THREE.Object3D[];
}

function registerExplode(
  list: ProceduralBuildResult['explodableParts'],
  obj: THREE.Object3D,
  explodeVec: THREE.Vector3
) {
  list.push({
    mesh: obj,
    basePos: obj.position.clone(),
    explodeVec,
  });
}

function tagInspectable(obj: THREE.Object3D, partKey: string, list: THREE.Object3D[]) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.userData.partKey = partKey;
      child.layers.enable(1);
    }
  });
  obj.userData.partKey = partKey;
  list.push(obj);
}

export function buildShowroomPlinth(anisotropy: number): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];

  const shadowTex = createContactShadowTexture();
  disposables.push(shadowTex);

  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.34;
  group.add(shadowPlane);
  disposables.push(shadowPlane.geometry, shadowMat);

  // Dark basalt pedestal tier
  const plinthGeo = new THREE.CylinderGeometry(2.05, 2.25, 0.28, 64);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x131924,
    roughness: 0.72,
    metalness: 0.15,
  });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.y = -0.18;
  plinth.receiveShadow = true;
  group.add(plinth);
  disposables.push(plinthGeo, plinthMat);

  // Brushed brass chamfer inlay ring
  const ringGeo = new THREE.TorusGeometry(2.04, 0.025, 16, 80);
  const ringMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4af37,
    roughness: 0.2,
    metalness: 0.94,
    anisotropy: 0.7,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.04;
  group.add(ring);
  disposables.push(ringGeo, ringMat);

  // Inner matte inspection deck
  const deckGeo = new THREE.CylinderGeometry(1.96, 1.96, 0.04, 64);
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x0b0f17,
    roughness: 0.88,
    metalness: 0.08,
  });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.y = -0.02;
  deck.receiveShadow = true;
  group.add(deck);
  disposables.push(deckGeo, deckMat);

  void anisotropy;

  return {
    group,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

function buildKarateSuitModel(finish: ProductFinishOption, anisotropy: number): ProceduralBuildResult {
  const group = new THREE.Group();
  const explodableParts: ProceduralBuildResult['explodableParts'] = [];
  const inspectables: THREE.Object3D[] = [];
  const disposables: { dispose: () => void }[] = [];

  const weaveBump = createCanvasWeaveBumpTexture(anisotropy);
  const crestTex = createCrestPlateTexture(anisotropy, finish.accentHex === '#18181b' ? '#d4af37' : finish.accentHex);
  disposables.push(weaveBump, crestTex);

  const fabricMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(finish.primaryHex),
    roughness: finish.roughness,
    metalness: finish.metalness,
    bumpMap: weaveBump,
    bumpScale: 0.018,
    sheen: 0.45,
    sheenRoughness: 0.8,
  });
  const beltMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(finish.accentHex === '#d4af37' ? '#12151c' : finish.accentHex),
    roughness: 0.65,
    metalness: 0.06,
    bumpMap: weaveBump,
    bumpScale: 0.012,
  });
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4af37,
    roughness: 0.22,
    metalness: 0.92,
  });
  const crestMat = new THREE.MeshStandardMaterial({
    map: crestTex,
    roughness: 0.55,
    metalness: 0.15,
  });
  disposables.push(fabricMat, beltMat, goldMat, crestMat);

  // 1. Folded Gi Trousers Base
  const trouserShape = new THREE.Shape();
  trouserShape.moveTo(-0.85, -0.62);
  trouserShape.lineTo(0.85, -0.62);
  trouserShape.lineTo(0.85, 0.62);
  trouserShape.lineTo(-0.85, 0.62);
  trouserShape.closePath();

  const trouserGeo = new THREE.ExtrudeGeometry(trouserShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 3,
  });
  trouserGeo.rotateX(Math.PI / 2);
  const trousers = new THREE.Mesh(trouserGeo, fabricMat);
  trousers.position.y = 0.22;
  trousers.castShadow = true;
  trousers.receiveShadow = true;
  group.add(trousers);
  disposables.push(trouserGeo);
  registerExplode(explodableParts, trousers, new THREE.Vector3(0, -0.25, 0));

  // 2. Heavyweight Gi Jacket Torso (Beveled Extrude)
  const jacketShape = new THREE.Shape();
  jacketShape.moveTo(-0.8, -0.58);
  jacketShape.lineTo(0.8, -0.58);
  jacketShape.lineTo(0.82, 0.58);
  jacketShape.lineTo(-0.82, 0.58);
  jacketShape.closePath();

  const jacketGeo = new THREE.ExtrudeGeometry(jacketShape, {
    depth: 0.26,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 4,
  });
  jacketGeo.rotateX(Math.PI / 2);
  const jacket = new THREE.Mesh(jacketGeo, fabricMat);
  jacket.position.y = 0.56;
  jacket.castShadow = true;
  jacket.receiveShadow = true;
  group.add(jacket);
  disposables.push(jacketGeo);
  registerExplode(explodableParts, jacket, new THREE.Vector3(0, 0.15, 0));

  // 3. Crossed V-Lapel Collar Group
  const lapelGroup = new THREE.Group();
  const lapelGeo = new THREE.BoxGeometry(0.18, 0.07, 1.05);
  const leftLapel = new THREE.Mesh(lapelGeo, fabricMat);
  leftLapel.position.set(-0.22, 0.63, 0.02);
  leftLapel.rotation.y = 0.36;
  leftLapel.castShadow = true;

  const rightLapel = new THREE.Mesh(lapelGeo, fabricMat);
  rightLapel.position.set(0.22, 0.65, 0.02);
  rightLapel.rotation.y = -0.36;
  rightLapel.castShadow = true;

  lapelGroup.add(leftLapel, rightLapel);
  group.add(lapelGroup);
  disposables.push(lapelGeo);
  registerExplode(explodableParts, lapelGroup, new THREE.Vector3(0, 0.52, 0));
  tagInspectable(lapelGroup, 'gi-lapel', inspectables);

  // 4. Twin Folded Sleeve Cuffs
  const sleeveGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.72, 20);
  sleeveGeo.rotateZ(Math.PI / 2);
  const leftSleeve = new THREE.Mesh(sleeveGeo, fabricMat);
  leftSleeve.position.set(-0.98, 0.43, 0.1);
  leftSleeve.rotation.y = 0.18;
  leftSleeve.castShadow = true;

  const rightSleeve = new THREE.Mesh(sleeveGeo, fabricMat);
  rightSleeve.position.set(0.98, 0.43, 0.1);
  rightSleeve.rotation.y = -0.18;
  rightSleeve.castShadow = true;

  group.add(leftSleeve, rightSleeve);
  disposables.push(sleeveGeo);
  registerExplode(explodableParts, leftSleeve, new THREE.Vector3(-0.55, 0.18, 0));
  registerExplode(explodableParts, rightSleeve, new THREE.Vector3(0.55, 0.18, 0));

  // 5. Obi Black Belt Wrap + Knot + Hanging Tails + Gold Dan Stripes
  const beltGroup = new THREE.Group();
  const wrapGeo = new THREE.BoxGeometry(1.74, 0.11, 0.16);
  const wrap = new THREE.Mesh(wrapGeo, beltMat);
  wrap.position.set(0, 0.56, 0.14);
  wrap.castShadow = true;

  const knotGeo = new THREE.BoxGeometry(0.24, 0.16, 0.24);
  const knot = new THREE.Mesh(knotGeo, beltMat);
  knot.position.set(0, 0.62, 0.22);
  knot.rotation.y = 0.2;
  knot.castShadow = true;

  const tailGeo = new THREE.BoxGeometry(0.12, 0.04, 0.62);
  const tailL = new THREE.Mesh(tailGeo, beltMat);
  tailL.position.set(-0.18, 0.59, 0.48);
  tailL.rotation.set(0.22, 0.28, 0);
  tailL.castShadow = true;

  const tailR = new THREE.Mesh(tailGeo, beltMat);
  tailR.position.set(0.18, 0.58, 0.48);
  tailR.rotation.set(0.22, -0.28, 0);
  tailR.castShadow = true;

  const stripeGeo = new THREE.BoxGeometry(0.125, 0.045, 0.035);
  const stripe1 = new THREE.Mesh(stripeGeo, goldMat);
  stripe1.position.set(0.23, 0.51, 0.66);
  stripe1.rotation.set(0.22, -0.28, 0);

  const stripe2 = new THREE.Mesh(stripeGeo, goldMat);
  stripe2.position.set(0.21, 0.525, 0.6);
  stripe2.rotation.set(0.22, -0.28, 0);

  beltGroup.add(wrap, knot, tailL, tailR, stripe1, stripe2);
  group.add(beltGroup);
  disposables.push(wrapGeo, knotGeo, tailGeo, stripeGeo);
  registerExplode(explodableParts, beltGroup, new THREE.Vector3(0, 0.72, 0.35));
  tagInspectable(beltGroup, 'obi-belt', inspectables);

  // 6. Woven Sialkot Crest Patch
  const crestGeo = new THREE.BoxGeometry(0.28, 0.025, 0.28);
  const crest = new THREE.Mesh(crestGeo, crestMat);
  crest.position.set(0.45, 0.64, -0.22);
  group.add(crest);
  disposables.push(crestGeo);
  registerExplode(explodableParts, crest, new THREE.Vector3(0.25, 0.85, -0.15));
  tagInspectable(crest, 'crest-patch', inspectables);

  return {
    group,
    explodableParts,
    inspectables,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

function buildFootballModel(finish: ProductFinishOption, anisotropy: number): ProceduralBuildResult {
  const group = new THREE.Group();
  const explodableParts: ProceduralBuildResult['explodableParts'] = [];
  const inspectables: THREE.Object3D[] = [];
  const disposables: { dispose: () => void }[] = [];

  const leatherBump = createLeatherGrainBumpTexture(anisotropy);
  disposables.push(leatherBump);

  const primaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(finish.primaryHex),
    roughness: finish.roughness,
    metalness: finish.metalness,
    bumpMap: leatherBump,
    bumpScale: 0.015,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(finish.accentHex),
    roughness: Math.min(1, finish.roughness + 0.15),
    metalness: finish.metalness + 0.1,
    bumpMap: leatherBump,
    bumpScale: 0.018,
  });
  const bladderMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.75,
    metalness: 0.05,
  });
  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4af37,
    roughness: 0.18,
    metalness: 0.94,
    anisotropy: 0.8,
  });
  disposables.push(primaryMat, accentMat, bladderMat, brassMat);

  // 1. Brushed Brass 3-Prong Display Stand (Bottom-center at y=0)
  const standGroup = new THREE.Group();
  const baseRingGeo = new THREE.TorusGeometry(0.58, 0.035, 16, 48);
  const baseRing = new THREE.Mesh(baseRingGeo, brassMat);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.04;
  standGroup.add(baseRing);

  const prongGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.34, 12);
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const prong = new THREE.Mesh(prongGeo, brassMat);
    prong.position.set(Math.cos(angle) * 0.52, 0.18, Math.sin(angle) * 0.52);
    prong.rotation.z = Math.cos(angle) * 0.25;
    prong.rotation.x = -Math.sin(angle) * 0.25;
    prong.castShadow = true;
    standGroup.add(prong);
  }
  group.add(standGroup);
  disposables.push(baseRingGeo, prongGeo);
  registerExplode(explodableParts, standGroup, new THREE.Vector3(0, -0.35, 0));
  tagInspectable(standGroup, 'stand', inspectables);

  // 2. Inner Latex Bladder Core (Visible when exploded!)
  const bladderGeo = new THREE.SphereGeometry(0.76, 32, 24);
  const bladder = new THREE.Mesh(bladderGeo, bladderMat);
  bladder.position.y = 1.02;
  group.add(bladder);
  disposables.push(bladderGeo);

  // 3. Geodesic 32-panel outer shell built from icosahedron vertices & face plates
  const panelsGroup = new THREE.Group();
  panelsGroup.position.y = 1.02;
  const radius = 0.84;
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const posAttr = ico.attributes.position;

  // Create distinct beveled panels at vertices and face centroids for rich 3D depth
  const pentGeo = new THREE.CylinderGeometry(0.24, 0.21, 0.06, 5);
  const hexGeo = new THREE.CylinderGeometry(0.25, 0.22, 0.06, 6);
  const seamSphereGeo = new THREE.SphereGeometry(0.81, 32, 24);
  const seamCore = new THREE.Mesh(seamSphereGeo, new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }));
  panelsGroup.add(seamCore);
  disposables.push(ico, pentGeo, hexGeo, seamSphereGeo, seamCore.material as THREE.Material);

  const seen = new Set<string>();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < posAttr.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(posAttr, i).normalize();
    const key = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const isPent = seen.size <= 12;
    const panel = new THREE.Mesh(isPent ? pentGeo : hexGeo, isPent ? accentMat : primaryMat);
    panel.position.copy(v).multiplyScalar(radius);
    panel.quaternion.setFromUnitVectors(up, v);
    panel.castShadow = true;
    panel.receiveShadow = true;
    panelsGroup.add(panel);
    registerExplode(explodableParts, panel, v.clone().multiplyScalar(0.55));
  }

  group.add(panelsGroup);
  tagInspectable(panelsGroup, 'panels', inspectables);

  // 4. Precision Air-Lock Inflation Valve Grommet
  const valveGroup = new THREE.Group();
  const valveRingGeo = new THREE.TorusGeometry(0.06, 0.015, 12, 24);
  const valveRing = new THREE.Mesh(valveRingGeo, brassMat);
  valveRing.position.set(0, 1.02 + 0.87, 0);
  valveRing.rotation.x = Math.PI / 2;
  valveGroup.add(valveRing);
  group.add(valveGroup);
  disposables.push(valveRingGeo);
  registerExplode(explodableParts, valveGroup, new THREE.Vector3(0, 0.72, 0));
  tagInspectable(valveGroup, 'valve', inspectables);

  return {
    group,
    explodableParts,
    inspectables,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

function buildHockeyStickModel(finish: ProductFinishOption, anisotropy: number): ProceduralBuildResult {
  const group = new THREE.Group();
  const explodableParts: ProceduralBuildResult['explodableParts'] = [];
  const inspectables: THREE.Object3D[] = [];
  const disposables: { dispose: () => void }[] = [];

  const carbonTex = createCarbonTwillTexture(anisotropy, finish.primaryHex, finish.accentHex);
  disposables.push(carbonTex);

  const shaftMat = new THREE.MeshPhysicalMaterial({
    map: carbonTex,
    roughness: finish.roughness,
    metalness: finish.metalness,
    clearcoat: 0.75,
    clearcoatRoughness: 0.15,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x111318,
    roughness: 0.88,
    metalness: 0.02,
  });
  const brassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(finish.accentHex),
    roughness: 0.22,
    metalness: 0.88,
  });
  const ballMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.35,
    metalness: 0.05,
  });
  disposables.push(shaftMat, gripMat, brassMat, ballMat);

  // 1. Curved Low-Bow Shaft & J-Hook Toe (TubeGeometry along smooth CatmullRomCurve3)
  const stickCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.42, 0.35, 0),
    new THREE.Vector3(0.55, 0.14, 0),
    new THREE.Vector3(0.32, 0.06, 0),
    new THREE.Vector3(0.02, 0.18, 0),
    new THREE.Vector3(-0.35, 0.85, 0),
    new THREE.Vector3(-0.72, 1.65, 0),
    new THREE.Vector3(-0.98, 2.25, 0),
  ]);
  const shaftGeo = new THREE.TubeGeometry(stickCurve, 64, 0.055, 16, false);
  const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
  shaftMesh.castShadow = true;
  shaftMesh.receiveShadow = true;
  group.add(shaftMesh);
  disposables.push(shaftGeo);
  tagInspectable(shaftMesh, 'blade-hook', inspectables);

  // 2. Aramid Toe Reinforcement Shield
  const toeGeo = new THREE.SphereGeometry(0.062, 16, 16);
  const toeCap = new THREE.Mesh(toeGeo, brassMat);
  toeCap.position.set(0.42, 0.35, 0);
  group.add(toeCap);
  disposables.push(toeGeo);
  registerExplode(explodableParts, toeCap, new THREE.Vector3(0.25, 0.2, 0));

  // 3. Spiral Ribbed Anti-Slip Grip Collar + End Cap
  const gripGroup = new THREE.Group();
  const gripCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.62, 1.43, 0),
    new THREE.Vector3(-0.98, 2.25, 0),
  ]);
  const gripGeo = new THREE.TubeGeometry(gripCurve, 24, 0.068, 16, false);
  const gripMesh = new THREE.Mesh(gripGeo, gripMat);
  gripMesh.castShadow = true;

  const endCapGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.06, 20);
  const endCap = new THREE.Mesh(endCapGeo, brassMat);
  endCap.position.set(-0.99, 2.27, 0);
  endCap.rotation.z = 0.42;

  const collarGeo = new THREE.TorusGeometry(0.07, 0.015, 12, 24);
  const collar = new THREE.Mesh(collarGeo, brassMat);
  collar.position.set(-0.62, 1.43, 0);
  collar.rotation.set(Math.PI / 2, 0.42, 0);

  gripGroup.add(gripMesh, endCap, collar);
  group.add(gripGroup);
  disposables.push(gripGeo, endCapGeo, collarGeo);
  registerExplode(explodableParts, gripGroup, new THREE.Vector3(-0.28, 0.42, 0));
  tagInspectable(gripGroup, 'grip-wrap', inspectables);

  // 4. Display Stand Saddle + Dimpled Turf Hockey Ball
  const cradleGeo = new THREE.BoxGeometry(0.9, 0.08, 0.45);
  const cradle = new THREE.Mesh(cradleGeo, gripMat);
  cradle.position.set(0.15, 0.04, 0);
  cradle.receiveShadow = true;
  group.add(cradle);
  disposables.push(cradleGeo);
  registerExplode(explodableParts, cradle, new THREE.Vector3(0, -0.25, 0));

  const turfBallGroup = new THREE.Group();
  const ballGeo = new THREE.SphereGeometry(0.18, 28, 24);
  const turfBall = new THREE.Mesh(ballGeo, ballMat);
  turfBall.position.set(0.28, 0.24, 0.36);
  turfBall.castShadow = true;

  const teeGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.07, 24);
  const tee = new THREE.Mesh(teeGeo, brassMat);
  tee.position.set(0.28, 0.035, 0.36);

  turfBallGroup.add(turfBall, tee);
  group.add(turfBallGroup);
  disposables.push(ballGeo, teeGeo);
  registerExplode(explodableParts, turfBallGroup, new THREE.Vector3(0.35, 0.22, 0.38));
  tagInspectable(turfBallGroup, 'turf-ball', inspectables);

  return {
    group,
    explodableParts,
    inspectables,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

function buildHotballModel(finish: ProductFinishOption, anisotropy: number): ProceduralBuildResult {
  const group = new THREE.Group();
  const explodableParts: ProceduralBuildResult['explodableParts'] = [];
  const inspectables: THREE.Object3D[] = [];
  const disposables: { dispose: () => void }[] = [];

  const gripBump = createLeatherGrainBumpTexture(anisotropy);
  disposables.push(gripBump);

  const shellMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(finish.primaryHex),
    roughness: finish.roughness,
    metalness: finish.metalness,
    bumpMap: gripBump,
    bumpScale: 0.025,
  });
  const bandMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(finish.accentHex),
    roughness: 0.32,
    metalness: 0.35,
  });
  const steelMat = new THREE.MeshPhysicalMaterial({
    color: 0x94a3b8,
    roughness: 0.22,
    metalness: 0.9,
    anisotropy: 0.75,
  });
  disposables.push(shellMat, bandMat, steelMat);

  // 1. Machined Steel Inspection Cradle (grounded at y=0)
  const cradleGroup = new THREE.Group();
  const baseGeo = new THREE.CylinderGeometry(0.6, 0.68, 0.09, 40);
  const base = new THREE.Mesh(baseGeo, steelMat);
  base.position.y = 0.045;
  base.receiveShadow = true;

  const neckGeo = new THREE.CylinderGeometry(0.22, 0.34, 0.22, 32);
  const neck = new THREE.Mesh(neckGeo, steelMat);
  neck.position.y = 0.18;

  const cupGeo = new THREE.TorusGeometry(0.46, 0.035, 16, 48);
  const cup = new THREE.Mesh(cupGeo, bandMat);
  cup.rotation.x = Math.PI / 2;
  cup.position.y = 0.3;

  cradleGroup.add(base, neck, cup);
  group.add(cradleGroup);
  disposables.push(baseGeo, neckGeo, cupGeo);
  registerExplode(explodableParts, cradleGroup, new THREE.Vector3(0, -0.32, 0));
  tagInspectable(cradleGroup, 'cradle', inspectables);

  // 2. Dual Hemisphere Hotball Shell (Separates on Explode!)
  const upperGeo = new THREE.SphereGeometry(0.78, 36, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const upper = new THREE.Mesh(upperGeo, shellMat);
  upper.position.y = 1.06;
  upper.castShadow = true;

  const lowerGeo = new THREE.SphereGeometry(0.78, 36, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const lower = new THREE.Mesh(lowerGeo, shellMat);
  lower.position.y = 1.06;
  lower.castShadow = true;

  const coreGeo = new THREE.SphereGeometry(0.56, 24, 24);
  const core = new THREE.Mesh(coreGeo, bandMat);
  core.position.y = 1.06;

  group.add(upper, lower, core);
  disposables.push(upperGeo, lowerGeo, coreGeo);
  registerExplode(explodableParts, upper, new THREE.Vector3(0, 0.48, 0));
  registerExplode(explodableParts, lower, new THREE.Vector3(0, -0.18, 0));
  tagInspectable(upper, 'dimple-shell', inspectables);

  // 3. Thermal-Welded Equatorial & Meridian Seam Bands
  const bandGroup = new THREE.Group();
  bandGroup.position.y = 1.06;
  const eqBandGeo = new THREE.TorusGeometry(0.785, 0.025, 14, 64);
  const eqBand = new THREE.Mesh(eqBandGeo, bandMat);
  eqBand.rotation.x = Math.PI / 2;

  const merBand = new THREE.Mesh(eqBandGeo, bandMat);
  merBand.rotation.y = Math.PI / 4;

  bandGroup.add(eqBand, merBand);
  group.add(bandGroup);
  disposables.push(eqBandGeo);
  registerExplode(explodableParts, bandGroup, new THREE.Vector3(0, 0.25, 0.35));
  tagInspectable(bandGroup, 'equator-band', inspectables);

  return {
    group,
    explodableParts,
    inspectables,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

function buildLeatherApparelModel(finish: ProductFinishOption, anisotropy: number): ProceduralBuildResult {
  const group = new THREE.Group();
  const explodableParts: ProceduralBuildResult['explodableParts'] = [];
  const inspectables: THREE.Object3D[] = [];
  const disposables: { dispose: () => void }[] = [];

  const leatherBump = createLeatherGrainBumpTexture(anisotropy);
  disposables.push(leatherBump);

  const leatherMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(finish.primaryHex),
    roughness: finish.roughness,
    metalness: finish.metalness,
    bumpMap: leatherBump,
    bumpScale: 0.022,
    clearcoat: 0.22,
    clearcoatRoughness: 0.45,
  });
  const hardwareMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(finish.accentHex),
    roughness: 0.18,
    metalness: 0.94,
    anisotropy: 0.75,
  });
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x0f1218,
    roughness: 0.92,
    metalness: 0.02,
  });
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.35,
    metalness: 0.85,
  });
  disposables.push(leatherMat, hardwareMat, ribMat, standMat);

  // 1. Stainless Tailor Stand Base & Upright Pole (y=0)
  const standGroup = new THREE.Group();
  const baseGeo = new THREE.CylinderGeometry(0.45, 0.5, 0.06, 36);
  const base = new THREE.Mesh(baseGeo, standMat);
  base.position.y = 0.03;

  const poleGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.72, 16);
  const pole = new THREE.Mesh(poleGeo, standMat);
  pole.position.y = 0.4;
  standGroup.add(base, pole);
  group.add(standGroup);
  disposables.push(baseGeo, poleGeo);
  registerExplode(explodableParts, standGroup, new THREE.Vector3(0, -0.3, 0));

  // 2. Sculpted Leather Jacket Torso (LatheGeometry silhouette)
  const torsoPts = [
    new THREE.Vector2(0.01, 0),
    new THREE.Vector2(0.44, 0.04),
    new THREE.Vector2(0.41, 0.25),
    new THREE.Vector2(0.48, 0.65),
    new THREE.Vector2(0.54, 0.95),
    new THREE.Vector2(0.45, 1.12),
    new THREE.Vector2(0.18, 1.18),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoPts, 32);
  torsoGeo.scale(1.15, 1, 0.65);
  const torso = new THREE.Mesh(torsoGeo, leatherMat);
  torso.position.y = 0.68;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);
  disposables.push(torsoGeo);

  // 3. Notched Moto Collar Lapels
  const collarGroup = new THREE.Group();
  const collarGeo = new THREE.TorusGeometry(0.24, 0.055, 12, 24, Math.PI * 1.45);
  const collar = new THREE.Mesh(collarGeo, leatherMat);
  collar.position.set(0, 1.85, 0.02);
  collar.rotation.set(Math.PI / 2 + 0.15, 0, Math.PI * 0.28);

  const lapelGeo = new THREE.BoxGeometry(0.18, 0.34, 0.05);
  const lapelL = new THREE.Mesh(lapelGeo, leatherMat);
  lapelL.position.set(-0.18, 1.66, 0.32);
  lapelL.rotation.set(-0.22, 0.2, 0.28);

  const lapelR = new THREE.Mesh(lapelGeo, leatherMat);
  lapelR.position.set(0.18, 1.66, 0.32);
  lapelR.rotation.set(-0.22, -0.2, -0.28);

  collarGroup.add(collar, lapelL, lapelR);
  group.add(collarGroup);
  disposables.push(collarGeo, lapelGeo);
  registerExplode(explodableParts, collarGroup, new THREE.Vector3(0, 0.45, 0.25));
  tagInspectable(collarGroup, 'jacket-lapel', inspectables);

  // 4. Tailored Sleeves + Ribbed Cuffs
  const sleeveGeo = new THREE.CylinderGeometry(0.16, 0.12, 0.92, 20);
  const cuffGeo = new THREE.CylinderGeometry(0.125, 0.115, 0.14, 20);

  const leftSleeve = new THREE.Mesh(sleeveGeo, leatherMat);
  leftSleeve.position.set(-0.68, 1.24, 0);
  leftSleeve.rotation.z = -0.3;
  leftSleeve.castShadow = true;

  const rightSleeve = new THREE.Mesh(sleeveGeo, leatherMat);
  rightSleeve.position.set(0.68, 1.24, 0);
  rightSleeve.rotation.z = 0.3;
  rightSleeve.castShadow = true;

  const ribGroup = new THREE.Group();
  const cuffL = new THREE.Mesh(cuffGeo, ribMat);
  cuffL.position.set(-0.83, 0.78, 0);
  cuffL.rotation.z = -0.3;

  const cuffR = new THREE.Mesh(cuffGeo, ribMat);
  cuffR.position.set(0.83, 0.78, 0);
  cuffR.rotation.z = 0.3;

  const hemGeo = new THREE.CylinderGeometry(0.51, 0.48, 0.14, 32);
  hemGeo.scale(1.15, 1, 0.65);
  const hem = new THREE.Mesh(hemGeo, ribMat);
  hem.position.y = 0.72;

  ribGroup.add(cuffL, cuffR, hem);
  group.add(leftSleeve, rightSleeve, ribGroup);
  disposables.push(sleeveGeo, cuffGeo, hemGeo);
  registerExplode(explodableParts, leftSleeve, new THREE.Vector3(-0.48, 0.1, 0));
  registerExplode(explodableParts, rightSleeve, new THREE.Vector3(0.48, 0.1, 0));
  registerExplode(explodableParts, ribGroup, new THREE.Vector3(0, -0.18, 0));
  tagInspectable(ribGroup, 'rib-trim', inspectables);

  // 5. Heavy-Gauge Asymmetric Brass Zipper Track & Pull Tab
  const zipGroup = new THREE.Group();
  const zipTrackGeo = new THREE.BoxGeometry(0.05, 0.98, 0.04);
  const zipTrack = new THREE.Mesh(zipTrackGeo, hardwareMat);
  zipTrack.position.set(0.06, 1.24, 0.34);
  zipTrack.rotation.z = -0.06;

  const zipPullGeo = new THREE.BoxGeometry(0.04, 0.09, 0.03);
  const zipPull = new THREE.Mesh(zipPullGeo, hardwareMat);
  zipPull.position.set(0.09, 1.56, 0.36);

  zipGroup.add(zipTrack, zipPull);
  group.add(zipGroup);
  disposables.push(zipTrackGeo, zipPullGeo);
  registerExplode(explodableParts, zipGroup, new THREE.Vector3(0, 0.1, 0.52));
  tagInspectable(zipGroup, 'brass-zip', inspectables);

  return {
    group,
    explodableParts,
    inspectables,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function buildExportGlobeModel(anisotropy: number, leads: DiscoveredLead[]): ProceduralBuildResult {
  const group = new THREE.Group();
  const explodableParts: ProceduralBuildResult['explodableParts'] = [];
  const inspectables: THREE.Object3D[] = [];
  const disposables: { dispose: () => void }[] = [];

  const earthTex = createGlobeEarthTexture(anisotropy);
  disposables.push(earthTex);

  const globeMat = new THREE.MeshStandardMaterial({
    map: earthTex,
    roughness: 0.62,
    metalness: 0.18,
  });
  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4af37,
    roughness: 0.2,
    metalness: 0.94,
    anisotropy: 0.8,
  });
  const arcMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.65,
    roughness: 0.3,
    metalness: 0.4,
  });
  const hubMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.8,
    roughness: 0.25,
    metalness: 0.3,
  });
  disposables.push(globeMat, brassMat, arcMat, hubMat);

  const radius = 1.05;
  const centerY = 1.24;

  // 1. Brass Gimbal Pedestal (grounded at y=0)
  const standGroup = new THREE.Group();
  const footGeo = new THREE.CylinderGeometry(0.45, 0.56, 0.08, 36);
  const foot = new THREE.Mesh(footGeo, brassMat);
  foot.position.y = 0.04;

  const stemGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.24, 16);
  const stem = new THREE.Mesh(stemGeo, brassMat);
  stem.position.y = 0.16;

  const meridianRingGeo = new THREE.TorusGeometry(radius + 0.14, 0.022, 16, 72, Math.PI * 1.15);
  const meridianRing = new THREE.Mesh(meridianRingGeo, brassMat);
  meridianRing.position.y = centerY;
  meridianRing.rotation.z = -Math.PI * 0.57;

  standGroup.add(foot, stem, meridianRing);
  group.add(standGroup);
  disposables.push(footGeo, stemGeo, meridianRingGeo);
  registerExplode(explodableParts, standGroup, new THREE.Vector3(0, -0.25, 0));

  // 2. Earth Sphere + Sialkot Origin Spire + Export Trade Arcs
  const globeGroup = new THREE.Group();
  globeGroup.position.y = centerY;
  // Rotate so Pakistan / Eurasia faces camera naturally
  globeGroup.rotation.y = -2.25;

  const sphereGeo = new THREE.SphereGeometry(radius, 48, 36);
  const sphere = new THREE.Mesh(sphereGeo, globeMat);
  sphere.castShadow = true;
  globeGroup.add(sphere);
  disposables.push(sphereGeo);

  const sialkotPos = latLngToVector3(SIALKOT_COORDS.lat, SIALKOT_COORDS.lng, radius);
  const beaconGeo = new THREE.ConeGeometry(0.036, 0.16, 12);
  const beacon = new THREE.Mesh(beaconGeo, brassMat);
  const normal = sialkotPos.clone().normalize();
  beacon.position.copy(sialkotPos).addScaledVector(normal, 0.08);
  beacon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  globeGroup.add(beacon);
  disposables.push(beaconGeo);

  // Merge live leads + baseline Sialkot trade markets
  const destinations =
    leads.length > 0
      ? leads.slice(0, 10).map((l) => ({ name: l.companyName, lat: l.lat, lng: l.lng }))
      : TARGET_HUB_MARKETS;

  // Instanced destination nodes
  const markerGeo = new THREE.SphereGeometry(0.028, 12, 12);
  const markers = new THREE.InstancedMesh(markerGeo, hubMat, destinations.length);
  const dummy = new THREE.Object3D();

  destinations.forEach((dest, idx) => {
    const destPos = latLngToVector3(dest.lat, dest.lng, radius);
    dummy.position.copy(destPos);
    dummy.updateMatrix();
    markers.setMatrixAt(idx, dummy.matrix);

    const mid = sialkotPos.clone().add(destPos).multiplyScalar(0.5);
    const dist = sialkotPos.distanceTo(destPos);
    mid.normalize().multiplyScalar(radius + Math.max(0.18, dist * 0.34));

    const curve = new THREE.QuadraticBezierCurve3(sialkotPos, mid, destPos);
    const arcGeo = new THREE.TubeGeometry(curve, 28, 0.009, 8, false);
    const arc = new THREE.Mesh(arcGeo, arcMat);
    globeGroup.add(arc);
    disposables.push(arcGeo);
    registerExplode(explodableParts, arc, mid.clone().normalize().multiplyScalar(0.28));
  });

  markers.instanceMatrix.needsUpdate = true;
  markers.computeBoundingSphere();
  globeGroup.add(markers);
  disposables.push(markerGeo);

  group.add(globeGroup);
  tagInspectable(globeGroup, 'export-globe', inspectables);

  return {
    group,
    explodableParts,
    inspectables,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

export function buildSceneSubject(
  subjectId: SceneSubjectId,
  finish: ProductFinishOption,
  anisotropy: number,
  leads: DiscoveredLead[]
): ProceduralBuildResult {
  switch (subjectId) {
    case 'karate-suits':
      return buildKarateSuitModel(finish, anisotropy);
    case 'footballs':
      return buildFootballModel(finish, anisotropy);
    case 'hockeys':
      return buildHockeyStickModel(finish, anisotropy);
    case 'hotballs':
      return buildHotballModel(finish, anisotropy);
    case 'apparels-leather':
    case 'custom':
      return buildLeatherApparelModel(finish, anisotropy);
    case 'export-globe':
      return buildExportGlobeModel(anisotropy, leads);
  }
}
