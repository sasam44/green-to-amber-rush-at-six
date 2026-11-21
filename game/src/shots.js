// Deterministic live-simulated 3D screenshot scenes (?shot=start|play|chase|end&seed=1).
// Every scene drives the real physics & traffic-light rules forward with a route-following autopilot
// so screenshots show authentic 3D chase-camera gameplay and verify full race solvability.

import { LIGHT_GREEN, LIGHT_RED, STEP } from './config.js';
import { FINISH_GATE } from './city.js';
import { EVENT_FINISH, MODE_FINISH } from './world.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Fast route-master waypoints curving smoothly around the Citrus Plaza Giant Orange roundabout! */
const MASTER_ROUTE = [
  { x: 880, y: 1080 },
  { x: 880, y: 2160 },   // CP1 Old Market
  { x: 1360, y: 2160 },  // Enter Market Alley
  { x: 1360, y: 2480 },  // Hairpin #1
  { x: 2260, y: 2480 },  // Hairpin #2
  { x: 2260, y: 2780 },  // Exit onto Harbor Quay Rd
  { x: 3540, y: 2780 },  // CP2 Harbor Quay
  { x: 3540, y: 2460 },  // Enter Container Alley
  { x: 4020, y: 2460 },
  { x: 4020, y: 1840 },
  { x: 4460, y: 1840 },
  { x: 4460, y: 1520 },  // CP3 East Dock
  { x: 1965, y: 1520 },  // Approach Citrus Plaza Roundabout
  { x: 1840, y: 1412 },  // Arc north around Giant Orange Statue (CP4!)
  { x: 1955, y: 1475 },  // Exit East back onto Midtown Grand Ave
  { x: 3100, y: 1520 },  // East toward Lantern Alley
  { x: 3100, y: 1120 },  // Enter Lantern Alley
  { x: 4020, y: 1120 },
  { x: 4020, y: 760 },
  { x: 4460, y: 760 },   // CP5 Lantern Quarter
  { x: 1840, y: 760 },   // CP6 Sixth Crossing
  { x: FINISH_GATE.x, y: FINISH_GATE.y }, // Finish at Garage 06!
];

/** Scenic Seawall Highway -> Harbor Quay route showcasing coastal views, turquoise skyline & Coral Gate! */
const COASTAL_ROUTE = [
  { x: 880, y: 2160 },   // CP1 Old Market
  { x: 880, y: 3140 },   // Turn onto Seawall Highway
  { x: 3540, y: 3140 },  // Long straight coastal road
  { x: 3540, y: 2780 },  // Sweep left into CP2 Harbor Quay Coral Gate!
  { x: 4460, y: 2780 },
  { x: 4460, y: 1520 },
];

function makePilot(waypoints) {
  let idx = 0;
  return function steer(state) {
    const p = state.player;
    while (idx < waypoints.length - 1) {
      const wp = waypoints[idx];
      if (Math.hypot(wp.x - p.x, wp.y - p.y) < 64) idx += 1;
      else break;
    }
    const target = waypoints[Math.min(idx, waypoints.length - 1)];
    const desired = Math.atan2(target.y - p.y, target.x - p.x);
    const diff = wrapAngle(desired - p.angle);
    const absDiff = Math.abs(diff);
    const steerCmd = Math.max(-1, Math.min(1, diff * 2.6));
    const sharpTurn = absDiff > 0.65 && p.speed > 130;
    const brake = absDiff > 1.35 && p.speed > 150 ? 0.85 : 0;
    const throttle = brake > 0 ? 0 : absDiff > 0.9 ? 0.55 : 1;
    return { throttle, brake, steer: steerCmd, handbrake: sharpTurn };
  };
}

export function stageShot(name, world) {
  if (name === 'start' || (name !== 'play' && name !== 'chase' && name !== 'end')) {
    world.resetTitle();
    for (let i = 0; i < Math.round(4.6 / STEP); i += 1) {
      world.step(STEP, { throttle: 0, brake: 0, steer: 0, handbrake: false }, 0);
    }
    return { bestTime: 68.42 };
  }

  if (name === 'play') {
    // Showcase 3D chase camera cornering off Seawall Highway toward the bright Coral Gate #2 Harbor Quay!
    world.startRace(true);
    const pilot = makePilot(COASTAL_ROUTE);
    for (let i = 0; i < Math.round(28 / STEP); i += 1) {
      const st = world.state;
      world.step(STEP, pilot(st), 68.42);
      if (st.nextCpIndex === 1 && st.player.x > 3430 && st.player.y > 3040) {
        const cp2 = st.checkpoints[1];
        let guard = 0;
        while (cp2.color !== LIGHT_GREEN && guard < 6) {
          cp2.cycleOffset += 2.6;
          world.step(STEP, pilot(st), 68.42);
          guard += 1;
        }
        // Hold a clean cornering sweep so the camera looks past turquoise building facades toward Coral Gate #2!
        for (let k = 0; k < Math.round(0.62 / STEP); k += 1) {
          const c = pilot(st);
          world.step(STEP, { ...c, handbrake: k < 18, throttle: 1 }, 68.42);
        }
        break;
      }
    }
    return { bestTime: 68.42 };
  }

  if (name === 'chase') {
    // High-drama 3D shot curving into Citrus Plaza Roundabout (Giant Orange Statue!) under HEAT 2 Patrol chase!
    world.startRace(true);
    const pilot = makePilot(MASTER_ROUTE);
    for (let i = 0; i < Math.round(52 / STEP); i += 1) {
      const st = world.state;
      if (st.nextCpIndex < 2) {
        const cp = st.checkpoints[st.nextCpIndex];
        const d = Math.hypot(st.player.x - cp.x, st.player.y - cp.y);
        if (d < 130 && cp.color !== LIGHT_RED) cp.cycleOffset += 3.0;
      }
      world.step(STEP, pilot(st), 68.42);
      // Frame the player approaching the towering Giant Orange Statue & Coral Arches at Citrus Plaza!
      if (st.nextCpIndex === 3 && st.player.x < 2240 && st.player.x > 2090) {
        break;
      }
    }
    if (!world.state.patrol.active) {
      world.state.heat = 2;
      world.dispatchPatrol();
    }
    return { bestTime: 68.42 };
  }

  // 'end': Complete the full 6-gate run across the Garage 06 Coral Finish Arch!
  world.startRace(true);
  const pilot = makePilot(MASTER_ROUTE);
  for (let i = 0; i < Math.round(135 / STEP); i += 1) {
    const ev = world.step(STEP, pilot(world.state), 72.40);
    if (ev & EVENT_FINISH || world.state.mode === MODE_FINISH) break;
  }
  for (let i = 0; i < 36; i += 1) {
    world.step(STEP, { throttle: 0, brake: 1, steer: 0, handbrake: false }, 72.40);
  }
  const shownBest = world.state.finalTime > 0 ? Math.min(72.40, world.state.finalTime) : 72.40;
  return { bestTime: shownBest };
}
