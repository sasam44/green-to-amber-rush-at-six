// Boot, fixed 60 Hz simulation loop, Three.js 3D WebGL world + 2D HUD overlay,
// offline Sunset Funk-Synth music + controls, and ?shot capture hook.

import { BEST_KEY, STEP, TARGET_TIME } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import {
  createWorld,
  EVENT_CP_AMBER,
  EVENT_CP_GREEN,
  EVENT_CP_RED,
  EVENT_FINISH,
  EVENT_PATROL_SPAWN,
  MODE_COUNTDOWN,
  MODE_FINISH,
  MODE_FREEROAM,
  MODE_RACE,
  MODE_TITLE,
} from './world.js';
import { createAudio } from './audio.js';
import {
  ACT_CONFIRM,
  ACT_FREEROAM,
  ACT_MAP,
  ACT_MUSIC,
  ACT_PAUSE,
  ACT_RESTART,
  createInput,
} from './input.js';
import { createScene3D } from './scene3d.js';
import { createHudRenderer, formatTime } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 60018;

const webglCanvas = document.getElementById('webgl');
const hudCanvas = document.getElementById('hud');
const statusEl = document.getElementById('status');

const city = createCity(1);
const world = createWorld(city, createRandom(seed));
const scene3d = createScene3D(webglCanvas, city);
const hud = createHudRenderer(hudCanvas, city, scene3d.projectToHud);

function readBest() {
  try {
    const val = Number.parseFloat(window.localStorage.getItem(BEST_KEY) ?? '0');
    return Number.isFinite(val) && val > 0 ? val : 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, value.toFixed(2));
  } catch {
    // Storage disabled: keep best for this visit only
  }
}

function announce(msg) {
  if (statusEl) statusEl.textContent = msg;
}

function runShot(name) {
  const staged = stageShot(name, world);
  window.__shotMeta = {
    mode: world.state.mode,
    raceTime: world.state.raceTime,
    finalTime: world.state.finalTime,
    greenBonus: world.state.greenBonus,
    heat: world.state.heat,
    nextCp: world.state.nextCpIndex,
    patrolActive: world.state.patrol.active,
    alleysUsed: world.state.alleysUsed,
  };
  let painted = 0;
  function paint() {
    scene3d.render(world.state, staged.bestTime, STEP);
    hud.draw(world.state, {
      bestTime: staged.bestTime,
      paused: false,
      showMap: false,
      musicOn: true,
      volume: 0.72,
      pointer: { x: -1, y: -1 },
    });
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const audio = createAudio();
  let draggingSlider = false;

  // Unlock AudioContext cleanly inside the very first click/keydown user gesture!
  const input = createInput(hudCanvas, () => audio.unlock(), hud.toLogicalPoint);

  let bestTime = readBest();
  let paused = false;
  let showMap = false;
  let accumulator = 0;
  let last = performance.now();

  // Lightweight live telemetry for automated browser playtesting
  window.__gameState = world.state;
  window.__audioDebug = () => audio.debugInfo();

  function launchRace() {
    paused = false;
    showMap = false;
    audio.unlock();
    audio.startMusic();
    world.startRace(false);
    accumulator = 0;
    announce('Race starting. Six coral gates across the city. Beat 1 minute 15 seconds.');
  }

  function launchFreeRoam() {
    paused = false;
    showMap = false;
    audio.unlock();
    audio.startMusic();
    world.startFreeRoam(false);
    accumulator = 0;
    announce('Free roam mode. Explore the 3D city and press R anytime to race.');
  }

  function handleUiCommand(id, pt) {
    if (id === 'start_race' || id === 'race_again') launchRace();
    else if (id === 'free_roam') launchFreeRoam();
    else if (id === 'resume') {
      paused = false;
      announce('Resumed.');
    } else if (id === 'music_toggle') {
      const on = audio.toggleMusic();
      announce(on ? 'Music on.' : 'Music off.');
    } else if (id === 'volume_slider' && pt) {
      const v = hud.sampleVolumeSlider(pt.x, pt.y);
      if (v !== null) {
        audio.unlock();
        audio.setVolume(v);
        draggingSlider = true;
      }
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const click = input.takeClick();
    const ptr = input.pointer();

    if (!ptr.down) draggingSlider = false;
    if (draggingSlider && ptr.down) {
      const v = hud.sampleVolumeSlider(ptr.x, ptr.y);
      if (v !== null) audio.setVolume(v);
    }

    if (click) {
      const hit = hud.hitTestButton(click.x, click.y);
      if (hit) {
        handleUiCommand(hit, click);
        return;
      }
    }

    if (actions & ACT_MUSIC) {
      const on = audio.toggleMusic();
      announce(on ? 'Music on.' : 'Music off.');
    }

    if (actions & ACT_RESTART) {
      if (world.state.mode !== MODE_TITLE) {
        launchRace();
        return;
      }
    }

    if (actions & ACT_FREEROAM) {
      if (world.state.mode === MODE_TITLE || world.state.mode === MODE_FINISH || paused) {
        launchFreeRoam();
        return;
      }
    }

    if (actions & ACT_MAP) {
      if (!paused && (world.state.mode === MODE_RACE || world.state.mode === MODE_FREEROAM)) {
        showMap = !showMap;
      }
    }

    if (actions & ACT_PAUSE) {
      if (showMap) {
        showMap = false;
      } else if (world.state.mode === MODE_RACE || world.state.mode === MODE_FREEROAM || world.state.mode === MODE_COUNTDOWN) {
        paused = !paused;
        announce(paused ? 'Paused.' : 'Resumed.');
      }
    }

    if (actions & ACT_CONFIRM) {
      if (world.state.mode === MODE_TITLE || world.state.mode === MODE_FINISH) {
        launchRace();
      } else if (world.state.mode === MODE_FREEROAM && world.state.freeRoamStartReady) {
        launchRace();
      }
    }
  }

  function processStepEvents(events) {
    if (events === 0) return;
    audio.playEvents(events, world.state);

    if (events & EVENT_CP_GREEN) {
      announce(`Green light! Minus 1 second bonus. ${world.state.nextCpIndex} of 6 cleared.`);
    } else if (events & EVENT_CP_AMBER) {
      announce(`Amber light. Valid checkpoint. ${world.state.nextCpIndex} of 6 cleared.`);
    } else if (events & EVENT_PATROL_SPAWN) {
      announce('Second red light! Police patrol car dispatched and pursuing.');
    } else if (events & EVENT_CP_RED) {
      announce(`Red light. Heat level ${world.state.heat}.`);
    }

    if (events & EVENT_FINISH) {
      const ft = world.state.finalTime;
      if (bestTime <= 0 || ft < bestTime) {
        bestTime = ft;
        saveBest(bestTime);
      }
      const verdict = ft <= TARGET_TIME ? 'Beat the meter!' : 'The meter won.';
      announce(`Finish! Final time ${formatTime(ft)}. ${verdict} Best record ${formatTime(bestTime)}.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += frameDt;
    last = now;

    handleActions();

    const controls = input.controls();
    if (!paused) {
      while (accumulator >= STEP) {
        const events = world.step(STEP, controls, bestTime);
        processStepEvents(events);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }

    audio.updateContinuous(world.state, paused);

    const ptr = input.pointer();
    const hoverBtn = hud.hitTestButton(ptr.x, ptr.y);
    hudCanvas.style.cursor = hoverBtn ? 'pointer' : 'default';

    scene3d.render(world.state, bestTime, paused ? 0 : frameDt);
    hud.draw(world.state, {
      bestTime,
      paused,
      showMap,
      musicOn: audio.isMusicEnabled(),
      volume: audio.getVolume(),
      pointer: ptr,
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (world.state.mode === MODE_RACE || world.state.mode === MODE_COUNTDOWN)) {
      paused = true;
      announce('Paused.');
    }
  });

  announce('Green to Amber: Rush at Six. Click Start Race or press Space to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
