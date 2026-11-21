// Fixed-timestep (60 Hz) simulation for Green to Amber: Rush at Six.
// Zero DOM or Canvas dependencies: deterministic physics, 6 cycling traffic lights,
// Yellow Taxi 6 PM intro & rival run, Heat >= 2 Police Patrol pursuit, and rush-hour traffic.

import {
  CAR,
  GREEN_BONUS,
  LIGHT_AMBER,
  LIGHT_GREEN,
  LIGHT_RED,
  LIGHT_TIMING,
  PARTICLE_POOL,
  PATROL,
  PATROL_HEAT_THRESHOLD,
  SKID_POOL,
  TARGET_TIME,
  TAXI,
  TRAFFIC,
  WORLD,
} from './config.js';
import {
  FINISH_GATE,
  GARAGE_FORECOURT,
  ROUNDABOUT,
  START_POSE,
  SURFACE_ALLEY,
  SURFACE_SIDEWALK,
  TAXI_WAYPOINTS,
} from './city.js';

export const MODE_TITLE = 'title';
export const MODE_COUNTDOWN = 'countdown';
export const MODE_RACE = 'race';
export const MODE_FINISH = 'finish';
export const MODE_FREEROAM = 'freeroam';

export const EVENT_COUNTDOWN_TICK = 1 << 0;
export const EVENT_RACE_START = 1 << 1;
export const EVENT_CP_GREEN = 1 << 2;
export const EVENT_CP_AMBER = 1 << 3;
export const EVENT_CP_RED = 1 << 4;
export const EVENT_PATROL_SPAWN = 1 << 5;
export const EVENT_CRASH = 1 << 6;
export const EVENT_PATROL_RAM = 1 << 7;
export const EVENT_FINISH = 1 << 8;
export const EVENT_HONK = 1 << 9;

const TRAFFIC_COLORS = [
  { body: '#d9d3c7', roof: '#ece8df', kind: 'sedan' },
  { body: '#4c708a', roof: '#698da8', kind: 'sedan' },
  { body: '#5f7868', roof: '#7c9684', kind: 'sedan' },
  { body: '#8f524a', roof: '#aa6c62', kind: 'hatch' },
  { body: '#635c73', roof: '#7e7691', kind: 'sedan' },
  { body: '#c48f47', roof: '#d9a75f', kind: 'van' },
  { body: '#d8dee6', roof: '#eef2f7', kind: 'van' },
  { body: '#3c546e', roof: '#b8c4d4', kind: 'bus' },
];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function approach(cur, target, delta) {
  if (cur < target) return Math.min(cur + delta, target);
  if (cur > target) return Math.max(cur - delta, target);
  return cur;
}

/** Resolve circle vs AABB collision with forgiving sliding response. Returns impact speed. */
function collideCircleRect(entity, radius, rx, ry, rw, rh) {
  const cx = clamp(entity.x, rx, rx + rw);
  const cy = clamp(entity.y, ry, ry + rh);
  const dx = entity.x - cx;
  const dy = entity.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return 0;

  let nx = 0;
  let ny = 0;
  let overlap = 0;
  if (d2 > 1e-6) {
    const dist = Math.sqrt(d2);
    nx = dx / dist;
    ny = dy / dist;
    overlap = radius - dist;
  } else {
    // Center is inside rect: push out along nearest face
    const left = entity.x - rx;
    const right = rx + rw - entity.x;
    const top = entity.y - ry;
    const bottom = ry + rh - entity.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) { nx = -1; overlap = left + radius; }
    else if (min === right) { nx = 1; overlap = right + radius; }
    else if (min === top) { ny = -1; overlap = top + radius; }
    else { ny = 1; overlap = bottom + radius; }
  }

  entity.x += nx * overlap;
  entity.y += ny * overlap;

  const vn = entity.vx * nx + entity.vy * ny;
  if (vn < 0) {
    // Preserve smooth tangential slide along walls so alleys feel crisp and forgiving
    const tx = -ny;
    const ty = nx;
    const vt = entity.vx * tx + entity.vy * ty;
    const slideKeep = 0.84;
    const bounce = 0.14;
    entity.vx = tx * vt * slideKeep - nx * vn * bounce;
    entity.vy = ty * vt * slideKeep - ny * vn * bounce;
    return -vn;
  }
  return 0;
}

/** Resolve circle vs circular island collision (Citrus Plaza Giant Orange pedestal). */
function collideCircleIsland(entity, radius, ix, iy, islandRadius) {
  const minDist = radius + islandRadius;
  const dx = entity.x - ix;
  const dy = entity.y - iy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= minDist * minDist) return 0;
  const dist = Math.sqrt(d2) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  entity.x = ix + nx * minDist;
  entity.y = iy + ny * minDist;
  const vn = entity.vx * nx + entity.vy * ny;
  if (vn < 0) {
    const tx = -ny;
    const ty = nx;
    const vt = entity.vx * tx + entity.vy * ty;
    entity.vx = tx * vt * 0.88 - nx * vn * 0.14;
    entity.vy = ty * vt * 0.88 - ny * vn * 0.14;
    return -vn;
  }
  return 0;
}

/** Evaluate a checkpoint's deterministic Green -> Amber -> Red signal phase at `simTime`. */
export function evaluateLight(cp, simTime) {
  const gDur = LIGHT_TIMING.green * cp.cycleScale;
  const aDur = LIGHT_TIMING.amber * cp.cycleScale;
  const rDur = LIGHT_TIMING.red * cp.cycleScale;
  const total = gDur + aDur + rDur;
  const t = (((simTime + cp.cycleOffset) % total) + total) % total;

  if (t < gDur) {
    const left = gDur - t;
    return {
      color: LIGHT_GREEN,
      timeLeft: left,
      progress: 1 - t / gDur,
      blinking: left < LIGHT_TIMING.greenWarn,
    };
  }
  if (t < gDur + aDur) {
    const at = t - gDur;
    return {
      color: LIGHT_AMBER,
      timeLeft: aDur - at,
      progress: 1 - at / aDur,
      blinking: false,
    };
  }
  const rt = t - gDur - aDur;
  return {
    color: LIGHT_RED,
    timeLeft: rDur - rt,
    progress: 1 - rt / rDur,
    blinking: false,
  };
}

export function createWorld(city, random) {
  const nearBuildings = [];

  // Pooled rubber skidmarks (ring buffer)
  const skids = new Array(SKID_POOL);
  for (let i = 0; i < SKID_POOL; i += 1) {
    skids[i] = { active: false, x1: 0, y1: 0, x2: 0, y2: 0, alpha: 0, width: 3 };
  }
  let skidCursor = 0;

  // Pooled particles (drift smoke, exhaust puffs, sparks, checkpoint bursts)
  const particles = new Array(PARTICLE_POOL);
  for (let i = 0; i < PARTICLE_POOL; i += 1) {
    particles[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 4, color: '#fff', grow: 8 };
  }

  // Player compact hot-hatch
  const player = {
    x: START_POSE.player.x,
    y: START_POSE.player.y,
    vx: 0,
    vy: 0,
    angle: START_POSE.player.angle,
    steerAngle: 0,
    speed: 0,
    forwardSpeed: 0,
    lateralSpeed: 0,
    drifting: false,
    wasDrifting: false,
    driftTime: 0,
    exitBoost: 0,
    braking: false,
    reversing: false,
    stopHoldTimer: 0,
    throttle: 0,
    throttleSmooth: 0,
    surface: 1,
    streetName: 'Garage 06',
    streetSub: 'Workshop Forecourt',
    inAlley: false,
    wheelSpin: 0,
    prevRearLx: 0,
    prevRearLy: 0,
    prevRearRx: 0,
    prevRearRy: 0,
    hasPrevWheel: false,
    exhaustTimer: 0,
    crashCooldown: 0,
  };

  // Yellow Taxi rival ("FOR HIRE" -> "BEAT 01:15")
  const taxi = {
    x: START_POSE.taxiIdleStart.x,
    y: START_POSE.taxiIdleStart.y,
    vx: 0,
    vy: 0,
    angle: START_POSE.taxiIdleStart.angle,
    speed: 0,
    braking: false,
    signFlip: 0,      // 0 = "FOR HIRE", 1 = "BEAT 01:15"
    introTimer: 0,
    racing: false,
    wpIndex: 0,
    finished: false,
    finishTime: 0,
  };

  // Police Patrol Car (activates at HEAT >= 2)
  const patrol = {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    speed: 0,
    sirenPhase: 0,
    path: [],
    pathIdx: 0,
    repathTimer: 0,
    ramCooldown: 0,
    distance: 9999,
    inAlley: false,
  };

  // Checkpoints live state
  const checkpoints = city.checkpoints.map((def) => ({
    ...def,
    color: LIGHT_GREEN,
    timeLeft: 5,
    progress: 1,
    blinking: false,
    passed: false,
    passedColor: -1,
    splitTime: 0,
  }));

  // Commuter rush-hour traffic
  const traffic = [];
  const trafficEdges = city.graph.edges.filter((e) => e.traffic);
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const style = TRAFFIC_COLORS[i % TRAFFIC_COLORS.length];
    traffic.push({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      speed: 0,
      targetSpeed: TRAFFIC.minSpeed + random() * (TRAFFIC.maxSpeed - TRAFFIC.minSpeed),
      fromNode: 0,
      toNode: 0,
      t: 0,
      braking: false,
      honkCooldown: 0,
      body: style.body,
      roof: style.roof,
      kind: style.kind,
      length: style.kind === 'bus' ? 54 : style.kind === 'van' ? 42 : 36,
      width: style.kind === 'bus' ? 23 : 20,
      radius: style.kind === 'bus' ? 16 : 13,
    });
  }

  const state = {
    mode: MODE_TITLE,
    simTime: 0,         // Continuous city clock (drives water, lights, traffic)
    countdown: 0,
    countdownBeat: 4,
    raceTime: 0,
    greenBonus: 0,
    effectiveTime: 0,
    finalTime: 0,
    finalBeatMeter: false,
    isNewRecord: false,
    nextCpIndex: 0,     // 0..5 = checkpoints 1..6, 6 = Finish Gate at Garage
    heat: 0,
    greensHit: 0,
    ambersHit: 0,
    redsHit: 0,
    alleysUsed: [],
    player,
    taxi,
    patrol,
    checkpoints,
    traffic,
    skids,
    particles,
    toasts: [],
    shake: 0,
    flashColor: null,
    flashAlpha: 0,
    camera: { x: START_POSE.player.x, y: START_POSE.player.y - 35, zoom: 1.28, lookX: 0, lookY: 0 },
    freeRoamStartReady: false,
  };

  function spawnParticle(x, y, vx, vy, life, size, color, grow = 10) {
    for (let i = 0; i < PARTICLE_POOL; i += 1) {
      const p = particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        p.life = life;
        p.maxLife = life;
        p.size = size;
        p.color = color;
        p.grow = grow;
        return;
      }
    }
  }

  function addSkid(x1, y1, x2, y2, alpha, width = 3.2) {
    const s = skids[skidCursor];
    skidCursor = (skidCursor + 1) % SKID_POOL;
    s.active = true;
    s.x1 = x1;
    s.y1 = y1;
    s.x2 = x2;
    s.y2 = y2;
    s.alpha = alpha;
    s.width = width;
  }

  function pushToast(text, sub, color, duration = 2.1) {
    state.toasts.push({ text, sub, color, life: duration, maxLife: duration });
    if (state.toasts.length > 4) state.toasts.shift();
  }

  function triggerFlash(color, alpha = 0.28) {
    state.flashColor = color;
    state.flashAlpha = Math.max(state.flashAlpha, alpha);
  }

  /** Place traffic vehicles cleanly distributed across major city avenues (away from Garage start). */
  function initTraffic() {
    for (let i = 0; i < traffic.length; i += 1) {
      const car = traffic[i];
      let edge = trafficEdges[(i * 7 + Math.floor(random() * trafficEdges.length)) % trafficEdges.length];
      // Keep starting garage intersection clear so launch is always clean
      let guard = 0;
      while (guard < 12) {
        const na = city.graph.nodes[edge.a];
        const nb = city.graph.nodes[edge.b];
        const mx = (na.x + nb.x) * 0.5;
        const my = (na.y + nb.y) * 0.5;
        if (Math.hypot(mx - START_POSE.player.x, my - START_POSE.player.y) > 420) break;
        edge = trafficEdges[Math.floor(random() * trafficEdges.length)];
        guard += 1;
      }
      const flip = random() < 0.5;
      car.fromNode = flip ? edge.b : edge.a;
      car.toNode = flip ? edge.a : edge.b;
      car.t = 0.15 + random() * 0.7;
      positionTrafficCar(car, true);
      car.speed = car.targetSpeed * 0.8;
      car.braking = false;
      car.honkCooldown = 0;
    }
  }

  function positionTrafficCar(car, snapAngle) {
    const a = city.graph.nodes[car.fromNode];
    const b = city.graph.nodes[car.toNode];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    // Right-hand lane offset (keeps opposing lanes cleanly separated)
    const laneOffset = 28;
    const rx = -uy * laneOffset;
    const ry = ux * laneOffset;
    let tx = a.x + dx * car.t + rx;
    let ty = a.y + dy * car.t + ry;
    // Curve traffic smoothly around the Citrus Plaza Giant Orange roundabout island
    const rdx = tx - ROUNDABOUT.x;
    const rdy = ty - ROUNDABOUT.y;
    const rd = Math.hypot(rdx, rdy);
    const minOrbit = ROUNDABOUT.islandRadius + 34;
    if (rd < minOrbit) {
      const ang = rd > 1 ? Math.atan2(rdy, rdx) : Math.atan2(dy, dx) + Math.PI * 0.5;
      tx = ROUNDABOUT.x + Math.cos(ang) * minOrbit;
      ty = ROUNDABOUT.y + Math.sin(ang) * minOrbit;
    }
    car.x = tx;
    car.y = ty;
    const desiredAngle = Math.atan2(dy, dx);
    if (snapAngle) {
      car.angle = desiredAngle;
    } else {
      car.angle = wrapAngle(car.angle + clamp(wrapAngle(desiredAngle - car.angle), -0.18, 0.18));
    }
    car.vx = Math.cos(car.angle) * car.speed;
    car.vy = Math.sin(car.angle) * car.speed;
  }

  function clearFx() {
    for (let i = 0; i < SKID_POOL; i += 1) skids[i].active = false;
    for (let i = 0; i < PARTICLE_POOL; i += 1) particles[i].active = false;
    state.toasts.length = 0;
    state.shake = 0;
    state.flashAlpha = 0;
  }

  function resetPlayerAtGarage() {
    player.x = START_POSE.player.x;
    player.y = START_POSE.player.y;
    player.vx = 0;
    player.vy = 0;
    player.angle = START_POSE.player.angle;
    player.steerAngle = 0;
    player.speed = 0;
    player.forwardSpeed = 0;
    player.lateralSpeed = 0;
    player.drifting = false;
    player.wasDrifting = false;
    player.driftTime = 0;
    player.exitBoost = 0;
    player.braking = false;
    player.reversing = false;
    player.stopHoldTimer = 0;
    player.throttle = 0;
    player.throttleSmooth = 0;
    player.hasPrevWheel = false;
    player.crashCooldown = 0;
    const loc = city.sampleLocation(player.x, player.y);
    player.surface = loc.surface;
    player.streetName = loc.name;
    player.streetSub = loc.subtitle;
    player.inAlley = loc.isAlley;
  }

  function resetRaceMetrics() {
    state.raceTime = 0;
    state.greenBonus = 0;
    state.effectiveTime = 0;
    state.finalTime = 0;
    state.finalBeatMeter = false;
    state.isNewRecord = false;
    state.nextCpIndex = 0;
    state.heat = 0;
    state.greensHit = 0;
    state.ambersHit = 0;
    state.redsHit = 0;
    state.alleysUsed = [];
    for (let i = 0; i < checkpoints.length; i += 1) {
      checkpoints[i].passed = false;
      checkpoints[i].passedColor = -1;
      checkpoints[i].splitTime = 0;
    }
    patrol.active = false;
    patrol.distance = 9999;
    patrol.path = [];
    patrol.ramCooldown = 0;
  }

  /** Reset into the live 6:00 PM Garage Title Scene (Yellow Taxi pulls up & flips roof sign!). */
  function resetTitle() {
    state.mode = MODE_TITLE;
    state.simTime = 0;
    clearFx();
    resetPlayerAtGarage();
    resetRaceMetrics();
    initTraffic();

    taxi.x = START_POSE.taxiIdleStart.x;
    taxi.y = START_POSE.taxiIdleStart.y;
    taxi.vx = 0;
    taxi.vy = 0;
    taxi.angle = START_POSE.taxiIdleStart.angle;
    taxi.speed = 0;
    taxi.braking = false;
    taxi.signFlip = 0;
    taxi.introTimer = 0;
    taxi.racing = false;
    taxi.finished = false;

    state.camera.x = 995;
    state.camera.y = 625;
    state.camera.zoom = 1.32;
    state.camera.lookX = 0;
    state.camera.lookY = 0;
    updateLights();
  }

  /** Start a fresh timed 6-light race right from the Garage forecourt. */
  function startRace(skipCountdown = false) {
    clearFx();
    resetPlayerAtGarage();
    resetRaceMetrics();
    initTraffic();
    state.simTime = 0;
    state.mode = skipCountdown ? MODE_RACE : MODE_COUNTDOWN;
    state.countdown = skipCountdown ? 0 : 2.15;
    state.countdownBeat = 4;

    // Position the yellow taxi at the curb ready to launch with "BEAT 01:15" lit!
    taxi.x = START_POSE.taxiRaceStart.x;
    taxi.y = START_POSE.taxiRaceStart.y;
    taxi.angle = START_POSE.taxiRaceStart.angle;
    taxi.vx = 0;
    taxi.vy = 0;
    taxi.speed = 0;
    taxi.signFlip = 1;
    taxi.racing = skipCountdown;
    taxi.wpIndex = 1;
    taxi.finished = false;
    taxi.finishTime = 0;

    state.camera.x = player.x;
    state.camera.y = player.y + 40;
    state.camera.zoom = 1.24;
    state.camera.lookX = 0;
    state.camera.lookY = 0;
    updateLights();
  }

  /** Enter open-city Free Roam (explore alleys, practice drifts, zero timer pressure). */
  function startFreeRoam(keepPosition = false) {
    state.mode = MODE_FREEROAM;
    if (!keepPosition) {
      clearFx();
      resetPlayerAtGarage();
      initTraffic();
    }
    resetRaceMetrics();
    taxi.x = START_POSE.taxiCurbStop.x;
    taxi.y = START_POSE.taxiCurbStop.y;
    taxi.angle = START_POSE.taxiCurbStop.angle;
    taxi.vx = 0;
    taxi.vy = 0;
    taxi.speed = 0;
    taxi.signFlip = 1;
    taxi.racing = false;
    state.freeRoamStartReady = false;
    pushToast('FREE ROAM · 18:00', 'Explore alleys & shortcuts · Drive to Garage or press R to race', '#f7c12c', 3.4);
  }

  function updateLights() {
    for (let i = 0; i < checkpoints.length; i += 1) {
      const cp = checkpoints[i];
      const ev = evaluateLight(cp, state.simTime);
      cp.color = ev.color;
      cp.timeLeft = ev.timeLeft;
      cp.progress = ev.progress;
      cp.blinking = ev.blinking;
    }
  }

  function updateTitleTaxi(dt) {
    taxi.introTimer += dt;
    // Taxi smoothly glides from east down Jalan Senja to the Garage forecourt curb in ~2.2s
    const dx = START_POSE.taxiCurbStop.x - taxi.x;
    const dy = START_POSE.taxiCurbStop.y - taxi.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 6) {
      const wantSpeed = clamp(dist * 1.45, 48, 245);
      taxi.braking = dist < 110;
      taxi.speed = approach(taxi.speed, wantSpeed, 260 * dt);
      const targetAngle = Math.atan2(dy, dx);
      taxi.angle = wrapAngle(taxi.angle + clamp(wrapAngle(targetAngle - taxi.angle), -4.5 * dt, 4.5 * dt));
      taxi.vx = Math.cos(taxi.angle) * taxi.speed;
      taxi.vy = Math.sin(taxi.angle) * taxi.speed;
      taxi.x += taxi.vx * dt;
      taxi.y += taxi.vy * dt;
    } else {
      taxi.x = START_POSE.taxiCurbStop.x;
      taxi.y = START_POSE.taxiCurbStop.y;
      taxi.speed = 0;
      taxi.vx = 0;
      taxi.vy = 0;
      taxi.braking = true;
      taxi.angle = wrapAngle(taxi.angle + clamp(wrapAngle(Math.PI - taxi.angle), -4.5 * dt, 4.5 * dt));
      // Flip roof sign cleanly from "FOR HIRE" to "BEAT 01:15" once parked at Bengkel 06!
      if (taxi.introTimer > 2.4) {
        taxi.signFlip = Math.min(1, taxi.signFlip + dt * 2.4);
      }
    }
  }

  function updateRaceTaxi(dt) {
    if (!taxi.racing || taxi.finished) {
      taxi.speed = approach(taxi.speed, 0, 260 * dt);
      taxi.vx = Math.cos(taxi.angle) * taxi.speed;
      taxi.vy = Math.sin(taxi.angle) * taxi.speed;
      taxi.x += taxi.vx * dt;
      taxi.y += taxi.vy * dt;
      taxi.braking = taxi.speed > 4;
      return;
    }
    const wp = TAXI_WAYPOINTS[taxi.wpIndex];
    if (!wp) {
      taxi.finished = true;
      taxi.finishTime = state.raceTime;
      return;
    }
    const dx = wp.x - taxi.x;
    const dy = wp.y - taxi.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 42) {
      taxi.wpIndex += 1;
      if (taxi.wpIndex >= TAXI_WAYPOINTS.length) {
        taxi.finished = true;
        taxi.finishTime = state.raceTime;
        return;
      }
    }
    const targetAngle = Math.atan2(dy, dx);
    const angleDiff = wrapAngle(targetAngle - taxi.angle);
    taxi.angle = wrapAngle(taxi.angle + clamp(angleDiff, -4.0 * dt, 4.0 * dt));
    // Pace taxi cleanly around ~75s total loop
    const cornerFactor = Math.max(0.55, 1 - Math.abs(angleDiff) * 0.55);
    const wantSpeed = TAXI.cruiseSpeed * cornerFactor;
    taxi.braking = wantSpeed < taxi.speed - 20;
    taxi.speed = approach(taxi.speed, wantSpeed, 280 * dt);
    taxi.vx = Math.cos(taxi.angle) * taxi.speed;
    taxi.vy = Math.sin(taxi.angle) * taxi.speed;
    taxi.x += taxi.vx * dt;
    taxi.y += taxi.vy * dt;
  }

  function updateTraffic(dt) {
    let events = 0;
    for (let i = 0; i < traffic.length; i += 1) {
      const car = traffic[i];
      if (car.honkCooldown > 0) car.honkCooldown = Math.max(0, car.honkCooldown - dt);

      const a = city.graph.nodes[car.fromNode];
      const b = city.graph.nodes[car.toNode];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const fx = Math.cos(car.angle);
      const fy = Math.sin(car.angle);

      // Slow down if approaching another traffic vehicle or the player directly ahead
      let wantSpeed = car.targetSpeed;
      for (let j = 0; j < traffic.length; j += 1) {
        if (i === j) continue;
        const o = traffic[j];
        const dx = o.x - car.x;
        const dy = o.y - car.y;
        const forward = dx * fx + dy * fy;
        const side = Math.abs(-dx * fy + dy * fx);
        if (forward > 0 && forward < 92 && side < 26) {
          wantSpeed = Math.min(wantSpeed, Math.max(0, (forward - 46) * 2.2));
        }
      }

      // Check proximity to player ahead -> brake & occasional honk
      const pdx = player.x - car.x;
      const pdy = player.y - car.y;
      const pForward = pdx * fx + pdy * fy;
      const pSide = Math.abs(-pdx * fy + pdy * fx);
      if (pForward > 0 && pForward < 96 && pSide < 30 && state.mode !== MODE_TITLE) {
        wantSpeed = Math.min(wantSpeed, Math.max(0, (pForward - 40) * 2.1));
        if (car.honkCooldown === 0 && pForward < 75 && player.speed > 130) {
          car.honkCooldown = 4.5;
          events |= EVENT_HONK;
        }
      }

      car.braking = wantSpeed < car.speed - 14;
      car.speed = approach(car.speed, wantSpeed, (car.braking ? 250 : 120) * dt);
      car.t += (car.speed * dt) / segLen;

      if (car.t >= 1) {
        // Choose next outgoing traffic edge (prefer continuing straight or turning cleanly, avoid U-turn)
        const node = city.graph.nodes[car.toNode];
        const options = node.adj.filter((e) => e.traffic && e.to !== car.fromNode);
        const prevFrom = car.fromNode;
        car.fromNode = car.toNode;
        if (options.length > 0) {
          const pick = options[Math.floor(random() * options.length)];
          car.toNode = pick.to;
        } else {
          car.toNode = prevFrom;
        }
        car.t = 0.02;
      }

      positionTrafficCar(car, false);
    }
    return events;
  }

  /** Spawn the Police Patrol Car from the nearest clear road node ~380-520u from player. */
  function dispatchPatrol() {
    if (patrol.active) return false;
    let bestNode = null;
    let bestScore = Infinity;
    for (let i = 0; i < city.graph.nodes.length; i += 1) {
      const n = city.graph.nodes[i];
      if (!n.adj.some((e) => e.traffic)) continue;
      const d = Math.hypot(n.x - player.x, n.y - player.y);
      if (d < 340 || d > 950) continue;
      // Prefer nodes slightly behind or flanking the player
      const score = Math.abs(d - 460);
      if (score < bestScore) {
        bestScore = score;
        bestNode = n;
      }
    }
    if (!bestNode) bestNode = city.graph.nodes[city.nearestNode(player.x + 420, player.y, true)];

    patrol.active = true;
    patrol.x = bestNode.x;
    patrol.y = bestNode.y;
    patrol.angle = Math.atan2(player.y - patrol.y, player.x - patrol.x);
    patrol.speed = 190;
    patrol.vx = Math.cos(patrol.angle) * patrol.speed;
    patrol.vy = Math.sin(patrol.angle) * patrol.speed;
    patrol.sirenPhase = 0;
    patrol.path = [];
    patrol.pathIdx = 0;
    patrol.repathTimer = 0;
    patrol.ramCooldown = 0.4;
    patrol.distance = Math.hypot(player.x - patrol.x, player.y - patrol.y);
    return true;
  }

  /** Check straight-line visibility between two points against buildings. */
  function hasLineOfSight(x1, y1, x2, y2) {
    const steps = 6;
    for (let s = 1; s < steps; s += 1) {
      const t = s / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      const list = city.queryBuildings(px, py, 8, nearBuildings);
      for (let i = 0; i < list.length; i += 1) {
        const b = list[i];
        if (px >= b.x - 6 && px <= b.x + b.w + 6 && py >= b.y - 6 && py <= b.y + b.h + 6) return false;
      }
    }
    return true;
  }

  function updatePatrol(dt) {
    if (!patrol.active) return 0;
    let events = 0;
    patrol.sirenPhase += dt * 7.5;
    if (patrol.ramCooldown > 0) patrol.ramCooldown = Math.max(0, patrol.ramCooldown - dt);

    const dxP = player.x - patrol.x;
    const dyP = player.y - patrol.y;
    const distP = Math.hypot(dxP, dyP);
    patrol.distance = distP;

    const loc = city.sampleLocation(patrol.x, patrol.y);
    patrol.inAlley = loc.isAlley;

    // Direct visual intercept when close and clear; otherwise follow Dijkstra road-graph path!
    let targetX = player.x + player.vx * 0.32;
    let targetY = player.y + player.vy * 0.32;
    const direct = distP < 380 && hasLineOfSight(patrol.x, patrol.y, player.x, player.y);

    if (!direct) {
      patrol.repathTimer -= dt;
      if (patrol.repathTimer <= 0 || patrol.pathIdx >= patrol.path.length) {
        const pNode = city.nearestNode(patrol.x, patrol.y, false);
        const goalNode = city.nearestNode(player.x, player.y, false);
        // Patrol slightly dislikes tight alleys (1.45x cost), making alleys a clever escape!
        patrol.path = city.findPath(pNode, goalNode, 1.48);
        patrol.pathIdx = patrol.path.length > 1 ? 1 : 0;
        patrol.repathTimer = 0.45;
      }
      if (patrol.path.length > 0 && patrol.pathIdx < patrol.path.length) {
        const node = city.graph.nodes[patrol.path[patrol.pathIdx]];
        targetX = node.x;
        targetY = node.y;
        if (Math.hypot(node.x - patrol.x, node.y - patrol.y) < 58 && patrol.pathIdx < patrol.path.length - 1) {
          patrol.pathIdx += 1;
        }
      }
    }

    const wantAngle = Math.atan2(targetY - patrol.y, targetX - patrol.x);
    const diff = wrapAngle(wantAngle - patrol.angle);
    const maxTurn = (patrol.inAlley ? PATROL.alleyTurnRate : PATROL.turnRate) * dt;
    patrol.angle = wrapAngle(patrol.angle + clamp(diff, -maxTurn, maxTurn));

    // Speed scales gently with Heat and slight rubber-banding when far behind, capped in narrow alleys
    const heatExtra = Math.max(0, state.heat - PATROL_HEAT_THRESHOLD) * PATROL.heatSpeedBonus;
    const catchup = distP > 540 ? 34 : 0;
    const cornerSlow = Math.max(0.55, 1 - Math.abs(diff) * 0.45);
    const rawCap = patrol.inAlley ? PATROL.alleySpeedCap : (PATROL.baseMaxSpeed + heatExtra + catchup);
    const wantSpeed = rawCap * cornerSlow;

    patrol.speed = approach(patrol.speed, wantSpeed, PATROL.accel * dt);
    patrol.vx = Math.cos(patrol.angle) * patrol.speed;
    patrol.vy = Math.sin(patrol.angle) * patrol.speed;
    patrol.x += patrol.vx * dt;
    patrol.y += patrol.vy * dt;

    // Collide patrol with buildings, roundabout island & world bounds
    const nearby = city.queryBuildings(patrol.x, patrol.y, PATROL.radius + 10, nearBuildings);
    for (let i = 0; i < nearby.length; i += 1) {
      const b = nearby[i];
      collideCircleRect(patrol, PATROL.radius, b.x, b.y, b.w, b.h);
    }
    collideCircleIsland(patrol, PATROL.radius, ROUNDABOUT.x, ROUNDABOUT.y, ROUNDABOUT.islandRadius + 2);
    patrol.x = clamp(patrol.x, WORLD.westWallX + 22, WORLD.waterEastX - 24);
    patrol.y = clamp(patrol.y, WORLD.northWallY + 22, WORLD.waterSouthY - 24);
    patrol.speed = Math.hypot(patrol.vx, patrol.vy);

    // Patrol vs Player ram / PIT collision!
    const minDist = CAR.radius + PATROL.radius + 3;
    const rdx = player.x - patrol.x;
    const rdy = player.y - patrol.y;
    const rd = Math.hypot(rdx, rdy);
    if (rd < minDist && rd > 1e-4) {
      const nx = rdx / rd;
      const ny = rdy / rd;
      const overlap = minDist - rd;
      player.x += nx * overlap * 0.65;
      player.y += ny * overlap * 0.65;
      patrol.x -= nx * overlap * 0.35;
      patrol.y -= ny * overlap * 0.35;

      if (patrol.ramCooldown === 0 && state.mode === MODE_RACE) {
        patrol.ramCooldown = PATROL.ramCooldown;
        // Heavy bump that shoves the player and trims speed (pure physical race disruption!)
        player.vx = player.vx * 0.64 + nx * 135;
        player.vy = player.vy * 0.64 + ny * 135;
        player.angle = wrapAngle(player.angle + (random() < 0.5 ? 0.14 : -0.14));
        state.shake = Math.max(state.shake, 11);
        triggerFlash('#ff3b4e', 0.2);
        pushToast('PATROL CONTACT!', 'Use tight alleys to shake the cruiser', '#ff5266', 1.6);
        for (let s = 0; s < 10; s += 1) {
          const ang = random() * Math.PI * 2;
          const spd = 70 + random() * 140;
          spawnParticle((player.x + patrol.x) * 0.5, (player.y + patrol.y) * 0.5, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.35, 3, '#ffd27d', -2);
        }
        events |= EVENT_PATROL_RAM;
      }
    }

    return events;
  }

  /** Arcade-drift car physics with surface feel, handbrake slides, skidmarks, and forgiving collisions. */
  function updatePlayer(dt, controls) {
    let events = 0;
    if (player.crashCooldown > 0) player.crashCooldown = Math.max(0, player.crashCooldown - dt);
    if (player.exitBoost > 0) player.exitBoost = Math.max(0, player.exitBoost - dt);

    const canDrive = state.mode === MODE_RACE || state.mode === MODE_FREEROAM;
    const throttle = canDrive ? controls.throttle : 0;
    const brake = canDrive ? controls.brake : (state.mode === MODE_FINISH ? 0.65 : 0);
    const steer = canDrive ? controls.steer : 0;
    const handbrake = canDrive && controls.handbrake;

    player.throttle = throttle;
    player.throttleSmooth = approach(player.throttleSmooth, throttle, (throttle > player.throttleSmooth ? 2.8 : 5.5) * dt);

    const fx = Math.cos(player.angle);
    const fy = Math.sin(player.angle);
    const rx = -fy;
    const ry = fx;

    let vForward = player.vx * fx + player.vy * fy;
    let vLateral = player.vx * rx + player.vy * ry;

    // Sample road surface
    const loc = city.sampleLocation(player.x, player.y);
    player.surface = loc.surface;
    player.streetName = loc.name;
    player.streetSub = loc.subtitle;
    player.inAlley = loc.isAlley;

    if (state.mode === MODE_RACE && loc.isAlley && !state.alleysUsed.includes(loc.name)) {
      state.alleysUsed.push(loc.name);
    }

    // Surface top speed & drift exit boost
    let maxSpd = loc.surface === SURFACE_ALLEY ? CAR.alleyMaxSpeed : CAR.maxSpeed;
    if (loc.surface === SURFACE_SIDEWALK) maxSpd *= 0.80;
    if (player.exitBoost > 0) maxSpd *= CAR.driftExitBoost;

    // Progressive acceleration, gentle off-throttle coasting, and full-stop-before-reverse braking!
    player.braking = false;
    if (throttle > 0) {
      player.stopHoldTimer = 0;
      player.reversing = false;
      if (vForward < -4) {
        // Braking cleanly out of reverse before accelerating forward
        player.braking = true;
        vForward = Math.min(0, vForward + CAR.brake * dt);
      } else {
        const boostMul = player.exitBoost > 0 ? 1.18 : 1.0;
        const speedFrac = clamp(vForward / maxSpd, 0, 1);
        const torqueCurve = 1.05 - speedFrac * 0.48;
        vForward += CAR.accel * boostMul * torqueCurve * player.throttleSmooth * dt;
      }
    } else if (brake > 0) {
      if (vForward > 1.5 && !player.reversing) {
        // Holding brake slows the car smoothly down to a full stop first!
        player.braking = true;
        player.stopHoldTimer = 0;
        vForward = Math.max(0, vForward - CAR.brake * brake * dt);
      } else if (!player.reversing) {
        // Hold at complete standstill briefly before shifting into reverse
        vForward = 0;
        vLateral = 0;
        player.braking = true;
        player.stopHoldTimer += dt;
        if (player.stopHoldTimer >= CAR.stopBeforeReverseSec && state.mode !== MODE_FINISH) {
          player.reversing = true;
        }
      } else {
        // Smoothly accelerate in reverse after complete stop
        vForward = Math.max(-CAR.reverseSpeed, vForward - CAR.accel * 0.65 * brake * dt);
      }
    } else {
      // Off-throttle natural coasting so the car rolls smoothly forward before stopping
      player.stopHoldTimer = 0;
      if (Math.abs(vForward) < 2.0) {
        vForward = 0;
        player.reversing = false;
      } else {
        vForward *= Math.exp(-CAR.coastDrag * dt);
        vForward = approach(vForward, 0, CAR.rollingResist * dt);
        if (vForward >= 0) player.reversing = false;
      }
    }

    if (handbrake) {
      player.braking = true;
      if (vForward > 35) vForward = Math.max(0, vForward - 165 * dt);
      else if (vForward < -20) vForward = Math.min(0, vForward + 165 * dt);
    }
    if (vForward > maxSpd) {
      vForward = approach(vForward, maxSpd, 220 * dt);
    }

    // Optional light handbrake drift (only when holding handbrake); normal driving tracks the nose crisply!
    const speedAbs = Math.abs(vForward);
    const driftingNow = handbrake && speedAbs > CAR.driftMinSpeed && Math.abs(steer) > 0.1;
    player.drifting = driftingNow || (Math.abs(vLateral) > 72 && speedAbs > 105);
    if (driftingNow) {
      player.driftTime += dt;
    } else {
      if (player.wasDrifting && player.driftTime > 0.24 && throttle > 0) {
        player.exitBoost = CAR.driftExitDuration;
      }
      player.driftTime = 0;
    }
    player.wasDrifting = driftingNow;

    // Front wheels smoothly follow steering input; car turns cleanly along its nose direction!
    const speedFactor = clamp(speedAbs / 78, 0, 1);
    const reverseSign = vForward < -2 ? -1 : 1;
    const steerMul = driftingNow ? CAR.driftSteerBoost : 1.0;
    const highSpeedStability = 1.0 - clamp((speedAbs - 210) / 360, 0, 0.22);
    player.steerAngle = approach(player.steerAngle, steer * 0.54, 7.5 * dt);
    player.angle = wrapAngle(player.angle + steer * CAR.steerRate * steerMul * highSpeedStability * speedFactor * reverseSign * dt);

    // Recompute car basis after heading update: normal driving keeps velocity tightly aligned with nose!
    const nfx = Math.cos(player.angle);
    const nfy = Math.sin(player.angle);
    const nrx = -nfy;
    const nry = nfx;

    const grip = handbrake
      ? CAR.driftGrip
      : loc.surface === SURFACE_ALLEY
        ? CAR.alleyGrip
        : CAR.lateralGrip;
    if (driftingNow) {
      vLateral -= steer * 85 * dt;
    }
    vLateral *= Math.exp(-grip * dt);
    if (!handbrake && Math.abs(vLateral) < 12) vLateral = 0;

    player.vx = nfx * vForward + nrx * vLateral;
    player.vy = nfy * vForward + nry * vLateral;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // World boundary walls (Seawall south/east, ridge north/west)
    const minX = WORLD.westWallX + 18;
    const maxX = WORLD.waterEastX - 22;
    const minY = WORLD.northWallY + 18;
    const maxY = WORLD.waterSouthY - 22;
    if (player.x < minX) { player.x = minX; if (player.vx < 0) player.vx *= -0.2; }
    if (player.x > maxX) { player.x = maxX; if (player.vx > 0) player.vx *= -0.2; }
    if (player.y < minY) { player.y = minY; if (player.vy < 0) player.vy *= -0.2; }
    if (player.y > maxY) { player.y = maxY; if (player.vy > 0) player.vy *= -0.2; }

    // Collide with buildings & Citrus Plaza Giant Orange roundabout island
    let maxImpact = 0;
    const nearby = city.queryBuildings(player.x, player.y, CAR.radius + 10, nearBuildings);
    for (let i = 0; i < nearby.length; i += 1) {
      const b = nearby[i];
      const hit = collideCircleRect(player, CAR.radius, b.x, b.y, b.w, b.h);
      if (hit > maxImpact) maxImpact = hit;
    }
    const islandHit = collideCircleIsland(player, CAR.radius, ROUNDABOUT.x, ROUNDABOUT.y, ROUNDABOUT.islandRadius + 2);
    if (islandHit > maxImpact) maxImpact = islandHit;

    // Collide with commuter traffic
    for (let i = 0; i < traffic.length; i += 1) {
      const car = traffic[i];
      const minDist = CAR.radius + car.radius;
      const dx = player.x - car.x;
      const dy = player.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d < minDist && d > 1e-4) {
        const nx = dx / d;
        const ny = dy / d;
        const push = minDist - d;
        player.x += nx * push * 0.85;
        player.y += ny * push * 0.85;
        const rvx = player.vx - car.vx;
        const rvy = player.vy - car.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          player.vx -= nx * vn * 1.18;
          player.vy -= ny * vn * 1.18;
          car.speed *= 0.4;
          maxImpact = Math.max(maxImpact, -vn);
          if (car.honkCooldown === 0) {
            car.honkCooldown = 3.5;
            events |= EVENT_HONK;
          }
        }
      }
    }

    // Light collision feedback with Yellow Taxi (only after launch)
    if (taxi.racing && state.raceTime > 1.2) {
      const minDist = CAR.radius + TAXI.radius;
      const dx = player.x - taxi.x;
      const dy = player.y - taxi.y;
      const d = Math.hypot(dx, dy);
      if (d < minDist && d > 1e-4) {
        const nx = dx / d;
        const ny = dy / d;
        player.x += nx * (minDist - d) * 0.7;
        player.y += ny * (minDist - d) * 0.7;
        const vn = (player.vx - taxi.vx) * nx + (player.vy - taxi.vy) * ny;
        if (vn < 0) {
          player.vx -= nx * vn * 1.05;
          player.vy -= ny * vn * 1.05;
          maxImpact = Math.max(maxImpact, -vn);
        }
      }
    }

    if (maxImpact > 62 && player.crashCooldown === 0) {
      player.crashCooldown = 0.24;
      state.shake = Math.max(state.shake, clamp(maxImpact / 28, 3, 9));
      events |= EVENT_CRASH;
      for (let s = 0; s < 6; s += 1) {
        const ang = random() * Math.PI * 2;
        const spd = 45 + random() * 115;
        spawnParticle(player.x, player.y, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.28, 2.5, '#ffcf70', -2);
      }
    }

    // Refresh speed telemetry & exact physical wheel rolling rotation (0.40m rally tire radius)
    player.forwardSpeed = player.vx * nfx + player.vy * nfy;
    player.lateralSpeed = player.vx * nrx + player.vy * nry;
    player.speed = Math.hypot(player.vx, player.vy);
    player.wheelSpin += (player.forwardSpeed * 0.12 * dt) / 0.40;

    // Tire skidmarks & drift smoke
    const rearX = player.x - nfx * (CAR.length * 0.34);
    const rearY = player.y - nfy * (CAR.length * 0.34);
    const wheelOff = CAR.width * 0.36;
    const rlx = rearX + nrx * wheelOff;
    const rly = rearY + nry * wheelOff;
    const rrx = rearX - nrx * wheelOff;
    const rry = rearY - nry * wheelOff;

    const slipMag = Math.abs(player.lateralSpeed);
    const makeSkids = (player.drifting || slipMag > 54 || (brake > 0.5 && player.speed > 175)) && player.hasPrevWheel;
    if (makeSkids) {
      const alpha = clamp(slipMag / 160 + (handbrake ? 0.25 : 0.1), 0.16, 0.52);
      addSkid(player.prevRearLx, player.prevRearLy, rlx, rly, alpha);
      addSkid(player.prevRearRx, player.prevRearRy, rrx, rry, alpha);
      if (random() < 0.72) {
        const smokeCol = loc.surface === SURFACE_ALLEY ? 'rgba(218, 198, 178, 0.55)' : 'rgba(235, 226, 218, 0.52)';
        spawnParticle(rlx, rly, -player.vx * 0.15 + (random() - 0.5) * 28, -player.vy * 0.15 + (random() - 0.5) * 28, 0.45, 5, smokeCol, 16);
        spawnParticle(rrx, rry, -player.vx * 0.15 + (random() - 0.5) * 28, -player.vy * 0.15 + (random() - 0.5) * 28, 0.45, 5, smokeCol, 16);
      }
    }
    player.prevRearLx = rlx;
    player.prevRearLy = rly;
    player.prevRearRx = rrx;
    player.prevRearRy = rry;
    player.hasPrevWheel = true;

    // Subtle warm exhaust puffs while accelerating or idling
    player.exhaustTimer -= dt;
    if (player.exhaustTimer <= 0) {
      player.exhaustTimer = throttle > 0.2 ? 0.065 : 0.24;
      const exX = player.x - nfx * (CAR.length * 0.52) - nrx * 4;
      const exY = player.y - nfy * (CAR.length * 0.52) - nry * 4;
      const col = player.exitBoost > 0 ? 'rgba(255, 194, 102, 0.58)' : 'rgba(205, 196, 210, 0.26)';
      spawnParticle(exX, exY, -nfx * 24 + (random() - 0.5) * 14, -nfy * 24 + (random() - 0.5) * 14, 0.34, 3.2, col, 9);
    }

    return events;
  }

  /** Check crossing of the current sequential Traffic-Light Checkpoint or Garage Finish Gate. */
  function checkProgress(bestTime) {
    let events = 0;

    if (state.mode === MODE_FREEROAM) {
      // Check if player drove into the Garage Forecourt bay to start a race!
      const inBay =
        player.x >= GARAGE_FORECOURT.x + 25 &&
        player.x <= GARAGE_FORECOURT.x + GARAGE_FORECOURT.w - 25 &&
        player.y >= GARAGE_FORECOURT.y + 15 &&
        player.y <= GARAGE_FORECOURT.y + GARAGE_FORECOURT.h + 15;
      state.freeRoamStartReady = inBay;
      return events;
    }

    if (state.mode !== MODE_RACE) return events;

    if (state.nextCpIndex < checkpoints.length) {
      const cp = checkpoints[state.nextCpIndex];
      const dist = Math.hypot(player.x - cp.x, player.y - cp.y);
      if (dist <= cp.radius) {
        cp.passed = true;
        cp.passedColor = cp.color;

        if (cp.color === LIGHT_GREEN) {
          state.greenBonus += GREEN_BONUS;
          state.greensHit += 1;
          state.effectiveTime = Math.max(0, state.raceTime - state.greenBonus);
          cp.splitTime = state.effectiveTime;
          pushToast(`GREEN · -1.0s`, `${cp.id}/6 ${cp.name}`, '#2ee58a', 2.1);
          triggerFlash('#2ee58a', 0.22);
          for (let k = 0; k < 16; k += 1) {
            const ang = (k / 16) * Math.PI * 2;
            const spd = 85 + random() * 95;
            spawnParticle(cp.x, cp.y, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.55, 4.5, '#2ee58a', 6);
          }
          events |= EVENT_CP_GREEN;
        } else if (cp.color === LIGHT_AMBER) {
          state.ambersHit += 1;
          state.effectiveTime = Math.max(0, state.raceTime - state.greenBonus);
          cp.splitTime = state.effectiveTime;
          pushToast(`AMBER · VALID`, `${cp.id}/6 ${cp.name} · No bonus`, '#ffb627', 1.9);
          triggerFlash('#ffb627', 0.14);
          events |= EVENT_CP_AMBER;
        } else {
          state.redsHit += 1;
          state.heat += 1;
          state.effectiveTime = Math.max(0, state.raceTime - state.greenBonus);
          cp.splitTime = state.effectiveTime;
          triggerFlash('#ff3b4e', 0.34);
          state.shake = Math.max(state.shake, 7);
          events |= EVENT_CP_RED;

          if (state.heat === PATROL_HEAT_THRESHOLD) {
            if (dispatchPatrol()) {
              events |= EVENT_PATROL_SPAWN;
            }
            pushToast(`RED · HEAT ${state.heat} · PATROL!`, `Unit 06 pursuing · Take alleys to shake them`, '#ff3b4e', 2.9);
          } else if (state.heat < PATROL_HEAT_THRESHOLD) {
            pushToast(`RED · HEAT ${state.heat}/${PATROL_HEAT_THRESHOLD}`, `${cp.id}/6 ${cp.name} · 1 more red triggers patrol!`, '#ff3b4e', 2.4);
          } else {
            pushToast(`RED · HEAT ${state.heat}!`, `Patrol closing faster!`, '#ff3b4e', 2.2);
          }
        }

        state.nextCpIndex += 1;
        if (state.nextCpIndex === checkpoints.length) {
          pushToast('ALL 6 LIGHTS CLEARED!', 'Sprint to GARAGE 06 Finish Arch!', '#f7c12c', 2.4);
        }
      }
    } else {
      // Final sprint into the Garage Finish Gate!
      const fg = FINISH_GATE;
      if (Math.abs(player.x - fg.x) <= fg.rx && Math.abs(player.y - fg.y) <= fg.ry) {
        state.mode = MODE_FINISH;
        state.effectiveTime = Math.max(0, state.raceTime - state.greenBonus);
        state.finalTime = state.effectiveTime;
        state.finalBeatMeter = state.finalTime <= TARGET_TIME;
        state.isNewRecord = bestTime <= 0 || state.finalTime < bestTime;
        patrol.active = false;
        triggerFlash(state.finalBeatMeter ? '#2ee58a' : '#f7c12c', 0.32);
        for (let k = 0; k < 24; k += 1) {
          const ang = (k / 24) * Math.PI * 2;
          const spd = 90 + random() * 140;
          const col = k % 2 === 0 ? '#f7c12c' : '#2ee58a';
          spawnParticle(fg.x, fg.y, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.75, 5, col, 6);
        }
        events |= EVENT_FINISH;
      }
    }

    return events;
  }

  function updateEffects(dt) {
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 28 * dt);
    if (state.flashAlpha > 0) state.flashAlpha = Math.max(0, state.flashAlpha - 0.85 * dt);

    for (let i = state.toasts.length - 1; i >= 0; i -= 1) {
      state.toasts[i].life -= dt;
      if (state.toasts[i].life <= 0) state.toasts.splice(i, 1);
    }

    for (let i = 0; i < PARTICLE_POOL; i += 1) {
      const p = particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-2.8 * dt);
      p.vy *= Math.exp(-2.8 * dt);
      p.size = Math.max(1, p.size + p.grow * dt);
    }
  }

  function updateCamera(dt) {
    const cam = state.camera;
    if (state.mode === MODE_TITLE) {
      // Hero composition framing Garage, Signboard, Yellow Taxi (BEAT 01:15) & Player Car on left half!
      const tx = 1005;
      const ty = 625;
      cam.x += (tx - cam.x) * Math.min(1, dt * 4);
      cam.y += (ty - cam.y) * Math.min(1, dt * 4);
      cam.zoom += (1.30 - cam.zoom) * Math.min(1, dt * 4);
      return;
    }

    if (state.mode === MODE_FINISH) {
      // Frame the Garage Signboard & Finish Arch heroically
      const tx = 885;
      const ty = 655;
      cam.x += (tx - cam.x) * Math.min(1, dt * 3.2);
      cam.y += (ty - cam.y) * Math.min(1, dt * 3.2);
      cam.zoom += (1.28 - cam.zoom) * Math.min(1, dt * 3.2);
      return;
    }

    // Dynamic look-ahead in velocity direction so players spot upcoming alleys and traffic lights early!
    const leadX = player.vx * 0.44;
    const leadY = player.vy * 0.44;
    cam.lookX += (leadX - cam.lookX) * Math.min(1, dt * 5.2);
    cam.lookY += (leadY - cam.lookY) * Math.min(1, dt * 5.2);

    const targetX = player.x + cam.lookX;
    const targetY = player.y + cam.lookY;
    cam.x += (targetX - cam.x) * Math.min(1, dt * 7.5);
    cam.y += (targetY - cam.y) * Math.min(1, dt * 7.5);

    // Subtle speed-sensitive zoom: tightens slightly in alleys, widens on high-speed coastal straights
    const speedRatio = clamp(player.speed / CAR.maxSpeed, 0, 1);
    const alleyBias = player.inAlley ? 0.08 : 0;
    const targetZoom = 1.24 - speedRatio * 0.24 + alleyBias;
    cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 3.4);
  }

  /** Advance one fixed 1/60s simulation tick. Returns EVENT_* bitmask. */
  function step(dt, controls, bestTime = 0) {
    let events = 0;
    state.simTime += dt;
    updateLights();

    if (state.mode === MODE_TITLE) {
      updateTitleTaxi(dt);
      updateTraffic(dt);
      updateEffects(dt);
      updateCamera(dt);
      return events;
    }

    if (state.mode === MODE_COUNTDOWN) {
      state.countdown -= dt;
      const beat = Math.ceil(state.countdown / 0.7);
      if (beat < state.countdownBeat && beat >= 1) {
        state.countdownBeat = beat;
        events |= EVENT_COUNTDOWN_TICK;
      }
      if (state.countdown <= 0) {
        state.mode = MODE_RACE;
        state.countdown = 0;
        taxi.racing = true;
        pushToast('GO! SIX LIGHTS!', 'Beat the taxi meter: 01:15.00', '#2ee58a', 2.0);
        events |= EVENT_RACE_START;
      }
      // Allow subtle engine rev exhaust puffs on the starting line
      if (controls.throttle > 0.1 && random() < 0.35) {
        const fx = Math.cos(player.angle);
        const fy = Math.sin(player.angle);
        spawnParticle(player.x - fx * 18, player.y - fy * 18, -fx * 35 + (random() - 0.5) * 18, -fy * 35, 0.28, 3.8, 'rgba(245, 204, 130, 0.45)', 10);
      }
      updateTraffic(dt);
      updateEffects(dt);
      updateCamera(dt);
      return events;
    }

    if (state.mode === MODE_RACE) {
      state.raceTime += dt;
      state.effectiveTime = Math.max(0, state.raceTime - state.greenBonus);
      updateRaceTaxi(dt);
    }

    events |= updateTraffic(dt);
    events |= updatePlayer(dt, controls);
    if (state.mode === MODE_RACE) {
      events |= updatePatrol(dt);
    }
    events |= checkProgress(bestTime);
    updateEffects(dt);
    updateCamera(dt);

    return events;
  }

  resetTitle();

  return {
    state,
    resetTitle,
    startRace,
    startFreeRoam,
    dispatchPatrol,
    pushToast,
    step,
  };
}
