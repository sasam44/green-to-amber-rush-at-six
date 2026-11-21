// Transparent 2D HUD, Minimap, Compass & Overlay Renderer layered over the Three.js 3D WebGL scene.
// 100% English UI: Retro Taxi Meter, 6-Light Live Signal Strip, HEAT badge, Minimap,
// Full-Screen Route Map (M), Title Overlay, Garage 06 Finish Board, and Pause Menu.

import {
  FONT_MONO,
  FONT_UI,
  LIGHT_AMBER,
  LIGHT_GREEN,
  PALETTE,
  PATROL_HEAT_THRESHOLD,
  TARGET_TIME,
  VIEW,
  WORLD,
} from './config.js';
import { FINISH_GATE, SURFACE_ALLEY } from './city.js';
import { createMapTextures } from './textures.js';
import {
  MODE_COUNTDOWN,
  MODE_FINISH,
  MODE_FREEROAM,
  MODE_RACE,
  MODE_TITLE,
} from './world.js';

export function formatTime(sec) {
  const s = Math.max(0, sec);
  const mins = Math.floor(s / 60);
  const rem = s - mins * 60;
  const whole = Math.floor(rem);
  const hundredths = Math.floor((rem - whole) * 100);
  return `${String(mins).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

function lightHex(color) {
  if (color === LIGHT_GREEN) return PALETTE.green;
  if (color === LIGHT_AMBER) return PALETTE.amber;
  return PALETTE.red;
}

function lightGlow(color) {
  if (color === LIGHT_GREEN) return PALETTE.greenGlow;
  if (color === LIGHT_AMBER) return PALETTE.amberGlow;
  return PALETTE.redGlow;
}

function lightWord(color) {
  if (color === LIGHT_GREEN) return 'GREEN';
  if (color === LIGHT_AMBER) return 'AMBER';
  return 'RED';
}

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function createHudRenderer(canvas, city, projectToHud) {
  const ctx = canvas.getContext('2d');
  const maps = createMapTextures(city);
  const view = { scale: 1, x: 0, y: 0, dpr: 1 };
  const buttons = [];
  let sliderRect = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(window.innerWidth * dpr);
    const height = Math.round(window.innerHeight * dpr);
    canvas.width = width;
    canvas.height = height;
    view.dpr = dpr;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) * 0.5;
    view.y = (height - VIEW.height * view.scale) * 0.5;
  }

  function toLogicalPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * view.dpr;
    const py = (clientY - rect.top) * view.dpr;
    return {
      x: (px - view.x) / view.scale,
      y: (py - view.y) / view.scale,
    };
  }

  function hitTestButton(x, y) {
    for (let i = buttons.length - 1; i >= 0; i -= 1) {
      const b = buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
    }
    return null;
  }

  function sampleVolumeSlider(x, y) {
    if (!sliderRect) return null;
    if (x >= sliderRect.x - 8 && x <= sliderRect.x + sliderRect.w + 8 && y >= sliderRect.y - 10 && y <= sliderRect.y + sliderRect.h + 10) {
      return Math.max(0, Math.min(1, (x - sliderRect.x) / sliderRect.w));
    }
    return null;
  }

  function registerButton(id, x, y, w, h) {
    buttons.push({ id, x, y, w, h });
  }

  /** Compact always-available Sunset Audio Widget: Music On/Off toggle + Volume Slider. */
  function drawAudioBar(x, y, musicOn, volume, pointer) {
    const w = 250;
    const h = 34;
    ctx.fillStyle = PALETTE.panelBg;
    roundRect(ctx, x, y, w, h, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Music On/Off pill button
    const bx = x + 6;
    const by = y + 5;
    const bw = 96;
    const bh = 24;
    registerButton('music_toggle', bx, by, bw, bh);
    const hoverBtn = pointer.x >= bx && pointer.x <= bx + bw && pointer.y >= by && pointer.y <= by + bh;
    ctx.fillStyle = musicOn
      ? (hoverBtn ? 'rgba(46, 229, 138, 0.34)' : 'rgba(46, 229, 138, 0.22)')
      : (hoverBtn ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.08)');
    roundRect(ctx, bx, by, bw, bh, 6);
    ctx.fill();
    ctx.strokeStyle = musicOn ? PALETTE.green : 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = musicOn ? PALETTE.green : PALETTE.muted;
    ctx.font = `800 10.5px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(musicOn ? '♪ MUSIC ON' : '♪ MUSIC OFF', bx + bw * 0.5, by + bh * 0.5 + 0.5);

    // Interactive Volume Slider
    const sx = x + 114;
    const sy = y + 14;
    const sw = 94;
    const sh = 6;
    sliderRect = { x: sx, y: sy, w: sw, h: sh };
    registerButton('volume_slider', sx - 8, sy - 10, sw + 16, sh + 20);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    roundRect(ctx, sx, sy, sw, sh, 3);
    ctx.fill();

    const fillW = Math.max(2, sw * volume);
    ctx.fillStyle = musicOn ? PALETTE.gold : '#7e8c9c';
    roundRect(ctx, sx, sy, fillW, sh, 3);
    ctx.fill();

    // Slider thumb
    const thumbX = sx + sw * volume;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(thumbX, sy + sh * 0.5, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#182230';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Percentage readout
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 10px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(volume * 100)}%`, x + w - 8, y + h * 0.5 + 0.5);
  }

  function drawButton(id, label, x, y, w, h, primary, pointer) {
    registerButton(id, x, y, w, h);
    const hover = pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
    ctx.fillStyle = primary
      ? (hover ? '#ffd24d' : PALETTE.gold)
      : (hover ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.09)');
    roundRect(ctx, x, y, w, h, 9);
    ctx.fill();
    ctx.strokeStyle = primary ? '#fff3c4' : 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = primary ? 2 : 1.4;
    ctx.stroke();

    ctx.fillStyle = primary ? '#141c26' : PALETTE.text;
    ctx.font = `900 15px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w * 0.5, y + h * 0.5 + 0.5);
  }

  function drawScreenFx(state) {
    if (state.patrol.active && state.mode === MODE_RACE) {
      const red = Math.sin(state.patrol.sirenPhase) > 0;
      const prox = Math.max(0.28, 1 - state.patrol.distance / 1100);
      ctx.strokeStyle = red ? `rgba(255, 42, 74, ${0.2 * prox})` : `rgba(44, 156, 255, ${0.2 * prox})`;
      ctx.lineWidth = 18;
      ctx.strokeRect(0, 0, VIEW.width, VIEW.height);
    }

    if (state.flashAlpha > 0.005 && state.flashColor) {
      ctx.save();
      ctx.globalAlpha = state.flashAlpha;
      ctx.fillStyle = state.flashColor;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.restore();
    }
  }

  function drawMinimap(state, x, y, w, h, baseImg, fullMode) {
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;

    ctx.save();
    roundRect(ctx, x, y, w, h, fullMode ? 14 : 10);
    ctx.clip();
    ctx.drawImage(baseImg, x, y, w, h);

    // 6 Checkpoint pips
    for (let i = 0; i < state.checkpoints.length; i += 1) {
      const cp = state.checkpoints[i];
      const cx = x + cp.x * sx;
      const cy = y + cp.y * sy;
      const active = state.mode === MODE_RACE && i === state.nextCpIndex;
      const r = fullMode ? (active ? 13 : 10) : (active ? 7.5 : 5.2);

      if (active) {
        const pulse = 1 + Math.sin(state.simTime * 7) * 0.3;
        ctx.fillStyle = lightGlow(cp.color);
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.9 * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = cp.passed ? 'rgba(150, 165, 180, 0.5)' : lightHex(cp.color);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#121b26';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.fillStyle = '#121b26';
      ctx.font = `900 ${fullMode ? 11 : 7.5}px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cp.id), cx, cy + 0.5);

      if (fullMode) {
        ctx.fillStyle = PALETTE.text;
        ctx.font = `700 11px ${FONT_UI}`;
        ctx.fillText(cp.name, cx, cy - 18);
      }
    }

    // Garage 06 Start/Finish marker
    const fx = x + FINISH_GATE.x * sx;
    const fy = y + FINISH_GATE.y * sy;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(fx - (fullMode ? 6 : 4), fy - (fullMode ? 6 : 4), fullMode ? 12 : 8, fullMode ? 12 : 8);
    if (fullMode) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `800 11px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText('GARAGE 06 (START / FINISH)', fx, fy - 14);
    }

    // Yellow Taxi dot
    ctx.fillStyle = PALETTE.taxiYellow;
    ctx.beginPath();
    ctx.arc(x + state.taxi.x * sx, y + state.taxi.y * sy, fullMode ? 6 : 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#121b26';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Police Patrol dot
    if (state.patrol.active) {
      ctx.fillStyle = Math.sin(state.patrol.sirenPhase) > 0 ? PALETTE.sirenRed : PALETTE.sirenBlue;
      ctx.beginPath();
      ctx.arc(x + state.patrol.x * sx, y + state.patrol.y * sy, fullMode ? 7.5 : 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // Player heading triangle
    ctx.save();
    ctx.translate(x + state.player.x * sx, y + state.player.y * sy);
    ctx.rotate(state.player.angle);
    const sz = fullMode ? 10 : 6.8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(sz, 0);
    ctx.lineTo(-sz * 0.75, -sz * 0.65);
    ctx.lineTo(-sz * 0.4, 0);
    ctx.lineTo(-sz * 0.75, sz * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.playerBody;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    if (fullMode) {
      ctx.font = `700 12px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7fe7f5';
      ctx.fillText('SEAWALL HIGHWAY (Long & Straight Coastal Road)', x + 2250 * sx, y + 3140 * sy + 20);
      ctx.fillStyle = '#f7c12c';
      ctx.fillText('MARKET ALLEY (Short Alley · 2 Sharp Turns)', x + 1720 * sx, y + 2480 * sy - 14);
      ctx.fillText('CONTAINER ALLEY', x + 4020 * sx - 12, y + 2260 * sy);
      ctx.fillText('LANTERN ALLEY', x + 3450 * sx, y + 1120 * sy - 12);
      ctx.fillStyle = '#ff9d3b';
      ctx.fillText('GIANT ORANGE ROUNDABOUT', x + 1840 * sx, y + 1520 * sy + 28);
    }

    ctx.restore();

    ctx.strokeStyle = 'rgba(247, 193, 44, 0.46)';
    ctx.lineWidth = 1.8;
    roundRect(ctx, x, y, w, h, fullMode ? 14 : 10);
    ctx.stroke();

    if (!fullMode) {
      ctx.fillStyle = 'rgba(18, 25, 36, 0.82)';
      roundRect(ctx, x + 6, y + h - 20, 114, 15, 4);
      ctx.fill();
      ctx.fillStyle = '#f7c12c';
      ctx.font = `700 9px ${FONT_UI}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('--- ALLEYS   [M] MAP', x + 11, y + h - 12.5);
    }
  }

  /** 3D-projected directional marker guiding you cleanly to the next Coral Checkpoint Gate! */
  function draw3DCompassBeacon(state) {
    const isFinish = state.nextCpIndex >= state.checkpoints.length;
    const target = isFinish ? FINISH_GATE : state.checkpoints[state.nextCpIndex];
    const distM = Math.round(Math.hypot(target.x - state.player.x, target.y - state.player.y) * 0.12);
    const col = isFinish ? PALETTE.gold : lightHex(target.color);
    const beaconH = !isFinish && target.style === 'roundabout' ? 21.5 : 14.5;
    const proj = projectToHud(target.x, target.y, beaconH);

    // Compute clean screen-space anchor (tracks gate overhead when visible, or clamps cleanly to edge when turning!)
    let bx = proj.x;
    let by = proj.y;
    let offscreen = proj.behind || bx < 54 || bx > VIEW.width - 54 || by < 130 || by > VIEW.height - 90;

    if (proj.behind) {
      // Flip behind-camera projection to the appropriate left/right turn edge!
      const dx = target.x - state.player.x;
      const dy = target.y - state.player.y;
      const targetAng = Math.atan2(dy, dx);
      let rel = targetAng - state.player.angle;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      bx = rel >= 0 ? VIEW.width - 62 : 62;
      by = VIEW.height * 0.48;
    } else if (offscreen) {
      bx = Math.max(58, Math.min(VIEW.width - 58, bx));
      by = Math.max(150, Math.min(VIEW.height - 96, by));
    }

    // Never collide with top HUD bar or top-right minimap!
    if (by < 142) by = 142;
    if (bx > VIEW.width - 275 && by < 248) by = 252;
    if (bx < 285 && by < 186) by = 188;

    ctx.save();
    ctx.translate(bx, by);
    ctx.fillStyle = 'rgba(18, 25, 36, 0.88)';
    roundRect(ctx, -38, -20, 76, 38, 10);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.fillStyle = col;
    ctx.font = `900 11.5px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isFinish ? 'FINISH' : `GATE #${target.id}`, 0, -6);

    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 10px ${FONT_MONO}`;
    ctx.fillText(`${distM}m`, 0, 9);

    if (offscreen) {
      const side = bx < VIEW.width * 0.5 ? -1 : 1;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(side * 48, 0);
      ctx.lineTo(side * 39, -7);
      ctx.lineTo(side * 39, 7);
      ctx.closePath();
      ctx.fill();
    } else {
      // Subtle downward pointer toward the 3D Coral Arch below
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, 26);
      ctx.lineTo(-7, 18);
      ctx.lineTo(7, 18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHud(state, bestTime, musicOn, volume, pointer) {
    const pad = 20;

    // 1. TOP-LEFT: Retro Digital Taxi Meter & Speedometer
    ctx.fillStyle = PALETTE.panelBg;
    roundRect(ctx, pad, pad, 250, 108, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelBorder;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    if (state.mode === MODE_FREEROAM) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `800 13px ${FONT_UI}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('FREE ROAM · 6:00 PM', pad + 16, pad + 14);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `500 12px ${FONT_UI}`;
      ctx.fillText('Explore streets & shortcuts.', pad + 16, pad + 36);
      ctx.fillStyle = PALETTE.green;
      ctx.font = `700 12px ${FONT_UI}`;
      ctx.fillText(state.freeRoamStartReady ? 'AT GARAGE · PRESS R TO RACE!' : 'Press R to start 6-light race', pad + 16, pad + 56);
    } else {
      const overTarget = state.effectiveTime > TARGET_TIME;
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `700 10.5px ${FONT_UI}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('METER CLOCK', pad + 16, pad + 11);

      ctx.fillStyle = PALETTE.gold;
      ctx.textAlign = 'right';
      ctx.fillText('BEAT 01:15.00', pad + 234, pad + 11);

      ctx.fillStyle = overTarget ? PALETTE.red : state.greenBonus > 0 ? '#78f5b8' : PALETTE.text;
      ctx.font = `800 34px ${FONT_MONO}`;
      ctx.textAlign = 'left';
      ctx.fillText(formatTime(state.effectiveTime), pad + 15, pad + 26);

      if (state.greenBonus > 0) {
        ctx.fillStyle = 'rgba(46, 229, 138, 0.2)';
        roundRect(ctx, pad + 15, pad + 68, 108, 22, 6);
        ctx.fill();
        ctx.fillStyle = PALETTE.green;
        ctx.font = `800 11.5px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`GREEN -${state.greenBonus.toFixed(1)}s`, pad + 69, pad + 79);
      } else {
        ctx.fillStyle = PALETTE.muted;
        ctx.font = `600 11px ${FONT_MONO}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(bestTime > 0 ? `BEST ${formatTime(bestTime)}` : '6 LIGHTS · FREE ROUTE', pad + 16, pad + 79);
      }
    }

    const kmh = Math.round(state.player.speed * 0.42);
    ctx.fillStyle = state.player.drifting ? PALETTE.warmSunset : PALETTE.text;
    ctx.font = `800 15px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${String(kmh).padStart(3, ' ')} KM/H`, pad + 234, pad + 80);

    if (state.player.drifting || state.player.exitBoost > 0) {
      ctx.fillStyle = state.player.exitBoost > 0 ? PALETTE.green : PALETTE.warmSunset;
      ctx.fillRect(pad + 14, pad + 98, 222, 3);
    }

    // Audio Bar (Music On/Off + Volume Slider) directly below Meter Clock
    drawAudioBar(pad, pad + 116, musicOn, volume, pointer);

    // 2. TOP-CENTER: 6-Light Live Signal Strip + Active Gate Countdown
    if (state.mode === MODE_RACE || state.mode === MODE_COUNTDOWN) {
      const stripW = 440;
      const sx = (VIEW.width - stripW) * 0.5;
      ctx.fillStyle = PALETTE.panelBg;
      roundRect(ctx, sx, pad, stripW, 92, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      const startX = sx + 38;
      const gap = 59;
      const ny = pad + 25;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, ny);
      ctx.lineTo(startX + gap * 6, ny);
      ctx.stroke();

      for (let i = 0; i < 6; i += 1) {
        const cp = state.checkpoints[i];
        const cx = startX + i * gap;
        const active = i === state.nextCpIndex;
        const r = active ? 14 : 11;
        let fill = '#273545';
        let stroke = 'rgba(255,255,255,0.24)';
        if (cp.passed) { fill = lightHex(cp.passedColor); stroke = '#ffffff'; }
        else if (active) { fill = lightHex(cp.color); stroke = '#ffffff'; }

        if (active) {
          ctx.fillStyle = lightGlow(cp.color);
          ctx.beginPath();
          ctx.arc(cx, ny, 21, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(cx, ny, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = active ? 2.2 : 1.2;
        ctx.stroke();

        ctx.fillStyle = cp.passed || active ? '#121a24' : '#d2dce6';
        ctx.font = `900 ${active ? 12 : 11}px ${FONT_UI}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), cx, ny + 0.5);
      }

      const fx = startX + 6 * gap;
      const finActive = state.nextCpIndex === 6;
      ctx.fillStyle = finActive ? PALETTE.gold : '#273545';
      ctx.beginPath();
      ctx.arc(fx, ny, finActive ? 14 : 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = finActive ? '#ffffff' : 'rgba(255,255,255,0.24)';
      ctx.lineWidth = finActive ? 2.2 : 1.2;
      ctx.stroke();
      ctx.fillStyle = finActive ? '#121a24' : '#cbd6e2';
      ctx.font = `900 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FIN', fx, ny + 0.5);

      const barX = sx + 18;
      const barY = pad + 51;
      const barW = stripW - 36;
      if (state.nextCpIndex < 6) {
        const cp = state.checkpoints[state.nextCpIndex];
        const distM = Math.round(Math.hypot(cp.x - state.player.x, cp.y - state.player.y) * 0.12);
        const col = lightHex(cp.color);

        ctx.fillStyle = PALETTE.text;
        ctx.font = `800 12.5px ${FONT_UI}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`NEXT #${cp.id} · ${cp.name}`, barX, barY + 5);

        ctx.fillStyle = col;
        ctx.font = `800 12.5px ${FONT_MONO}`;
        ctx.textAlign = 'right';
        const note = cp.color === LIGHT_GREEN ? '-1s' : cp.color === LIGHT_AMBER ? 'OK' : 'HEAT+1';
        ctx.fillText(`${lightWord(cp.color)} ${cp.timeLeft.toFixed(1)}s (${note}) · ${distM}m`, barX + barW, barY + 5);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        roundRect(ctx, barX, barY + 19, barW, 8, 4);
        ctx.fill();
        ctx.fillStyle = col;
        roundRect(ctx, barX, barY + 19, Math.max(6, barW * cp.progress), 8, 4);
        ctx.fill();
      } else {
        const distM = Math.round(Math.hypot(FINISH_GATE.x - state.player.x, FINISH_GATE.y - state.player.y) * 0.12);
        ctx.fillStyle = PALETTE.gold;
        ctx.font = `800 13px ${FONT_UI}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('FINAL SPRINT · GARAGE 06 FINISH ARCH', barX, barY + 10);
        ctx.font = `800 13px ${FONT_MONO}`;
        ctx.textAlign = 'right';
        ctx.fillText(`${distM}m`, barX + barW, barY + 10);
      }
    }

    // 3. TOP-RIGHT: HEAT Pill + Minimap
    const mapW = 224;
    const mapH = 164;
    const mx = VIEW.width - pad - mapW;
    const my = pad + 42;

    const heatActive = state.patrol.active;
    const heatBlink = heatActive && Math.sin(state.patrol.sirenPhase) > 0;
    ctx.fillStyle = heatActive
      ? (heatBlink ? 'rgba(255, 44, 72, 0.92)' : 'rgba(32, 122, 224, 0.92)')
      : PALETTE.panelBg;
    roundRect(ctx, mx, pad, mapW, 34, 9);
    ctx.fill();
    ctx.strokeStyle = state.heat >= 1 ? 'rgba(255, 59, 78, 0.7)' : 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = heatActive ? '#ffffff' : state.heat === 1 ? PALETTE.amber : PALETTE.muted;
    ctx.font = `800 12px ${FONT_UI}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const heatTxt = heatActive
      ? `HEAT ${state.heat} · PATROL CHASE!`
      : state.heat === 1
        ? `HEAT 1/${PATROL_HEAT_THRESHOLD} · CAUTION`
        : `HEAT 0/${PATROL_HEAT_THRESHOLD} · CLEAR`;
    ctx.fillText(heatTxt, mx + 12, pad + 17);

    for (let h = 0; h < 2; h += 1) {
      ctx.fillStyle = h < state.heat ? PALETTE.red : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(mx + mapW - 30 + h * 15, pad + 17, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    drawMinimap(state, mx, my, mapW, mapH, maps.minimap, false);

    // 4. 3D-Projected Directional Gate Beacon
    if (state.mode === MODE_RACE) {
      draw3DCompassBeacon(state);
    }

    // 5. Floating Event Toasts
    for (let i = 0; i < state.toasts.length; i += 1) {
      const t = state.toasts[i];
      const alpha = Math.min(1, t.life * 2.2);
      const slide = (1 - Math.min(1, (t.maxLife - t.life) * 6)) * 12;
      const ty = 130 + i * 54 - slide;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(18, 25, 36, 0.92)';
      roundRect(ctx, VIEW.width * 0.5 - 168, ty, 336, 44, 10);
      ctx.fill();
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.font = `900 15px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, VIEW.width * 0.5, ty + 16);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `600 11px ${FONT_UI}`;
      ctx.fillText(t.sub, VIEW.width * 0.5, ty + 33);
      ctx.restore();
    }

    // 6. Bottom-Right Street Nameplate & Bottom-Left Controls Strip (keeps lower-center car clear!)
    const isAlley = state.player.surface === SURFACE_ALLEY;
    const badgeW = 246;
    const bx = VIEW.width - pad - badgeW;
    const by = VIEW.height - 56;
    ctx.fillStyle = isAlley ? 'rgba(92, 54, 34, 0.9)' : 'rgba(18, 25, 36, 0.84)';
    roundRect(ctx, bx, by, badgeW, 38, 10);
    ctx.fill();
    ctx.strokeStyle = isAlley ? 'rgba(247, 193, 44, 0.78)' : 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = isAlley ? PALETTE.gold : PALETTE.text;
    ctx.font = `800 12.5px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.player.streetName.toUpperCase(), bx + badgeW * 0.5, by + 13);
    ctx.fillStyle = isAlley ? '#fae0bc' : PALETTE.muted;
    ctx.font = `600 10.5px ${FONT_UI}`;
    ctx.fillText(state.player.streetSub, bx + badgeW * 0.5, by + 28);

    ctx.fillStyle = 'rgba(18, 25, 36, 0.78)';
    roundRect(ctx, pad, VIEW.height - 42, 412, 26, 7);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 11px ${FONT_UI}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`WASD/Arrows Drive · S Brake/Stop · Space Drift · M Map · R Retry · N Music`, pad + 11, VIEW.height - 29);

    // 7. Launch Countdown (3 · 2 · 1)
    if (state.mode === MODE_COUNTDOWN) {
      const beat = Math.max(1, Math.ceil(state.countdown / 0.7));
      const frac = (state.countdown % 0.7) / 0.7;
      const scale = 1 + (1 - frac) * 0.18;
      ctx.save();
      ctx.translate(VIEW.width * 0.5, VIEW.height * 0.34);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(18, 25, 36, 0.86)';
      ctx.beginPath();
      ctx.arc(0, 0, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = beat === 1 ? PALETTE.green : PALETTE.amber;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = beat === 1 ? PALETTE.green : PALETTE.gold;
      ctx.font = `900 52px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(beat), 0, 3);
      ctx.restore();
    }
  }

  function drawTitleOverlay(state, bestTime, pointer) {
    // Scrim on right side only so the 3D Garage 06, Yellow Taxi & Crimson Car shine clearly on the left!
    const scrim = ctx.createLinearGradient(VIEW.width * 0.48, 0, VIEW.width, 0);
    scrim.addColorStop(0, 'rgba(16, 24, 34, 0)');
    scrim.addColorStop(0.28, 'rgba(16, 24, 34, 0.78)');
    scrim.addColorStop(1, 'rgba(16, 24, 34, 0.94)');
    ctx.fillStyle = scrim;
    ctx.fillRect(VIEW.width * 0.48, 0, VIEW.width * 0.52, VIEW.height);

    // Top-left 6:00 PM badge
    ctx.fillStyle = 'rgba(18, 25, 36, 0.86)';
    roundRect(ctx, 26, 24, 224, 42, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(247, 193, 44, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `900 15px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('6:00 PM', 40, 45);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 12.5px ${FONT_UI}`;
    ctx.fillText('SUNSET HARBOR', 118, 45);

    // Subtle floating taxi status callout on bottom-left
    const taxiReady = state.taxi.signFlip >= 0.5;
    ctx.fillStyle = 'rgba(18, 25, 36, 0.86)';
    roundRect(ctx, 26, VIEW.height - 62, 308, 38, 9);
    ctx.fill();
    ctx.strokeStyle = taxiReady ? PALETTE.gold : PALETTE.green;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = taxiReady ? PALETTE.gold : PALETTE.green;
    ctx.font = `800 12px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(taxiReady ? 'TAXI ROOF SIGN:  BEAT 01:15' : 'TAXI ROOF SIGN:  FOR HIRE...', 42, VIEW.height - 43);

    // Right-hand Title Card
    const px = 742;
    const py = 92;
    const pw = 502;

    ctx.fillStyle = PALETTE.warmSunset;
    ctx.font = `800 13px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('SIX LIGHTS. ONE CITY. BEAT THE METER.', px, py);

    ctx.fillStyle = PALETTE.green;
    ctx.font = `900 50px ${FONT_UI}`;
    ctx.fillText('GREEN', px, py + 24);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('TO', px + 186, py + 24);
    ctx.fillStyle = PALETTE.amber;
    ctx.fillText('AMBER', px + 266, py + 24);

    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 28px ${FONT_UI}`;
    ctx.fillText('RUSH AT SIX', px, py + 84);

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 15px ${FONT_UI}`;
    ctx.fillText('At 6:00 PM a yellow taxi pulls up outside Garage 06 and flips its sign', px, py + 132);
    ctx.fillText('to BEAT 01:15. Cross 6 coral gates in order — any route you know.', px, py + 154);

    const rules = [
      { col: PALETTE.green, title: 'GREEN', desc: 'Shave -1.0s off your final time.' },
      { col: PALETTE.amber, title: 'AMBER', desc: 'Valid checkpoint. No bonus, no heat.' },
      { col: PALETTE.red, title: 'RED', desc: 'Valid, but HEAT +1. At 2 reds, Patrol chases.' },
    ];
    for (let i = 0; i < 3; i += 1) {
      const r = rules[i];
      const ry = py + 196 + i * 54;
      ctx.fillStyle = 'rgba(26, 36, 50, 0.88)';
      roundRect(ctx, px, ry, pw, 44, 9);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = r.col;
      ctx.beginPath();
      ctx.arc(px + 24, ry + 22, 8.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = r.col;
      ctx.font = `900 13px ${FONT_UI}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.title, px + 44, ry + 22);

      ctx.fillStyle = PALETTE.text;
      ctx.font = `500 13.5px ${FONT_UI}`;
      ctx.fillText(r.desc, px + 114, ry + 22);
    }

    const stripY = py + 374;
    ctx.fillStyle = 'rgba(247, 193, 44, 0.14)';
    roundRect(ctx, px, stripY, pw, 42, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(247, 193, 44, 0.38)';
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 13px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAXI METER: 01:15.00', px + 16, stripY + 21);
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'right';
    ctx.fillText(bestTime > 0 ? `BEST RECORD: ${formatTime(bestTime)}` : 'BEST RECORD: --:--.--', px + pw - 16, stripY + 21);

    drawButton('start_race', 'START RACE  [SPACE]', px, py + 436, 286, 52, true, pointer);
    drawButton('free_roam', 'FREE ROAM  [F]', px + 302, py + 436, 200, 52, false, pointer);

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12.5px ${FONT_UI}`;
    ctx.textAlign = 'left';
    ctx.fillText('WASD / Arrows: Drive   ·   Space / Shift: Handbrake Drift   ·   M: City Map', px, py + 512);
  }

  function drawFinishBoard(state, bestTime, pointer) {
    ctx.fillStyle = 'rgba(14, 20, 30, 0.56)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const bw = 640;
    const bh = 472;
    const bx = (VIEW.width - bw) * 0.5;
    const by = (VIEW.height - bh) * 0.5;

    ctx.fillStyle = PALETTE.panelSolid;
    roundRect(ctx, bx, by, bw, bh, 16);
    ctx.fill();
    ctx.strokeStyle = state.finalBeatMeter ? PALETTE.green : PALETTE.gold;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#5c6b7c';
    for (const [cx, cy] of [[bx + 16, by + 16], [bx + bw - 16, by + 16], [bx + 16, by + bh - 16], [bx + bw - 16, by + bh - 16]]) {
      ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `800 12px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('GARAGE 06 · FINISH SCOREBOARD', VIEW.width * 0.5, by + 22);

    ctx.fillStyle = state.finalBeatMeter ? PALETTE.green : PALETTE.warmSunset;
    ctx.font = `900 38px ${FONT_UI}`;
    ctx.fillText(state.finalBeatMeter ? 'BEAT THE METER!' : 'THE METER WINS', VIEW.width * 0.5, by + 44);

    ctx.fillStyle = '#111824';
    roundRect(ctx, bx + 42, by + 102, bw - 84, 96, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 11.5px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.fillText('FINAL TIME', bx + 64, by + 116);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('TAXI TARGET  01:15.00', bx + bw - 64, by + 116);

    ctx.fillStyle = state.finalBeatMeter ? PALETTE.green : PALETTE.text;
    ctx.font = `900 46px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.fillText(formatTime(state.finalTime), bx + 62, by + 134);

    const delta = state.finalTime - TARGET_TIME;
    ctx.fillStyle = delta <= 0 ? PALETTE.green : PALETTE.red;
    ctx.font = `900 24px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${delta <= 0 ? '-' : '+'}${Math.abs(delta).toFixed(2)}s`, bx + bw - 64, by + 150);

    const tileY = by + 214;
    const tileW = (bw - 84 - 24) / 3;
    const tiles = [
      {
        label: 'RAW / GREEN BONUS',
        main: formatTime(state.raceTime),
        sub: state.greenBonus > 0 ? `${state.greensHit}x GREEN  -${state.greenBonus.toFixed(1)}s` : '0 GREEN LIGHTS',
        subCol: state.greenBonus > 0 ? PALETTE.green : PALETTE.muted,
      },
      {
        label: 'GARAGE BEST RECORD',
        main: bestTime > 0 ? formatTime(bestTime) : formatTime(state.finalTime),
        sub: state.isNewRecord ? '★ NEW RECORD!' : 'ALL-TIME BEST',
        subCol: state.isNewRecord ? PALETTE.gold : PALETTE.muted,
      },
      {
        label: 'CITY KNOWLEDGE',
        main: `${state.alleysUsed.length} ALLEYS`,
        sub: state.heat >= 2 ? `HEAT ${state.heat} · OUTRAN PATROL` : `HEAT ${state.heat} · CLEAN`,
        subCol: state.heat >= 2 ? PALETTE.red : PALETTE.amber,
      },
    ];

    for (let i = 0; i < 3; i += 1) {
      const t = tiles[i];
      const tx = bx + 42 + i * (tileW + 12);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      roundRect(ctx, tx, tileY, tileW, 74, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `700 10px ${FONT_UI}`;
      ctx.textAlign = 'left';
      ctx.fillText(t.label, tx + 12, tileY + 11);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 18px ${FONT_MONO}`;
      ctx.fillText(t.main, tx + 12, tileY + 29);
      ctx.fillStyle = t.subCol;
      ctx.font = `800 11px ${FONT_UI}`;
      ctx.fillText(t.sub, tx + 12, tileY + 53);
    }

    const histY = by + 306;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 10.5px ${FONT_UI}`;
    ctx.textAlign = 'left';
    ctx.fillText('SIX LIGHTS LOG', bx + 42, histY);

    const pillW = (bw - 84 - 5 * 8) / 6;
    for (let i = 0; i < 6; i += 1) {
      const cp = state.checkpoints[i];
      const px = bx + 42 + i * (pillW + 8);
      const col = cp.passedColor >= 0 ? lightHex(cp.passedColor) : '#4f5d6e';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      roundRect(ctx, px, histY + 18, pillW, 44, 8);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = col;
      ctx.font = `900 12px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText(`#${cp.id} ${cp.passedColor >= 0 ? lightWord(cp.passedColor) : '--'}`, px + pillW * 0.5, histY + 26);

      ctx.fillStyle = PALETTE.muted;
      ctx.font = `700 10px ${FONT_MONO}`;
      const note = cp.passedColor === LIGHT_GREEN ? '-1.0s' : cp.passedColor === 2 ? 'HEAT+1' : 'VALID';
      ctx.fillText(note, px + pillW * 0.5, histY + 44);
    }

    drawButton('race_again', 'RACE AGAIN  [SPACE / R]', bx + 42, by + 392, 316, 52, true, pointer);
    drawButton('free_roam', 'FREE ROAM CITY  [F]', bx + 374, by + 392, 224, 52, false, pointer);
  }

  function drawPauseOverlay(pointer) {
    ctx.fillStyle = 'rgba(14, 20, 30, 0.68)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const w = 420;
    const h = 290;
    const x = (VIEW.width - w) * 0.5;
    const y = (VIEW.height - h) * 0.5;

    ctx.fillStyle = PALETTE.panelSolid;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = PALETTE.gold;
    ctx.font = `900 30px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('PAUSED', VIEW.width * 0.5, y + 26);

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 14px ${FONT_UI}`;
    ctx.fillText('The city lights wait at 6:00 PM.', VIEW.width * 0.5, y + 66);

    drawButton('resume', 'RESUME  [P / ESC]', x + 48, y + 106, w - 96, 44, true, pointer);
    drawButton('race_again', 'RETRY RACE  [R]', x + 48, y + 162, w - 96, 42, false, pointer);
    drawButton('free_roam', 'FREE ROAM  [F]', x + 48, y + 216, w - 96, 42, false, pointer);
  }

  function drawFullMapOverlay(state) {
    ctx.fillStyle = 'rgba(14, 20, 30, 0.9)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const mw = 780;
    const mh = 570;
    const mx = (VIEW.width - mw) * 0.5;
    const my = (VIEW.height - mh) * 0.5 + 16;

    ctx.fillStyle = PALETTE.gold;
    ctx.font = `900 22px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('SUNSET HARBOR — CITY ROUTE MAP  (PRESS M TO CLOSE)', VIEW.width * 0.5, my - 38);

    drawMinimap(state, mx, my, mw, mh, maps.fullmap, true);
  }

  function draw(state, opts) {
    const {
      bestTime = 0,
      paused = false,
      showMap = false,
      musicOn = true,
      volume = 0.72,
      pointer = { x: -1, y: -1 },
    } = opts;
    buttons.length = 0;
    sliderRect = null;

    // Clear transparent HUD overlay completely so Three.js WebGL 3D scene shines underneath!
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW.width, VIEW.height);
    ctx.clip();

    drawScreenFx(state);

    if (state.mode === MODE_TITLE) {
      drawTitleOverlay(state, bestTime, pointer);
      drawAudioBar(26, 74, musicOn, volume, pointer);
    } else if (state.mode === MODE_FINISH) {
      drawFinishBoard(state, bestTime, pointer);
      drawAudioBar(20, 20, musicOn, volume, pointer);
    } else {
      drawHud(state, bestTime, musicOn, volume, pointer);
      if (showMap && !paused) drawFullMapOverlay(state);
      if (paused) drawPauseOverlay(pointer);
    }

    ctx.restore();
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    draw,
    toLogicalPoint,
    hitTestButton,
    sampleVolumeSlider,
  };
}
