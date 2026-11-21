// Bright Low-Poly 3D World Renderer built on local vendored Three.js (zero CDN).
// Features:
// - Third-person chase PerspectiveCamera behind the car (car framed in lower third, smooth cornering)
// - Detailed low-poly 3D cars (body, cabin, glass windows, 4 spinning/steering wheels on asphalt + shadows)
// - Raised 3D sidewalks & curbs, turquoise low-poly buildings with facades & varied heights,
//   drive-through 3D Coral Checkpoint Gates with live Green/Amber/Red signals,
//   and the Citrus Plaza Roundabout crowned by a Giant Orange Statue landmark
// - Golden-hour side sunlight (DirectionalLight) with real-time soft shadows + bright coastal sky dome

import * as THREE from '../vendor/three.module.js';
import {
  CAR,
  LIGHT_AMBER,
  LIGHT_GREEN,
  LIGHT_RED,
  PALETTE,
  PATROL,
  TAXI,
  WORLD,
  WORLD_SCALE,
} from './config.js';
import { FINISH_GATE, GARAGE_FORECOURT, ROUNDABOUT } from './city.js';
import { createRandom } from './random.js';
import { MODE_COUNTDOWN, MODE_FINISH, MODE_TITLE } from './world.js';

const S = WORLD_SCALE;

function to3X(simX) { return simX * S; }
function to3Z(simY) { return simY * S; }

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Generate organic fine-grain asphalt surface texture (zero tiling streaks). */
function makeAsphaltTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  const rand = createRandom(909);
  g.fillStyle = PALETTE.asphalt;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i += 1) {
    const x = Math.floor(rand() * 128);
    const y = Math.floor(rand() * 128);
    g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.032)' : 'rgba(0,0,0,0.08)';
    g.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(90, 68);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Generate warm cobblestone alley texture so shortcut alleys look tactile & distinct in 3D. */
function makeCobbleTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#7c5d4e';
  g.fillRect(0, 0, 128, 128);
  const rows = 8;
  const cols = 4;
  const rh = 128 / rows;
  const cw = 128 / cols;
  for (let r = 0; r < rows; r += 1) {
    const off = (r % 2) * (cw * 0.5);
    for (let col = -1; col <= cols; col += 1) {
      const shade = ((r * 13 + col * 29) % 24) - 12;
      g.fillStyle = `rgb(${164 + shade}, ${126 + shade}, ${104 + Math.floor(shade * 0.7)})`;
      g.fillRect(col * cw + off + 2, r * rh + 2, cw - 4, rh - 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Generate architectural window-grid facade textures for bright low-poly turquoise buildings. */
function makeFacadeTexture(baseHex, seed) {
  const c = makeCanvas(128, 256);
  const g = c.getContext('2d');
  g.fillStyle = baseHex;
  g.fillRect(0, 0, 128, 256);

  // Subtle horizontal floor cornices
  g.fillStyle = 'rgba(255, 252, 240, 0.18)';
  for (let y = 0; y < 256; y += 32) {
    g.fillRect(0, y, 128, 4);
  }

  // Crisp low-poly windows (cool twilight glass + warm golden sunlit/lit rooms!)
  const cols = 4;
  const floors = 8;
  for (let f = 0; f < floors; f += 1) {
    for (let col = 0; col < cols; col += 1) {
      const wx = 10 + col * 29;
      const wy = 10 + f * 32;
      const hash = (seed * 31 + f * 17 + col * 13) % 11;
      // Window recess frame
      g.fillStyle = 'rgba(18, 38, 48, 0.45)';
      g.fillRect(wx - 1.5, wy - 1.5, 20, 19);
      // Glass pane
      if (hash < 4) {
        g.fillStyle = '#ffe599';
      } else if (hash < 7) {
        g.fillStyle = '#6ad4db';
      } else {
        g.fillStyle = '#245869';
      }
      g.fillRect(wx, wy, 17, 16);
      // Diagonal sunset reflection glint
      g.fillStyle = 'rgba(255, 255, 255, 0.28)';
      g.fillRect(wx + 2, wy + 2, 5, 10);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft dark radial contact shadow directly beneath each car so tires never look floating. */
function makeContactShadowTexture() {
  const c = makeCanvas(128, 64);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 32, 8, 64, 32, 58);
  grad.addColorStop(0, 'rgba(10, 14, 24, 0.62)');
  grad.addColorStop(0.65, 'rgba(10, 14, 24, 0.36)');
  grad.addColorStop(1, 'rgba(10, 14, 24, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 64);
  return new THREE.CanvasTexture(c);
}

/** Bright sunset sky dome texture (turquoise zenith -> golden sunset horizon). */
function makeSkyTexture() {
  const c = makeCanvas(32, 256);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#1e6e99');
  grad.addColorStop(0.32, '#3ca0b8');
  grad.addColorStop(0.56, '#f0a672');
  grad.addColorStop(0.72, '#ffd694');
  grad.addColorStop(1.0, '#ffe6b3');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Signboard CanvasTexture helper for Garage 06, Taxi roof sign, and Coral Gate headers. */
function makeSignTexture(topText, bottomText, bgHex, borderHex, topCol, botCol, w = 512, h = 160) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = bgHex;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = borderHex;
  g.lineWidth = 10;
  g.strokeRect(8, 8, w - 16, h - 16);

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (bottomText) {
    g.fillStyle = topCol;
    g.font = `900 ${Math.round(h * 0.34)}px system-ui, sans-serif`;
    g.fillText(topText, w * 0.5, h * 0.34);
    g.fillStyle = botCol;
    g.font = `800 ${Math.round(h * 0.25)}px ui-monospace, monospace`;
    g.fillText(bottomText, w * 0.5, h * 0.72);
  } else {
    g.fillStyle = topCol;
    g.font = `900 ${Math.round(h * 0.44)}px ui-monospace, monospace`;
    g.fillText(topText, w * 0.5, h * 0.52);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Checkered pattern texture for the Finish Line & Garage arch banner. */
function makeCheckerTexture() {
  const c = makeCanvas(128, 64);
  const g = c.getContext('2d');
  const sq = 16;
  for (let y = 0; y < 64; y += sq) {
    for (let x = 0; x < 128; x += sq) {
      g.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#ffffff' : '#1b202b';
      g.fillRect(x, y, sq, sq);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Crisp miniature license plate texture for realistic rear-camera automotive detail (no real-world brands). */
function makePlateTexture(text, bgHex = '#f5f1e4', fgHex = '#1a2433', borderHex = '#d4a33a') {
  const c = makeCanvas(128, 48);
  const g = c.getContext('2d');
  g.fillStyle = bgHex;
  g.fillRect(0, 0, 128, 48);
  g.strokeStyle = borderHex;
  g.lineWidth = 4;
  g.strokeRect(3, 3, 122, 42);
  g.fillStyle = fgHex;
  g.font = '900 24px ui-monospace, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 26);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Build a watertight, outward-facing symmetric lofted 3D automotive shell from X-ordered cross-sections.
 * Each station is `{ x, pts: [[y, halfW], ...] }` ordered from bottom to top; mirrored across Z automatically.
 */
function buildLoftedMesh(stations, material) {
  const rings = stations.map((st) => {
    const ring = [];
    // Right side (+Z), bottom -> top
    for (let i = 0; i < st.pts.length; i += 1) {
      ring.push([st.x, st.pts[i][0], st.pts[i][1]]);
    }
    // Left side (-Z), top -> bottom
    for (let i = st.pts.length - 1; i >= 0; i -= 1) {
      ring.push([st.x, st.pts[i][0], -st.pts[i][1]]);
    }
    return ring;
  });

  const positions = [];
  const pushTri = (a, b, c) => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };

  const k = rings[0].length;
  // Side panels between consecutive stations
  for (let s = 0; s < rings.length - 1; s += 1) {
    const r0 = rings[s];
    const r1 = rings[s + 1];
    for (let j = 0; j < k; j += 1) {
      const jn = (j + 1) % k;
      const a = r0[j];
      const b = r1[j];
      const c = r1[jn];
      const d = r0[jn];
      pushTri(a, b, c);
      pushTri(a, c, d);
    }
  }

  // Rear cap (-X outward normal)
  const rearRing = rings[0];
  let rearCy = 0;
  for (let j = 0; j < k; j += 1) rearCy += rearRing[j][1];
  const rearCenter = [stations[0].x, rearCy / k, 0];
  for (let j = 0; j < k; j += 1) {
    pushTri(rearCenter, rearRing[j], rearRing[(j + 1) % k]);
  }

  // Front cap (+X outward normal)
  const frontRing = rings[rings.length - 1];
  let frontCy = 0;
  for (let j = 0; j < k; j += 1) frontCy += frontRing[j][1];
  const frontCenter = [stations[stations.length - 1].x, frontCy / k, 0];
  for (let j = 0; j < k; j += 1) {
    pushTri(frontCenter, frontRing[(j + 1) % k], frontRing[j]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Build a 5-spoke low-poly rally wheel with alloy rim (velg) resting flush on y = 0 asphalt. */
function buildRallyWheel(wheelR, wheelW, tireMat, rimMat, hubMat) {
  const spinGroup = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 16), tireMat);
  tire.rotation.x = Math.PI * 0.5;
  tire.castShadow = true;
  spinGroup.add(tire);

  // Subtle rounded sidewall bevel rings so tires look plump & planted from the rear camera
  const treadShoulder = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.96, wheelR * 0.96, wheelW + 0.03, 16), tireMat);
  treadShoulder.rotation.x = Math.PI * 0.5;
  spinGroup.add(treadShoulder);

  // Recessed alloy wheel barrel & bright outer rim ring
  const rimOuter = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.67, wheelR * 0.67, wheelW + 0.035, 14), rimMat);
  rimOuter.rotation.x = Math.PI * 0.5;
  spinGroup.add(rimOuter);

  const barrelDark = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.54, wheelR * 0.54, wheelW + 0.05, 12), tireMat);
  barrelDark.rotation.x = Math.PI * 0.5;
  spinGroup.add(barrelDark);

  // 5 crisp low-poly spokes so rotation is clearly visible at every speed!
  const spokeGeo = new THREE.BoxGeometry(wheelR * 1.14, 0.075, wheelW + 0.06);
  for (let s = 0; s < 5; s += 1) {
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.z = (s * Math.PI) / 5;
    spinGroup.add(spoke);
  }

  const centerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, wheelW + 0.075, 8), hubMat);
  centerCap.rotation.x = Math.PI * 0.5;
  spinGroup.add(centerCap);

  return spinGroup;
}

/**
 * Build an original sculpted 3D Rally Sports Hatchback for the player (no real-world brand logos).
 * Engineered specifically so the rear chase-camera view reads immediately as a real car:
 * wide sculpted haunches, inward-tapered greenhouse (tumblehome), sloped rear hatch glass,
 * side wing mirrors, wraparound multi-element taillights, 3rd brake light, rear diffuser,
 * dual hollow exhaust tips, recessed plate, and clearly visible wide rear tires on the asphalt.
 */
function buildPlayerRallyHatch3D(contactShadowTex) {
  const wheelR = 0.40;
  const wheelW = 0.34;
  const root = new THREE.Group();

  // 1. Soft grounded contact shadow directly on asphalt (y = 0.03)
  const shadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 3.05),
    new THREE.MeshBasicMaterial({ map: contactShadowTex, transparent: true, depthWrite: false })
  );
  shadowMesh.rotation.x = -Math.PI * 0.5;
  shadowMesh.position.y = 0.03;
  root.add(shadowMesh);

  const chassis = new THREE.Group();
  root.add(chassis);

  // Realistic painted automotive materials
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe8382e, roughness: 0.30, metalness: 0.22, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xf7efe0, roughness: 0.36, metalness: 0.12, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1b202b, roughness: 0.72, metalness: 0.10, flatShading: true });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a374c, roughness: 0.10, metalness: 0.75, flatShading: true });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xf5c446, roughness: 0.28, metalness: 0.56, flatShading: true });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe6eef4, roughness: 0.20, metalness: 0.78 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.90, flatShading: true });
  const darkBoreMat = new THREE.MeshBasicMaterial({ color: 0x090b10 });

  // 2. Sculpted Lofted Lower Body (pinched rear bumper corners, wide rear haunches, waist tuck, sloped hood)
  const lowerBody = buildLoftedMesh([
    { x: -2.14, pts: [[0.42, 0.70], [0.56, 0.87], [0.85, 0.90], [0.98, 0.83]] },
    { x: -1.92, pts: [[0.38, 0.80], [0.56, 0.98], [0.87, 0.99], [1.02, 0.88]] },
    { x: -1.28, pts: [[0.36, 0.85], [0.58, 1.04], [0.89, 1.03], [1.04, 0.89]] },
    { x: -0.05, pts: [[0.34, 0.84], [0.56, 0.98], [0.86, 0.97], [1.01, 0.86]] },
    { x:  0.88, pts: [[0.34, 0.85], [0.56, 1.00], [0.84, 0.99], [0.98, 0.87]] },
    { x:  1.40, pts: [[0.35, 0.84], [0.56, 1.01], [0.80, 0.98], [0.91, 0.85]] },
    { x:  2.02, pts: [[0.35, 0.76], [0.52, 0.92], [0.73, 0.90], [0.83, 0.78]] },
    { x:  2.22, pts: [[0.36, 0.66], [0.50, 0.81], [0.69, 0.79], [0.77, 0.68]] },
  ], bodyMat);
  chassis.add(lowerBody);

  // 3. Tapered Greenhouse (Authentic inward tumblehome: beltline 0.82 -> roof 0.62!)
  const glassHouse = buildLoftedMesh([
    { x: -1.86, pts: [[0.99, 0.81], [1.04, 0.80]] },
    { x: -1.24, pts: [[1.00, 0.83], [1.49, 0.62]] },
    { x:  0.14, pts: [[0.97, 0.83], [1.49, 0.62]] },
    { x:  0.86, pts: [[0.95, 0.81], [0.99, 0.80]] },
  ], glassMat);
  chassis.add(glassHouse);

  // Sleek contoured roof cap matching the tapered greenhouse width (cream rally roof!)
  const roofCap = buildLoftedMesh([
    { x: -1.28, pts: [[1.48, 0.63], [1.54, 0.56]] },
    { x: -0.55, pts: [[1.49, 0.64], [1.56, 0.57]] },
    { x:  0.16, pts: [[1.48, 0.62], [1.53, 0.55]] },
  ], roofMat);
  chassis.add(roofCap);

  // Sculpted angled body-colored C-pillars, A-pillars, and B-pillars framing the tapered glass!
  const makeSlopedPillar = (x0, y0, z0, x1, y1, z1, thicknessX, thicknessZ, mat) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dy, dz);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(thicknessX, len, thicknessZ), mat);
    mesh.position.set((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.castShadow = true;
    return mesh;
  };

  for (const sz of [-1, 1]) {
    // Bold sculpted red C-pillars framing the sloped rear hatch window
    chassis.add(makeSlopedPillar(-1.86, 1.00, sz * 0.81, -1.25, 1.50, sz * 0.61, 0.22, 0.11, bodyMat));
    // Sleek A-pillars framing the front windshield
    chassis.add(makeSlopedPillar(0.84, 0.96, sz * 0.80, 0.15, 1.49, sz * 0.61, 0.13, 0.09, bodyMat));
    // Dark B-pillar divider between front and rear side windows
    chassis.add(makeSlopedPillar(-0.36, 1.00, sz * 0.82, -0.34, 1.49, sz * 0.63, 0.12, 0.07, trimMat));

    // Side Wing Mirrors (instantly recognizable real-car silhouette from rear chase camera!)
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(0.56, 1.05, sz * 0.86);
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.16), trimMat);
    stalk.position.set(0, 0.01, sz * 0.06);
    mirrorGroup.add(stalk);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.22), bodyMat);
    cap.position.set(-0.02, 0.04, sz * 0.16);
    cap.castShadow = true;
    mirrorGroup.add(cap);
    const mirrorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.17), chromeMat);
    mirrorGlass.position.set(-0.09, 0.04, sz * 0.16);
    mirrorGroup.add(mirrorGlass);
    chassis.add(mirrorGroup);

    // Subtle dark side skirts & door handles
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.11, 0.10), trimMat);
    skirt.position.set(0.04, 0.34, sz * 0.96);
    chassis.add(skirt);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.04), trimMat);
    handle.position.set(-0.18, 0.88, sz * 0.98);
    chassis.add(handle);
  }

  // Sleek roof shark-fin antenna + subtle hood racing stripe & intake scoop
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), trimMat);
  fin.position.set(-0.98, 1.59, 0);
  fin.rotation.z = 0.45;
  fin.scale.set(1.5, 1, 0.45);
  chassis.add(fin);

  const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.03, 0.36), roofMat);
  hoodStripe.position.set(1.48, 0.90, 0);
  hoodStripe.rotation.z = 0.14;
  chassis.add(hoodStripe);

  const hoodScoop = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.48), trimMat);
  hoodScoop.position.set(1.36, 0.94, 0);
  hoodScoop.rotation.z = 0.14;
  chassis.add(hoodScoop);

  // 4. Front Splitter, Grille & Headlights
  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.10, 1.68), trimMat);
  frontLip.position.set(2.14, 0.34, 0);
  chassis.add(frontLip);

  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.20, 1.08), trimMat);
  grille.position.set(2.22, 0.56, 0);
  chassis.add(grille);

  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff8dc, emissive: 0xffe69c, emissiveIntensity: 1.6 });
  for (const sz of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.15, 0.34), headMat);
    hl.position.set(2.16, 0.66, sz * 0.64);
    hl.rotation.y = sz * -0.18;
    chassis.add(hl);
    const fog = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10), headMat);
    fog.rotation.z = Math.PI * 0.5;
    fog.position.set(2.24, 0.54, sz * 0.26);
    chassis.add(fog);
  }

  // 5. Rear Aerodynamic Roof Spoiler (proportioned to the tapered roof width, NOT a boxy slab!)
  const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.055, 1.24), bodyMat);
  wingBlade.position.set(-1.38, 1.56, 0);
  wingBlade.rotation.z = 0.16;
  wingBlade.castShadow = true;
  chassis.add(wingBlade);

  for (const sz of [-1, 1]) {
    const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.045), trimMat);
    endplate.position.set(-1.37, 1.54, sz * 0.62);
    chassis.add(endplate);

    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.06), trimMat);
    mount.position.set(-1.30, 1.50, sz * 0.36);
    chassis.add(mount);
  }

  // Rear window wiper blade resting neatly at the base of the sloped rear glass
  const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.42), trimMat);
  wiper.position.set(-1.82, 1.06, 0.14);
  wiper.rotation.x = 0.08;
  chassis.add(wiper);

  // 6. Sculpted Rear Fascia: Wraparound Multi-Element Taillights, 3rd Brake Light, Recessed Plate & Diffuser!
  // Smoked dark taillight housing spanning rear deck
  const tailPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.20, 1.66), trimMat);
  tailPanel.position.set(-2.13, 0.78, 0);
  chassis.add(tailPanel);

  // Rear diffuser with 4 vertical aero fins (kept narrower than rear track so wide tires show clearly!)
  const rearDiffuser = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 1.28), trimMat);
  rearDiffuser.position.set(-2.06, 0.41, 0);
  chassis.add(rearDiffuser);

  for (const fz of [-0.36, -0.12, 0.12, 0.36]) {
    const strake = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.035), trimMat);
    strake.position.set(-2.12, 0.39, fz);
    chassis.add(strake);
  }

  // Crisp recessed rear license plate ("RUSH 06")
  const plateTex = makePlateTexture('RUSH 06');
  const plateMat = new THREE.MeshStandardMaterial({
    map: plateTex,
    emissive: 0xffffff,
    emissiveMap: plateTex,
    emissiveIntensity: 0.28,
    roughness: 0.45,
  });
  const plateFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.20, 0.54), trimMat);
  plateFrame.position.set(-2.14, 0.57, 0);
  chassis.add(plateFrame);
  const plateFace = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.16), plateMat);
  plateFace.rotation.y = -Math.PI * 0.5;
  plateFace.position.set(-2.175, 0.57, 0);
  chassis.add(plateFace);

  // Glowing Brake Lights, Amber Signals, Reverse Lamps & High-Mount 3rd Brake Light!
  const brakeMat = new THREE.MeshStandardMaterial({
    color: 0xff2434,
    emissive: 0xff162c,
    emissiveIntensity: 0.75,
    roughness: 0.18,
  });
  const brakeHaloMat = new THREE.MeshBasicMaterial({
    color: 0xff2b40,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const amberSignalMat = new THREE.MeshStandardMaterial({
    color: 0xffa624,
    emissive: 0xff8c00,
    emissiveIntensity: 0.35,
    roughness: 0.25,
  });
  const reverseMat = new THREE.MeshStandardMaterial({
    color: 0xe6eff5,
    emissive: 0xffffff,
    emissiveIntensity: 0.08,
  });

  // High-mount 3rd brake light strip under the roof spoiler
  const thirdBrake = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.045, 0.44), brakeMat);
  thirdBrake.position.set(-1.32, 1.49, 0);
  chassis.add(thirdBrake);

  // Subtle connecting red light-bar accent across the dark rear bezel
  const centerBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.56), brakeMat);
  centerBar.position.set(-2.155, 0.80, 0);
  chassis.add(centerBar);

  for (const sz of [-1, 1]) {
    // Outer main brake/tail LED cluster
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.44), brakeMat);
    lamp.position.set(-2.15, 0.81, sz * 0.62);
    chassis.add(lamp);

    // Side-wrapping corner taillight piece so it reads 3D from rear & 3/4 angles!
    const wrapLamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.07), brakeMat);
    wrapLamp.position.set(-2.06, 0.81, sz * 0.87);
    wrapLamp.rotation.y = sz * 0.26;
    chassis.add(wrapLamp);

    // Lower amber turn-signal strip + inboard white reverse lamp
    const amb = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.055, 0.24), amberSignalMat);
    amb.position.set(-2.155, 0.71, sz * 0.71);
    chassis.add(amb);

    const rev = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.055, 0.18), reverseMat);
    rev.position.set(-2.155, 0.71, sz * 0.48);
    chassis.add(rev);

    // Outer translucent glow halo that blooms brightly when braking!
    const halo = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.56), brakeHaloMat);
    halo.position.set(-2.19, 0.79, sz * 0.62);
    chassis.add(halo);

    // Twin dual-wall hollow chrome exhaust tips
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.22, 12), chromeMat);
    pipe.rotation.z = Math.PI * 0.5;
    pipe.position.set(-2.14, 0.39, sz * 0.48);
    chassis.add(pipe);

    const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.04, 10), darkBoreMat);
    bore.rotation.z = Math.PI * 0.5;
    bore.position.set(-2.24, 0.39, sz * 0.48);
    chassis.add(bore);
  }

  // Real rear brake light illuminating the bumper & asphalt behind the car when braking!
  const brakeLight = new THREE.PointLight(0xff2036, 0, 9.5, 1.8);
  brakeLight.position.set(-2.65, 0.85, 0);
  chassis.add(brakeLight);

  // 7. Contoured Wheel Arch Eyebrows & Dark Wheel Wells (frame tires cleanly without hiding them from behind!)
  const archShape = new THREE.Shape();
  const archOuter = 0.51;
  const archInner = 0.43;
  const segs = 10;
  for (let i = 0; i <= segs; i += 1) {
    const a = (i / segs) * Math.PI;
    const ax = Math.cos(a) * archOuter;
    const ay = Math.sin(a) * archOuter;
    if (i === 0) archShape.moveTo(ax, ay);
    else archShape.lineTo(ax, ay);
  }
  for (let i = segs; i >= 0; i -= 1) {
    const a = (i / segs) * Math.PI;
    archShape.lineTo(Math.cos(a) * archInner, Math.sin(a) * archInner);
  }
  archShape.closePath();
  const archGeo = new THREE.ExtrudeGeometry(archShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
  });
  archGeo.translate(0, 0, -0.07);

  const wellGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.38, 12, 1, false, 0, Math.PI);
  wellGeo.rotateZ(Math.PI * 0.5);
  wellGeo.rotateY(Math.PI * 0.5);

  const axleFrontX = 1.32;
  const axleRearX = -1.28;
  const wheelTrackZ = 0.94;

  for (const ax of [axleFrontX, axleRearX]) {
    for (const sz of [-1, 1]) {
      const flare = new THREE.Mesh(archGeo, trimMat);
      flare.position.set(ax, wheelR - 0.01, sz * 1.00);
      chassis.add(flare);

      const well = new THREE.Mesh(wellGeo, trimMat);
      well.position.set(ax, wheelR - 0.01, sz * 0.88);
      chassis.add(well);
    }
  }

  // 8. Four Wide 5-Spoke Rally Wheels resting flush on y = 0 asphalt!
  const frontPivots = [];
  const wheelMeshes = [];
  const wheelPositions = [
    { x: axleFrontX, z: -wheelTrackZ, front: true },
    { x: axleFrontX, z: wheelTrackZ, front: true },
    { x: axleRearX, z: -wheelTrackZ, front: false },
    { x: axleRearX, z: wheelTrackZ, front: false },
  ];

  for (const pos of wheelPositions) {
    const pivot = new THREE.Group();
    pivot.position.set(pos.x, wheelR, pos.z);
    const wMesh = buildRallyWheel(wheelR, wheelW, tireMat, rimMat, chromeMat);
    pivot.add(wMesh);
    root.add(pivot);
    wheelMeshes.push(wMesh);
    if (pos.front) frontPivots.push(pivot);
  }

  return {
    root,
    chassis,
    frontPivots,
    wheelMeshes,
    brakeMat,
    brakeHaloMat,
    brakeLight,
    reverseMat,
    taxiSignPivot: null,
    sirenRedMat: null,
    sirenBlueMat: null,
    sirenLight: null,
    wheelR,
    spin: 0,
  };
}

/** Build a sculpted low-poly 3D NPC vehicle (Yellow Taxi, Police Patrol, Traffic) with tapered cabin & 4 wheels. */
function buildCar3D(opts, contactShadowTex, taxiSignMats) {
  const { lengthSim, widthSim, bodyColor, roofColor, kind } = opts;
  const len = lengthSim * S;
  const wid = widthSim * S;
  const halfL = len * 0.5;
  const halfW = wid * 0.5;
  const wheelR = kind === 'bus' ? 0.44 : 0.38;
  const wheelW = 0.28;

  const root = new THREE.Group();

  // 1. Contact shadow directly on asphalt (y = 0.03)
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(len * 1.30, wid * 1.35), shadowMat);
  shadowMesh.rotation.x = -Math.PI * 0.5;
  shadowMesh.position.y = 0.03;
  root.add(shadowMesh);

  // 2. Sprung body container
  const chassis = new THREE.Group();
  root.add(chassis);

  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.38, metalness: 0.16, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.44, metalness: 0.10, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.72, flatShading: true });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1b384d, roughness: 0.14, metalness: 0.65, flatShading: true });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdbe5ed, roughness: 0.25, metalness: 0.65 });

  const bodyBaseY = wheelR + 0.04;
  const bodyH = kind === 'bus' ? 1.50 : kind === 'van' ? 0.88 : 0.64;
  const cabH = kind === 'bus' ? 0.74 : kind === 'van' ? 0.70 : 0.54;
  const cabX = kind === 'bus' ? -len * 0.02 : kind === 'van' ? -len * 0.07 : -len * 0.06;
  const cabY = bodyBaseY + bodyH + cabH * 0.5 - 0.02;

  if (kind === 'bus' || kind === 'van') {
    // Tapered van / bus body with sloped front nose
    const lower = buildLoftedMesh([
      { x: -halfL, pts: [[bodyBaseY + 0.06, halfW * 0.86], [bodyBaseY + bodyH, halfW * 0.96]] },
      { x: -halfL * 0.88, pts: [[bodyBaseY, halfW * 0.96], [bodyBaseY + bodyH, halfW]] },
      { x:  halfL * 0.82, pts: [[bodyBaseY, halfW * 0.96], [bodyBaseY + bodyH, halfW]] },
      { x:  halfL, pts: [[bodyBaseY + 0.06, halfW * 0.86], [bodyBaseY + bodyH * 0.84, halfW * 0.92]] },
    ], bodyMat);
    chassis.add(lower);

    const gLen = kind === 'bus' ? halfL * 0.92 : halfL * 0.78;
    const glass = buildLoftedMesh([
      { x: -gLen, pts: [[bodyBaseY + bodyH - 0.02, halfW * 0.92], [bodyBaseY + bodyH + cabH * 0.88, halfW * 0.82]] },
      { x:  gLen * 0.92, pts: [[bodyBaseY + bodyH - 0.02, halfW * 0.92], [bodyBaseY + bodyH + cabH * 0.88, halfW * 0.82]] },
      { x:  gLen * 1.06, pts: [[bodyBaseY + bodyH - 0.06, halfW * 0.88], [bodyBaseY + bodyH + 0.04, halfW * 0.86]] },
    ], glassMat);
    chassis.add(glass);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(gLen * 1.88, 0.12, wid * 0.82), roofMat);
    roof.position.set(-gLen * 0.04, bodyBaseY + bodyH + cabH * 0.90, 0);
    roof.castShadow = true;
    chassis.add(roof);
  } else {
    // Realistic 3-box sculpted sedan/taxi/patrol silhouette with hood slope, trunk, and tumblehome cabin!
    const beltY = bodyBaseY + bodyH;
    const lower = buildLoftedMesh([
      { x: -halfL, pts: [[bodyBaseY + 0.06, halfW * 0.76], [bodyBaseY + 0.24, halfW * 0.92], [beltY - 0.04, halfW * 0.90]] },
      { x: -halfL * 0.84, pts: [[bodyBaseY, halfW * 0.88], [bodyBaseY + 0.28, halfW * 1.01], [beltY, halfW * 0.95]] },
      { x:  halfL * 0.36, pts: [[bodyBaseY, halfW * 0.88], [bodyBaseY + 0.28, halfW * 1.00], [beltY - 0.02, halfW * 0.94]] },
      { x:  halfL * 0.84, pts: [[bodyBaseY + 0.02, halfW * 0.86], [bodyBaseY + 0.24, halfW * 0.97], [beltY - 0.14, halfW * 0.90]] },
      { x:  halfL, pts: [[bodyBaseY + 0.06, halfW * 0.74], [bodyBaseY + 0.22, halfW * 0.86], [beltY - 0.20, halfW * 0.78]] },
    ], bodyMat);
    chassis.add(lower);

    // Tapered greenhouse (inward-sloping C-pillars & A-pillars!)
    const glass = buildLoftedMesh([
      { x: -halfL * 0.62, pts: [[beltY - 0.02, halfW * 0.84], [beltY + 0.03, halfW * 0.82]] },
      { x: -halfL * 0.34, pts: [[beltY - 0.02, halfW * 0.86], [beltY + cabH, halfW * 0.66]] },
      { x:  halfL * 0.14, pts: [[beltY - 0.02, halfW * 0.86], [beltY + cabH, halfW * 0.66]] },
      { x:  halfL * 0.44, pts: [[beltY - 0.04, halfW * 0.84], [beltY + 0.01, halfW * 0.82]] },
    ], glassMat);
    chassis.add(glass);

    // Tapered roof panel matching the greenhouse
    const roof = new THREE.Mesh(new THREE.BoxGeometry(len * 0.27, 0.09, wid * 0.66), roofMat);
    roof.position.set(-halfL * 0.10, beltY + cabH + 0.02, 0);
    roof.castShadow = true;
    chassis.add(roof);

    // Side mirrors for realistic silhouette from behind
    for (const sz of [-1, 1]) {
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.10, 0.18), bodyMat);
      mirror.position.set(halfL * 0.30, beltY + 0.06, sz * (halfW * 0.96));
      chassis.add(mirror);
    }
  }

  // Front & rear dark bumper valances
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.20, wid * 0.86), darkMat);
  frontBumper.position.set(halfL - 0.02, bodyBaseY + 0.12, 0);
  chassis.add(frontBumper);
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.20, wid * 0.86), darkMat);
  rearBumper.position.set(-halfL + 0.02, bodyBaseY + 0.12, 0);
  chassis.add(rearBumper);

  // Rear license plate detail
  const npcPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.15, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.6 })
  );
  npcPlate.position.set(-halfL - 0.01, bodyBaseY + 0.26, 0);
  chassis.add(npcPlate);

  // Yellow Taxi signature checker side stripes + flipping 3D Roof Sign ("FOR HIRE" -> "BEAT 01:15")
  let taxiSignPivot = null;
  if (kind === 'taxi') {
    const checker = new THREE.Mesh(new THREE.BoxGeometry(len * 0.68, 0.14, wid * 0.98 + 0.04), darkMat);
    checker.position.set(-len * 0.02, bodyBaseY + bodyH * 0.56, 0);
    chassis.add(checker);

    taxiSignPivot = new THREE.Group();
    taxiSignPivot.position.set(-halfL * 0.08, bodyBaseY + bodyH + cabH + 0.30, 0);
    const signBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 1.38), taxiSignMats);
    signBox.castShadow = true;
    taxiSignPivot.add(signBox);
    chassis.add(taxiSignPivot);
  }

  // Police Patrol Car white doors + spinning Red/Blue 3D Lightbar!
  let sirenRedMat = null;
  let sirenBlueMat = null;
  let sirenLight = null;
  if (kind === 'patrol') {
    const doorWhite = new THREE.MeshStandardMaterial({ color: 0xf4f7fc, roughness: 0.4 });
    const doors = new THREE.Mesh(new THREE.BoxGeometry(len * 0.44, bodyH * 0.86, wid * 0.98 + 0.04), doorWhite);
    doors.position.set(-len * 0.04, bodyBaseY + bodyH * 0.50, 0);
    chassis.add(doors);

    const barY = bodyBaseY + bodyH + cabH + 0.12;
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.10, 1.24), darkMat);
    barBase.position.set(cabX, barY, 0);
    chassis.add(barBase);

    sirenRedMat = new THREE.MeshStandardMaterial({ color: 0xff2b4a, emissive: 0xff2b4a, emissiveIntensity: 2.2 });
    sirenBlueMat = new THREE.MeshStandardMaterial({ color: 0x2ca2ff, emissive: 0x2ca2ff, emissiveIntensity: 2.2 });
    const redPod = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.56), sirenRedMat);
    redPod.position.set(cabX, barY + 0.14, -0.32);
    chassis.add(redPod);
    const bluePod = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.56), sirenBlueMat);
    bluePod.position.set(cabX, barY + 0.14, 0.32);
    chassis.add(bluePod);

    sirenLight = new THREE.PointLight(0xff2b4a, 0, 26, 1.6);
    sirenLight.position.set(cabX, barY + 0.7, 0);
    chassis.add(sirenLight);
  }

  // Glowing 3D Headlights & Brake Lights
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff8dc, emissive: 0xffe8a3, emissiveIntensity: 1.5 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0xff2d44, emissive: 0xff1e38, emissiveIntensity: 0.65 });
  for (const sz of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.34), headMat);
    hl.position.set(halfL - 0.01, bodyBaseY + bodyH * 0.46, sz * wid * 0.30);
    chassis.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.17, 0.38), brakeMat);
    tl.position.set(-halfL + 0.01, bodyBaseY + bodyH * 0.58, sz * wid * 0.31);
    chassis.add(tl);
  }

  // 3. Four 3D Wheels resting flush on the asphalt (y = wheelR)!
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1e28, roughness: 0.88, flatShading: true });
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 14);
  wheelGeo.rotateX(Math.PI * 0.5);
  const hubGeo = new THREE.CylinderGeometry(wheelR * 0.54, wheelR * 0.54, wheelW + 0.03, 10);
  hubGeo.rotateX(Math.PI * 0.5);

  const frontPivots = [];
  const wheelMeshes = [];
  const axleX = len * 0.31;
  const trackZ = wid * 0.45;
  const positions = [
    { x: axleX, z: -trackZ, front: true },
    { x: axleX, z: trackZ, front: true },
    { x: -axleX, z: -trackZ, front: false },
    { x: -axleX, z: trackZ, front: false },
  ];

  for (const pos of positions) {
    const pivot = new THREE.Group();
    pivot.position.set(pos.x, wheelR, pos.z);
    const spinGroup = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, chromeMat);
    spinGroup.add(tire);
    spinGroup.add(hub);
    pivot.add(spinGroup);
    root.add(pivot);
    wheelMeshes.push(spinGroup);
    if (pos.front) frontPivots.push(pivot);
  }

  return {
    root,
    chassis,
    frontPivots,
    wheelMeshes,
    brakeMat,
    taxiSignPivot,
    sirenRedMat,
    sirenBlueMat,
    sirenLight,
    wheelR,
    spin: 0,
  };
}

export function createScene3D(canvas, city) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyMid);
  scene.fog = new THREE.FogExp2(0xf0c794, 0.0021);

  const camera = new THREE.PerspectiveCamera(56, window.innerWidth / Math.max(1, window.innerHeight), 0.4, 950);

  // ------------------------------------------------------------------ SKY & SIDE SUNLIGHT
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(720, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false })
  );
  scene.add(skyDome);

  // Glowing golden 6:00 PM Sun Disc low in the West (-X)!
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(26, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff0b8, fog: false })
  );
  scene.add(sunDisc);

  const hemiLight = new THREE.HemisphereLight(0x9eeef0, 0x6b584c, 0.96);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xffedd6, 0.25);
  scene.add(ambientLight);

  // Golden-hour Side Sunlight casting crisp shadows across roads, cars & turquoise buildings!
  const sunLight = new THREE.DirectionalLight(0xffe1a8, 2.0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 320;
  const shadowSpan = 105;
  sunLight.shadow.camera.left = -shadowSpan;
  sunLight.shadow.camera.right = shadowSpan;
  sunLight.shadow.camera.top = shadowSpan;
  sunLight.shadow.camera.bottom = -shadowSpan;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // ------------------------------------------------------------------ OCEAN, ROADS & RAISED SIDEWALKS
  const asphaltTex = makeAsphaltTexture();
  const cobbleTex = makeCobbleTexture();
  const checkerTex = makeCheckerTexture();
  const contactShadowTex = makeContactShadowTexture();

  // Bright turquoise coastal ocean surrounding South & East harbor
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1ea3b8,
    roughness: 0.24,
    metalness: 0.22,
    flatShading: true,
  });
  const waterPlane = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1400), waterMat);
  waterPlane.rotation.x = -Math.PI * 0.5;
  waterPlane.position.set(to3X(2800), -0.45, to3Z(2400));
  waterPlane.receiveShadow = true;
  scene.add(waterPlane);

  // Solid Landmass Asphalt Base (roads sit cleanly at y = 0.0!)
  const landW = to3X(WORLD.waterEastX);
  const landH = to3Z(WORLD.waterSouthY);
  const roadBase = new THREE.Mesh(
    new THREE.BoxGeometry(landW, 1.2, landH),
    new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.88, metalness: 0.04 })
  );
  roadBase.position.set(landW * 0.5, -0.6, landH * 0.5);
  roadBase.receiveShadow = true;
  scene.add(roadBase);

  // Raised concrete seawall promenade along South & East waterfront (clearly raised y = 0.34m!)
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xe3d8c5, roughness: 0.86, flatShading: true });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xc2b5a0, roughness: 0.9, flatShading: true });

  const southPromenade = new THREE.Mesh(new THREE.BoxGeometry(landW, 0.34, 5.2), sidewalkMat);
  southPromenade.position.set(landW * 0.5, 0.17, to3Z(WORLD.waterSouthY) - 2.6);
  southPromenade.receiveShadow = true;
  southPromenade.castShadow = true;
  scene.add(southPromenade);

  const eastPromenade = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.34, landH), sidewalkMat);
  eastPromenade.position.set(to3X(WORLD.waterEastX) - 2.6, 0.17, landH * 0.5);
  eastPromenade.receiveShadow = true;
  eastPromenade.castShadow = true;
  scene.add(eastPromenade);

  // Scenic low northern & western cliff walls framing the city boundary
  const borderWallMat = new THREE.MeshStandardMaterial({ color: 0xd9cbb5, roughness: 0.9, flatShading: true });
  const northRidge = new THREE.Mesh(new THREE.BoxGeometry(landW, 3.2, 16), borderWallMat);
  northRidge.position.set(landW * 0.5, 1.6, to3Z(WORLD.northWallY) - 9);
  northRidge.receiveShadow = true;
  scene.add(northRidge);
  const westRidge = new THREE.Mesh(new THREE.BoxGeometry(16, 3.2, landH), borderWallMat);
  westRidge.position.set(to3X(WORLD.westWallX) - 9, 1.6, landH * 0.5);
  westRidge.receiveShadow = true;
  scene.add(westRidge);

  // Cobblestone Shortcut Alley Surface Overlays + Golden Dashed Lane Markings + Crosswalks
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf7d279 });
  const whiteMarkMat = new THREE.MeshBasicMaterial({ color: 0xf0ece4 });
  const alleyBorderMat = new THREE.MeshBasicMaterial({ color: 0xf7c12c });

  for (let i = 0; i < city.roads.length; i += 1) {
    const r = city.roads[i];
    const rc = r.rect;
    const rw = rc.w * S;
    const rh = rc.h * S;
    const cx = (rc.x + rc.w * 0.5) * S;
    const cz = (rc.y + rc.h * 0.5) * S;

    if (r.kind === 'alley') {
      const aTex = cobbleTex.clone();
      aTex.needsUpdate = true;
      aTex.repeat.set(Math.max(1, rw / 4.5), Math.max(1, rh / 4.5));
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(rw, rh),
        new THREE.MeshStandardMaterial({ map: aTex, roughness: 0.92 })
      );
      mesh.rotation.x = -Math.PI * 0.5;
      mesh.position.set(cx, 0.02, cz);
      mesh.receiveShadow = true;
      scene.add(mesh);

      // Warm amber curb strips signaling shortcut alley
      const horiz = r.y1 === r.y2;
      const lenM = (horiz ? Math.abs(r.x2 - r.x1) : Math.abs(r.y2 - r.y1)) * S;
      const halfW = r.width * S * 0.45;
      for (const side of [-1, 1]) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? lenM : 0.28, horiz ? 0.28 : lenM), alleyBorderMat);
        line.rotation.x = -Math.PI * 0.5;
        line.position.set(cx + (horiz ? 0 : side * halfW), 0.032, cz + (horiz ? side * halfW : 0));
        scene.add(line);
      }
      continue;
    }

    // Center dashed lane lines on major avenues & coastal highway
    const horiz = r.y1 === r.y2;
    const segLen = horiz ? Math.abs(r.x2 - r.x1) : Math.abs(r.y2 - r.y1);
    const start = horiz ? Math.min(r.x1, r.x2) : Math.min(r.y1, r.y2);
    for (let d = 55; d < segLen - 45; d += 72) {
      const px = horiz ? start + d : r.x1;
      const py = horiz ? r.y1 : start + d;
      // Keep dashes cleanly out of Citrus Plaza Roundabout island
      if (Math.hypot(px - ROUNDABOUT.x, py - ROUNDABOUT.y) < ROUNDABOUT.outerRadius) continue;
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(horiz ? 3.2 : 0.32, horiz ? 0.32 : 3.2),
        dashMat
      );
      dash.rotation.x = -Math.PI * 0.5;
      dash.position.set(to3X(px), 0.028, to3Z(py));
      scene.add(dash);
    }
  }

  // Crisp white zebra crosswalks at major intersections
  for (let i = 0; i < city.graph.nodes.length; i += 1) {
    const n = city.graph.nodes[i];
    if (n.adj.length < 3) continue;
    if (!n.adj.some((e) => e.kind === 'avenue' || e.kind === 'coastal')) continue;
    if (Math.hypot(n.x - ROUNDABOUT.x, n.y - ROUNDABOUT.y) < 40) continue;
    for (let k = 0; k < n.adj.length; k += 1) {
      const e = n.adj[k];
      if (e.kind === 'alley') continue;
      const other = city.graph.nodes[e.to];
      const dx = Math.sign(other.x - n.x);
      const dy = Math.sign(other.y - n.y);
      const dist = 78;
      for (let s = -40; s <= 40; s += 20) {
        const bar = new THREE.Mesh(
          new THREE.PlaneGeometry(dx !== 0 ? 1.9 : 0.85, dx !== 0 ? 0.85 : 1.9),
          whiteMarkMat
        );
        bar.rotation.x = -Math.PI * 0.5;
        bar.position.set(to3X(n.x + dx * dist + (dy !== 0 ? s : 0)), 0.03, to3Z(n.y + dy * dist + (dx !== 0 ? s : 0)));
        scene.add(bar);
      }
    }
  }

  // Garage 06 Paved Forecourt & Checkered Finish Strip
  const gf = GARAGE_FORECOURT;
  const forecourtMesh = new THREE.Mesh(
    new THREE.BoxGeometry(gf.w * S, 0.06, gf.h * S),
    new THREE.MeshStandardMaterial({ color: 0xbcb09d, roughness: 0.85 })
  );
  forecourtMesh.position.set((gf.x + gf.w * 0.5) * S, 0.03, (gf.y + gf.h * 0.5) * S);
  forecourtMesh.receiveShadow = true;
  scene.add(forecourtMesh);

  const finishStripTex = checkerTex.clone();
  finishStripTex.needsUpdate = true;
  finishStripTex.repeat.set(1, 5);
  const finishStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, (FINISH_GATE.archY2 - FINISH_GATE.archY1) * S),
    new THREE.MeshBasicMaterial({ map: finishStripTex })
  );
  finishStrip.rotation.x = -Math.PI * 0.5;
  finishStrip.position.set(to3X(FINISH_GATE.archX), 0.036, to3Z(FINISH_GATE.y));
  scene.add(finishStrip);

  // ------------------------------------------------------------------ CITRUS PLAZA ROUNDABOUT & GIANT ORANGE STATUE!
  const rbX = to3X(ROUNDABOUT.x);
  const rbZ = to3Z(ROUNDABOUT.y);
  const rbOuterM = ROUNDABOUT.outerRadius * S;
  const rbIslandM = ROUNDABOUT.islandRadius * S;

  // Circular asphalt plaza ring + crisp white outer roundabout lane ring
  const plazaAsphalt = new THREE.Mesh(
    new THREE.CircleGeometry(rbOuterM, 36),
    new THREE.MeshStandardMaterial({ color: 0x383d4a, roughness: 0.86 })
  );
  plazaAsphalt.rotation.x = -Math.PI * 0.5;
  plazaAsphalt.position.set(rbX, 0.015, rbZ);
  plazaAsphalt.receiveShadow = true;
  scene.add(plazaAsphalt);

  const plazaRing = new THREE.Mesh(
    new THREE.RingGeometry(rbIslandM + 5.2, rbIslandM + 5.7, 36),
    new THREE.MeshBasicMaterial({ color: 0xf7e3a8 })
  );
  plazaRing.rotation.x = -Math.PI * 0.5;
  plazaRing.position.set(rbX, 0.03, rbZ);
  scene.add(plazaRing);

  // Raised circular roundabout stone island + lush turf
  const islandCurb = new THREE.Mesh(
    new THREE.CylinderGeometry(rbIslandM, rbIslandM + 0.35, 0.45, 24),
    sidewalkMat
  );
  islandCurb.position.set(rbX, 0.225, rbZ);
  islandCurb.receiveShadow = true;
  islandCurb.castShadow = true;
  scene.add(islandCurb);

  const islandGrass = new THREE.Mesh(
    new THREE.CylinderGeometry(rbIslandM - 0.55, rbIslandM - 0.35, 0.32, 20),
    new THREE.MeshStandardMaterial({ color: 0x45b868, roughness: 0.85, flatShading: true })
  );
  islandGrass.position.set(rbX, 0.52, rbZ);
  islandGrass.receiveShadow = true;
  scene.add(islandGrass);

  // Tiered bright cream & coral octagonal pedestal
  const ped1 = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 4.0, 1.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xf7efe0, roughness: 0.65, flatShading: true })
  );
  ped1.position.set(rbX, 1.32, rbZ);
  ped1.castShadow = true;
  ped1.receiveShadow = true;
  scene.add(ped1);

  const ped2 = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 3.1, 1.8, 8),
    new THREE.MeshStandardMaterial({ color: 0xff6358, roughness: 0.52, flatShading: true })
  );
  ped2.position.set(rbX, 2.85, rbZ);
  ped2.castShadow = true;
  scene.add(ped2);

  // GIANT BRIGHT LOW-POLY ORANGE STATUE (iconic directional landmark visible blocks away!)
  const orangeMonument = new THREE.Group();
  orangeMonument.position.set(rbX, 7.6, rbZ);

  const orangeMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(4.4, 1),
    new THREE.MeshStandardMaterial({
      color: 0xff8811,
      emissive: 0xff5a00,
      emissiveIntensity: 0.16,
      roughness: 0.36,
      metalness: 0.06,
      flatShading: true,
    })
  );
  orangeMesh.scale.set(1.06, 0.96, 1.06);
  orangeMesh.castShadow = true;
  orangeMesh.receiveShadow = true;
  orangeMonument.add(orangeMesh);

  // Woody brown stem + two oversized bright emerald low-poly citrus leaves!
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.38, 1.8, 7),
    new THREE.MeshStandardMaterial({ color: 0x5c3d24, roughness: 0.85, flatShading: true })
  );
  stem.position.set(0, 4.6, 0);
  stem.rotation.z = 0.16;
  stem.castShadow = true;
  orangeMonument.add(stem);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2ec768, roughness: 0.45, flatShading: true });
  const leafGeo = new THREE.ConeGeometry(1.35, 3.8, 5);
  const leaf1 = new THREE.Mesh(leafGeo, leafMat);
  leaf1.position.set(1.45, 5.1, 0.3);
  leaf1.rotation.set(0.2, 0.3, -1.05);
  leaf1.scale.set(1, 1, 0.36);
  leaf1.castShadow = true;
  orangeMonument.add(leaf1);

  const leaf2 = new THREE.Mesh(leafGeo, leafMat);
  leaf2.position.set(-1.35, 4.85, -0.4);
  leaf2.rotation.set(-0.25, -0.4, 1.12);
  leaf2.scale.set(0.88, 0.88, 0.34);
  leaf2.castShadow = true;
  orangeMonument.add(leaf2);

  scene.add(orangeMonument);

  // ------------------------------------------------------------------ BRIGHT LOW-POLY TURQUOISE BUILDINGS + RAISED SIDEWALKS
  const facadeCache = new Map();
  function getFacadeMat(colorHex, seedBucket) {
    const key = `${colorHex}_${seedBucket}`;
    let m = facadeCache.get(key);
    if (!m) {
      const tex = makeFacadeTexture(colorHex, seedBucket * 7 + 3);
      m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0.06 });
      facadeCache.set(key, m);
    }
    return m;
  }

  let garageSignMesh = null;
  let lastGarageBest = -1;

  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    const bw = b.w * S;
    const bd = b.h * S;
    const bh = b.heightM;
    const bx = (b.x + b.w * 0.5) * S;
    const bz = (b.y + b.h * 0.5) * S;

    // 1. Raised 3D Sidewalk Slab (0.30 m higher than asphalt, cleanly hugging road curbs!)
    const padM = 13 * S;
    const swMesh = new THREE.Mesh(new THREE.BoxGeometry(bw + padM * 2, 0.30, bd + padM * 2), sidewalkMat);
    swMesh.position.set(bx, 0.15, bz);
    swMesh.receiveShadow = true;
    swMesh.castShadow = true;
    scene.add(swMesh);

    if (b.kind === 'garage') {
      // Hero Garage 06 Workshop Building!
      const wallMat = new THREE.MeshStandardMaterial({ color: b.wallColor, roughness: 0.6, flatShading: true });
      const roofMat = new THREE.MeshStandardMaterial({ color: b.roofColor, roughness: 0.68, flatShading: true });
      const coralMat = new THREE.MeshStandardMaterial({ color: PALETTE.coralGate, roughness: 0.52, flatShading: true });

      const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), wallMat);
      body.position.set(bx, 0.30 + bh * 0.5, bz);
      body.castShadow = true;
      body.receiveShadow = true;
      scene.add(body);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.8, 0.9, bd + 0.8), roofMat);
      roof.position.set(bx, 0.30 + bh + 0.45, bz);
      roof.castShadow = true;
      scene.add(roof);

      // Coral-striped canopy awning facing South over the Garage Forecourt!
      const awning = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.4, 0.45, 3.2), coralMat);
      awning.position.set(bx, 4.9, bz + bd * 0.5 + 1.4);
      awning.rotation.x = 0.18;
      awning.castShadow = true;
      scene.add(awning);

      // 3 warm glowing open garage service bays facing the forecourt!
      const bayMat = new THREE.MeshStandardMaterial({
        color: 0xffd27a,
        emissive: 0xffa83b,
        emissiveIntensity: 0.95,
      });
      for (let bay = -1; bay <= 1; bay += 1) {
        const bayMesh = new THREE.Mesh(new THREE.BoxGeometry(8.5, 4.2, 0.4), bayMat);
        bayMesh.position.set(bx + bay * 12.6, 2.4, bz + bd * 0.5 + 0.08);
        scene.add(bayMesh);
      }

      // Giant Illuminated Rooftop Signboard ("GARAGE 06") facing Sunset Boulevard!
      const signTex = makeSignTexture('GARAGE 06', 'TARGET 01:15.00', '#182230', '#f7c12c', '#f7c12c', '#ffffff');
      const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.45 });
      garageSignMesh = new THREE.Mesh(new THREE.BoxGeometry(24, 6.2, 0.8), [
        roofMat, roofMat, roofMat, roofMat, signMat, signMat,
      ]);
      garageSignMesh.position.set(bx, 0.30 + bh + 4.0, bz + bd * 0.5 - 1.2);
      garageSignMesh.castShadow = true;
      scene.add(garageSignMesh);
      continue;
    }

    if (b.kind === 'container') {
      const cMat = new THREE.MeshStandardMaterial({ color: b.wallColor, roughness: 0.55, flatShading: true });
      const box = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), cMat);
      box.position.set(bx, 0.30 + bh * 0.5, bz);
      box.castShadow = true;
      box.receiveShadow = true;
      scene.add(box);
      continue;
    }

    // Standard & Downtown Turquoise Low-Poly Buildings with textured facades & roofs!
    const fMat = getFacadeMat(b.wallColor, b.windowSeed % 4);
    const rMat = new THREE.MeshStandardMaterial({ color: b.roofColor, roughness: 0.72, flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), [
      fMat, fMat, rMat, rMat, fMat, fMat,
    ]);
    body.position.set(bx, 0.30 + bh * 0.5, bz);
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);

    // Architectural stepped parapet / pitched roof cap
    if (b.kind === 'marketHall') {
      const ridge = new THREE.Mesh(new THREE.ConeGeometry(Math.min(bw, bd) * 0.72, 4.4, 4), rMat);
      ridge.rotation.y = Math.PI * 0.25;
      ridge.position.set(bx, 0.30 + bh + 2.2, bz);
      ridge.castShadow = true;
      scene.add(ridge);
    } else {
      const crown = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.94, 0.75, bd * 0.94), rMat);
      crown.position.set(bx, 0.30 + bh + 0.37, bz);
      crown.castShadow = true;
      scene.add(crown);

      if (b.kind === 'tower') {
        const penthouse = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.56, 3.6, bd * 0.56), fMat);
        penthouse.position.set(bx, 0.30 + bh + 2.1, bz);
        penthouse.castShadow = true;
        scene.add(penthouse);
      }
    }

    // Colorful coral/gold street-level awnings on market & harbor storefronts
    if (b.hasAwnings) {
      const awnMat = new THREE.MeshStandardMaterial({ color: b.accentColor, roughness: 0.58, flatShading: true });
      const awn = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.88, 0.28, 1.9), awnMat);
      awn.position.set(bx, 3.6, bz + bd * 0.5 + 0.85);
      awn.rotation.x = 0.24;
      awn.castShadow = true;
      scene.add(awn);
    }
  }

  // ------------------------------------------------------------------ 3D DRIVE-THROUGH CORAL CHECKPOINT GATES!
  const coralMat = new THREE.MeshStandardMaterial({ color: PALETTE.coralGate, roughness: 0.44, flatShading: true });
  const coralTrimMat = new THREE.MeshStandardMaterial({ color: 0xfff3e2, roughness: 0.5, flatShading: true });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e2533, roughness: 0.55, flatShading: true });

  const gateObjects = city.checkpoints.map((cp) => {
    const gx = to3X(cp.x);
    const gz = to3Z(cp.y);
    const group = new THREE.Group();
    group.position.set(gx, 0, gz);

    const isRoundabout = cp.style === 'roundabout';
    const pillarOff = isRoundabout ? rbOuterM * 0.86 : 10.6;
    const gateH = isRoundabout ? 12.2 : 9.4;

    if (!isRoundabout) {
      // 4-Pillar Coral Crossing Pavilion — drive right THROUGH from ANY direction!
      const pGeo = new THREE.BoxGeometry(1.35, gateH, 1.35);
      const baseGeo = new THREE.BoxGeometry(2.0, 0.9, 2.0);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const p = new THREE.Mesh(pGeo, coralMat);
          p.position.set(sx * pillarOff, gateH * 0.5, sz * pillarOff);
          p.castShadow = true;
          group.add(p);

          const base = new THREE.Mesh(baseGeo, coralTrimMat);
          base.position.set(sx * pillarOff, 0.45, sz * pillarOff);
          group.add(base);
        }
      }

      // 4 overhead coral arch beams forming an unmistakable 3D Coral Gate Frame on ALL 4 sides!
      const beamSpan = pillarOff * 2 + 1.4;
      const beamX = new THREE.BoxGeometry(beamSpan, 1.15, 1.15);
      const beamZ = new THREE.BoxGeometry(1.15, 1.15, beamSpan);
      for (const s of [-1, 1]) {
        const bx = new THREE.Mesh(beamX, coralMat);
        bx.position.set(0, gateH, s * pillarOff);
        bx.castShadow = true;
        group.add(bx);

        const bz = new THREE.Mesh(beamZ, coralMat);
        bz.position.set(s * pillarOff, gateH, 0);
        bz.castShadow = true;
        group.add(bz);
      }

      // Central suspended overhead signal crossbars
      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(beamSpan, 0.45, 0.45), darkMetalMat);
      cross1.position.set(0, gateH - 0.6, 0);
      group.add(cross1);
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, beamSpan), darkMetalMat);
      cross2.position.set(0, gateH - 0.6, 0);
      group.add(cross2);
    } else {
      // Citrus Plaza Roundabout: 4 Coral Entry Archways framing the Giant Orange Roundabout!
      const archDist = rbOuterM - 0.8;
      for (let k = 0; k < 4; k += 1) {
        const ang = (k * Math.PI) / 2;
        const arch = new THREE.Group();
        arch.rotation.y = ang;
        arch.position.set(Math.sin(ang) * archDist, 0, Math.cos(ang) * archDist);
        for (const s of [-1, 1]) {
          const pil = new THREE.Mesh(new THREE.BoxGeometry(1.1, 8.2, 1.1), coralMat);
          pil.position.set(s * 7.8, 4.1, 0);
          pil.castShadow = true;
          arch.add(pil);
        }
        const top = new THREE.Mesh(new THREE.BoxGeometry(16.8, 1.1, 1.1), coralMat);
        top.position.set(0, 8.2, 0);
        top.castShadow = true;
        arch.add(top);
        group.add(arch);
      }
    }

    // 4-sided Central 3D Traffic Light Housing (RED | AMBER | GREEN bulbs visible from every road!)
    const sigY = isRoundabout ? 15.8 : gateH - 1.5;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.75, 4.6), darkMetalMat);
    housing.position.set(0, sigY, 0);
    housing.castShadow = true;
    group.add(housing);

    const redMat = new THREE.MeshStandardMaterial({ color: 0x4a1620, emissive: 0xff3b4e, emissiveIntensity: 0.1 });
    const amberMat = new THREE.MeshStandardMaterial({ color: 0x4d3412, emissive: 0xffb627, emissiveIntensity: 0.1 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x13422b, emissive: 0x2ee58a, emissiveIntensity: 0.1 });
    const bulbGeo = new THREE.SphereGeometry(0.52, 10, 8);

    const bulbDefs = [
      { off: -1.35, mat: redMat },
      { off: 0, mat: amberMat },
      { off: 1.35, mat: greenMat },
    ];
    // Mount 3 bulbs on all 4 horizontal faces of the central housing!
    for (const face of [0, 1, 2, 3]) {
      const fGroup = new THREE.Group();
      fGroup.position.set(0, sigY, 0);
      fGroup.rotation.y = face * Math.PI * 0.5;
      for (const bd of bulbDefs) {
        const b = new THREE.Mesh(bulbGeo, bd.mat);
        b.position.set(bd.off, 0, 2.32);
        fGroup.add(b);
      }
      group.add(fGroup);
    }

    // Bold floating Checkpoint Sign Header ("#1 OLD MARKET" .. "#6 SIXTH CROSSING") proudly crowning the Coral Arch!
    const signTex = makeSignTexture(`#${cp.id} ${cp.name}`, null, '#ff6358', '#fff3e2', '#ffffff', '#ffffff', 512, 112);
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.25 });
    const signBox = new THREE.Mesh(new THREE.BoxGeometry(10.5, 2.3, 1.2), [
      coralMat, coralMat, coralMat, coralMat, signMat, signMat,
    ]);
    signBox.position.set(0, isRoundabout ? 18.4 : gateH + 1.85, 0);
    group.add(signBox);

    // Ground glow ring & vertical active target beacon beam (lights up ONLY for the current next checkpoint!)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x2ee58a, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(isRoundabout ? rbOuterM - 2.6 : 6.4, isRoundabout ? rbOuterM - 0.6 : 8.2, 32), ringMat);
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.y = 0.05;
    group.add(ring);

    const beamMat = new THREE.MeshBasicMaterial({ color: 0x2ee58a, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(isRoundabout ? 7.5 : 4.4, isRoundabout ? 9.0 : 5.2, 58, 16, 1, true), beamMat);
    beam.position.y = 29;
    group.add(beam);

    scene.add(group);
    return { group, redMat, amberMat, greenMat, ringMat, ring, beamMat, beam, signBox };
  });

  // ------------------------------------------------------------------ 3D CORAL & GOLD FINISH ARCH AT GARAGE 06!
  const finishGroup = new THREE.Group();
  finishGroup.position.set(to3X(FINISH_GATE.archX), 0, to3Z(FINISH_GATE.y));
  const finHalfW = (FINISH_GATE.archY2 - FINISH_GATE.archY1) * S * 0.5;
  for (const s of [-1, 1]) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(1.5, 9.8, 1.5), coralMat);
    pil.position.set(0, 4.9, s * finHalfW);
    pil.castShadow = true;
    finishGroup.add(pil);
  }
  const finBannerTex = makeSignTexture('FINISH · GARAGE 06', 'BEAT 01:15.00', '#182230', '#f7c12c', '#2ee58a', '#f7c12c', 512, 128);
  const finBannerMat = new THREE.MeshStandardMaterial({ map: finBannerTex, emissive: 0xffffff, emissiveMap: finBannerTex, emissiveIntensity: 0.35 });
  const finBeam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.8, finHalfW * 2 + 1.8), [
    finBannerMat, finBannerMat, coralMat, coralMat, coralMat, coralMat,
  ]);
  finBeam.position.set(0, 9.6, 0);
  finBeam.castShadow = true;
  finishGroup.add(finBeam);

  const finBeaconMat = new THREE.MeshBasicMaterial({ color: 0xf7c12c, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const finBeacon = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.5, 55, 16, 1, true), finBeaconMat);
  finBeacon.position.y = 27.5;
  finBeacon.visible = false;
  finishGroup.add(finBeacon);
  scene.add(finishGroup);

  // ------------------------------------------------------------------ 3D PALMS, HARBOR CRANES, BOATS & LANTERNS
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7d5840, roughness: 0.9, flatShading: true });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2fa866, roughness: 0.55, flatShading: true });
  const palmGroups = [];
  for (let i = 0; i < city.palms.length; i += 1) {
    const p = city.palms[i];
    const g = new THREE.Group();
    g.position.set(to3X(p.x), 0.3, to3Z(p.y));
    const h = 7.4 * p.scale;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, h, 6), trunkMat);
    trunk.position.y = h * 0.5;
    trunk.rotation.z = 0.08 * Math.sin(p.phase);
    trunk.castShadow = true;
    g.add(trunk);

    const crown = new THREE.Group();
    crown.position.set(Math.sin(p.phase) * 0.25, h, 0);
    for (let f = 0; f < 6; f += 1) {
      const ang = (f / 6) * Math.PI * 2 + p.phase;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.95 * p.scale, 3.6 * p.scale, 4), frondMat);
      frond.position.set(Math.cos(ang) * 1.45 * p.scale, -0.25, Math.sin(ang) * 1.45 * p.scale);
      frond.rotation.order = 'YXZ';
      frond.rotation.y = -ang + Math.PI * 0.5;
      frond.rotation.x = 1.18;
      frond.scale.set(1, 1, 0.28);
      frond.castShadow = true;
      crown.add(frond);
    }
    g.add(crown);
    scene.add(g);
    palmGroups.push({ crown, phase: p.phase });
  }

  // Towering 3D Harbor Dock Cranes overlooking the sea
  for (let i = 0; i < city.cranes.length; i += 1) {
    const c = city.cranes[i];
    const cg = new THREE.Group();
    cg.position.set(to3X(c.x), 0.3, to3Z(c.y));
    if (c.dir === 'east') cg.rotation.y = Math.PI * 0.5;
    const cMat = new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.52, flatShading: true });
    for (const sx of [-1.8, 1.8]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.75, 16, 0.75), cMat);
      leg.position.set(sx, 8, -1.6);
      leg.castShadow = true;
      cg.add(leg);
    }
    const boom = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 22), cMat);
    boom.position.set(0, 15.8, 6.5);
    boom.castShadow = true;
    cg.add(boom);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 3.0), darkMetalMat);
    cab.position.set(0, 14.5, 0);
    cg.add(cab);
    scene.add(cg);
  }

  // Wooden Piers & Bobbing 3D Low-Poly Boats
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8f694e, roughness: 0.88, flatShading: true });
  for (const p of city.piers) {
    const pm = new THREE.Mesh(new THREE.BoxGeometry(p.w * S, 0.45, p.h * S), pierMat);
    pm.position.set((p.x + p.w * 0.5) * S, 0.08, (p.y + p.h * 0.5) * S);
    pm.castShadow = true;
    scene.add(pm);
  }

  const boatMeshes = [];
  for (const b of city.boats) {
    const bg = new THREE.Group();
    bg.position.set(to3X(b.x), -0.1, to3Z(b.y));
    bg.rotation.y = -b.angle;
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(b.length * S, 1.1, b.width * S),
      new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.6, flatShading: true })
    );
    hull.castShadow = true;
    bg.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(b.length * S * 0.42, 1.4, b.width * S * 0.65),
      new THREE.MeshStandardMaterial({ color: b.accent, roughness: 0.52, flatShading: true })
    );
    cabin.position.set(-b.length * S * 0.1, 1.15, 0);
    cabin.castShadow = true;
    bg.add(cabin);
    scene.add(bg);
    boatMeshes.push({ mesh: bg, phase: b.phase, baseAngle: -b.angle });
  }

  // Festive overhead warm golden lanterns over Lantern Alley & Market Alley!
  const lanternBulbGeo = new THREE.SphereGeometry(0.32, 6, 5);
  const lanternGoldMat = new THREE.MeshBasicMaterial({ color: 0xffcc4d });
  const lanternCoralMat = new THREE.MeshBasicMaterial({ color: 0xff6b52 });
  for (const s of city.lanternStrings) {
    for (let k = 1; k <= 4; k += 1) {
      const t = k / 5;
      const lx = to3X(s.x1 + (s.x2 - s.x1) * t);
      const lz = to3Z(s.y1 + (s.y2 - s.y1) * t);
      const sag = Math.sin(t * Math.PI) * 0.85;
      const bulb = new THREE.Mesh(lanternBulbGeo, k % 2 === 0 ? lanternGoldMat : lanternCoralMat);
      bulb.position.set(lx, 6.2 - sag, lz);
      scene.add(bulb);
    }
  }

  // ------------------------------------------------------------------ 3D VEHICLES (PLAYER, TAXI, PATROL, TRAFFIC)
  const taxiHireTex = makeSignTexture('FOR HIRE', null, '#10291c', '#2ee58a', '#4effa8', '#4effa8', 256, 96);
  const taxiBeatTex = makeSignTexture('BEAT 01:15', null, '#291a0a', '#f7c12c', '#ffd44d', '#ffd44d', 256, 96);
  const taxiSideMat = new THREE.MeshStandardMaterial({ color: 0x201c16, roughness: 0.5 });
  const taxiHireMat = new THREE.MeshStandardMaterial({ map: taxiHireTex, emissive: 0xffffff, emissiveMap: taxiHireTex, emissiveIntensity: 0.85 });
  const taxiBeatMat = new THREE.MeshStandardMaterial({ map: taxiBeatTex, emissive: 0xffffff, emissiveMap: taxiBeatTex, emissiveIntensity: 0.95 });
  // Box faces: +X (front/east), -X (rear), +Y (top), -Y (bottom), +Z (right), -Z (left)
  const taxiSignMats = [taxiHireMat, taxiHireMat, taxiSideMat, taxiSideMat, taxiSideMat, taxiSideMat];

  const player3D = buildPlayerRallyHatch3D(contactShadowTex);
  scene.add(player3D.root);

  const taxi3D = buildCar3D({
    lengthSim: TAXI.length,
    widthSim: TAXI.width,
    bodyColor: PALETTE.taxiYellow,
    roofColor: PALETTE.taxiRoof,
    kind: 'taxi',
  }, contactShadowTex, taxiSignMats);
  scene.add(taxi3D.root);

  const patrol3D = buildCar3D({
    lengthSim: PATROL.length,
    widthSim: PATROL.width,
    bodyColor: PALETTE.patrolDark,
    roofColor: PALETTE.patrolWhite,
    kind: 'patrol',
  }, contactShadowTex, null);
  patrol3D.root.visible = false;
  scene.add(patrol3D.root);

  // Commuter rush-hour traffic 3D meshes
  const traffic3D = [];
  function ensureTrafficMeshes(count, list) {
    while (traffic3D.length < count) {
      const c = list[traffic3D.length];
      const m = buildCar3D({
        lengthSim: c.length,
        widthSim: c.width,
        bodyColor: c.body,
        roofColor: c.roof,
        kind: c.kind,
      }, contactShadowTex, null);
      scene.add(m.root);
      traffic3D.push(m);
    }
  }

  // 3D Drift Smoke & Checkpoint Particle Pool (Instanced-style lightweight spheres)
  const pGeo = new THREE.DodecahedronGeometry(0.45, 0);
  const particleMeshes = [];
  for (let i = 0; i < 90; i += 1) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 });
    const m = new THREE.Mesh(pGeo, mat);
    m.visible = false;
    scene.add(m);
    particleMeshes.push(m);
  }

  // ------------------------------------------------------------------ CHASE CAMERA STATE
  let camYaw = Math.PI * 0.5;
  let camPos = new THREE.Vector3(to3X(880), 5.2, to3Z(690) - 11);
  let camLook = new THREE.Vector3(to3X(880), 1.6, to3Z(690) + 14);
  let lastMode = '';
  let lastSimTime = -1;

  function syncCar3D(meshObj, sim, dt, isPlayer) {
    const rx = to3X(sim.x);
    const rz = to3Z(sim.y);
    meshObj.root.position.set(rx, 0, rz);
    meshObj.root.rotation.y = -sim.angle;

    // Tactile 3D suspension body roll when cornering/drifting + pitch on throttle/brake
    if (isPlayer) {
      const targetRoll = Math.max(-0.15, Math.min(0.15, -sim.lateralSpeed * 0.00095));
      const targetPitch = sim.braking ? 0.045 : sim.throttle > 0.2 ? -0.025 : 0;
      meshObj.chassis.rotation.x += (targetRoll - meshObj.chassis.rotation.x) * Math.min(1, dt * 10);
      meshObj.chassis.rotation.z += (targetPitch - meshObj.chassis.rotation.z) * Math.min(1, dt * 10);
      for (const piv of meshObj.frontPivots) {
        piv.rotation.y = -(sim.steerAngle || 0);
      }
      for (const w of meshObj.wheelMeshes) {
        w.rotation.z = -(sim.wheelSpin || 0);
      }
    } else {
      meshObj.spin += ((sim.speed || 0) * S * dt) / meshObj.wheelR;
      for (const w of meshObj.wheelMeshes) {
        w.rotation.z = -meshObj.spin;
      }
    }

    meshObj.brakeMat.emissiveIntensity = sim.braking ? 4.8 : 0.65;
    if (meshObj.brakeHaloMat) {
      meshObj.brakeHaloMat.opacity = sim.braking ? 0.52 : 0.0;
    }
    if (meshObj.brakeLight) {
      meshObj.brakeLight.intensity = sim.braking ? 9.5 : 0;
    }
    if (meshObj.reverseMat) {
      meshObj.reverseMat.emissiveIntensity = sim.reversing ? 3.2 : 0.06;
    }
  }

  function updateChaseCamera(state, dt) {
    const p = state.player;
    const px = to3X(p.x);
    const pz = to3Z(p.y);
    const jumped = state.mode !== lastMode || Math.abs(state.simTime - lastSimTime) > 0.5;
    lastMode = state.mode;
    lastSimTime = state.simTime;

    if (state.mode === MODE_TITLE) {
      // Unobstructed hero 3/4 view from Southwest of Garage 06 framing Yellow Taxi (BEAT 01:15), Crimson Car & Garage!
      const gx = to3X(880);
      const gz = to3Z(660);
      const desiredPos = new THREE.Vector3(gx - 22.0, 7.2, gz + 24.5);
      const desiredLook = new THREE.Vector3(gx + 10.0, 3.6, gz - 8.0);
      if (jumped) {
        camPos.copy(desiredPos);
        camLook.copy(desiredLook);
      } else {
        camPos.lerp(desiredPos, Math.min(1, dt * 4));
        camLook.lerp(desiredLook, Math.min(1, dt * 4));
      }
      camera.fov += (50 - camera.fov) * Math.min(1, dt * 5);
      camera.updateProjectionMatrix();
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      return;
    }

    if (state.mode === MODE_FINISH) {
      // Celebratory 3/4 view framing the car & Coral Finish Arch right outside Garage 06!
      const desiredPos = new THREE.Vector3(px - 15, 7.2, pz + 18);
      const desiredLook = new THREE.Vector3(to3X(900), 3.4, to3Z(650));
      camPos.lerp(desiredPos, Math.min(1, dt * 3.2));
      camLook.lerp(desiredLook, Math.min(1, dt * 3.2));
      camera.fov += (52 - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      return;
    }

    // THIRD-PERSON CHASE CAMERA BEHIND THE CAR (car cleanly framed in lower third of screen!)
    // Blend car heading & velocity direction slightly so cornering & drifting feel buttery smooth!
    let targetYaw = p.angle;
    if (p.speed > 75 && p.forwardSpeed > 25) {
      const velYaw = Math.atan2(p.vy, p.vx);
      const slipDiff = wrapAngle(velYaw - p.angle);
      targetYaw = wrapAngle(p.angle + slipDiff * 0.28);
    }

    if (jumped) {
      camYaw = p.angle;
    } else {
      const yawDiff = wrapAngle(targetYaw - camYaw);
      camYaw = wrapAngle(camYaw + yawDiff * Math.min(1, dt * 6.4));
    }

    const fwdX = Math.cos(camYaw);
    const fwdZ = Math.sin(camYaw);
    const speedRatio = Math.min(1, p.speed / CAR.maxSpeed);

    const chaseDist = 8.9 + speedRatio * 1.35;
    const chaseElev = 3.72 + speedRatio * 0.28;
    const lookAhead = 14.8 + speedRatio * 4.0;

    const desiredPos = new THREE.Vector3(
      px - fwdX * chaseDist,
      chaseElev,
      pz - fwdZ * chaseDist
    );
    const desiredLook = new THREE.Vector3(
      px + fwdX * lookAhead,
      1.68,
      pz + fwdZ * lookAhead
    );

    if (jumped) {
      camPos.copy(desiredPos);
      camLook.copy(desiredLook);
    } else {
      camPos.lerp(desiredPos, Math.min(1, dt * 11.5));
      camLook.lerp(desiredLook, Math.min(1, dt * 14.0));
    }

    // Subtle impact shake on crashes / patrol rams
    const shake = state.shake > 0.2 ? state.shake * 0.045 : 0;
    camera.position.set(
      camPos.x + (shake ? Math.sin(state.simTime * 58) * shake : 0),
      camPos.y + (shake ? Math.cos(state.simTime * 64) * shake * 0.5 : 0),
      camPos.z + (shake ? Math.cos(state.simTime * 51) * shake : 0)
    );

    const desiredFov = state.mode === MODE_COUNTDOWN ? 54 : 56 + speedRatio * 8;
    camera.fov += (desiredFov - camera.fov) * Math.min(1, dt * 5);
    camera.updateProjectionMatrix();
    camera.lookAt(camLook);
  }

  function resize() {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render(state, bestTime, dt) {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    ensureTrafficMeshes(state.traffic.length, state.traffic);

    // 1. Update vehicles in 3D
    syncCar3D(player3D, state.player, safeDt, true);
    syncCar3D(taxi3D, state.taxi, safeDt, false);

    // Flip Yellow Taxi 3D roof sign cleanly upright from "FOR HIRE" -> "BEAT 01:15"!
    if (taxi3D.taxiSignPivot) {
      const flip = state.taxi.signFlip;
      const isBeat = flip >= 0.5;
      const faceMat = isBeat ? taxiBeatMat : taxiHireMat;
      if (taxiSignMats[0] !== faceMat) {
        taxiSignMats[0] = faceMat;
        taxiSignMats[1] = faceMat;
      }
      taxi3D.taxiSignPivot.rotation.y = flip * Math.PI;
    }

    // Police Patrol Car + live flashing Red/Blue 3D Lightbar & PointLight!
    patrol3D.root.visible = state.patrol.active;
    if (state.patrol.active) {
      syncCar3D(patrol3D, state.patrol, safeDt, false);
      const redHot = Math.sin(state.patrol.sirenPhase) > 0;
      patrol3D.sirenRedMat.emissiveIntensity = redHot ? 4.2 : 0.25;
      patrol3D.sirenBlueMat.emissiveIntensity = redHot ? 0.25 : 4.2;
      patrol3D.sirenLight.color.setHex(redHot ? 0xff2b4a : 0x2ca2ff);
      patrol3D.sirenLight.intensity = 18;
    } else if (patrol3D.sirenLight) {
      patrol3D.sirenLight.intensity = 0;
    }

    for (let i = 0; i < state.traffic.length; i += 1) {
      syncCar3D(traffic3D[i], state.traffic[i], safeDt, false);
    }

    // 2. Update 3D Coral Checkpoint Gate Traffic Lights & Active Target Beacon!
    for (let i = 0; i < state.checkpoints.length; i += 1) {
      const cp = state.checkpoints[i];
      const gObj = gateObjects[i];
      const isActive = i === state.nextCpIndex && state.mode !== MODE_TITLE && state.mode !== MODE_FINISH;
      const blinkOff = cp.blinking && Math.floor(state.simTime * 10) % 2 === 0;

      const rOn = cp.color === LIGHT_RED;
      const aOn = cp.color === LIGHT_AMBER;
      const gOn = cp.color === LIGHT_GREEN && !blinkOff;

      gObj.redMat.emissiveIntensity = rOn ? 4.2 : 0.08;
      gObj.amberMat.emissiveIntensity = aOn ? 4.2 : 0.08;
      gObj.greenMat.emissiveIntensity = gOn ? 4.2 : 0.08;

      const sigHex = cp.color === LIGHT_GREEN ? 0x2ee58a : cp.color === LIGHT_AMBER ? 0xffb627 : 0xff3b4e;
      gObj.ringMat.color.setHex(sigHex);
      gObj.ringMat.opacity = isActive ? 0.62 + Math.sin(state.simTime * 6) * 0.18 : 0.16;
      gObj.beam.visible = isActive;
      if (isActive) {
        gObj.beamMat.color.setHex(sigHex);
        gObj.beamMat.opacity = 0.12 + Math.sin(state.simTime * 5) * 0.04;
      }
      // Gently face floating checkpoint sign toward camera for instant readability!
      gObj.signBox.rotation.y = Math.atan2(camera.position.x - gObj.group.position.x, camera.position.z - gObj.group.position.z);
    }

    // Highlight Finish Arch beacon once all 6 checkpoints are cleared
    finBeacon.visible = state.nextCpIndex >= state.checkpoints.length && state.mode !== MODE_TITLE;

    // 3. Update Garage 06 3D rooftop best-record signboard when record changes
    if (garageSignMesh && bestTime !== lastGarageBest) {
      lastGarageBest = bestTime;
      const sub = bestTime > 0 ? `BEST ${Math.floor(bestTime / 60).toString().padStart(2, '0')}:${(bestTime % 60).toFixed(2).padStart(5, '0')}` : 'TARGET 01:15.00';
      const tex = makeSignTexture('GARAGE 06', sub, '#182230', '#f7c12c', '#f7c12c', '#ffffff');
      const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.45 });
      garageSignMesh.material[4] = mat;
      garageSignMesh.material[5] = mat;
    }

    // 4. Animate Giant Orange Statue slight heroic presence, palm breeze & harbor boats
    orangeMonument.rotation.y = state.simTime * 0.22;
    for (let i = 0; i < palmGroups.length; i += 1) {
      palmGroups[i].crown.rotation.z = Math.sin(state.simTime * 1.8 + palmGroups[i].phase) * 0.06;
    }
    for (let i = 0; i < boatMeshes.length; i += 1) {
      const bm = boatMeshes[i];
      bm.mesh.position.y = -0.1 + Math.sin(state.simTime * 1.9 + bm.phase) * 0.18;
      bm.mesh.rotation.z = Math.sin(state.simTime * 1.4 + bm.phase) * 0.04;
    }

    // 5. Sync 3D Drift Smoke & Burst Particles
    let pSlot = 0;
    for (let i = 0; i < state.particles.length && pSlot < particleMeshes.length; i += 1) {
      const p = state.particles[i];
      if (!p.active) continue;
      const m = particleMeshes[pSlot];
      pSlot += 1;
      m.visible = true;
      const lifeRatio = Math.max(0.05, p.life / p.maxLife);
      const scale = Math.max(0.25, p.size * 0.11);
      m.position.set(to3X(p.x), 0.35 + (1 - lifeRatio) * 1.4, to3Z(p.y));
      m.scale.setScalar(scale);
      m.material.opacity = lifeRatio * 0.58;
      if (p.color.startsWith('#')) m.material.color.set(p.color);
      else m.material.color.setHex(0xf2ece1);
    }
    for (let i = pSlot; i < particleMeshes.length; i += 1) {
      particleMeshes[i].visible = false;
    }

    // 6. Update 3D Chase Camera + Move Sky Dome & Side-Sun Shadow Frustum cleanly with player!
    updateChaseCamera(state, safeDt);

    const focusX = to3X(state.player.x);
    const focusZ = to3Z(state.player.y);
    skyDome.position.set(camera.position.x, 0, camera.position.z);
    sunDisc.position.set(camera.position.x - 420, 155, camera.position.z - 110);

    // Side sunlight from the West casting long crisp shadows across the road & under every car!
    sunLight.position.set(focusX - 88, 66, focusZ - 26);
    sunLight.target.position.set(focusX, 0, focusZ);
    sunLight.target.updateMatrixWorld();

    renderer.render(scene, camera);
  }

  /** Project a world (simX, simY, heightM) point into 1280x720 HUD coordinates for crisp 2D beacons! */
  const projVec = new THREE.Vector3();
  function projectToHud(simX, simY, heightM = 6.0) {
    projVec.set(to3X(simX), heightM, to3Z(simY));
    projVec.project(camera);
    return {
      x: (projVec.x * 0.5 + 0.5) * 1280,
      y: (-projVec.y * 0.5 + 0.5) * 720,
      behind: projVec.z > 1.0,
    };
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    render,
    projectToHud,
  };
}
