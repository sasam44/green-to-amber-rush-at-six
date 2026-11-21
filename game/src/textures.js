// Pre-baked 2D City Minimap and Full-Screen Route Map canvases (zero external image files).

import { WORLD } from './config.js';
import { ROUNDABOUT } from './city.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function createCityMapCanvas(city, w, h) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;

  // Base city ground
  g.fillStyle = '#182430';
  g.fillRect(0, 0, w, h);

  // Coastal harbor ocean
  g.fillStyle = '#146d82';
  g.fillRect(0, WORLD.waterSouthY * sy, w, h - WORLD.waterSouthY * sy);
  g.fillRect(WORLD.waterEastX * sx, 1200 * sy, w - WORLD.waterEastX * sx, h - 1200 * sy);

  // Golden seawall shoreline
  g.strokeStyle = 'rgba(255, 206, 118, 0.55)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(0, WORLD.waterSouthY * sy);
  g.lineTo(WORLD.waterEastX * sx, WORLD.waterSouthY * sy);
  g.lineTo(WORLD.waterEastX * sx, 1200 * sy);
  g.stroke();

  // Turquoise low-poly building footprints
  g.fillStyle = '#255a66';
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    g.fillRect(b.x * sx, b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  }

  // Major avenues & coastal highway
  for (let i = 0; i < city.roads.length; i += 1) {
    const r = city.roads[i];
    if (r.kind === 'alley') continue;
    g.strokeStyle = r.kind === 'coastal' ? '#56758c' : '#475466';
    g.lineWidth = Math.max(3, r.width * sx);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(r.x1 * sx, r.y1 * sy);
    g.lineTo(r.x2 * sx, r.y2 * sy);
    g.stroke();
  }

  // Shortcut alleys highlighted in dashed warm gold so route options jump off the map!
  for (let i = 0; i < city.roads.length; i += 1) {
    const r = city.roads[i];
    if (r.kind !== 'alley') continue;
    g.strokeStyle = '#9c6c4e';
    g.lineWidth = Math.max(2.4, r.width * sx * 1.15);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(r.x1 * sx, r.y1 * sy);
    g.lineTo(r.x2 * sx, r.y2 * sy);
    g.stroke();

    g.strokeStyle = '#f7c12c';
    g.lineWidth = 1.1;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(r.x1 * sx, r.y1 * sy);
    g.lineTo(r.x2 * sx, r.y2 * sy);
    g.stroke();
    g.setLineDash([]);
  }

  // Citrus Plaza Roundabout & Giant Orange Landmark pip!
  const rbx = ROUNDABOUT.x * sx;
  const rby = ROUNDABOUT.y * sy;
  g.fillStyle = '#475466';
  g.beginPath();
  g.arc(rbx, rby, ROUNDABOUT.outerRadius * sx, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ff8a1f';
  g.beginPath();
  g.arc(rbx, rby, Math.max(3, ROUNDABOUT.islandRadius * sx), 0, Math.PI * 2);
  g.fill();

  // Garage 06 Forecourt
  const fg = city.garageForecourt;
  g.fillStyle = 'rgba(247, 193, 44, 0.45)';
  g.fillRect(fg.x * sx, fg.y * sy, fg.w * sx, fg.h * sy);

  return c;
}

export function createMapTextures(city) {
  return {
    minimap: createCityMapCanvas(city, 224, 164),
    fullmap: createCityMapCanvas(city, 780, 570),
  };
}
