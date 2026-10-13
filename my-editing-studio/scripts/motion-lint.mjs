#!/usr/bin/env node
/**
 * Motion lint — enforces the motion laws in CLAUDE.md.
 * Catches patterns, not taste: passing lint is required, not sufficient.
 * Suppress a deliberate exception with a `// motion-ok: <reason>` comment
 * on the same line or the line above.
 * Exit code 1 when any error is found.
 */
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';

const ROOT = process.cwd();
const TOKENS_FILE = 'src/design/motion.ts';
const DESIGN_DIR = 'src/design/';

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });

const findings = [];
const report = (level, file, line, rule, msg) => findings.push({level, file, line, rule, msg});

const suppressed = (lines, ln) => /motion-ok/.test(lines[ln - 1] ?? '') || /motion-ok/.test(lines[ln - 2] ?? '');

const balancedCall = (text, openIdx) => {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return text.slice(openIdx, i + 1);
  }
  return text.slice(openIdx);
};

for (const abs of walk(join(ROOT, 'src'))) {
  const file = relative(ROOT, abs).split(sep).join('/');
  const text = readFileSync(abs, 'utf8');
  const lines = text.split('\n');
  const isTokens = file === TOKENS_FILE;
  const isDesign = file.startsWith(DESIGN_DIR);
  const isScene = /^src\/(components|compositions)\//.test(file);

  lines.forEach((raw, i) => {
    const ln = i + 1;
    if (/^\s*(\*|\/\*|\/\/)/.test(raw) || suppressed(lines, ln)) return;
    const code = raw.replace(/\s\/\/.*$/, '');

    if (/Easing\.linear\b/.test(code)) {
      report('error', file, ln, 'no-linear', 'Linear easing is banned (law 1). Use EASE tokens.');
    }
    if (!isTokens && /Easing\.bezier\s*\(|cubic-bezier\s*\(/.test(code)) {
      report('error', file, ln, 'curves-from-tokens', 'Define curves only in src/design/motion.ts and use EASE.*');
    }
    if (!isTokens && /\b(damping|stiffness|mass)\s*:/.test(code)) {
      report('error', file, ln, 'springs-from-tokens', 'Spring configs live in SPRING tokens. Use settle() or SPRING.*');
    }
    if (/\b(transition|animation|transitionDuration|animationName)\s*:/.test(code)) {
      report('error', file, ln, 'no-css-animation', 'CSS transitions/animations do not render frame-accurately in Remotion. Drive everything from useCurrentFrame().');
    }
    if (/\bwillChange\s*:|will-change/.test(code)) {
      report('error', file, ln, 'no-will-change', 'will-change makes each render tab cache layers differently, so settled elements flicker between frames. Supersample the render (--scale=2) instead.');
    }
    if (/Math\.random\s*\(/.test(code)) {
      report('error', file, ln, 'no-math-random', 'Math.random() renders differently every frame. Use random(seed) from remotion.');
    }
    for (const m of code.matchAll(/scale\(\s*(\d*\.?\d+)\s*\)/g)) {
      if (Number(m[1]) < 0.9) {
        report('error', file, ln, 'no-scale-from-zero', `scale(${m[1]}) — never scale below 0.9 (law 6).`);
      }
    }
    for (const m of code.matchAll(/scaleFrom\s*:\s*(\d*\.?\d+)/g)) {
      if (Number(m[1]) < 0.9) {
        report('warn', file, ln, 'scale-floor', `scaleFrom ${m[1]} will be clamped to 0.9 (law 6).`);
      }
    }
    for (const m of code.matchAll(/blur\(\s*(\d*\.?\d+)px/g)) {
      if (Number(m[1]) > 12) {
        report('warn', file, ln, 'blur-cap', `blur(${m[1]}px) exceeds the 12px cap (law 7). Fine only for static depth-of-field plates.`);
      }
    }
    if (isScene && /\b(durationInFrames|from)\s*=\s*\{\s*[1-9]\d*\s*\}/.test(code)) {
      report('warn', file, ln, 'magic-timing', 'Hard-coded frame number. Derive timing from the spine (words/beats) or token helpers.');
    }
    if (isScene && /\b(at|until)\s*:\s*[1-9]\d*\b/.test(code)) {
      report('warn', file, ln, 'magic-timing', 'Hard-coded frame number. Derive timing from the spine (words/beats) or token helpers.');
    }
    if (!isDesign && /['"`][^'"`]*(#[0-9a-fA-F]{3,8}\b|rgba?\()/.test(code)) {
      report('warn', file, ln, 'raw-color', 'Raw colour value. Use COLOR tokens from src/design/tokens.ts.');
    }
    if (!isDesign && /fontFamily\s*:\s*['"`]/.test(code)) {
      report('warn', file, ln, 'raw-font', 'Raw font family. Use FONT tokens from src/design/tokens.ts.');
    }
  });

  for (const m of text.matchAll(/\binterpolate\s*\(/g)) {
    const ln = text.slice(0, m.index).split('\n').length;
    if (suppressed(lines, ln)) continue;
    const call = balancedCall(text, m.index + m[0].length - 1);
    if (!/\beasing\b/.test(call)) {
      report('error', file, ln, 'interpolate-needs-easing', 'interpolate() without easing is linear motion (law 1). Use EASE.*, a helper from src/lib/animate.ts, or mark a pure value mapping with // motion-ok.');
    }
    const lineStart = text.lastIndexOf('\n', m.index) + 1;
    if (/scale\s*[:=]\s*$/i.test(text.slice(lineStart, m.index))) {
      const outputRange = [...call.matchAll(/\[([^[\]]*)\]/g)][1]?.[1];
      const first = outputRange?.split(',')[0]?.trim();
      if (first !== undefined && first !== '' && Number(first) < 0.9) {
        report('error', file, ln, 'no-scale-from-zero', `Scale animates from ${first} — never below 0.9 (law 6).`);
      }
    }
  }
}

const errors = findings.filter((f) => f.level === 'error');
const warns = findings.filter((f) => f.level === 'warn');

for (const f of [...errors, ...warns]) {
  console.log(`${f.level === 'error' ? 'ERROR' : 'warn '}  ${f.file}:${f.line}  [${f.rule}]  ${f.msg}`);
}
console.log(`\nmotion-lint: ${errors.length} error(s), ${warns.length} warning(s)`);
process.exit(errors.length > 0 ? 1 : 0);
