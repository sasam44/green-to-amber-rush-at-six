// Handcrafted open coastal city of Sunset Harbor (5200 x 3800 sim units -> 624m x 456m 3D):
// - Major avenues, coastal Seawall Highway, and 7 cobblestone shortcut alleys
// - Citrus Plaza Roundabout with a Giant Orange Statue landmark at CP4
// - 6 named 3D Coral Traffic-Light Checkpoint Gates + Garage 06 Start/Finish
// - Bright low-poly turquoise buildings with varied heights & facades, verified non-overlapping

import { WORLD } from './config.js';
import { createRandom } from './random.js';

export const SURFACE_SIDEWALK = 0;
export const SURFACE_ASPHALT = 1;
export const SURFACE_COASTAL = 2;
export const SURFACE_ALLEY = 3;
export const SURFACE_FORECOURT = 4;

/** All axis-aligned road segments. Single source of truth for 3D roads, physics, AI, and building clearance. */
const RAW_ROADS = [
  // Horizontal Avenues
  { id: 'y0', name: 'North Ridge Bypass', subtitle: 'Traffic-Free Hill Road', kind: 'street', x1: 360, y1: 300, x2: 4460, y2: 300, width: 110, traffic: false },
  { id: 'y1', name: 'Sunset Boulevard', subtitle: 'Main Northern Arterial', kind: 'avenue', x1: 360, y1: 760, x2: 4460, y2: 760, width: 148, traffic: true },
  { id: 'y2', name: 'Midtown Grand Ave', subtitle: 'Central Business Corridor', kind: 'avenue', x1: 360, y1: 1520, x2: 4460, y2: 1520, width: 144, traffic: true },
  { id: 'y3w', name: 'West Market Street', subtitle: 'Old Market Approach', kind: 'street', x1: 360, y1: 2160, x2: 880, y2: 2160, width: 126, traffic: true },
  { id: 'y3e', name: 'Warehouse Avenue', subtitle: 'Mid-Dock Connector', kind: 'street', x1: 1840, y1: 2160, x2: 4460, y2: 2160, width: 132, traffic: true },
  { id: 'y4', name: 'Harbor Quay Road', subtitle: 'Port District Arterial', kind: 'avenue', x1: 1840, y1: 2780, x2: 4460, y2: 2780, width: 138, traffic: true },
  { id: 'y5', name: 'Seawall Highway', subtitle: 'Long & Straight Coastal Road', kind: 'coastal', x1: 360, y1: 3140, x2: 4460, y2: 3140, width: 156, traffic: true },

  // Vertical Avenues
  { id: 'x0', name: 'West Workshop Lane', subtitle: 'Outer West Bypass', kind: 'street', x1: 360, y1: 300, x2: 360, y2: 3140, width: 114, traffic: false },
  { id: 'x1', name: 'West Main Avenue', subtitle: 'Garage to Old Market', kind: 'avenue', x1: 880, y1: 760, x2: 880, y2: 3140, width: 144, traffic: true },
  { id: 'x2', name: 'Citrus Central Ave', subtitle: 'Sixth Crossing to Citrus Plaza', kind: 'avenue', x1: 1840, y1: 300, x2: 1840, y2: 3140, width: 138, traffic: true },
  { id: 'x3', name: 'Midtown Avenue', subtitle: 'Downtown Spine', kind: 'avenue', x1: 2680, y1: 300, x2: 2680, y2: 3140, width: 144, traffic: true },
  { id: 'x4', name: 'Harbor North Avenue', subtitle: 'Port to Uptown Link', kind: 'avenue', x1: 3540, y1: 300, x2: 3540, y2: 3140, width: 144, traffic: true },
  { id: 'x5', name: 'East Quay Promenade', subtitle: 'Waterfront Dock Highway', kind: 'coastal', x1: 4460, y1: 300, x2: 4460, y2: 3140, width: 148, traffic: true },

  // Shortcut Alley 1: Workshop Alley (Start -> CP1 bypass)
  { id: 'a1a', name: 'Workshop Alley', subtitle: 'Shortcut Alley · Traffic-Free', kind: 'alley', x1: 600, y1: 1100, x2: 880, y2: 1100, width: 82, traffic: false },
  { id: 'a1b', name: 'Workshop Alley', subtitle: 'Shortcut Alley · Traffic-Free', kind: 'alley', x1: 600, y1: 1100, x2: 600, y2: 1840, width: 82, traffic: false },
  { id: 'a1c', name: 'Workshop Alley', subtitle: 'Shortcut Alley · Traffic-Free', kind: 'alley', x1: 600, y1: 1840, x2: 880, y2: 1840, width: 82, traffic: false },

  // Shortcut Alley 2: Market Alley (Old Market -> Harbor Quay short cut with 2 sharp turns!)
  { id: 'a2a', name: 'Market Alley', subtitle: 'Short Alley · Two Sharp Turns', kind: 'alley', x1: 880, y1: 2160, x2: 1360, y2: 2160, width: 84, traffic: false },
  { id: 'a2b', name: 'Market Alley', subtitle: 'Short Alley · Two Sharp Turns', kind: 'alley', x1: 1360, y1: 2160, x2: 1360, y2: 2480, width: 84, traffic: false },
  { id: 'a2c', name: 'Market Alley', subtitle: 'Short Alley · Two Sharp Turns', kind: 'alley', x1: 1360, y1: 2480, x2: 2260, y2: 2480, width: 84, traffic: false },
  { id: 'a2d', name: 'Market Alley', subtitle: 'Short Alley · Two Sharp Turns', kind: 'alley', x1: 2260, y1: 2480, x2: 2260, y2: 2780, width: 84, traffic: false },

  // Shortcut Alley 3: Container Alley (CP2 -> CP3 dockyard cut)
  { id: 'a3a', name: 'Container Alley', subtitle: 'Dockyard Shortcut Alley', kind: 'alley', x1: 3540, y1: 2460, x2: 4020, y2: 2460, width: 82, traffic: false },
  { id: 'a3b', name: 'Container Alley', subtitle: 'Dockyard Shortcut Alley', kind: 'alley', x1: 4020, y1: 1840, x2: 4020, y2: 2460, width: 82, traffic: false },
  { id: 'a3c', name: 'Container Alley', subtitle: 'Dockyard Shortcut Alley', kind: 'alley', x1: 4020, y1: 1840, x2: 4460, y2: 1840, width: 82, traffic: false },

  // Shortcut Alley 4: Arcade Alley (CP3 -> CP4 downtown cut)
  { id: 'a4a', name: 'Arcade Alley', subtitle: 'Downtown Arcade Shortcut', kind: 'alley', x1: 4020, y1: 1520, x2: 4020, y2: 1840, width: 82, traffic: false },
  { id: 'a4b', name: 'Arcade Alley', subtitle: 'Downtown Arcade Shortcut', kind: 'alley', x1: 3100, y1: 1840, x2: 4020, y2: 1840, width: 82, traffic: false },
  { id: 'a4c', name: 'Arcade Alley', subtitle: 'Downtown Arcade Shortcut', kind: 'alley', x1: 3100, y1: 1520, x2: 3100, y2: 2160, width: 82, traffic: false },

  // Shortcut Alley 5: Lantern Alley (CP4 -> CP5 illuminated lane)
  { id: 'a5a', name: 'Lantern Alley', subtitle: 'Lantern Quarter Shortcut', kind: 'alley', x1: 3100, y1: 1120, x2: 3100, y2: 1520, width: 82, traffic: false },
  { id: 'a5b', name: 'Lantern Alley', subtitle: 'Lantern Quarter Shortcut', kind: 'alley', x1: 3100, y1: 1120, x2: 4020, y2: 1120, width: 82, traffic: false },
  { id: 'a5c', name: 'Lantern Alley', subtitle: 'Lantern Quarter Shortcut', kind: 'alley', x1: 4020, y1: 760, x2: 4020, y2: 1120, width: 82, traffic: false },

  // Shortcut Alley 6: Old Town Alley (CP5 -> CP6 parallel cut)
  { id: 'a6a', name: 'Old Town Alley', subtitle: 'Old Town Shortcut Alley', kind: 'alley', x1: 2260, y1: 1120, x2: 3100, y2: 1120, width: 82, traffic: false },
  { id: 'a6b', name: 'Old Town Alley', subtitle: 'Old Town Shortcut Alley', kind: 'alley', x1: 2260, y1: 760, x2: 2260, y2: 1120, width: 82, traffic: false },

  // Shortcut Alley 7: Garage Back-Lane (CP6 -> Finish sneaky cut)
  { id: 'a7a', name: 'Garage Back-Lane', subtitle: 'Workshop Rear Shortcut', kind: 'alley', x1: 1400, y1: 590, x2: 1400, y2: 760, width: 80, traffic: false },
  { id: 'a7b', name: 'Garage Back-Lane', subtitle: 'Workshop Rear Shortcut', kind: 'alley', x1: 1050, y1: 590, x2: 1400, y2: 590, width: 80, traffic: false },
];

/** Garage Forecourt open paved lot right in front of Garage 06. */
export const GARAGE_FORECOURT = { x: 690, y: 530, w: 380, h: 160 };

/** The Hero Garage Building (Garage 06) sitting directly north of the forecourt. */
export const GARAGE_BUILDING = { x: 690, y: 405, w: 380, h: 125 };

/** Citrus Plaza Roundabout featuring the towering Giant Orange Statue landmark! */
export const ROUNDABOUT = {
  x: 1840,
  y: 1520,
  outerRadius: 164,
  islandRadius: 48,
};

/** Finish line gate directly in front of Garage 06 on Sunset Boulevard. */
export const FINISH_GATE = {
  x: 960,
  y: 760,
  rx: 74,
  ry: 115,
  archX: 960,
  archY1: 676,
  archY2: 844,
};

/** Start spawn positions at 6:00 PM outside Garage 06. */
export const START_POSE = {
  player: { x: 880, y: 690, angle: Math.PI / 2 },
  taxiIdleStart: { x: 1190, y: 716, angle: Math.PI },
  taxiCurbStop: { x: 768, y: 662, angle: Math.PI },
  taxiRaceStart: { x: 816, y: 734, angle: Math.PI / 2 },
};

/** The 6 numbered 3D Coral Traffic-Light Checkpoints to cross in order. */
export const CHECKPOINT_DEFS = [
  { id: 1, name: 'OLD MARKET', sub: 'Market Crossing', x: 880, y: 2160, radius: 98, cycleOffset: 0.6, cycleScale: 1.0, style: 'cross' },
  { id: 2, name: 'HARBOR QUAY', sub: 'Port Crossing', x: 3540, y: 2780, radius: 98, cycleOffset: 4.9, cycleScale: 1.04, style: 'cross' },
  { id: 3, name: 'EAST DOCK', sub: 'Dockside Gate', x: 4460, y: 1520, radius: 98, cycleOffset: 9.2, cycleScale: 0.96, style: 'cross' },
  { id: 4, name: 'CITRUS PLAZA', sub: 'Giant Orange Roundabout', x: 1840, y: 1520, radius: 158, cycleOffset: 1.9, cycleScale: 1.02, style: 'roundabout' },
  { id: 5, name: 'LANTERN QUARTER', sub: 'East Sunset Gate', x: 4460, y: 760, radius: 98, cycleOffset: 6.4, cycleScale: 0.98, style: 'cross' },
  { id: 6, name: 'SIXTH CROSSING', sub: 'Final Light', x: 1840, y: 760, radius: 98, cycleOffset: 10.2, cycleScale: 1.0, style: 'cross' },
];

/** Curated smooth city route for the Yellow Taxi rival (arcs cleanly around the Giant Orange roundabout). */
export const TAXI_WAYPOINTS = [
  { x: 880, y: 760 },
  { x: 880, y: 2160 },   // CP1 Old Market
  { x: 880, y: 3140 },   // Seawall Highway
  { x: 3540, y: 3140 },  // Long coastal straight
  { x: 3540, y: 2780 },  // CP2 Harbor Quay
  { x: 4460, y: 2780 },  // East Quay approach
  { x: 4460, y: 1520 },  // CP3 East Dock
  { x: 1960, y: 1520 },  // Enter Citrus Plaza roundabout
  { x: 1840, y: 1412 },  // Arc north around Giant Orange Statue (CP4!)
  { x: 1840, y: 760 },   // Up to Sunset Blvd
  { x: 4460, y: 760 },   // CP5 Lantern Quarter
  { x: 1840, y: 760 },   // CP6 Sixth Crossing
  { x: 960, y: 760 },    // Finish at Garage 06!
  { x: 768, y: 662 },    // Pull back to Garage curb
];

function roadRect(seg) {
  const hw = seg.width * 0.5;
  const x = Math.min(seg.x1, seg.x2) - hw;
  const y = Math.min(seg.y1, seg.y2) - hw;
  const w = Math.abs(seg.x2 - seg.x1) + seg.width;
  const h = Math.abs(seg.y2 - seg.y1) + seg.width;
  return { x, y, w, h };
}

function rectsOverlap(a, b, pad = 0) {
  return (
    a.x < b.x + b.w + pad &&
    a.x + a.w + pad > b.x &&
    a.y < b.y + b.h + pad &&
    a.y + a.h + pad > b.y
  );
}

/** Build the exact road intersection graph automatically from RAW_ROADS. */
function buildRoadGraph(roads) {
  const nodeMap = new Map();
  const nodes = [];
  const edges = [];

  function getNode(x, y) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const key = `${rx},${ry}`;
    let id = nodeMap.get(key);
    if (id === undefined) {
      id = nodes.length;
      nodeMap.set(key, id);
      nodes.push({ id, x: rx, y: ry, adj: [] });
    }
    return id;
  }

  for (let i = 0; i < roads.length; i += 1) {
    const r = roads[i];
    const horiz = r.y1 === r.y2;
    const pts = horiz
      ? [Math.min(r.x1, r.x2), Math.max(r.x1, r.x2)]
      : [Math.min(r.y1, r.y2), Math.max(r.y1, r.y2)];

    for (let j = 0; j < roads.length; j += 1) {
      if (i === j) continue;
      const o = roads[j];
      const oHoriz = o.y1 === o.y2;
      if (horiz && !oHoriz) {
        const minX = Math.min(r.x1, r.x2);
        const maxX = Math.max(r.x1, r.x2);
        const minY = Math.min(o.y1, o.y2);
        const maxY = Math.max(o.y1, o.y2);
        if (o.x1 >= minX && o.x1 <= maxX && r.y1 >= minY && r.y1 <= maxY) pts.push(o.x1);
      } else if (!horiz && oHoriz) {
        const minY = Math.min(r.y1, r.y2);
        const maxY = Math.max(r.y1, r.y2);
        const minX = Math.min(o.x1, o.x2);
        const maxX = Math.max(o.x1, o.x2);
        if (o.y1 >= minY && o.y1 <= maxY && r.x1 >= minX && r.x1 <= maxX) pts.push(o.y1);
      } else if (horiz && oHoriz && r.y1 === o.y1) {
        const minX = Math.min(r.x1, r.x2);
        const maxX = Math.max(r.x1, r.x2);
        if (o.x1 >= minX && o.x1 <= maxX) pts.push(o.x1);
        if (o.x2 >= minX && o.x2 <= maxX) pts.push(o.x2);
      } else if (!horiz && !oHoriz && r.x1 === o.x1) {
        const minY = Math.min(r.y1, r.y2);
        const maxY = Math.max(r.y1, r.y2);
        if (o.y1 >= minY && o.y1 <= maxY) pts.push(o.y1);
        if (o.y2 >= minY && o.y2 <= maxY) pts.push(o.y2);
      }
    }

    const uniq = Array.from(new Set(pts.map((v) => Math.round(v)))).sort((a, b) => a - b);
    for (let k = 0; k < uniq.length - 1; k += 1) {
      const a = horiz ? getNode(uniq[k], r.y1) : getNode(r.x1, uniq[k]);
      const b = horiz ? getNode(uniq[k + 1], r.y1) : getNode(r.x1, uniq[k + 1]);
      if (a === b) continue;
      const dist = Math.abs(uniq[k + 1] - uniq[k]);
      const existing = nodes[a].adj.find((e) => e.to === b);
      if (existing) {
        if (r.traffic) existing.traffic = true;
        continue;
      }
      const edge = { a, b, dist, kind: r.kind, traffic: r.traffic, road: r };
      edges.push(edge);
      nodes[a].adj.push({ to: b, dist, kind: r.kind, traffic: r.traffic, road: r });
      nodes[b].adj.push({ to: a, dist, kind: r.kind, traffic: r.traffic, road: r });
    }
  }

  return { nodes, edges };
}

function districtOf(cx, cy) {
  if (cx < 1450 && cy < 1300) return 'garage';
  if (cx < 2100 && cy >= 1300) return 'market';
  if (cy >= 2250 || cx >= 3800) return 'harbor';
  if (cx >= 2800 && cy < 1300) return 'lantern';
  return 'downtown';
}

/** Bright low-poly stylized coastal architecture: turquoise facades, sunny cream trim, coral accents! */
const DISTRICT_STYLES = {
  garage: {
    walls: ['#2db5b0', '#38c7be', '#e8d9c5', '#2a9ea6'],
    roofs: ['#1c7d82', '#d95d4c', '#e6b86a', '#248f96'],
    minH: 8, maxH: 17,
  },
  market: {
    walls: ['#33c4b8', '#f5dec2', '#26aba5', '#ff9b73'],
    roofs: ['#e8624d', '#218b8e', '#f0a648', '#d9534f'],
    minH: 8, maxH: 18,
  },
  harbor: {
    walls: ['#239ea8', '#31bab5', '#dfe8ea', '#1e8a99'],
    roofs: ['#176e7a', '#e86852', '#e0a943', '#23828f'],
    minH: 9, maxH: 20,
  },
  downtown: {
    walls: ['#26bdb6', '#1da5ab', '#3cd1c5', '#289ca8', '#e8f1f0'],
    roofs: ['#1a7c85', '#ff6f61', '#218d96', '#f2b857'],
    minH: 15, maxH: 34,
  },
  lantern: {
    walls: ['#2fb8b0', '#f2dbc0', '#239ca3', '#42ccc2'],
    roofs: ['#e35d52', '#1d828a', '#f2a944', '#268e96'],
    minH: 10, maxH: 22,
  },
};

export function createCity(seed = 1) {
  const rand = createRandom(seed ^ 0x51a7c3);
  const roads = RAW_ROADS.map((r) => ({ ...r, rect: roadRect(r) }));
  const graph = buildRoadGraph(roads);

  const clearZones = [
    ...roads.map((r) => r.rect),
    GARAGE_FORECOURT,
    { x: GARAGE_BUILDING.x - 10, y: GARAGE_BUILDING.y - 10, w: GARAGE_BUILDING.w + 20, h: GARAGE_BUILDING.h + 20 },
    // Keep Citrus Plaza Roundabout completely open around the Giant Orange Statue!
    {
      x: ROUNDABOUT.x - ROUNDABOUT.outerRadius - 24,
      y: ROUNDABOUT.y - ROUNDABOUT.outerRadius - 24,
      w: (ROUNDABOUT.outerRadius + 24) * 2,
      h: (ROUNDABOUT.outerRadius + 24) * 2,
    },
    { x: 0, y: WORLD.waterSouthY - 42, w: WORLD.width, h: WORLD.height - WORLD.waterSouthY + 42 },
    { x: WORLD.waterEastX - 42, y: 1200, w: WORLD.width - WORLD.waterEastX + 42, h: WORLD.height - 1200 },
    { x: 0, y: 0, w: WORLD.width, h: WORLD.northWallY + 24 },
    { x: 0, y: 0, w: WORLD.westWallX + 24, h: WORLD.height },
  ];

  const buildings = [];

  // 1. Hero Garage 06 Building
  buildings.push({
    x: GARAGE_BUILDING.x,
    y: GARAGE_BUILDING.y,
    w: GARAGE_BUILDING.w,
    h: GARAGE_BUILDING.h,
    heightM: 10.5,
    kind: 'garage',
    wallColor: '#259ca3',
    roofColor: '#1b6d75',
    accentColor: '#ff6358',
    windowSeed: 1,
    hasAwnings: true,
    district: 'garage',
  });

  // 2. Old Market Hall (between CP1 Old Market & Market Alley)
  buildings.push({
    x: 1005,
    y: 2248,
    w: 265,
    h: 175,
    heightM: 11.5,
    kind: 'marketHall',
    wallColor: '#f5dfc4',
    roofColor: '#ff6a57',
    accentColor: '#28b5ad',
    windowSeed: 19,
    hasAwnings: true,
    district: 'market',
  });

  // 3. Harbor Shipping Containers (lining Container Alley & East Dock!)
  const containerDefs = [
    { x: 3675, y: 2545, w: 120, h: 46, color: '#ff6358' },
    { x: 3810, y: 2545, w: 120, h: 46, color: '#26b0b5' },
    { x: 3675, y: 2602, w: 120, h: 46, color: '#f5b038' },
    { x: 3810, y: 2602, w: 120, h: 46, color: '#2b7ea3' },
    { x: 4120, y: 2260, w: 46, h: 122, color: '#ff6358' },
    { x: 4178, y: 2260, w: 46, h: 122, color: '#2dc4b0' },
    { x: 4120, y: 2400, w: 46, h: 122, color: '#f5b038' },
    { x: 4178, y: 2400, w: 46, h: 122, color: '#2691a8' },
    { x: 4255, y: 2270, w: 46, h: 120, color: '#e85b4f' },
    { x: 4255, y: 2410, w: 46, h: 120, color: '#2ab3b8' },
    { x: 4120, y: 1950, w: 130, h: 48, color: '#26b0b5' },
    { x: 4120, y: 2010, w: 130, h: 48, color: '#ff6358' },
    { x: 3680, y: 2285, w: 125, h: 48, color: '#f5b038' },
    { x: 3820, y: 2285, w: 115, h: 48, color: '#2dc4b0' },
  ];
  for (const c of containerDefs) {
    if (!clearZones.some((z) => rectsOverlap(c, z, 14))) {
      buildings.push({
        x: c.x, y: c.y, w: c.w, h: c.h,
        heightM: 5.4,
        kind: 'container',
        wallColor: c.color,
        roofColor: c.color,
        accentColor: '#ffffff',
        windowSeed: 0,
        hasAwnings: false,
        district: 'harbor',
      });
    }
  }

  // 4. Procedural Bright Low-Poly Turquoise Buildings (guaranteed zero road/alley overlap!)
  const allOccupied = buildings.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
  const SIDEWALK_PAD = 15;

  function tryPlaceBuilding(rect, kindOverride) {
    if (rect.x + rect.w > WORLD.waterEastX - 42 || rect.y + rect.h > WORLD.waterSouthY - 42) return false;
    if (clearZones.some((z) => rectsOverlap(rect, z, SIDEWALK_PAD))) return false;
    if (allOccupied.some((o) => rectsOverlap(rect, o, 12))) return false;

    const dist = districtOf(rect.x + rect.w * 0.5, rect.y + rect.h * 0.5);
    const st = DISTRICT_STYLES[dist];
    const heightM = st.minH + rand() * (st.maxH - st.minH);
    const wallColor = st.walls[Math.floor(rand() * st.walls.length)];
    const roofColor = st.roofs[Math.floor(rand() * st.roofs.length)];

    allOccupied.push(rect);
    buildings.push({
      ...rect,
      heightM,
      kind: kindOverride ?? (dist === 'downtown' && heightM > 22 ? 'tower' : 'block'),
      wallColor,
      roofColor,
      accentColor: rand() < 0.5 ? '#ff6f61' : '#f7c12c',
      windowSeed: Math.floor(rand() * 10000),
      hasAwnings: (dist === 'market' || dist === 'lantern' || dist === 'harbor') && rand() < 0.55,
      roofDetail: Math.floor(rand() * 4),
      district: dist,
    });
    return true;
  }

  for (let gx = 425; gx < WORLD.waterEastX - 110; gx += 150) {
    for (let gy = 365; gy < WORLD.waterSouthY - 95; gy += 138) {
      const bw = Math.round(86 + rand() * 52);
      const bh = Math.round(74 + rand() * 48);
      const ox = Math.round(rand() * 14);
      const oy = Math.round(rand() * 14);
      if (!tryPlaceBuilding({ x: gx + ox, y: gy + oy, w: bw, h: bh }, null)) {
        tryPlaceBuilding({ x: gx + 6, y: gy + 6, w: 68, h: 62 }, 'shophouse');
      }
    }
  }

  // Coastal strip shophouses between Harbor Quay Rd and Seawall Highway
  for (let cx = 1930; cx < 4360; cx += 116) {
    tryPlaceBuilding({ x: cx, y: 2870, w: 86, h: 158 }, 'shophouse');
  }

  // 5. Harbor Gantry Cranes
  const cranes = [
    { x: 3220, y: 3255, dir: 'south', color: '#ff6f59' },
    { x: 3760, y: 3255, dir: 'south', color: '#f7b731' },
    { x: 4220, y: 3255, dir: 'south', color: '#ff6f59' },
    { x: 4675, y: 2620, dir: 'east', color: '#f7b731' },
    { x: 4675, y: 2040, dir: 'east', color: '#ff6f59' },
    { x: 4675, y: 1580, dir: 'east', color: '#f7b731' },
  ];

  // 6. Moored Harbor Boats
  const boats = [
    { x: 760, y: 3440, angle: 0.08, length: 68, width: 22, color: '#fff8ec', accent: '#ff6358', phase: 0.2 },
    { x: 1420, y: 3410, angle: -0.05, length: 54, width: 18, color: '#fff5e4', accent: '#26b5b0', phase: 1.4 },
    { x: 2150, y: 3490, angle: 0.04, length: 76, width: 24, color: '#eef4f7', accent: '#f7a531', phase: 2.7 },
    { x: 2940, y: 3430, angle: -0.03, length: 96, width: 32, color: '#2b6f84', accent: '#ff6358', phase: 3.9 },
    { x: 3820, y: 3480, angle: 0.02, length: 124, width: 38, color: '#235e73', accent: '#f7b731', phase: 0.9 },
    { x: 4840, y: 2880, angle: Math.PI * 0.5 + 0.04, length: 112, width: 34, color: '#2b6f84', accent: '#ff6358', phase: 2.1 },
    { x: 4860, y: 2220, angle: Math.PI * 0.5 - 0.03, length: 84, width: 26, color: '#fff8ec', accent: '#26b5b0', phase: 4.5 },
    { x: 4835, y: 1680, angle: Math.PI * 0.5 + 0.02, length: 66, width: 22, color: '#fff5e4', accent: '#ff7058', phase: 5.2 },
  ];

  // 7. Wooden Fishing Piers
  const piers = [
    { x: 700, y: 3260, w: 34, h: 145 },
    { x: 1380, y: 3260, w: 30, h: 120 },
    { x: 2100, y: 3260, w: 36, h: 155 },
  ];

  // 8. Coastal & Plaza Palm Trees
  const palms = [];
  for (let px = 440; px <= 4380; px += 195) {
    palms.push({ x: px, y: 3236, scale: 0.92 + rand() * 0.28, phase: rand() * Math.PI * 2 });
  }
  for (let py = 460; py <= 3000; py += 270) {
    palms.push({ x: 4610, y: py, scale: 0.88 + rand() * 0.25, phase: rand() * Math.PI * 2 });
  }
  // Palms framing Garage 06 & Citrus Plaza Roundabout corners!
  palms.push(
    { x: 645, y: 650, scale: 1.05, phase: 0.4 },
    { x: 1110, y: 650, scale: 0.98, phase: 1.9 },
    { x: ROUNDABOUT.x - 142, y: ROUNDABOUT.y - 142, scale: 1.05, phase: 1.1 },
    { x: ROUNDABOUT.x + 142, y: ROUNDABOUT.y - 142, scale: 1.02, phase: 2.4 },
    { x: ROUNDABOUT.x - 142, y: ROUNDABOUT.y + 142, scale: 1.04, phase: 3.7 },
    { x: ROUNDABOUT.x + 142, y: ROUNDABOUT.y + 142, scale: 1.0, phase: 4.9 },
  );

  // 9. Festive Golden Lantern Strings over Lantern Alley & Market Alley
  const lanternStrings = [
    { x1: 3058, y1: 1190, x2: 3142, y2: 1230 },
    { x1: 3058, y1: 1310, x2: 3142, y2: 1350 },
    { x1: 3058, y1: 1420, x2: 3142, y2: 1455 },
    { x1: 3180, y1: 1078, x2: 3220, y2: 1162 },
    { x1: 3320, y1: 1078, x2: 3360, y2: 1162 },
    { x1: 3680, y1: 1078, x2: 3720, y2: 1162 },
    { x1: 3840, y1: 1078, x2: 3880, y2: 1162 },
    { x1: 3978, y1: 860, x2: 4062, y2: 900 },
    { x1: 3978, y1: 980, x2: 4062, y2: 1020 },
    { x1: 1030, y1: 2116, x2: 1070, y2: 2204 },
    { x1: 1180, y1: 2116, x2: 1220, y2: 2204 },
    { x1: 1316, y1: 2260, x2: 1404, y2: 2300 },
    { x1: 1316, y1: 2380, x2: 1404, y2: 2420 },
    { x1: 1500, y1: 2436, x2: 1540, y2: 2524 },
    { x1: 1680, y1: 2436, x2: 1720, y2: 2524 },
    { x1: 1980, y1: 2436, x2: 2020, y2: 2524 },
    { x1: 2130, y1: 2436, x2: 2170, y2: 2524 },
  ];

  // 10. Streetlight Poles along Avenues
  const streetlights = [];
  for (const r of roads) {
    if (r.kind !== 'avenue' && r.kind !== 'coastal') continue;
    const horiz = r.y1 === r.y2;
    const len = horiz ? Math.abs(r.x2 - r.x1) : Math.abs(r.y2 - r.y1);
    const offset = r.width * 0.5 + 14;
    for (let d = 180; d < len - 140; d += 360) {
      const sx = horiz ? Math.min(r.x1, r.x2) + d : r.x1 + offset;
      const sy = horiz ? r.y1 - offset : Math.min(r.y1, r.y2) + d;
      if (Math.hypot(sx - ROUNDABOUT.x, sy - ROUNDABOUT.y) < ROUNDABOUT.outerRadius + 24) continue;
      streetlights.push({ x: sx, y: sy });
    }
  }

  // 11. Spatial Hash Grid for instant building collision lookups
  const GRID = 260;
  const cols = Math.ceil(WORLD.width / GRID);
  const rows = Math.ceil(WORLD.height / GRID);
  const bGrid = new Array(cols * rows);
  for (let i = 0; i < bGrid.length; i += 1) bGrid[i] = [];

  for (let i = 0; i < buildings.length; i += 1) {
    const b = buildings[i];
    const minC = Math.max(0, Math.floor(b.x / GRID));
    const maxC = Math.min(cols - 1, Math.floor((b.x + b.w) / GRID));
    const minR = Math.max(0, Math.floor(b.y / GRID));
    const maxR = Math.min(rows - 1, Math.floor((b.y + b.h) / GRID));
    for (let rr = minR; rr <= maxR; rr += 1) {
      for (let cc = minC; cc <= maxC; cc += 1) {
        bGrid[rr * cols + cc].push(b);
      }
    }
  }

  function queryBuildings(x, y, radius, out) {
    out.length = 0;
    const minC = Math.max(0, Math.floor((x - radius) / GRID));
    const maxC = Math.min(cols - 1, Math.floor((x + radius) / GRID));
    const minR = Math.max(0, Math.floor((y - radius) / GRID));
    const maxR = Math.min(rows - 1, Math.floor((y + radius) / GRID));
    for (let rr = minR; rr <= maxR; rr += 1) {
      for (let cc = minC; cc <= maxC; cc += 1) {
        const bucket = bGrid[rr * cols + cc];
        for (let k = 0; k < bucket.length; k += 1) {
          const b = bucket[k];
          if (!out.includes(b)) out.push(b);
        }
      }
    }
    return out;
  }

  function sampleLocation(x, y) {
    if (Math.hypot(x - ROUNDABOUT.x, y - ROUNDABOUT.y) <= ROUNDABOUT.outerRadius + 10) {
      return { surface: SURFACE_ASPHALT, name: 'Citrus Plaza', subtitle: 'Giant Orange Roundabout', isAlley: false };
    }
    if (
      x >= GARAGE_FORECOURT.x && x <= GARAGE_FORECOURT.x + GARAGE_FORECOURT.w &&
      y >= GARAGE_FORECOURT.y && y <= GARAGE_FORECOURT.y + GARAGE_FORECOURT.h
    ) {
      return { surface: SURFACE_FORECOURT, name: 'Garage 06', subtitle: 'Workshop Forecourt', isAlley: false };
    }
    let best = null;
    for (let i = 0; i < roads.length; i += 1) {
      const r = roads[i];
      const rc = r.rect;
      if (x >= rc.x - 12 && x <= rc.x + rc.w + 12 && y >= rc.y - 12 && y <= rc.y + rc.h + 12) {
        if (!best || (r.kind === 'alley' && best.kind !== 'alley')) {
          best = r;
        }
      }
    }
    if (!best) {
      return { surface: SURFACE_SIDEWALK, name: 'Sunset Harbor', subtitle: 'City Curb', isAlley: false };
    }
    const surface =
      best.kind === 'alley' ? SURFACE_ALLEY :
      best.kind === 'coastal' ? SURFACE_COASTAL : SURFACE_ASPHALT;
    return { surface, name: best.name, subtitle: best.subtitle, isAlley: best.kind === 'alley' };
  }

  function nearestNode(x, y, trafficOnly = false) {
    let bestId = 0;
    let bestD2 = Infinity;
    for (let i = 0; i < graph.nodes.length; i += 1) {
      const n = graph.nodes[i];
      if (trafficOnly && !n.adj.some((e) => e.traffic)) continue;
      const dx = n.x - x;
      const dy = n.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestId = i;
      }
    }
    return bestId;
  }

  function findPath(startId, goalId, alleyWeight = 1.45) {
    const count = graph.nodes.length;
    const dist = new Float64Array(count);
    const prev = new Int32Array(count);
    const seen = new Uint8Array(count);
    dist.fill(Infinity);
    prev.fill(-1);
    dist[startId] = 0;

    for (let iter = 0; iter < count; iter += 1) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < count; i += 1) {
        if (!seen[i] && dist[i] < best) {
          best = dist[i];
          u = i;
        }
      }
      if (u === -1 || u === goalId) break;
      seen[u] = 1;
      const adj = graph.nodes[u].adj;
      for (let k = 0; k < adj.length; k += 1) {
        const e = adj[k];
        const w = e.dist * (e.kind === 'alley' ? alleyWeight : 1.0);
        const alt = dist[u] + w;
        if (alt < dist[e.to]) {
          dist[e.to] = alt;
          prev[e.to] = u;
        }
      }
    }

    if (prev[goalId] === -1 && startId !== goalId) return [startId];
    const path = [];
    let cur = goalId;
    while (cur !== -1) {
      path.push(cur);
      if (cur === startId) break;
      cur = prev[cur];
    }
    path.reverse();
    return path;
  }

  return {
    roads,
    graph,
    buildings,
    cranes,
    boats,
    piers,
    palms,
    lanternStrings,
    streetlights,
    roundabout: ROUNDABOUT,
    checkpoints: CHECKPOINT_DEFS,
    finishGate: FINISH_GATE,
    garageForecourt: GARAGE_FORECOURT,
    garageBuilding: GARAGE_BUILDING,
    queryBuildings,
    sampleLocation,
    nearestNode,
    findPath,
  };
}
