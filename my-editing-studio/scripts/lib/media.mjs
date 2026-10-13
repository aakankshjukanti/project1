/**
 * Shared media helpers for the analysis scripts (beats, sync, reference style).
 * Everything goes through ffmpeg; nothing here needs Python or a GPU.
 */
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

/** The studio root, found from this file rather than from wherever the shell happens to be. */
const STUDIO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Find ffmpeg wherever this machine keeps it, in order of how reliable it is:
 *
 *   1. $FFMPEG / $FFPROBE, for anyone who knows exactly what they want.
 *   2. The ffmpeg-static / ffprobe-static packages, which ship a binary per platform and
 *      arrive with `npm install`. This is the one that makes a fresh machine just work —
 *      no Homebrew, no winget, no PATH editing, nothing for anyone to get wrong.
 *   3. Whatever is on PATH.
 *   4. The usual install locations per platform.
 *
 * Every script goes through this, so a studio behaves the same on a Mac laptop as on a
 * Windows desktop, and the same for us as for someone who bought it this morning.
 */
const require_ = createRequire(import.meta.url);

const fromPackage = (tool) => {
  try {
    const mod = require_(`${tool}-static`);
    const resolved = typeof mod === 'string' ? mod : mod?.path;
    return resolved && existsSync(resolved) ? resolved : null;
  } catch {
    return null; // Not installed — fall through to the system copy.
  }
};

const locate = (tool) => {
  const fromEnv = process.env[tool.toUpperCase()];
  if (fromEnv) return fromEnv;

  const packaged = fromPackage(tool);
  if (packaged) return packaged;

  const win = process.platform === 'win32';
  const exe = win ? `${tool}.exe` : tool;

  // On PATH is the common case once the installer has run.
  const which = spawnSync(win ? 'where' : 'which', [exe], {encoding: 'utf8'});
  if (which.status === 0) {
    const hit = which.stdout.split('\n')[0].trim();
    if (hit) return hit;
  }

  const candidates = win
    ? [`C:\\ffmpeg\\bin\\${exe}`, `D:\\Tools\\ffmpeg\\bin\\${exe}`, `${process.env.LOCALAPPDATA}\\ffmpeg\\bin\\${exe}`]
    : [`/opt/homebrew/bin/${exe}`, `/usr/local/bin/${exe}`, `/usr/bin/${exe}`, `${process.env.HOME}/.local/bin/${exe}`];
  for (const c of candidates) if (c && existsSync(c)) return c;

  // Fall back to the bare name so the error says "not found" rather than a wrong path.
  return exe;
};

export const FFMPEG = locate('ffmpeg');
export const FFPROBE = locate('ffprobe');

/**
 * The Python that has the studio's packages. A virtual environment inside the studio wins,
 * then $PYTHON, then whatever is on PATH. Mac and Linux answer to `python3`; a bare
 * `python` there is often Python 2 or nothing at all.
 */
export const PYTHON = (() => {
  if (process.env.PYTHON) return process.env.PYTHON;
  const win = process.platform === 'win32';
  // Resolved against the studio, not the cwd: run any of these scripts from another folder
  // and a cwd-relative path silently misses the venv, falls through to whatever python is
  // on PATH, and dies with ModuleNotFoundError as though nothing had ever been installed.
  const venv = win ? join(STUDIO, '.venv', 'Scripts', 'python.exe') : join(STUDIO, '.venv', 'bin', 'python3');
  if (existsSync(venv)) return venv;
  for (const name of win ? ['python.exe', 'python3.exe'] : ['python3', 'python']) {
    const which = spawnSync(win ? 'where' : 'which', [name], {encoding: 'utf8'});
    if (which.status === 0) {
      const hit = which.stdout.split('\n')[0].trim();
      if (hit) return hit;
    }
  }
  return win ? 'python' : 'python3';
})();

export function run(bin, args, opts = {}) {
  const r = spawnSync(bin, args, {encoding: 'utf8', maxBuffer: 1024 * 1024 * 256, ...opts});
  return {ok: r.status === 0, out: r.stdout || '', err: r.stderr || '', status: r.status};
}

export function probe(path) {
  const r = run(FFPROBE, [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path,
  ]);
  if (!r.ok) return null;
  try {
    const data = JSON.parse(r.out);
    const v = (data.streams || []).find((s) => s.codec_type === 'video');
    const a = (data.streams || []).find((s) => s.codec_type === 'audio');
    const [n, d] = String(v?.r_frame_rate || '0/1').split('/').map(Number);
    return {
      duration: Number(data.format?.duration || 0),
      width: v?.width ?? 0,
      height: v?.height ?? 0,
      fps: d ? n / d : 0,
      hasAudio: Boolean(a),
    };
  } catch {
    return null;
  }
}

/** Decode any media's audio to mono float32 samples at the given rate. */
export function decodePcm(path, rate = 22050) {
  const r = spawnSync(
    FFMPEG,
    ['-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'],
    {maxBuffer: 1024 * 1024 * 512, encoding: 'buffer'},
  );
  if (r.status !== 0 || !r.stdout?.length) return null;
  const buf = r.stdout;
  const usable = buf.length - (buf.length % 4);
  return new Float32Array(buf.buffer, buf.byteOffset, usable / 4);
}

/** In-place iterative radix-2 FFT. re/im are Float64Array of length 2^k. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/**
 * Onset strength over time (spectral flux): how much new energy arrives in each
 * short window. This is the signal every beat and cut detector is built on.
 */
export function onsetEnvelope(samples, rate, {frameSize = 1024, hop = 512} = {}) {
  const frames = Math.max(0, Math.floor((samples.length - frameSize) / hop));
  const env = new Float64Array(frames);
  const window = new Float64Array(frameSize);
  for (let i = 0; i < frameSize; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1));
  let prev = new Float64Array(frameSize / 2);
  const re = new Float64Array(frameSize);
  const im = new Float64Array(frameSize);
  for (let f = 0; f < frames; f++) {
    const off = f * hop;
    for (let i = 0; i < frameSize; i++) {
      re[i] = samples[off + i] * window[i];
      im[i] = 0;
    }
    fft(re, im);
    let flux = 0;
    const mag = new Float64Array(frameSize / 2);
    for (let b = 0; b < frameSize / 2; b++) {
      const m = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
      mag[b] = m;
      const diff = m - prev[b];
      if (diff > 0) flux += diff;
    }
    env[f] = flux;
    prev = mag;
  }
  return {env, hopSeconds: hop / rate};
}

/** Loudness envelope, used for lining two recordings up against each other. */
export function energyEnvelope(samples, rate, hop = 256) {
  const frames = Math.floor(samples.length / hop);
  const env = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = 0; i < hop; i++) {
      const s = samples[f * hop + i];
      sum += s * s;
    }
    env[f] = Math.sqrt(sum / hop);
  }
  return {env, hopSeconds: hop / rate};
}

export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const fmt = (n, d = 2) => Number(n).toFixed(d);
export const timecode = (sec) => {
  const s = Math.max(0, sec);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
};
