// Packaging and validation entrypoint for Green to Amber: Rush at Six (Node 22+, stdlib only).
// Validates the offline 3D city racing game under game/ and its 3-4 gameplay screenshots under
// screenshots/, copies both cleanly to /output (or MAKEFUN_OUTPUT_DIR), and writes dossier.json
// using the vendored buildDossier helper.
//
// Local play:
//   node serve.ts   -> http://localhost:8080
// Local packaging test:
//   MAKEFUN_OUTPUT_DIR=./out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildDossier,
  htmlFacts,
  isRelativeRef,
  readGameTree,
  resolveGamePath,
} from './vendor/makefun-game.ts';

const GAME_TITLE = 'Green to Amber: Rush at Six';
const REQUIRED_GAME_FILES = [
  'index.html',
  'src/main.js',
  'src/config.js',
  'src/city.js',
  'src/world.js',
  'src/scene3d.js',
  'src/render.js',
  'src/audio.js',
  'src/input.js',
  'src/textures.js',
  'src/random.js',
  'src/shots.js',
  'vendor/three.module.js',
  'vendor/three.core.js',
] as const;

const SCREENSHOT_MIN = 3;
const SCREENSHOT_MAX = 4;
const SCREENSHOT_MAX_BYTES = 262144;
const ALLOWED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg']);

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: SCREENSHOT_MAX, max_bytes: SCREENSHOT_MAX_BYTES },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

function validateGame(gameDir: string): { fileCount: number; totalBytes: number } {
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    throw new Error(`Missing game directory: ${gameDir}`);
  }

  for (const rel of REQUIRED_GAME_FILES) {
    const full = join(gameDir, rel);
    if (!existsSync(full) || !statSync(full).isFile()) {
      throw new Error(`Missing required game file: game/${rel}`);
    }
  }

  const tree = readGameTree(gameDir, {
    game_max_files: CAPS.game_max_files,
    game_max_bytes: CAPS.game_max_bytes,
    game_path_max_bytes: CAPS.game_path_max_bytes,
  });

  const indexHtml = readFileSync(join(gameDir, 'index.html'), 'utf8');
  if (!indexHtml.includes(GAME_TITLE)) {
    throw new Error(`game/index.html must reference "${GAME_TITLE}"`);
  }

  // Ensure all HTML script/link/media references stay local & offline inside game/.
  const facts = htmlFacts(indexHtml);
  const refs: string[] = [
    ...facts.scripts.flatMap((s) => (s.src ? [s.src] : [])),
    ...facts.links.map((l) => l.href),
    ...facts.resources.map((r) => r.src),
  ];
  for (const ref of refs) {
    if (!isRelativeRef(ref)) {
      throw new Error(`Non-relative external reference in game/index.html: ${ref}`);
    }
    const resolved = resolveGamePath(ref, 'index.html');
    if (!resolved || !existsSync(join(gameDir, resolved))) {
      throw new Error(`Unresolved asset reference in game/index.html: ${ref}`);
    }
  }

  return { fileCount: tree.files.length, totalBytes: tree.totalBytes };
}

function validateScreenshots(shotsDir: string): string[] {
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
    throw new Error(`Missing screenshots directory: ${shotsDir}`);
  }

  const names = readdirSync(shotsDir)
    .filter((name) => !name.startsWith('.'))
    .sort();

  if (names.length < SCREENSHOT_MIN || names.length > SCREENSHOT_MAX) {
    throw new Error(
      `Expected ${SCREENSHOT_MIN}-${SCREENSHOT_MAX} screenshots in screenshots/, found ${names.length}`,
    );
  }

  for (const name of names) {
    const full = join(shotsDir, name);
    const st = statSync(full);
    if (!st.isFile()) {
      throw new Error(`Screenshot entry is not a regular file: screenshots/${name}`);
    }
    const ext = extname(name).toLowerCase();
    if (!ALLOWED_IMAGE_EXTS.has(ext)) {
      throw new Error(`Unsupported screenshot extension: screenshots/${name}`);
    }
    if (st.size === 0 || st.size > SCREENSHOT_MAX_BYTES) {
      throw new Error(
        `Screenshot size out of bounds (${st.size} bytes, max ${SCREENSHOT_MAX_BYTES}): screenshots/${name}`,
      );
    }
  }

  return names;
}

const here = fileURLToPath(new URL('.', import.meta.url));
const gameSrc = join(here, 'game');
const shotsSrc = join(here, 'screenshots');
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameSummary = validateGame(gameSrc);
const screenshots = validateScreenshots(shotsSrc);

mkdirSync(out, { recursive: true });
const outGame = join(out, 'game');
const outShots = join(out, 'screenshots');
if (existsSync(outGame)) rmSync(outGame, { recursive: true, force: true });
if (existsSync(outShots)) rmSync(outShots, { recursive: true, force: true });

cpSync(gameSrc, outGame, { recursive: true });
mkdirSync(outShots, { recursive: true });
for (const name of screenshots) {
  cpSync(join(shotsSrc, name), join(outShots, name));
}

const dossierBytes = buildDossier(out, CAPS);
writeFileSync(join(out, 'dossier.json'), dossierBytes);

console.log(
  `Packaged "${GAME_TITLE}" -> ${out} (${gameSummary.fileCount} game files, ${screenshots.length} screenshots, dossier.json ${dossierBytes.length} bytes)`,
);
