// Offline Procedural Web Audio Engine:
// - Seamless 16-bar Sunset Funk-Synth instrumental (light funk drums, moving synth bass,
//   warm Rhodes-style chord stabs, and a catchy short synth melody) at 114 BPM
// - Strictly single-instance lookahead scheduler (Retry never stacks or duplicates loops!)
// - Independent Music On/Off toggle + continuous Master Volume control (0..1)
// - Subtle low-passed rally engine & tire/siren SFX carefully mixed underneath the music

import { CAR } from './config.js';
import { SURFACE_ALLEY } from './city.js';
import {
  EVENT_COUNTDOWN_TICK,
  EVENT_CP_AMBER,
  EVENT_CP_GREEN,
  EVENT_CP_RED,
  EVENT_CRASH,
  EVENT_FINISH,
  EVENT_HONK,
  EVENT_PATROL_RAM,
  EVENT_PATROL_SPAWN,
  EVENT_RACE_START,
  MODE_COUNTDOWN,
  MODE_FREEROAM,
  MODE_RACE,
} from './world.js';

const BPM = 114;
const STEP_DUR = 60 / BPM / 4; // 16th-note duration (~0.13158 s)
const TOTAL_STEPS = 256;       // 16 bars x 16 sixteenth notes

function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 16-bar Sunset Funk-Synth chord progression (D Dorian / F Major7 coastal groove)
const CHORDS = [
  // Bars 1-4 (A1): Dm9 -> G13 -> Cmaj9 -> A7#5
  [50, 53, 57, 60, 64], [55, 59, 62, 65, 69], [48, 52, 55, 59, 62], [45, 49, 53, 55, 60],
  // Bars 5-8 (A2): Dm9 -> G13 -> Em7 -> A7sus4
  [50, 53, 57, 60, 64], [55, 59, 62, 65, 69], [52, 55, 59, 62, 67], [45, 50, 55, 57, 61],
  // Bars 9-12 (B Hook): Bbmaj7 -> C9 -> Am7 -> Dm9
  [46, 50, 53, 57, 62], [48, 52, 55, 58, 62], [45, 48, 52, 55, 60], [50, 53, 57, 60, 64],
  // Bars 13-16 (C Turnaround): Gm9 -> C13 -> Fmaj9 -> A7alt
  [43, 46, 50, 53, 57], [48, 52, 55, 58, 64], [41, 45, 48, 52, 55], [45, 49, 55, 58, 61],
];

// Root notes for each bar's moving funk bassline
const BASS_ROOTS = [
  38, 43, 36, 33,  // D2, G2, C2, A1
  38, 43, 40, 33,  // D2, G2, E2, A1
  34, 36, 33, 38,  // Bb1, C2, A1, D2
  31, 36, 29, 33,  // G1, C2, F1, A1
];

// Active 16th-note bass groove offsets relative to bar root (null = rest)
const BASS_PATTERN_A = [0, null, 12, null, null, 7, 10, null, 0, null, 12, 10, null, 7, 5, 7];
const BASS_PATTERN_B = [0, null, null, 12, null, 10, 7, null, 0, 12, null, 7, 10, null, 12, 14];

// Memorable short catchy funk-synth melody motifs (MIDI notes per 16th step, 4-bar phrases)
const MELODY_A1 = [
  // Bar 1 (Dm9)
  74, null, 77, null, 76, null, 72, 74, null, null, 69, null, 72, null, 74, null,
  // Bar 2 (G13)
  null, null, 79, null, 77, 76, 74, null, 72, null, null, 74, null, 72, 69, null,
  // Bar 3 (Cmaj9)
  67, null, 71, null, 74, null, 76, null, null, 74, 72, null, 71, null, 67, null,
  // Bar 4 (A7#5) - crisp turnaround riff
  69, null, null, 72, null, 74, null, 76, null, null, 73, null, null, null, null, null,
];

const MELODY_A2 = [
  // Bar 5 (Dm9)
  74, null, 77, 79, 81, null, 79, 77, null, 74, null, null, 72, null, 74, null,
  // Bar 6 (G13)
  null, null, 79, null, 81, null, 79, 76, 74, null, null, 72, 74, null, 76, null,
  // Bar 7 (Em7)
  79, null, 76, null, 74, null, 71, null, null, 74, 76, null, 79, null, 76, null,
  // Bar 8 (A7sus4)
  74, null, 76, null, 74, null, 73, null, null, null, 69, null, 72, null, 74, null,
];

const MELODY_B = [
  // Bar 9 (Bbmaj7) - uplifting sunset chorus hook!
  81, null, 81, 79, 77, null, 74, null, 77, null, 79, null, 81, null, null, null,
  // Bar 10 (C9)
  79, null, 79, 76, 74, null, 72, null, 74, null, 76, null, 79, null, null, null,
  // Bar 11 (Am7)
  76, null, 79, null, 81, null, 84, null, 81, null, 79, null, 76, null, 74, null,
  // Bar 12 (Dm9)
  74, null, null, 72, 74, null, 77, null, null, null, 74, null, null, null, null, null,
];

const MELODY_C = [
  // Bar 13 (Gm9) - light funky call-and-response breathing space
  null, null, 74, null, 77, null, 74, null, 70, null, 74, null, 77, null, 79, null,
  // Bar 14 (C13)
  76, null, null, 74, 72, null, 76, null, null, 74, 72, null, 70, null, 69, null,
  // Bar 15 (Fmaj9)
  69, null, 72, null, 74, null, 77, null, 79, null, 77, null, 74, null, 72, null,
  // Bar 16 (A7alt) - crisp pickup back to Bar 1!
  73, null, null, 76, null, 79, null, 81, null, null, 79, null, 76, null, 73, null,
];

const FULL_MELODY = [...MELODY_A1, ...MELODY_A2, ...MELODY_B, ...MELODY_C];

// Crisp light funk drum patterns (16 steps/bar)
const KICK_STEPS = new Set([0, 6, 8, 11]);
const SNARE_STEPS = new Set([4, 12]);
const GHOST_SNARE = new Set([7, 15]);
const CHORD_STABS = new Set([2, 6, 10, 14]);

export function createAudio() {
  let ctx = null;
  let masterGain = null;
  let compressor = null;
  let musicGain = null;
  let musicAnalyser = null;
  let analyserBuf = null;
  let sfxGain = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let screechGain = null;
  let screechFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let noiseBuf = null;

  let unlocked = false;
  let musicEnabled = true;
  let musicStarted = false;
  let volume = 0.78;
  let notesScheduled = 0;

  // Strictly single-instance lookahead scheduler state
  let schedulerTimer = null;
  let activeSchedulerCount = 0;
  let nextStepTime = 0;
  let stepIndex = 0;

  function makeNoiseBuffer(audioCtx) {
    const length = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function applyVolumes(immediate = false) {
    if (!ctx || !masterGain || !musicGain) return;
    const now = ctx.currentTime;
    const targetMusic = musicEnabled ? 0.88 : 0;
    if (immediate || now < 0.05) {
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(volume, now);
      musicGain.gain.cancelScheduledValues(now);
      musicGain.gain.setValueAtTime(targetMusic, now);
    } else {
      masterGain.gain.setTargetAtTime(volume, now, 0.025);
      musicGain.gain.setTargetAtTime(targetMusic, now, 0.03);
    }
  }

  function resumeContext() {
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        applyVolumes(true);
        if (musicStarted) {
          if (nextStepTime < ctx.currentTime) {
            nextStepTime = ctx.currentTime + 0.02;
          }
          tickScheduler();
        }
      }).catch(() => {});
    }
  }

  function unlock() {
    if (unlocked) {
      resumeContext();
      return true;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    try {
      ctx = new AudioCtx();
      noiseBuf = makeNoiseBuffer(ctx);

      // Gentle master dynamics compressor so the Sunset Funk-Synth groove stays punchy & clear without clipping
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -10;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.14;
      compressor.connect(ctx.destination);

      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(compressor);

      musicGain = ctx.createGain();
      musicGain.gain.value = musicEnabled ? 0.88 : 0;
      musicGain.connect(masterGain);

      // Lightweight tap to verify live music signal level
      musicAnalyser = ctx.createAnalyser();
      musicAnalyser.fftSize = 256;
      analyserBuf = new Float32Array(musicAnalyser.fftSize);
      musicGain.connect(musicAnalyser);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.56;
      sfxGain.connect(masterGain);

      // Subtle warm low-passed engine hum (strictly tucked underneath the funk-synth music!)
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 220;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;

      engineOsc1 = ctx.createOscillator();
      engineOsc1.type = 'triangle';
      engineOsc1.frequency.value = 54;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 108;

      const osc2Mix = ctx.createGain();
      osc2Mix.gain.value = 0.28;
      engineOsc1.connect(engineFilter);
      engineOsc2.connect(osc2Mix);
      osc2Mix.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(sfxGain);
      engineOsc1.start();
      engineOsc2.start();

      // Gentle tire screech / cobble texture
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      noise.loop = true;
      screechFilter = ctx.createBiquadFilter();
      screechFilter.type = 'bandpass';
      screechFilter.frequency.value = 1200;
      screechFilter.Q.value = 4.2;
      screechGain = ctx.createGain();
      screechGain.gain.value = 0;
      noise.connect(screechFilter);
      screechFilter.connect(screechGain);
      screechGain.connect(sfxGain);
      noise.start();

      // Distance-attenuated police patrol siren
      const sirenFilter = ctx.createBiquadFilter();
      sirenFilter.type = 'bandpass';
      sirenFilter.frequency.value = 840;
      sirenFilter.Q.value = 1.6;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sawtooth';
      sirenOsc.frequency.value = 660;
      sirenOsc.connect(sirenFilter);
      sirenFilter.connect(sirenGain);
      sirenGain.connect(sfxGain);
      sirenOsc.start();

      // Silent 1-sample buffer wake-up for strict browser/WebView autoplay policies
      try {
        const wakeBuf = ctx.createBuffer(1, 1, 22050);
        const wakeSrc = ctx.createBufferSource();
        wakeSrc.buffer = wakeBuf;
        wakeSrc.connect(ctx.destination);
        wakeSrc.start(0);
      } catch {
        // Ignore if not supported
      }

      ctx.onstatechange = () => {
        if (ctx && ctx.state === 'running' && musicStarted) {
          applyVolumes(true);
          if (nextStepTime < ctx.currentTime) {
            nextStepTime = ctx.currentTime + 0.02;
          }
          tickScheduler();
        }
      };

      unlocked = true;
      resumeContext();
      applyVolumes(true);
      return true;
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------------ 16-BAR SUNSET FUNK-SYNTH SYNTHESIZER

  function trigKick(time) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(138, time);
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.095);
    g.gain.setValueAtTime(0.52, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(time);
    osc.stop(time + 0.17);
  }

  function trigSnare(time, ghost = false) {
    const vol = ghost ? 0.09 : 0.28;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(ghost ? 2400 : 1850, time);
    flt.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + (ghost ? 0.055 : 0.12));
    src.connect(flt);
    flt.connect(g);
    g.connect(musicGain);
    src.start(time);
    src.stop(time + 0.14);

    if (!ghost) {
      const body = ctx.createOscillator();
      const bg = ctx.createGain();
      body.type = 'triangle';
      body.frequency.setValueAtTime(210, time);
      body.frequency.exponentialRampToValueAtTime(120, time + 0.065);
      bg.gain.setValueAtTime(0.20, time);
      bg.gain.exponentialRampToValueAtTime(0.001, time + 0.085);
      body.connect(bg);
      bg.connect(musicGain);
      body.start(time);
      body.stop(time + 0.10);
    }
  }

  function trigHat(time, open = false, accent = false) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(6800, time);
    const g = ctx.createGain();
    const vol = open ? 0.13 : accent ? 0.095 : 0.055;
    const dur = open ? 0.16 : 0.04;
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0008, time + dur);
    src.connect(hp);
    hp.connect(g);
    g.connect(musicGain);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  function trigBass(time, midiNote, durSteps = 1.6) {
    const freq = midiToHz(midiNote);
    const dur = STEP_DUR * durSteps;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    const sub = ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(freq, time);

    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.Q.value = 3.0;
    flt.frequency.setValueAtTime(220, time);
    flt.frequency.exponentialRampToValueAtTime(1400, time + 0.022);
    flt.frequency.exponentialRampToValueAtTime(340, time + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(0.34, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur + 0.03);

    osc.connect(flt);
    sub.connect(flt);
    flt.connect(g);
    g.connect(musicGain);
    osc.start(time);
    sub.start(time);
    osc.stop(time + dur + 0.05);
    sub.stop(time + dur + 0.05);
  }

  function trigRhodesChord(time, notes) {
    const dur = STEP_DUR * 2.3;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(2150, time);
    flt.frequency.exponentialRampToValueAtTime(940, time + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(0.14, time + 0.014);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur + 0.04);

    flt.connect(g);
    g.connect(musicGain);

    for (let i = 0; i < notes.length; i += 1) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(midiToHz(notes[i]), time);
      osc.connect(flt);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    }
  }

  function trigLead(time, midiNote, durSteps = 1.8) {
    const freq = midiToHz(midiNote);
    const dur = STEP_DUR * durSteps;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 1.004, time);

    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.Q.value = 1.9;
    flt.frequency.setValueAtTime(2900, time);
    flt.frequency.exponentialRampToValueAtTime(1350, time + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(0.24, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur + 0.08);

    osc1.connect(flt);
    osc2.connect(flt);
    flt.connect(g);
    g.connect(musicGain);
    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur + 0.1);
    osc2.stop(time + dur + 0.1);
  }

  function scheduleMusicStep(idx, time) {
    const bar = Math.floor(idx / 16) % 16;
    const s = idx % 16;
    const chord = CHORDS[bar];
    const bassRoot = BASS_ROOTS[bar];

    // 1. Light funk drums
    if (KICK_STEPS.has(s) || (bar % 2 === 1 && s === 14)) trigKick(time);
    if (SNARE_STEPS.has(s)) trigSnare(time, false);
    else if (GHOST_SNARE.has(s) && (bar % 2 === 0 || s === 15)) trigSnare(time, true);
    const openHat = s === 14 && (bar % 4 === 3);
    trigHat(time, openHat, s % 2 === 0);

    // 2. Moving funk synth bass
    const bassPat = bar % 2 === 0 ? BASS_PATTERN_A : BASS_PATTERN_B;
    const bassOff = bassPat[s];
    if (bassOff !== null) {
      trigBass(time, bassRoot + bassOff, s % 4 === 0 ? 1.8 : 1.25);
    }

    // 3. Warm sunset Rhodes chord stabs
    if (CHORD_STABS.has(s) && !(bar % 4 === 3 && s === 14)) {
      trigRhodesChord(time, chord);
    }

    // 4. Catchy short funk-synth lead melody
    const leadNote = FULL_MELODY[idx];
    if (leadNote !== null) {
      const nextNote = FULL_MELODY[(idx + 1) % TOTAL_STEPS];
      trigLead(time, leadNote, nextNote === null ? 2.1 : 1.15);
    }
  }

  function tickScheduler() {
    if (!ctx || !musicStarted) return;
    if (ctx.state === 'suspended') return;
    // Catch up gracefully if tab was backgrounded so notes never burst-stack!
    if (nextStepTime < ctx.currentTime - 0.25) {
      nextStepTime = ctx.currentTime + 0.03;
    }
    const lookahead = 0.16;
    while (nextStepTime < ctx.currentTime + lookahead) {
      if (musicEnabled) {
        scheduleMusicStep(stepIndex, nextStepTime);
        notesScheduled += 1;
      }
      stepIndex = (stepIndex + 1) % TOTAL_STEPS;
      nextStepTime += STEP_DUR;
    }
  }

  /** Start the 16-bar funk-synth soundtrack cleanly once (safe to call on Retry — never stacks!). */
  function startMusic() {
    if (!unlock() || !ctx) return;
    resumeContext();
    if (musicStarted && schedulerTimer !== null) {
      // Already playing cleanly on a single scheduler — do NOT start a second loop!
      applyVolumes(true);
      tickScheduler();
      return;
    }
    musicStarted = true;
    stepIndex = 0;
    nextStepTime = ctx.currentTime + 0.02;
    schedulerTimer = window.setInterval(tickScheduler, 25);
    activeSchedulerCount = 1;
    applyVolumes(true);
    tickScheduler();
  }

  function setMusicEnabled(enabled) {
    musicEnabled = Boolean(enabled);
    if (musicEnabled && !musicStarted && unlocked) {
      startMusic();
    }
    applyVolumes();
    return musicEnabled;
  }

  function toggleMusic() {
    unlock();
    return setMusicEnabled(!musicEnabled);
  }

  function setVolume(nextVol) {
    volume = Math.max(0, Math.min(1, nextVol));
    applyVolumes();
    return volume;
  }

  // ------------------------------------------------------------------ SFX HELPERS

  function tone(freq, duration, type = 'sine', vol = 0.22, delay = 0, slideTo = null) {
    if (!ctx || volume <= 0.001) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function burstNoise(duration, filterFreq, vol = 0.2) {
    if (!ctx || !noiseBuf || volume <= 0.001) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(filterFreq, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(flt);
    flt.connect(g);
    g.connect(sfxGain);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  function playEvents(events, state) {
    if (!ctx || events === 0 || volume <= 0.001) return;

    if (events & EVENT_COUNTDOWN_TICK) tone(520, 0.13, 'triangle', 0.22);
    if (events & EVENT_RACE_START) {
      tone(392, 0.10, 'sawtooth', 0.10, 0);
      tone(493.88, 0.10, 'sawtooth', 0.10, 0);
      tone(880, 0.30, 'triangle', 0.26, 0.02);
    }
    if (events & EVENT_CP_GREEN) {
      tone(587.33, 0.15, 'triangle', 0.24, 0);
      tone(739.99, 0.17, 'triangle', 0.24, 0.06);
      tone(880.0, 0.24, 'sine', 0.26, 0.12);
      tone(1174.66, 0.30, 'sine', 0.16, 0.18);
    }
    if (events & EVENT_CP_AMBER) {
      tone(493.88, 0.15, 'triangle', 0.20, 0);
      tone(659.25, 0.20, 'triangle', 0.18, 0.07);
    }
    if (events & EVENT_CP_RED) {
      burstNoise(0.06, 2600, 0.20);
      tone(220, 0.17, 'sawtooth', 0.19, 0.02, 165);
      tone(196, 0.20, 'sawtooth', 0.20, 0.15, 140);
    }
    if (events & EVENT_PATROL_SPAWN) {
      tone(1320, 0.06, 'square', 0.12, 0.04);
      tone(980, 0.08, 'square', 0.12, 0.11);
      tone(620, 0.32, 'sawtooth', 0.16, 0.22, 1080);
    }
    if (events & EVENT_CRASH) {
      burstNoise(0.16, 480, 0.28);
      tone(110, 0.14, 'triangle', 0.22, 0, 48);
    }
    if (events & EVENT_PATROL_RAM) {
      burstNoise(0.22, 680, 0.34);
      tone(130, 0.18, 'sawtooth', 0.22, 0, 52);
    }
    if (events & EVENT_HONK) {
      tone(349.23, 0.14, 'sawtooth', 0.07, 0);
      tone(440.0, 0.14, 'sawtooth', 0.07, 0);
    }
    if (events & EVENT_FINISH) {
      if (state.finalBeatMeter) {
        tone(523.25, 0.20, 'triangle', 0.24, 0);
        tone(659.25, 0.20, 'triangle', 0.24, 0.09);
        tone(783.99, 0.24, 'triangle', 0.26, 0.18);
        tone(1046.5, 0.48, 'sine', 0.26, 0.28);
      } else {
        tone(440, 0.22, 'triangle', 0.20, 0);
        tone(392, 0.26, 'triangle', 0.20, 0.16);
        tone(349.23, 0.46, 'sine', 0.20, 0.34);
      }
    }
  }

  function updateContinuous(state, paused) {
    if (!ctx || !unlocked) return;
    // Also pump the music scheduler from rAF so it never stalls if timers are throttled
    if (musicStarted && ctx.state === 'running') {
      tickScheduler();
    }
    const now = ctx.currentTime;
    const activeDrive = !paused && (state.mode === MODE_RACE || state.mode === MODE_FREEROAM || state.mode === MODE_COUNTDOWN);

    if (!activeDrive || volume <= 0.001) {
      engineGain.gain.setTargetAtTime(0, now, 0.08);
      screechGain.gain.setTargetAtTime(0, now, 0.06);
      sirenGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    const p = state.player;
    const norm = Math.min(1.1, p.speed / CAR.maxSpeed);
    const gearPos = (norm * 3.4) % 1;
    const rpm = state.mode === MODE_COUNTDOWN
      ? (p.throttle > 0 ? 0.48 + Math.sin(state.simTime * 18) * 0.06 : 0.10)
      : Math.min(1, 0.18 + norm * 0.44 + gearPos * 0.42);
    const baseFreq = 50 + rpm * 108;

    // Engine kept intentionally gentle & warm so the sunset funk-synth soundtrack stays front-and-center!
    engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
    engineOsc2.frequency.setTargetAtTime(baseFreq * 2.0, now, 0.05);
    engineFilter.frequency.setTargetAtTime(190 + rpm * 420 + p.throttle * 140, now, 0.06);
    engineGain.gain.setTargetAtTime(0.022 + p.throttle * 0.024 + norm * 0.018, now, 0.06);

    const slip = Math.abs(p.lateralSpeed);
    const screechAmt = p.drifting && slip > 55 ? Math.min(0.085, (slip - 42) / 900) : 0;
    const cobbleAmt = p.surface === SURFACE_ALLEY && p.speed > 55 ? Math.min(0.03, (p.speed / CAR.maxSpeed) * 0.028) : 0;

    if (screechAmt > cobbleAmt) {
      screechFilter.frequency.setTargetAtTime(1120 + slip * 3, now, 0.05);
      screechFilter.Q.setTargetAtTime(4.5, now, 0.05);
      screechGain.gain.setTargetAtTime(screechAmt, now, 0.04);
    } else if (cobbleAmt > 0) {
      screechFilter.frequency.setTargetAtTime(240 + p.speed * 0.5, now, 0.05);
      screechFilter.Q.setTargetAtTime(1.5, now, 0.05);
      screechGain.gain.setTargetAtTime(cobbleAmt, now, 0.05);
    } else {
      screechGain.gain.setTargetAtTime(0, now, 0.06);
    }

    if (state.patrol.active && state.mode === MODE_RACE) {
      const dist = state.patrol.distance;
      const prox = Math.max(0, 1 - dist / 1450);
      const twoTone = Math.sin(state.patrol.sirenPhase) > 0 ? 785 : 590;
      sirenOsc.frequency.setTargetAtTime(twoTone, now, 0.025);
      sirenGain.gain.setTargetAtTime(prox * prox * 0.11 + 0.012, now, 0.06);
    } else {
      sirenGain.gain.setTargetAtTime(0, now, 0.08);
    }
  }

  return {
    unlock,
    startMusic,
    toggleMusic,
    setMusicEnabled,
    setVolume,
    isMusicEnabled: () => musicEnabled,
    isMusicPlaying: () => musicStarted && musicEnabled,
    getVolume: () => volume,
    debugInfo: () => {
      let musicRms = 0;
      let musicPeak = 0;
      if (musicAnalyser && analyserBuf) {
        musicAnalyser.getFloatTimeDomainData(analyserBuf);
        let sumSq = 0;
        for (let i = 0; i < analyserBuf.length; i += 1) {
          const v = analyserBuf[i];
          const av = Math.abs(v);
          if (av > musicPeak) musicPeak = av;
          sumSq += v * v;
        }
        musicRms = Math.sqrt(sumSq / analyserBuf.length);
      }
      return {
        unlocked,
        ctxState: ctx ? ctx.state : 'none',
        currentTime: ctx ? Number(ctx.currentTime.toFixed(3)) : 0,
        musicStarted,
        musicEnabled,
        schedulerCount: activeSchedulerCount,
        volume,
        stepIndex,
        notesScheduled,
        musicRms: Number(musicRms.toFixed(4)),
        musicPeak: Number(musicPeak.toFixed(4)),
      };
    },
    playEvents,
    updateContinuous,
  };
}
