#!/usr/bin/env node
/**
 * Start a new video project with its own folders, so assets from different videos never mix.
 *
 *   npm run new-video -- <name>        e.g.  npm run new-video -- founder-story
 *
 * Creates:
 *   assets/projects/<name>/BRIEF.md       the brief (from templates/BRIEF.md) — script, moments, references
 *   assets/projects/<name>/footage/       talking-head clip (+ "<name>-GS.mp4" green twin), b-roll clips
 *   assets/projects/<name>/screenshots/   raw screenshots (+ blur-regions.json if names need blurring)
 *   assets/projects/<name>/processed/     generated: blurred screenshots, trimmed b-roll
 *   assets/projects/<name>/cutouts/       generated: RGBA cutout frames for text-behind-subject
 *   assets/projects/<name>/audio/         optional: music / sfx if you want them in the render
 *   src/videos/<name>/                    code; script.txt is filled from the brief by prep
 *   work/<name>/                          transcripts, previews, logs (disposable)
 *   out/<name>/                           final renders + sound cue lists
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const readmeFor = (n) => "# @@\n\nDrop this video's files here. Nothing in this folder is used by any other video.\n\n1. Fill in `BRIEF.md` (the script goes in it too).\n2. Put files in the folders below.\n3. Run `npm run prep -- @@`, then start the session with \"start @@\".\n\n| Folder | Put here |\n|---|---|\n| `footage/` | Your talking-head clip, straight off the phone (any name). For text behind you, also its green-screen copy named `<same name>-GS.mp4`. B-roll clips. |\n| `screenshots/` | Screenshots to show (PNG/WebP). List what must be blurred in the brief. |\n| `audio/` | Your sound-effects library for this video, if any. |\n| `processed/`, `cutouts/` | Generated — leave empty. |\n".split('@@').join(n);

const name = process.argv[2];
if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error('Usage: npm run new-video -- <name>   (lowercase letters, digits and dashes, e.g. founder-story)');
  process.exit(2);
}
const code = join('src', 'videos', name);
if (existsSync(code)) {
  console.error(`A video called "${name}" already exists (${code}). Pick another name.`);
  process.exit(1);
}

const assets = join('assets', 'projects', name);
for (const dir of ['footage', 'screenshots', 'processed', 'cutouts', 'audio']) mkdirSync(join(assets, dir), {recursive: true});
for (const dir of [code, join('work', name), join('out', name)]) mkdirSync(dir, {recursive: true});

writeFileSync(join(code, 'script.txt'), '');
// The brief lives next to the files the user drops in; `npm run prep` reads it.
writeFileSync(join(assets, 'BRIEF.md'), readFileSync(join('templates', 'BRIEF.md'), 'utf8').split('{{name}}').join(name));
writeFileSync(join(assets, 'README.md'), readmeFor(name));

console.log(`Created video project "${name}":
  ${assets}\\BRIEF.md          <- fill this in (script goes in it too)
  ${assets}\\{footage,screenshots,processed,cutouts,audio}
  work\\${name}\\   out\\${name}\\

Next: fill in BRIEF.md, drop footage + screenshots into ${assets},
run "npm run prep -- ${name}", then start the session with "start ${name}".`);
